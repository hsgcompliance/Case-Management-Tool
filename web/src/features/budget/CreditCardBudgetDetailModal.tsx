"use client";

import React from "react";
import { Modal } from "@entities/ui/Modal";
import { useCreditCard } from "@hooks/useCreditCards";
import { useLedgerEntries } from "@hooks/useLedger";
import { usePaymentQueueItems, type PaymentQueueItem } from "@hooks/usePaymentQueue";
import type { CreditCardEntity, CreditCardSummaryItem, TLedgerEntry } from "@types";

type DetailRow = {
  id: string;
  date: string;
  month: string;
  source: string;
  merchant: string;
  grantId: string;
  lineItemId: string;
  status: string;
  amountCents: number;
};

const PAGE_SIZE = 25;

const fmtUsd = (cents: number) =>
  (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });

function normalizeText(value: unknown) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function parseLast4(value: unknown) {
  const m = String(value || "").match(/\b(\d{4})\b/);
  return m?.[1] || "";
}

function matchingTerms(card: Partial<CreditCardEntity> | null | undefined) {
  if (!card) return [];
  const matching = card.matching as { aliases?: unknown[]; cardAnswerValues?: unknown[] } | null | undefined;
  const aliases = Array.isArray(matching?.aliases) ? matching.aliases : [];
  const answerValues = Array.isArray(matching?.cardAnswerValues) ? matching.cardAnswerValues : [];
  const raw = [card.name, card.code, card.last4, parseLast4(card.last4), ...aliases, ...answerValues];
  return Array.from(
    new Set(
      raw
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .map((value) => (/^\d{4}$/.test(value) ? value : normalizeText(value)))
        .filter((value) => value.length === 4 || value.length >= 4),
    ),
  );
}

function dateIso10(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const maybeTimestamp = value as { toDate?: () => Date; seconds?: number };
  if (typeof maybeTimestamp.toDate === "function") return maybeTimestamp.toDate().toISOString().slice(0, 10);
  if (typeof maybeTimestamp.seconds === "number") return new Date(maybeTimestamp.seconds * 1000).toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function monthFrom(value: unknown) {
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}$/.test(raw)) return raw;
  const iso = dateIso10(value);
  return /^\d{4}-\d{2}/.test(iso) ? iso.slice(0, 7) : "";
}

function amountToCents(amountCents: unknown, amount: unknown) {
  const cents = Number(amountCents);
  if (Number.isFinite(cents)) return Math.round(cents);
  const dollars = Number(amount);
  return Number.isFinite(dollars) ? Math.round(dollars * 100) : 0;
}

function invoiceLooksLikeCreditCardSpend(item: PaymentQueueItem) {
  if (item.creditCardId) return true;
  const haystack = normalizeText([
    item.source,
    item.card,
    item.cardBucket,
    item.descriptor,
    item.note,
    item.notes,
    item.purpose,
    item.formTitle,
    item.formAlias,
    item.rawMeta ? JSON.stringify(item.rawMeta) : "",
  ].join(" "));
  return /\b(credit card|card purchase|cc purchase|card spend|paid by card|p-card|pcard)\b/i.test(haystack);
}

function itemMatchesCard(item: PaymentQueueItem, card: Partial<CreditCardEntity> | null | undefined, terms: string[]) {
  if (!card?.id) return false;
  if (String(item.creditCardId || "") === String(card.id)) return true;
  const haystack = normalizeText([
    item.card,
    item.cardBucket,
    item.descriptor,
    item.note,
    item.notes,
    item.purpose,
    item.merchant,
    item.formTitle,
    item.formAlias,
  ].join(" "));
  return !!haystack && terms.some((term) => haystack.includes(term));
}

function ledgerMatchesCard(entry: TLedgerEntry, card: Partial<CreditCardEntity> | null | undefined, terms: string[]) {
  if (!card?.id) return false;
  if (String(entry.creditCardId || "") === String(card.id)) return true;
  const note = Array.isArray(entry.note) ? entry.note.join(" ") : String(entry.note || "");
  const labels = Array.isArray(entry.labels) ? entry.labels.join(" ") : "";
  const haystack = normalizeText([entry.vendor, entry.comment, entry.grantNameAtSpend, note, labels].join(" "));
  return !!haystack && terms.some((term) => haystack.includes(term));
}

function queueRow(item: PaymentQueueItem): DetailRow {
  const source = String(item.source || "queue");
  const date = dateIso10(item.dueDate || item.createdAt || item.postedAt);
  const direction = String(item.direction || "").toLowerCase();
  let amountCents = amountToCents(undefined, item.amount);
  if (direction === "return" && amountCents > 0) amountCents = -amountCents;
  return {
    id: `queue:${item.id}`,
    date,
    month: monthFrom(item.month || date),
    source: source === "invoice" ? "Invoice queue" : "Card queue",
    merchant: String(item.merchant || item.descriptor || item.formTitle || item.formAlias || item.id || "-"),
    grantId: String(item.grantId || ""),
    lineItemId: String(item.lineItemId || ""),
    status: String(item.queueStatus || "pending"),
    amountCents,
  };
}

