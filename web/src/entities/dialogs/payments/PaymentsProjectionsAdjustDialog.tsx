"use client";

import React from "react";
import { Modal } from "@entities/ui/Modal";
import LineItemSelect from "@entities/selectors/LineItemSelect";
import type { TPayment } from "@types";
import type { PaymentsProjectionsAdjustInput } from "@hooks/usePayments";
import { fmtCurrencyUSD, fmtDateOrDash } from "@lib/formatters";
import { safeISODate10 } from "@lib/date";
import { isISO } from "@features/customers/components/paymentScheduleUtils";
import dynamic from "next/dynamic";

const GrantBudgetStrip = dynamic(
  () => import("@entities/grants/GrantBudgetStrip").then((m) => m.GrantBudgetStrip),
  { ssr: false, loading: () => <div className="h-10 animate-pulse rounded bg-slate-100" /> },
);

type EnrollmentOption = {
  id: string;
  label: string;
  grantId?: string;
  lineItemIds?: string[];
  payments: TPayment[];
};

type AddRow = {
  id: string;
  dueDate: string;
  amount: string;
  lineItemId: string;
  kind: "monthlyRent" | "monthlyUtility" | "deposit" | "prorated" | "service";
  note: string;
};

type Props = {
  open: boolean;
  enrollments: EnrollmentOption[];
  initialEnrollmentId?: string | null;
  busy?: boolean;
  onCancel: () => void;
  onApply: (payload: PaymentsProjectionsAdjustInput) => void;
};

function iso10(value: unknown): string {
  return safeISODate10(value) || "";
}

