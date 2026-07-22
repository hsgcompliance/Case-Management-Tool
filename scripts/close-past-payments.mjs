#!/usr/bin/env node
/**
 * Mark past-due enrollment payment rows complete/closed.
 *
 * Dry-run by default:
 *   node scripts/close-past-payments.mjs
 *
 * Apply (requires --user for the real paymentsSpend auth chain):
 *   node scripts/close-past-payments.mjs --apply --yes --user=hsgcompliance@thehrdc.org --project=housing-db-v2
 *
 * Useful filters:
 *   --before=2026-05-07         Payments with dueDate < before date
 *   --orgId=HRDC_IX            Only one org
 *   --grantId=abc123           Only one grant
 *   --limit=50                 Stop after N enrollment docs scanned
 *   --skip-paid                Do not alter already-paid rows
 *   --no-inbox                 Do not directly close userTasks mirrors
 *
 * REWRITTEN 2026-07-22: this used to flip `paid:true` directly via a raw
 * Firestore batch write, bypassing paymentsSpend entirely — so it never
 * created a ledger entry for what it marked paid. That silent gap (payment
 * marked paid, zero ledger backing) was found independently three times in
 * one day across two different grants during report-reconciliation-workbench
 * testing (see PROGRESS.md 2026-07-22). It now calls the real POST
 * /paymentsSpend endpoint per payment — same auth chain as
 * scripts/payments-spend.mjs — so every payment this script marks paid gets
 * its ledger entry, payment queue posting, and budget update exactly like
 * marking it paid by hand in the app. Also see the new auditFlags safety net
 * (functions/src/features/payments/triggers.ts, onEnrollmentPaymentsChange)
 * which now flags any future write that still manages to set paid:true with
 * no ledger backing, from any source.
 *
 * userTasks inbox mirrors are still closed via a direct batch write (they
 * are not owned by paymentsSpend/paymentsSpend's transaction).
 */
import admin from "firebase-admin";
import fs from "fs";

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

