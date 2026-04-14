// scripts/lib/githubPush.mjs
// Shared git push helper used by deploy scripts.
// By default, if the working tree is dirty it will auto-stage and commit before pushing.
// Pass { autoCommit: false } to disable and throw on dirty state instead.

import { spawnSync } from "node:child_process";

function run(cmd, args, { stdio = "inherit", allowFailure = false } = {}) {
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

function readStdout(cmd, args) {
  const result = run(cmd, args, { stdio: "pipe" });
  return String(result.stdout || "").replace(/\r/g, "").trim();
}

function buildAutoCommitMessage() {
  const statusLines = readStdout("git", ["status", "--porcelain"])
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const modified = statusLines.filter((l) => l.startsWith("M") || l.startsWith(" M")).length;
  const added    = statusLines.filter((l) => l.startsWith("A") || l.startsWith("??")).length;
  const deleted  = statusLines.filter((l) => l.startsWith("D") || l.startsWith(" D")).length;

  const parts = [];
  if (modified) parts.push(`${modified} modified`);
  if (added)    parts.push(`${added} added`);
  if (deleted)  parts.push(`${deleted} deleted`);

  const summary = parts.length ? parts.join(", ") : "misc changes";
  const date = new Date().toISOString().slice(0, 10);
  return `chore: deploy ${date} (${summary})`;
}

/**
 * @param {object} [opts]
 * @param {string}  [opts.remote]      Git remote name (default: "origin" or GIT_PUSH_REMOTE env)
 * @param {string}  [opts.branch]      Branch to push (default: current branch)
 * @param {boolean} [opts.autoCommit]  Stage + commit dirty files before pushing (default: true)
 * @param {string}  [opts.commitMsg]   Commit message when auto-committing (default: auto-generated)
 */
export function pushCurrentBranchToGithub({
  remote = process.env.GIT_PUSH_REMOTE || "origin",
  branch,
  autoCommit = true,
  commitMsg,
} = {}) {
  const currentBranch =
    String(branch || "").trim() ||
    readStdout("git", ["rev-parse", "--abbrev-ref", "HEAD"]);

  if (!currentBranch || currentBranch === "HEAD") {
    throw new Error("Cannot push from a detached HEAD.");
  }

  const remoteUrl = readStdout("git", ["remote", "get-url", remote]);
  if (!remoteUrl) {
    throw new Error(`Git remote "${remote}" is not configured.`);
  }

  const dirty = readStdout("git", ["status", "--porcelain"]);

  if (dirty) {
    if (!autoCommit) {
      throw new Error("Refusing to push with uncommitted local changes (autoCommit=false).");
    }

    const msg = commitMsg || buildAutoCommitMessage();
    console.log(`Working tree is dirty — committing before push...`);
    console.log(`  Commit message: "${msg}"`);
    run("git", ["add", "-A"]);
    run("git", ["commit", "-m", msg]);
  }

  console.log(`Pushing ${currentBranch} → ${remote}...`);
  run("git", ["push", "-u", remote, currentBranch]);
  console.log("Push complete.");
}

/**
 * Parse --push / --no-push / --commit-msg="..." from process.argv.
 * Returns { shouldPush, commitMsg }.
 */
export function parsePushArgs(argv = process.argv) {
  const noPush = argv.includes("--no-push");
  const msgArg = argv.find((a) => a.startsWith("--commit-msg="));
  const commitMsg = msgArg ? msgArg.slice("--commit-msg=".length) : undefined;
  return { shouldPush: !noPush, commitMsg };
}
