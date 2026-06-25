/**
 * Chunked all-functions deploy that avoids deleting extra deployed functions.
 *
 * Examples:
 * - Dry run / list chunks:
 *   node scripts/deploy-functions-safe.mjs housing-db-v2 --list-only
 * - Deploy all local functions in chunks:
 *   node scripts/deploy-functions-safe.mjs housing-db-v2 --no-push
 * - Resume after a failed chunk:
 *   node scripts/deploy-functions-safe.mjs housing-db-v2 --start-at=grantsList --no-build --no-push
 * - Deploy only functions matching a regex:
 *   node scripts/deploy-functions-safe.mjs housing-db-v2 --match='^(grants|customers)' --no-push
 * - Deploy all local functions, then hosting, serially:
 *   node scripts/deploy-functions-safe.mjs housing-db-v2 --hosting --no-push
 * - Deploy all local functions, then all hosting targets:
 *   node scripts/deploy-functions-safe.mjs housing-db-v2 --hosting-all --no-push
 */
import fs from "node:fs";
import { execSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pushCurrentBranchToGithub, parsePushArgs } from "./lib/githubPush.mjs";
import {
  acquireDeployCheckouts,
  describeDeployCheckout,
  getDeployCheckoutConflicts,
  withDeployCheckouts,
} from "./lib/deployCheckouts.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

const PROJECT = process.argv[2] && !process.argv[2].startsWith("--")
  ? process.argv[2]
  : "housing-db-v2";
const LIST_ONLY = process.argv.includes("--list-only") || process.argv.includes("--dry-run");
const NO_BUILD = process.argv.includes("--no-build");
const WITH_HOSTING = process.argv.includes("--hosting") || process.argv.includes("--hosting-all");
const DEPLOY_ALL_HOSTING = process.argv.includes("--hosting-all");
const { shouldPush, commitMsg } = parsePushArgs();

const chunkSizeArg = process.argv.find((a) => a.startsWith("--chunk-size="));
const CHUNK_SIZE = Math.max(1, Number(chunkSizeArg?.slice("--chunk-size=".length) || 20));

const startAtArg = process.argv.find((a) => a.startsWith("--start-at="));
const START_AT = startAtArg ? startAtArg.slice("--start-at=".length).trim() : "";

const startAfterArg = process.argv.find((a) => a.startsWith("--start-after="));
const START_AFTER = startAfterArg ? startAfterArg.slice("--start-after=".length).trim() : "";

const matchArg = process.argv.find((a) => a.startsWith("--match="));
const MATCH = matchArg ? new RegExp(matchArg.slice("--match=".length)) : null;

const maxChunksArg = process.argv.find((a) => a.startsWith("--max-chunks="));
const MAX_CHUNKS = maxChunksArg ? Math.max(1, Number(maxChunksArg.slice("--max-chunks=".length))) : 0;
const DEPLOY_AVAILABLE_ONLY = !MATCH && !START_AT && !START_AFTER;

const TEMP_CONFIG = path.join(ROOT, ".firebase.deploy-functions-safe.json");

