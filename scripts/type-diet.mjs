#!/usr/bin/env node
/**
 * scripts/type-diet.mjs
 *
 * File-diet-style collector, but extracts ONLY "typing" artifacts:
 *  - Top-level Zod schema consts: `const X = z.*(...)` and `export const X = z.*(...)`
 *  - Exported TS declarations: `export type X = ...` and `export interface X { ... }`
 *
 * Default workflow:
 *   1) Paste a prompt or newline-separated list of paths into scripts/out/prompt-input.txt
 *   2) Run: node scripts/type-diet.mjs
 *   3) Open scripts/out/type-dump.ts and feed to the model
 *
 * Options:
 *   --in <file>                  Input path (default scripts/out/prompt-input.txt)
 *   --out <file>                 Output path (default scripts/out/type-dump.ts)
 *   --max-bytes-per-file <n>     Skip files bigger than n bytes (default 500_000)
 *   --max-total-bytes <n>        Stop after n total bytes (default 8_000_000)
 *   --no-redact                  Disable naive secret redaction
 *   --prompt-header <file>       Optional header to prepend (default scripts/out/prompt-header.txt)
 *   --only-object                Only include schemas whose initializer starts with `z.object(`
 *   --zod-only                   Only include Zod schemas
 *   --types-only                 Only include exported TS types/interfaces
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// repoRoot = parent of /scripts
const repoRoot = path.resolve(__dirname, "..");
const defaultIn = path.join(repoRoot, "scripts", "out", "prompt-input.txt");
const defaultOut = path.join(repoRoot, "scripts", "out", "type-dump.ts");
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
const maxPerFile = Number(getArg("--max-bytes-per-file") || 500_000);
const maxTotal = Number(getArg("--max-total-bytes") || 8_000_000);
const onlyObject = hasFlag("--only-object");
const zodOnly = hasFlag("--zod-only");
const typesOnly = hasFlag("--types-only");

// Directories to ignore when walking the repo
const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  ".firebase",
  ".cache",
  "tmp",
  "temp",
  "functions/lib",
  "scripts/out",
]);

// We only care about source-ish files here
const TEXT_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

// Prefixes (repo-relative, unix slashes) to skip entirely.
const SKIP_PREFIXES = [
  "scripts/",
  "web/.next/",
  "contracts/dist/",
  "functions/build/",
];

// ---- helpers: path parsing / extraction ----

function normalizeCandidate(p) {
  return String(p || "")
    .trim()
    .replace(/^['"`]+|['"`]+$/g, "") // strip quotes/backticks
    .replace(/\\/g, "/"); // normalize slashes
}

function looksLikePath(raw) {
  const p = normalizeCandidate(raw);
  if (!p) return false;

  // Allow directory shortcuts so users can request "everything".
  if (p === "." || p === "./" || p === ".." || p === "../") return true;

  const simpleExts = [
    ".ts",
    ".tsx",
    ".js",
    ".mjs",
    ".cjs",
    ".md",
    ".yml",
    ".yaml",
    ".json",
    ".txt",
    ".rules",
    ".env",
  ];

  if (!p.includes("/")) {
    return simpleExts.some((ext) => p.endsWith(ext));
  }

  const parts = p.split("/");
  const last = parts[parts.length - 1] || "";
  if (last.includes(".")) return true;
  return true;
}

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

  // 3) Line-based lists
  const lines = raw.split(/\r?\n/g);
  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;

    let cleaned = trimmed.replace(/^[-*+•\s]+/, "").replace(/^(\/\/|#)\s*/, "");
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
      const top = relUnix.split("/")[0];

      // Skip node_modules anywhere in the path (not just at repo root).
      if (relUnix.split("/").includes("node_modules")) continue;

      // Skip configured prefixes entirely.
      if (SKIP_PREFIXES.some((pre) => relUnix === pre.slice(0, -1) || relUnix.startsWith(pre))) {
        continue;
      }

      if (IGNORE_DIRS.has(top) || IGNORE_DIRS.has(relUnix)) continue;

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

