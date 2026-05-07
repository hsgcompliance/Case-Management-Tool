"use client";

import React from "react";
import LineItemSelect from "@entities/selectors/LineItemSelect";
import { isISODate10 } from "@lib/date";

// ─── types ───────────────────────────────────────────────────────────────────

export type SSRowTypeKey =
  | "monthly-rent"
  | "monthly-utility"
  | "prorated"
  | "deposit"
  | "service";

export type SSRow = {
  id: string;
  date: string;
  typeKey: SSRowTypeKey;
  amount: string;
  months: string;
  lineItemId: string;
  vendor: string;
  note: string;
};

// ─── constants ───────────────────────────────────────────────────────────────

export const SS_TYPE_OPTIONS: { value: SSRowTypeKey; label: string }[] = [
  { value: "monthly-rent", label: "Monthly – Rent" },
  { value: "monthly-utility", label: "Monthly – Utility" },
  { value: "prorated", label: "Prorated Rent" },
  { value: "deposit", label: "Security Deposit" },
  { value: "service", label: "Service" },
];

// ─── local helpers ────────────────────────────────────────────────────────────

function isISO(s: string) { return isISODate10(s); }

function asPositiveInt(v: string, max = 120) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(max, Math.floor(n));
}

function addMonthsISO(iso: string, m: number): string {
  if (!isISO(iso)) return iso;
  const [y0, mo0, d0] = iso.split("-").map(Number);
  const total = y0 * 12 + (mo0 - 1) + m;
  const y = Math.floor(total / 12);
  const mo = (total % 12) + 1;
  const last = new Date(y, mo, 0).getDate();
  const d = Math.min(d0, last);
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function ssRowId() {
  return `ss_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// ─── exported factory ─────────────────────────────────────────────────────────

export function newSSRow(typeKey: SSRowTypeKey = "monthly-rent", baseDate = ""): SSRow {
  return {
    id: ssRowId(),
    date: baseDate,
    typeKey,
    amount: "",
    months: "12",
    lineItemId: "",
    vendor: "",
    note: "",
  };
}

// ─── icons ────────────────────────────────────────────────────────────────────

function CopyIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.75}>
      <rect x="5" y="5" width="8" height="9" rx="1.5" />
      <path d="M11 5V3.5A1.5 1.5 0 009.5 2H3.5A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.75}>
      <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── component ────────────────────────────────────────────────────────────────

type Props = {
  rows: SSRow[];
  setRows: React.Dispatch<React.SetStateAction<SSRow[]>>;
  grantId?: string;
};

export function SpreadsheetBuilderView({ rows, setRows, grantId }: Props) {
  function updateRow(id: string, patch: Partial<SSRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function duplicateRow(id: string) {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      if (idx === -1) return prev;
      const src = prev[idx];
      const dup: SSRow = { ...src, id: ssRowId() };
      if (isISO(src.date) && (src.typeKey === "monthly-rent" || src.typeKey === "monthly-utility")) {
        dup.date = addMonthsISO(src.date, asPositiveInt(src.months, 120) || 1);
      }
      return [...prev.slice(0, idx + 1), dup, ...prev.slice(idx + 1)];
    });
  }

  function deleteRow(id: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }

  function addRow() {
    setRows((prev) => {
      const last = prev[prev.length - 1];
      const base = newSSRow(last?.typeKey ?? "monthly-rent");
      if (last?.lineItemId) base.lineItemId = last.lineItemId;
      if (last?.amount) base.amount = last.amount;
      if (last?.vendor) base.vendor = last.vendor;
      if (isISO(last?.date ?? "")) {
        const advance =
          last.typeKey === "monthly-rent" || last.typeKey === "monthly-utility"
            ? asPositiveInt(last.months, 120) || 1
            : 1;
        base.date = addMonthsISO(last.date, advance);
      }
      return [...prev, base];
    });
  }

  const cellInput =
    "w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs focus:border-blue-400 focus:bg-white focus:outline-none dark:focus:bg-slate-800 dark:focus:text-slate-100";

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="min-w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left dark:border-slate-700 dark:bg-slate-800">
            {["#", "Date", "Type", "Amount ($)", "Months", "Line Item", "Vendor", "Note", ""].map((h) => (
              <th
                key={h}
                className="whitespace-nowrap px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const isMonthly =
              row.typeKey === "monthly-rent" || row.typeKey === "monthly-utility";
            const stripe = idx % 2 === 0
              ? "bg-white dark:bg-slate-900"
              : "bg-slate-50 dark:bg-slate-800/60";
            return (
              <tr
                key={row.id}
                className={`group border-b border-slate-100 last:border-0 dark:border-slate-800 ${stripe} transition-colors hover:bg-blue-50/40 dark:hover:bg-blue-900/10`}
              >
                {/* row number */}
                <td className="w-6 select-none px-2 py-1 text-center text-slate-400">
                  {idx + 1}
                </td>

                {/* date */}
                <td className="px-1 py-0.5">
                  <input
                    type="date"
                    value={row.date}
                    onChange={(e) => updateRow(row.id, { date: e.target.value })}
                    className={`${cellInput} w-[7.5rem]`}
                  />
                </td>

                {/* type */}
                <td className="px-1 py-0.5">
                  <select
                    value={row.typeKey}
                    onChange={(e) =>
                      updateRow(row.id, {
                        typeKey: e.target.value as SSRowTypeKey,
                        months:
                          e.target.value !== "monthly-rent" &&
                          e.target.value !== "monthly-utility"
                            ? "1"
                            : row.months,
                      })
                    }
                    className={`${cellInput} w-40`}
                  >
                    {SS_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </td>

                {/* amount */}
                <td className="px-1 py-0.5">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={row.amount}
                    onChange={(e) => updateRow(row.id, { amount: e.target.value })}
                    className={`${cellInput} w-20 text-right`}
                  />
                </td>

                {/* months */}
                <td className="px-1 py-0.5">
                  {isMonthly ? (
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={row.months}
                      onChange={(e) => updateRow(row.id, { months: e.target.value })}
                      className={`${cellInput} w-12 text-center`}
                    />
                  ) : (
                    <span className="px-2 text-slate-300 dark:text-slate-600">—</span>
                  )}
                </td>

                {/* line item */}
                <td className="px-1 py-0.5">
                  <LineItemSelect
                    grantId={grantId}
                    value={row.lineItemId || null}
                    onChange={(val) => updateRow(row.id, { lineItemId: val || "" })}
                    className="w-52"
                    inputClassName="!text-xs !py-[3px] !leading-tight"
                    allowEmpty
                    emptyLabel="— line item —"
                  />
                </td>

                {/* vendor */}
                <td className="px-1 py-0.5">
                  <input
                    type="text"
                    placeholder="Vendor"
                    value={row.vendor}
                    onChange={(e) => updateRow(row.id, { vendor: e.target.value })}
                    className={`${cellInput} w-24`}
                  />
                </td>

                {/* note */}
                <td className="px-1 py-0.5">
                  <input
                    type="text"
                    placeholder="Note"
                    value={row.note}
                    onChange={(e) => updateRow(row.id, { note: e.target.value })}
                    className={`${cellInput} w-28`}
                  />
                </td>

                {/* actions */}
                <td className="px-1 py-0.5">
                  <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => duplicateRow(row.id)}
                      title="Duplicate row below"
                      className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/40"
                    >
                      <CopyIcon />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteRow(row.id)}
                      title="Delete row"
                      className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900">
            <td colSpan={9} className="px-2 py-1.5">
              <button
                type="button"
                onClick={addRow}
                className="flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30"
              >
                <span className="text-sm font-bold leading-none">+</span>
                Add row
              </button>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
