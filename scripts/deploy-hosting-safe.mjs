import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { pushCurrentBranchToGithub, parsePushArgs } from "./lib/githubPush.mjs";
import { withDeployCheckouts } from "./lib/deployCheckouts.mjs";

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
const defaultOnlyTarget = DEPLOY_ALL_HOSTING ? "hosting" : `hosting:${TARGET}`;
const ROOT = resolve(".");

if (!["web", "mobile", "forms"].includes(TARGET)) {
  throw new Error(`Unsupported hosting target: ${TARGET}. Expected web, mobile, or forms.`);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
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

// Firebase Hosting's pinTag flow currently conflicts with the generated
// SSR Cloud Run service for this app, so make deploys opt out consistently.
withDeployCheckouts(getCheckoutKeys(), { root: ROOT, description: `firebase deploy --only ${defaultOnlyTarget}` }, () => {
  if (TARGET === "web" || DEPLOY_ALL_HOSTING) clearWebNextCache();
  if (BUILD && TARGET !== "web" && !DEPLOY_ALL_HOSTING) {
    run("npm", ["run", `build:${TARGET}`]);
  }
  run("firebase", ["experiments:disable", "pintags"]);
  run("firebase", hasExplicitOnly ? ["deploy", ...deployArgs] : ["deploy", "--only", defaultOnlyTarget, ...deployArgs]);
});

if (shouldPush) {
  pushCurrentBranchToGithub({ commitMsg });
}