function paymentKey(p) {
  return String(
    p?.id ||
      `${p?.type || "monthly"}|${iso10(p?.dueDate || p?.date) || ""}|${p?.lineItemId || ""}|${Math.round(
        Number(p?.amount || 0) * 100,
      )}`,
  );
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
const USER_EMAIL = argValue("--user", null);
const CRED_PATH = argValue("--credential", process.env.GOOGLE_APPLICATION_CREDENTIALS || null);
const API_KEY = argValue("--api-key", process.env.FIREBASE_WEB_API_KEY || "AIzaSyBbaSin6GKx6sZNioJ1uz36rD8jgMu-fxI");
const APP_ID = argValue("--app-id", process.env.FIREBASE_APP_ID || "1:184082104139:web:ac03a5c22db791a32332ce");
const REGION = argValue("--region", "us-central1");

if (!/^\d{4}-\d{2}-\d{2}$/.test(BEFORE)) {
  throw new Error(`--before must be YYYY-MM-DD. Got: ${BEFORE}`);
}

if (APPLY && !YES) {
  throw new Error("Refusing to write without --yes. Re-run with --apply --yes after reviewing dry-run output.");
}
if (APPLY && !USER_EMAIL) {
  throw new Error("Refusing to write without --user=email — paymentsSpend requires a real authenticated identity.");
}

if (!admin.apps.length) {
  admin.initializeApp(
    CRED_PATH
      ? { credential: admin.credential.cert(JSON.parse(fs.readFileSync(CRED_PATH, "utf-8"))), projectId: PROJECT_ID }
      : { projectId: PROJECT_ID },
  );
}

const db = admin.firestore();

function shouldTouchPayment(p) {
  const due = iso10(p?.dueDate || p?.date);
  if (!due || due >= BEFORE) return false;
  if (p?.void === true) return false;
  if (SKIP_PAID && p?.paid === true) return false;
  if (p?.paid === true) return false; // already paid — nothing to do via paymentsSpend
  return true;
}

async function mintIdToken() {
  const user = await admin.auth().getUserByEmail(USER_EMAIL);
  const customToken = await admin.auth().createCustomToken(user.uid);
  const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const data = await resp.json();
  if (!resp.ok || !data.idToken) throw new Error(`Token exchange failed: ${JSON.stringify(data)}`);
  return data.idToken;
}

async function callPaymentsSpend(idToken, appCheckToken, enrollmentId, paymentId) {
  const resp = await fetch(`https://${REGION}-${PROJECT_ID}.cloudfunctions.net/paymentsSpend`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}`, "X-Firebase-AppCheck": appCheckToken },
    body: JSON.stringify({ enrollmentId, paymentId, reverse: false }),
  });
  const data = await resp.json().catch(() => ({}));
  return { status: resp.status, ok: resp.ok, data };
}

async function main() {
  let query = db.collection("customerEnrollments");
  if (ORG_ID) query = query.where("orgId", "==", ORG_ID);
  if (GRANT_ID) query = query.where("grantId", "==", GRANT_ID);
  if (LIMIT) query = query.limit(LIMIT);

  const snap = await query.get();
  const targets = [];
  const inboxOps = [];
  let enrollmentsTouched = 0;

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const payments = Array.isArray(data.payments) ? data.payments : [];
    if (!payments.length) continue;

    const touchedPaymentIds = [];
    for (const p of payments) {
      if (!shouldTouchPayment(p)) continue;
      touchedPaymentIds.push(paymentKey(p));
      targets.push({ enrollmentId: doc.id, paymentId: p.id, grantId: data.grantId || null, dueDate: iso10(p.dueDate || p.date), amount: p.amount });
    }
    if (!touchedPaymentIds.length) continue;

    enrollmentsTouched++;
    if (CLOSE_INBOX) {
      for (const paymentId of touchedPaymentIds) {
        inboxOps.push({ ref: db.collection("userTasks").doc(`pay|${doc.id}|${paymentId}`), data: { status: "done" } });
        inboxOps.push({ ref: db.collection("userTasks").doc(`comp|${doc.id}|${paymentId}`), data: { status: "done", paymentComplianceStatus: "approved", hmisComplete: true, caseworthyComplete: true } });
      }
    }
  }

  const summary = {
    projectId: PROJECT_ID,
    apply: APPLY,
    before: BEFORE,
    filters: { orgId: ORG_ID, grantId: GRANT_ID, limit: LIMIT },
    closeInboxMirrors: CLOSE_INBOX,
    scannedEnrollments: snap.size,
    enrollmentsTouched,
    paymentsToClose: targets.length,
    samples: targets.slice(0, 10),
  };
  console.log(JSON.stringify(summary, null, 2));

  if (!APPLY) {
    console.log("\nDry-run only. Re-run with --apply --yes --user=email to write these changes via paymentsSpend.");
    return;
  }

  const idToken = await mintIdToken();
  const appCheckToken = (await admin.appCheck().createToken(APP_ID, { ttlMillis: 30 * 60 * 1000 })).token;

  let succeeded = 0;
  let failed = 0;
  for (const t of targets) {
    const result = await callPaymentsSpend(idToken, appCheckToken, t.enrollmentId, t.paymentId);
    if (result.ok && result.data?.ok !== false) succeeded++;
    else {
      failed++;
      console.error(`FAILED ${t.enrollmentId}/${t.paymentId}: HTTP ${result.status}`, JSON.stringify(result.data));
    }
  }

  if (inboxOps.length) {
    let batch = db.batch();
    let count = 0;
    for (const op of inboxOps) {
      batch.set(op.ref, { ...op.data, updatedAtISO: new Date().toISOString(), completedAtISO: new Date().toISOString() }, { merge: true });
      count++;
      if (count >= 400) {
        await batch.commit();
        batch = db.batch();
        count = 0;
      }
    }
    if (count) await batch.commit();
  }

  console.log(`\nApplied via paymentsSpend: ${succeeded} succeeded, ${failed} failed out of ${targets.length}. Inbox mirrors closed: ${inboxOps.length}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
