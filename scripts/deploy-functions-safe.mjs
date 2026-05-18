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
 */
import fs from "node:fs";
import { execSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pushCurrentBranchToGithub, parsePushArgs } from "./lib/githubPush.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

const PROJECT = process.argv[2] && !process.argv[2].startsWith("--")
  ? process.argv[2]
  : "housing-db-v2";
const LIST_ONLY = process.argv.includes("--list-only") || process.argv.includes("--dry-run");
const NO_BUILD = process.argv.includes("--no-build");
const WITH_HOSTING = process.argv.includes("--hosting");
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

const TEMP_CONFIG = path.join(ROOT, ".firebase.deploy-functions-safe.json");
const LOCK_FILE = path.join(ROOT, ".firebase.deploy.lock");

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

function acquireDeployLock() {
  try {
    fs.writeFileSync(
      LOCK_FILE,
      JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), script: path.basename(process.argv[1]) }),
      { flag: "wx" },
    );
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new Error(`Another deploy is already running (${LOCK_FILE}).`);
    }
    throw error;
  }
}

function releaseDeployLock() {
  try {
    fs.unlinkSync(LOCK_FILE);
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
  console.log("Deploying hosting after function chunks...");
  run("firebase", ["experiments:disable", "pintags"]);
  run("firebase", ["deploy", "--project", PROJECT, "--only", "hosting"]);
}

try {
  acquireDeployLock();
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
  const deployed = getDeployedFunctionNames();
  const deployedSet = new Set(deployed);
  const localSet = new Set(localAll);
  const missing = localAll.filter((name) => !deployedSet.has(name));
  const extra = deployed.filter((name) => !localSet.has(name));
  const groups = chunk(selected, CHUNK_SIZE).slice(0, MAX_CHUNKS || undefined);

  console.log(`Local exported functions: ${localAll.length}`);
  console.log(`Selected for deploy: ${selected.length}`);
  console.log(`Deployed functions: ${deployed.length || "unknown"}`);
  if (missing.length) console.log(`Missing deployed functions: ${missing.join(", ")}`);
  if (extra.length) console.log(`Extra deployed functions left untouched: ${extra.join(", ")}`);
  console.log(`Chunks: ${groups.length}`);
  groups.forEach((group, i) => console.log(`  ${i + 1}: ${group[0]} ... ${group[group.length - 1]} (${group.length})`));

  if (!LIST_ONLY) {
    writeTempFirebaseConfig();
    groups.forEach((group, index) => deployChunk(group, index, groups.length));
    if (WITH_HOSTING) deployHosting();
  }
} finally {
  cleanupTempFirebaseConfig();
  releaseDeployLock();
}

if (shouldPush) {
  pushCurrentBranchToGithub({ commitMsg });
}
