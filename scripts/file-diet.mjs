#!/usr/bin/env node
/**
 * scripts/file-diet.mjs
 *
 * Unified "file diet" for ChatGPT:
 * - Reads a single input blob (usually scripts/out/prompt-input.txt).
 * - That blob can be:
 *    - A plain newline-separated list of paths, OR
 *    - A full ChatGPT prompt / conversation mentioning files in backticks, bullets, etc.
 * - Extracts all path-like tokens, resolves them against the repo by walking the tree,
 *   and concatenates their contents into a single ingest file.
 *
 * Default workflow:
 *   1) Paste ChatGPT prompt or list of files into scripts/out/prompt-input.txt
 *   2) Run: node scripts/file-diet.mjs
 *   3) Open scripts/out/ingest.txt and feed to ChatGPT
 *
 * Options:
 *   --in <file>                  Input path (default scripts/out/prompt-input.txt)
 *   --out <file>                 Output path (default scripts/out/ingest.txt)
 *   --max-bytes-per-file <n>     Skip files bigger than n bytes (default 500_000)
 *   --max-total-bytes <n>        Stop after n total bytes (default 8_000_000)
 *   --no-redact                  Disable naive secret redaction
 *   --prompt-header <file>       Optional prompt header to prepend (default scripts/out/prompt-header.txt)
 *   --append                     Append to output file instead of replacing it

 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// repoRoot = parent of /scripts
const repoRoot = path.resolve(__dirname, "..");
const defaultIn = path.join(repoRoot, "scripts", "out", "prompt-input.txt");
const defaultOut = path.join(repoRoot, "scripts", "out", "file-dump.txt");
const defaultHeader = path.join(repoRoot, "scripts", "out", "prompt-header.txt");


const args = process.argv.slice(2);
const getArg = (flag) => {
  const i = args.indexOf(flag);
  if (i === -1) return null;
  return args[i + 1] ?? null;
};
const hasFlag = (flag) => args.includes(flag);

const inFile = path.resolve(repoRoot, getArg("--in") || defaultIn);
const outFile = path.resolve(repoRoot, getArg("--out") || defaultOut);
const headerFile = path.resolve(repoRoot, getArg("--prompt-header") || defaultHeader);
const redactEnabled = !hasFlag("--no-redact");
const appendMode = hasFlag("--append");
const maxPerFile = Number(getArg("--max-bytes-per-file") || 500_000);
const maxTotal = Number(getArg("--max-total-bytes") || 8_000_000);

// Directories to ignore when walking the repo
const IGNORE_DIRS = new Set([
  "node_modules/",
  ".git/",
  ".next/",
  "dist/",
  "build/",
  "coverage/",
  ".firebase/",
  ".cache/",
  "tmp/",
  "temp/",
  "functions/lib/",
  "scripts/out/",
]);

// Text/code file extensions worth including
const TEXT_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".json", ".jsonc", ".md", ".txt", ".rules", ".yml", ".yaml",
  ".css", ".scss", ".html", ".env", ".env.local", ".env.example",
]);

// ---- helpers: path parsing / extraction ----

function normalizeCandidate(p) {
  return String(p || "")
    .trim()
    .replace(/^['"`]+|['"`]+$/g, "") // strip quotes/backticks
    .replace(/\\/g, "/"); // normalize slashes
}

/**
 * Very lightweight check: "does this look like a file/dir path we might resolve?"
 * We don't require it to be valid in the FS, just "path-ish".
 */
function looksLikePath(raw) {
  const p = normalizeCandidate(raw);
  if (!p) return false;

  // Top-level files like firestore.rules, tsconfig.json, etc.
  const simpleExts = [
    ".rules", ".json", ".ts", ".tsx", ".js", ".mjs", ".cjs",
    ".md", ".yml", ".yaml", ".env", ".txt",
  ];

  if (!p.includes("/")) {
    return simpleExts.some((ext) => p.endsWith(ext));
  }

  const parts = p.split("/");
  const last = parts[parts.length - 1] || "";

  // If last segment has an extension, it's definitely path-ish.
  if (last.includes(".")) return true;

  // If it has at least one "/" and no extension, treat as possible directory hint.
  return true;
}

/**
 * Extract candidate path strings from an arbitrary blob:
 * - backticked segments: `functions/src/...`
 * - inline bare "foo/bar.ext" patterns
 * - line-based: each line's first token if it looks like a path
 */
