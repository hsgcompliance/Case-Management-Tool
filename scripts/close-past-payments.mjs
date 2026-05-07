#!/usr/bin/env node
/**
 * Mark past-due enrollment payment rows complete/closed.
 *
 * Dry-run by default:
 *   node scripts/close-past-payments.mjs
 *
 * Apply to the configured Firebase project:
 *   node scripts/close-past-payments.mjs --apply --yes --project=housing-db-v2
 *
 * Useful filters:
 *   --before=2026-05-07         Payments with dueDate < before date
 *   --orgId=HRDC_IX            Only one org
 *   --grantId=abc123           Only one grant
 *   --limit=50                 Stop after N enrollment docs scanned
 *   --skip-paid                Do not alter already-paid rows
 *   --no-inbox                 Do not directly close userTasks mirrors
 */
import admin from "firebase-admin";

const argv = process.argv.slice(2);

function has(flag) {
  return argv.includes(flag);
}

function argValue(name, fallback = null) {
  const hit = argv.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : fallback;
}

function argNum(name, fallback = null) {
  const raw = argValue(name, null);
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function iso10(value) {
  if (!value) return null;
  const raw =
    typeof value === "string"
      ? value
      : value?.toDate?.()?.toISOString?.() ?? String(value);
  const m = raw.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function nowIso() {
  return new Date().toISOString();
}

function paymentKey(p) {
  return String(
    p?.id ||
      `${p?.type || "monthly"}|${iso10(p?.dueDate || p?.date) || ""}|${p?.lineItemId || ""}|${Math.round(
        Number(p?.amount || 0) * 100,
      )}`,
  );
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

const APPLY = has("--apply");
const YES = has("--yes");
const BEFORE = argValue("--before", new Date().toISOString().slice(0, 10));
const PROJECT_ID =
  argValue("--project", null) ||
  process.env.GCLOUD_PROJECT ||
  process.env.PROJECT_ID ||
  "housing-db-v2";
const ORG_ID = argValue("--orgId", null);
const GRANT_ID = argValue("--grantId", null);
const LIMIT = argNum("--limit", null);
const SKIP_PAID = has("--skip-paid");
const CLOSE_INBOX = !has("--no-inbox");

if (!/^\d{4}-\d{2}-\d{2}$/.test(BEFORE)) {
  throw new Error(`--before must be YYYY-MM-DD. Got: ${BEFORE}`);
}

if (APPLY && !YES) {
  throw new Error("Refusing to write without --yes. Re-run with --apply --yes after reviewing dry-run output.");
}

if (!admin.apps.length) {
  admin.initializeApp({ projectId: PROJECT_ID });
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

function shouldTouchPayment(p) {
  const due = iso10(p?.dueDate || p?.date);
  if (!due || due >= BEFORE) return false;
  if (p?.void === true) return false;
  if (SKIP_PAID && p?.paid === true) return false;
  return true;
}

function completePayment(p) {
  const due = iso10(p?.dueDate || p?.date);
  const priorCompliance =
    p?.compliance && typeof p.compliance === "object" && !Array.isArray(p.compliance)
      ? p.compliance
      : {};
  return {
    ...p,
    paid: true,
    paidAt: p?.paidAt || due || BEFORE,
    compliance: {
      ...priorCompliance,
      hmisComplete: true,
      caseworthyComplete: true,
      status: "approved",
    },
  };
}

async function commitOps(ops) {
  let batch = db.batch();
  let count = 0;
  for (const op of ops) {
    if (op.type === "update") batch.update(op.ref, op.data);
    else batch.set(op.ref, op.data, { merge: true });
    count++;
    if (count >= 400) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }
  if (count) await batch.commit();
}

async function main() {
  let query = db.collection("customerEnrollments");
  if (ORG_ID) query = query.where("orgId", "==", ORG_ID);
  if (GRANT_ID) query = query.where("grantId", "==", GRANT_ID);
  if (LIMIT) query = query.limit(LIMIT);

  const snap = await query.get();
  const enrollmentOps = [];
  const inboxOps = [];
  const touchedGrantIds = new Set();
  const samples = [];
  let paymentsTouched = 0;
  let enrollmentsTouched = 0;

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const payments = Array.isArray(data.payments) ? data.payments : [];
    if (!payments.length) continue;

    const touchedPaymentIds = [];
    const nextPayments = payments.map((p) => {
      if (!shouldTouchPayment(p)) return p;
      const next = completePayment(p);
      if (sameJson(p, next)) return p;
      touchedPaymentIds.push(paymentKey(next));
      paymentsTouched++;
      return next;
    });

    if (!touchedPaymentIds.length) continue;

    enrollmentsTouched++;
    if (data.grantId) touchedGrantIds.add(String(data.grantId));
    enrollmentOps.push({
      type: "update",
      ref: doc.ref,
      data: {
        payments: nextPayments,
        updatedAt: FieldValue.serverTimestamp(),
      },
    });

    if (CLOSE_INBOX) {
      const completedAtISO = nowIso();
      for (const paymentId of touchedPaymentIds) {
        inboxOps.push({
          type: "set",
          ref: db.collection("userTasks").doc(`pay|${doc.id}|${paymentId}`),
          data: { status: "done", completedAtISO, updatedAtISO: completedAtISO },
        });
        inboxOps.push({
          type: "set",
          ref: db.collection("userTasks").doc(`comp|${doc.id}|${paymentId}`),
          data: {
            status: "done",
            completedAtISO,
            updatedAtISO: completedAtISO,
            paymentComplianceStatus: "approved",
            hmisComplete: true,
            caseworthyComplete: true,
          },
        });
      }
    }

    if (samples.length < 10) {
      samples.push({
        enrollmentId: doc.id,
        grantId: data.grantId || null,
        paymentIds: touchedPaymentIds.slice(0, 10),
      });
    }
  }

  const grantOps = Array.from(touchedGrantIds).map((grantId) => ({
    type: "set",
    ref: db.collection("grants").doc(grantId),
    data: {
      budget: {
        needsRecalc: true,
        needsRecalcAt: FieldValue.serverTimestamp(),
      },
    },
  }));

  const summary = {
    projectId: PROJECT_ID,
    apply: APPLY,
    before: BEFORE,
    filters: { orgId: ORG_ID, grantId: GRANT_ID, limit: LIMIT },
    closeInboxMirrors: CLOSE_INBOX,
    scannedEnrollments: snap.size,
    enrollmentsTouched,
    paymentsTouched,
    grantsFlaggedForRecalc: touchedGrantIds.size,
    writesPlanned: enrollmentOps.length + inboxOps.length + grantOps.length,
    samples,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!APPLY) {
    console.log("\nDry-run only. Re-run with --apply --yes to write these changes.");
    return;
  }

  await commitOps([...enrollmentOps, ...inboxOps, ...grantOps]);
  console.log(`\nApplied ${summary.writesPlanned} writes.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
