// src/features/grants/tabs/BudgetTab.tsx
"use client";
import React, { useMemo } from "react";

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

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function colorVal(v: number) {
  return v >= 0 ? "text-emerald-600" : "text-red-500";
}

export function BudgetTab({
  editing,
  model,
  setModel,
  derived,
  currency,
  recomputeBudgetTotals,
  num,
}: {
  editing: boolean;
  model: Record<string, any>;
  setModel: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  derived: { total: number; spent: number; projected: number; balance: number; projectedBalance: number; lineItems: any[] };
  currency: (n: number) => string;
  recomputeBudgetTotals: (b: any) => any;
  num: (n: unknown, fallback?: number) => number;
}) {
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
    after.spent = num(after.spent, 0);
    after.projected = num(after.projected, 0);
    next.lineItems[index] = after;
    commit(next);
  };

  const addLineItem = () => {
    const next = JSON.parse(JSON.stringify(budget));
    next.lineItems.push({
      id: `li_${Date.now().toString(36)}`,
      label: "New Item",
      amount: 0,
      spent: 0,
      projected: 0,
      locked: false,
      type: null,
    });
    commit(next);
  };

  const removeLineItem = (index: number) => {
    const next = JSON.parse(JSON.stringify(budget));
    next.lineItems.splice(index, 1);
    commit(next);
  };

  // Derived summary values
  const total = num(budget.total, 0);
  const spent = num(budget.totals?.spent, 0);
  const projected = num(budget.totals?.projected, 0);
  const projectedSpend = spent + projected;
  const projectedBalance = total - projectedSpend;
  const spentBalance = total - spent;

  // Progress bar widths (clamp to 0–100%)
  const safeDenom = total > 0 ? total : 1;
  const spentPct = clamp((spent / safeDenom) * 100, 0, 100);
  const projPct = clamp((projected / safeDenom) * 100, 0, 100 - spentPct);
  const remainPct = clamp(100 - spentPct - projPct, 0, 100);
  const isOverspent = projectedBalance < 0;

  // Line item totals
  const liTotals = useMemo(() => {
    let liAmount = 0, liSpent = 0, liProjected = 0;
    for (const li of budget.lineItems) {
      liAmount += num(li.amount, 0);
      liSpent += num(li.spent, 0);
      liProjected += num(li.projected, 0);
    }
    return { liAmount, liSpent, liProjected };
  }, [budget.lineItems]);

  const colCount = editing ? 13 : 11;

  return (
    <div className="space-y-4 mt-4">
      {/* Progress bar */}
      <div>
        <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-amber-400 transition-all"
            style={{ width: `${spentPct}%` }}
            title={`Spent: ${currency(spent)}`}
          />
          <div
            className="h-full bg-blue-400 transition-all"
            style={{ width: `${projPct}%` }}
            title={`Projected: ${currency(projected)}`}
          />
          <div
            className={`h-full transition-all ${isOverspent ? "bg-red-400" : "bg-emerald-300"}`}
            style={{ width: `${remainPct}%` }}
            title={`Remaining: ${currency(projectedBalance)}`}
          />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-amber-400" />Spent</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-blue-400" />Projected</span>
          <span className="flex items-center gap-1"><span className={`inline-block h-2 w-2 rounded-full ${isOverspent ? "bg-red-400" : "bg-emerald-300"}`} />Remaining</span>
          <span className="ml-auto font-medium text-slate-700">
            {currency(spent)} spent of {currency(total)} total
            {" "}•{" "}
            <span className={colorVal(projectedBalance)}>{currency(projectedBalance)} projected balance</span>
          </span>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
        <div className="rounded-lg border border-slate-200 px-3 py-2">
          <div className="text-slate-500 dark:text-slate-400 text-xs">Total</div>
          {editing ? (
            <input
              className="input mt-1"
              type="number"
              value={budget.total}
              onChange={(e) => setTotal(Number(e.currentTarget.value))}
            />
          ) : (
            <div className="font-semibold text-slate-900 dark:text-slate-100">{currency(total)}</div>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 px-3 py-2">
          <div className="text-slate-500 dark:text-slate-400 text-xs">Spent</div>
          <div className="font-semibold text-slate-900 dark:text-slate-100">{currency(spent)}</div>
        </div>
        <div className="rounded-lg border border-slate-200 px-3 py-2">
          <div className="text-slate-500 dark:text-slate-400 text-xs">Projected Spend</div>
          <div className="font-semibold text-slate-900 dark:text-slate-100">{currency(projectedSpend)}</div>
        </div>
        <div className="rounded-lg border border-slate-200 px-3 py-2">
          <div className="text-slate-500 dark:text-slate-400 text-xs">Projected Balance</div>
          <div className={`font-semibold ${colorVal(projectedBalance)}`}>{currency(projectedBalance)}</div>
        </div>
        <div className="rounded-lg border border-slate-200 px-3 py-2">
          <div className="text-slate-500 dark:text-slate-400 text-xs">Spent Balance</div>
          <div className={`font-semibold ${colorVal(spentBalance)}`}>{currency(spentBalance)}</div>
        </div>
      </div>

      {/* Allocation Settings */}
      {(editing || budget.allocationEnabled) && (
        <div className="rounded-lg border border-sky-200 bg-sky-50/60 px-4 py-3 dark:border-sky-800 dark:bg-sky-950/20">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              {editing ? (
                <label className="flex items-center gap-2 cursor-pointer">
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
                  <span className="text-sm font-medium text-sky-800 dark:text-sky-200">
                    Client Allocation Tracking
                  </span>
                </label>
              ) : (
                <span className="flex items-center gap-1.5 text-sm font-semibold text-sky-700 dark:text-sky-300">
                  <span className="inline-block h-2 w-2 rounded-full bg-sky-500" />
                  Client Allocation Mode
                </span>
              )}
            </div>
            {editing && budget.allocationEnabled && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  Grant-level cap / customer ($):
                </label>
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
              <span className="text-xs text-slate-600 dark:text-slate-300">
                Cap: <span className="font-semibold">${num(budget.perCustomerCap).toLocaleString()}</span> / customer
              </span>
            )}
          </div>
          {editing && (
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              Enables the Allocation tab showing per-customer paid + projected totals.
            </p>
          )}
        </div>
      )}

      {/* Line items table */}
      <div className="table-wrap">
        <table className="table text-sm">
          <thead>
            <tr>
              <th>Label</th>
              <th className="w-44" title="Reporting category for grouping line item totals across grants">Type</th>
              <th className="text-right">Amount</th>
              <th className="text-right">Spent</th>
              <th className="text-right">Proj.</th>
              <th className="text-right">Proj. Bal</th>
              <th className="text-right">Spent Bal</th>
              <th className="w-16">Bar</th>
              <th>Locked</th>
              <th title="Per-customer spending cap">Cap</th>
              {editing && <th className="w-24">Cap $</th>}
              {editing && <th />}
            </tr>
          </thead>
          <tbody>
            {budget.lineItems.length === 0 ? (
              <tr>
                <td className="text-slate-500 dark:text-slate-400" colSpan={colCount}>
                  No line items.
                </td>
              </tr>
            ) : (
              budget.lineItems.map((li: any, i: number) => {
                const liAmount = num(li.amount, 0);
                const liSpent = num(li.spent, 0);
                const liProjected = num(li.projected, 0);
                const liProjBal = liAmount - liSpent - liProjected;
                const liSpentBal = liAmount - liSpent;
                const liSafeDenom = liAmount > 0 ? liAmount : 1;
                const liSpentPct = clamp((liSpent / liSafeDenom) * 100, 0, 100);
                const liOverflow = liSpent > liAmount;
                return (
                  <tr key={li.id ?? i}>
                    <td>
                      {editing ? (
                        <input
                          className="input"
                          value={li.label ?? ""}
                          onChange={(e) => updateLineItem(i, { label: e.currentTarget.value })}
                        />
                      ) : (
                        <span className="text-slate-800 dark:text-slate-200">{li.label ?? li.id}</span>
                      )}
                    </td>
                    <td>
                      {editing ? (
                        <>
                          <input
                            className="input"
                            list="grant-line-item-type-options-legacy"
                            placeholder="N/A"
                            value={lineItemTypeLabel(li.type)}
                            onChange={(e) => updateLineItem(i, { type: normalizeLineItemTypeInput(e.currentTarget.value) })}
                            title="Use a default type or type a new category. Blank, NA, or N/A stores no type."
                          />
                          {i === 0 && (
                            <datalist id="grant-line-item-type-options-legacy">
                              {DEFAULT_LINE_ITEM_TYPES.map((type) => (
                                <option key={type.id} value={type.label} />
                              ))}
                              <option value="N/A" />
                            </datalist>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-600 dark:text-slate-300">{lineItemTypeLabel(li.type) || "N/A"}</span>
                      )}
                    </td>
                    <td className="text-right">
                      {editing ? (
                        <input
                          className="input w-28"
                          type="number"
                          value={num(li.amount)}
                          onChange={(e) => updateLineItem(i, { amount: Number(e.currentTarget.value) })}
                        />
                      ) : (
                        <span>{currency(liAmount)}</span>
                      )}
                    </td>
                    <td className="text-right text-slate-700 dark:text-slate-300">{currency(liSpent)}</td>
                    <td className="text-right">
                      {editing ? (
                        <input
                          className="input w-28"
                          type="number"
                          value={num(li.projected)}
                          onChange={(e) => updateLineItem(i, { projected: Number(e.currentTarget.value) })}
                        />
                      ) : (
                        <span className="text-slate-700 dark:text-slate-300">{currency(liProjected)}</span>
                      )}
                    </td>
                    <td className={`text-right ${colorVal(liProjBal)}`}>{currency(liProjBal)}</td>
                    <td className={`text-right ${colorVal(liSpentBal)}`}>{currency(liSpentBal)}</td>
                    <td>
                      {/* Mini bar: 4px tall */}
                      <div className="relative h-1 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`absolute left-0 top-0 h-full ${liOverflow ? "bg-red-400" : "bg-amber-400"}`}
                          style={{ width: `${liSpentPct}%` }}
                        />
                      </div>
                    </td>
                    <td className="text-center">
                      {editing ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => updateLineItem(i, { locked: !li.locked })}
                          title={li.locked ? "Unlock" : "Lock"}
                        >
                          {li.locked ? "🔒" : "🔓"}
                        </button>
                      ) : (
                        <span>{li.locked ? "🔒" : ""}</span>
                      )}
                    </td>
                    {/* Per-customer cap toggle */}
                    <td className="text-center">
                      {editing ? (
                        <button
                          type="button"
                          className={`btn btn-ghost btn-xs ${li.capEnabled ? "text-amber-600" : "text-slate-400"}`}
                          onClick={() => updateLineItem(i, { capEnabled: !li.capEnabled })}
                          title={li.capEnabled ? "Cap enabled — click to disable" : "Cap disabled — click to enable"}
                        >
                          {li.capEnabled ? "🚧" : "–"}
                        </button>
                      ) : li.capEnabled && li.perCustomerCap != null ? (
                        <span className="text-xs font-medium text-amber-700" title={`Per-customer cap: $${li.perCustomerCap}`}>
                          🚧 ${num(li.perCustomerCap).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-slate-300">–</span>
                      )}
                    </td>
                    {/* Cap amount input (editing only) */}
                    {editing && (
                      <td>
                        {li.capEnabled ? (
                          <input
                            className="input w-24"
                            type="number"
                            min={0}
                            placeholder="No limit"
                            value={li.perCustomerCap ?? ""}
                            onChange={(e) =>
                              updateLineItem(i, {
                                perCustomerCap: e.currentTarget.value === "" ? null : Number(e.currentTarget.value),
                              })
                            }
                          />
                        ) : (
                          <span className="text-slate-300 text-xs">off</span>
                        )}
                      </td>
                    )}
                    {editing && (
                      <td className="text-right">
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => removeLineItem(i)}
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
          {budget.lineItems.length > 0 && (
            <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-700">
              <tr>
                <td>Totals</td>
                <td />
                <td className="text-right">{currency(liTotals.liAmount)}</td>
                <td className="text-right">{currency(liTotals.liSpent)}</td>
                <td className="text-right">{currency(liTotals.liProjected)}</td>
                <td className={`text-right ${colorVal(liTotals.liAmount - liTotals.liSpent - liTotals.liProjected)}`}>
                  {currency(liTotals.liAmount - liTotals.liSpent - liTotals.liProjected)}
                </td>
                <td className={`text-right ${colorVal(liTotals.liAmount - liTotals.liSpent)}`}>
                  {currency(liTotals.liAmount - liTotals.liSpent)}
                </td>
                <td />
                <td />
                <td />
                {editing && <td />}
                {editing && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {editing && (
        <div className="flex items-center justify-between">
          <button className="btn btn-secondary btn-sm" onClick={addLineItem}>
            + Line Item
          </button>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Update <span className="font-medium">Projected</span>. <span className="font-medium">Spent</span> is derived from activity.
          </div>
        </div>
      )}
    </div>
  );
}
