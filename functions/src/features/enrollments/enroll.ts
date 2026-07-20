// functions/src/features/enrollments/enroll.ts
 import {
   db,
   FieldValue,
   secureHandler,
   stripReservedFields,
   sanitizeNestedObject,
   requireOrg,
   teamIdsFromClaims,
   isAdmin,
   isDev,
   canAccessDoc,
 } from "../../core";
  import { randomUUID as uuid } from "node:crypto";
  import { EnrollmentsEnrollCustomerBody } from "./schemas";
  import { deriveEnrollmentNames } from "./derive";
  import { generateTaskScheduleForEnrollments } from "../tasks/generateScheduleWrite";
  import { applyGrantEnrollmentDefaults } from "./defaults";

const isReservedRouteId = (raw: unknown) => {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return false;
  if (s === "new") return true;
  if (s.startsWith("(") && s.endsWith(")new")) return true;
  return false;
};

/** Shared enrollment creation used by both the web endpoint and ordered forms workflows. */
export async function createCustomerEnrollment(
  user: Record<string, any>,
  input: {grantId: string; customerId: string; extra?: Record<string, unknown>},
) {
  const grantId = String(input.grantId || "").trim();
  const customerId = String(input.customerId || "").trim();
  if (!grantId || !customerId || isReservedRouteId(grantId) || isReservedRouteId(customerId)) {
    throw new Error("invalid_grant_or_customerId");
  }
  const orgId = requireOrg(user);
  const teamIds = Array.from(new Set([orgId, ...teamIdsFromClaims(user)])).slice(0, 10);
  const [gSnap, cSnap] = await Promise.all([
    db.collection("grants").doc(grantId).get(),
    db.collection("customers").doc(customerId).get(),
  ]);
  if (!gSnap.exists) throw new Error("grant_not_found");
  if (!cSnap.exists) throw new Error("customer_not_found");
  const grant = gSnap.data() || {};
  const cust = cSnap.data() || {};
  if (!canAccessDoc(user, grant) && !(isAdmin(user) || isDev(user))) throw new Error("forbidden_grant");
  if (!canAccessDoc(user, cust)) throw new Error("forbidden_customer");

  const existing = await db.collection("customerEnrollments")
    .where("customerId", "==", customerId)
    .where("grantId", "==", grantId)
    .limit(10)
    .get();
  const open = existing.docs.find((doc) => {
    const row = doc.data() || {};
    return row.deleted !== true && row.active !== false && String(row.status || "active") !== "closed";
  });
  if (open) return {id: open.id, created: false};

  const extra = stripReservedFields(sanitizeNestedObject(input.extra || {}));
  const enrollmentExtra = applyGrantEnrollmentDefaults(extra as Record<string, any>, grant as Record<string, any>);
  const id = uuid();
  const now = FieldValue.serverTimestamp();
  const derived = await deriveEnrollmentNames({grantId, customerId, startDate: enrollmentExtra?.startDate, grantDoc: grant, customerDoc: cust});
  await db.collection("customerEnrollments").doc(id).set({
    id, orgId, teamIds, grantId, customerId,
    active: true, status: "active", deleted: false,
    createdAt: now, updatedAt: now,
    by: {uid: user.uid || null, email: user.email || null},
    ...enrollmentExtra,
    ...derived,
  });
  if (enrollmentExtra?.generateTaskSchedule !== false) {
    await generateTaskScheduleForEnrollments({
      enrollmentId: id, mode: "replaceManaged", keepManual: true,
      preserveCompletedManaged: true, pinCompletedManaged: true,
    }, user).catch(() => undefined);
  }
  return {id, created: true};
}

export const enrollmentsEnrollCustomer = secureHandler(async (req, res) => {
  const parsed = EnrollmentsEnrollCustomerBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: "invalid_body", issues: parsed.error.issues });
    return;
  }

  const user = (req as any).user || {};
  try {
    const result = await createCustomerEnrollment(user, parsed.data);
    res.status(result.created ? 201 : 200).json({ok: true, id: result.id, existed: !result.created});
  } catch (error: unknown) {
    const message = String((error as {message?: unknown})?.message || error || "enrollment_failed");
    const status = message.endsWith("_not_found") ? 404 : message.startsWith("forbidden_") ? 403 : 400;
    res.status(status).json({ok: false, error: message});
  }
}, {
  auth: "user",
  requireOrg: true,
  methods: ["POST", "OPTIONS"]
});
