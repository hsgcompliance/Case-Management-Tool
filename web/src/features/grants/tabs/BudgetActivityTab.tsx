"use client";

import React, { useCallback, useDeferredValue, useMemo, useState } from "react";
import ActionMenu, { type ActionItem } from "@entities/ui/ActionMenu";
import { useEnrollments } from "@hooks/useEnrollments";
import { useGrantActivity } from "@hooks/useGrants";
import { useUsers } from "@hooks/useUsers";
import { SpendDetailModal, type SpendRow } from "@features/widgets/spending/SpendDetailModal";
import { computeRentCertDues } from "@features/customers/components/paymentScheduleUtils";
import { fmtMDY, safeISODate10, toISODate, toMillisAny } from "@lib/date";
import {
  GrantBudgetSandboxModal,
  type GrantBudgetSandboxLineItem,
  type GrantBudgetSandboxSeedRow,
} from "./GrantBudgetSandboxModal";
import { paymentTypeLabel, paymentNoteMeta } from "@entities/payments/PaymentTypeLabel";

type ActivityMode = "paid" | "projected" | "all";
type ActivityKindFilter = "all" | "paid" | "projected" | "reversal" | "data-entry-complete" | "data-entry-incomplete";
type ComplianceStatus = "complete" | "partial" | "none";
type SortDirection = "asc" | "desc";
type ActivitySortKey = "date" | "amount" | "customer" | "budgetType" | "note" | "status";
type LineItemSortKey = "label" | "type" | "budget" | "spent" | "balance" | "projectedSpend" | "available" | "status";
type GrantActivityRow = SpendRow & {
  customerLabel: string;
  userLabel: string;
  noteText: string;
  budgetTypeLabel: string;
  rentCertDueOn: string;
  displayType: "Paid" | "Projected" | "Reversal";
  sourceType: "paid" | "projected";
  complianceStatus: ComplianceStatus;
  searchText: string;
};

const DEFAULT_LINE_ITEM_TYPES = [
  { id: "rent", label: "Rent" },
  { id: "utility-assistance", label: "Utility assistance" },
  { id: "deposit", label: "Deposit" },
  { id: "support-service-prorated", label: "Support service prorated" },
] as const;

function slugifyLineItemType(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function lineItemTypeLabel(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const raw = value as Record<string, unknown>;
    return String(raw.label ?? raw.name ?? raw.id ?? "").trim();
  }
  return "";
}

function normalizeBudgetTypeLabel(value: unknown, fallback?: unknown) {
  const raw = `${lineItemTypeLabel(value) || String(fallback || "")}`.trim();
  const key = slugifyLineItemType(raw);
  if (!key) return "N/A";
  if (key.includes("deposit")) return "Deposit";
  if (key.includes("util")) return "Utility assistance";
  if (key.includes("support") || key.includes("service") || key.includes("case-management")) return "Support service prorated";
  if (key.includes("rent") || key.includes("rental") || key.includes("housing")) return "Rent";
  return raw;
}

function lineItemTypeKey(value: unknown) {
  if (value == null) return "";
  if (typeof value === "object") {
    const raw = value as Record<string, unknown>;
    const id = String(raw.id || "").trim();
    if (id) return slugifyLineItemType(id);
  }
  return slugifyLineItemType(lineItemTypeLabel(value));
}

function isRentalAssistanceLineItem(lineItem: unknown) {
  if (!lineItem || typeof lineItem !== "object") return false;
  const raw = lineItem as Record<string, unknown>;
  const typeKey = lineItemTypeKey(raw.type);
  if (typeKey) return typeKey === "rental-assistance";
  return slugifyLineItemType(String(raw.label || "")) === "rental-assistance";
}

function normalizeLineItemTypeInput(value: string) {
  const label = value.trim();
  if (!label || ["na", "n/a", "none", "null"].includes(label.toLowerCase())) return null;
  const preset = DEFAULT_LINE_ITEM_TYPES.find((type) => type.label.toLowerCase() === label.toLowerCase());
  return preset ? { ...preset } : { id: slugifyLineItemType(label), label };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function colorVal(v: number) {
  return v >= 0 ? "text-emerald-600" : "text-red-500";
}

function tip(text: string) {
  return text;
}

function dateIso10(value: unknown) {
  if (typeof value === "string") {
    const iso = safeISODate10(value);
    if (iso) return iso;
  }
  const ms = toMillisAny(value);
  if (Number.isFinite(ms) && ms > 0) return toISODate(ms);
  const s = String(value || "").trim();
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return toISODate(d);
}

function monthFromDate(value: unknown) {
  const iso10 = dateIso10(value);
  return iso10 ? iso10.slice(0, 7) : "";
}

function normalizeText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compareText(a: unknown, b: unknown) {
  return String(a || "").localeCompare(String(b || ""), undefined, { numeric: true, sensitivity: "base" });
}

function applyDirection(value: number, direction: SortDirection) {
  return direction === "asc" ? value : -value;
}

function SpendBar({
  total,
  spent,
  projected,
  currency,
}: {
  total: number;
  spent: number;
  projected: number;
  currency: (n: number) => string;
}) {
  const projectedBalance = total - spent - projected;
  const isOverspent = projectedBalance < 0;
  const denom = total > 0 ? total : 1;
  const spentPct = clamp((spent / denom) * 100, 0, 100);
  const projPct = clamp((projected / denom) * 100, 0, 100 - spentPct);
  const remPct = clamp(100 - spentPct - projPct, 0, 100);

  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-amber-400 transition-all" style={{ width: `${spentPct}%` }} title={`Spent: ${currency(spent)}`} />
        <div className="h-full bg-blue-400 transition-all" style={{ width: `${projPct}%` }} title={`Projected: ${currency(projected)}`} />
        <div className={`h-full transition-all ${isOverspent ? "bg-red-400" : "bg-emerald-300"}`} style={{ width: `${remPct}%` }} title={`Available: ${currency(projectedBalance)}`} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-amber-400" />Spent</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-blue-400" />Projected</span>
        <span className="flex items-center gap-1"><span className={`inline-block h-2 w-2 rounded-full ${isOverspent ? "bg-red-400" : "bg-emerald-300"}`} />Available</span>
        <span className="ml-auto font-medium text-slate-700">
          {currency(spent)} spent of {currency(total)} total {" • "}
          <span className={colorVal(projectedBalance)}>{currency(projectedBalance)} available</span>
        </span>
      </div>
    </div>
  );
}

function MiniBar({ spent, amount }: { spent: number; amount: number }) {
  const denom = amount > 0 ? amount : 1;
  const pct = clamp((spent / denom) * 100, 0, 100);
  const overflow = spent > amount;
  return (
    <div className="relative h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
      <div className={`absolute left-0 top-0 h-full ${overflow ? "bg-red-400" : "bg-amber-400"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatusChip({
  label,
  active = false,
  tone = "slate",
  title,
}: {
  label: string;
  active?: boolean;
  tone?: "slate" | "amber";
  title?: string;
}) {
  const cls =
    tone === "amber"
      ? active
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-white text-slate-400"
      : active
      ? "border-slate-300 bg-slate-100 text-slate-700"
      : "border-slate-200 bg-white text-slate-400";

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`} title={title}>
      {label}
    </span>
  );
}

