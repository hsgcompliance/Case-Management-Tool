"use client";

import React, { useCallback, useDeferredValue, useMemo, useState } from "react";
import ActionMenu, { type ActionItem } from "@entities/ui/ActionMenu";
import { useEnrollments } from "@hooks/useEnrollments";
import { useGrantActivity } from "@hooks/useGrants";
import { type PaymentQueueItem, usePaymentQueueItems } from "@hooks/usePaymentQueue";
import { useUsers } from "@hooks/useUsers";
import { SpendDetailModal, type SpendRow } from "@features/widgets/spending/SpendDetailModal";
import { fmtFromTsLike } from "@lib/date";

type ActivityMode = "paid" | "projected" | "all";
type ActivityKindFilter = "all" | "paid" | "projected" | "reversal";
type GrantActivityRow = SpendRow & {
  customerLabel: string;
  userLabel: string;
  noteText: string;
  displayType: "Paid" | "Projected" | "Reversal";
  sourceType: "paid" | "projected";
  searchText: string;
};

const DEFAULT_LINE_ITEM_TYPES = [
  { id: "rental-assistance", label: "Rental Assistance" },
  { id: "program-spending", label: "Program Spending" },
  { id: "customer-support-service", label: "Customer Support Service" },
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
  const s = String(value || "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
  const deferredSearch = useDeferredValue(search);

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalizeText(deferredSearch);
    return items.filter((item) => {
      const modePass =
        mode === "all" ? true : mode === "paid" ? item.sourceType === "paid" : item.sourceType === "projected";
      if (!modePass) return false;

      const kindPass =
        kindFilter === "all"
          ? true
          : kindFilter === "paid"
          ? item.displayType === "Paid"
          : kindFilter === "projected"
          ? item.displayType === "Projected"
          : item.displayType === "Reversal";
      if (!kindPass) return false;

      if (!normalizedQuery) return true;
      return item.searchText.includes(normalizedQuery);
    });
  }, [deferredSearch, items, kindFilter, mode]);

  const projectedCount = useMemo(
    () => items.filter((item) => item.sourceType === "projected").length,
    [items],
  );
  const paidCount = useMemo(
    () => items.filter((item) => item.sourceType === "paid").length,
    [items],
  );
  const net = filteredItems.reduce((acc, item) => acc + item.amountCents / 100, 0);

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
                  ["paid", "Paid", false, `Posted ledger rows only (${paidCount}).`],
                  ["projected", "Projected", projectedCount === 0, projectedCount > 0 ? `Pending projected payments only (${projectedCount}).` : "No projected payments for this scope."],
                  ["all", "All", false, "Posted and projected rows together for this grant scope."],
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
              placeholder="Search customer, note, payment, user..."
              title={tip("Filter activity rows like the invoicing tool by customer, note, payment, or user.")}
            />
            <select
              className="input text-sm"
              value={kindFilter}
              onChange={(e) => setKindFilter(e.currentTarget.value as ActivityKindFilter)}
              title={tip("Filter rows by activity type.")}
            >
              <option value="all">All Types</option>
              <option value="paid">Paid</option>
              <option value="projected">Projected</option>
              <option value="reversal">Reversal</option>
            </select>
          </div>

          {filteredItems.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border-separate text-xs" style={{ borderSpacing: 0 }}>
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="pb-1 pr-4 font-medium">Date</th>
                    <th className="pb-1 pr-4 text-right font-medium">Amount</th>
                    <th className="pb-1 pr-4 font-medium">Customer</th>
                    <th className="pb-1 pr-4 font-medium">User</th>
                    <th className="pb-1 pr-4 font-medium">Note</th>
                    <th className="pb-1 font-medium">Type</th>
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
                      <td className="py-1 pr-4 text-slate-700">{fmtFromTsLike(item.date)}</td>
                      <td className={`py-1 pr-4 text-right font-medium ${item.amountCents < 0 ? "text-red-600" : "text-slate-900 dark:text-slate-100"}`}>
                        {currency(item.amountCents / 100)}
                      </td>
                      <td className="py-1 pr-4 text-slate-600">{item.customerLabel || "—"}</td>
                      <td className="py-1 pr-4 text-slate-600">{item.userLabel || "—"}</td>
                      <td className="py-1 pr-4 text-slate-500">{item.noteText || item.title || "—"}</td>
                      <td className="py-1">
                        {item.displayType === "Reversal" ? (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-700">Reversal</span>
                        ) : item.displayType === "Projected" ? (
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 font-medium text-blue-700">Projected</span>
                        ) : (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-700">Paid</span>
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

export function BudgetActivityTab({
  editing,
  model,
  setModel,
  derived,
  currency,
  recomputeBudgetTotals,
  num,
  grantId,
}: {
  editing: boolean;
  model: Record<string, any>;
  setModel: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  derived: { total: number; spent: number; projected: number; balance: number; projectedBalance: number; lineItems: any[] };
  currency: (n: number) => string;
  recomputeBudgetTotals: (b: any) => any;
  num: (n: unknown, fallback?: number) => number;
  grantId?: string;
}) {
  const activityQ = useGrantActivity(grantId ?? "", 2000);
  const allActivity: any[] = useMemo(() => (Array.isArray(activityQ.data) ? activityQ.data : []), [activityQ.data]);
  const projectedQ = usePaymentQueueItems(
    grantId ? { grantId, source: "projection", queueStatus: "pending", limit: 1000 } : undefined,
    { enabled: !!grantId && !editing, staleTime: 30_000 },
  );
  const projectedQueueItems: PaymentQueueItem[] = useMemo(
    () => (Array.isArray(projectedQ.data) ? projectedQ.data : []),
    [projectedQ.data],
  );
  const { data: enrollments = [] } = useEnrollments(
    grantId ? { grantId, limit: 1000 } : undefined,
    { enabled: !!grantId && !editing },
  );
  const { data: users = [] } = useUsers({ status: "all", limit: 500 });

  const [expandedId, setExpandedId] = useState<string | "all" | null>(null);
  const [activityMode, setActivityMode] = useState<ActivityMode>("paid");
  const [fundsState, setFundsState] = useState<{ index: number; mode: "add" | "move" } | null>(null);
  const [spendCapIdx, setSpendCapIdx] = useState<number | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<SpendRow | null>(null);

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
    for (const item of projectedQueueItems) {
      const customerId = String(item?.customerId || "").trim();
      if (!customerId || map.has(customerId)) continue;
      const label = String(item?.customer || item?.merchant || customerId).trim() || customerId;
      map.set(customerId, label);
    }
    return map;
  }, [enrollmentInfoById, projectedQueueItems]);

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

    for (const raw of allActivity) {
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
      const noteText = Array.isArray(raw?.note) ? raw.note.join(", ") : String(raw?.note || "").trim();
      const date = dateIso10(raw?.ts || raw?.date);
      const isReversal = !!raw?.reversalOf || Number(raw?.amount || 0) < 0;
      const userLabel = resolveUserLabel(raw?.by);

      rows.push({
        id: `ledger:${String(raw?.id || `${enrollmentId}:${raw?.paymentId || date}`)}`,
        kind: "grant-ledger",
        sourceLabel: "Enrollment",
        title: noteText || (isReversal ? "Payment reversal" : "Posted payment"),
        subtitle: String(raw?.paymentId || raw?.id || ""),
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
          ...(raw as Record<string, unknown>),
          customerId,
          dueDate: raw?.ts || raw?.date || null,
          date,
        },
        customerLabel,
        userLabel,
        noteText,
        displayType: isReversal ? "Reversal" : "Paid",
        sourceType: "paid",
        searchText: normalizeText([noteText, customerLabel, customerId, userLabel, raw?.paymentId, raw?.id].join(" ")),
      });
    }

    for (const item of projectedQueueItems) {
      const customerId = String(item?.customerId || "").trim();
      const customerLabel = String(item?.customer || customerNameById.get(customerId) || customerId || "").trim();
      const noteText = String(item?.note || item?.notes || item?.purpose || "").trim();
      const date = dateIso10(item?.dueDate || item?.createdAt || item?.postedAt);
      const userLabel = resolveUserLabel(item?.postedBy || item?.reopenedBy);

      rows.push({
        id: `queue:${String(item.id || `${item.enrollmentId || "projection"}:${item.paymentId || date}`)}`,
        kind: "queue-projection",
        sourceLabel: "Enrollment",
        title: String(item?.merchant || item?.descriptor || noteText || "Projected payment"),
        subtitle: String(item?.paymentId || item?.submissionId || item?.id || ""),
        date,
        month: monthFromDate(item?.month || date),
        amountCents: Math.round(Math.max(0, Number(item?.amount || 0)) * 100),
        completed: false,
        workflowState: "open",
        workflowReason: "Projected spend, not yet paid",
        grantId: String(item?.grantId || grantId || ""),
        lineItemId: String(item?.lineItemId || ""),
        customerId,
        creditCardId: "",
        creditCardName: "",
        cardBucket: "",
        taskToken: "",
        paymentQueueItem: item,
        customerLabel,
        userLabel,
        noteText,
        displayType: "Projected",
        sourceType: "projected",
        searchText: normalizeText([noteText, customerLabel, customerId, userLabel, item?.merchant, item?.paymentId, item?.id].join(" ")),
      });
    }

    rows.sort((a, b) => {
      if (a.date !== b.date) return String(b.date).localeCompare(String(a.date));
      return Math.abs(b.amountCents) - Math.abs(a.amountCents);
    });

    return rows;
  }, [allActivity, customerNameById, enrollmentInfoById, grantId, projectedQueueItems, resolveUserLabel]);

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
  const colCount = editing ? 11 : 10;

  return (
    <div className="mt-4 space-y-4">
      <SpendBar total={total} spent={spent} projected={projected} currency={currency} />

      <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
        {[
          { label: "Budget", value: total, editable: true, colorFn: null, title: tip("Total planned budget for this grant.") },
          { label: "Spent", value: spent, editable: false, colorFn: null, title: tip("Posted ledger spend across all line items.") },
          { label: "Balance", value: spentBalance, editable: false, colorFn: colorVal, title: tip("Budget minus posted spend.") },
          { label: "Projected Spend", value: projectedSpend, editable: false, colorFn: null, title: tip("Posted spend plus projected obligations.") },
          { label: "Available", value: projectedBalance, editable: false, colorFn: colorVal, title: tip("Most important number. Budget minus projected spend.") },
        ].map(({ label, value, editable, colorFn, title }) => (
          <div key={label} className="rounded-[14px] border border-slate-200 px-3 py-2.5" title={title}>
            <div className="mb-1 text-xs text-slate-500">{label}</div>
            {editable && editing ? (
              <input className="input mt-0.5 text-sm font-semibold" type="number" value={budget.total} onChange={(e) => setTotal(Number(e.currentTarget.value))} />
            ) : (
              <div className={`${label === "Available" ? "text-base font-bold" : "font-semibold"} ${colorFn ? colorFn(value) : "text-slate-900 dark:text-slate-100"}`}>
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
              <span className="text-xs text-slate-600">Cap: <span className="font-semibold">${num(budget.perCustomerCap).toLocaleString()}</span> / customer</span>
            )}
          </div>
        </div>
      )}

      {!editing && grantId && (activityQ.isLoading || projectedQ.isLoading) && (
        <div className="text-xs italic text-slate-400">Loading grant activity…</div>
      )}

      <div className="table-wrap">
        <table className="table text-sm">
          <thead>
            <tr>
              <th title={tip("Line item label. Expand to review activity tied to this budget bucket.")}>Label</th>
              <th className="w-44" title={tip("Reporting category for grouping line item totals across grants. Blank or N/A leaves it uncategorized.")}>Type</th>
              <th className="text-right" title={tip("Planned dollars assigned to this line item.")}>Budget</th>
              <th className="text-right" title={tip("Posted ledger spend recorded against this line item.")}>Spent</th>
              <th className="text-right" title={tip("Budget minus posted spend.")}>Balance</th>
              <th className="text-right" title={tip("Posted spend plus projected obligations.")}>Projected Spend</th>
              <th className="text-right" title={tip("Most important number. Budget minus projected spend.")}>Available</th>
              <th className="w-16" title={tip("Visual spend progress for this line item.")} />
              <th className="w-28" title={tip("Compact status chips for lock and cap settings.")}>Status</th>
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
              budget.lineItems.flatMap((li: any, i: number) => {
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
                  {
                    key: "view-activity",
                    label: "View Activity",
                    onSelect: () => {
                      setActivityMode("paid");
                      setExpandedId(liId);
                    },
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
                          onClick={() => setExpandedId((prev) => (prev === liId ? null : liId))}
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
                          {lineItemTypeLabel(li.type) || "N/A"}
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      {editing ? (
                        <input className="input w-28 text-right text-sm" type="number" value={num(li.amount)} onChange={(e) => updateLineItem(i, { amount: Number(e.currentTarget.value) })} title={tip("Edit the planned budget for this line item.")} />
                      ) : (
                        <span title={tip("Planned dollars assigned to this line item.")}>{currency(liAmount)}</span>
                      )}
                    </td>
                    <td className="text-right text-slate-700 dark:text-slate-300" title={tip("Posted ledger spend recorded against this line item.")}>{currency(liSpent)}</td>
                    <td className={`text-right ${colorVal(liSpentBal)}`} title={tip("Budget minus posted spend.")}>{currency(liSpentBal)}</td>
                    <td className="text-right">
                      {editing ? (
                        <input className="input w-28 text-right text-sm" type="number" value={num(li.projected)} onChange={(e) => updateLineItem(i, { projected: Number(e.currentTarget.value) })} title={tip("Projected obligations not yet posted to the ledger.")} />
                      ) : (
                        <span className="text-slate-700 dark:text-slate-300" title={tip("Posted spend plus projected obligations.")}>{currency(liProjectedSpend)}</span>
                      )}
                    </td>
                    <td className={`text-right font-semibold ${colorVal(liProjBal)}`} title={tip("Budget minus projected spend. This is the key availability number.")}>{currency(liProjBal)}</td>
                    <td title={tip("Visual progress based on posted spend against budget.")}><MiniBar spent={liSpent} amount={liAmount} /></td>
                    <td className="text-center">
                      {editing ? (
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          <button type="button" className="btn btn-ghost btn-xs" onClick={() => updateLineItem(i, { locked: !li.locked })} title={li.locked ? tip("Unlock this line item so it can be adjusted.") : tip("Lock this line item to prevent accidental budget edits.")}>
                            {li.locked ? "🔒" : "🔓"}
                          </button>
                          <button type="button" className={`btn btn-ghost btn-xs ${li.capEnabled ? "text-amber-600" : "text-slate-400"}`} onClick={() => updateLineItem(i, { capEnabled: !li.capEnabled })} title={li.capEnabled ? tip("Per-customer spend cap is enabled.") : tip("Per-customer spend cap is disabled.")}>
                            {li.capEnabled ? "🚧" : "–"}
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          <StatusChip label="Locked" active={!!li.locked} title={li.locked ? tip("This line item is locked.") : tip("This line item is editable.")} />
                          <StatusChip
                            label={li.capEnabled && li.perCustomerCap != null ? `Cap ${num(li.perCustomerCap).toLocaleString()}` : "No Cap"}
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

                return [row, drawer].filter(Boolean) as React.ReactElement[];
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

      <SpendDetailModal
        row={selectedActivity}
        isOpen={!!selectedActivity}
        onClose={() => setSelectedActivity(null)}
        grantNameById={grantNameById}
        lineItemLookup={lineItemLookup}
        customerNameById={customerNameById}
      />
    </div>
  );
}
