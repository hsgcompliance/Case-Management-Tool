import type { InboxItem } from "@types";

export type InboxDetailKind =
  | "other"
  | "userVerification"
  | "customer"
  | "assessment"
  | "payment"
  | "complianceTask"
  | "grantCompliance"
  | "task"
  | "unknown";

function tok(v: unknown): string {
  return String(v || "").trim().toLowerCase();
}

function hasWord(v: unknown, word: string): boolean {
  return tok(v).includes(word);
}

export function isInboxClosed(status: unknown): boolean {
  const s = tok(status);
  return s === "done" || s === "closed" || s === "complete" || s === "completed";
}

export function getInboxDetailKind(item: Partial<InboxItem> | null | undefined): InboxDetailKind {
  if (!item) return "unknown";

  const source = tok((item as any).source);
  if (source === "other") return "other";
  if (source === "userverification") return "userVerification";
  if (source === "payment") return "payment";
  if (source === "paymentcompliance") return "complianceTask";
  if (source === "grantcompliance") return "grantCompliance";
  if (source === "adminenrollment") return "customer";

  const labels = Array.isArray((item as any).labels) ? (item as any).labels.map((x: unknown) => tok(x)) : [];
  const bucket = tok((item as any).bucket);
  const title = tok((item as any).title);

  if (labels.includes("assessment") || bucket === "assessment" || hasWord(title, "assessment")) return "assessment";
  if (labels.includes("customer") || labels.includes("routing") || hasWord(title, "customer")) return "customer";
  if (source === "task") return "task";
  return "unknown";
}