function ActivityDrawer({
  items,
  currency,
  colSpan,
  onClose,
  mode,
  onModeChange,
  onSelectItem,
}: {
  items: GrantActivityRow[];
  currency: (n: number) => string;
  colSpan: number;
  onClose: () => void;
  mode: ActivityMode;
  onModeChange: (mode: ActivityMode) => void;
  onSelectItem: (item: SpendRow) => void;
}) {
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<ActivityKindFilter>("all");
  const [sort, setSort] = useState<{ key: ActivitySortKey; direction: SortDirection }>({ key: "date", direction: "desc" });
  const deferredSearch = useDeferredValue(search);
  const toggleSort = useCallback((key: ActivitySortKey) => {
    setSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalizeText(deferredSearch);
    const filtered = items.filter((item) => {
      const modePass =
        mode === "all" ? true : mode === "paid" ? item.sourceType === "paid" : item.sourceType === "projected";
      if (!modePass) return false;

      const kindPass =
        kindFilter === "all" ? true
        : kindFilter === "paid" ? item.displayType === "Paid"
        : kindFilter === "projected" ? item.displayType === "Projected"
        : kindFilter === "reversal" ? item.displayType === "Reversal"
        : kindFilter === "data-entry-complete" ? item.displayType === "Paid" && item.complianceStatus === "complete"
        : kindFilter === "data-entry-incomplete" ? item.displayType === "Paid" && item.complianceStatus !== "complete"
        : true;
      if (!kindPass) return false;

      if (!normalizedQuery) return true;
      return item.searchText.includes(normalizedQuery);
    });
    return filtered.sort((a, b) => {
      const result =
        sort.key === "date" ? compareText(a.date, b.date)
        : sort.key === "amount" ? a.amountCents - b.amountCents
        : sort.key === "customer" ? compareText(a.customerLabel, b.customerLabel)
        : sort.key === "budgetType" ? compareText(a.budgetTypeLabel, b.budgetTypeLabel)
        : sort.key === "note" ? compareText(a.noteText || a.title, b.noteText || b.title)
        : compareText(a.displayType, b.displayType) || compareText(a.complianceStatus, b.complianceStatus);
      return applyDirection(result, sort.direction);
    });
  }, [deferredSearch, items, kindFilter, mode, sort.direction, sort.key]);

  const projectedCount = useMemo(
    () => items.filter((item) => item.sourceType === "projected").length,
    [items],
  );
  const paidCount = useMemo(
    () => items.filter((item) => item.sourceType === "paid").length,
    [items],
  );
  const net = filteredItems.reduce((acc, item) => acc + item.amountCents / 100, 0);
  const headerButton = (key: ActivitySortKey, label: string, className = "pb-1 pr-4 font-medium") => (
    <button type="button" className={`w-full text-left ${className}`} onClick={() => toggleSort(key)}>
      {label}
    </button>
  );

  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        <div className="space-y-2 border-y border-sky-100 bg-sky-50 px-4 py-3 dark:border-sky-900 dark:bg-sky-950/20">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                {filteredItems.length > 0
                  ? `${filteredItems.length} activit${filteredItems.length === 1 ? "y" : "ies"} · Net ${currency(net)}`
                  : "No matching activity"}
              </span>
              <div className="inline-flex rounded-lg border border-sky-200 bg-white/80 p-0.5 text-[11px]">
                {([
                  ["all", "All", false, "Posted and projected rows together for this grant scope."],
                  ["paid", "Paid", false, `Posted ledger rows only (${paidCount}).`],
                  ["projected", "Projected", projectedCount === 0, projectedCount > 0 ? `Pending projected payments only (${projectedCount}).` : "No projected payments for this scope."],
                ] as const).map(([key, label, disabled, title]) => (
                  <button
                    key={key}
                    type="button"
                    className={[
                      "rounded-md px-2.5 py-1 font-semibold transition",
                      mode === key ? "bg-sky-100 text-sky-800" : "text-slate-500 hover:text-slate-700",
                      disabled ? "cursor-not-allowed opacity-45" : "",
                    ].join(" ")}
                    onClick={() => {
                      if (disabled) return;
                      onModeChange(key);
                    }}
                    title={tip(title)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" className="btn btn-ghost btn-xs text-slate-500" onClick={onClose} title={tip("Close this activity drawer.")}>
              Close ×
            </button>
          </div>

          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px]">
            <input
              className="input text-sm"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              placeholder="Search customer, type, note, rent cert, payment..."
              title={tip("Filter activity rows like the invoicing tool by customer, type, note, rent cert due date, or payment.")}
            />
            <select
              className="input text-sm"
              value={kindFilter}
              onChange={(e) => setKindFilter(e.currentTarget.value as ActivityKindFilter)}
              title={tip("Filter rows by activity type or compliance status.")}
            >
              <option value="all">All Types</option>
              <option value="paid">Paid rows only</option>
              <option value="projected">Projected rows only</option>
              <option value="data-entry-complete">Data Entry Complete</option>
              <option value="data-entry-incomplete">Data Entry Incomplete</option>
              <option value="reversal">Reversal</option>
            </select>
          </div>

          {filteredItems.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border-separate text-xs" style={{ borderSpacing: 0 }}>
                <thead>
                  <tr className="text-left text-slate-500">
                    <th>{headerButton("date", "Date")}</th>
                    <th>{headerButton("amount", "Amount", "pb-1 pr-4 text-right font-medium")}</th>
                    <th>{headerButton("customer", "Customer")}</th>
                    <th>{headerButton("budgetType", "Type")}</th>
                    <th className="pb-1 pr-4 font-medium">Rent Cert Due</th>
                    <th>{headerButton("note", "Note")}</th>
                    <th>{headerButton("status", "Status", "pb-1 font-medium")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr
                      key={item.id}
                      className="cursor-pointer border-b border-slate-100 transition hover:bg-white/80 last:border-0 dark:border-slate-800"
                      onClick={() => onSelectItem(item)}
                      title={tip("Open this row in the full spending detail modal.")}
                    >
                      <td className="py-1 pr-4 text-slate-700">{item.date ? fmtMDY(item.date) : "-"}</td>
                      <td className={`py-1 pr-4 text-right font-medium ${item.amountCents < 0 ? "text-red-600" : "text-slate-900 dark:text-slate-100"}`}>
                        {currency(item.amountCents / 100)}
                      </td>
                      <td className="py-1 pr-4 text-slate-600">{item.customerLabel || "—"}</td>
                      <td className="py-1 pr-4 text-slate-600">{item.budgetTypeLabel || "N/A"}</td>
                      <td className="py-1 pr-4 text-slate-600">{item.rentCertDueOn ? fmtMDY(item.rentCertDueOn) : "—"}</td>
                      <td className="py-1 pr-4 text-slate-500">{item.noteText || item.title || "—"}</td>
                      <td className="py-1">
                        {item.displayType === "Reversal" ? (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-700">Reversal</span>
                        ) : item.displayType === "Projected" ? (
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 font-medium text-blue-700">Projected</span>
                        ) : (
                          <span className="inline-flex flex-wrap gap-1">
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-700">Paid</span>
                            <span className={`rounded px-1.5 py-0.5 font-medium ${item.complianceStatus === "complete" ? "bg-emerald-50 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                              {item.complianceStatus === "complete" ? "Data Entry Complete" : "Data Entry Incomplete"}
                            </span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filteredItems.length === 0 && (
            <div className="rounded-lg border border-dashed border-sky-200 bg-white/70 px-3 py-4 text-xs text-slate-500">
              No activity matches the current toggle and filters.
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

function AddFundsModal({
  targetIdx,
  lineItems,
  num,
  currency,
  onCommit,
  onClose,
  initialMode = "add",
}: {
  targetIdx: number;
  lineItems: any[];
  num: (n: unknown, fallback?: number) => number;
  currency: (n: number) => string;
  onCommit: (patch: { targetIdxAmountDelta: number; sourceIdx?: number }) => void;
  onClose: () => void;
  initialMode?: "add" | "move";
}) {
  const [mode, setMode] = useState<"add" | "move">(initialMode);
  const [amount, setAmount] = useState("");
  const [sourceIdx, setSourceIdx] = useState<number>(-1);

  const target = lineItems[targetIdx];
  if (!target) return null;

  const parsedAmount = Number(amount) || 0;
  const sourceItem = sourceIdx >= 0 ? lineItems[sourceIdx] : null;
  const sourceBalance = sourceItem ? num(sourceItem.amount, 0) : 0;

  const canCommit =
    parsedAmount > 0 &&
    (mode === "add" || (mode === "move" && sourceIdx >= 0 && parsedAmount <= sourceBalance));

  function handleCommit() {
    if (!canCommit) return;
    if (mode === "add") onCommit({ targetIdxAmountDelta: parsedAmount });
    else onCommit({ targetIdxAmountDelta: parsedAmount, sourceIdx });
  }

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md space-y-5 rounded-[24px] border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-sky-600">Budget Adjustment</div>
          <h3 className="text-xl font-bold text-slate-950 dark:text-slate-50">{mode === "add" ? "Add Funds" : "Move Funds"}</h3>
          <p className="mt-1 text-sm text-slate-500">
            Target: <span className="font-medium text-slate-800 dark:text-slate-200">{String(target.label || target.id || "Line item")}</span>
            {" · "}Current: <span className="font-medium">{currency(num(target.amount, 0))}</span>
          </p>
        </div>

        <div>
          <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Funding source</div>
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              className={["rounded-lg px-4 py-2 text-sm font-semibold transition", mode === "add" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"].join(" ")}
              onClick={() => setMode("add")}
            >
              Add new funds
            </button>
            <button
              type="button"
              className={["rounded-lg px-4 py-2 text-sm font-semibold transition", mode === "move" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"].join(" ")}
              onClick={() => { setMode("move"); setSourceIdx(-1); }}
            >
              Move from line item
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {mode === "add"
              ? "New funds increase this line item and the grant total."
              : "Moves budget between line items. Grant total stays the same."}
          </p>
        </div>

        {mode === "move" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Source line item</label>
            <select
              className="select w-full"
              value={sourceIdx >= 0 ? String(sourceIdx) : ""}
              onChange={(e) => setSourceIdx(e.currentTarget.value === "" ? -1 : Number(e.currentTarget.value))}
            >
              <option value="">Select source…</option>
              {lineItems.map((li: any, idx: number) => {
                if (idx === targetIdx) return null;
                const liAmount = num(li.amount, 0);
                return (
                  <option key={li.id ?? idx} value={String(idx)} disabled={liAmount <= 0}>
                    {String(li.label || li.id || `Item ${idx + 1}`)} — {currency(liAmount)}
                  </option>
                );
              })}
            </select>
            {sourceItem && (
              <p className="mt-1 text-xs text-slate-500">
                Available to move: <span className="font-medium text-slate-800">{currency(sourceBalance)}</span>
              </p>
            )}
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Amount ($)</label>
          <input
            type="number"
            min={0}
            max={mode === "move" && sourceItem ? sourceBalance : undefined}
            step={1}
            className="input w-full"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.currentTarget.value)}
          />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary btn-sm" disabled={!canCommit} onClick={handleCommit}>
            {mode === "add" ? "Add Funds" : "Move Funds"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SpendCapModal({
  lineItem,
  num,
  onCommit,
  onClose,
}: {
  lineItem: any;
  num: (n: unknown, fallback?: number) => number;
  onCommit: (patch: { capEnabled: boolean; perCustomerCap: number | null }) => void;
  onClose: () => void;
}) {
  const [enabled, setEnabled] = useState(!!lineItem?.capEnabled);
  const [value, setValue] = useState(lineItem?.perCustomerCap == null ? "" : String(num(lineItem.perCustomerCap, 0)));

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md space-y-5 rounded-[24px] border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-sky-600">Line Item Cap</div>
          <h3 className="text-xl font-bold text-slate-950 dark:text-slate-50">Edit Spend Cap</h3>
          <p className="mt-1 text-sm text-slate-500">
            Configure the per-customer cap for <span className="font-medium text-slate-800 dark:text-slate-200">{String(lineItem?.label || lineItem?.id || "Line item")}</span>.
          </p>
        </div>

        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-sky-600" checked={enabled} onChange={(e) => setEnabled(e.currentTarget.checked)} />
          <span className="text-sm font-medium text-slate-700">Enable per-customer cap</span>
        </label>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Cap amount ($)</label>
          <input type="number" min={0} step={1} disabled={!enabled} className="input w-full" placeholder="No limit" value={value} onChange={(e) => setValue(e.currentTarget.value)} />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onCommit({ capEnabled: enabled, perCustomerCap: enabled ? (value === "" ? null : Number(value)) : null })}
          >
            Save Cap
          </button>
        </div>
      </div>
    </div>
  );
}

type SplitMode = "none" | "fixed" | "monthly" | "quarterly" | "custom";
type RollForward = "none" | "rollToNext" | "rollToEnd" | "rebalanceFuture" | "manual";

const SPLIT_MODES: Array<{ value: SplitMode; label: string }> = [
  { value: "none", label: "None" },
  { value: "fixed", label: "Fixed" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "custom", label: "Custom" },
];

const ROLL_FORWARD_OPTIONS: Array<{ value: RollForward; label: string }> = [
  { value: "none", label: "No adjustment" },
  { value: "rollToNext", label: "Roll to next" },
  { value: "rollToEnd", label: "Roll to final" },
  { value: "rebalanceFuture", label: "Rebalance future" },
  { value: "manual", label: "Manual review" },
];

function moneyCents(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function moneyFromCents(value: number) {
  return value / 100;
}

function isoDate(value: unknown) {
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return "";
}

function monthEnd(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).toISOString().slice(0, 10);
}

function generateSplitGoals(mode: SplitMode, amount: number, startDate: string, endDate: string) {
  if (mode !== "monthly" && mode !== "quarterly") return [];
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  if (!startDate || !endDate || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
  const step = mode === "monthly" ? 1 : 3;
  const periods: Array<{ startDate: string; endDate: string }> = [];
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const finalCursor = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  while (cursor <= finalCursor && periods.length < 240) {
    const periodStart = cursor.toISOString().slice(0, 10) < startDate ? startDate : cursor.toISOString().slice(0, 10);
    const rawEnd = monthEnd(cursor.getUTCFullYear(), cursor.getUTCMonth() + step - 1);
    const periodEnd = rawEnd > endDate ? endDate : rawEnd;
    periods.push({ startDate: periodStart, endDate: periodEnd });
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + step, 1));
  }
  const totalCents = moneyCents(amount);
  const base = periods.length ? Math.trunc(totalCents / periods.length) : 0;
  let remainder = totalCents - base * periods.length;
  return periods.map((period, index) => {
    const extra = remainder > 0 ? 1 : remainder < 0 ? -1 : 0;
    remainder -= extra;
    const goalAmount = moneyFromCents(base + extra);
    return {
      id: `${mode}_${period.startDate}_${period.endDate}`,
      label: mode === "monthly" ? period.startDate.slice(0, 7) : `Q${index + 1}`,
      ...period,
      amount: goalAmount,
      spent: 0,
      projected: 0,
      balance: goalAmount,
      projectedBalance: goalAmount,
    };
  });
}

function normalizeSplitGoalsForLineItem(lineItem: any, num: (n: unknown, fallback?: number) => number) {
  const mode = (["fixed", "monthly", "quarterly", "custom"].includes(String(lineItem?.splitMode)) ? lineItem.splitMode : "none") as SplitMode;
  const amount = num(lineItem?.amount, 0);
  const splitStartDate = isoDate(lineItem?.splitStartDate);
  const splitEndDate = isoDate(lineItem?.splitEndDate);
  const rawGoals = Array.isArray(lineItem?.splitGoals) ? lineItem.splitGoals : [];
  const goals = rawGoals.map((goal: any, index: number) => {
    const planned = num(goal?.amount, 0);
    const spent = num(goal?.spent, 0);
    const projected = num(goal?.projected, 0);
    return {
      ...goal,
      id: String(goal?.id || `split_${index + 1}`),
      label: String(goal?.label || `Cycle ${index + 1}`),
      startDate: isoDate(goal?.startDate),
      endDate: isoDate(goal?.endDate),
      amount: planned,
      spent,
      projected,
      balance: moneyFromCents(moneyCents(planned) - moneyCents(spent)),
      projectedBalance: moneyFromCents(moneyCents(planned) - moneyCents(spent) - moneyCents(projected)),
    };
  });
  const splitTotal = moneyFromCents(goals.reduce((sum, goal) => sum + moneyCents(goal.amount), 0));
  const variance = moneyFromCents(moneyCents(amount) - moneyCents(splitTotal));
  const needsWarning = mode !== "none" && goals.length > 0 && Math.abs(moneyCents(variance)) > 0;
  return {
    ...lineItem,
    splitMode: mode,
    rollForward: (["rollToNext", "rollToEnd", "rebalanceFuture", "manual"].includes(String(lineItem?.rollForward)) ? lineItem.rollForward : "none") as RollForward,
    splitStartDate: splitStartDate || null,
    splitEndDate: splitEndDate || null,
    splitGoals: mode === "none" ? [] : goals,
    breakdownValidation: {
      status: needsWarning ? "warning" : "ok",
      splitTotal,
      variance,
      ...(needsWarning ? { message: "Split goal total does not match the line item budget." } : {}),
    },
  };
}

function SplitConfigModal({
  lineItem,
  num,
  currency,
  editing,
  onCommit,
  onClose,
}: {
  lineItem: any;
  num: (n: unknown, fallback?: number) => number;
  currency: (n: number) => string;
  editing: boolean;
  onCommit: (patch: Partial<any>) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(() => normalizeSplitGoalsForLineItem(lineItem || {}, num));
  const amount = num(draft.amount, num(lineItem?.amount, 0));
  const splitTotal = moneyFromCents((draft.splitGoals || []).reduce((sum: number, goal: any) => sum + moneyCents(goal.amount), 0));
  const variance = moneyFromCents(moneyCents(amount) - moneyCents(splitTotal));
  const hasWarning = draft.splitMode !== "none" && (draft.splitGoals || []).length > 0 && Math.abs(moneyCents(variance)) > 0;

  const setMode = (mode: SplitMode) => {
    setDraft((prev: any) => {
      const next = { ...prev, splitMode: mode };
      if (mode === "none") next.splitGoals = [];
      if ((mode === "monthly" || mode === "quarterly") && prev.splitStartDate && prev.splitEndDate) {
        next.splitGoals = generateSplitGoals(mode, amount, prev.splitStartDate, prev.splitEndDate);
      }
      return normalizeSplitGoalsForLineItem(next, num);
    });
  };

  const regenerate = () => {
    setDraft((prev: any) => {
      const goals = generateSplitGoals(prev.splitMode, amount, String(prev.splitStartDate || ""), String(prev.splitEndDate || ""));
      return normalizeSplitGoalsForLineItem({ ...prev, splitGoals: goals }, num);
    });
  };

  const updateGoal = (index: number, patch: Record<string, unknown>) => {
    setDraft((prev: any) => {
      const splitGoals = [...(prev.splitGoals || [])];
      splitGoals[index] = { ...splitGoals[index], ...patch };
      return normalizeSplitGoalsForLineItem({ ...prev, splitGoals }, num);
    });
  };

  const addGoal = () => {
    setDraft((prev: any) => normalizeSplitGoalsForLineItem({
      ...prev,
      splitMode: prev.splitMode === "none" ? "custom" : prev.splitMode,
      splitGoals: [
        ...(prev.splitGoals || []),
        { id: `split_${Date.now().toString(36)}`, label: "New cycle", startDate: "", endDate: "", amount: 0, spent: 0, projected: 0 },
      ],
    }, num));
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="text-xs font-semibold uppercase tracking-wide text-sky-600">Line Item Config</div>
          <h3 className="mt-1 text-xl font-bold text-slate-950 dark:text-slate-50">{String(lineItem?.label || lineItem?.id || "Line item")}</h3>
          <p className="mt-1 text-sm text-slate-500">Line item total remains authoritative: <span className="font-semibold text-slate-800">{currency(amount)}</span>.</p>
        </div>

        <div className="max-h-[62vh] space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid gap-3 md:grid-cols-4">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Split mode</span>
              <select className="input w-full" disabled={!editing} value={draft.splitMode} onChange={(e) => setMode(e.currentTarget.value as SplitMode)}>
                {SPLIT_MODES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Roll-forward</span>
              <select className="input w-full" disabled={!editing} value={draft.rollForward} onChange={(e) => setDraft((prev: any) => ({ ...prev, rollForward: e.currentTarget.value as RollForward }))}>
                {ROLL_FORWARD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Start</span>
              <input className="input w-full" type="date" disabled={!editing} value={draft.splitStartDate || ""} onChange={(e) => setDraft((prev: any) => normalizeSplitGoalsForLineItem({ ...prev, splitStartDate: e.currentTarget.value }, num))} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">End</span>
              <input className="input w-full" type="date" disabled={!editing} value={draft.splitEndDate || ""} onChange={(e) => setDraft((prev: any) => normalizeSplitGoalsForLineItem({ ...prev, splitEndDate: e.currentTarget.value }, num))} />
            </label>
          </div>

          <div className={`rounded-lg border px-4 py-3 text-sm ${hasWarning ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
            Planned cycles total {currency(splitTotal)}. Variance from line item total: <span className="font-semibold">{currency(variance)}</span>.
          </div>

          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Digest / Display</div>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                ["appearInDigest", "Appear in digest"],
                ["showLineItemTotal", "Show line item total"],
                ["showSplitGoals", "Show split goals"],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 accent-sky-600"
                    disabled={!editing}
                    checked={(draft.display?.[key] ?? true) !== false}
                    onChange={(e) => setDraft((prev: any) => ({
                      ...prev,
                      display: { ...(prev.display || {}), [key]: e.currentTarget.checked },
                    }))}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Display as</span>
                <select
                  className="input w-full"
                  disabled={!editing}
                  value={draft.display?.displayAs || "nested"}
                  onChange={(e) => setDraft((prev: any) => ({ ...prev, display: { ...(prev.display || {}), displayAs: e.currentTarget.value } }))}
                >
                  <option value="nested">Nested under grant</option>
                  <option value="main">Main row/card</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Main level</span>
                <select
                  className="input w-full"
                  disabled={!editing}
                  value={draft.display?.mainDisplayLevel || "grant"}
                  onChange={(e) => setDraft((prev: any) => ({ ...prev, display: { ...(prev.display || {}), mainDisplayLevel: e.currentTarget.value } }))}
                >
                  <option value="grant">Grant</option>
                  <option value="lineItem">Line item</option>
                  <option value="split">Split goal / cycle</option>
                </select>
              </label>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="table text-sm">
              <thead>
                <tr>
                  <th>Cycle</th>
                  <th>Start</th>
                  <th>End</th>
                  <th className="text-right">Goal</th>
                  <th className="text-right">Spent</th>
                  <th className="text-right">Projected</th>
                  {editing && <th />}
                </tr>
              </thead>
              <tbody>
                {(draft.splitGoals || []).length === 0 ? (
                  <tr><td colSpan={editing ? 7 : 6} className="text-slate-400">No split goals configured.</td></tr>
                ) : (
                  (draft.splitGoals || []).map((goal: any, index: number) => (
                    <tr key={goal.id || index}>
                      <td>{editing ? <input className="input text-sm" value={goal.label || ""} onChange={(e) => updateGoal(index, { label: e.currentTarget.value })} /> : String(goal.label || `Cycle ${index + 1}`)}</td>
                      <td>{editing ? <input className="input text-sm" type="date" value={goal.startDate || ""} onChange={(e) => updateGoal(index, { startDate: e.currentTarget.value })} /> : (goal.startDate || "TBD")}</td>
                      <td>{editing ? <input className="input text-sm" type="date" value={goal.endDate || ""} onChange={(e) => updateGoal(index, { endDate: e.currentTarget.value })} /> : (goal.endDate || "TBD")}</td>
                      <td className="text-right">{editing ? <input className="input w-28 text-right text-sm" type="number" value={num(goal.amount, 0)} onChange={(e) => updateGoal(index, { amount: Number(e.currentTarget.value) })} /> : currency(num(goal.amount, 0))}</td>
                      <td className="text-right text-slate-700">{currency(num(goal.spent, 0))}</td>
                      <td className="text-right text-slate-700">{currency(num(goal.projected, 0))}</td>
                      {editing && <td className="text-right"><button type="button" className="btn btn-ghost btn-xs text-red-500" onClick={() => setDraft((prev: any) => normalizeSplitGoalsForLineItem({ ...prev, splitGoals: (prev.splitGoals || []).filter((_: any, j: number) => j !== index) }, num))}>Delete</button></td>}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {editing && (
            <div className="flex flex-wrap items-center gap-2">
              {(draft.splitMode === "monthly" || draft.splitMode === "quarterly") && <button type="button" className="btn btn-secondary btn-sm" onClick={regenerate}>Regenerate Cycles</button>}
              <button type="button" className="btn btn-secondary btn-sm" onClick={addGoal}>+ Custom Cycle</button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>{editing ? "Cancel" : "Close"}</button>
          {editing && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onCommit(normalizeSplitGoalsForLineItem(draft, num))}
            >
              Apply Config
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function BudgetActivityTab({
  editing,
  model,
  setModel,
  derived,
  currency,
  recomputeBudgetTotals,
  num,
  grantId,
  drawsDownBudget = true,
}: {
  editing: boolean;
  model: Record<string, any>;
  setModel: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  derived: { total: number; spent: number; projected: number; balance: number; projectedBalance: number; lineItems: any[] };
  currency: (n: number) => string;
  recomputeBudgetTotals: (b: any) => any;
  num: (n: unknown, fallback?: number) => number;
  grantId?: string;
  drawsDownBudget?: boolean;
}) {
  const activityQ = useGrantActivity(grantId ?? "", 2000);
  const allActivity: any[] = useMemo(() => (Array.isArray(activityQ.data) ? activityQ.data : []), [activityQ.data]);
  const { data: enrollments = [] } = useEnrollments(
    grantId ? { grantId, limit: 1000 } : undefined,
    { enabled: !!grantId && !editing },
  );
  const { data: users = [] } = useUsers({ status: "all", limit: 500 });

  const [expandedId, setExpandedId] = useState<string | "all" | null>("all");
  const [activityMode, setActivityMode] = useState<ActivityMode>("all");
  const [fundsState, setFundsState] = useState<{ index: number; mode: "add" | "move" } | null>(null);
  const [spendCapIdx, setSpendCapIdx] = useState<number | null>(null);
  const [splitConfigIdx, setSplitConfigIdx] = useState<number | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<SpendRow | null>(null);
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [lineItemSort, setLineItemSort] = useState<{ key: LineItemSortKey; direction: SortDirection }>({ key: "label", direction: "asc" });
  const toggleLineItemSort = useCallback((key: LineItemSortKey) => {
    setLineItemSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

  const budget = useMemo(() => {
    const b = JSON.parse(JSON.stringify(model.budget ?? {}));
    b.total = num(b.total, num(b.startAmount, derived.total));
    b.totals = b.totals || {};
    b.totals.spent = num(b.totals.spent, derived.spent);
    b.totals.projected = num(b.totals.projected, derived.projected);
    b.lineItems = Array.isArray(b.lineItems) ? b.lineItems : [];
    return recomputeBudgetTotals(b);
  }, [derived.projected, derived.spent, derived.total, model.budget, num, recomputeBudgetTotals]);

  const commit = (next: any) => {
    const recomputed = recomputeBudgetTotals(next);
    setModel((m) => ({ ...m, budget: recomputed }));
  };

  const setTotal = (val: number) => {
    const next = JSON.parse(JSON.stringify(budget));
    next.total = Math.max(0, num(val));
    commit(next);
  };

  const updateLineItem = (index: number, patch: Partial<any>) => {
    const next = JSON.parse(JSON.stringify(budget));
    const li = next.lineItems[index] ?? {};
    const after = { ...li, ...patch };
    after.spent = num(after.spent, 0);
    after.projected = num(after.projected, 0);
    next.lineItems[index] = after;
    commit(next);
  };

  const addLineItem = () => {
    const next = JSON.parse(JSON.stringify(budget));
    next.lineItems.push({ id: `li_${Date.now().toString(36)}`, label: "New Item", amount: 0, spent: 0, projected: 0, locked: false, type: null });
    commit(next);
  };

  const removeLineItem = (index: number) => {
    const next = JSON.parse(JSON.stringify(budget));
    next.lineItems.splice(index, 1);
    commit(next);
  };

  const updateLineItemConfig = (index: number, patch: Partial<any>) => {
    updateLineItem(index, patch);
    setSplitConfigIdx(null);
  };

  const handleFundsCommit = ({ targetIdxAmountDelta, sourceIdx }: { targetIdxAmountDelta: number; sourceIdx?: number }) => {
    if (!fundsState) return;
    const next = JSON.parse(JSON.stringify(budget));
    next.lineItems[fundsState.index].amount = num(next.lineItems[fundsState.index].amount, 0) + targetIdxAmountDelta;
    if (sourceIdx !== undefined && sourceIdx >= 0) {
      next.lineItems[sourceIdx].amount = Math.max(0, num(next.lineItems[sourceIdx].amount, 0) - targetIdxAmountDelta);
    } else {
      next.total = num(next.total, 0) + targetIdxAmountDelta;
    }
    commit(next);
    setFundsState(null);
  };

  const total = num(budget.total, 0);
  const spent = num(budget.totals?.spent, 0);
  const projected = num(budget.totals?.projected, 0);
  const projectedSpend = spent + projected;
  const projectedBalance = total - projectedSpend;
  const spentBalance = total - spent;

  const liTotals = useMemo(() => {
    let liAmount = 0;
    let liSpent = 0;
    let liProjected = 0;
    for (const li of budget.lineItems) {
      liAmount += num(li.amount, 0);
      liSpent += num(li.spent, 0);
      liProjected += num(li.projected, 0);
    }
    return { liAmount, liSpent, liProjected };
  }, [budget.lineItems, num]);

  const sortedLineItems = useMemo(() => {
    return (budget.lineItems as any[])
      .map((li, index) => ({ li, index }))
      .sort((a, b) => {
        const aAmount = num(a.li.amount, 0);
        const bAmount = num(b.li.amount, 0);
        const aSpent = num(a.li.spent, 0);
        const bSpent = num(b.li.spent, 0);
        const aProjectedSpend = aSpent + num(a.li.projected, 0);
        const bProjectedSpend = bSpent + num(b.li.projected, 0);
        const result =
          lineItemSort.key === "label" ? compareText(a.li.label || a.li.id, b.li.label || b.li.id)
          : lineItemSort.key === "type" ? compareText(normalizeBudgetTypeLabel(a.li.type, a.li.label), normalizeBudgetTypeLabel(b.li.type, b.li.label))
          : lineItemSort.key === "budget" ? aAmount - bAmount
          : lineItemSort.key === "spent" ? aSpent - bSpent
          : lineItemSort.key === "balance" ? (aAmount - aSpent) - (bAmount - bSpent)
          : lineItemSort.key === "projectedSpend" ? aProjectedSpend - bProjectedSpend
          : lineItemSort.key === "available" ? (aAmount - aProjectedSpend) - (bAmount - bProjectedSpend)
          : Number(!!a.li.locked) - Number(!!b.li.locked) || Number(!!a.li.capEnabled) - Number(!!b.li.capEnabled);
        return applyDirection(result, lineItemSort.direction) || a.index - b.index;
      });
  }, [budget.lineItems, lineItemSort.direction, lineItemSort.key, num]);

  const enrollmentInfoById = useMemo(() => {
    const map = new Map<string, { customerId: string; customerLabel: string }>();
    for (const enrollment of enrollments as any[]) {
      const id = String(enrollment?.id || "").trim();
      if (!id) continue;
      const customerId = String(enrollment?.customerId || enrollment?.clientId || "").trim();
      const customerLabel =
        String(
          enrollment?.clientName ||
          enrollment?.customerName ||
          enrollment?.fullName ||
          enrollment?.name ||
          customerId ||
          "",
        ).trim() || id;
      map.set(id, { customerId, customerLabel });
    }
    return map;
  }, [enrollments]);

  const enrollmentNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const [id, info] of enrollmentInfoById.entries()) map.set(id, info.customerLabel);
    return map;
  }, [enrollmentInfoById]);

  const rentCertDueByEnrollmentTarget = useMemo(() => {
    const map = new Map<string, string>();
    for (const enrollment of enrollments as any[]) {
      const enrollmentId = String(enrollment?.id || "").trim();
      if (!enrollmentId) continue;
      const dues = computeRentCertDues(Array.isArray(enrollment?.payments) ? enrollment.payments : [], {
        enrollmentId,
        enrollmentLabel: String(enrollment?.grantName || enrollment?.name || enrollmentId),
      });
      for (const due of dues) {
        map.set(`${enrollmentId}:${due.targetPaymentDate}`, due.dueDate);
      }
    }
    return map;
  }, [enrollments]);

  const paymentComplianceByKey = useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    for (const enrollment of enrollments as any[]) {
      const enrollmentId = String(enrollment?.id || "").trim();
      if (!enrollmentId) continue;
      const payments = Array.isArray(enrollment?.payments) ? enrollment.payments : [];
      for (const payment of payments) {
        const paymentId = String(payment?.id || "").trim();
        if (!paymentId) continue;
        const compliance = payment?.compliance && typeof payment.compliance === "object"
          ? payment.compliance as Record<string, unknown>
          : null;
        if (compliance) map.set(`${enrollmentId}:${paymentId}`, compliance);
      }
    }
    return map;
  }, [enrollments]);

  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of users as any[]) {
      const uid = String(user?.uid || "").trim();
      if (!uid) continue;
      map.set(uid, String(user?.displayName || user?.email || uid).trim());
    }
    return map;
  }, [users]);

  const customerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const info of enrollmentInfoById.values()) {
      if (info.customerId) map.set(info.customerId, info.customerLabel);
    }
    for (const item of allActivity) {
      const customerId = String(item?.customerId || "").trim();
      if (!customerId || map.has(customerId)) continue;
      const label = String(item?.customerName || item?.customerNameAtSpend || customerId).trim() || customerId;
      map.set(customerId, label);
    }
    return map;
  }, [allActivity, enrollmentInfoById]);

  const grantNameById = useMemo(() => {
    const map = new Map<string, string>();
    if (grantId) map.set(grantId, String(model?.name || grantId));
    return map;
  }, [grantId, model?.name]);

  const lineItemLookup = useMemo(() => {
    const map = new Map<string, { grantName: string; lineItemLabel: string }>();
    const grantName = String(model?.name || grantId || "Grant");
    for (const li of budget.lineItems as any[]) {
      const lineItemId = String(li?.id || "").trim();
      if (!lineItemId) continue;
      map.set(`${grantId || ""}:${lineItemId}`, {
        grantName,
        lineItemLabel: String(li?.label || lineItemId),
      });
    }
    return map;
  }, [budget.lineItems, grantId, model?.name]);

  const lineItemTypeByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const li of budget.lineItems as any[]) {
      const lineItemId = String(li?.id || "").trim();
      if (!lineItemId) continue;
      map.set(`${grantId || ""}:${lineItemId}`, normalizeBudgetTypeLabel(li?.type, li?.label));
    }
    return map;
  }, [budget.lineItems, grantId]);

  const sandboxLineItems = useMemo((): GrantBudgetSandboxLineItem[] => {
    return (budget.lineItems as any[])
      .map((li) => {
        const id = String(li?.id || "").trim();
        if (!id) return null;
        return {
          id,
          label: String(li?.label || id),
          typeLabel: normalizeBudgetTypeLabel(li?.type, li?.label),
          budgetCents: Math.round(Number(li?.amount || 0) * 100),
        };
      })
      .filter((item): item is GrantBudgetSandboxLineItem => !!item);
  }, [budget.lineItems]);

  const resolveUserLabel = useCallback((value: unknown) => {
    if (!value) return "";
    if (typeof value === "string") {
      const raw = value.trim();
      return userNameById.get(raw) || raw;
    }
    if (typeof value === "object") {
      const raw = value as Record<string, unknown>;
      const uid = String(raw.uid || raw.byUid || "").trim();
      const name = String(raw.name || "").trim();
      const email = String(raw.email || "").trim();
      return name || (uid ? userNameById.get(uid) || uid : "") || email;
    }
    return "";
  }, [userNameById]);

  const activityRows = useMemo(() => {
    const rows: GrantActivityRow[] = [];
    const rentCertDueFor = (enrollmentId: string, paymentDate: string) => (
      enrollmentId && paymentDate ? rentCertDueByEnrollmentTarget.get(`${enrollmentId}:${paymentDate}`) || "" : ""
    );
    const budgetTypeFor = (raw: Record<string, any>, item?: Record<string, any>) => {
      const lineItemId = String(raw?.lineItemId || item?.lineItemId || "").trim();
      const key = `${String(raw?.grantId || item?.grantId || grantId || "")}:${lineItemId}`;
      const lookup = lineItemId ? lineItemLookup.get(key) : null;
      return normalizeBudgetTypeLabel(item?.type ?? raw?.type ?? lineItemTypeByKey.get(key), lookup?.lineItemLabel || raw?.lineItemLabelAtSpend || lineItemId);
    };

    for (const raw of allActivity) {
      if (raw?.kind === "projection" || raw?.sourceType === "paymentQueue") {
        const item = raw?.paymentQueueItem && typeof raw.paymentQueueItem === "object" ? raw.paymentQueueItem : raw;
        const customerId = String(raw?.customerId || item?.customerId || "").trim();
        const customerLabel = String(
          raw?.customerName ||
            item?.customer ||
            customerNameById.get(customerId) ||
            customerId ||
            "",
        ).trim();
        const noteText = String(item?.comment || item?.note || item?.notes || item?.purpose || "").trim();
        const date = dateIso10(raw?.ts || item?.dueDate || item?.createdAt || item?.postedAt);
        const rentCertDueOn = rentCertDueFor(String(raw?.enrollmentId || item?.enrollmentId || "").trim(), date);
        const userLabel = resolveUserLabel(raw?.by || item?.postedBy || item?.reopenedBy);
        const queueSource = String(item?.source || "").toLowerCase();
        const rowKind =
          queueSource === "invoice" ? "queue-invoice"
          : queueSource === "credit-card" ? "queue-credit-card"
          : "queue-projection";
        const budgetTypeLabel = rowKind === "queue-projection"
          ? paymentTypeLabel({ type: item?.type, note: item?.note })
          : budgetTypeFor(raw, item);
        const sourceLabel =
          queueSource === "invoice" ? "Invoice"
          : queueSource === "credit-card" ? "Credit Card"
          : "Enrollment";

        rows.push({
          id: String(raw?.id || `queue:${item?.id || `${item?.enrollmentId || "projection"}:${item?.paymentId || date}`}`),
          kind: rowKind,
          sourceLabel,
          title: String(item?.merchant || item?.descriptor || noteText || "Projected payment"),
          subtitle: String(raw?.paymentId || item?.paymentId || item?.submissionId || item?.id || ""),
          date,
          month: monthFromDate(item?.month || date),
          amountCents: Math.round(Math.max(0, Number(raw?.amount ?? item?.amount ?? 0)) * 100),
          completed: false,
          workflowState: "open",
          workflowReason: "Projected spend, not yet paid",
          grantId: String(raw?.grantId || item?.grantId || grantId || ""),
          lineItemId: String(raw?.lineItemId || item?.lineItemId || ""),
          customerId,
          creditCardId: String(item?.creditCardId || ""),
          creditCardName: String(item?.card || ""),
          cardBucket: String(item?.cardBucket || ""),
          taskToken: "",
          paymentQueueItem: item,
          customerLabel,
          userLabel,
          noteText,
          rentCertDueOn,
          budgetTypeLabel,
          displayType: "Projected",
          sourceType: "projected",
          complianceStatus: "none" as ComplianceStatus,
          searchText: normalizeText([noteText, customerLabel, customerId, userLabel, budgetTypeLabel, rentCertDueOn, item?.merchant, item?.paymentId, item?.id].join(" ")),
        });
        continue;
      }

      const enrollmentId = String(raw?.enrollmentId || "").trim();
      const enrollmentInfo = enrollmentInfoById.get(enrollmentId);
      const customerId = String(raw?.customerId || enrollmentInfo?.customerId || "").trim();
      const customerLabel = String(
        raw?.customerNameAtSpend ||
          raw?.customerName ||
          enrollmentInfo?.customerLabel ||
          customerNameById.get(customerId) ||
          customerId ||
          "",
      ).trim();
      const noteText = String(raw?.comment || "").trim() || paymentNoteMeta(raw?.note);
      const date = dateIso10(raw?.ts || raw?.date);
      const rentCertDueOn = rentCertDueFor(enrollmentId, date);
      const isReversal = !!raw?.reversalOf || Number(raw?.amount || 0) < 0;
      const userLabel = resolveUserLabel(raw?.by);
      const paymentId = String(raw?.paymentId || "").trim();
      const paymentCompliance = paymentComplianceByKey.get(`${enrollmentId}:${paymentId}`) || null;
      const rawCompliance = raw?.compliance && typeof raw.compliance === "object" ? raw.compliance as Record<string, unknown> : null;
      const ledgerCompliance =
        raw?.ledgerEntry && typeof raw.ledgerEntry === "object" &&
        (raw.ledgerEntry as Record<string, unknown>).compliance &&
        typeof (raw.ledgerEntry as Record<string, unknown>).compliance === "object"
          ? (raw.ledgerEntry as Record<string, unknown>).compliance as Record<string, unknown>
          : null;
      const compliance = paymentCompliance || rawCompliance || ledgerCompliance;
      const hmis = !!(compliance?.hmisComplete);
      const cw = !!(compliance?.caseworthyComplete);
      const complianceStatus: ComplianceStatus = isReversal ? "complete" : (hmis && cw ? "complete" : (hmis || cw ? "partial" : "none"));
      const budgetTypeLabel = paymentTypeLabel({ type: raw?.type, note: raw?.note });

      rows.push({
        id: String(raw?.id || `ledger:${enrollmentId}:${raw?.paymentId || date}`),
        kind: "grant-ledger",
        sourceLabel: "Enrollment",
        title: noteText || (isReversal ? "Payment reversal" : "Posted payment"),
        subtitle: String(paymentId || raw?.id || ""),
        date,
        month: monthFromDate(date),
        amountCents: Math.round(Number(raw?.amount || 0) * 100),
        completed: true,
        workflowState: "closed",
        workflowReason: isReversal ? "Reversal" : "Posted grant payment",
        grantId: String(raw?.grantId || grantId || ""),
        lineItemId: String(raw?.lineItemId || ""),
        customerId,
        creditCardId: "",
        creditCardName: "",
        cardBucket: "",
        taskToken: "",
        ledgerEntry: {
          ...((raw?.ledgerEntry && typeof raw.ledgerEntry === "object" ? raw.ledgerEntry : raw) as Record<string, unknown>),
          customerId,
          dueDate: raw?.ts || raw?.date || null,
          date,
        },
        customerLabel,
        userLabel,
        noteText,
        rentCertDueOn,
        budgetTypeLabel,
        displayType: isReversal ? "Reversal" : "Paid",
        sourceType: "paid",
        complianceStatus,
        searchText: normalizeText([noteText, customerLabel, customerId, userLabel, budgetTypeLabel, rentCertDueOn, paymentId, raw?.id].join(" ")),
      });
    }

    rows.sort((a, b) => {
      if (a.date !== b.date) return String(b.date).localeCompare(String(a.date));
      return Math.abs(b.amountCents) - Math.abs(a.amountCents);
    });

    return rows;
  }, [allActivity, customerNameById, enrollmentInfoById, grantId, lineItemLookup, lineItemTypeByKey, paymentComplianceByKey, rentCertDueByEnrollmentTarget, resolveUserLabel]);

  const activityByLineItem = useMemo(() => {
    const map = new Map<string, GrantActivityRow[]>();
    for (const item of activityRows) {
      const lineItemId = String(item.lineItemId || "").trim();
      if (!lineItemId) continue;
      const current = map.get(lineItemId);
      if (current) current.push(item);
      else map.set(lineItemId, [item]);
    }
    return map;
  }, [activityRows]);

  const sandboxSeedRows = useMemo((): GrantBudgetSandboxSeedRow[] => {
    return activityRows.map((row) => ({
      sourceId: row.id,
      sourceKind: row.kind,
      grantId: row.grantId,
      lineItemId: row.lineItemId,
      date: row.date,
      amountCents: row.amountCents,
      customerLabel: row.customerLabel,
      budgetTypeLabel: row.budgetTypeLabel,
      noteText: row.noteText || row.title || "",
      rentCertDueOn: row.rentCertDueOn,
      statusLabel: row.displayType,
    }));
  }, [activityRows]);

  const activityById = useMemo(() => {
    const map = new Map<string, GrantActivityRow>();
    for (const row of activityRows) map.set(row.id, row);
    return map;
  }, [activityRows]);

  const openSandboxPayment = useCallback((sourceId: string) => {
    const row = activityById.get(sourceId);
    if (row) setSelectedActivity(row);
  }, [activityById]);

  const resolveCustomer = (row: any) =>
    String(
      row?.customerNameAtSpend ||
      row?.customerName ||
      enrollmentNameById.get(String(row?.enrollmentId || "").trim()) ||
      row?.customerId ||
      "—",
    );

  const resolveUser = (row: any) => {
    const raw = String(row?.by || "").trim();
    if (!raw) return "—";
    return userNameById.get(raw) || raw;
  };

  void resolveCustomer;
  void resolveUser;
  const activityForLineItem = (liId: string) => activityByLineItem.get(liId) || [];
  const refreshActivityData = () => {
    void activityQ.refetch();
  };
  const toggleLineItemActivity = (lineItemId: string, lineItem: any) => {
    const nextExpandedId = expandedId === lineItemId ? null : lineItemId;
    setExpandedId(nextExpandedId);
    if (nextExpandedId && !isRentalAssistanceLineItem(lineItem)) refreshActivityData();
  };
  const colCount = editing ? 11 : 10;
  const amountLabel = drawsDownBudget ? "Budget" : "Reference";
  const totalLabel = drawsDownBudget ? "Budget" : "Reference Total";
  const balanceLabel = drawsDownBudget ? "Balance" : "Reference Remaining";
  const availableLabel = drawsDownBudget ? "Available" : "Reference Available";
  const lineHeaderButton = (key: LineItemSortKey, label: string, className = "") => (
    <button type="button" className={`w-full text-left ${className}`} onClick={() => toggleLineItemSort(key)}>
      {label}
    </button>
  );

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {drawsDownBudget ? (
          <div className="min-w-[280px] flex-1">
            <SpendBar total={total} spent={spent} projected={projected} currency={currency} />
          </div>
        ) : (
          <div className="min-w-[280px] flex-1 rounded-[14px] border border-indigo-200 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-900 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-100">
            Billing mode: line-item amounts are reference/category values for reporting. They are not grant budget caps.
          </div>
        )}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setSandboxOpen(true)}
          disabled={!sandboxSeedRows.length}
          title={sandboxSeedRows.length ? tip("Open a local scratch workspace for budget projections.") : tip("No activity rows are available for sandboxing yet.")}
        >
          Open Sandbox
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
        {[
          { label: totalLabel, value: total, editable: true, colorFn: null, title: tip(drawsDownBudget ? "Total planned budget for this grant." : "Optional reference total for billing/reporting. This is not a hard cap.") },
          { label: "Spent", value: spent, editable: false, colorFn: null, title: tip("Posted ledger spend across all line items.") },
          { label: balanceLabel, value: spentBalance, editable: false, colorFn: drawsDownBudget ? colorVal : null, title: tip(drawsDownBudget ? "Budget minus posted spend." : "Reference total minus posted spend. This is not availability enforcement.") },
          { label: "Projected Spend", value: projectedSpend, editable: false, colorFn: null, title: tip("Posted spend plus projected obligations.") },
          { label: availableLabel, value: projectedBalance, editable: false, colorFn: drawsDownBudget ? colorVal : null, title: tip(drawsDownBudget ? "Most important number. Budget minus projected spend." : "Reference total minus projected spend. This is not a hard cap.") },
        ].map(({ label, value, editable, colorFn, title }) => (
          <div key={label} className="rounded-[14px] border border-slate-200 px-3 py-2.5" title={title}>
            <div className="mb-1 text-xs text-slate-500">{label}</div>
            {editable && editing ? (
              <input className="input mt-0.5 text-sm font-semibold" type="number" value={budget.total} onChange={(e) => setTotal(Number(e.currentTarget.value))} />
            ) : (
              <div className={`${label === availableLabel ? "text-base font-bold" : "font-semibold"} ${colorFn ? colorFn(value) : "text-slate-900 dark:text-slate-100"}`}>
                {currency(value)}
              </div>
            )}
          </div>
        ))}
      </div>

      {(editing || budget.allocationEnabled) && (
        <div className="rounded-[14px] border border-sky-200 bg-sky-50/60 px-4 py-3 dark:border-sky-800 dark:bg-sky-950/20">
          <div className="flex flex-wrap items-center gap-4">
            {editing ? (
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 accent-sky-600"
                  checked={!!budget.allocationEnabled}
                  onChange={(e) => {
                    const next = JSON.parse(JSON.stringify(budget));
                    next.allocationEnabled = e.currentTarget.checked;
                    commit(next);
                  }}
                />
                <span className="text-sm font-medium text-sky-800 dark:text-sky-200">Client Allocation Tracking</span>
              </label>
            ) : (
              <span className="flex items-center gap-1.5 text-sm font-semibold text-sky-700 dark:text-sky-300">
                <span className="inline-block h-2 w-2 rounded-full bg-sky-500" />
                Client Allocation Mode
              </span>
            )}
            {editing && budget.allocationEnabled && (
              <div className="flex items-center gap-2">
                <label className="whitespace-nowrap text-xs text-slate-500">Grant-level cap / customer ($):</label>
                <input
                  type="number"
                  min={0}
                  placeholder="No cap"
                  className="input w-28 text-sm"
                  value={budget.perCustomerCap ?? ""}
                  onChange={(e) => {
                    const next = JSON.parse(JSON.stringify(budget));
                    next.perCustomerCap = e.currentTarget.value === "" ? null : Number(e.currentTarget.value);
                    commit(next);
                  }}
                />
              </div>
            )}
            {!editing && budget.allocationEnabled && budget.perCustomerCap != null && (
              <span className="text-xs text-slate-600">Cap: <span className="font-semibold">{currency(num(budget.perCustomerCap))}</span> / customer</span>
            )}
          </div>
        </div>
      )}

      {!editing && grantId && activityQ.isLoading && (
        <div className="text-xs italic text-slate-400">Loading grant activity…</div>
      )}

      <div className="table-wrap">
        <table className="table text-sm">
          <thead>
            <tr>
              <th title={tip("Line item label. Expand to review activity tied to this budget bucket.")}>{lineHeaderButton("label", "Label")}</th>
              <th className="w-44" title={tip("Reporting category for grouping line item totals across grants. Blank or N/A leaves it uncategorized.")}>{lineHeaderButton("type", "Type")}</th>
              <th className="text-right" title={tip(drawsDownBudget ? "Planned dollars assigned to this line item." : "Reference amount for billing/reporting. Not a hard cap.")}>{lineHeaderButton("budget", amountLabel, "text-right")}</th>
              <th className="text-right" title={tip("Posted ledger spend recorded against this line item.")}>{lineHeaderButton("spent", "Spent", "text-right")}</th>
              <th className="text-right" title={tip(drawsDownBudget ? "Budget minus posted spend." : "Reference amount minus posted spend. Not enforced as availability.")}>{lineHeaderButton("balance", balanceLabel, "text-right")}</th>
              <th className="text-right" title={tip("Posted spend plus projected obligations.")}>{lineHeaderButton("projectedSpend", "Projected Spend", "text-right")}</th>
              <th className="text-right" title={tip(drawsDownBudget ? "Most important number. Budget minus projected spend." : "Reference amount minus projected spend. Not enforced as a hard cap.")}>{lineHeaderButton("available", availableLabel, "text-right")}</th>
              <th className="w-16" title={tip("Visual spend progress for this line item.")} />
              <th className="w-28" title={tip("Compact status chips for lock and cap settings.")}>{lineHeaderButton("status", "Status", "text-center")}</th>
              {!editing && <th className="w-14 text-right" title={tip("Line item actions.")}>Actions</th>}
              {editing && <th className="w-24" title={tip("Per-customer cap amount when cap is enabled.")}>Cap $</th>}
              {editing && <th />}
            </tr>
          </thead>
          <tbody>
            {budget.lineItems.length === 0 ? (
              <tr>
                <td className="italic text-slate-400" colSpan={colCount}>No line items yet.</td>
              </tr>
            ) : (
              sortedLineItems.flatMap(({ li, index: i }) => {
                const liId = String(li.id ?? `idx_${i}`);
                const liAmount = num(li.amount, 0);
                const liSpent = num(li.spent, 0);
                const liProj = num(li.projected, 0);
                const liProjectedSpend = liSpent + liProj;
                const liProjBal = liAmount - liProjectedSpend;
                const liSpentBal = liAmount - liSpent;
                const isExpanded = expandedId === liId;
                const liActivity = grantId ? activityForLineItem(liId) : [];

                const menuItems: ActionItem[] = [
                  ...(drawsDownBudget
                    ? [
                        {
                          key: "add-funds",
                          label: "Add Funds",
                          onSelect: () => setFundsState({ index: i, mode: "add" }),
                        },
                        {
                          key: "move-funds",
                          label: "Move Funds",
                          onSelect: () => setFundsState({ index: i, mode: "move" }),
                        },
                      ]
                    : []),
                  {
                    key: "view-activity",
                    label: "View Activity",
                    onSelect: () => {
                      setActivityMode("all");
                      setExpandedId(liId);
                      if (!isRentalAssistanceLineItem(li)) refreshActivityData();
                    },
                  },
                  {
                    key: "line-item-config",
                    label: "Line Item Config",
                    onSelect: () => setSplitConfigIdx(i),
                  },
                  {
                    key: "edit-cap",
                    label: "Edit Spend Cap",
                    onSelect: () => setSpendCapIdx(i),
                  },
                  {
                    key: "lock-line-item",
                    label: li.locked ? "Unlock Line Item" : "Lock Line Item",
                    onSelect: () => updateLineItem(i, { locked: !li.locked }),
                  },
                ];

                const row = (
                  <tr key={liId} className={isExpanded ? "bg-sky-50/60 dark:bg-sky-950/20" : "hover:bg-slate-50 dark:hover:bg-slate-800/40"}>
                    <td>
                      {editing ? (
                        <input className="input text-sm" value={li.label ?? ""} onChange={(e) => updateLineItem(i, { label: e.currentTarget.value })} />
                      ) : (
                        <button
                          type="button"
                          className="group inline-flex items-center gap-2 text-left"
                          onClick={() => toggleLineItemActivity(liId, li)}
                          title={isExpanded ? tip("Collapse activity for this line item.") : tip(`Expand ${liActivity.length} activity row${liActivity.length === 1 ? "" : "s"} for this line item.`)}
                        >
                          <span className="text-xs text-slate-400 transition group-hover:text-sky-600">{isExpanded ? "▼" : "▶"}</span>
                          <span className="font-medium text-slate-800 dark:text-slate-200">{li.label ?? li.id}</span>
                          <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                            {liActivity.length}
                          </span>
                        </button>
                      )}
                    </td>
                    <td>
                      {editing ? (
                        <>
                          <input
                            className="input text-sm"
                            list="grant-line-item-type-options"
                            placeholder="N/A"
                            value={lineItemTypeLabel(li.type)}
                            onChange={(e) => updateLineItem(i, { type: normalizeLineItemTypeInput(e.currentTarget.value) })}
                            title={tip("Use a default type or type a new category. Blank, NA, or N/A stores no type.")}
                          />
                          {i === 0 && (
                            <datalist id="grant-line-item-type-options">
                              {DEFAULT_LINE_ITEM_TYPES.map((type) => (
                                <option key={type.id} value={type.label} />
                              ))}
                              <option value="N/A" />
                            </datalist>
                          )}
                        </>
                      ) : (
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                          {normalizeBudgetTypeLabel(li.type, li.label)}
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      {editing ? (
                        <input className="input w-28 text-right text-sm" type="number" value={num(li.amount)} onChange={(e) => updateLineItem(i, { amount: Number(e.currentTarget.value) })} title={tip(drawsDownBudget ? "Edit the planned budget for this line item." : "Edit the reference amount for this billing/reporting category. This is not a hard cap.")} />
                      ) : (
                        <span title={tip(drawsDownBudget ? "Planned dollars assigned to this line item." : "Reference amount for this billing/reporting category. Not a hard cap.")}>{currency(liAmount)}</span>
                      )}
                    </td>
                    <td className="text-right text-slate-700 dark:text-slate-300" title={tip("Posted ledger spend recorded against this line item.")}>{currency(liSpent)}</td>
                    <td className={`text-right ${drawsDownBudget ? colorVal(liSpentBal) : "text-slate-700 dark:text-slate-300"}`} title={tip(drawsDownBudget ? "Budget minus posted spend." : "Reference amount minus posted spend. Not enforced as availability.")}>{currency(liSpentBal)}</td>
                    <td className="text-right">
                      {editing ? (
                        <input className="input w-28 text-right text-sm" type="number" value={num(li.projected)} onChange={(e) => updateLineItem(i, { projected: Number(e.currentTarget.value) })} title={tip("Projected obligations not yet posted to the ledger.")} />
                      ) : (
                        <span className="text-slate-700 dark:text-slate-300" title={tip("Posted spend plus projected obligations.")}>{currency(liProjectedSpend)}</span>
                      )}
                    </td>
                    <td className={`text-right font-semibold ${drawsDownBudget ? colorVal(liProjBal) : "text-slate-700 dark:text-slate-300"}`} title={tip(drawsDownBudget ? "Budget minus projected spend. This is the key availability number." : "Reference amount minus projected spend. Not a hard cap.")}>{currency(liProjBal)}</td>
                    <td title={tip(drawsDownBudget ? "Visual progress based on posted spend against budget." : "Visual comparison against reference amount only.")}><MiniBar spent={liSpent} amount={liAmount} /></td>
                    <td className="text-center">
                      {editing ? (
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          <button type="button" className="btn btn-ghost btn-xs" onClick={() => updateLineItem(i, { locked: !li.locked })} title={li.locked ? tip("Unlock this line item so it can be adjusted.") : tip("Lock this line item to prevent accidental budget edits.")}>
                            {li.locked ? "🔒" : "🔓"}
                          </button>
                          <button type="button" className="btn btn-ghost btn-xs text-slate-500" onClick={() => setSplitConfigIdx(i)} title={tip("Open line item split goal and digest display config.")}>
                            ⚙
                          </button>
                          <button type="button" className={`btn btn-ghost btn-xs ${li.capEnabled ? "text-amber-600" : "text-slate-400"}`} onClick={() => updateLineItem(i, { capEnabled: !li.capEnabled })} title={li.capEnabled ? tip("Per-customer spend cap is enabled.") : tip("Per-customer spend cap is disabled.")}>
                            {li.capEnabled ? "🚧" : "–"}
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          <StatusChip label="Locked" active={!!li.locked} title={li.locked ? tip("This line item is locked.") : tip("This line item is editable.")} />
                          <StatusChip
                            label={li.capEnabled && li.perCustomerCap != null ? `Cap ${currency(num(li.perCustomerCap))}` : "No Cap"}
                            active={!!li.capEnabled}
                            tone="amber"
                            title={li.capEnabled && li.perCustomerCap != null ? tip(`Per-customer spend cap: ${currency(num(li.perCustomerCap))}.`) : tip("No per-customer spend cap is configured.")}
                          />
                        </div>
                      )}
                    </td>
                    {!editing && (
                      <td className="text-right">
                        <ActionMenu items={menuItems} />
                      </td>
                    )}
                    {editing && (
                      <td>
                        {li.capEnabled ? (
                          <input className="input w-24 text-sm" type="number" min={0} placeholder="No limit" value={li.perCustomerCap ?? ""} onChange={(e) => updateLineItem(i, { perCustomerCap: e.currentTarget.value === "" ? null : Number(e.currentTarget.value) })} />
                        ) : (
                          <span className="text-xs text-slate-300">off</span>
                        )}
                      </td>
                    )}
                    {editing && (
                      <td className="text-right">
                        <button className="btn btn-ghost btn-xs text-red-500" onClick={() => removeLineItem(i)}>Delete</button>
                      </td>
                    )}
                  </tr>
                );

                const splitGoals = Array.isArray(li.splitGoals) ? li.splitGoals : [];
                const splitRows = splitGoals.length > 0 ? splitGoals.map((goal: any, goalIndex: number) => {
                  const goalAmount = num(goal.amount, 0);
                  const goalSpent = num(goal.spent, 0);
                  const goalProjected = num(goal.projected, 0);
                  const goalProjectedSpend = goalSpent + goalProjected;
                  const goalBalance = goalAmount - goalSpent;
                  const goalProjectedBalance = goalAmount - goalProjectedSpend;
                  const period = goal.startDate || goal.endDate ? `${goal.startDate || "TBD"} - ${goal.endDate || "TBD"}` : "Date range TBD";
                  return (
                    <tr key={`${liId}_split_${goal.id || goalIndex}`} className="bg-slate-50/70 text-xs dark:bg-slate-900/60">
                      <td className="pl-8 text-slate-700 dark:text-slate-300">
                        <span className="mr-2 text-slate-400">↳</span>
                        <span className="font-medium">{String(goal.label || `Cycle ${goalIndex + 1}`)}</span>
                        <span className="ml-2 text-[10px] font-normal text-slate-400">{period}</span>
                      </td>
                      <td>
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-950">
                          {String(li.splitMode || "custom")}
                        </span>
                      </td>
                      <td className="text-right">{currency(goalAmount)}</td>
                      <td className="text-right text-slate-600 dark:text-slate-300">{currency(goalSpent)}</td>
                      <td className={`text-right ${drawsDownBudget ? colorVal(goalBalance) : "text-slate-600"}`}>{currency(goalBalance)}</td>
                      <td className="text-right text-slate-600 dark:text-slate-300">{currency(goalProjectedSpend)}</td>
                      <td className={`text-right font-semibold ${drawsDownBudget ? colorVal(goalProjectedBalance) : "text-slate-600"}`}>{currency(goalProjectedBalance)}</td>
                      <td><MiniBar spent={goalSpent} amount={goalAmount} /></td>
                      <td className="text-center">
                        {goalProjectedBalance < 0 ? <StatusChip label="Over" active tone="amber" /> : <span className="text-slate-300">-</span>}
                      </td>
                      {!editing && <td />}
                      {editing && <td />}
                      {editing && <td />}
                    </tr>
                  );
                }) : [];

                const drawer = isExpanded && !editing ? (
                  <ActivityDrawer
                    key={`${liId}_drawer`}
                    items={liActivity}
                    currency={currency}
                    colSpan={colCount}
                    onClose={() => setExpandedId(null)}
                    mode={activityMode}
                    onModeChange={setActivityMode}
                    onSelectItem={setSelectedActivity}
                  />
                ) : null;

                return [row, ...splitRows, drawer].filter(Boolean) as React.ReactElement[];
              })
            )}
          </tbody>
          {budget.lineItems.length > 0 && (
            <tfoot>
              <tr
                className={`cursor-pointer border-t border-slate-200 font-semibold transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 ${expandedId === "all" ? "bg-sky-50 dark:bg-sky-950/20" : "bg-slate-50 dark:bg-slate-900"}`}
                onClick={() => !editing && setExpandedId((prev) => (prev === "all" ? null : "all"))}
                title={!editing ? (expandedId === "all" ? tip("Hide all activity.") : tip("View all grant activity across line items.")) : undefined}
              >
                <td className="text-slate-700 dark:text-slate-300">
                  Totals{" "}
                  {!editing && (
                    <span className="ml-1 text-xs font-normal text-slate-400">
                      {expandedId === "all" ? "▲ hide" : `▼ all activity (${activityRows.length})`}
                    </span>
                  )}
                </td>
                <td />
                <td className="text-right">{currency(liTotals.liAmount)}</td>
                <td className="text-right">{currency(liTotals.liSpent)}</td>
                <td className={`text-right ${colorVal(liTotals.liAmount - liTotals.liSpent)}`}>{currency(liTotals.liAmount - liTotals.liSpent)}</td>
                <td className="text-right">{currency(liTotals.liSpent + liTotals.liProjected)}</td>
                <td className={`text-right ${colorVal(liTotals.liAmount - liTotals.liSpent - liTotals.liProjected)}`}>{currency(liTotals.liAmount - liTotals.liSpent - liTotals.liProjected)}</td>
                <td />
                <td />
                {!editing && <td />}
                {editing && <td />}
                {editing && <td />}
              </tr>
              {expandedId === "all" && !editing && (
                <ActivityDrawer
                  items={activityRows}
                  currency={currency}
                  colSpan={colCount}
                  onClose={() => setExpandedId(null)}
                  mode={activityMode}
                  onModeChange={setActivityMode}
                  onSelectItem={setSelectedActivity}
                />
              )}
            </tfoot>
          )}
        </table>
      </div>

      {editing && (
        <div className="flex items-center justify-between">
          <button className="btn btn-secondary btn-sm" onClick={addLineItem}>+ Line Item</button>
          <div className="text-xs text-slate-500">
            Update <span className="font-medium">Projected</span>. <span className="font-medium">Spent</span> is derived from ledger activity.
          </div>
        </div>
      )}

      {fundsState !== null && (
        <AddFundsModal
          targetIdx={fundsState.index}
          lineItems={budget.lineItems}
          num={num}
          currency={currency}
          onCommit={handleFundsCommit}
          onClose={() => setFundsState(null)}
          initialMode={fundsState.mode}
        />
      )}

      {spendCapIdx !== null && budget.lineItems[spendCapIdx] && (
        <SpendCapModal
          lineItem={budget.lineItems[spendCapIdx]}
          num={num}
          onClose={() => setSpendCapIdx(null)}
          onCommit={({ capEnabled, perCustomerCap }) => {
            updateLineItem(spendCapIdx, { capEnabled, perCustomerCap });
            setSpendCapIdx(null);
          }}
        />
      )}

      {splitConfigIdx !== null && budget.lineItems[splitConfigIdx] && (
        <SplitConfigModal
          lineItem={budget.lineItems[splitConfigIdx]}
          num={num}
          currency={currency}
          editing={editing}
          onClose={() => setSplitConfigIdx(null)}
          onCommit={(patch) => updateLineItemConfig(splitConfigIdx, patch)}
        />
      )}

      <GrantBudgetSandboxModal
        isOpen={sandboxOpen}
        onClose={() => setSandboxOpen(false)}
        grantId={grantId ?? ""}
        grantName={String(model?.name || grantId || "Grant")}
        seedRows={sandboxSeedRows}
        lineItems={sandboxLineItems}
        currency={currency}
        onOpenPayment={openSandboxPayment}
      />

      <SpendDetailModal
        row={selectedActivity}
        isOpen={!!selectedActivity}
        onClose={() => {
          setSelectedActivity(null);
          // Refetch unified grant activity so modal changes are reflected immediately.
          void activityQ.refetch();
        }}
        grantNameById={grantNameById}
        lineItemLookup={lineItemLookup}
        customerNameById={customerNameById}
      />
    </div>
  );
}
