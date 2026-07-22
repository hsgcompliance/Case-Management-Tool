#!/usr/bin/env node
/**
 * Call the real POST /paymentsSpend backend endpoint — the one code path that
 * atomically marks a scheduled payment paid, writes its ledger entry, flips
 * the paymentQueue projection doc to posted, and adjusts the grant's budget
 * line item. This is the ADMIN PATH the reconciliation tool should use for
 * writeback (NOT raw Firestore writes, and NOT paymentQueuePostToLedger,
 * which throws `use_payments_spend_for_projection` for schedule-derived
 * queue rows — see docs/active-projects.local/report-reconciliation-workbench/PROGRESS.md,
 * 2026-07-22 entry).
 *
 * Dry-run by default: prints the CURRENT live state of each targeted payment
 * (re-fetched fresh, not trusted from the manifest) with no writes.
 *
 * Apply for real:
 *   node scripts/payments-spend.mjs --manifest=PATH --user=EMAIL --apply --yes
 *
 * Single correction (no manifest file):
 *   node scripts/payments-spend.mjs --enrollment=ID --payment=ID --user=EMAIL [--force-sync] --apply --yes
 *
 * Auth: mints a Firebase custom token for --user's uid (via the Admin SDK,
 * requires ADC same as scripts/close-past-payments.mjs), exchanges it for a
 * real ID token via the Identity Toolkit REST API, and mints an App Check
 * token via the Admin SDK — the exact same two checks the browser app itself
 * passes through. Never bypasses auth/App Check/org-access checks.
 */
import admin from "firebase-admin";
import fs from "fs";
import crypto from "crypto";

const argv = process.argv.slice(2);
function has(flag) { return argv.includes(flag); }
function argValue(name, fallback = null) {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const PROJECT_ID = argValue("project", process.env.GCLOUD_PROJECT || process.env.PROJECT_ID || "housing-db-v2");
const REGION = argValue("region", "us-central1");
const API_KEY = argValue("api-key", process.env.FIREBASE_WEB_API_KEY || "AIzaSyBbaSin6GKx6sZNioJ1uz36rD8jgMu-fxI");
const APP_ID = argValue("app-id", process.env.FIREBASE_APP_ID || "1:184082104139:web:ac03a5c22db791a32332ce");
const USER_EMAIL = argValue("user");
const MANIFEST_PATH = argValue("manifest");
const SINGLE_ENROLLMENT = argValue("enrollment");
const SINGLE_PAYMENT = argValue("payment");
const APPLY = has("--apply") || has("apply");
const YES = has("--yes") || has("yes");
const FORCE_SYNC = has("--force-sync") || has("force-sync");
const REVERSE = has("--reverse") || has("reverse");

if (!USER_EMAIL) {
  throw new Error("--user=email is required (the identity the write is performed as).");
}
if (!MANIFEST_PATH && !(SINGLE_ENROLLMENT && SINGLE_PAYMENT)) {
  throw new Error("Provide --manifest=PATH, or both --enrollment=ID and --payment=ID.");
}
if (APPLY && !YES) {
  throw new Error("Refusing to write without --yes. Re-run with --apply --yes after reviewing the dry-run output.");
}

// Explicit admin.credential.cert() forces LOCAL private-key JWT signing for
// createCustomToken. Relying on applicationDefault() here (even with
// GOOGLE_APPLICATION_CREDENTIALS pointing at this same key file) made the SDK
// choose the remote IAM signBlob path instead, which 403s unless the service
// account also has roles/iam.serviceAccountTokenCreator on ITSELF — an extra
// grant we don't need when we already hold the actual private key.
const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!admin.apps.length) {
  admin.initializeApp(
    credentialPath
      ? { credential: admin.credential.cert(JSON.parse(fs.readFileSync(credentialPath, "utf-8"))), projectId: PROJECT_ID }
      : { projectId: PROJECT_ID },
  );
}
const db = admin.firestore();

function loadTargets() {
  if (MANIFEST_PATH) {
    const raw = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
    if (!Array.isArray(raw)) throw new Error("Manifest must be a JSON array.");
    return raw.map((t) => ({
      label: t.label || `${t.enrollmentId}/${t.paymentId}`,
      enrollmentId: t.enrollmentId,
      paymentId: t.paymentId,
      forceSync: t.forceSync === true,
      reverse: t.reverse === true,
      note: t.note,
      vendor: t.vendor,
      comment: t.comment,
    }));
  }
  return [{
    label: `${SINGLE_ENROLLMENT}/${SINGLE_PAYMENT}`,
    enrollmentId: SINGLE_ENROLLMENT,
    paymentId: SINGLE_PAYMENT,
    forceSync: FORCE_SYNC,
    reverse: REVERSE,
  }];
}

