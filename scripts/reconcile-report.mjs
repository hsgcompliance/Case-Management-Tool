#!/usr/bin/env node
/**
 * Reconcile a local report file (CSV/TXT) against live dashboard data for one
 * grant, using the same profile/normalization/matching engine as the
 * /tools/*-reconciliation web tools — no browser, no LLM required.
 *
 * Read-only: never writes to Firestore. Report rows/PII are never persisted
 * anywhere except the local --out file you choose.
 *
 * Usage:
 *   node scripts/reconcile-report.mjs --csv="C:/path/to/report.csv" --grant="Bridge Home 25-26"
 *
 * Options:
 *   --csv=PATH       Local CSV/TXT report file (required).
 *   --grant=NAME     Grant name(s) to reconcile against, matched case-insensitively
 *                    against the `grants` collection (required). Comma-separate
 *                    multiple names for a report that spans several grants in one
 *                    file (e.g. "YHDP PSH 25-26,YHDP RRH 25-26") — in that mode no
 *                    single sourceGrant hint is forced onto every row, so each
 *                    row's own report-side grant/service-type text drives which
 *                    grant it matches, and paymentQueue/ledger scope is the union
 *                    of all named grants.
 *   --profile=ID     Force a report profile id instead of auto-detecting
 *                    (see DEFAULT_REPORT_SOURCE_PROFILES in reportProfiles.ts).
 *   --header-row=N   0-indexed header row instead of auto-detecting.
 *   --org=ORG_ID     Org id, if your project has more than one org doc.
 *   --project=ID     Firebase project id (default: housing-db-v2).
 *   --out=PATH       Where to write the JSON findings report
 *                     (default: docs/active-projects.local/report-reconciliation-workbench/reports/<timestamp>-<grant>.json).
 */
import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import os from "os";
import * as esbuild from "esbuild";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");