function rowKey(): string {
  return `row_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function paymentId(p: TPayment): string {
  return String(p?.id || "").trim();
}

function amountText(value: unknown): string {
  const n = Number(value || 0);
  return Number.isFinite(n) && n > 0 ? String(Number(n.toFixed(2))) : "";
}

function typeLabel(p: TPayment): string {
  const type = String(p?.type || "");
  if (type !== "monthly") return type || "-";
  const notes = Array.isArray(p.note) ? p.note : p.note ? [p.note] : [];
  const joined = notes.map((n) => String(n).toLowerCase()).join(" ");
  return joined.includes("utility") ? "monthly (utility)" : "monthly (rent)";
}

function addRowType(kind: AddRow["kind"]): TPayment["type"] {
  return (kind === "monthlyRent" || kind === "monthlyUtility" ? "monthly" : kind) as TPayment["type"];
}

function addRowNote(row: AddRow): string | string[] | undefined {
  if (row.kind === "monthlyRent") return row.note ? ["sub:rent", row.note] : ["sub:rent"];
  if (row.kind === "monthlyUtility") return row.note ? ["sub:utility", row.note] : ["sub:utility"];
  return row.note ? row.note : undefined;
}

export default function PaymentsProjectionsAdjustDialog({
  open,
  enrollments,
  initialEnrollmentId,
  busy = false,
  onCancel,
  onApply,
}: Props) {
  const [enrollmentId, setEnrollmentId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [editedAmounts, setEditedAmounts] = React.useState<Record<string, string>>({});
  const [editedDueDates, setEditedDueDates] = React.useState<Record<string, string>>({});
  const [editedLineItems, setEditedLineItems] = React.useState<Record<string, string>>({});
  const [deletedIds, setDeletedIds] = React.useState<Record<string, boolean>>({});
  const [addRows, setAddRows] = React.useState<AddRow[]>([]);
  const [bulkFutureAmount, setBulkFutureAmount] = React.useState("");
  const [adjustReason, setAdjustReason] = React.useState("");
  const [updateGrantBudgets, setUpdateGrantBudgets] = React.useState(true);
  const [recalcGrantProjected, setRecalcGrantProjected] = React.useState(true);
  const [replaceUnpaid, setReplaceUnpaid] = React.useState(true);
  const [activeOnly, setActiveOnly] = React.useState(true);
  const [recalcFuture, setRecalcFuture] = React.useState(false);
  const [futureMonthlyAmount, setFutureMonthlyAmount] = React.useState("");
  const [futureEffectiveFrom, setFutureEffectiveFrom] = React.useState("");
  const [futureLineItemId, setFutureLineItemId] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    const initial = initialEnrollmentId && enrollments.some((e) => e.id === initialEnrollmentId)
      ? initialEnrollmentId
      : enrollments[0]?.id || "";
    setEnrollmentId(initial);
    setError(null);
    setEditedAmounts({});
    setEditedDueDates({});
    setEditedLineItems({});
    setDeletedIds({});
    setAddRows([]);
    setBulkFutureAmount("");
    setAdjustReason("");
    setUpdateGrantBudgets(true);
    setRecalcGrantProjected(true);
    setReplaceUnpaid(true);
    setActiveOnly(true);
    setRecalcFuture(false);
    setFutureMonthlyAmount("");
    setFutureEffectiveFrom("");
    setFutureLineItemId("");
  }, [open, enrollments, initialEnrollmentId]);

  const selectedEnrollment = React.useMemo(
    () => enrollments.find((e) => e.id === enrollmentId) || null,
    [enrollmentId, enrollments],
  );

  const lineItemOptions = React.useMemo(
    () => Array.from(new Set((selectedEnrollment?.lineItemIds || []).filter(Boolean))),
    [selectedEnrollment],
  );

  const payments = React.useMemo(
    () =>
      (selectedEnrollment?.payments || [])
        .filter((p) => paymentId(p))
        .slice()
        .sort((a, b) =>
          `${iso10(a.dueDate || (a as Record<string, unknown>)?.date || "")}|${typeLabel(a)}`.localeCompare(
            `${iso10(b.dueDate || (b as Record<string, unknown>)?.date || "")}|${typeLabel(b)}`,
          ),
        ),
    [selectedEnrollment],
  );

  const preview = React.useMemo(() => {
    let baseTotal = 0;
    let nextTotal = 0;
    let paidEditCount = 0;
    let unpaidEditCount = 0;
    let paidDeleteCount = 0;
    let unpaidDeleteCount = 0;
    const lineItemDeltas: Record<string, number> = {};

    const addDelta = (lineItemId: string, delta: number) => {
      const key = String(lineItemId || "").trim();
      if (!key || !Number.isFinite(delta) || delta === 0) return;
      lineItemDeltas[key] = (lineItemDeltas[key] || 0) + delta;
    };

    for (const p of payments) {
      const id = paymentId(p);
      const amount = Number(p.amount || 0);
      const paid = Boolean(p.paid);
      const currentLineItemId = String(p.lineItemId || "").trim();
      const nextLineItemId = String(editedLineItems[id] ?? currentLineItemId).trim();
      const dueChanged = Boolean(editedDueDates[id] && editedDueDates[id] !== iso10(p.dueDate || (p as Record<string, unknown>)?.date || ""));
      const lineChanged = Boolean(nextLineItemId && nextLineItemId !== currentLineItemId);
      baseTotal += amount;
      if (deletedIds[id]) {
        if (paid) paidDeleteCount += 1;
        else unpaidDeleteCount += 1;
        addDelta(currentLineItemId, -amount);
        continue;
      }
      const edited = editedAmounts[id];
      if (!paid && !replaceUnpaid && (edited == null || edited === "")) {
        unpaidDeleteCount += 1;
        addDelta(currentLineItemId, -amount);
        continue;
      }
      const nextAmount = edited !== "" && edited != null ? Number(edited) : amount;
      if (Number.isFinite(nextAmount) && nextAmount > 0) {
        nextTotal += nextAmount;
        const amountChanged = Math.round(nextAmount * 100) !== Math.round(amount * 100);
        if (amountChanged || dueChanged || lineChanged) {
          if (paid) paidEditCount += 1;
          else unpaidEditCount += 1;
        }
        if (lineChanged) {
          addDelta(currentLineItemId, -amount);
          addDelta(nextLineItemId, nextAmount);
        } else if (amountChanged) {
          addDelta(currentLineItemId, nextAmount - amount);
        }
      } else {
        nextTotal += amount;
      }
    }

    const addedTotal = addRows.reduce((sum, r) => sum + (Number(r.amount || 0) > 0 ? Number(r.amount) : 0), 0);
    nextTotal += addedTotal;
    for (const row of addRows) {
      const amount = Number(row.amount || 0);
      if (amount > 0) addDelta(row.lineItemId, amount);
    }

    return {
      baseTotal,
      nextTotal,
      netDelta: nextTotal - baseTotal,
      lineItemDeltas,
      paidEditCount,
      unpaidEditCount,
      paidDeleteCount,
      unpaidDeleteCount,
      addedCount: addRows.filter((r) => Number(r.amount || 0) > 0).length,
    };
  }, [payments, editedAmounts, editedDueDates, editedLineItems, deletedIds, addRows, replaceUnpaid]);

  const paidChangedIds = React.useMemo(
    () =>
      payments
        .filter((p) => Boolean(p.paid))
        .map((p) => {
          const id = paymentId(p);
          const next = editedAmounts[id];
          if (deletedIds[id]) return "";
          const amountChanged =
            next != null &&
            next !== "" &&
            Math.round(Number(next) * 100) !== Math.round(Number(p.amount || 0) * 100);
          const dueChanged =
            editedDueDates[id] != null &&
            editedDueDates[id] !== "" &&
            editedDueDates[id] !== iso10(p.dueDate || (p as Record<string, unknown>)?.date || "");
          const lineChanged =
            editedLineItems[id] != null &&
            editedLineItems[id] !== "" &&
            editedLineItems[id] !== String(p.lineItemId || "");
          return amountChanged || dueChanged || lineChanged ? id : "";
        })
        .filter(Boolean),
    [payments, editedAmounts, editedDueDates, editedLineItems, deletedIds],
  );

  const setEditAmount = (id: string, value: string) => {
    setDeletedIds((prev) => ({ ...prev, [id]: false }));
    setEditedAmounts((prev) => ({ ...prev, [id]: value }));
  };

  const setEditDueDate = (id: string, value: string) => {
    setDeletedIds((prev) => ({ ...prev, [id]: false }));
    setEditedDueDates((prev) => ({ ...prev, [id]: value }));
  };

  const setEditLineItem = (id: string, value: string) => {
    setDeletedIds((prev) => ({ ...prev, [id]: false }));
    setEditedLineItems((prev) => ({ ...prev, [id]: value }));
  };

  const toggleDelete = (id: string, checked: boolean) => {
    setDeletedIds((prev) => ({ ...prev, [id]: checked }));
    if (checked) {
      setEditedAmounts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setEditedDueDates((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setEditedLineItems((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const applyBulkFutureAmount = () => {
    const amt = Number(bulkFutureAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Bulk amount must be greater than 0.");
      return;
    }
    setError(null);
    setEditedAmounts((prev) => {
      const next = { ...prev };
      for (const p of payments) {
        const id = paymentId(p);
        if (!id || Boolean(p.paid) || deletedIds[id]) continue;
        next[id] = String(amt);
      }
      return next;
    });
  };

  const addProjectionRow = () => {
    setAddRows((prev) => [
      ...prev,
      {
        id: rowKey(),
        dueDate: "",
        amount: "",
        lineItemId: lineItemOptions[0] || "",
        kind: "monthlyRent",
        note: "",
      },
    ]);
  };

  const updateProjectionRow = (id: string, patch: Partial<AddRow>) => {
    setAddRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeProjectionRow = (id: string) => {
    setAddRows((prev) => prev.filter((r) => r.id !== id));
  };

  const submit = () => {
    setError(null);

    if (!selectedEnrollment?.id) {
      setError("Select an enrollment.");
      return;
    }

    if (paidChangedIds.length > 1) {
      setError("Only one paid row can be adjusted at a time because paid edits write ledger reversals.");
      return;
    }

    const paidDeleteIds = payments.filter((p) => Boolean(p.paid) && deletedIds[paymentId(p)]).map(paymentId);
    const unpaidDeleteIds = payments.filter((p) => !p.paid && deletedIds[paymentId(p)]).map(paymentId);
    const needsReason = paidDeleteIds.length > 0 || paidChangedIds.length > 0;
    if (needsReason && !adjustReason.trim()) {
      setError("Reason is required when changing or deleting paid rows.");
      return;
    }

    const payload: PaymentsProjectionsAdjustInput = {
      enrollmentId: selectedEnrollment.id,
      options: {
        updateGrantBudgets,
        recalcGrantProjected,
        recalcFuture,
        activeOnly,
      },
    };

    if (paidDeleteIds.length) {
      payload.deleteRows = {
        paymentIds: paidDeleteIds,
        preservePaid: false,
        updateBudgets: updateGrantBudgets,
        removeSpends: true,
        reverseLedger: true,
      };
    }

    if (paidChangedIds.length === 1) {
      const id = paidChangedIds[0];
      const base = payments.find((p) => paymentId(p) === id);
      const amt = editedAmounts[id] == null || editedAmounts[id] === "" ? Number(base?.amount || 0) : Number(editedAmounts[id]);
      const dueDate = editedDueDates[id] || "";
      const lineItemId = editedLineItems[id] || "";
      if (!Number.isFinite(amt) || amt <= 0) {
        setError("Paid row adjusted amount must be greater than 0.");
        return;
      }
      if (dueDate && !isISO(dueDate)) {
        setError("Paid row adjusted date must be YYYY-MM-DD.");
        return;
      }
      payload.spendAdjustment = {
        paymentId: id,
        newAmount: amt,
        ...(dueDate ? { dueDate } : {}),
        ...(lineItemId ? { lineItemId } : {}),
        reason: adjustReason.trim(),
      };
    }

    const edits = payments
      .filter((p) => !p.paid)
      .map((p) => {
        const id = paymentId(p);
        if (deletedIds[id]) return null;
        const amountValue = editedAmounts[id];
        const dueDateValue = editedDueDates[id];
        const lineItemValue = editedLineItems[id];
        const amountChanged =
          amountValue != null &&
          amountValue !== "" &&
          Math.round(Number(amountValue) * 100) !== Math.round(Number(p.amount || 0) * 100);
        const dueDateChanged =
          dueDateValue != null &&
          dueDateValue !== "" &&
          dueDateValue !== iso10(p.dueDate || (p as Record<string, unknown>)?.date || "");
        const lineItemChanged =
          lineItemValue != null &&
          lineItemValue !== "" &&
          lineItemValue !== String(p.lineItemId || "");
        if (!amountChanged && !dueDateChanged && !lineItemChanged) return null;
        return {
          paymentId: id,
          ...(amountChanged ? { amount: Number(amountValue) } : {}),
          ...(dueDateChanged ? { dueDate: dueDateValue } : {}),
          ...(lineItemChanged ? { lineItemId: lineItemValue } : {}),
        };
      })
      .filter((r): r is { paymentId: string; amount?: number; dueDate?: string; lineItemId?: string } => !!r);

    for (const edit of edits) {
      if (edit.amount != null && (!Number.isFinite(edit.amount) || edit.amount <= 0)) {
        setError("Adjusted unpaid amounts must be greater than 0.");
        return;
      }
      if (edit.dueDate && !isISO(edit.dueDate)) {
        setError("Adjusted unpaid dates must be YYYY-MM-DD.");
        return;
      }
    }

    const additions = addRows
      .filter((r) => r.amount !== "" || r.dueDate || r.lineItemId)
      .map((r) => ({
        amount: Number(r.amount || 0),
        dueDate: iso10(r.dueDate),
        lineItemId: String(r.lineItemId || "").trim(),
        type: addRowType(r.kind),
        note: addRowNote(r),
      }));

    for (const row of additions) {
      if (!Number.isFinite(row.amount) || row.amount <= 0) {
        setError("Each added row must have amount > 0.");
        return;
      }
      if (!isISO(row.dueDate)) {
        setError("Each added row requires a due date.");
        return;
      }
      if (!row.lineItemId) {
        setError("Each added row requires a line item.");
        return;
      }
    }

    if (edits.length || additions.length || unpaidDeleteIds.length) {
      payload.projectionAdjustment = {
        edits,
        additions,
        ...(unpaidDeleteIds.length ? { deleteIds: unpaidDeleteIds } : {}),
        replaceUnpaid,
      };
    }

    if (recalcFuture) {
      const monthly = Number(futureMonthlyAmount);
      if (!Number.isFinite(monthly) || monthly <= 0) {
        setError("Future recalc requires monthly amount > 0.");
        return;
      }
      if (futureEffectiveFrom && !isISO(futureEffectiveFrom)) {
        setError("Future effective-from must be YYYY-MM-DD.");
        return;
      }
      payload.recalcFutureInput = {
        newMonthlyAmount: monthly,
        ...(futureLineItemId ? { lineItemId: futureLineItemId } : {}),
        ...(futureEffectiveFrom ? { effectiveFrom: futureEffectiveFrom } : {}),
      };
    }

    if (!payload.deleteRows && !payload.spendAdjustment && !payload.projectionAdjustment && !recalcFuture) {
      setError("Make at least one schedule change, add a row, delete a row, or enable future recalc.");
      return;
    }

    onApply(payload);
  };

  return (
    <Modal
      isOpen={open}
      title="Adjust Payment Schedule"
      onClose={onCancel}
      widthClass="max-w-6xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-slate-600">
            Paid row amount changes and paid deletes are reversed through the ledger. Unpaid rows update the schedule.
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>
            <button className="btn btn-sm" onClick={submit} disabled={busy}>{busy ? "Applying..." : "Apply Changes"}</button>
          </div>
        </div>
      }
    >
      <div className="relative space-y-4">
        {busy ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded bg-white/75">
            <div className="rounded border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
              Applying payment schedule changes...
            </div>
          </div>
        ) : null}

        {error ? <div className="rounded border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-700">{error}</div> : null}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_20rem]">
          <label className="text-sm">
            <div className="mb-1 text-xs text-slate-600">Enrollment</div>
            <select
              className="w-full rounded border border-slate-300 px-2 py-1.5"
              value={enrollmentId}
              onChange={(e) => setEnrollmentId(e.currentTarget.value)}
            >
              <option value="">-- Select enrollment --</option>
              {enrollments.map((e) => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </select>
          </label>

          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <div>Rows: <b>{payments.length}</b></div>
            <div>Paid edits: <b>{preview.paidEditCount}</b> | Paid deletes: <b>{preview.paidDeleteCount}</b></div>
            <div>Unpaid edits: <b>{preview.unpaidEditCount}</b> | Unpaid deletes: <b>{preview.unpaidDeleteCount}</b></div>
          </div>
        </div>

        <GrantBudgetStrip
          grantId={selectedEnrollment?.grantId}
          projectionDelta={preview.netDelta}
          lineItemDeltas={preview.lineItemDeltas}
        />

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-sm font-medium text-slate-800">Schedule Rows</div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={0}
                step="0.01"
                className="w-40 rounded border border-slate-300 px-2 py-1 text-xs"
                value={bulkFutureAmount}
                onChange={(e) => setBulkFutureAmount(e.currentTarget.value)}
                placeholder="Set all unpaid"
              />
              <button type="button" className="btn btn-ghost btn-sm" onClick={applyBulkFutureAmount}>
                Apply to Unpaid
              </button>
              <button type="button" className="btn btn-sm" onClick={addProjectionRow}>
                Add Row
              </button>
            </div>
          </div>

          <div className="max-h-[24rem] overflow-auto">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 bg-white text-slate-500 shadow-[0_1px_0_rgb(226_232_240)]">
                <tr>
                  <th className="px-3 py-2 text-left">Due</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-right">Current</th>
                  <th className="px-3 py-2 text-right">Adjust Amount</th>
                  <th className="px-3 py-2 text-center">Paid</th>
                  <th className="px-3 py-2 text-left">Line Item</th>
                  <th className="px-3 py-2 text-center">Delete</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-slate-500" colSpan={7}>No payments in this enrollment.</td>
                  </tr>
                ) : payments.map((p, idx) => {
                  const id = paymentId(p);
                  const paid = Boolean(p.paid);
                  const deleted = Boolean(deletedIds[id]);
                  const currentDueDate = iso10(p.dueDate || (p as Record<string, unknown>)?.date || "");
                  return (
                    <tr key={id} className={["border-t border-slate-100", idx % 2 ? "bg-slate-50/60" : "bg-white", deleted ? "opacity-55" : ""].join(" ")}>
                      <td className="px-3 py-2 text-slate-800">
                        <input
                          type="date"
                          className="w-36 rounded border border-slate-300 px-2 py-1"
                          value={editedDueDates[id] ?? currentDueDate}
                          onChange={(e) => setEditDueDate(id, e.currentTarget.value)}
                          disabled={deleted}
                          title={`Current: ${fmtDateOrDash(currentDueDate)}`}
                        />
                      </td>
                      <td className="px-3 py-2 text-slate-800">{typeLabel(p)}</td>
                      <td className="px-3 py-2 text-right text-slate-800">{fmtCurrencyUSD(Number(p.amount || 0))}</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className="w-28 rounded border border-slate-300 px-2 py-1 text-right"
                          value={editedAmounts[id] ?? ""}
                          onChange={(e) => setEditAmount(id, e.currentTarget.value)}
                          disabled={deleted}
                          placeholder={amountText(p.amount)}
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={paid} readOnly aria-label={paid ? "Paid" : "Unpaid"} />
                      </td>
                      <td className="px-3 py-2">
                        <LineItemSelect
                          grantId={selectedEnrollment?.grantId || null}
                          value={editedLineItems[id] ?? String(p.lineItemId || "")}
                          onChange={(next) => setEditLineItem(id, String(next || ""))}
                          fallbackLineItemIds={lineItemOptions}
                          inputClassName="w-56 rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={deleted}
                          onChange={(e) => toggleDelete(id, e.currentTarget.checked)}
                          aria-label="Delete row"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {paidChangedIds.length > 0 || preview.paidDeleteCount > 0 ? (
          <label className="block text-sm">
            <div className="mb-1 text-xs text-slate-600">Reason for paid-row ledger reversal</div>
            <input
              className="w-full rounded border border-slate-300 px-2 py-1.5"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.currentTarget.value)}
              placeholder="Example: corrected amount, duplicate row, wrong payment"
            />
          </label>
        ) : null}

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">
            <span>New Rows</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={addProjectionRow}>Add Row</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-white text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Due</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-left">Line Item</th>
                  <th className="px-3 py-2 text-left">Note</th>
                  <th className="px-3 py-2 text-left"> </th>
                </tr>
              </thead>
              <tbody>
                {addRows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-slate-500" colSpan={6}>No new rows added.</td>
                  </tr>
                ) : addRows.map((r, idx) => (
                  <tr key={r.id} className={["border-t border-slate-100", idx % 2 ? "bg-slate-50/60" : "bg-white"].join(" ")}>
                    <td className="px-3 py-2">
                      <input type="date" className="w-36 rounded border border-slate-300 px-2 py-1" value={r.dueDate} onChange={(e) => updateProjectionRow(r.id, { dueDate: e.currentTarget.value })} />
                    </td>
                    <td className="px-3 py-2">
                      <select className="w-44 rounded border border-slate-300 px-2 py-1" value={r.kind} onChange={(e) => updateProjectionRow(r.id, { kind: e.currentTarget.value as AddRow["kind"] })}>
                        <option value="monthlyRent">Monthly Rent</option>
                        <option value="monthlyUtility">Monthly Utility</option>
                        <option value="deposit">Deposit</option>
                        <option value="prorated">Prorated</option>
                        <option value="service">Service</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input type="number" min={0} step="0.01" className="w-28 rounded border border-slate-300 px-2 py-1 text-right" value={r.amount} onChange={(e) => updateProjectionRow(r.id, { amount: e.currentTarget.value })} />
                    </td>
                    <td className="px-3 py-2">
                      <LineItemSelect
                        grantId={selectedEnrollment?.grantId || null}
                        value={r.lineItemId}
                        onChange={(next) => updateProjectionRow(r.id, { lineItemId: String(next || "") })}
                        fallbackLineItemIds={lineItemOptions}
                        inputClassName="w-56 rounded border border-slate-300 px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input className="w-40 rounded border border-slate-300 px-2 py-1" value={r.note} onChange={(e) => updateProjectionRow(r.id, { note: e.currentTarget.value })} />
                    </td>
                    <td className="px-3 py-2">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeProjectionRow(r.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 text-xs font-medium text-slate-700">Options</div>
          <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={replaceUnpaid} onChange={(e) => setReplaceUnpaid(e.currentTarget.checked)} />Preserve untouched unpaid rows</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={updateGrantBudgets} onChange={(e) => setUpdateGrantBudgets(e.currentTarget.checked)} />Update grant budgets</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={recalcGrantProjected} onChange={(e) => setRecalcGrantProjected(e.currentTarget.checked)} />Recalculate grant projected totals</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.currentTarget.checked)} />Active-only scope</label>
            <label className="inline-flex items-center gap-2 md:col-span-2"><input type="checkbox" checked={recalcFuture} onChange={(e) => setRecalcFuture(e.currentTarget.checked)} />Bulk recalculate future monthly projections</label>
          </div>

          {recalcFuture ? (
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
              <input type="number" min={0} step="0.01" className="rounded border border-slate-300 px-2 py-1.5 text-xs" placeholder="new monthly amount" value={futureMonthlyAmount} onChange={(e) => setFutureMonthlyAmount(e.currentTarget.value)} />
              <input type="date" className="rounded border border-slate-300 px-2 py-1.5 text-xs" value={futureEffectiveFrom} onChange={(e) => setFutureEffectiveFrom(e.currentTarget.value)} />
              <LineItemSelect
                grantId={selectedEnrollment?.grantId || null}
                value={futureLineItemId}
                onChange={(next) => setFutureLineItemId(String(next || ""))}
                allowEmpty
                emptyLabel="-- Any line item --"
                fallbackLineItemIds={lineItemOptions}
                inputClassName="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
              />
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700">
          <div className="font-medium text-slate-800">Preview</div>
          <div className="mt-1">Schedule total: <b>{fmtCurrencyUSD(preview.baseTotal)}</b> {"->"} <b>{fmtCurrencyUSD(preview.nextTotal)}</b></div>
          <div>Net delta: <b>{fmtCurrencyUSD(preview.netDelta)}</b></div>
          <div>Edited paid rows: <b>{preview.paidEditCount}</b> | Edited unpaid rows: <b>{preview.unpaidEditCount}</b> | Deleted rows: <b>{preview.paidDeleteCount + preview.unpaidDeleteCount}</b> | Added rows: <b>{preview.addedCount}</b></div>
        </div>
      </div>
    </Modal>
  );
}