function run(cmd, args, { allowFailure = false, cwd = ROOT, env = process.env, stdio = "inherit" } = {}) {
  const result = spawnSync(cmd, args, {
    cwd,
    env,
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

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeTempFirebaseConfig() {
  const base = readJson(path.join(ROOT, "firebase.json"));
  const functionsConfig = Array.isArray(base.functions) ? base.functions : [base.functions];
  const safeFunctions = functionsConfig.map((entry) => {
    const { predeploy: _predeploy, ...rest } = entry || {};
    return rest;
  });
  fs.writeFileSync(TEMP_CONFIG, JSON.stringify({ functions: safeFunctions }, null, 2));
}

function cleanupTempFirebaseConfig() {
  try {
    fs.unlinkSync(TEMP_CONFIG);
  } catch {
    // ignore
  }
}

function buildFunctions() {
  process.env.GCLOUD_PROJECT = PROJECT;
  run("node", ["scripts/pack-contracts.mjs"]);
  run("node", ["scripts/set-functions-contracts-dep.mjs"]);
  run("npm", ["--prefix", "functions", "install", "--package-lock-only", "--ignore-scripts"]);
  run("npm", ["--prefix", "functions", "run", "lint"]);
  run("npm", ["--prefix", "functions", "run", "build"]);
}

function getLocalFunctionNames() {
  process.env.GCLOUD_PROJECT = PROJECT;
  const mod = require(path.join(ROOT, "functions", "build", "index.js"));
  const out = [];
  for (const [k, v] of Object.entries(mod)) {
    try {
      if (v && (typeof v === "function" || typeof v === "object") && (v.__endpoint || v.__trigger || v.run)) {
        out.push(k);
      }
    } catch {
      // Firebase function getters can throw during inspection.
    }
  }
  return [...new Set(out)].sort();
}

function getDeployedFunctionNames() {
  try {
    const raw = execSync(
      `gcloud functions list --project ${PROJECT} --format="value(name)"`,
      { cwd: ROOT, encoding: "utf8" },
    );
    return raw
      .replace(/\r/g, "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.split("/").pop())
      .filter(Boolean)
      .sort();
  } catch {
    return [];
  }
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function applyWindow(names) {
  let out = names;
  if (MATCH) out = out.filter((name) => MATCH.test(name));
  if (START_AT) {
    const idx = out.indexOf(START_AT);
    if (idx < 0) throw new Error(`--start-at function not found in selected set: ${START_AT}`);
    out = out.slice(idx);
  }
  if (START_AFTER) {
    const idx = out.indexOf(START_AFTER);
    if (idx < 0) throw new Error(`--start-after function not found in selected set: ${START_AFTER}`);
    out = out.slice(idx + 1);
  }
  return out;
}

function filterCheckedOutFunctions(names) {
  if (!DEPLOY_AVAILABLE_ONLY) return { deployable: names, skipped: [] };

  const conflicts = getDeployCheckoutConflicts(
    names.map((name) => `functions:${name}`),
    { root: ROOT },
  );
  if (!conflicts.length) return { deployable: names, skipped: [] };

  const blocksAllFunctions = conflicts.some((checkout) => checkout.key === "functions:all");
  const checkedOutNames = new Set(
    conflicts
      .map((checkout) => String(checkout.key || ""))
      .filter((key) => key.startsWith("functions:"))
      .map((key) => key.slice("functions:".length)),
  );

  const skipped = blocksAllFunctions ? names : names.filter((name) => checkedOutNames.has(name));
  const skippedSet = new Set(skipped);
  const deployable = names.filter((name) => !skippedSet.has(name));

  console.log("Skipping checked-out function deploy targets:");
  for (const checkout of conflicts) {
    console.log(`  ${describeDeployCheckout(checkout)}`);
  }

  return { deployable, skipped };
}

function deployChunk(group, index, total) {
  const onlyValue = group.map((name) => `functions:${name}`).join(",");
  console.log(`Deploying chunk ${index + 1}/${total} (${group.length}): ${group.join(", ")}`);
  run("npx", [
    "firebase",
    "deploy",
    "--project",
    PROJECT,
    "--config",
    TEMP_CONFIG,
    "--only",
    onlyValue,
    "--force",
  ]);
}

function deployHosting() {
  const hostingTarget = DEPLOY_ALL_HOSTING ? "hosting" : "hosting:web";
  const checkoutKeys = DEPLOY_ALL_HOSTING ? ["hosting:all"] : ["hosting:web", "functions:ssrhousingdbv2"];
  console.log(`Deploying ${hostingTarget} after function chunks...`);
  if (DEPLOY_AVAILABLE_ONLY) {
    const conflicts = getDeployCheckoutConflicts(checkoutKeys, { root: ROOT });
    if (conflicts.length) {
      console.log(`Skipping ${hostingTarget}; deploy target is checked out:`);
      for (const checkout of conflicts) {
        console.log(`  ${describeDeployCheckout(checkout)}`);
      }
      return;
    }
  }
  withDeployCheckouts(checkoutKeys, { root: ROOT, description: `firebase deploy --only ${hostingTarget}` }, () => {
    run("firebase", ["experiments:disable", "pintags"]);
    run("firebase", ["deploy", "--project", PROJECT, "--only", hostingTarget]);
  });
}

let releaseSelectedFunctions = () => {};

try {
  console.log(`Project: ${PROJECT}`);
  console.log(`Chunk size: ${CHUNK_SIZE}`);

  if (!NO_BUILD) {
    console.log("Preparing functions build once...");
    buildFunctions();
  } else {
    console.log("Skipping build (--no-build).");
  }

  const localAll = getLocalFunctionNames();
  const selected = applyWindow(localAll);
  const { deployable, skipped } = filterCheckedOutFunctions(selected);
  const deployed = getDeployedFunctionNames();
  const deployedSet = new Set(deployed);
  const localSet = new Set(localAll);
  const missing = localAll.filter((name) => !deployedSet.has(name));
  const extra = deployed.filter((name) => !localSet.has(name));
  const groups = chunk(deployable, CHUNK_SIZE).slice(0, MAX_CHUNKS || undefined);

  console.log(`Local exported functions: ${localAll.length}`);
  console.log(`Selected for deploy: ${selected.length}`);
  if (skipped.length) console.log(`Skipped checked-out functions: ${skipped.length} (${skipped.join(", ")})`);
  console.log(`Deployable now: ${deployable.length}`);
  console.log(`Deployed functions: ${deployed.length || "unknown"}`);
  if (missing.length) console.log(`Missing deployed functions: ${missing.join(", ")}`);
  if (extra.length) console.log(`Extra deployed functions left untouched: ${extra.join(", ")}`);
  console.log(`Chunks: ${groups.length}`);
  groups.forEach((group, i) => console.log(`  ${i + 1}: ${group[0]} ... ${group[group.length - 1]} (${group.length})`));

  if (!LIST_ONLY) {
    releaseSelectedFunctions = acquireDeployCheckouts(
      deployable.map((name) => `functions:${name}`),
      { root: ROOT, description: "chunked functions deploy" },
    );
    writeTempFirebaseConfig();
    groups.forEach((group, index) => deployChunk(group, index, groups.length));
    if (WITH_HOSTING) deployHosting();
  }
} finally {
  cleanupTempFirebaseConfig();
  releaseSelectedFunctions();
}

if (shouldPush) {
  pushCurrentBranchToGithub({ commitMsg });
}
