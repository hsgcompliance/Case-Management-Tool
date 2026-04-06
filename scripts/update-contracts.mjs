// scripts/update-contracts.mjs
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const contractsDir = path.join(ROOT, "contracts");
const functionsDir = path.join(ROOT, "functions");
const vendorDir = path.join(functionsDir, "vendor");
const functionsPkgPath = path.join(functionsDir, "package.json");

function run(cmd) {
  console.log(`\n> [root] ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
}

function runOut(cmd) {
  console.log(`\n> [root] ${cmd}`);
  return execSync(cmd, { cwd: ROOT, stdio: "pipe" }).toString("utf8").trim();
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function removeTgzs(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith(".tgz")) fs.rmSync(path.join(dir, f));
  }
}

function setFunctionsDepToVendoredTgz() {
  const pkg = JSON.parse(fs.readFileSync(functionsPkgPath, "utf8"));
  pkg.dependencies ||= {};
  pkg.dependencies["@hdb/contracts"] = "file:vendor/contracts.tgz";
  fs.writeFileSync(functionsPkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
  console.log(`\n✓ Updated functions/package.json → @hdb/contracts=file:vendor/contracts.tgz`);
}

function findPackedTgz(tgzName) {
  // npm -w contracts pack may write the tgz in ROOT or in contractsDir depending on npm version/config.
  const candidates = [
    path.join(ROOT, tgzName),
    path.join(contractsDir, tgzName),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function main() {
  // Clean any lingering tgz in common locations to avoid ambiguity
  removeTgzs(ROOT);
  removeTgzs(contractsDir);

  // 1) Build contracts via workspace (root lockfile stays authoritative)
  run("npm -w contracts run build");

  // 2) Pack contracts via workspace
  const tgzName = runOut("npm -w contracts pack --silent");
  const tgzPath = findPackedTgz(tgzName);
  if (!tgzPath) throw new Error(`pack failed: could not find ${tgzName} in root or contracts/`);

  // 3) Copy tgz to functions/vendor
  ensureDir(vendorDir);
  const dest = path.join(vendorDir, "contracts.tgz");
  fs.copyFileSync(tgzPath, dest);
  console.log(`\n✓ Packed → functions/vendor/contracts.tgz (${tgzName})`);

  // 4) Ensure functions depends on vendored tgz
  setFunctionsDepToVendoredTgz();

  // 5) Remove stale @hdb package to avoid npm caching issues
  const functionsHdbDir = path.join(functionsDir, "node_modules", "@hdb");
  if (fs.existsSync(functionsHdbDir)) {
    console.log(`\n✓ Removing stale ${functionsHdbDir}`);
    fs.rmSync(functionsHdbDir, { recursive: true, force: true });
  }

  // 6) Install in functions workspace so node_modules updates
  run("npm -w functions install");

  // 7) Verify and copy from root if needed (npm workspaces can cache incorrectly)
  const rootHdbDir = path.join(ROOT, "node_modules", "@hdb");
  const rootIndexPath = path.join(rootHdbDir, "contracts", "dist", "index.d.ts");
  const funcIndexPath = path.join(functionsHdbDir, "contracts", "dist", "index.d.ts");
  
  if (fs.existsSync(rootIndexPath) && fs.existsSync(funcIndexPath)) {
    const rootSize = fs.statSync(rootIndexPath).size;
    const funcSize = fs.statSync(funcIndexPath).size;
    
    if (rootSize !== funcSize) {
      console.log(`\n⚠ Package mismatch detected (root: ${rootSize} bytes, functions: ${funcSize} bytes)`);
      console.log(`✓ Copying correct package from root node_modules`);
      fs.rmSync(functionsHdbDir, { recursive: true, force: true });
      fs.cpSync(rootHdbDir, functionsHdbDir, { recursive: true, dereference: true });
    }
  } else if (fs.existsSync(rootHdbDir) && !fs.existsSync(functionsHdbDir)) {
    console.log(`\n✓ Copying @hdb package from root to functions`);
    fs.cpSync(rootHdbDir, functionsHdbDir, { recursive: true, dereference: true });
  }

  console.log(`\n✅ Contracts updated successfully!`);
  console.log(`\nNext steps:`);
  console.log(`  npm -w functions run build`);
  console.log(`  npm -w web run build`);
}

main();
