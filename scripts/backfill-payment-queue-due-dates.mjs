#!/usr/bin/env node
/**
 * Backfill paymentQueue.dueDate for credit-card and invoice rows.
 *
 * Extraction already stores the authoritative business date in createdAt.
 * Invoicing range queries use dueDate, so legacy null/missing values make valid
 * rows disappear before client-side filters run. Dry-run is the default.
 */
import admin from "firebase-admin";

const argv = process.argv.slice(2);
const SOURCES = ["credit-card", "invoice"];

function has(flag) {
  return argv.includes(flag);
}

function argValue(name, fallback = null) {
  const hit = argv.find((arg) => arg.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1).trim() : fallback;
}

function isoDate10(value) {
  const match = String(value ?? "").trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

const PROJECT_ID = argValue("--project", process.env.GCLOUD_PROJECT || process.env.PROJECT_ID || "housing-db-v2");
const ORG_ID = argValue("--orgId", null);
const APPLY = has("--apply");
const YES = has("--yes");

if (APPLY && !YES) throw new Error("Refusing to write without --yes.");
if (APPLY && !ORG_ID) throw new Error("Refusing to write without an explicit --orgId=<id> scope.");

if (!admin.apps.length) admin.initializeApp({projectId: PROJECT_ID});
const db = admin.firestore();

async function main() {
  const now = new Date().toISOString();
  const summary = {
    projectId: PROJECT_ID,
    orgId: ORG_ID,
    apply: APPLY,
    scanned: 0,
    alreadyDated: 0,
    eligible: 0,
    invalidCreatedAt: 0,
    outsideOrgScope: 0,
    updated: 0,
    bySource: Object.fromEntries(SOURCES.map((source) => [source, {scanned: 0, eligible: 0, updated: 0}])),
  };
  const writer = APPLY ? db.bulkWriter() : null;

  for (const source of SOURCES) {
    const snap = await db.collection("paymentQueue").where("source", "==", source).get();
    for (const doc of snap.docs) {
      const row = doc.data() || {};
      summary.scanned += 1;
      summary.bySource[source].scanned += 1;

      if (ORG_ID && String(row.orgId || "").trim() !== ORG_ID) {
        summary.outsideOrgScope += 1;
        continue;
      }
      if (String(row.dueDate || "").trim()) {
        summary.alreadyDated += 1;
        continue;
      }

      const dueDate = isoDate10(row.createdAt);
      if (!dueDate) {
        summary.invalidCreatedAt += 1;
        continue;
      }

      summary.eligible += 1;
      summary.bySource[source].eligible += 1;
      if (!writer) continue;

      writer.update(doc.ref, {
        dueDate,
        updatedAtISO: now,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        "system.lastWriter": "backfill-payment-queue-due-dates",
        "system.lastWriteAt": now,
      });
      summary.updated += 1;
      summary.bySource[source].updated += 1;
    }
  }

  if (writer) await writer.close();
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .then(() => admin.app().delete())
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : String(error));
    await admin.app().delete().catch(() => undefined);
    process.exitCode = 1;
  });
