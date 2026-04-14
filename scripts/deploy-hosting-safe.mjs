import { spawnSync } from "node:child_process";
import { pushCurrentBranchToGithub, parsePushArgs } from "./lib/githubPush.mjs";

const { shouldPush, commitMsg } = parsePushArgs();
const SKIP_FLAGS = new Set(["--no-push"]);
const deployArgs = process.argv.slice(2).filter((arg) => !SKIP_FLAGS.has(arg) && !arg.startsWith("--commit-msg="));

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

// Firebase Hosting's pinTag flow currently conflicts with the generated
// SSR Cloud Run service for this app, so make deploys opt out consistently.
run("firebase", ["experiments:disable", "pintags"]);
run("firebase", ["deploy", "--only", "hosting", ...deployArgs]);

if (shouldPush) {
  pushCurrentBranchToGithub({ commitMsg });
}
