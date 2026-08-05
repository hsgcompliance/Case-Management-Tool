import type { ComplexDateValue } from "@entities/ui/ComplexDateSelector";

export type InvoicingDateRange = {
  startDate: string;
  endDate: string;
};

export type InvoicingSource = "credit-card" | "invoice";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function localIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthEnd(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return localIsoDate(new Date(year, monthNumber, 0));
}

/** Previous two full calendar months through today, using the user's local day. */
export function defaultInvoicingDateRange(now = new Date()): InvoicingDateRange {
  return {
    startDate: localIsoDate(new Date(now.getFullYear(), now.getMonth() - 2, 1)),
    endDate: localIsoDate(now),
  };
}

export function dateFilterToRange(
  value: ComplexDateValue | null | undefined,
  fallback = defaultInvoicingDateRange(),
): InvoicingDateRange {
  if (value?.mode === "month" && /^\d{4}-\d{2}$/.test(String(value.month || ""))) {
    const month = String(value.month);
    return { startDate: `${month}-01`, endDate: monthEnd(month) };
  }
  if (value?.mode === "before") {
    return {
      startDate: fallback.startDate,
      endDate: ISO_DATE_RE.test(String(value.date || "")) ? String(value.date) : fallback.endDate,
    };
  }
  if (value?.mode === "after") {
    return {
      startDate: ISO_DATE_RE.test(String(value.date || "")) ? String(value.date) : fallback.startDate,
      endDate: fallback.endDate,
    };
  }
  if (value?.mode === "between") {
    return {
      startDate: ISO_DATE_RE.test(String(value.startDate || "")) ? String(value.startDate) : fallback.startDate,
      endDate: ISO_DATE_RE.test(String(value.endDate || "")) ? String(value.endDate) : fallback.endDate,
    };
  }
  return fallback;
}

export function validateInvoicingDateRange(
  startDate: string,
  endDate: string,
  fallback = defaultInvoicingDateRange(),
): { range: InvoicingDateRange | null; error: string | null } {
  const normalized = {
    startDate: ISO_DATE_RE.test(startDate) ? startDate : fallback.startDate,
    endDate: ISO_DATE_RE.test(endDate) ? endDate : fallback.endDate,
  };
  if (normalized.startDate > normalized.endDate) {
    return { range: null, error: "Date on and after must not be later than date on and before." };
  }
  return { range: normalized, error: null };
}

export function dateRangeContains(coverage: InvoicingDateRange, requested: InvoicingDateRange): boolean {
  return coverage.startDate <= requested.startDate && coverage.endDate >= requested.endDate;
}

export function extendDateRange(coverage: InvoicingDateRange, requested: InvoicingDateRange): InvoicingDateRange {
  return {
    startDate: coverage.startDate <= requested.startDate ? coverage.startDate : requested.startDate,
    endDate: coverage.endDate >= requested.endDate ? coverage.endDate : requested.endDate,
  };
}

export function selectedInvoicingSources(typeFilter: string): Set<InvoicingSource> {
  if (typeFilter === "card") return new Set(["credit-card"]);
  if (typeFilter === "invoice") return new Set(["invoice"]);
  return new Set(["credit-card", "invoice"]);
}

export function sourceMatchesSelection(source: unknown, selected: Set<InvoicingSource>): boolean {
  const normalized = String(source || "").trim().toLowerCase();
  return (normalized === "credit-card" || normalized === "invoice") && selected.has(normalized);
}