async function fetchCurrentState(enrollmentId, paymentId) {
  const snap = await db.collection("customerEnrollments").doc(enrollmentId).get();
  if (!snap.exists) return { found: false };
  const data = snap.data() || {};
  const payment = (data.payments || []).find((p) => p.id === paymentId);
  if (!payment) return { found: false, enrollmentFound: true, customerName: data.customerName };
  const ledgerSnap = await db.collection("ledger").where("enrollmentId", "==", enrollmentId).get();
  const hasPositiveLedger = ledgerSnap.docs.some((d) => {
    const l = d.data() || {};
    return String(l.paymentId || l.origin?.baseId || "") === paymentId && Number(l.amountCents || 0) > 0 && !l.reversalOf;
  });
  return {
    found: true,
    customerName: data.customerName,
    grantId: data.grantId,
    paid: payment.paid === true,
    void: payment.void === true,
    amount: payment.amount,
    dueDate: payment.dueDate,
    hasPositiveLedgerEntry: hasPositiveLedger,
  };
}

async function mintIdToken(email) {
  const user = await admin.auth().getUserByEmail(email);
  const customToken = await admin.auth().createCustomToken(user.uid);
  const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const data = await resp.json();
  if (!resp.ok || !data.idToken) throw new Error(`Token exchange failed: ${JSON.stringify(data)}`);
  return { idToken: data.idToken, uid: user.uid, email: user.email };
}

async function mintAppCheckToken() {
  const result = await admin.appCheck().createToken(APP_ID, { ttlMillis: 30 * 60 * 1000 });
  return result.token;
}

function idempotencyKeyFor(target) {
  return crypto.createHash("sha1")
    .update(`paymentsSpend|${target.enrollmentId}|${target.paymentId}|${target.reverse}|${target.forceSync}`)
    .digest("hex");
}

async function callPaymentsSpend(idToken, appCheckToken, target) {
  const url = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/paymentsSpend`;
  const body = {
    enrollmentId: target.enrollmentId,
    paymentId: target.paymentId,
    reverse: target.reverse === true,
    ...(target.forceSync ? { forceSync: true } : {}),
    ...(target.note ? { note: target.note } : {}),
    ...(target.vendor ? { vendor: target.vendor } : {}),
    ...(target.comment ? { comment: target.comment } : {}),
  };
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
      "X-Firebase-AppCheck": appCheckToken,
      "Idempotency-Key": idempotencyKeyFor(target),
    },
    body: JSON.stringify(body),
  });
  let data;
  try { data = await resp.json(); } catch { data = { raw: await resp.text() }; }
  return { status: resp.status, ok: resp.ok, data };
}

async function main() {
  const targets = loadTargets();
  console.log(`Loaded ${targets.length} target(s). Mode: ${APPLY ? "APPLY" : "DRY RUN"}.\n`);

  console.log("--- Current live state (re-fetched now, not trusted from manifest) ---");
  for (const t of targets) {
    const state = await fetchCurrentState(t.enrollmentId, t.paymentId);
    console.log(`\n${t.label}`);
    console.log(`  enrollmentId=${t.enrollmentId} paymentId=${t.paymentId} forceSync=${t.forceSync} reverse=${t.reverse}`);
    console.log(`  live state:`, JSON.stringify(state));
    if (!state.found) {
      console.log(`  \x1b[31mWARNING: payment not found in live data — this target will fail if applied.\x1b[0m`);
    } else if (!t.forceSync && state.paid && !t.reverse) {
      console.log(`  NOTE: already paid without forceSync — this call will be a safe no-op.`);
    } else if (t.forceSync && state.hasPositiveLedgerEntry) {
      console.log(`  NOTE: a positive ledger entry already exists — forceSync call will be a safe no-op.`);
    }
  }

  if (!APPLY) {
    console.log("\nDry-run only. Re-run with --apply --yes to actually call paymentsSpend.");
    return;
  }

  console.log(`\n--- Authenticating as ${USER_EMAIL} ---`);
  const { idToken, uid } = await mintIdToken(USER_EMAIL);
  const appCheckToken = await mintAppCheckToken();
  console.log(`Authenticated as uid=${uid}. App Check token minted.`);

  console.log("\n--- Applying ---");
  let succeeded = 0;
  let failed = 0;
  for (const t of targets) {
    const result = await callPaymentsSpend(idToken, appCheckToken, t);
    console.log(`\n${t.label}: HTTP ${result.status}`, JSON.stringify(result.data));
    if (result.ok && result.data?.ok !== false) succeeded++;
    else failed++;
  }
  console.log(`\nDone. ${succeeded} succeeded, ${failed} failed out of ${targets.length}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
