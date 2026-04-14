/**
 * Variants (run from repo root):
 * - Functions reset + redeploy:
 *   `node scripts/reset-and-redeploy.mjs housing-db-v2`
 * - Functions reset + redeploy + hosting:
 *   `node scripts/reset-and-redeploy.mjs housing-db-v2 --hosting`
 * - Delete Firebase framework SSR function(s) first, then hosting:
 *   `node scripts/reset-and-redeploy.mjs housing-db-v2 --delete-hosting-ssr --hosting-only`
 * - Functions only (no reset):
 *   `firebase deploy --only functions --project housing-db-v2 --force`
 * - Hosting only:
 *   `firebase deploy --only hosting --project housing-db-v2`
 */
import { spawnSync } from "node:child_process";
import { pushCurrentBranchToGithub, parsePushArgs } from "./lib/githubPush.mjs";

const PROJECT = process.argv[2] || "housing-db-v2";
const DEPLOY_HOSTING = process.argv.includes("--hosting");
const DELETE_HOSTING_SSR = process.argv.includes("--delete-hosting-ssr");
const HOSTING_ONLY = process.argv.includes("--hosting-only");
const { shouldPush, commitMsg } = parsePushArgs();
const REGION = "us-central1";
const BATCH_SIZE = 20;

function run(cmd, args, { allowFailure = false, stdio = "inherit" } = {}) {
  const result = spawnSync(cmd, args, {
    stdio,
    shell: process.platform === "win32",
    encoding: "utf8",
  });

  if (result.error) throw result.error;

  if ((result.status ?? 1) !== 0 && !allowFailure) {
    throw new Error(`${cmd} exited with code ${result.status ?? "unknown"}`);
  }

  return result;
}

function listFunctions() {
  const result = run(
    "gcloud",
    ["functions", "list", "--project", PROJECT, "--format=value(name)"],
    { stdio: "pipe" }
  );

  const stdout = (result.stdout || "").replace(/\r/g, "");
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((fullName) => fullName.split("/").pop())
    .filter(Boolean);
}

function listFunctionsDetailed() {
  const result = run("gcloud", ["functions", "list", "--project", PROJECT, "--format=json"], {
    stdio: "pipe",
  });
  const stdout = (result.stdout || "").replace(/\r/g, "");
  try {
    const parsed = JSON.parse(stdout);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getShortName(resourceName) {
  return String(resourceName || "").split("/").pop() || "";
}

function isFrameworkSsrFunction(fn) {
  const labels = fn?.labels || {};
  const codebase = String(labels["firebase-functions-codebase"] || "");
  const env = fn?.serviceConfig?.environmentVariables || fn?.environmentVariables || {};
  const hasFrameworkEntry = typeof env["__FIREBASE_FRAMEWORKS_ENTRY__"] === "string";
  const short = getShortName(fn?.name);

  if (codebase.startsWith("firebase-frameworks-")) return true;
  if (hasFrameworkEntry) return true;

  // Conservative fallback for older framework-generated names (e.g. ssr<projectId>)
  return (
    short.startsWith("ssr") &&
    String(labels["deployment-tool"] || "") === "cli-firebase"
  );
}

function deleteHostingSsrFunctions() {
  console.log(`Project: ${PROJECT}`);
  console.log("Scanning for Firebase framework SSR functions...");
  const functions = listFunctionsDetailed();
  const ssrFunctions = functions.filter(isFrameworkSsrFunction);

  if (!ssrFunctions.length) {
    console.log("No Firebase framework SSR functions found.");
    return;
  }

  for (const fn of ssrFunctions) {
    const short = getShortName(fn.name);
    const env = fn.environment || "";
    const gen2 = env === "GEN_2" || !!fn.buildConfig;
    console.log(`Deleting framework SSR function: ${short} (${gen2 ? "gen2" : "gen1"})`);

    if (gen2) {
      run(
        "gcloud",
        [
          "functions",
          "delete",
          short,
          "--gen2",
          `--region=${REGION}`,
          `--project=${PROJECT}`,
          "--quiet",
        ],
        { allowFailure: true }
      );
    } else {
      run(
        "firebase",
        ["functions:delete", short, "--region", REGION, "--project", PROJECT, "--force"],
        { allowFailure: true }
      );
    }
  }
}

function deleteBatch(batch) {
  if (!batch.length) return;
  console.log(`Deleting batch (${batch.length}): ${batch.join(" ")}`);
  run(
    "firebase",
    ["functions:delete", ...batch, "--region", REGION, "--project", PROJECT, "--force"],
    { allowFailure: true }
  );
}

function deleteAllFunctions() {
  console.log(`Project: ${PROJECT}`);
  console.log("Listing deployed functions...");
  const functions = listFunctions();

  if (!functions.length) {
    console.log("No deployed functions found.");
    return;
  }

  let batch = [];

  for (const fn of functions) {
    if (fn === "sendMonthlyDigests") {
      deleteBatch(batch);
      batch = [];
      console.log(`Deleting special-case gen2 scheduled function: ${fn}`);
      run(
        "gcloud",
        [
          "functions",
          "delete",
          fn,
          "--gen2",
          `--region=${REGION}`,
          `--project=${PROJECT}`,
          "--quiet",
        ],
        { allowFailure: true }
      );
      continue;
    }

    batch.push(fn);
    if (batch.length >= BATCH_SIZE) {
      deleteBatch(batch);
      batch = [];
    }
  }

  deleteBatch(batch);
}

function deploy() {
  if (HOSTING_ONLY) {
    console.log("Deploying hosting...");
    run("firebase", ["deploy", "--only", "hosting", "--project", PROJECT]);
    return;
  }

  console.log("Deploying functions...");
  run("firebase", ["deploy", "--only", "functions", "--project", PROJECT, "--force"]);

  if (DEPLOY_HOSTING) {
    console.log("Deploying hosting...");
    run("firebase", ["deploy", "--only", "hosting", "--project", PROJECT]);
  }
}

if (DELETE_HOSTING_SSR) {
  deleteHostingSsrFunctions();
}

if (!HOSTING_ONLY) {
  deleteAllFunctions();
}

deploy();

if (shouldPush) {
  pushCurrentBranchToGithub({ commitMsg });
}
