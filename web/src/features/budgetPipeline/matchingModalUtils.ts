import type { PaymentQueueItem } from "@hooks/usePaymentQueue";

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