function resolveRequestedPath(req, allFiles) {
  const resolved = new Set();
  const cand = normalizeCandidate(req).replace(/^(\.\/)+/, "").replace(/^\/+/, "");
  if (!cand) return [];

  // Special-case: repo root shortcut
  if (cand === "." || cand === "./") {
    for (const f of allFiles) resolved.add(f);
    return Array.from(resolved);
  }

  // exact match
  if (allFiles.includes(cand)) resolved.add(cand);

  // directory hint: no extension
  if (!path.extname(cand)) {
    const dirPrefix = cand.endsWith("/") ? cand : cand + "/";
    for (const f of allFiles) {
      if (f.startsWith(dirPrefix)) resolved.add(f);
    }
  }

  // suffix match
  for (const f of allFiles) {
    if (f === cand) continue;
    if (f.endsWith("/" + cand) || f.endsWith(cand)) resolved.add(f);
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
    [/firebase(?:Admin)?\s*[:=]\s*["'][^"']+["']/gi, 'firebase: "<REDACTED>"'],
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

// ---- shared parsing helpers ----

function isWordChar(ch) {
  return /[A-Za-z0-9_$]/.test(ch);
}

function includeLeadingCommentBlock(src, start) {
  // Pull contiguous comment-ish lines immediately above the statement.
  // Stop at first blank line.
  let begin = start;
  let cursor = start;

  while (cursor > 0) {
    const prevNL = src.lastIndexOf("\n", cursor - 1);
    const lineStart = prevNL === -1 ? 0 : prevNL + 1;
    const line = src.slice(lineStart, cursor);

    if (line.trim() === "") break;

    const t = line.trimStart();
    if (
      t.startsWith("//") ||
      t.startsWith("/*") ||
      t.startsWith("*") ||
      t.endsWith("*/")
    ) {
      begin = lineStart;
      cursor = prevNL === -1 ? 0 : prevNL;
      continue;
    }

    break;
  }

  return begin;
}

function findStatementEnd(src, start) {
  let i = start;
  const len = src.length;

  let inLineComment = false;
  let inBlockComment = false;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;

  let depthParen = 0;
  let depthCurly = 0;
  let depthBracket = 0;

  const isStringy = () => inSingle || inDouble || inTemplate;

  while (i < len) {
    const ch = src[i];
    const next = src[i + 1];

    // comments
    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      i++;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    // strings
    if (inSingle) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === "'") inSingle = false;
      i++;
      continue;
    }
    if (inDouble) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === '"') inDouble = false;
      i++;
      continue;
    }
    if (inTemplate) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === "`") {
        inTemplate = false;
        i++;
        continue;
      }
      // We deliberately do not try to fully parse ${ ... } here.
      i++;
      continue;
    }

    // open comment
    if (ch === "/" && next === "/") {
      inLineComment = true;
      i += 2;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i += 2;
      continue;
    }

    // open string
    if (ch === "'") {
      inSingle = true;
      i++;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      i++;
      continue;
    }
    if (ch === "`") {
      inTemplate = true;
      i++;
      continue;
    }

    // depth tracking
    if (ch === "(") depthParen++;
    else if (ch === ")") depthParen = Math.max(0, depthParen - 1);
    else if (ch === "{") depthCurly++;
    else if (ch === "}") depthCurly = Math.max(0, depthCurly - 1);
    else if (ch === "[") depthBracket++;
    else if (ch === "]") depthBracket = Math.max(0, depthBracket - 1);

    // statement terminator
    if (ch === ";" && depthParen === 0 && depthCurly === 0 && depthBracket === 0 && !isStringy()) {
      return i + 1;
    }

    // fallback: no semicolon, but next top-level statement starts
    if (ch === "\n" && depthParen === 0 && depthCurly === 0 && depthBracket === 0) {
      let j = i + 1;
      while (j < len && (src[j] === " " || src[j] === "\t" || src[j] === "\r")) j++;
      const rest = src.slice(j, j + 20);
      if (rest.startsWith("const ") || rest.startsWith("export const ") || rest.startsWith("let ") || rest.startsWith("export let ")) {
        return i + 1;
      }
    }

    i++;
  }

  return len;
}

function findBlockEnd(src, start) {
  // For `export interface Foo { ... }` etc.
  // We scan until the first balanced `}` that closes the first `{` seen.
  let i = start;
  const len = src.length;

  let inLineComment = false;
  let inBlockComment = false;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;

  let depthCurly = 0;
  let sawOpen = false;

  while (i < len) {
    const ch = src[i];
    const next = src[i + 1];

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      i++;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    if (inSingle) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === "'") inSingle = false;
      i++;
      continue;
    }
    if (inDouble) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === '"') inDouble = false;
      i++;
      continue;
    }
    if (inTemplate) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === "`") {
        inTemplate = false;
        i++;
        continue;
      }
      i++;
      continue;
    }

    if (ch === "/" && next === "/") {
      inLineComment = true;
      i += 2;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i += 2;
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      i++;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      i++;
      continue;
    }
    if (ch === "`") {
      inTemplate = true;
      i++;
      continue;
    }

    if (ch === "{") {
      depthCurly++;
      sawOpen = true;
    } else if (ch === "}") {
      depthCurly = Math.max(0, depthCurly - 1);
      if (sawOpen && depthCurly === 0) {
        // include optional trailing semicolon
        let j = i + 1;
        while (j < len && (src[j] === " " || src[j] === "\t" || src[j] === "\r")) j++;
        if (src[j] === ";") j++;
        return j;
      }
    }

    i++;
  }

  return len;
}

