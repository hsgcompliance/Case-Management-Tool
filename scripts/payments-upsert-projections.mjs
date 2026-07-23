#!/usr/bin/env node
/**
 * Call the real POST /paymentsUpsertProjections backend endpoint to append
 * new schedule rows onto an EXISTING enrollment's live payments[] array —
 * the correct admin path for "this customer's schedule stopped generating
 * too early" gaps (found via report-reconciliation-workbench, see
 * payment-workflow-hardening/PROGRESS.md 2026-07-22). Never hand-writes
 * payments[] directly: this goes through the same collision-checked,
 * budget-projected-adjusting transaction the schedule-editor UI uses
 * (runEnrollmentProjectionsUpsert).
 *
 * Dry-run by default: prints the current live payments[] count/tail and the
 * rows that would be appended, no writes.
 *
 * Apply for real:
 *   node scripts/payments-upsert-projections.mjs --enrollment=ID --append=PATH.json --user=EMAIL --apply --yes
 *
 * PATH.json is a JSON array of new payment rows to append (omit `id` — the
 * backend assigns one, same as the schedule-editor UI). Example row:
 *   { "type": "monthly", "dueDate": "2026-07-01", "amount": 1275, "lineItemId": "li_mfyemee7" }
 *
 * Auth: identical chain to scripts/payments-spend.mjs.
 */
import admin from "firebase-admin";
import fs from "fs";

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
const ENROLLMENT_ID = argValue("enrollment");
const APPEND_PATH = argValue("append");
const APPLY = has("--apply") || has("apply");
const YES = has("--yes") || has("yes");

if (!USER_EMAIL) throw new Error("--user=email is required.");
if (!ENROLLMENT_ID) throw new Error("--enrollment=ID is required.");
if (!APPEND_PATH) throw new Error("--append=PATH.json is required (JSON array of rows to append).");
if (APPLY && !YES) throw new Error("Refusing to write without --yes. Re-run with --apply --yes after reviewing the dry-run output.");

const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!admin.apps.length) {
  admin.initializeApp(
    credentialPath
      ? { credential: admin.credential.cert(JSON.parse(fs.readFileSync(credentialPath, "utf-8"))), projectId: PROJECT_ID }
      : { projectId: PROJECT_ID },
  );
}
const db = admin.firestore();

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

async function callUpsertProjections(idToken, appCheckToken, enrollmentId, payments) {
  const url = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/paymentsUpsertProjections`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}`, "X-Firebase-AppCheck": appCheckToken },
    body: JSON.stringify({ enrollmentId, payments }),
  });
  let data;
  try { data = await resp.json(); } catch { data = { raw: await resp.text() }; }
  return { status: resp.status, ok: resp.ok, data };
}

async function main() {
  const appendRows = JSON.parse(fs.readFileSync(APPEND_PATH, "utf-8"));
  if (!Array.isArray(appendRows) || !appendRows.length) throw new Error("--append file must be a non-empty JSON array.");

  const snap = await db.collection("customerEnrollments").doc(ENROLLMENT_ID).get();
  if (!snap.exists) throw new Error(`Enrollment not found: ${ENROLLMENT_ID}`);
  const data = snap.data() || {};
  const currentPayments = Array.isArray(data.payments) ? data.payments : [];

  console.log(`Enrollment ${ENROLLMENT_ID} (${data.customerName || "unknown"}), grantId=${data.grantId}`);
  console.log(`Current payments[]: ${currentPayments.length} rows. Last 3:`);
  for (const p of currentPayments.slice(-3)) {
    console.log(`  ${p.id} due=${p.dueDate || p.date} amount=${p.amount} paid=${p.paid} lineItemId=${p.lineItemId}`);
  }

  console.log(`\nRows to append (${appendRows.length}):`);
  for (const r of appendRows) console.log(`  ${JSON.stringify(r)}`);

  const nextPayments = [...currentPayments, ...appendRows];
  console.log(`\nNext payments[] would be ${nextPayments.length} rows total.`);

  if (!APPLY) {
    console.log("\nDry-run only. Re-run with --apply --yes to actually call paymentsUpsertProjections.");
    return;
  }

  console.log(`\n--- Authenticating as ${USER_EMAIL} ---`);
  const { idToken, uid } = await mintIdToken(USER_EMAIL);
  const appCheckToken = await mintAppCheckToken();
  console.log(`Authenticated as uid=${uid}. App Check token minted.`);

  const result = await callUpsertProjections(idToken, appCheckToken, ENROLLMENT_ID, nextPayments);
  console.log(`\nHTTP ${result.status}:`, JSON.stringify(result.data, null, 2));

  if (result.ok && result.data?.ok !== false) {
    const updated = (result.data.payments || []).slice(currentPayments.length);
    console.log("\nNewly assigned IDs for appended rows:");
    for (const p of updated) console.log(`  ${p.id} due=${p.dueDate} amount=${p.amount}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
