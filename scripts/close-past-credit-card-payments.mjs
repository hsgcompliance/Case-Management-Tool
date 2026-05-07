#!/usr/bin/env node
/**
 * Dry-run audit for past credit-card payment queue items.
 *
 * Credit-card payments live in /paymentQueue, not enrollment.payments[].
 * The normal closed state is queueStatus: "posted", which should be reached by
 * posting the queue item to ledger after it has grantId + lineItemId.
 *
 * Dry-run by default. To close queue rows without ledger/budget posting:
 *   node scripts/close-past-credit-card-payments.mjs --apply --yes --bypass-ledger
 */
import admin from "firebase-admin";

const argv = process.argv.slice(2);

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

function has(flag) {
  return argv.includes(flag);
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

const BEFORE = argValue("--before", new Date().toISOString().slice(0, 10));
const PROJECT_ID =
  argValue("--project", null) ||
  process.env.GCLOUD_PROJECT ||
  process.env.PROJECT_ID ||
  "housing-db-v2";
const ORG_ID = argValue("--orgId", null);
const GRANT_ID = argValue("--grantId", null);
const CARD_ID = argValue("--creditCardId", null);
const LIMIT = argNum("--limit", null);
const APPLY = has("--apply");
const YES = has("--yes");
const BYPASS_LEDGER = has("--bypass-ledger");

if (!/^\d{4}-\d{2}-\d{2}$/.test(BEFORE)) {
  throw new Error(`--before must be YYYY-MM-DD. Got: ${BEFORE}`);
}

if (APPLY && (!YES || !BYPASS_LEDGER)) {
  throw new Error("Refusing to write without --yes --bypass-ledger. This closes CC queue rows without ledger entries.");
}

if (!admin.apps.length) {
  admin.initializeApp({ projectId: PROJECT_ID });
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

function paymentDate(row) {
  return iso10(row.dueDate || row.createdAt || row.createdAtISO || row.rawMeta?.created_at);
}

function isPastCreditCardPending(row) {
  if (String(row.source || "").toLowerCase() !== "credit-card") return false;
  if (String(row.queueStatus || "pending").toLowerCase() !== "pending") return false;
  const date = paymentDate(row);
  return !!date && date < BEFORE;
}

function isPostable(row) {
  return !!String(row.grantId || "").trim() && !!String(row.lineItemId || "").trim();
}

async function main() {
  let query = db.collection("paymentQueue").where("source", "==", "credit-card");
  if (ORG_ID) query = query.where("orgId", "==", ORG_ID);
  if (GRANT_ID) query = query.where("grantId", "==", GRANT_ID);
  if (CARD_ID) query = query.where("creditCardId", "==", CARD_ID);
  if (LIMIT) query = query.limit(LIMIT);

  const snap = await query.get();
  const samples = [];
  const missingClassificationSamples = [];
  let pendingPast = 0;
  let alreadyPostedPast = 0;
  let voidPast = 0;
  let postablePendingPast = 0;
  let missingClassificationPast = 0;
  let amountCentsPendingPast = 0;
  let amountCentsPostablePendingPast = 0;
  const ops = [];
  const now = new Date().toISOString();

  for (const doc of snap.docs) {
    const row = { id: doc.id, ...(doc.data() || {}) };
    const date = paymentDate(row);
    if (!date || date >= BEFORE) continue;

    const status = String(row.queueStatus || "pending").toLowerCase();
    if (status === "posted") {
      alreadyPostedPast++;
      continue;
    }
    if (status === "void") {
      voidPast++;
      continue;
    }
    if (!isPastCreditCardPending(row)) continue;

    const cents = Number(row.amountCents || Math.round((Number(row.amount || 0) || 0) * 100)) || 0;
    pendingPast++;
    amountCentsPendingPast += cents;
    ops.push({
      ref: doc.ref,
      data: {
        queueStatus: "posted",
        postedAt: now,
        postedBy: "admin-bypass-ledger",
        ledgerEntryId: row.ledgerEntryId || null,
        reopenedAt: null,
        reopenedBy: null,
        reopenReason: null,
        rawStatus: "paid",
        "rawMeta.status": "paid",
        compliance: {
          ...(row.compliance && typeof row.compliance === "object" ? row.compliance : {}),
          hmisComplete: true,
          caseworthyComplete: true,
        },
        closedBypassLedger: true,
        closedBypassLedgerAt: now,
        updatedAtISO: now,
        updatedAt: FieldValue.serverTimestamp(),
        "system.lastWriter": "close-past-credit-card-payments:bypass-ledger",
        "system.lastWriteAt": now,
      },
    });

    const sample = {
      id: row.id,
      date,
      amount: Number(row.amount || 0) || 0,
      merchant: row.merchant || null,
      grantId: row.grantId || null,
      lineItemId: row.lineItemId || null,
      creditCardId: row.creditCardId || null,
    };

    if (isPostable(row)) {
      postablePendingPast++;
      amountCentsPostablePendingPast += cents;
      if (samples.length < 10) samples.push(sample);
    } else {
      missingClassificationPast++;
      if (missingClassificationSamples.length < 10) missingClassificationSamples.push(sample);
    }
  }

  console.log(JSON.stringify({
    projectId: PROJECT_ID,
    apply: APPLY,
    bypassLedger: BYPASS_LEDGER,
    before: BEFORE,
    filters: { orgId: ORG_ID, grantId: GRANT_ID, creditCardId: CARD_ID, limit: LIMIT },
    scannedCreditCardQueueItems: snap.size,
    pendingPast,
    postablePendingPast,
    missingClassificationPast,
    alreadyPostedPast,
    voidPast,
    pendingPastAmount: amountCentsPendingPast / 100,
    postablePendingPastAmount: amountCentsPostablePendingPast / 100,
    writesPlanned: ops.length,
    postableSamples: samples,
    missingClassificationSamples,
  }, null, 2));

  if (!APPLY) {
    console.log("\nDry-run only. Re-run with --apply --yes --bypass-ledger to mark these CC queue rows posted without ledger entries.");
    return;
  }

  let batch = db.batch();
  let count = 0;
  for (const op of ops) {
    batch.set(op.ref, op.data, { merge: true });
    count++;
    if (count >= 400) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }
  if (count) await batch.commit();
  console.log(`\nApplied ${ops.length} bypass close writes.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