// ---- Zod schema extraction ----

function extractZodSchemaStatements(src) {
  const out = [];
  const len = src.length;

  let i = 0;
  let inLineComment = false;
  let inBlockComment = false;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;

  let curlyDepth = 0;

  const re = /(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(z\.\w+)/y;

  while (i < len) {
    const ch = src[i];
    const next = src[i + 1];

    // comments
    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      i++;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    // strings
    if (inSingle) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === "'") inSingle = false;
      i++;
      continue;
    }
    if (inDouble) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === '"') inDouble = false;
      i++;
      continue;
    }
    if (inTemplate) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === "`") {
        inTemplate = false;
        i++;
        continue;
      }
      i++;
      continue;
    }

    // open comment
    if (ch === "/" && next === "/") {
      inLineComment = true;
      i += 2;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i += 2;
      continue;
    }

    // open string
    if (ch === "'") {
      inSingle = true;
      i++;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      i++;
      continue;
    }
    if (ch === "`") {
      inTemplate = true;
      i++;
      continue;
    }

    // track top-level by curly depth
    if (ch === "{") curlyDepth++;
    else if (ch === "}") curlyDepth = Math.max(0, curlyDepth - 1);

    // Only consider candidates at top-level (not inside function bodies, etc.)
    if (curlyDepth === 0) {
      // Skip obvious mid-word positions
      const prev = i > 0 ? src[i - 1] : "";
      if (!isWordChar(prev)) {
        re.lastIndex = i;
        const m = re.exec(src);
        if (m) {
          const name = m[1];
          const initHead = m[2];

          if (onlyObject && initHead !== "z.object") {
            // advance a bit so we don't re-match at same location
            i = re.lastIndex;
            continue;
          }

          const stmtStart = i;
          const stmtEnd = findStatementEnd(src, stmtStart);
          const withCommentStart = includeLeadingCommentBlock(src, stmtStart);
          const code = src.slice(withCommentStart, stmtEnd).trimEnd();

          out.push({ name, start: withCommentStart, end: stmtEnd, code });
          i = stmtEnd;
          continue;
        }
      }
    }

    i++;
  }

  return out;
}

// ---- TS export type/interface extraction ----

function extractExportedTypeStatements(src) {
  const out = [];
  const len = src.length;

  let i = 0;
  let inLineComment = false;
  let inBlockComment = false;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;

  let curlyDepth = 0;

  const reType = /export\s+type\s+([A-Za-z_$][\w$]*)/y;
  const reInterface = /export\s+interface\s+([A-Za-z_$][\w$]*)/y;

  while (i < len) {
    const ch = src[i];
    const next = src[i + 1];

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      i++;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    if (inSingle) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === "'") inSingle = false;
      i++;
      continue;
    }
    if (inDouble) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === '"') inDouble = false;
      i++;
      continue;
    }
    if (inTemplate) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === "`") {
        inTemplate = false;
        i++;
        continue;
      }
      i++;
      continue;
    }

    if (ch === "/" && next === "/") {
      inLineComment = true;
      i += 2;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i += 2;
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      i++;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      i++;
      continue;
    }
    if (ch === "`") {
      inTemplate = true;
      i++;
      continue;
    }

    if (ch === "{") curlyDepth++;
    else if (ch === "}") curlyDepth = Math.max(0, curlyDepth - 1);

    if (curlyDepth === 0) {
      const prev = i > 0 ? src[i - 1] : "";
      if (!isWordChar(prev)) {
        reType.lastIndex = i;
        const mt = reType.exec(src);
        if (mt) {
          const name = mt[1];
          const stmtStart = i;
          const stmtEnd = findStatementEnd(src, stmtStart);
          const withCommentStart = includeLeadingCommentBlock(src, stmtStart);
          const code = src.slice(withCommentStart, stmtEnd).trimEnd();
          out.push({ name, kind: "type", start: withCommentStart, end: stmtEnd, code });
          i = stmtEnd;
          continue;
        }

        reInterface.lastIndex = i;
        const mi = reInterface.exec(src);
        if (mi) {
          const name = mi[1];
          const stmtStart = i;
          const stmtEnd = findBlockEnd(src, stmtStart);
          const withCommentStart = includeLeadingCommentBlock(src, stmtStart);
          const code = src.slice(withCommentStart, stmtEnd).trimEnd();
          out.push({ name, kind: "interface", start: withCommentStart, end: stmtEnd, code });
          i = stmtEnd;
          continue;
        }
      }
    }

    i++;
  }

  return out;
}

