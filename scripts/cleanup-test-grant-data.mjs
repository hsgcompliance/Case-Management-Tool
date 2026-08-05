#!/usr/bin/env node
/**
 * Manifest-driven Project 4 cleanup. Dry-run/review is the default.
 *
 * Review:
 *   node scripts/cleanup-test-grant-data.mjs --manifest=PATH
 * Apply only after the generated ID manifest has been reviewed:
 *   node scripts/cleanup-test-grant-data.mjs --manifest=PATH --apply --yes
 */
import admin from "firebase-admin";
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const argValue = (name, fallback = null) => {
  const hit = argv.find((arg) => arg.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : fallback;
};

const APPLY = has("--apply");
const YES = has("--yes");
const MANIFEST_PATH = argValue("--manifest");
const PROJECT_ID = argValue("--project", process.env.GCLOUD_PROJECT || process.env.PROJECT_ID || "housing-db-v2");
const CRED_PATH = argValue("--credential", process.env.GOOGLE_APPLICATION_CREDENTIALS || null);

if (!MANIFEST_PATH) throw new Error("manifest_required");
if (APPLY && !YES) throw new Error("Refusing to write without --apply --yes after manifest review.");

const manifest = JSON.parse(fs.readFileSync(path.resolve(MANIFEST_PATH), "utf8"));
if (manifest.projectId !== PROJECT_ID) throw new Error("manifest_project_mismatch");
if (manifest.review?.status !== "approved" || !manifest.review?.reviewedAt) {
  throw new Error("manifest_not_reviewed");
}
if (!Array.isArray(manifest.records) || !manifest.records.length) throw new Error("manifest_records_required");

if (!admin.apps.length) {
  admin.initializeApp(CRED_PATH
    ? { credential: admin.credential.cert(JSON.parse(fs.readFileSync(CRED_PATH, "utf8"))), projectId: PROJECT_ID }
    : { projectId: PROJECT_ID });
}
const db = admin.firestore();
const { FieldValue, Timestamp } = admin.firestore;

const recordsByType = new Map();
for (const record of manifest.records) {
  const list = recordsByType.get(record.recordType) || [];
  list.push(record);
  recordsByType.set(record.recordType, list);
}
const records = (type) => recordsByType.get(type) || [];
const idSet = (type, action = null) => new Set(records(type).filter((row) => !action || row.proposedAction === action).map((row) => row.recordId));
const sorted = (values) => [...values].sort();
const assertSameIds = (label, actual, expected) => {
  const a = sorted(actual);
  const e = sorted(expected);
  if (JSON.stringify(a) !== JSON.stringify(e)) {
    throw new Error(`${label}_manifest_drift:actual=${JSON.stringify(a)} expected=${JSON.stringify(e)}`);
  }
};

async function loadAndReview() {
  const grantRows = records("grant");
  const grantIds = grantRows.map((row) => row.recordId);
  if (!grantIds.length || new Set(grantIds).size !== grantIds.length) throw new Error("invalid_grant_manifest");

  const grantSnaps = await db.getAll(...grantIds.map((id) => db.collection("grants").doc(id)));
  for (const snap of grantSnaps) {
    if (!snap.exists) throw new Error(`grant_missing:${snap.id}`);
    const row = grantRows.find((candidate) => candidate.recordId === snap.id);
    const data = snap.data() || {};
    const normalizedName = String(data.name || data.label || "").normalize("NFKC").trim().toLowerCase();
    const nameMarkerMatches = normalizedName === "test grant" || normalizedName.startsWith("test grant ");
    if (!nameMarkerMatches || row?.reviewedTestMarker !== true) throw new Error(`grant_marker_mismatch:${snap.id}`);
  }

  const enrollmentDocs = [];
  const queueDocs = [];
  const ledgerDocs = [];
  const reversalDocs = [];
  const spendPaths = [];
  const relatedCounts = { jotformSubmissions: 0, budgetPipelines: 0, grantCustomerSpend: 0, auditFlags: 0 };

  for (const grantId of grantIds) {
    const [enrollments, queue, ledger, jotform, pipelines, allocations, flags] = await Promise.all([
      db.collection("customerEnrollments").where("grantId", "==", grantId).get(),
      db.collection("paymentQueue").where("grantId", "==", grantId).get(),
      db.collection("ledger").where("grantId", "==", grantId).get(),
      db.collection("jotformSubmissions").where("grantId", "==", grantId).get(),
      db.collection("budgetPipelines").where("grantId", "==", grantId).get(),
      db.collection("grantCustomerSpend").where("grantId", "==", grantId).get(),
      db.collection("auditFlags").where("grantId", "==", grantId).get(),
    ]);
    enrollmentDocs.push(...enrollments.docs);
    queueDocs.push(...queue.docs);
    const expectedLedgerIds = idSet("ledger");
    const expectedReversalIds = new Set(records("ledger").map((row) => row.reversalRecordId).filter(Boolean));
    for (const doc of ledger.docs) {
      if (expectedLedgerIds.has(doc.id)) ledgerDocs.push(doc);
      else if (expectedReversalIds.has(doc.id)) reversalDocs.push(doc);
      else throw new Error(`unexpected_ledger_record:${doc.id}`);
    }
    relatedCounts.jotformSubmissions += jotform.size;
    relatedCounts.budgetPipelines += pipelines.size;
    relatedCounts.grantCustomerSpend += allocations.size;
    relatedCounts.auditFlags += flags.size;
    for (const enrollment of enrollments.docs) {
      const spends = await enrollment.ref.collection("spends").get();
      spendPaths.push(...spends.docs.map((doc) => doc.ref.path));
    }
  }

  assertSameIds("enrollments", enrollmentDocs.map((doc) => doc.id), idSet("enrollment"));
  assertSameIds("payment_queue", queueDocs.map((doc) => doc.id), idSet("projection"));
  assertSameIds("ledger", ledgerDocs.map((doc) => doc.id), idSet("ledger"));
  const allowedReversalIds = new Set(records("ledger").map((row) => row.reversalRecordId).filter(Boolean));
  for (const doc of reversalDocs) {
    if (!allowedReversalIds.has(doc.id)) throw new Error(`unexpected_reversal:${doc.id}`);
  }
  assertSameIds("spend_mirrors", spendPaths, idSet("spendMirror"));

  if (Object.values(relatedCounts).some((count) => count !== 0)) {
    throw new Error(`unexpected_related_records:${JSON.stringify(relatedCounts)}`);
  }
  for (const doc of queueDocs) {
    const data = doc.data() || {};
    if (String(data.source || "") !== "projection") throw new Error(`non_projection_queue_record:${doc.id}`);
    const manifestRow = records("projection").find((row) => row.recordId === doc.id);
    if (!manifestRow || manifestRow.originalGrantId !== data.grantId || manifestRow.currentGrantId !== data.grantId) {
      throw new Error(`projection_assignment_drift:${doc.id}`);
    }
    const status = String(data.queueStatus || "");
    const statusMatches = manifestRow.proposedAction === "void"
      ? status === "pending" || status === "void"
      : manifestRow.proposedAction === "preserve-posted-shadow" && status === "posted";
    if (!statusMatches) throw new Error(`projection_status_drift:${doc.id}`);
  }
  for (const doc of ledgerDocs) {
    const data = doc.data() || {};
    const manifestRow = records("ledger").find((row) => row.recordId === doc.id);
    if (!manifestRow || manifestRow.proposedAction !== "create-compensating-reversal" || manifestRow.currentGrantId !== data.grantId) {
      throw new Error(`ledger_assignment_drift:${doc.id}`);
    }
  }

  return { grantIds, grantSnaps, enrollmentDocs, queueDocs, ledgerDocs, reversalDocs, spendPaths, relatedCounts };
}

async function applyCleanup(review) {
  const batch = db.batch();
  const now = Timestamp.now();
  const voidedPaymentIdsByEnrollment = new Map();
  for (const doc of review.queueDocs) {
    const row = records("projection").find((candidate) => candidate.recordId === doc.id);
    if (row?.proposedAction !== "void") continue;
    const source = doc.data() || {};
    const enrollmentId = String(source.enrollmentId || "").trim();
    const paymentId = String(source.paymentId || source.submissionId || "").trim();
    if (!enrollmentId || !paymentId) continue;
    const ids = voidedPaymentIdsByEnrollment.get(enrollmentId) || new Set();
    ids.add(paymentId);
    voidedPaymentIdsByEnrollment.set(enrollmentId, ids);
  }
  for (const snap of review.grantSnaps) {
    const source = snap.data() || {};
    const budget = source.budget && typeof source.budget === "object" ? source.budget : null;
    const lineItems = Array.isArray(budget?.lineItems)
      ? budget.lineItems.map((lineItem) => {
          const amount = Number(lineItem?.amount || 0) || 0;
          return {
            ...lineItem,
            projected: 0,
            spent: 0,
            projectedInWindow: 0,
            spentInWindow: 0,
            balance: amount,
            remaining: amount,
            projectedBalance: amount,
          };
        })
      : [];
    const total = Number(budget?.total ?? budget?.totals?.total ?? lineItems.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)) || 0;
    batch.set(snap.ref, {
      status: "deleted",
      active: false,
      deleted: true,
      deletedAt: FieldValue.serverTimestamp(),
      testData: true,
      testDataReviewedAt: manifest.review.reviewedAt,
      cleanupProject: "invoicing-budget-alignment-project-4",
      ...(budget ? {
        budget: {
          ...budget,
          lineItems,
          totals: {
            ...(budget.totals || {}),
            total,
            projected: 0,
            spent: 0,
            projectedInWindow: 0,
            spentInWindow: 0,
            balance: total,
            remaining: total,
            projectedBalance: total,
            windowBalance: total,
            windowProjectedBalance: total,
          },
          needsRecalc: false,
        },
      } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  for (const doc of review.enrollmentDocs) {
    const source = doc.data() || {};
    const voidedPaymentIds = voidedPaymentIdsByEnrollment.get(doc.id) || new Set();
    const matchedPaymentIds = new Set();
    const hasPaymentSchedule = Array.isArray(source.payments);
    const payments = hasPaymentSchedule
      ? source.payments.map((payment) => {
          const paymentId = String(payment?.id || "").trim();
          if (!voidedPaymentIds.has(paymentId)) return payment;
          matchedPaymentIds.add(paymentId);
          return payment?.void === true ? payment : { ...payment, void: true };
        })
      : [];
    assertSameIds(`enrollment_voided_payments:${doc.id}`, matchedPaymentIds, voidedPaymentIds);
    batch.set(doc.ref, {
      status: "deleted",
      active: false,
      deleted: true,
      ...(hasPaymentSchedule ? { payments } : {}),
      deletedAt: FieldValue.serverTimestamp(),
      cleanupProject: "invoicing-budget-alignment-project-4",
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  for (const doc of review.queueDocs) {
    const row = records("projection").find((candidate) => candidate.recordId === doc.id);
    if (row?.proposedAction !== "void") continue;
    batch.set(doc.ref, {
      queueStatus: "void",
      void: true,
      voidedAt: FieldValue.serverTimestamp(),
      voidReason: "reviewed_test_grant_cleanup",
      cleanupProject: "invoicing-budget-alignment-project-4",
      updatedAt: FieldValue.serverTimestamp(),
      updatedAtISO: now.toDate().toISOString(),
    }, { merge: true });
  }
  for (const doc of review.ledgerDocs) {
    const source = doc.data() || {};
    const row = records("ledger").find((candidate) => candidate.recordId === doc.id);
    const reversalId = row?.reversalRecordId;
    if (!reversalId) throw new Error(`reversal_id_missing:${doc.id}`);
    const reversalRef = db.collection("ledger").doc(reversalId);
    const existing = await reversalRef.get();
    if (existing.exists) {
      if (String(existing.get("reversalOf") || "") !== doc.id) throw new Error(`reversal_conflict:${reversalId}`);
      continue;
    }
    const amountCents = Number.isFinite(Number(source.amountCents))
      ? Number(source.amountCents)
      : Math.round((Number(source.amount) || 0) * 100);
    batch.create(reversalRef, {
      orgId: source.orgId || null,
      grantId: source.grantId || null,
      lineItemId: source.lineItemId || null,
      customerId: source.customerId || null,
      enrollmentId: source.enrollmentId || null,
      paymentId: source.paymentId || null,
      source: source.source || "enrollment",
      amountCents: -amountCents,
      amount: -amountCents / 100,
      dueDate: source.dueDate || source.date || null,
      date: source.date || source.dueDate || null,
      month: source.month || null,
      reversalOf: doc.id,
      labels: ["reversal", `reversalOf:${doc.id}`, "reviewed_test_grant_cleanup"],
      origin: {
        app: "hdb",
        sourcePath: doc.ref.path,
        cleanupProject: "invoicing-budget-alignment-project-4",
      },
      createdAt: now,
      updatedAt: now,
    });
  }
  await batch.commit();
}

const review = await loadAndReview();
const summary = {
  projectId: PROJECT_ID,
  manifest: path.resolve(MANIFEST_PATH),
  apply: APPLY,
  reviewedGrantIds: review.grantIds,
  counts: {
    grants: review.grantSnaps.length,
    enrollments: review.enrollmentDocs.length,
    projections: review.queueDocs.length,
    pendingProjectionsToVoid: idSet("projection", "void").size,
    postedProjectionShadowsPreserved: idSet("projection", "preserve-posted-shadow").size,
    ledgerEntriesToReverse: review.ledgerDocs.length,
    existingCleanupReversals: review.reversalDocs.length,
    spendMirrorsPreserved: review.spendPaths.length,
    sourceJotformTransactions: review.relatedCounts.jotformSubmissions,
    pipelines: review.relatedCounts.budgetPipelines,
    persistedReconciliationRecords: review.relatedCounts.auditFlags,
  },
};
console.log(JSON.stringify(summary, null, 2));
if (!APPLY) {
  console.log("Dry-run review passed. Re-run with --apply --yes only after reviewing this exact manifest.");
} else {
  await applyCleanup(review);
  console.log("Manifest cleanup applied.");
}
