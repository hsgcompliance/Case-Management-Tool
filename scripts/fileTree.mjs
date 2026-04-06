#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "./lib/config.mjs";

const cfg = await loadConfig();
const ROOT = path.resolve(cfg.ROOT, "..");

const IGNORE_DIRS = new Set(["node_modules",".git","dist","build",".next",".turbo",".cache","coverage",".out"]);
const IGNORE_FILES = new Set(["package-lock.json","yarn.lock","pnpm-lock.yaml","bun.lockb"]);

async function statSafe(p){ try{return await fs.lstat(p);}catch{return null;} }
const rel = (p)=> path.relative(ROOT,p) || ".";
const isLock = (n)=> IGNORE_FILES.has(n);
const skipDir = (n)=> IGNORE_DIRS.has(n);

// Build default targets: all first-level entries under ROOT (files + dirs), filtered
async function defaultTargets() {
  const entries = await fs.readdir(ROOT, { withFileTypes: true });
  return entries
    .filter(e => !(e.isDirectory() && skipDir(e.name)) && !(e.isFile() && isLock(e.name)))
    .map(e => e.name);
}

async function walk(dir) {
  const st = await statSafe(dir); if(!st) return null;
  if (st.isFile()) return { name: path.basename(dir), path: rel(dir), type:"file" };
  if (st.isSymbolicLink()) return { name: path.basename(dir), path: rel(dir), type:"symlink" };
  const name = path.basename(dir);
  if (skipDir(name)) return null;
  const node = { name, path: rel(dir), type:"dir", children: [] };
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) { if (skipDir(e.name)) continue; const c = await walk(path.join(dir,e.name)); if(c) node.children.push(c); }
    else if (e.isFile()) { if (isLock(e.name)) continue; node.children.push({ name:e.name, path: rel(path.join(dir,e.name)), type:"file" }); }
  }
  return node;
}

function toText(node, prefix="") {
  if(!node) return "";
  const ch = (node.children||[]).slice().sort((a,b)=> a.type===b.type ? a.name.localeCompare(b.name) : (a.type==="dir"?-1:1));
  const lines = [];
  for (let i=0;i<ch.length;i++) {
    const last = i===ch.length-1; const branch = last ? "└─ " : "├─ ";
    lines.push(prefix + branch + ch[i].name + (ch[i].type==="dir"?"/":""));
    if (ch[i].type==="dir") lines.push(toText(ch[i], prefix + (last?"   ":"│  ")));
  }
  return lines.join("\n");
}

// Resolve targets: CLI args OR everything in root
const cli = process.argv.slice(2);
const targets = cli.length ? cli : await defaultTargets();

const forest = [];
for (const t of targets) {
  const abs = path.join(ROOT, t);
  const st = await statSafe(abs);
  if (!st) continue;
  forest.push(await walk(abs));
}

await fs.writeFile(path.join(cfg.OUT, "file-tree.json"), JSON.stringify(forest, null, 2));

// Pretty text: print dirs as trees, files as single lines
const txt = forest.map(n => {
  if (!n) return "";
  return n.type === "dir" ? `${n.name}/\n${toText(n)}` : n.name;
}).join("\n");
await fs.writeFile(path.join(cfg.OUT, "file-tree.txt"), txt);

console.log(`✓ file tree → ${path.join(cfg.OUT,"file-tree.json")}, ${path.join(cfg.OUT,"file-tree.txt")} (${targets.length} roots)`);