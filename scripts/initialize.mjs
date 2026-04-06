#!/usr/bin/env node
/**
 * scripts/initialize.mjs
 *
 * One-shot session initializer for HDB v2.
 *
 * Does:
 *  - Refresh file-tree.json / file-tree.txt in scripts/out/
 *  - Best-effort snapshot of gcloud/firebase/git
 *  - Writes a token-sanitized chat init prompt → scripts/out/init.txt
 *  - Optional: ensure active projects match env.config (--apply)
 *  - Optional: PRINT dev run commands (--dev)
 *
 * Safe defaults:
 *  - Never writes tokens to init.txt (redacted)
 *  - No project switching unless --apply
 *  - No terminals/tasks spawned ever (print-only)
 *
 *
 * Usage:
 *   node scripts/initialize.mjs              # defaults to --apply --dev
 *   node scripts/initialize.mjs --apply      # apply only, no dev print
 *   node scripts/initialize.mjs --dev        # print dev commands only
 *   node scripts/initialize.mjs --apply --dev
 *   node scripts/initialize.mjs --dev --appCmd="npm run build --prefix web && npm run start --prefix web"
 *   node scripts/initialize.mjs --dev --previewCmd="npm run dev --prefix web"
 */

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { loadConfig } from "./lib/config.mjs";

const cfg = await loadConfig();
const ROOT = path.resolve(cfg.ROOT, "..");
const OUT_DIR = cfg.OUT;

const argv = process.argv.slice(2);
const hasApplyFlag = argv.includes("--apply");
const hasDevFlag = argv.includes("--dev");
// Default mode: if no flags provided, act like --apply --dev
const APPLY = hasApplyFlag || (!hasApplyFlag && !hasDevFlag);
const DEV = hasDevFlag || (!hasApplyFlag && !hasDevFlag);

function argValue(key) {
  const a = argv.find((v) => v.startsWith(key + "="));
  return a ? a.split("=").slice(1).join("=") : null;
}

const CLI_GCLOUD_PROJECT = argValue("--gcloudProject") || argValue("--project");
const CLI_FIREBASE_PROJECT = argValue("--firebaseProject");
const APP_CMD = argValue("--appCmd");         // optional app cmd override
const PREVIEW_CMD = argValue("--previewCmd"); // optional preview cmd override

const IGNORE_DIRS = new Set([
  "node_modules",".git","dist","build",".next",".turbo",".cache","coverage",".out"
]);
const IGNORE_FILES = new Set([
  "package-lock.json","yarn.lock","pnpm-lock.yaml","bun.lockb"
]);

async function ensureDir(p){ await fs.mkdir(p,{recursive:true}); }
async function statSafe(p){ try{return await fs.lstat(p);}catch{return null;} }

const rel = (p)=> path.relative(ROOT,p) || ".";
const isLock = (n)=> IGNORE_FILES.has(n);
const skipDir = (n)=> IGNORE_DIRS.has(n);

// Build default targets: all first-level entries under ROOT, filtered
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
    const abs = path.join(dir,e.name);
    if (e.isDirectory()) {
      if (skipDir(e.name)) continue;
      const c = await walk(abs); if(c) node.children.push(c);
    } else if (e.isFile()) {
      if (isLock(e.name)) continue;
      node.children.push({ name:e.name, path: rel(abs), type:"file" });
    }
  }
  return node;
}

function toText(node, prefix="") {
  if(!node) return "";
  const ch = (node.children||[]).slice().sort((a,b)=>
    a.type===b.type ? a.name.localeCompare(b.name) : (a.type==="dir"?-1:1)
  );
  const lines = [];
  for (let i=0;i<ch.length;i++) {
    const last = i===ch.length-1;
    const branch = last ? "└─ " : "├─ ";
    lines.push(prefix + branch + ch[i].name + (ch[i].type==="dir"?"/":""));
    if (ch[i].type==="dir") lines.push(toText(ch[i], prefix + (last?"   ":"│  ")));
  }
  return lines.join("\n");
}

