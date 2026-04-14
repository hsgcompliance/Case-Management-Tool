// src/features/grants/tabs/BudgetActivityTab.tsx
"use client";
import React, { useMemo, useState } from "react";
import { useGrantActivity } from "@hooks/useGrants";
import { fmtFromTsLike } from "@lib/date";

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
function colorVal(v: number) {
  return v >= 0 ? "text-emerald-600" : "text-red-500";
}

// ── Spend bar ─────────────────────────────────────────────────────────────────

function SpendBar({
  total, spent, projected, currency,
}: {
  total: number; spent: number; projected: number; currency: (n: number) => string;
}) {
  const projectedBalance = total - spent - projected;
  const isOverspent = projectedBalance < 0;
  const denom = total > 0 ? total : 1;
  const spentPct = clamp((spent / denom) * 100, 0, 100);
  const projPct  = clamp((projected / denom) * 100, 0, 100 - spentPct);
  const remPct   = clamp(100 - spentPct - projPct, 0, 100);

  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-amber-400 transition-all" style={{ width: `${spentPct}%` }} title={`Spent: ${currency(spent)}`} />
        <div className="h-full bg-blue-400 transition-all"  style={{ width: `${projPct}%`  }} title={`Projected: ${currency(projected)}`} />
        <div className={`h-full transition-all ${isOverspent ? "bg-red-400" : "bg-emerald-300"}`} style={{ width: `${remPct}%` }} title={`Remaining: ${currency(projectedBalance)}`} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />Spent</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-400 inline-block" />Projected</span>
        <span className="flex items-center gap-1"><span className={`h-2 w-2 rounded-full inline-block ${isOverspent ? "bg-red-400" : "bg-emerald-300"}`} />Remaining</span>
        <span className="ml-auto font-medium text-slate-700">
          {currency(spent)} spent of {currency(total)} total{" "}
          •{" "}
          <span className={colorVal(projectedBalance)}>{currency(projectedBalance)} projected balance</span>
        </span>
      </div>
    </div>
  );
}

// ── Mini line-item spend bar ───────────────────────────────────────────────────

