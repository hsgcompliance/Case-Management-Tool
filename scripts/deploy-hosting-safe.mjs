import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { pushCurrentBranchToGithub, parsePushArgs } from "./lib/githubPush.mjs";
import { reportActiveConflictsAndShouldStop, withDeployCheckouts } from "./lib/deployCheckouts.mjs";

const { shouldPush, commitMsg } = parsePushArgs();
const DEPLOY_ALL_HOSTING = process.argv.includes("--all");
const targetArg = process.argv.find((arg) => arg.startsWith("--target="));
const TARGET = targetArg ? targetArg.slice("--target=".length).trim() : "web";
const BUILD = process.argv.includes("--build");
const SKIP_FLAGS = new Set(["--no-push", "--all", "--build"]);
const deployArgs = process.argv
  .slice(2)
  .filter((arg) => !SKIP_FLAGS.has(arg) && !arg.startsWith("--commit-msg=") && !arg.startsWith("--target="));
const hasExplicitOnly = deployArgs.some((arg) => arg === "--only" || arg.startsWith("--only="));
const WEB_HOSTING_ONLY_TARGET = "hosting:web,functions:firebase-frameworks-housing-db-v2:ssrhousingdbv2";
const defaultOnlyTarget = DEPLOY_ALL_HOSTING
  ? "hosting"
  : TARGET === "web"
    ? WEB_HOSTING_ONLY_TARGET
    : `hosting:${TARGET}`;
const ROOT = resolve(".");
const DEFAULT_COMMAND_TIMEOUT_MS = 90 * 60 * 1000;
const COMMAND_TIMEOUT_MS = Number.isFinite(Number(process.env.HDB_DEPLOY_COMMAND_TIMEOUT_MS))
  && Number(process.env.HDB_DEPLOY_COMMAND_TIMEOUT_MS) > 0
  ? Number(process.env.HDB_DEPLOY_COMMAND_TIMEOUT_MS)
  : DEFAULT_COMMAND_TIMEOUT_MS;

if (!["web", "mobile", "forms"].includes(TARGET)) {
  throw new Error(`Unsupported hosting target: ${TARGET}. Expected web, mobile, or forms.`);
}

// Exit code is thrown, not applied directly with process.exit() — that
// would skip withDeployCheckouts' finally-block release below and leave a
// stale lock file behind (confirmed happening: a killed/failed deploy left
// hosting:web + functions:ssrhousingdbv2 checked out under a dead pid,
// blocking every retry until manually cleared).
class DeployExitError extends Error {
  constructor(code) {
    super(`deploy command failed with exit code ${code}`);
    this.exitCode = code;
  }
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    timeout: COMMAND_TIMEOUT_MS,
  });

  if (result.error) {
    if (result.error.code === "ETIMEDOUT") {
      console.error(`Command timed out after ${Math.round(COMMAND_TIMEOUT_MS / 60000)} minutes: ${command} ${args.join(" ")}`);
      throw new DeployExitError(124);
    }
    throw result.error;
  }

  if (result.status !== 0) {
    throw new DeployExitError(result.status ?? 1);
  }
}

function getCheckoutKeys() {
  if (DEPLOY_ALL_HOSTING) return ["hosting:all", "functions:ssrhousingdbv2"];
  const keys = [`hosting:${TARGET}`];
  if (TARGET === "web") keys.push("functions:ssrhousingdbv2");
  return keys;
}

function clearWebNextCache() {
  const cachePath = join(process.cwd(), "web", ".next", "cache");
  try {
    rmSync(cachePath, { recursive: true, force: true });
    console.log("Cleared web/.next/cache before hosting deploy.");
  } catch (error) {
    console.warn(`Could not clear web/.next/cache: ${error?.message || error}`);
  }
}

const checkoutKeys = getCheckoutKeys();

// Fast pre-flight: report a real conflict in seconds, before spending
// minutes on a Next.js build only to find out the target was already
// checked out (previously this only surfaced after acquireDeployCheckouts'
// silent, multi-hour wait — or, worse, after the build, since there was no
// pre-check at all on this script).
if (reportActiveConflictsAndShouldStop(checkoutKeys, { root: ROOT })) {
  process.exit(1);
}

try {
  // Firebase Hosting's pinTag flow currently conflicts with the generated
  // SSR Cloud Run service for this app, so make deploys opt out consistently.
  withDeployCheckouts(checkoutKeys, { root: ROOT, description: `firebase deploy --only ${defaultOnlyTarget}` }, () => {
    if (TARGET === "web" || DEPLOY_ALL_HOSTING) clearWebNextCache();
    if (BUILD && TARGET !== "web" && !DEPLOY_ALL_HOSTING) {
      run("npm", ["run", `build:${TARGET}`]);
    }
    run("firebase", ["experiments:disable", "pintags"]);
    run("firebase", hasExplicitOnly ? ["deploy", ...deployArgs] : ["deploy", "--only", defaultOnlyTarget, ...deployArgs]);
  });
} catch (error) {
  // withDeployCheckouts' own finally has already released the checkout by
  // the time we get here — safe to exit now.
  if (error instanceof DeployExitError) process.exit(error.exitCode);
  throw error;
}

if (shouldPush) {
  pushCurrentBranchToGithub({ commitMsg });
}
