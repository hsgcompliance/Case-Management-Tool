import type { PaymentQueueItem } from "@hooks/usePaymentQueue";
import type { JotformDigestMap, JotformSubmission } from "@hooks/useJotform";
import { extractSpendLineItems, type SpendLineItem } from "./spendExtractor";

type AnyObj = Record<string, unknown>;

export type NormalizedAnswerField = {
  key: string;
  label: string;
  value: string;
  raw: unknown;
};

export type SubmissionSummary = {
  submissionId: string;
  title: string;
  formTitle: string;
  formAlias: string;
  paymentType: "credit-card" | "invoice" | "unknown";
  amountTotal: number;
  purchaser: string;
  counterparties: string[];
  transactionCount: number;
  date: string;
};

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function cleanDisplayValue(input: string, label?: string): string {
  let text = collapseWhitespace(input);
  if (!text) return "";

  text = text.replace(/\bcontrol_[a-z0-9_]+\b/gi, " ");
  text = text.replace(/^[a-z][a-z0-9]{5,}\d{2,}\s*/i, "");
  text = text.replace(/^\d+\s+(?=[A-Z])/g, "");

  const cleanLabel = collapseWhitespace(String(label || ""));
  if (cleanLabel) {
    const lowerText = text.toLowerCase();
    const lowerLabel = cleanLabel.toLowerCase();
    const idx = lowerText.indexOf(lowerLabel);
    if (idx > 0) {
      text = text.slice(idx + cleanLabel.length).trim();
    }
  }

  text = text.replace(/^[:\-\s]+/, "");
  text = collapseWhitespace(text);
  if (!text) return "";
  if (cleanLabel && text.toLowerCase() === cleanLabel.toLowerCase()) return "";
  return text;
}

export function jotformValueText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return collapseWhitespace(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(jotformValueText).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const obj = value as AnyObj;
    if (typeof obj.datetime === "string") return collapseWhitespace(String(obj.datetime));
    if (obj.year && obj.month && obj.day) {
      return `${obj.year}-${String(Number(obj.month)).padStart(2, "0")}-${String(Number(obj.day)).padStart(2, "0")}`;
    }
    const preferredKeys = ["first", "middle", "last", "addr_line1", "addr_line2", "city", "state", "postal", "country"];
    const preferredValues = preferredKeys
      .map((key) => jotformValueText(obj[key]))
      .filter(Boolean);
    if (preferredValues.length) return preferredValues.join(", ");
    return Object.values(obj).map(jotformValueText).filter(Boolean).join(", ");
  }
  return "";
}

function rawAnswerValue(entry: unknown): unknown {
  if (!entry || typeof entry !== "object") return entry;
  const obj = entry as AnyObj;
  if ("answer" in obj && obj.answer != null) return obj.answer;
  if ("prettyFormat" in obj && obj.prettyFormat != null) return obj.prettyFormat;
  if ("value" in obj && obj.value != null) return obj.value;
  return "";
}

export function buildNormalizedAnswerFields(answers: Record<string, unknown>): NormalizedAnswerField[] {
  return Object.entries(answers || {})
    .map(([key, raw]) => {
      const entry = raw && typeof raw === "object" ? (raw as AnyObj) : null;
      const label = collapseWhitespace(String(entry?.text || entry?.name || key));
      const value = cleanDisplayValue(jotformValueText(rawAnswerValue(raw)), label);
      return { key, label, value, raw };
    })
    .filter((field) => !!field.value);
}

function findFieldValue(fields: NormalizedAnswerField[], matcher: (field: NormalizedAnswerField) => boolean): string {
  return fields.find(matcher)?.value || "";
}

export function resolveSubmissionTitle(
  submission: JotformSubmission | Record<string, unknown>,
  digestMap?: JotformDigestMap | null,
  fields?: NormalizedAnswerField[],
): string {
  const answers = ((submission as AnyObj)?.answers || {}) as Record<string, unknown>;
  const normalized = fields || buildNormalizedAnswerFields(answers);
  const byKey = new Map(normalized.map((field) => [field.key, field.value]));

  const titleKeys = digestMap?.options?.task?.titleFieldKeys;
  if (Array.isArray(titleKeys) && titleKeys.length) {
    const parts = titleKeys.map((key) => byKey.get(String(key)) || "").filter(Boolean);
    if (parts.length) return parts.join(" - ");
  }

  const fallback = findFieldValue(normalized, (field) => {
    const label = field.label.toLowerCase();
    return label.includes("head of household") || label === "full name" || label === "name";
  });
  if (fallback) return fallback;

  const purchaser = findFieldValue(normalized, (field) => field.label.toLowerCase().includes("purchaser"));
  if (purchaser) return purchaser;

  return String((submission as AnyObj)?.submissionId || (submission as AnyObj)?.id || "-");
}

export function summarizeSubmission(
  submission: JotformSubmission | Record<string, unknown>,
  digestMap?: JotformDigestMap | null,
): { summary: SubmissionSummary; fields: NormalizedAnswerField[]; items: SpendLineItem[] } {
  const sub = submission as AnyObj;
  const answers = (sub.answers || {}) as Record<string, unknown>;
  const fields = buildNormalizedAnswerFields(answers);
  const items = extractSpendLineItems(sub as AnyObj, digestMap ? { digest: digestMap as AnyObj } : {});
  const purchaser = items.find((item) => item.purchaser)?.purchaser
    || findFieldValue(fields, (field) => field.label.toLowerCase().includes("purchaser"))
    || findFieldValue(fields, (field) => field.label.toLowerCase().includes("submitter"))
    || "";
  const counterparties = Array.from(new Set(items.map((item) => item.customer || item.merchant).filter(Boolean)));
  const amountTotal = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const firstItem = items[0];
  const paymentType = firstItem?.source || "unknown";
  const date = String(sub.updatedAt || sub.createdAt || firstItem?.createdAt || "");

  return {
    summary: {
      submissionId: String(sub.submissionId || sub.id || ""),
      title: resolveSubmissionTitle(submission as JotformSubmission, digestMap, fields),
      formTitle: String(sub.formTitle || sub.formId || ""),
      formAlias: String(sub.formAlias || ""),
      paymentType,
      amountTotal,
      purchaser,
      counterparties,
      transactionCount: items.length,
      date,
    },
    fields,
    items,
  };
}

export function summarizeQueueState(queueItems: PaymentQueueItem[]): {
  total: number;
  pending: number;
  posted: number;
  void: number;
  ledgerIds: string[];
} {
  const total = queueItems.length;
  const pending = queueItems.filter((item) => item.queueStatus === "pending").length;
  const posted = queueItems.filter((item) => item.queueStatus === "posted").length;
  const voided = queueItems.filter((item) => item.queueStatus === "void").length;
  const ledgerIds = queueItems
    .map((item) => String(item.ledgerEntryId || ""))
    .filter(Boolean);
  return { total, pending, posted, void: voided, ledgerIds };
}

export function stageLabelFromQueueSource(source: unknown): string {
  const normalized = String(source || "").trim().toLowerCase();
  if (normalized === "credit-card") return "Credit Card";
  if (normalized === "invoice") return "Invoice";
  if (normalized === "projection") return "Projection";
  return "Unknown";
}

export function fileLabelFromUrl(url: string, fallback: string): string {
  try {
    const pathname = new URL(url).pathname;
    const bits = pathname.split("/").filter(Boolean);
    return bits[bits.length - 1] || fallback;
  } catch {
    return fallback;
  }
}
