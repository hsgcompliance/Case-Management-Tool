// scripts/dump-functions.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..", "functions", "src");
const OUT  = path.resolve(__dirname, "..", "functions_dump.txt");

const IGNORE_DIRS = new Set(["node_modules", "lib", "dist", ".git", ".firebase", "coverage"]);
const BINARY_EXT  = new Set([".png",".jpg",".jpeg",".gif",".webp",".pdf",".svg",".ico",".zip",".gz",".br",".map"]);
const TEXT_EXT    = new Set([".ts",".tsx",".js",".jsx",".json",".md",".yml",".yaml",".env",".env.example",".txt",".css",".html"]);
const MAX_BYTES   = 200 * 1024;

const isIgnoredDir = (p) => IGNORE_DIRS.has(path.basename(p));
const isBinary = (p) => BINARY_EXT.has(path.extname(p).toLowerCase());

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!isIgnoredDir(full)) yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

const parts = [];
for (const file of walk(ROOT)) {
  const ext = path.extname(file).toLowerCase();
  if (!TEXT_EXT.has(ext)) continue;
  if (isBinary(file)) continue;

  const stat = fs.statSync(file);
  if (stat.size > MAX_BYTES) continue;

  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  const header = `\n\n===== FILE: ${rel} =====\n`;
  const content = fs.readFileSync(file, "utf8");
  parts.push(header + content);
}

fs.writeFileSync(OUT, parts.join(""), "utf8");
console.log(`Wrote ${OUT} with ${parts.length} files.`);