function extractPathsFromBlob(raw) {
  const out = new Set();

  // 1) Backticked segments
  const reTick = /`([^`]+?)`/g;
  let m;
  while ((m = reTick.exec(raw))) {
    const seg = m[1] || "";
    const tokens = seg.split(/[\s,]+/);
    for (const t of tokens) {
      const cand = normalizeCandidate(t);
      if (looksLikePath(cand)) out.add(cand);
    }
  }

  // 2) Inline bare paths like foo/bar/baz.ts
  const reBare = /([A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+\.[A-Za-z0-9]+)/g;
  while ((m = reBare.exec(raw))) {
    const cand = normalizeCandidate(m[1]);
    if (looksLikePath(cand)) out.add(cand);
  }

  // 3) Line-based: supports plain newline-separated lists
  const lines = raw.split(/\r?\n/g);
  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;

    // strip bullets and leading comment markers
    let cleaned = trimmed
      .replace(/^[-*+•\s]+/, "")
      .replace(/^(\/\/|#)\s*/, "");

    // use the first token before whitespace or ::
    const token = cleaned.split(/[\s,:]+/)[0];
    const cand = normalizeCandidate(token);
    if (looksLikePath(cand)) out.add(cand);
  }

  return Array.from(out);
}

// ---- repo walking & resolution ----

async function collectAllTextFiles() {
  const all = [];

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const ent of entries) {
      const abs = path.join(dir, ent.name);
      const rel = path.relative(repoRoot, abs);
      const relUnix = rel.replace(/\\/g, "/");
      
      // Check if any segment of the path matches an ignored directory
      const segments = relUnix.split("/");
      const shouldIgnore = segments.some((seg, idx) => {
        return IGNORE_DIRS.has(seg + "/");
      });
      
      if (shouldIgnore) continue;

      if (ent.isDirectory()) {
        await walk(abs);
        continue;
      }

      const ext = path.extname(ent.name).toLowerCase();
      if (!TEXT_EXTS.has(ext)) continue;

      all.push(relUnix);
    }
  }

  await walk(repoRoot);
  return all;
}

/**
 * Resolve a requested "path-ish" string against the repo file list.
 * Strategies:
 *  - exact match
 *  - normalized (strip leading ./ or /)
 *  - treat as directory ⇒ all files under that path
 *  - suffix match ⇒ any file whose path ends with the requested value
 */
function resolveRequestedPath(req, allFiles) {
  const resolved = new Set();
  const cand = normalizeCandidate(req).replace(/^(\.\/)+/, "").replace(/^\/+/, "");
  if (!cand) return [];

  // exact match
  if (allFiles.includes(cand)) resolved.add(cand);

  // directory hint: no extension
  if (!path.extname(cand)) {
    const dirPrefix = cand.endsWith("/") ? cand : cand + "/";
    for (const f of allFiles) {
      if (f.startsWith(dirPrefix)) resolved.add(f);
    }
  }

  // suffix match: src/features/tasks/utils.ts, etc.
  for (const f of allFiles) {
    if (f === cand) continue; // already handled
    if (f.endsWith("/" + cand) || f.endsWith(cand)) {
      resolved.add(f);
    }
  }

  return Array.from(resolved);
}

// ---- redaction & file reading ----

function redactSecrets(text) {
  const patterns = [
    [
      /-----BEGIN PRIVATE KEY-----[\s\S]+?-----END PRIVATE KEY-----/g,
      "-----BEGIN PRIVATE KEY-----\n<REDACTED>\n-----END PRIVATE KEY-----",
    ],
    [/AIza[0-9A-Za-z_-]{20,}/g, "<REDACTED_GCP_KEY>"],
    [/\bsk-[0-9A-Za-z]{20,}\b/g, "<REDACTED_OPENAI_KEY>"],
    [/\b(xoxb|xoxp|xoxa|xapp)-[0-9A-Za-z-]{10,}\b/g, "<REDACTED_SLACK_TOKEN>"],
    [
      /firebase(?:Admin)?\s*[:=]\s*["'][^"']+["']/gi,
      'firebase: "<REDACTED>"',
    ],
    // leave process.env.* alone
  ];

  let out = text;
  for (const [re, rep] of patterns) out = out.replace(re, rep);
  return out;
}

async function readFileSafe(relPath) {
  const abs = path.join(repoRoot, relPath);
  const stat = await fs.stat(abs).catch(() => null);
  if (!stat || !stat.isFile()) return { ok: false, reason: "missing" };

  if (stat.size > maxPerFile) {
    return { ok: false, reason: `too_big(${stat.size})` };
  }

  const raw = await fs.readFile(abs, "utf8").catch(() => null);
  if (raw == null) return { ok: false, reason: "unreadable" };

  const text = redactEnabled ? redactSecrets(raw) : raw;
  return { ok: true, text, bytes: stat.size };
}

// ---- main ----

async function main() {
  const inputRaw = await fs.readFile(inFile, "utf8").catch(() => null);
  if (inputRaw == null) {
    console.error(`Input file not found or unreadable: ${inFile}`);
    process.exit(1);
  }

  // Optional prompt header (e.g. ChatGPT re-context instructions)
  const headerRaw = await fs.readFile(headerFile, "utf8").catch(() => null);
  const promptHeader = headerRaw && headerRaw.trim()
    ? headerRaw.trimEnd() + "\n\n---\n\n"
    : "";

  const requested = extractPathsFromBlob(inputRaw);
  if (!requested.length) {
    console.error("No path-like tokens found in input. Paste a prompt or list first.");
    process.exit(1);
  }

  const allFiles = await collectAllTextFiles();

  const resolvedSet = new Set();
  const unmatched = [];
  const resolutionMap = new Map(); // req -> [matched...]

  for (const req of requested) {
    const matches = resolveRequestedPath(req, allFiles);
    if (!matches.length) {
      unmatched.push(req);
    } else {
      resolutionMap.set(req, matches);
      for (const m of matches) resolvedSet.add(m);
    }
  }

  const resolved = Array.from(resolvedSet).sort();

  if (!resolved.length) {
    console.error("No requested paths resolved to real files. Check your paths or repo layout.");
    process.exit(1);
  }

  await fs.mkdir(path.dirname(outFile), { recursive: true });

  let output = "";

  if (promptHeader) {
    // This is your custom ChatGPT/system prompt header
    output += `${promptHeader}`;
  }

  output += `# File Diet Ingest\n`;
  output += `# root: ${repoRoot}\n`;
  output += `# requested: ${requested.length}\n`;
  output += `# matched files: ${resolved.length}\n`;
  output += `# generated: ${new Date().toISOString()}\n\n`;


  let totalBytes = 0;
  let dumped = 0;
  const skipped = [];

  for (const rel of resolved) {
    if (totalBytes >= maxTotal) {
      skipped.push({ rel, reason: `max_total_reached(${maxTotal})` });
      continue;
    }

    const r = await readFileSafe(rel);
    if (!r.ok) {
      skipped.push({ rel, reason: r.reason });
      continue;
    }

    totalBytes += r.bytes;
    dumped++;

    output += `\n/* ===== FILE: ${rel} | bytes=${r.bytes} ===== */\n`;
    output += r.text.trimEnd();
    output += `\n/* ===== END FILE: ${rel} ===== */\n`;
  }

  if (unmatched.length) {
    output += `\n\n# Unmatched Requests (${unmatched.length})\n`;
    for (const u of unmatched) {
      output += `- ${u}\n`;
    }
  }

  if (skipped.length) {
    output += `\n\n# Skipped Files (${skipped.length})\n`;
    for (const s of skipped) {
      output += `- ${s.rel} :: ${s.reason}\n`;
    }
  }

  if (appendMode) {
    // Add separator when appending
    const separator = "\n\n" + "=".repeat(80) + "\n" + `# APPEND: ${new Date().toISOString()}` + "\n" + "=".repeat(80) + "\n\n";
    await fs.appendFile(outFile, separator + output, "utf8");
  } else {
    await fs.writeFile(outFile, output, "utf8");
  }

  console.log(
    `${appendMode ? "Appended" : "Wrote"} ${dumped}/${resolved.length} resolved files to: ${path.relative(
      repoRoot,
      outFile
    )}`
  );
  if (unmatched.length) console.log(`Unmatched requests: ${unmatched.length}`);
  if (skipped.length) console.log(`Skipped files: ${skipped.length} (see footer in output)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