function ledgerRow(entry: TLedgerEntry): DetailRow {
  const date = dateIso10(entry.dueDate || entry.date || entry.createdAt || entry.ts);
  return {
    id: `ledger:${entry.id || ""}`,
    date,
    month: monthFrom(entry.month || date),
    source: "Ledger",
    merchant: String(entry.vendor || entry.comment || entry.id || "-"),
    grantId: String(entry.grantId || ""),
    lineItemId: String(entry.lineItemId || ""),
    status: "posted",
    amountCents: amountToCents(entry.amountCents, entry.amount),
  };
}

function titleForMonth(month: string) {
  if (!month) return "No month";
  const [year, monthNo] = month.split("-").map((x) => Number(x));
  if (!year || !monthNo) return month;
  return new Date(year, monthNo - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function defaultUnlockedMonths(): Set<string> {
  const today = new Date();
  const keys: string[] = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return new Set(keys);
}

function exportToCsv(rows: DetailRow[], cardName: string) {
  const headers = ["Date", "Source", "Merchant", "Grant", "Line Item", "Status", "Amount"];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.date,
        r.source,
        escape(r.merchant),
        r.grantId,
        r.lineItemId,
        r.status,
        (r.amountCents / 100).toFixed(2),
      ].join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = cardName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  a.download = `cc_${safeName}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function CreditCardBudgetDetailModal({
  card,
  isOpen,
  onClose,
}: {
  card: CreditCardSummaryItem | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);
  const [selectedMonth, setSelectedMonth] = React.useState<string>("");
  const [unlockedMonths, setUnlockedMonths] = React.useState<Set<string>>(defaultUnlockedMonths);

  const { data: fullCard } = useCreditCard(card?.id, { enabled: isOpen && !!card?.id });
  const { data: ledgerEntries = [], isLoading: ledgerLoading } = useLedgerEntries(
    { source: "card", limit: 500, sortBy: "dueDate", sortOrder: "desc" } as any,
    { enabled: isOpen },
  );
  const { data: cardQueue = [], isLoading: cardQueueLoading } = usePaymentQueueItems(
    { source: "credit-card", limit: 1000 },
    { enabled: isOpen },
  );
  const { data: invoiceQueue = [], isLoading: invoiceQueueLoading } = usePaymentQueueItems(
    { source: "invoice", limit: 1000 },
    { enabled: isOpen },
  );

  React.useEffect(() => {
    setSelectedMonth("");
    setVisibleCount(PAGE_SIZE);
    setUnlockedMonths(defaultUnlockedMonths());
  }, [card?.id]);

  const workingCard = (fullCard || card) as Partial<CreditCardEntity> | null;
  const terms = React.useMemo(() => matchingTerms(workingCard), [workingCard]);

  const rows = React.useMemo(() => {
    if (!workingCard?.id) return [];
    const queueItems = [...cardQueue, ...invoiceQueue].filter((item) => {
      const source = String(item.source || "").toLowerCase();
      if (String(item.queueStatus || "").toLowerCase() === "void") return false;
      if (source === "invoice" && !invoiceLooksLikeCreditCardSpend(item)) return false;
      return itemMatchesCard(item, workingCard, terms);
    });

    const queueLedgerIds = new Set(queueItems.map((item) => String(item.ledgerEntryId || "")).filter(Boolean));
    const queueIds = new Set(queueItems.map((item) => String(item.id || "")).filter(Boolean));
    const queueRows = queueItems.map(queueRow);

    const ledgerRows = ledgerEntries
      .filter((entry) => {
        if (!ledgerMatchesCard(entry, workingCard, terms)) return false;
        const origin = entry.origin as { paymentQueueId?: string | null; sourcePath?: string | null } | null | undefined;
        const sourcePath = String(origin?.sourcePath || "");
        const queueIdFromPath = sourcePath.startsWith("paymentQueue/") ? sourcePath.split("/")[1] || "" : "";
        if (queueLedgerIds.has(String(entry.id || ""))) return false;
        if (origin?.paymentQueueId && queueIds.has(String(origin.paymentQueueId))) return false;
        if (queueIdFromPath && queueIds.has(queueIdFromPath)) return false;
        return true;
      })
      .map(ledgerRow);

    return [...queueRows, ...ledgerRows].sort((a, b) => {
      const dateCmp = String(b.date || "").localeCompare(String(a.date || ""));
      return dateCmp || String(b.id).localeCompare(String(a.id));
    });
  }, [cardQueue, invoiceQueue, ledgerEntries, terms, workingCard]);

  const months = React.useMemo(() => {
    const groups = new Map<string, { month: string; amountCents: number; count: number }>();
    for (const row of rows) {
      const key = row.month || "unassigned";
      const group = groups.get(key) || { month: key, amountCents: 0, count: 0 };
      group.amountCents += row.amountCents;
      group.count += 1;
      groups.set(key, group);
    }
    return Array.from(groups.values()).sort((a, b) => String(b.month).localeCompare(String(a.month)));
  }, [rows]);

  const filteredRows = React.useMemo(() => {
    if (selectedMonth) return rows.filter((row) => row.month === selectedMonth);
    return rows.filter((row) => unlockedMonths.has(row.month));
  }, [rows, selectedMonth, unlockedMonths]);

  const visibleRows = filteredRows.slice(0, visibleCount);
  const loading = ledgerLoading || cardQueueLoading || invoiceQueueLoading;

  function handleMonthClick(month: string) {
    if (!unlockedMonths.has(month)) {
      setUnlockedMonths((prev) => new Set([...prev, month]));
    }
    setSelectedMonth((prev) => (prev === month ? "" : month));
    setVisibleCount(PAGE_SIZE);
  }

  const unlockedTotal = React.useMemo(
    () => rows.filter((r) => unlockedMonths.has(r.month)).reduce((s, r) => s + r.amountCents, 0),
    [rows, unlockedMonths],
  );
  const unlockedCount = rows.filter((r) => unlockedMonths.has(r.month)).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      widthClass="max-w-6xl"
      title={
        <div className="flex items-start justify-between gap-4 w-full pr-2">
          <div>
            <div className="text-base font-semibold text-slate-900 dark:text-slate-100">{card?.name || "Credit card"}</div>
            <div className="text-xs font-normal text-slate-500 dark:text-slate-400">
              Monthly limit {fmtUsd(card?.monthlyLimitCents || 0)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => exportToCsv(filteredRows, card?.name || "card")}
            disabled={filteredRows.length === 0}
            className="shrink-0 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Export CSV
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Month tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {/* "All" tab */}
          <button
            type="button"
            onClick={() => { setSelectedMonth(""); setVisibleCount(PAGE_SIZE); }}
            className={[
              "min-w-[130px] rounded-lg border px-3 py-2 text-left transition",
              !selectedMonth
                ? "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-100"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
            ].join(" ")}
          >
            <div className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">All (recent)</div>
            <div className="mt-1 text-sm font-bold tabular-nums">{fmtUsd(unlockedTotal)}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{unlockedCount} rows</div>
          </button>

          {months.map((m) => {
            const active = selectedMonth === m.month;
            const unlocked = unlockedMonths.has(m.month);
            return (
              <button
                key={m.month}
                type="button"
                onClick={() => handleMonthClick(m.month)}
                title={unlocked ? undefined : "Click to load this month"}
                className={[
                  "min-w-[150px] rounded-lg border px-3 py-2 text-left transition",
                  active
                    ? "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-100"
                    : unlocked
                    ? "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    : "border-slate-200 bg-slate-50 text-slate-400 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-500",
                ].join(" ")}
              >
                <div className="flex items-center gap-1 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  {!unlocked && (
                    <svg className="h-3 w-3 shrink-0 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  )}
                  {titleForMonth(m.month)}
                </div>
                <div className="mt-1 text-sm font-bold tabular-nums">{fmtUsd(m.amountCents)}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {unlocked ? `${m.count} rows` : "Click to load"}
                </div>
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div className="overflow-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Date</th>
                <th className="px-3 py-2 text-left font-semibold">Source</th>
                <th className="px-3 py-2 text-left font-semibold">Merchant</th>
                <th className="px-3 py-2 text-left font-semibold">Grant</th>
                <th className="px-3 py-2 text-left font-semibold">Line Item</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td className="px-3 py-8 text-center text-slate-500 dark:text-slate-400" colSpan={7}>Loading card activity...</td>
                </tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-center text-slate-500 dark:text-slate-400" colSpan={7}>No card activity found.</td>
                </tr>
              ) : (
                visibleRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-300">{row.date || "-"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-300">{row.source}</td>
                    <td className="min-w-[220px] px-3 py-2 font-medium text-slate-900 dark:text-slate-100">{row.merchant}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-500 dark:text-slate-400">{row.grantId || "-"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-500 dark:text-slate-400">{row.lineItemId || "-"}</td>
                    <td className="whitespace-nowrap px-3 py-2 capitalize text-slate-600 dark:text-slate-300">{row.status}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {fmtUsd(row.amountCents)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {visibleCount < filteredRows.length ? (
          <div className="flex justify-center">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}>
              Load more ({filteredRows.length - visibleCount} remaining)
            </button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