/** ---------------- command runner ----------------
 * Windows fix: shell:true so gcloud/firebase .cmd shims resolve.
 */
function runCmd(cmd, args = [], opts = {}) {
  const {
    cwd = ROOT,
    timeoutMs = 20000,
    env = process.env,
    shell = (os.platform() === "win32"),
  } = opts;

  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(cmd, args, { cwd, env, shell });

    let stdout = "";
    let stderr = "";
    let done = false;

    const killTimer = setTimeout(() => {
      if (done) return;
      done = true;
      child.kill("SIGKILL");
      resolve({
        cmd: [cmd, ...args].join(" "),
        ok: false,
        code: null,
        ms: Date.now() - started,
        stdout,
        stderr: stderr + `\n[timeout after ${timeoutMs}ms]`,
      });
    }, timeoutMs);

    child.stdout?.on("data", (d) => (stdout += d.toString()));
    child.stderr?.on("data", (d) => (stderr += d.toString()));

    child.on("error", (err) => {
      if (done) return;
      done = true;
      clearTimeout(killTimer);
      resolve({
        cmd: [cmd, ...args].join(" "),
        ok: false,
        code: null,
        ms: Date.now() - started,
        stdout,
        stderr: stderr + `\n[error: ${err.message}]`,
      });
    });

    child.on("close", (code) => {
      if (done) return;
      done = true;
      clearTimeout(killTimer);
      resolve({
        cmd: [cmd, ...args].join(" "),
        ok: code === 0,
        code,
        ms: Date.now() - started,
        stdout,
        stderr,
      });
    });
  });
}

/** ---------------- env.config loader ---------------- */
async function readEnvConfig() {
  const candidates = [
    path.join(cfg.ROOT, "env.config"),
    path.join(cfg.ROOT, "env.config.json"),
    path.join(ROOT, "env.config"),
    path.join(ROOT, "env.config.json"),
    path.join(ROOT, "scripts", "env.config"),
    path.join(ROOT, "scripts", "env.config.json"),
  ];

  for (const c of candidates) {
    const st = await statSafe(c);
    if (!st || !st.isFile()) continue;
    try {
      const raw = await fs.readFile(c, "utf8");
      const json = JSON.parse(raw);
      return { path: c, json, raw };
    } catch (e) {
      return { path: c, json: null, raw: null, error: e };
    }
  }
  return { path: null, json: null, raw: null };
}

function redactTokens(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const clone = Array.isArray(obj) ? obj.slice() : { ...obj };

  for (const k of Object.keys(clone)) {
    if (k === "tokens" && clone[k] && typeof clone[k] === "object") {
      const t = { ...clone[k] };
      for (const tk of Object.keys(t)) {
        const v = t[tk];
        const len = typeof v === "string" ? v.length : 0;
        t[tk] = `<redacted ${tk} len=${len}>`;
      }
      clone[k] = t;
      continue;
    }
    if (clone[k] && typeof clone[k] === "object") {
      clone[k] = redactTokens(clone[k]);
    }
  }
  return clone;
}

function fmtJSON(v) {
  try { return JSON.stringify(v, null, 2); }
  catch { return String(v); }
}

/** ---------------- desired projects ---------------- */
function resolveDesiredProjects(envJson) {
  const desiredFirebase =
    CLI_FIREBASE_PROJECT ||
    envJson?.build?.firebaseProject ||
    envJson?.firebaseProject ||
    envJson?.projectId ||
    null;

  const desiredGcloud =
    CLI_GCLOUD_PROJECT ||
    envJson?.gcloudProject ||
    envJson?.projectId ||
    desiredFirebase ||
    null;

  return { desiredFirebase, desiredGcloud };
}

