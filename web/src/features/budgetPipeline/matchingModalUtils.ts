import type { PaymentQueueItem } from "@hooks/usePaymentQueue";
import type { SubmissionAdvancedFilters } from "@entities/dialogs/SubmissionAdvancedFilterDialog";

export type MatchingSourceFilter = "invoice" | "card" | "all";

export function rowSourceType(item: Pick<PaymentQueueItem, "source" | "formTitle" | "formAlias">): "invoice" | "card" | "other" {
  const source = String(item.source || "").toLowerCase();
  if (source === "invoice") return "invoice";
  if (source === "credit-card") return "card";
  const text = `${String(item.formTitle || "")} ${String(item.formAlias || "")}`.toLowerCase();
  if (text.includes("invoice")) return "invoice";
  if (text.includes("card")) return "card";
  return "other";
}

export function matchesSourceFilter(item: Pick<PaymentQueueItem, "source" | "formTitle" | "formAlias">, filter: MatchingSourceFilter): boolean {
  if (filter === "all") return true;
  return rowSourceType(item) === filter;
}

export function itemDateISO(item: Pick<PaymentQueueItem, "dueDate" | "createdAt" | "postedAt">): string {
  const raw = String(item.dueDate || item.createdAt || item.postedAt || "");
  return raw.slice(0, 10);
}

export function inNullableDateRange(item: Pick<PaymentQueueItem, "dueDate" | "createdAt" | "postedAt">, startDate: string, endDate: string): boolean {
  const date = itemDateISO(item);
  if (!date) return true;
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  return true;
}

export function ledgerPostBlockers(
  item: Pick<PaymentQueueItem, "id" | "grantId" | "lineItemId" | "ledgerEntryId" | "queueStatus">,
  opts: { unsaved?: boolean; conflict?: boolean; duplicate?: boolean } = {},
): string[] {
  const blockers: string[] = [];
  if (!item.grantId || !item.lineItemId) blockers.push("missing allocation");
  if (opts.unsaved) blockers.push("unsaved allocation");
  if (opts.conflict) blockers.push("pipeline conflict");
  if (opts.duplicate || item.ledgerEntryId || item.queueStatus === "posted") blockers.push("duplicate/posting risk");
  return blockers;
}

function textValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function includesNeedle(value: unknown, needle: string): boolean {
  const q = needle.trim().toLowerCase();
  return !q || textValue(value).toLowerCase().includes(q);
}

function projectSearchText(item: PaymentQueueItem): string {
  return [
    item.billedTo,
    item.project,
    item.program,
    item.purpose,
    (item as Record<string, unknown>).programOperationsFor,
    (item as Record<string, unknown>).supportiveServiceProgram,
    textValue(item.transactionFields),
    textValue(item.rawAnswers),
  ].filter(Boolean).join(" ");
}

export function matchesSubmissionAdvancedFilters(item: PaymentQueueItem, filters: SubmissionAdvancedFilters): boolean {
  if (!includesNeedle([item.merchant, item.descriptor, item.formTitle], filters.vendor)) return false;
  if (!includesNeedle([item.purchaser, item.customer, item.customerId, item.card], filters.purchaser)) return false;
  if (!includesNeedle([item.purpose, item.notes, item.note, item.descriptor], filters.purpose)) return false;
  if (!inNullableDateRange(item, filters.startDate, filters.endDate)) return false;
  const projectText = projectSearchText(item);
  if (filters.projectOption && !includesNeedle(projectText, filters.projectOption)) return false;
  if (filters.projectRaw && !includesNeedle(projectText, filters.projectRaw)) return false;
  return true;
}
