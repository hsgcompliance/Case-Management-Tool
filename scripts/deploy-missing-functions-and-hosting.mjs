/**
 * Variants (run from repo root):
 * - List local vs deployed function diff only:
 *   `node scripts/deploy-missing-functions-and-hosting.mjs housing-db-v2 --list-only`
 * - Deploy only missing functions:
 *   `node scripts/deploy-missing-functions-and-hosting.mjs housing-db-v2`
 * - Deploy only missing functions + hosting:
 *   `node scripts/deploy-missing-functions-and-hosting.mjs housing-db-v2 --hosting`
 */
import { execSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const PROJECT = process.argv[2] || "housing-db-v2";
const WITH_HOSTING = process.argv.includes("--hosting");
const LIST_ONLY = process.argv.includes("--list-only");
const CHUNK_SIZE = 20;

function run(cmd, args, { allowFailure = false, cwd = ROOT, env = process.env } = {}) {
  const result = spawnSync(cmd, args, {
    cwd,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if ((result.status ?? 1) !== 0 && !allowFailure) {
    throw new Error(`${cmd} exited with code ${result.status ?? "unknown"}`);
  }
  return result;
}

function getLocalFunctionNames() {
  process.env.GCLOUD_PROJECT = PROJECT;
  const mod = require(path.join(ROOT, "functions", "build", "index.js"));
  const out = [];
  for (const [k, v] of Object.entries(mod)) {
    try {
      if (v && (typeof v === "function" || typeof v === "object") && (v.__endpoint || v.__trigger || v.run)) out.push(k);
    } catch {
      // some firebase-functions v1 exports use getters; ignore unreadable values
    }
  }
  return [...new Set(out)].sort();
}

function getDeployedFunctionNames() {
  const raw = execSync(
    `gcloud functions list --project ${PROJECT} --format="value(name)"`,
    { cwd: ROOT, encoding: "utf8" }
  );
  return raw
    .replace(/\r/g, "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.split("/").pop())
    .filter(Boolean);
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

console.log(`Project: ${PROJECT}`);
console.log("Building functions (local export scan requires fresh build)...");
run("npm", ["--prefix", "functions", "run", "build"]);

const local = getLocalFunctionNames();
const deployed = getDeployedFunctionNames();
const deployedSet = new Set(deployed);
const localSet = new Set(local);
const missing = local.filter((n) => !deployedSet.has(n));
const extra = deployed.filter((n) => !localSet.has(n));

console.log(`Local exported functions: ${local.length}`);
console.log(`Deployed functions: ${deployed.length}`);
console.log(`Missing in project: ${missing.length}`);
if (missing.length) console.log(`Missing list: ${missing.join(", ")}`);
if (extra.length) console.log(`Extra deployed (not local): ${extra.join(", ")}`);

if (LIST_ONLY) process.exit(0);

if (missing.length) {
  for (const group of chunk(missing, CHUNK_SIZE)) {
    const onlyValue = group.map((n) => `functions:${n}`).join(",");
    console.log(`Deploying missing functions (${group.length}): ${group.join(", ")}`);
    run("firebase", ["deploy", "--only", onlyValue, "--project", PROJECT, "--force"]);
  }
} else {
  console.log("No missing functions to deploy.");
}

if (WITH_HOSTING) {
  console.log("Deploying hosting...");
  run("firebase", ["deploy", "--only", "hosting", "--project", PROJECT]);
}