/** ---------------- prompt builder ---------------- */
function buildPrompt({
  timestamp,
  git,
  gcloud,
  firebase,
  envCfg,
  fileTreeTxt,
  targets,
  projectSet,
  devPlan,
}) {
  const lines = [];

  lines.push(`Households Database v2 — Session Init (generated ${timestamp})`);
  lines.push("");
  lines.push("Repo:");
  lines.push(`- root: ${ROOT}`);
  lines.push(`- os: ${os.platform()} ${os.release()} (${os.arch()})`);
  lines.push(`- node: ${process.version}`);
  if (git?.summary) lines.push(`- git: ${git.summary}`);

  lines.push("");
  lines.push("");
  lines.push("Non-negotiable architectural decisions:");
  lines.push("1. Ledger is the source of truth for spend + projections.");
  lines.push("2. No legacy apiStore layer in v2.");
  lines.push("3. Capability-based RBAC, enforced on backend with secure wrappers + audit logs.");
  lines.push("4. Routing is dynamic and route-driven. Route = state.");
  lines.push("5. Design Firestore schema + indexes with Data Connect reporting in mind (Data Connect is first-class for complex queries/dashboards).");
  lines.push("6. Prefer transactions for multi-doc atomicity; minimize triggers (keep only reconciliation/consistency crawlers).");
  lines.push("7. Support dynamic/extendable documents: core invariants typed strictly, org-specific fields allowed without breaking base types.");
  lines.push("8. Every backend function must support a safe public/anon route and explicitly branch by user mode (public vs org-scoped).");
  lines.push("9. SSR is optional; CSR default unless benefit stated.");

  lines.push("");
  lines.push("Tenant & role model (non-negotiable):");
  lines.push("- A user is anon until they either join an org or create one.");
  lines.push("- Org tiers: free-tier orgs = public; paid orgs = full RBAC.");
  lines.push("- Paid-org roles include case_manager, compliance, admin, org_dev, super_dev (multi-org dev tools), plus dynamic org-defined roles.");
  lines.push("- Anon/public users are rate-limited and routed to public/test collections by the secure wrapper.");


  lines.push("");
  lines.push("Chosen silo(s): S3 + S4");
  lines.push("Non-goals: anything outside routing/app-shell or RBAC/wrappers/audit.");

  lines.push("");
  lines.push("=== Current work goals (edit me) ===");
  lines.push("Current Work Goals:");
  lines.push("- INGEST INGEST: Consume file context first and foremost do not hallucinate solutions without having seen any the file.");
  lines.push("- When starting a chat: ask for context to view files; list files you want to see first.");
  lines.push("- Next goals:");
  lines.push("  - <add goal>");
  lines.push("  - <add goal>");


  lines.push("");
  lines.push("=== Project selection ===");
  lines.push(`desired gcloud: ${projectSet.desiredGcloud || "(none found)"}`);
  lines.push(`current gcloud: ${projectSet.currentGcloud || "(unknown)"}`);
  lines.push(`gcloud set: ${projectSet.gcloudApplied ? "yes" : "no"}`);
  lines.push(`desired firebase: ${projectSet.desiredFirebase || "(none found)"}`);
  lines.push(`current firebase: ${projectSet.currentFirebase || "(unknown)"}`);
  lines.push(`firebase set: ${projectSet.firebaseApplied ? "yes" : "no"}`);
  if (projectSet.warnings.length) {
    lines.push("warnings:");
    for (const w of projectSet.warnings) lines.push(`- ${w}`);
  }

  lines.push("");
  lines.push("=== Dev plan (print-only) ===");
  lines.push(devPlan.trim());

  lines.push("");
  lines.push("=== Infra snapshot (best effort) ===");
  lines.push("");
  lines.push("gcloud:");
  lines.push(gcloud?.text || "(no gcloud snapshot)");
  lines.push("");
  lines.push("firebase:");
  lines.push(firebase?.text || "(no firebase snapshot)");

  lines.push("");
  lines.push("=== Env config summary (tokens redacted) ===");
  if (envCfg?.found) {
    lines.push(`source: ${envCfg.path}`);
    lines.push(fmtJSON(envCfg.redacted));
  } else {
    lines.push("(env config not found)");
  }

  lines.push("");
  lines.push("=== File tree snapshot ===");
  lines.push(`targets: ${targets.join(", ")}`);
  lines.push("");
  lines.push(fileTreeTxt.trim());

  lines.push("");
  lines.push("=== How to start the next chat ===");
  lines.push(
`Title: Households Database v2 — Silo Work Session Prompt
...
Paste infra + env summary + file tree from this init.txt as needed.`
  );

  return lines.join("\n");
}

