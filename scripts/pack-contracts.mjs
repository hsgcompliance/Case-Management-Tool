import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const contractsDir = path.join(ROOT, "contracts");
const functionsVendorContractsDir = path.join(ROOT, "functions", "vendor", "contracts");
const webVendorContractsDir = path.join(ROOT, "web", "vendor", "contracts");
const vendorDirs = [
  path.join(ROOT, "functions", "vendor"),
  path.join(ROOT, "web", "vendor"),
];

function sh(cmd, cwd) {
  execSync(cmd, { cwd, stdio: "inherit" });
}

function shOut(cmd, cwd) {
  return execSync(cmd, { cwd, stdio: "pipe" }).toString("utf8").trim();
}

for (const vendorDir of vendorDirs) {
  mkdirSync(vendorDir, { recursive: true });
}

for (const f of readdirSync(contractsDir)) {
  if (f.endsWith(".tgz")) rmSync(path.join(contractsDir, f));
}

for (const f of readdirSync(ROOT)) {
  if (f.endsWith(".tgz")) rmSync(path.join(ROOT, f));
}

sh("npm run build", contractsDir);

// Sync an unpacked copy for Cloud Functions to avoid tarball integrity churn.
rmSync(functionsVendorContractsDir, { recursive: true, force: true });
mkdirSync(functionsVendorContractsDir, { recursive: true });
cpSync(path.join(contractsDir, "package.json"), path.join(functionsVendorContractsDir, "package.json"));
cpSync(path.join(contractsDir, "dist"), path.join(functionsVendorContractsDir, "dist"), { recursive: true });

rmSync(webVendorContractsDir, { recursive: true, force: true });
mkdirSync(webVendorContractsDir, { recursive: true });
cpSync(path.join(contractsDir, "package.json"), path.join(webVendorContractsDir, "package.json"));
cpSync(path.join(contractsDir, "dist"), path.join(webVendorContractsDir, "dist"), { recursive: true });

const tgzName = shOut("npm pack --silent", contractsDir);
let tgzPath = path.join(contractsDir, tgzName);

if (!existsSync(tgzPath)) {
  tgzPath = path.join(ROOT, tgzName);
  if (!existsSync(tgzPath)) {
    throw new Error(`pack failed: could not find ${tgzName} in contracts/ or root`);
  }
}

for (const vendorDir of vendorDirs) {
  cpSync(tgzPath, path.join(vendorDir, "contracts.tgz"));
}

console.log(`Packed -> functions/vendor/contracts.tgz (${tgzName})`);
console.log(`Packed -> web/vendor/contracts.tgz (${tgzName})`);
console.log("Synced -> functions/vendor/contracts (package.json + dist)");
console.log("Synced -> web/vendor/contracts (package.json + dist)");
