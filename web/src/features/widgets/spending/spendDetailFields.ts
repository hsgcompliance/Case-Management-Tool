import { transactionFieldKey } from "@hdb/contracts";

type QueueItem = Record<string, unknown> | null | undefined;

export type TransactionCategoryField = {
  key: string;
  label: string;
  value: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function paymentFieldText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(paymentFieldText).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    if (object.answer != null) return paymentFieldText(object.answer);
    if (object.prettyFormat != null) return paymentFieldText(object.prettyFormat);
    if (object.value != null) return paymentFieldText(object.value);
    if (typeof object.datetime === "string") return paymentFieldText(object.datetime);
    const { year, month, day } = object;
    if (year && month && day) {
      return `${year}-${String(Number(month)).padStart(2, "0")}-${String(Number(day)).padStart(2, "0")}`;
    }
  }
  return "";
}

export function rawSubmissionAnswer(item: QueueItem, fieldIds: readonly string[]): string {
  const rawAnswers = asRecord(item?.rawAnswers);
  for (const fieldId of fieldIds) {
    const value = paymentFieldText(rawAnswers[fieldId]);
    if (value) return value;
  }
  return "";
}

/**
 * Reads a field from the order-clustered transaction payload. New extraction
 * uses tx:<slug> keys; legacy/return rows may still use camelCase field keys.
 */
export function clusteredTransactionAnswer(
  item: QueueItem,
  label: string,
  legacyKeys: readonly string[] = [],
): string {
  const canonicalKey = label.startsWith("tx:") ? label : transactionFieldKey(label);
  const candidates = Array.from(new Set([canonicalKey, label, ...legacyKeys]));
  const transactionFields = asRecord(item?.transactionFields);
  for (const key of candidates) {
    const value = paymentFieldText(transactionFields[key]);
    if (value) return value;
  }

  const extractionGroup = asRecord(item?.extractionGroup);
  const fieldIds = asRecord(extractionGroup.fieldIds);
  const rawAnswers = asRecord(item?.rawAnswers);
  for (const key of candidates) {
    const fieldId = paymentFieldText(fieldIds[key]);
    const value = fieldId ? paymentFieldText(rawAnswers[fieldId]) : "";
    if (value) return value;
  }
  return "";
}

function cleanQuestionLabel(value: unknown, fallbackKey: string): string {
  const raw = paymentFieldText(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (raw) return raw;
  return fallbackKey
    .replace(/^tx:/, "")
    .split("-")
    .filter(Boolean)
    .map((part) => {
      const upper = part.toUpperCase();
      return ["WIOA", "TSS", "PATH", "WEX", "YHDP"].includes(upper)
        ? upper
        : `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`;
    })
    .join(" ");
}

function isCategoryKey(key: string): boolean {
  const slug = key.replace(/^tx:/, "");
  if (/yhdp.*flex.*fund/i.test(slug)) return false;
  return /(^|[-_])(category|specifier|scope|funding|fund)([-_]|$)/i.test(slug);
}

/** Returns filled category/scope fields in their original Jotform order. */
export function clusteredCategoryFields(item: QueueItem): TransactionCategoryField[] {
  const transactionFields = asRecord(item?.transactionFields);
  const extractionGroup = asRecord(item?.extractionGroup);
  const fieldIds = asRecord(extractionGroup.fieldIds);
  const fieldOrders = asRecord(extractionGroup.fieldOrders);
  const rawAnswers = asRecord(item?.rawAnswers);
  const keys = Array.from(new Set([...Object.keys(fieldIds), ...Object.keys(transactionFields)]));

  return keys
    .filter(isCategoryKey)
    .map((key) => {
      const fieldId = paymentFieldText(fieldIds[key]);
      const rawAnswer = fieldId ? asRecord(rawAnswers[fieldId]) : {};
      return {
        key,
        label: cleanQuestionLabel(rawAnswer.text ?? rawAnswer.name, key),
        value: paymentFieldText(transactionFields[key]) || paymentFieldText(rawAnswer),
        order: Number(fieldOrders[key] ?? rawAnswer.order ?? Number.MAX_SAFE_INTEGER),
      };
    })
    .filter((field) => !!field.value)
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
    .map(({ key, label, value }) => ({ key, label, value }));
}

function appendFiles(out: string[], value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => appendFiles(out, entry));
    return;
  }
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    appendFiles(out, object.answer ?? object.prettyFormat ?? object.value);
    return;
  }
  const text = paymentFieldText(value);
  if (!text) return;
  const urls = text.match(/https?:\/\/[^\s,]+/gi);
  if (urls?.length) out.push(...urls);
  else out.push(text);
}

/**
 * Includes normalized file arrays plus every file-upload answer whose Jotform
 * order lies inside this transaction's extraction window.
 */
export function clusteredPaymentFiles(item: QueueItem): string[] {
  const out: string[] = [];
  [item?.files_txn, item?.files, item?.files_uploadAll].forEach((value) => appendFiles(out, value));
  Object.values(asRecord(item?.files_typed)).forEach((value) => appendFiles(out, value));

  const extractionGroup = asRecord(item?.extractionGroup);
  const range = Array.isArray(extractionGroup.orderRange) ? extractionGroup.orderRange : [];
  const start = Number(range[0]);
  const end = Number(range[1]);
  if (Number.isFinite(start) && Number.isFinite(end)) {
    for (const raw of Object.values(asRecord(item?.rawAnswers))) {
      const answer = asRecord(raw);
      const order = Number(answer.order);
      const type = paymentFieldText(answer.type);
      if (order < start || order > end || !/fileupload/i.test(type)) continue;
      appendFiles(out, answer);
    }
  }

  return Array.from(new Set(out.map((file) => file.trim()).filter(Boolean)));
}