function argValue(name, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const CSV_PATH = argValue("csv");
const GRANT_NAME = argValue("grant");
const PROFILE_OVERRIDE = argValue("profile");
const HEADER_ROW_OVERRIDE = argValue("header-row");
const ORG_ID_OVERRIDE = argValue("org");
const PROJECT_ID = argValue("project", process.env.GCLOUD_PROJECT || process.env.PROJECT_ID || "housing-db-v2");
const OUT_OVERRIDE = argValue("out");

if (!CSV_PATH || !GRANT_NAME) {
  console.error("Usage: node scripts/reconcile-report.mjs --csv=PATH --grant=\"Grant Name\" [--profile=ID] [--header-row=N] [--org=ORG_ID] [--out=PATH]");
  process.exit(1);
}

async function buildBundle() {
  const entry = `
export {
  DEFAULT_REPORT_SOURCE_PROFILES,
  findReportProfile,
  buildReconciliationPacket,
  deriveHeadersAndRows,
  detectLikelyReportProfiles,
} from ${JSON.stringify(path.join(REPO_ROOT, "web/src/features/report-reconciliation/reportProfiles.ts"))};
export { parseDelimitedText, findHeaderRow } from ${JSON.stringify(path.join(REPO_ROOT, "web/src/features/report-reconciliation/reportFilePreview.ts"))};
export { buildReconciliationReview } from ${JSON.stringify(path.join(REPO_ROOT, "web/src/features/report-reconciliation/reconciliationReview.ts"))};
`;
  const result = await esbuild.build({
    stdin: { contents: entry, resolveDir: REPO_ROOT, loader: "ts" },
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    write: false,
  });
  const tmpFile = path.join(os.tmpdir(), `reconcile-bundle-${Date.now()}.mjs`);
  fs.writeFileSync(tmpFile, result.outputFiles[0].text);
  return tmpFile;
}

function stripDeleted(rows) {
  return rows.filter((r) => r.deleted !== true);
}

async function main() {
  const bundlePath = await buildBundle();
  const engine = await import(`file://${bundlePath.replace(/\\/g, "/")}`);
  fs.unlinkSync(bundlePath);

  if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
  const db = admin.firestore();

  const grantsSnap = await db.collection("grants").get();
  const allGrants = grantsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const requestedNames = GRANT_NAME.split(",").map((s) => s.trim()).filter(Boolean);
  const grants = requestedNames.map((name) => {
    const match = allGrants.find((g) => String(g.name || "").trim().toLowerCase() === name.toLowerCase());
    if (!match) {
      const close = allGrants.map((g) => g.name).filter((n) => n && new RegExp(name.split(/\s+/)[0], "i").test(n));
      console.error(`No grant named "${name}" found.${close.length ? ` Did you mean: ${close.join(", ")}?` : ""}`);
      process.exit(1);
    }
    return match;
  });
  const isMultiGrant = grants.length > 1;
  const orgId = ORG_ID_OVERRIDE || grants[0].orgId;
  console.log(isMultiGrant
    ? `Grants: ${grants.map((g) => `"${g.name}" (${g.id})`).join(", ")}, org ${orgId}`
    : `Grant: "${grants[0].name}" (${grants[0].id}), org ${orgId}`);
  if (isMultiGrant) {
    console.log("Multi-grant mode: no single sourceGrant hint will be forced onto every row — each row's own report-side grant/service-type text resolves which grant it belongs to.");
  }

  const grantIds = grants.map((g) => g.id);
  const [customersSnap, enrollmentsSnap, grantsForOrgSnap, paymentQueueSnaps, ledgerSnaps] = await Promise.all([
    db.collection("customers").where("orgId", "==", orgId).get(),
    db.collection("customerEnrollments").where("orgId", "==", orgId).get(),
    db.collection("grants").where("orgId", "==", orgId).get(),
    Promise.all(grantIds.map((id) => db.collection("paymentQueue").where("grantId", "==", id).get())),
    Promise.all(grantIds.map((id) => db.collection("ledger").where("grantId", "==", id).get())),
  ]);
  const dashboard = {
    customers: stripDeleted(customersSnap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    enrollments: stripDeleted(enrollmentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    grants: grantsForOrgSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    paymentQueueItems: paymentQueueSnaps.flatMap((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    ledger: ledgerSnaps.flatMap((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
  };
  console.log("Dashboard scope:", {
    customers: dashboard.customers.length,
    enrollments: dashboard.enrollments.length,
    paymentQueueItems: dashboard.paymentQueueItems.length,
    ledger: dashboard.ledger.length,
  });

  const raw = fs.readFileSync(CSV_PATH, "utf-8");
  const allRows = engine.parseDelimitedText(raw);
  const fileName = path.basename(CSV_PATH);
  const headerRowIndex = HEADER_ROW_OVERRIDE != null
    ? Number(HEADER_ROW_OVERRIDE)
    : engine.findHeaderRow(allRows, engine.DEFAULT_REPORT_SOURCE_PROFILES, fileName);
  const { headers, dataRows } = engine.deriveHeadersAndRows(allRows, headerRowIndex);

  const profile = PROFILE_OVERRIDE
    ? engine.findReportProfile(engine.DEFAULT_REPORT_SOURCE_PROFILES, PROFILE_OVERRIDE)
    : engine.detectLikelyReportProfiles(engine.DEFAULT_REPORT_SOURCE_PROFILES, headers, fileName, 1)[0]?.profile;
  if (!profile) {
    console.error(`Could not resolve a report profile${PROFILE_OVERRIDE ? ` for id "${PROFILE_OVERRIDE}"` : ""}.`);
    process.exit(1);
  }
  console.log(`Header row: ${headerRowIndex}, profile: ${profile.id} (${profile.label}), data rows: ${dataRows.length}`);

  const packet = engine.buildReconciliationPacket({
    profile,
    headers,
    rows: dataRows,
    sourceFile: fileName,
    headerRowIndex,
    // Single-grant mode: force every row's grant signal to the named grant
    // (matches how a single-grant sheet with no "Grant" column works).
    // Multi-grant mode: leave undefined so each row falls back to its own
    // report-side grant/service-type text (see normalizeReportRow's
    // firstText(...) precedence in reportProfiles.ts).
    sourceGrant: isMultiGrant ? undefined : grants[0].name,
    nameOrder: "auto",
  });
  console.log("Packet summary:", packet.summary);

  const review = engine.buildReconciliationReview([packet], dashboard);
  console.log("\nReview summary:", review.summary);

  const outPath = OUT_OVERRIDE || path.join(
    REPO_ROOT,
    "docs/active-projects.local/report-reconciliation-workbench/reports",
    `${new Date().toISOString().replace(/[:.]/g, "-")}-${grants.map((g) => g.name).join("+").replace(/[^a-z0-9+]+/gi, "-")}.json`,
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(review, null, 2));
  console.log(`\nWrote ${review.findings.length} findings to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
