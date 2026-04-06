//scripts/set-functions-contracts-dep.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const pkgPath = path.join(ROOT, "functions", "package.json");

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
pkg.dependencies ||= {};
pkg.dependencies["@hdb/contracts"] = "file:vendor/contracts";

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
console.log("functions/package.json set to @hdb/contracts=file:vendor/contracts");