// ---- main ----

async function main() {
  const inputRaw = await fs.readFile(inFile, "utf8").catch(() => null);
  if (inputRaw == null) {
    console.error(`Input file not found or unreadable: ${inFile}`);
    process.exit(1);
  }

  const headerRaw = await fs.readFile(headerFile, "utf8").catch(() => null);
  const promptHeader = headerRaw && headerRaw.trim() ? headerRaw.trimEnd() + "\n\n---\n\n" : "";

  const requested = extractPathsFromBlob(inputRaw);
  if (!requested.length) {
    console.error("No path-like tokens found in input. Paste a prompt or list first.");
    process.exit(1);
  }

  const allFiles = await collectAllTextFiles();

  const resolvedSet = new Set();
  const unmatched = [];
  for (const req of requested) {
    const matches = resolveRequestedPath(req, allFiles);
    if (!matches.length) unmatched.push(req);
    for (const m of matches) resolvedSet.add(m);
  }

  const resolved = Array.from(resolvedSet)
    .filter((p) => {
      const ext = path.extname(p).toLowerCase();
      return ext === ".ts" || ext === ".tsx" || ext === ".js" || ext === ".mjs" || ext === ".cjs";
    })
    .sort();

  if (!resolved.length) {
    console.error("No requested paths resolved to real source files.");
    process.exit(1);
  }

  await fs.mkdir(path.dirname(outFile), { recursive: true });

  let output = "";
  if (promptHeader) output += promptHeader;

  output += `// Type Diet Dump\n`;
  output += `// root: ${repoRoot.replace(/\\/g, "/")}\n`;
  output += `// requested tokens: ${requested.length}\n`;
  output += `// matched files: ${resolved.length}\n`;
  output += `// generated: ${new Date().toISOString()}\n\n`;

  let needsZodImport = false;

  let totalBytes = 0;
  let includedFiles = 0;
  let totalSchemas = 0;
  let totalTypes = 0;
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

    const schemas = (!typesOnly) ? extractZodSchemaStatements(r.text) : [];
    const types = (!zodOnly) ? extractExportedTypeStatements(r.text) : [];

    if (!schemas.length && !types.length) continue;

    includedFiles++;

    if (schemas.length) {
      needsZodImport = true;
      totalSchemas += schemas.length;
    }
    if (types.length) {
      totalTypes += types.length;
    }

    output += `\n/* ===== FILE: ${rel} | zod=${schemas.length} | exports=${types.length} ===== */\n`;
    if (schemas.length) {
      output += `\n// --- Zod Schemas ---\n`;
      for (const s of schemas) output += `\n${s.code}\n`;
    }
    if (types.length) {
      output += `\n// --- Exported Types/Interfaces ---\n`;
      for (const t of types) output += `\n${t.code}\n`;
    }
  }

  if (unmatched.length) {
    output += `\n\n// Unmatched Requests (${unmatched.length})\n`;
    for (const u of unmatched) output += `// - ${u}\n`;
  }

  if (skipped.length) {
    output += `\n\n// Skipped Files (${skipped.length})\n`;
    for (const s of skipped) output += `// - ${s.rel} :: ${s.reason}\n`;
  }

  if (needsZodImport) {
    // Put at top, after any prompt header. Simple insertion keeps output deterministic.
    // Find first non-empty line after the initial comment banner.
    const marker = "\n\n";
    const idx = output.indexOf(marker);
    if (idx !== -1) {
      const before = output.slice(0, idx + marker.length);
      const after = output.slice(idx + marker.length);
      output = `${before}import { z } from \"zod\";\n\n${after}`;
    } else {
      output = `import { z } from \"zod\";\n\n${output}`;
    }
  }

  output += `\n\n// Summary\n`;
  output += `// included files: ${includedFiles}\n`;
  output += `// extracted schemas: ${totalSchemas}\n`;
  output += `// extracted exports: ${totalTypes}\n`;

  await fs.writeFile(outFile, output, "utf8");

  console.log(
    `Wrote type dump to: ${path.relative(repoRoot, outFile)} (files=${includedFiles}, schemas=${totalSchemas}, exports=${totalTypes})`
  );
  if (unmatched.length) console.log(`Unmatched requests: ${unmatched.length}`);
  if (skipped.length) console.log(`Skipped files: ${skipped.length} (see footer in output)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