function MiniBar({ spent, amount }: { spent: number; amount: number }) {
  const denom = amount > 0 ? amount : 1;
  const pct = clamp((spent / denom) * 100, 0, 100);
  const overflow = spent > amount;
  return (
    <div className="relative h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
      <div className={`absolute left-0 top-0 h-full ${overflow ? "bg-red-400" : "bg-amber-400"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Activity rows drawer ───────────────────────────────────────────────────────

function ActivityDrawer({
  items,
  currency,
  colSpan,
  onClose,
}: {
  items: any[];
  currency: (n: number) => string;
  colSpan: number;
  onClose: () => void;
}) {
  const net = items.reduce((acc: number, s: any) => acc + (Number(s.amount) || 0), 0);

  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        <div className="border-t border-b border-sky-100 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/20 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-sky-700 dark:text-sky-300 uppercase tracking-wide">
              {items.length > 0 ? `${items.length} ledger entr${items.length === 1 ? "y" : "ies"} · Net ${currency(net)}` : "No ledger activity"}
            </span>
            <button type="button" className="btn btn-ghost btn-xs text-slate-500" onClick={onClose}>Close ×</button>
          </div>

          {items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-separate" style={{ borderSpacing: 0 }}>
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="pb-1 pr-4 font-medium">Date</th>
                    <th className="pb-1 pr-4 font-medium text-right">Amount</th>
                    <th className="pb-1 pr-4 font-medium">Line Item</th>
                    <th className="pb-1 pr-4 font-medium">Enrollment</th>
                    <th className="pb-1 pr-4 font-medium">Note</th>
                    <th className="pb-1 font-medium">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((s: any) => (
                    <tr key={s.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <td className="py-1 pr-4 text-slate-700">{fmtFromTsLike(s.ts, s.dueDate ?? s.date)}</td>
                      <td className={`py-1 pr-4 text-right font-medium ${Number(s.amount) < 0 ? "text-red-600" : "text-slate-900 dark:text-slate-100"}`}>
                        {currency(Number(s.amount) || 0)}
                      </td>
                      <td className="py-1 pr-4 text-slate-600">{s.lineItemLabelAtSpend ?? s.lineItemId ?? "—"}</td>
                      <td className="py-1 pr-4 text-slate-600 font-mono text-[10px]">{s.enrollmentId ? s.enrollmentId.slice(0, 8) + "…" : "—"}</td>
                      <td className="py-1 pr-4 text-slate-500">{Array.isArray(s.note) ? s.note.join(", ") : s.note || "—"}</td>
                      <td className="py-1">
                        {s.reversalOf ? (
                          <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">Reversal</span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">Spend</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Add Funds modal ───────────────────────────────────────────────────────────

function AddFundsModal({
  targetIdx,
  lineItems,
  num,
  currency,
  onCommit,
  onClose,
}: {
  targetIdx: number;
  lineItems: any[];
  num: (n: unknown, fallback?: number) => number;
  currency: (n: number) => string;
  onCommit: (patch: { targetIdxAmountDelta: number; sourceIdx?: number }) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"add" | "move">("add");
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
    if (mode === "add") {
      onCommit({ targetIdxAmountDelta: parsedAmount });
    } else {
      onCommit({ targetIdxAmountDelta: parsedAmount, sourceIdx });
    }
  }

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-[24px] border border-slate-200 bg-white shadow-2xl p-6 space-y-5 dark:border-slate-700 dark:bg-slate-900">
        {/* Header */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-sky-600 mb-1">Budget Adjustment</div>
          <h3 className="text-xl font-bold text-slate-950 dark:text-slate-50">Add Funds</h3>
          <p className="text-sm text-slate-500 mt-1">
            Target: <span className="font-medium text-slate-800 dark:text-slate-200">{String(target.label || target.id || "Line item")}</span>
            {" · "}Current: <span className="font-medium">{currency(num(target.amount, 0))}</span>
          </p>
        </div>

        {/* Mode toggle */}
        <div>
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Funding source</div>
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
              : "Moves budget between line items — grant total stays the same."}
          </p>
        </div>

        {/* Move source select */}
        {mode === "move" && (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Source line item</label>
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

        {/* Amount input */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Amount ($)
          </label>
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
          {parsedAmount > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              {mode === "add" ? (
                <>New line item total: <span className="font-medium text-emerald-700">{currency(num(target.amount, 0) + parsedAmount)}</span></>
              ) : sourceItem && parsedAmount <= sourceBalance ? (
                <>
                  <span className="font-medium text-slate-700">{String(sourceItem.label || "Source")}</span>:{" "}
                  {currency(sourceBalance)} → {currency(sourceBalance - parsedAmount)}{" · "}
                  <span className="font-medium text-slate-700">{String(target.label || "Target")}</span>:{" "}
                  {currency(num(target.amount, 0))} → {currency(num(target.amount, 0) + parsedAmount)}
                </>
              ) : parsedAmount > sourceBalance ? (
                <span className="text-red-600">Amount exceeds available balance.</span>
              ) : null}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!canCommit}
            onClick={handleCommit}
          >
            {mode === "add" ? "Add Funds" : "Move Funds"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

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
  // ── Activity data ──────────────────────────────────────────────────────────
  const activityQ = useGrantActivity(grantId ?? "", 2000);
  const allActivity: any[] = Array.isArray(activityQ.data) ? activityQ.data : [];

  // ── Expanded drawer state (one open at a time) ────────────────────────────
  const [expandedId, setExpandedId] = useState<string | "all" | null>(null);

  // ── Add Funds modal state ─────────────────────────────────────────────────
  const [addFundsIdx, setAddFundsIdx] = useState<number | null>(null);

  // ── Budget model ───────────────────────────────────────────────────────────
  const budget = useMemo(() => {
    const b = JSON.parse(JSON.stringify(model.budget ?? {}));
    b.total = num(b.total, num(b.startAmount, derived.total));
    b.totals = b.totals || {};
    b.totals.spent = num(b.totals.spent, derived.spent);
    b.totals.projected = num(b.totals.projected, derived.projected);
    b.lineItems = Array.isArray(b.lineItems) ? b.lineItems : [];
    return recomputeBudgetTotals(b);
  }, [model.budget, derived.total, derived.spent, derived.projected]);

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
    after.spent     = num(after.spent,     0);
    after.projected = num(after.projected, 0);
    next.lineItems[index] = after;
    commit(next);
  };

  const addLineItem = () => {
    const next = JSON.parse(JSON.stringify(budget));
    next.lineItems.push({ id: `li_${Date.now().toString(36)}`, label: "New Item", amount: 0, spent: 0, projected: 0, locked: false });
    commit(next);
  };

  const removeLineItem = (index: number) => {
    const next = JSON.parse(JSON.stringify(budget));
    next.lineItems.splice(index, 1);
    commit(next);
  };

  // ── Add Funds commit ───────────────────────────────────────────────────────
  function handleAddFundsCommit({ targetIdxAmountDelta, sourceIdx }: { targetIdxAmountDelta: number; sourceIdx?: number }) {
    if (addFundsIdx === null) return;
    const next = JSON.parse(JSON.stringify(budget));
    // Add to target
    next.lineItems[addFundsIdx].amount = num(next.lineItems[addFundsIdx].amount, 0) + targetIdxAmountDelta;
    // If move, subtract from source
    if (sourceIdx !== undefined && sourceIdx >= 0) {
      next.lineItems[sourceIdx].amount = Math.max(0, num(next.lineItems[sourceIdx].amount, 0) - targetIdxAmountDelta);
    } else {
      // Add new funds → also increase grant total
      next.total = num(next.total, 0) + targetIdxAmountDelta;
    }
    commit(next);
    setAddFundsIdx(null);
  }

  // ── Derived summary ────────────────────────────────────────────────────────
  const total          = num(budget.total, 0);
  const spent          = num(budget.totals?.spent, 0);
  const projected      = num(budget.totals?.projected, 0);
  const projectedSpend = spent + projected;
  const projectedBalance = total - projectedSpend;
  const spentBalance     = total - spent;

  const liTotals = useMemo(() => {
    let liAmount = 0, liSpent = 0, liProjected = 0;
    for (const li of budget.lineItems) {
      liAmount    += num(li.amount,    0);
      liSpent     += num(li.spent,     0);
      liProjected += num(li.projected, 0);
    }
    return { liAmount, liSpent, liProjected };
  }, [budget.lineItems]);

  // ── Activity helpers ───────────────────────────────────────────────────────
  function activityForLineItem(liId: string): any[] {
    return allActivity.filter((s: any) => s.lineItemId === liId);
  }

  // ── Column count for colSpan ───────────────────────────────────────────────
  // Non-edit: Label | Amount | Spent | Proj | Proj Bal | Spent Bal | Bar | Locked | Cap | Activity | Add Funds
  // Edit:     + Cap$ | Delete
  const colCount = editing ? 12 : 11;

  // ── Toggle expand helper ───────────────────────────────────────────────────
  function toggleExpand(id: string | "all") {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="space-y-4 mt-4">
      {/* ── Spend bar ──────────────────────────────────────────────────────── */}
      <SpendBar total={total} spent={spent} projected={projected} currency={currency} />

      {/* ── Summary metric cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
        {[
          { label: "Total", value: total, editable: true, colorFn: null },
          { label: "Spent", value: spent, editable: false, colorFn: null },
          { label: "Proj. Spend", value: projectedSpend, editable: false, colorFn: null },
          { label: "Proj. Balance", value: projectedBalance, editable: false, colorFn: colorVal },
          { label: "Spent Balance", value: spentBalance, editable: false, colorFn: colorVal },
        ].map(({ label, value, editable, colorFn }) => (
          <div key={label} className="rounded-[14px] border border-slate-200 px-3 py-2.5">
            <div className="text-slate-500 text-xs mb-1">{label}</div>
            {editable && editing ? (
              <input
                className="input mt-0.5 text-sm font-semibold"
                type="number"
                value={budget.total}
                onChange={(e) => setTotal(Number(e.currentTarget.value))}
              />
            ) : (
              <div className={`font-semibold ${colorFn ? colorFn(value) : "text-slate-900 dark:text-slate-100"}`}>
                {currency(value)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Allocation settings ────────────────────────────────────────────── */}
      {(editing || budget.allocationEnabled) && (
        <div className="rounded-[14px] border border-sky-200 bg-sky-50/60 px-4 py-3 dark:border-sky-800 dark:bg-sky-950/20">
          <div className="flex flex-wrap items-center gap-4">
            {editing ? (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 accent-sky-600"
                  checked={!!budget.allocationEnabled}
                  onChange={(e) => { const next = JSON.parse(JSON.stringify(budget)); next.allocationEnabled = e.currentTarget.checked; commit(next); }}
                />
                <span className="text-sm font-medium text-sky-800 dark:text-sky-200">Client Allocation Tracking</span>
              </label>
            ) : (
              <span className="flex items-center gap-1.5 text-sm font-semibold text-sky-700 dark:text-sky-300">
                <span className="h-2 w-2 rounded-full bg-sky-500 inline-block" />
                Client Allocation Mode
              </span>
            )}
            {editing && budget.allocationEnabled && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 whitespace-nowrap">Grant-level cap / customer ($):</label>
                <input type="number" min={0} placeholder="No cap" className="input w-28 text-sm"
                  value={budget.perCustomerCap ?? ""}
                  onChange={(e) => { const next = JSON.parse(JSON.stringify(budget)); next.perCustomerCap = e.currentTarget.value === "" ? null : Number(e.currentTarget.value); commit(next); }}
                />
              </div>
            )}
            {!editing && budget.allocationEnabled && budget.perCustomerCap != null && (
              <span className="text-xs text-slate-600">Cap: <span className="font-semibold">${num(budget.perCustomerCap).toLocaleString()}</span> / customer</span>
            )}
          </div>
        </div>
      )}

      {/* ── Activity loading note ──────────────────────────────────────────── */}
      {!editing && grantId && activityQ.isLoading && (
        <div className="text-xs text-slate-400 italic">Loading ledger activity…</div>
      )}

      {/* ── Line items table ───────────────────────────────────────────────── */}
      <div className="table-wrap">
        <table className="table text-sm">
          <thead>
            <tr>
              <th>Label</th>
              <th className="text-right">Amount</th>
              <th className="text-right">Spent</th>
              <th className="text-right">Proj.</th>
              <th className="text-right">Proj. Bal</th>
              <th className="text-right">Spent Bal</th>
              <th className="w-16">Bar</th>
              <th>Locked</th>
              <th title="Per-customer spending cap">Cap</th>
              {editing && <th className="w-24">Cap $</th>}
              {!editing && grantId && <th title="View ledger activity">Activity</th>}
              {!editing && <th>Funds</th>}
              {editing && <th />}
            </tr>
          </thead>
          <tbody>
            {budget.lineItems.length === 0 ? (
              <tr>
                <td className="text-slate-400 italic" colSpan={colCount}>No line items yet.</td>
              </tr>
            ) : (
              budget.lineItems.flatMap((li: any, i: number) => {
                const liId       = String(li.id ?? `idx_${i}`);
                const liAmount   = num(li.amount, 0);
                const liSpent    = num(li.spent, 0);
                const liProj     = num(li.projected, 0);
                const liProjBal  = liAmount - liSpent - liProj;
                const liSpentBal = liAmount - liSpent;
                const isExpanded = expandedId === liId;
                const liActivity = grantId ? activityForLineItem(liId) : [];

                const row = (
                  <tr
                    key={liId}
                    className={isExpanded ? "bg-sky-50/60 dark:bg-sky-950/20" : "hover:bg-slate-50 dark:hover:bg-slate-800/40"}
                  >
                    {/* Label */}
                    <td>
                      {editing ? (
                        <input className="input text-sm" value={li.label ?? ""} onChange={(e) => updateLineItem(i, { label: e.currentTarget.value })} />
                      ) : (
                        <span className="font-medium text-slate-800 dark:text-slate-200">{li.label ?? li.id}</span>
                      )}
                    </td>
                    {/* Amount */}
                    <td className="text-right">
                      {editing ? (
                        <input className="input w-28 text-right text-sm" type="number" value={num(li.amount)} onChange={(e) => updateLineItem(i, { amount: Number(e.currentTarget.value) })} />
                      ) : (
                        <span>{currency(liAmount)}</span>
                      )}
                    </td>
                    <td className="text-right text-slate-700 dark:text-slate-300">{currency(liSpent)}</td>
                    {/* Projected */}
                    <td className="text-right">
                      {editing ? (
                        <input className="input w-28 text-right text-sm" type="number" value={num(li.projected)} onChange={(e) => updateLineItem(i, { projected: Number(e.currentTarget.value) })} />
                      ) : (
                        <span className="text-slate-700 dark:text-slate-300">{currency(liProj)}</span>
                      )}
                    </td>
                    <td className={`text-right ${colorVal(liProjBal)}`}>{currency(liProjBal)}</td>
                    <td className={`text-right ${colorVal(liSpentBal)}`}>{currency(liSpentBal)}</td>
                    <td><MiniBar spent={liSpent} amount={liAmount} /></td>
                    {/* Locked */}
                    <td className="text-center">
                      {editing ? (
                        <button type="button" className="btn btn-ghost btn-xs" onClick={() => updateLineItem(i, { locked: !li.locked })} title={li.locked ? "Unlock" : "Lock"}>
                          {li.locked ? "🔒" : "🔓"}
                        </button>
                      ) : (
                        <span>{li.locked ? "🔒" : ""}</span>
                      )}
                    </td>
                    {/* Cap toggle */}
                    <td className="text-center">
                      {editing ? (
                        <button type="button" className={`btn btn-ghost btn-xs ${li.capEnabled ? "text-amber-600" : "text-slate-400"}`} onClick={() => updateLineItem(i, { capEnabled: !li.capEnabled })} title={li.capEnabled ? "Cap enabled" : "Cap disabled"}>
                          {li.capEnabled ? "🚧" : "–"}
                        </button>
                      ) : li.capEnabled && li.perCustomerCap != null ? (
                        <span className="text-xs font-medium text-amber-700" title={`Per-customer cap: $${li.perCustomerCap}`}>🚧 ${num(li.perCustomerCap).toLocaleString()}</span>
                      ) : (
                        <span className="text-slate-300">–</span>
                      )}
                    </td>
                    {/* Cap $ (edit only) */}
                    {editing && (
                      <td>
                        {li.capEnabled ? (
                          <input className="input w-24 text-sm" type="number" min={0} placeholder="No limit" value={li.perCustomerCap ?? ""}
                            onChange={(e) => updateLineItem(i, { perCustomerCap: e.currentTarget.value === "" ? null : Number(e.currentTarget.value) })}
                          />
                        ) : (
                          <span className="text-slate-300 text-xs">off</span>
                        )}
                      </td>
                    )}
                    {/* Activity toggle (view only) */}
                    {!editing && grantId && (
                      <td className="text-center">
                        <button
                          type="button"
                          className={`btn btn-ghost btn-xs ${isExpanded ? "text-sky-600" : "text-slate-400"}`}
                          onClick={() => toggleExpand(liId)}
                          title={isExpanded ? "Hide activity" : `View ${liActivity.length} ledger entries`}
                        >
                          {isExpanded ? "▲" : "▼"}{liActivity.length > 0 ? ` ${liActivity.length}` : ""}
                        </button>
                      </td>
                    )}
                    {/* Add Funds (view only) */}
                    {!editing && (
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs text-sky-700"
                          onClick={() => setAddFundsIdx(i)}
                        >
                          + Funds
                        </button>
                      </td>
                    )}
                    {/* Delete (edit only) */}
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
                  />
                ) : null;

                return [row, drawer].filter(Boolean) as React.ReactElement[];
              })
            )}
          </tbody>

          {/* Totals footer — clickable to expand all activity */}
          {budget.lineItems.length > 0 && (
            <tfoot>
              <tr
                className={`border-t border-slate-200 font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${expandedId === "all" ? "bg-sky-50 dark:bg-sky-950/20" : "bg-slate-50 dark:bg-slate-900"}`}
                onClick={() => !editing && toggleExpand("all")}
                title={!editing ? (expandedId === "all" ? "Hide all activity" : "Click to view all ledger activity") : undefined}
              >
                <td className="text-slate-700 dark:text-slate-300">
                  Totals{" "}
                  {!editing && (
                    <span className="text-xs font-normal text-slate-400 ml-1">
                      {expandedId === "all" ? "▲ hide" : `▼ all activity (${allActivity.length})`}
                    </span>
                  )}
                </td>
                <td className="text-right">{currency(liTotals.liAmount)}</td>
                <td className="text-right">{currency(liTotals.liSpent)}</td>
                <td className="text-right">{currency(liTotals.liProjected)}</td>
                <td className={`text-right ${colorVal(liTotals.liAmount - liTotals.liSpent - liTotals.liProjected)}`}>
                  {currency(liTotals.liAmount - liTotals.liSpent - liTotals.liProjected)}
                </td>
                <td className={`text-right ${colorVal(liTotals.liAmount - liTotals.liSpent)}`}>
                  {currency(liTotals.liAmount - liTotals.liSpent)}
                </td>
                <td /><td /><td />
                {editing && <td />}
                {!editing && grantId && <td />}
                {!editing && <td />}
                {editing && <td />}
              </tr>
              {expandedId === "all" && !editing && (
                <ActivityDrawer
                  items={allActivity}
                  currency={currency}
                  colSpan={colCount}
                  onClose={() => setExpandedId(null)}
                />
              )}
            </tfoot>
          )}
        </table>
      </div>

      {/* Edit controls */}
      {editing && (
        <div className="flex items-center justify-between">
          <button className="btn btn-secondary btn-sm" onClick={addLineItem}>+ Line Item</button>
          <div className="text-xs text-slate-500">
            Update <span className="font-medium">Projected</span>. <span className="font-medium">Spent</span> is derived from ledger activity.
          </div>
        </div>
      )}

      {/* Add Funds modal */}
      {addFundsIdx !== null && (
        <AddFundsModal
          targetIdx={addFundsIdx}
          lineItems={budget.lineItems}
          num={num}
          currency={currency}
          onCommit={handleAddFundsCommit}
          onClose={() => setAddFundsIdx(null)}
        />
      )}
    </div>
  );
}
