import { spawnSync } from "node:child_process";

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
run("firebase", ["deploy", "--only", "hosting", ...process.argv.slice(2)]);