// ---------------- main ----------------
await ensureDir(OUT_DIR);

// Resolve roots: non-flag args OR everything in root
const roots = argv.filter((a) => !a.startsWith("--"));
const targets = roots.length ? roots : await defaultTargets();

// Build file tree
const forest = [];
for (const t of targets) {
  const abs = path.join(ROOT, t);
  const st = await statSafe(abs);
  if (!st) continue;
  forest.push(await walk(abs));
}

await fs.writeFile(path.join(OUT_DIR, "file-tree.json"), JSON.stringify(forest, null, 2));

const fileTreeTxt = forest.map(n=>{
  if(!n) return "";
  return n.type==="dir" ? `${n.name}/\n${toText(n)}` : n.name;
}).join("\n");
await fs.writeFile(path.join(OUT_DIR,"file-tree.txt"), fileTreeTxt);

// Read env config early
const envRaw = await readEnvConfig();
const envJson = envRaw.json || {};
const { desiredFirebase, desiredGcloud } = resolveDesiredProjects(envJson);

// Ensure projects (best-effort)
const projectSet = {
  desiredFirebase, desiredGcloud,
  currentFirebase: null, currentGcloud: null,
  gcloudApplied: false, firebaseApplied: false,
  warnings: [],
};

if (!desiredGcloud) projectSet.warnings.push("No desired gcloud project found.");
if (!desiredFirebase) projectSet.warnings.push("No desired firebase project found.");

const curG = await runCmd("gcloud", ["config", "get-value", "project"]);
if (curG.ok) {
  projectSet.currentGcloud = curG.stdout.trim();
  if (desiredGcloud && projectSet.currentGcloud && projectSet.currentGcloud !== desiredGcloud) {
    if (APPLY) {
      const setG = await runCmd("gcloud", ["config", "set", "project", desiredGcloud]);
      projectSet.gcloudApplied = setG.ok;
      if (!setG.ok) projectSet.warnings.push(`Failed to set gcloud project to ${desiredGcloud}.`);
    } else {
      projectSet.warnings.push(`gcloud mismatch (${projectSet.currentGcloud} ≠ ${desiredGcloud}). Run with --apply to set.`);
    }
  }
} else {
  projectSet.warnings.push("gcloud not available on PATH (or not logged in).");
}

const curFb = await runCmd("firebase", ["use"]);
if (curFb.ok) {
  const lines = curFb.stdout.split("\n").map(l=>l.trim()).filter(Boolean);
  projectSet.currentFirebase = lines[lines.length-1] || null;

  if (desiredFirebase && projectSet.currentFirebase && !projectSet.currentFirebase.includes(desiredFirebase)) {
    if (APPLY) {
      const setFb = await runCmd("firebase", ["use", desiredFirebase]);
      projectSet.firebaseApplied = setFb.ok;
      if (!setFb.ok) {
        projectSet.warnings.push(`Failed to set firebase project to ${desiredFirebase}. If alias missing: firebase use --add ${desiredFirebase}`);
      }
    } else {
      projectSet.warnings.push(`firebase mismatch (${projectSet.currentFirebase} ≠ ${desiredFirebase}). Run with --apply to set.`);
    }
  }
} else {
  projectSet.warnings.push("firebase CLI not available on PATH (or not logged in).");
}

// Snapshots
const timestamp = new Date().toISOString();

