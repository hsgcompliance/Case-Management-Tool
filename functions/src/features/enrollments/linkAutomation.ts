import { createHash } from "node:crypto";
import { db, FieldValue, requireOrg, secureHandler, type AuthedRequest } from "../../core";
import { EnrollmentsLinkedProgramsReconcileBody } from "./schemas";

type Row = Record<string, any> & { id?: string };

function active(row: Row): boolean {
  const status = String(row.status || (row.active === false ? "closed" : "active")).toLowerCase();
  return row.deleted !== true && status === "active" && row.active !== false;
}

function keyId(orgId: string, customerId: string, targetGrantId: string): string {
  return createHash("sha256").update(`${orgId}|${customerId}|${targetGrantId}`).digest("hex").slice(0, 40);
}

function rules(grant: Row): Array<{ targetGrantId: string }> {
  return (Array.isArray(grant?.linking?.enrollmentRules) ? grant.linking.enrollmentRules : [])
    .map((rule: any) => ({ targetGrantId: String(rule?.targetGrantId || "").trim() }))
    .filter((rule: { targetGrantId: string }) => !!rule.targetGrantId);
}

export async function reconcileEnrollmentLinkAutomation(enrollment: Row): Promise<void> {
  const grantId = String(enrollment.grantId || "").trim();
  const customerId = String(enrollment.customerId || "").trim();
  const orgId = String(enrollment.orgId || "").trim();
  if (!grantId || !customerId || !orgId) return;

  const sourceGrantSnap = await db.collection("grants").doc(grantId).get();
  if (!sourceGrantSnap.exists) return;
  const sourceRules = rules(sourceGrantSnap.data() || {});
  if (!sourceRules.length) return;

  const [customerEnrollmentsSnap, grantsSnap] = await Promise.all([
    db.collection("customerEnrollments").where("customerId", "==", customerId).get(),
    db.collection("grants").where("orgId", "==", orgId).get(),
  ]);
  const customerEnrollments: Row[] = customerEnrollmentsSnap.docs.map(
    (doc) => ({ id: doc.id, ...(doc.data() || {}) } as Row),
  );
  const sourceGrantIdsByTarget = new Map<string, Set<string>>();
  for (const grantDoc of grantsSnap.docs) {
    for (const rule of rules(grantDoc.data() || {})) {
      const ids = sourceGrantIdsByTarget.get(rule.targetGrantId) || new Set<string>();
      ids.add(grantDoc.id);
      sourceGrantIdsByTarget.set(rule.targetGrantId, ids);
    }
  }

  for (const { targetGrantId } of sourceRules) {
    const targetGrantSnap = await db.collection("grants").doc(targetGrantId).get();
    if (!targetGrantSnap.exists) continue;
    const sourceGrantIds = sourceGrantIdsByTarget.get(targetGrantId) || new Set([grantId]);
    const linkedSources = customerEnrollments.filter((row) => sourceGrantIds.has(String(row.grantId || "")) && row.deleted !== true);
    const linkedSourceIds = linkedSources.map((row) => String(row.id || "")).filter(Boolean).sort();
    const hasActiveSource = linkedSources.some(active);
    const existingTargets = customerEnrollments.filter(
      (row) => String(row.grantId || "") === targetGrantId && row.deleted !== true,
    );
    const preferredTarget = existingTargets.find(active) || existingTargets[0] || null;
    const lockRef = db.collection("enrollmentAutomationKeys").doc(keyId(orgId, customerId, targetGrantId));
    let targetEnrollmentId = preferredTarget?.id ? String(preferredTarget.id) : "";

    await db.runTransaction(async (tx) => {
      const lockSnap = await tx.get(lockRef);
      const lockedId = String(lockSnap.data()?.enrollmentId || "").trim();
      if (lockedId) targetEnrollmentId = lockedId;
      if (!targetEnrollmentId) {
        const ref = db.collection("customerEnrollments").doc();
        targetEnrollmentId = ref.id;
        const targetGrant = targetGrantSnap.data() || {};
        tx.set(ref, {
          id: ref.id,
          orgId,
          teamIds: Array.isArray(enrollment.teamIds) ? enrollment.teamIds : [orgId],
          grantId: targetGrantId,
          grantName: String(targetGrant.name || targetGrantId),
          customerId,
          customerName: enrollment.customerName || enrollment.clientName || null,
          clientName: enrollment.clientName || enrollment.customerName || null,
          startDate: enrollment.startDate || null,
          endDate: enrollment.endDate || null,
          active: true,
          status: "active",
          deleted: false,
          generateTaskSchedule: false,
          programAutomation: { targetGrantId, sourceEnrollmentIds: linkedSourceIds, createdByRule: true },
          unenrollmentReview: { required: false, reason: null, sourceEnrollmentIds: linkedSourceIds },
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      tx.set(lockRef, { orgId, customerId, targetGrantId, enrollmentId: targetEnrollmentId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    });

    if (!targetEnrollmentId) continue;
    const reviewPatch = hasActiveSource
      ? { required: false, reason: null, sourceEnrollmentIds: linkedSourceIds, clearedAt: FieldValue.serverTimestamp() }
      : { required: true, reason: "all_linked_source_enrollments_closed", sourceEnrollmentIds: linkedSourceIds, flaggedAt: FieldValue.serverTimestamp() };
    await db.collection("customerEnrollments").doc(targetEnrollmentId).set({
      programAutomation: { targetGrantId, sourceEnrollmentIds: linkedSourceIds, createdByRule: true },
      unenrollmentReview: reviewPatch,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
}

export const enrollmentsLinkedProgramsReconcile = secureHandler(async (req, res) => {
  const user = ((req as AuthedRequest).user || {}) as Record<string, unknown>;
  const orgId = requireOrg(user);
  const parsed = EnrollmentsLinkedProgramsReconcileBody.safeParse(req.body || {});
  if (!parsed.success) return void res.status(400).json({ ok: false, error: "invalid_body", issues: parsed.error.issues });
  const [grantSnap, enrollmentSnap] = await Promise.all([
    db.collection("grants").where("orgId", "==", orgId).get(),
    db.collection("customerEnrollments").where("orgId", "==", orgId).get(),
  ]);
  const selected = new Set((parsed.data.grantIds || []).map(String));
  const grants = grantSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) } as Row));
  const sourceGrants = grants.filter((grant) => (!selected.size || selected.has(String(grant.id))) && rules(grant).length > 0);
  const sourceGrantIds = new Set(sourceGrants.map((grant) => String(grant.id)));
  const enrollments: Row[] = enrollmentSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) } as Row));
  const sources = enrollments.filter((row) => sourceGrantIds.has(String(row.grantId || "")) && row.deleted !== true);
  const issues: Array<{ customerId: string; targetGrantId: string; issue: string }> = [];
  for (const source of sources) {
    const sourceGrant = sourceGrants.find((grant) => String(grant.id) === String(source.grantId));
    for (const rule of rules(sourceGrant || {})) {
      const targets = enrollments.filter((row) => row.deleted !== true && String(row.customerId) === String(source.customerId) && String(row.grantId) === rule.targetGrantId);
      if (!targets.length) issues.push({ customerId: String(source.customerId || ""), targetGrantId: rule.targetGrantId, issue: "missing_target_enrollment" });
      if (targets.length > 1) issues.push({ customerId: String(source.customerId || ""), targetGrantId: rule.targetGrantId, issue: "duplicate_target_enrollments" });
    }
  }
  let reconciled = 0;
  if (!parsed.data.dryRun) {
    for (const source of sources) {
      await reconcileEnrollmentLinkAutomation(source);
      reconciled += 1;
    }
  }
  res.status(200).json({
    ok: true,
    dryRun: parsed.data.dryRun,
    sourceEnrollments: sources.length,
    missingTargets: issues.filter((issue) => issue.issue === "missing_target_enrollment").length,
    duplicateTargets: issues.filter((issue) => issue.issue === "duplicate_target_enrollments").length,
    reconciled,
    issues: issues.slice(0, 500),
  });
}, { auth: "admin", requireOrg: true, methods: ["POST", "OPTIONS"] });
