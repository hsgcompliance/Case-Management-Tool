// Smart submission label — ported from next-dashboard-starter SubList.js.
// Scores answers to find the best person-name for a submission row.
import type { JfSubmission } from "./jotformManagerApi";

const HOH_RE = /\b(head\s*of\s*household|household\s*head|hoh)\b/i;
const NAME_RE = /\b(name|full\s*name)\b/i;
const EMAIL_RE = /@/;

function norm(s: unknown): string {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}
function titleCase(s: string): string {
  return norm(s).toLowerCase().replace(/\b([a-z])([a-z']*)\b/g, (_, a, b) => a.toUpperCase() + b);
}
function answerValue(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string" || typeof v === "number") return norm(v);
  if (Array.isArray(v)) return norm(v[0] ?? "");
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const first = norm(o.first ?? o.firstName ?? o.fname ?? "");
    const last = norm(o.last ?? o.lastName ?? o.lname ?? "");
    if (first || last) return norm(`${first} ${last}`);
    if (o.full) return norm(o.full);
    if (o.answer) return norm(o.answer);
  }
  return "";
}
function looksLikeName(s: string): boolean {
  const v = norm(s);
  if (!v || EMAIL_RE.test(v)) return false;
  if (v.split(" ").filter(Boolean).length < 2) return false;
  return v.replace(/[^a-zA-Z]/g, "").length >= 4;
}

export function getSubmissionLabel(sub: JfSubmission): string {
  const items = Object.values(sub?.answers || {})
    .map((a) => ({ name: norm(a?.name), text: norm(a?.text), type: norm(a?.type), value: answerValue(a?.answer) }))
    .filter((x) => x.value);

  let best = { score: -1, value: "" };
  for (const x of items) {
    const name = x.name.toLowerCase();
    let score = 0;
    if (HOH_RE.test(x.name) || HOH_RE.test(x.text)) score += 100;
    if (name.includes("customer") && name.includes("name")) score += 90;
    if (name.includes("signer")) score += 80;
    if (NAME_RE.test(x.name) || NAME_RE.test(x.text) || name.endsWith("name")) score += 60;
    if (x.type.includes("control_fullname")) score += 70;
    if (x.value.length > 60) score -= 20;
    if (!looksLikeName(x.value)) score -= 50;
    if (score > best.score) best = { score, value: x.value };
  }
  return best.score >= 10 && best.value ? titleCase(best.value) : "";
}
