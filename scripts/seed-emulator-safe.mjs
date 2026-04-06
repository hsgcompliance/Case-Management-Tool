#!/usr/bin/env node
/**
 * Seed emulator data without running Functions emulator triggers.
 *
 * It runs:
 *   firebase emulators:exec --only firestore,auth \
 *     --import=.emulator-data --export-on-exit=.emulator-data \
 *     "node scripts/seed-emulator.mjs ..."
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const passthroughArgs = process.argv.slice(2);
const projectArg = passthroughArgs.find((a) => a.startsWith("--project="));
const projectId =
  (projectArg ? projectArg.split("=").slice(1).join("=") : "") ||
  process.env.GCLOUD_PROJECT ||
  process.env.PROJECT_ID ||
  "housing-db-v2";

const seedCommand = ["node", "scripts/seed-emulator.mjs", ...passthroughArgs].join(" ");
const seedCommandArg = `"${seedCommand.replace(/"/g, '\\"')}"`;
const firebaseArgs = [
  "emulators:exec",
  "--only",
  "firestore,auth",
  `--project=${projectId}`,
  "--import=.emulator-data",
  "--export-on-exit=.emulator-data",
  seedCommandArg,
];

const child = spawn("firebase", firebaseArgs, {
  cwd: ROOT,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env },
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