const gitBranch = await runCmd("git", ["branch", "--show-current"]);
const gitHead = await runCmd("git", ["rev-parse", "HEAD"]);
const gitStatus = await runCmd("git", ["status", "-sb"]);
const git = {
  summary: [
    gitBranch.ok ? `branch ${gitBranch.stdout.trim()}` : "branch ?",
    gitHead.ok ? `commit ${gitHead.stdout.trim().slice(0, 12)}` : "commit ?",
    gitStatus.ok ? gitStatus.stdout.trim().split("\n")[0] : "status ?",
  ].join(" | "),
};

const gcloudCmds = [
  ["gcloud", ["--version"]],
  ["gcloud", ["config", "get-value", "project"]],
  ["gcloud", ["projects", "list"]],
];
const gcloudRes = [];
for (const [cmd,args] of gcloudCmds) gcloudRes.push(await runCmd(cmd,args,{timeoutMs:25000}));
const gcloudText = gcloudRes.map(r=>{
  const header = `> ${r.cmd}  (${r.ok?"ok":"fail"})`;
  const out = (r.stdout || r.stderr || "").trim();
  return `${header}\n${out}\n`;
}).join("\n");
const gcloud = { text: gcloudText };

const firebaseCmds = [
  ["firebase", ["--version"]],
  ["firebase", ["projects:list"]],
  ["firebase", ["use"]],
  ["firebase", ["apps:list"]],
];
const firebaseRes = [];
for (const [cmd,args] of firebaseCmds) firebaseRes.push(await runCmd(cmd,args,{timeoutMs:25000}));
const firebaseText = firebaseRes.map(r=>{
  const header = `> ${r.cmd}  (${r.ok?"ok":"fail"})`;
  const out = (r.stdout || r.stderr || "").trim();
  return `${header}\n${out}\n`;
}).join("\n");
const firebase = { text: firebaseText };

const envCfg = {
  found: !!envRaw.path && !!envRaw.json,
  path: envRaw.path,
  redacted: envRaw.json ? redactTokens(envRaw.json) : null,
  error: envRaw.error ? String(envRaw.error) : null,
};

// Dev commands (print-only)
const emulatorCmd = "firebase emulators:start --only firestore,auth,functions";
const defaultAppCmd = "npm run dev --prefix web";
const appCmd = APP_CMD || defaultAppCmd;
// Safe Next preview default if not overridden
const previewCmd = PREVIEW_CMD || "npm -w web run build && npm run start --prefix web";

let devPlan = [
  `Emulators terminal: ${emulatorCmd}`,
  `App terminal: ${appCmd}`,
  `Preview terminal: ${previewCmd}`,
  `Emulator UI: http://127.0.0.1:5004`,
  `Ports: functions 5001 | firestore 5002 | pubsub 5003 | ui 5004 | auth 5005 | apphosting 5000`,
].join("\n");

// Write init prompt
const initPrompt = buildPrompt({
  timestamp, git, gcloud, firebase,
  envCfg, fileTreeTxt, targets,
  projectSet, devPlan,
});

await fs.writeFile(path.join(OUT_DIR, "init.txt"), initPrompt);

// Console output
console.log(
  `✓ init → ${path.join(OUT_DIR, "init.txt")}\n` +
  `✓ file tree → ${path.join(OUT_DIR, "file-tree.json")}, ${path.join(OUT_DIR, "file-tree.txt")} (${targets.length} roots)\n` +
  `✓ projects ${APPLY ? "applied (if mismatched)" : "checked"}`
);

if (DEV) {
  console.log("\n--- HDB v2 dev commands (Git Bash) ---\n");
  console.log(`cat <<'EOF'\n\n# 1) Seed on false emulators: \n npm run seed:emulator:safe \n\n #1.5) Spin up emulators with import data \n\n\n# 2) Next dev server\n${appCmd}\n\n# 3) Preview (prod-ish)\n${previewCmd}\n\n# 4) Open Emulator UI\ncmd.exe /c start "" "http://127.0.0.1:5004"\n\nEOF\n`);
} else {
  console.log("\n• Dev commands not printed (run with --dev to print them).");
}
