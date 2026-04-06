"use client";

import React from "react";
import { Modal } from "@entities/ui/Modal";
import LineItemSelect from "@entities/selectors/LineItemSelect";
import type { TPayment } from "@types";
import type { PaymentsProjectionsAdjustInput } from "@hooks/usePayments";
import { fmtCurrencyUSD, fmtDateOrDash } from "@lib/formatters";
import { safeISODate10 } from "@lib/date";
import { isISO } from "@features/customers/components/paymentScheduleUtils";

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

export default function PaymentsProjectionsAdjustDialog({
  open,
  enrollments,
  busy = false,
  onCancel,
  onApply,
}: Props) {
  const [enrollmentId, setEnrollmentId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const [enableSpendEdit, setEnableSpendEdit] = React.useState(false);
  const [spendMode, setSpendMode] = React.useState<"edit" | "delete">("edit");
  const [spendPaymentId, setSpendPaymentId] = React.useState("");
  const [spendNewAmount, setSpendNewAmount] = React.useState("");
  const [spendLineItemId, setSpendLineItemId] = React.useState("");
  const [spendDueDate, setSpendDueDate] = React.useState("");
  const [spendReason, setSpendReason] = React.useState("");
  const [spendNote, setSpendNote] = React.useState("");
  const [spendVendor, setSpendVendor] = React.useState("");
  const [spendComment, setSpendComment] = React.useState("");

  const [enableProjectionAdjust, setEnableProjectionAdjust] = React.useState(false);
  const [editedAmounts, setEditedAmounts] = React.useState<Record<string, string>>({});
  const [deletedProjectionIds, setDeletedProjectionIds] = React.useState<Record<string, boolean>>({});
  const [addRows, setAddRows] = React.useState<AddRow[]>([]);
  const [bulkFutureAmount, setBulkFutureAmount] = React.useState("");

  const [updateGrantBudgets, setUpdateGrantBudgets] = React.useState(true);
  const [recalcGrantProjected, setRecalcGrantProjected] = React.useState(true);
  const [recalcFuture, setRecalcFuture] = React.useState(false);
  const [replaceUnpaid, setReplaceUnpaid] = React.useState(true);
  const [activeOnly, setActiveOnly] = React.useState(true);

  const [futureMonthlyAmount, setFutureMonthlyAmount] = React.useState("");
  const [futureEffectiveFrom, setFutureEffectiveFrom] = React.useState("");
  const [futureLineItemId, setFutureLineItemId] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    const first = enrollments[0]?.id || "";
    setEnrollmentId(first);
    setError(null);

    setEnableSpendEdit(false);
    setSpendMode("edit");
    setSpendPaymentId("");
    setSpendNewAmount("");
    setSpendLineItemId("");
    setSpendDueDate("");
    setSpendReason("");
    setSpendNote("");
    setSpendVendor("");
    setSpendComment("");

    setEnableProjectionAdjust(false);
    setEditedAmounts({});
    setDeletedProjectionIds({});
    setAddRows([]);
    setBulkFutureAmount("");

    setUpdateGrantBudgets(true);
    setRecalcGrantProjected(true);
    setRecalcFuture(false);
    setReplaceUnpaid(true);
    setActiveOnly(true);

    setFutureMonthlyAmount("");
    setFutureEffectiveFrom("");
    setFutureLineItemId("");
  }, [open, enrollments]);

  const selectedEnrollment = React.useMemo(
    () => enrollments.find((e) => e.id === enrollmentId) || null,
    [enrollmentId, enrollments],
  );

  const paidPayments = React.useMemo(
    () => (selectedEnrollment?.payments || []).filter((p) => Boolean(p?.paid) && String(p?.id || "").trim()),
    [selectedEnrollment],
  );

  const unpaidPayments = React.useMemo(
    () => (selectedEnrollment?.payments || []).filter((p) => !p?.paid && String(p?.id || "").trim()),
    [selectedEnrollment],
  );

  const spendSelected = React.useMemo(
    () => paidPayments.find((p) => String(p.id || "") === spendPaymentId) || null,
    [paidPayments, spendPaymentId],
  );

  const lineItemOptions = React.useMemo(() => {
    return Array.from(new Set((selectedEnrollment?.lineItemIds || []).filter(Boolean)));
  }, [selectedEnrollment]);

  const preview = React.useMemo(() => {
    const baseUnpaidTotal = unpaidPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const deletedIds = new Set(
      Object.entries(deletedProjectionIds).filter(([, v]) => v).map(([id]) => id),
    );

    const editedRows = unpaidPayments
      .filter((p) => !deletedIds.has(String(p.id || "")))
      .filter((p) => editedAmounts[String(p.id || "")] != null && editedAmounts[String(p.id || "")] !== "")
      .map((p) => ({
        id: String(p.id || ""),
        before: Number(p.amount || 0),
        after: Number(editedAmounts[String(p.id || "")] || 0),
      }))
      .filter((r) => Number.isFinite(r.after) && r.after > 0);

    const addedTotal = addRows.reduce((s, r) => s + (Number(r.amount || 0) > 0 ? Number(r.amount) : 0), 0);

    const selectedEditedBefore = editedRows.reduce((s, r) => s + r.before, 0);
    const selectedEditedAfter = editedRows.reduce((s, r) => s + r.after, 0);
    const deletedTotal = unpaidPayments
      .filter((p) => deletedIds.has(String(p.id || "")))
      .reduce((s, p) => s + Number(p.amount || 0), 0);

    const nextUnpaidTotal = replaceUnpaid
      ? baseUnpaidTotal - deletedTotal - selectedEditedBefore + selectedEditedAfter + addedTotal
      : baseUnpaidTotal - deletedTotal - selectedEditedBefore + selectedEditedAfter + addedTotal;

    const projectionDelta = nextUnpaidTotal - baseUnpaidTotal;

    let spendDelta = 0;
    if (enableSpendEdit && spendSelected) {
      if (spendMode === "delete") {
        spendDelta = -Number(spendSelected.amount || 0);
      } else if (spendNewAmount !== "") {
        const next = Number(spendNewAmount);
        if (Number.isFinite(next) && next > 0) {
          spendDelta = next - Number(spendSelected.amount || 0);
        }
      }
    }

    return {
      baseUnpaidTotal,
      nextUnpaidTotal,
      projectionDelta,
      spendDelta,
      netDelta: projectionDelta + spendDelta,
      editedCount: editedRows.length,
      deletedCount: deletedIds.size,
      addedCount: addRows.filter((r) => Number(r.amount || 0) > 0).length,
    };
  }, [unpaidPayments, editedAmounts, deletedProjectionIds, addRows, replaceUnpaid, enableSpendEdit, spendSelected, spendMode, spendNewAmount]);

  const setEditAmount = (paymentId: string, value: string) => {
    setEditedAmounts((prev) => ({ ...prev, [paymentId]: value }));
  };

  const toggleDeleteProjection = (paymentId: string, checked: boolean) => {
    setDeletedProjectionIds((prev) => ({ ...prev, [paymentId]: checked }));
    if (checked) {
      setEditedAmounts((prev) => {
        const next = { ...prev };
        delete next[paymentId];
        return next;
      });
    }
  };

  const applyBulkFutureAmount = () => {
    const amt = Number(bulkFutureAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Bulk future amount must be greater than 0.");
      return;
    }
    setError(null);
    const next: Record<string, string> = {};
    for (const p of unpaidPayments) {
      const id = String(p.id || "");
      if (!id) continue;
      if (deletedProjectionIds[id]) continue;
      next[id] = String(amt);
    }
    setEditedAmounts((prev) => ({ ...prev, ...next }));
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

    const payload: PaymentsProjectionsAdjustInput = {
      enrollmentId: selectedEnrollment.id,
      options: {
        updateGrantBudgets,
        recalcGrantProjected: true,
        recalcFuture,
        activeOnly,
      },
    };

    if (enableSpendEdit) {
      if (!spendPaymentId) {
        setError("Select a paid payment to edit or delete.");
        return;
      }

      const deletingPaidRow = spendMode === "delete";

      if (!deletingPaidRow) {
        const amt = Number(spendNewAmount);
        if (!Number.isFinite(amt) || amt <= 0) {
          setError("Spend new amount must be greater than 0.");
          return;
        }
      }

      if (spendDueDate && !isISO(spendDueDate)) {
        setError("Spend due date must be YYYY-MM-DD.");
        return;
      }

      if (!String(spendReason || "").trim()) {
        setError("Reason is required for paid payment edits/deletes.");
        return;
      }

      if (deletingPaidRow) {
        payload.deleteRows = {
          paymentIds: [spendPaymentId],
          preservePaid: false,
          updateBudgets: updateGrantBudgets,
          removeSpends: true,
          reverseLedger: true,
        };
      } else {
        payload.spendAdjustment = {
          paymentId: spendPaymentId,
          newAmount: Number(spendNewAmount),
          ...(spendLineItemId ? { lineItemId: spendLineItemId } : {}),
          ...(spendDueDate ? { dueDate: spendDueDate } : {}),
          ...(spendReason ? { reason: spendReason } : {}),
          ...(spendNote ? { note: spendNote } : {}),
          ...(spendVendor ? { vendor: spendVendor } : {}),
          ...(spendComment ? { comment: spendComment } : {}),
        };
      }
    }

    if (enableProjectionAdjust) {
      const edits = Object.entries(editedAmounts)
        .filter(([, value]) => value !== "")
        .map(([paymentId, value]) => ({ paymentId, amount: Number(value) }))
        .filter((r) => Number.isFinite(r.amount) && r.amount > 0);
      const deleteIds = Object.entries(deletedProjectionIds)
        .filter(([, checked]) => checked)
        .map(([id]) => id);

      const additions = addRows
        .filter((r) => r.amount !== "" || r.dueDate || r.lineItemId)
        .map((r) => ({
          amount: Number(r.amount || 0),
          dueDate: iso10(r.dueDate),
          lineItemId: String(r.lineItemId || "").trim(),
          type: (r.kind === "monthlyRent" || r.kind === "monthlyUtility" ? "monthly" : r.kind) as TPayment["type"],
          note:
            r.kind === "monthlyRent"
              ? (r.note ? ["sub:rent", r.note] : ["sub:rent"])
              : r.kind === "monthlyUtility"
                ? (r.note ? ["sub:utility", r.note] : ["sub:utility"])
                : (r.note ? r.note : undefined),
        }));

      for (const row of additions) {
        if (!Number.isFinite(row.amount) || row.amount <= 0) {
          setError("Each added projection must have amount > 0.");
          return;
        }
        if (!isISO(row.dueDate)) {
          setError("Each added projection requires due date YYYY-MM-DD.");
          return;
        }
        if (!row.lineItemId) {
          setError("Each added projection requires line item ID.");
          return;
        }
      }

      if (edits.length === 0 && additions.length === 0 && deleteIds.length === 0) {
        setError("Add at least one projection edit or new projection row.");
        return;
      }

      payload.projectionAdjustment = {
        edits,
        additions,
        ...(deleteIds.length ? { deleteIds } : {}),
        replaceUnpaid,
      };
    }

    if (!enableSpendEdit && !enableProjectionAdjust && !recalcFuture) {
      setError("Choose at least one action (spend edit, projection adjustment, or recalc future). ");
      return;
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

    onApply(payload);
  };

  return (
    <Modal
      isOpen={open}
      title="Payments & Projections Adjust"
      onClose={onCancel}
      widthClass="max-w-4xl"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <div className="text-xs text-slate-600">Use dedicated endpoints per action (spend, upsert, recalc).</div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>
            <button className="btn btn-sm" onClick={submit} disabled={busy}>{busy ? "Applying..." : "Apply Adjustments"}</button>
          </div>
        </div>
      }
    >
      <div className="relative space-y-4">
        {busy ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded bg-white/75">
            <div className="rounded border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
              Applying payment/projection adjustments...
            </div>
          </div>
        ) : null}
        {error ? <div className="rounded border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-700">{error}</div> : null}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm" title="Pick the enrollment whose paid payments and future projections you want to adjust.">
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
            <div>Grant: <b>{selectedEnrollment?.grantId || "-"}</b></div>
            <div>Payments: <b>{selectedEnrollment?.payments?.length || 0}</b></div>
            <div>Paid: <b>{paidPayments.length}</b> | Unpaid: <b>{unpaidPayments.length}</b></div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <label className="inline-flex items-center gap-2 text-sm font-medium" title="Adjust a paid payment's spend (append-only ledger adjustment) or delete the paid payment row with reversal.">
            <input type="checkbox" checked={enableSpendEdit} onChange={(e) => setEnableSpendEdit(e.currentTarget.checked)} />
            Adjust Existing Paid Payment
          </label>

          {enableSpendEdit ? (
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm md:col-span-2" title="Select a paid payment row to adjust or delete.">
                <div className="mb-1 text-xs text-slate-600">Paid Payment</div>
                <select
                  className="w-full rounded border border-slate-300 px-2 py-1.5"
                  value={spendPaymentId}
                  onChange={(e) => {
                    const id = e.currentTarget.value;
                    setSpendPaymentId(id);
                    const hit = paidPayments.find((p) => String(p.id || "") === id);
                    setSpendNewAmount(hit ? String(Number(hit.amount || 0)) : "");
                    setSpendLineItemId(String(hit?.lineItemId || ""));
                    setSpendDueDate(iso10(hit?.dueDate || (hit as Record<string, unknown>)?.date || ""));
                  }}
                >
                  <option value="">-- Select paid payment --</option>
                  {paidPayments.map((p) => (
                    <option key={String(p.id)} value={String(p.id)}>
                      {fmtDateOrDash(iso10(p.dueDate || (p as Record<string, unknown>)?.date || ""))} | {p.type} | {fmtCurrencyUSD(Number(p.amount || 0))}
                    </option>
                  ))}
                </select>
              </label>

              <div className="md:col-span-2">
                <div className="mb-1 text-xs text-slate-600">Action</div>
                <div className="inline-flex rounded border border-slate-300 bg-white p-0.5 text-xs">
                  <button
                    type="button"
                    className={`rounded px-2 py-1 ${spendMode === "edit" ? "bg-blue-600 text-white" : "text-slate-700"}`}
                    onClick={() => setSpendMode("edit")}
                    title="Edit spend amount/date/vendor/line item/note. This writes a reversal ledger entry and a new corrected ledger entry."
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={`rounded px-2 py-1 ${spendMode === "delete" ? "bg-rose-600 text-white" : "text-slate-700"}`}
                    onClick={() => setSpendMode("delete")}
                    title="Delete the selected paid payment row and reverse/remove the associated spend."
                  >
                    Delete
                  </button>
                </div>
              </div>

              {spendMode === "edit" ? (
                <>
                  <label className="text-sm" title="Updated paid amount. The backend writes a reversal for the old spend and a new corrected spend entry.">
                    <div className="mb-1 text-xs text-slate-600">New Amount</div>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className="w-full rounded border border-slate-300 px-2 py-1.5"
                      value={spendNewAmount}
                      onChange={(e) => setSpendNewAmount(e.currentTarget.value)}
                    />
                  </label>

                  <label className="text-sm" title="Optional new payment due date (YYYY-MM-DD).">
                    <div className="mb-1 text-xs text-slate-600">New Date</div>
                    <input
                      type="date"
                      className="w-full rounded border border-slate-300 px-2 py-1.5"
                      value={spendDueDate}
                      onChange={(e) => setSpendDueDate(e.currentTarget.value)}
                    />
                  </label>

                  <label className="text-sm" title="Optional vendor update stored on the payment/spend snapshot.">
                    <div className="mb-1 text-xs text-slate-600">New Vendor</div>
                    <input
                      className="w-full rounded border border-slate-300 px-2 py-1.5"
                      value={spendVendor}
                      onChange={(e) => setSpendVendor(e.currentTarget.value)}
                    />
                  </label>

                  <label className="text-sm md:col-span-2" title="Required audit reason for this adjustment.">
                    <div className="mb-1 text-xs text-slate-600">Reason (required)</div>
                    <input
                      className="w-full rounded border border-slate-300 px-2 py-1.5"
                      value={spendReason}
                      onChange={(e) => setSpendReason(e.currentTarget.value)}
                      placeholder="Example: corrected amount / moved to different line item / wrong vendor"
                    />
                  </label>
                </>
              ) : (
                <label className="text-sm md:col-span-2" title="Required audit reason for deleting the paid payment row and reversing the spend.">
                  <div className="mb-1 text-xs text-slate-600">Delete Reason (required)</div>
                  <input
                    className="w-full rounded border border-slate-300 px-2 py-1.5"
                    value={spendReason}
                    onChange={(e) => setSpendReason(e.currentTarget.value)}
                    placeholder="Why should this paid payment row be deleted?"
                  />
                </label>
              )}

              {spendMode === "edit" ? (
                <>
                  <label className="text-sm" title="Optional line item reassignment for the paid payment/spend.">
                    <div className="mb-1 text-xs text-slate-600">Line Item ID (optional)</div>
                    <LineItemSelect
                      grantId={selectedEnrollment?.grantId || null}
                      value={spendLineItemId}
                      onChange={(next) => setSpendLineItemId(String(next || ""))}
                      allowEmpty
                      emptyLabel="-- Leave unchanged --"
                      fallbackLineItemIds={lineItemOptions}
                      inputClassName="w-full rounded border border-slate-300 px-2 py-1.5"
                    />
                  </label>

                  <label className="text-sm" title="Optional internal comment on the spend snapshot.">
                    <div className="mb-1 text-xs text-slate-600">Comment (optional)</div>
                    <input
                      className="w-full rounded border border-slate-300 px-2 py-1.5"
                      value={spendComment}
                      onChange={(e) => setSpendComment(e.currentTarget.value)}
                    />
                  </label>

                  <label className="text-sm md:col-span-2" title="Optional note/tags to carry on the adjusted payment/spend snapshot.">
                    <div className="mb-1 text-xs text-slate-600">Note (optional)</div>
                    <input
                      className="w-full rounded border border-slate-300 px-2 py-1.5"
                      value={spendNote}
                      onChange={(e) => setSpendNote(e.currentTarget.value)}
                    />
                  </label>
                  <div className="md:col-span-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    Type changes are not supported for paid spend adjustments. Use projection editing (unpaid rows) for schedule/type changes.
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <label className="inline-flex items-center gap-2 text-sm font-medium" title="Edit existing unpaid projection amounts, remove future projections, and add new future payment rows.">
            <input type="checkbox" checked={enableProjectionAdjust} onChange={(e) => setEnableProjectionAdjust(e.currentTarget.checked)} />
            Edit Existing Projections + Add Payments
          </label>

          {enableProjectionAdjust ? (
            <div className="mt-3 space-y-3">
              <div className="rounded border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">Existing Unpaid Projections</div>
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-44 rounded border border-slate-300 px-2 py-1 text-xs"
                    value={bulkFutureAmount}
                    onChange={(e) => setBulkFutureAmount(e.currentTarget.value)}
                    placeholder="Set all future amounts"
                  />
                  <button className="btn btn-ghost btn-sm" onClick={applyBulkFutureAmount} title="Apply the entered amount to all unpaid projection rows that are not marked for removal.">Apply to All Unpaid</button>
                  <span className="text-xs text-slate-500">Leaves blank fields alone unless you apply this.</span>
                </div>
                <div className="max-h-48 overflow-auto">
                  {unpaidPayments.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-slate-500">No unpaid projections in this enrollment.</div>
                  ) : (
                    <table className="min-w-full text-xs">
                      <thead className="bg-white text-slate-500">
                        <tr>
                          <th className="px-3 py-2 text-left">Due</th>
                          <th className="px-3 py-2 text-left">Type</th>
                          <th className="px-3 py-2 text-left">Current</th>
                          <th className="px-3 py-2 text-left">New Amount</th>
                          <th className="px-3 py-2 text-left">Remove</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unpaidPayments.map((p) => {
                          const pid = String(p.id || "");
                          return (
                            <tr key={pid} className="border-t border-slate-100">
                              <td className="px-3 py-2">{fmtDateOrDash(iso10(p.dueDate || (p as Record<string, unknown>)?.date || ""))}</td>
                              <td className="px-3 py-2">{p.type}</td>
                              <td className="px-3 py-2">{fmtCurrencyUSD(Number(p.amount || 0))}</td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  className="w-32 rounded border border-slate-300 px-2 py-1"
                                  value={editedAmounts[pid] ?? ""}
                                  onChange={(e) => setEditAmount(pid, e.currentTarget.value)}
                                  disabled={!!deletedProjectionIds[pid]}
                                  placeholder="leave blank"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <label className="inline-flex items-center gap-1">
                                  <input
                                    type="checkbox"
                                    checked={!!deletedProjectionIds[pid]}
                                    onChange={(e) => toggleDeleteProjection(pid, e.currentTarget.checked)}
                                  />
                                  <span>remove</span>
                                </label>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="rounded border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
                  <span title="Add future payment projections (rent, utility, deposit, prorated, service).">Add Payments</span>
                  <button className="btn btn-ghost btn-sm" onClick={addProjectionRow} title="Add a new future payment row.">Add Row</button>
                </div>
                <div className="space-y-2 p-3">
                  {addRows.length === 0 ? (
                    <div className="text-xs text-slate-500">No new rows added yet.</div>
                  ) : addRows.map((r) => (
                    <div key={r.id} className="rounded border border-slate-200 p-2">
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
                        <label className="text-xs">
                          <div className="mb-1 text-slate-600">Due Date</div>
                          <input type="date" className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs" value={r.dueDate} onChange={(e) => updateProjectionRow(r.id, { dueDate: e.currentTarget.value })} />
                        </label>
                        <label className="text-xs">
                          <div className="mb-1 text-slate-600">Amount</div>
                          <input type="number" min={0} step="0.01" className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs" value={r.amount} onChange={(e) => updateProjectionRow(r.id, { amount: e.currentTarget.value })} placeholder="amount" />
                        </label>
                        <label className="text-xs">
                          <div className="mb-1 text-slate-600">Payment Type</div>
                          <select className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs" value={r.kind} onChange={(e) => updateProjectionRow(r.id, { kind: e.currentTarget.value as AddRow["kind"] })}>
                            <option value="monthlyRent">Monthly Rent</option>
                            <option value="monthlyUtility">Monthly Util Assistance</option>
                            <option value="deposit">Deposit Assistance</option>
                            <option value="prorated">Prorated Rent</option>
                            <option value="service">Service Payment</option>
                          </select>
                        </label>
                        <label className="text-xs md:col-span-2">
                          <div className="mb-1 text-slate-600">Line Item</div>
                          <LineItemSelect
                            grantId={selectedEnrollment?.grantId || null}
                            value={r.lineItemId}
                            onChange={(next) => updateProjectionRow(r.id, { lineItemId: String(next || "") })}
                            fallbackLineItemIds={lineItemOptions}
                            inputClassName="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
                          />
                        </label>
                        <div className="flex items-end">
                          <button className="btn btn-ghost btn-sm w-full" onClick={() => removeProjectionRow(r.id)} title="Remove this unsaved added payment row.">Remove</button>
                        </div>
                        <label className="text-xs md:col-span-6">
                          <div className="mb-1 text-slate-600">Note (optional)</div>
                          <input className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs" value={r.note} onChange={(e) => updateProjectionRow(r.id, { note: e.currentTarget.value })} placeholder="note / memo (monthly rows auto-tag rent vs utility)" />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 text-xs font-medium text-slate-700">Options</div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 text-sm">
            <label className="inline-flex items-center gap-2" title="Update grant budget spent/projected values immediately after changes."><input type="checkbox" checked={updateGrantBudgets} onChange={(e) => setUpdateGrantBudgets(e.currentTarget.checked)} />Update grant budgets (default ON)</label>
            <label className="inline-flex items-center gap-2" title="Always recalculate grant projected totals after adjust operations."><input type="checkbox" checked={recalcGrantProjected} onChange={() => {}} disabled />Recalculate grant projected totals/projections (always ON)</label>
            <label className="inline-flex items-center gap-2" title="Optional bulk reset of remaining future monthly projections to a new amount. This is not the grant projected-total recalc."><input type="checkbox" checked={recalcFuture} onChange={(e) => setRecalcFuture(e.currentTarget.checked)} />Bulk recalculate future monthly projections (optional)</label>
            <label className="inline-flex items-center gap-2" title="When editing projection rows, replace unpaid rows with the edited/added set while preserving paid rows."><input type="checkbox" checked={replaceUnpaid} onChange={(e) => setReplaceUnpaid(e.currentTarget.checked)} />Replace unpaid projections when adjusting (default ON)</label>
            <label className="inline-flex items-center gap-2" title="Recompute grant values using active enrollments only."><input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.currentTarget.checked)} />Active-only scope (default ON)</label>
          </div>

          {recalcFuture ? (
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
              <input title="New monthly amount to apply to future monthly projections in the selected scope." type="number" min={0} step="0.01" className="rounded border border-slate-300 px-2 py-1.5 text-xs" placeholder="new monthly amount" value={futureMonthlyAmount} onChange={(e) => setFutureMonthlyAmount(e.currentTarget.value)} />
              <input title="Optional effective date (inclusive)." type="date" className="rounded border border-slate-300 px-2 py-1.5 text-xs" value={futureEffectiveFrom} onChange={(e) => setFutureEffectiveFrom(e.currentTarget.value)} />
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
          <div className="font-medium text-slate-800">Preview (estimated)</div>
          <div className="mt-1">Spend delta: <b>{fmtCurrencyUSD(preview.spendDelta)}</b></div>
          <div>Projection delta: <b>{fmtCurrencyUSD(preview.projectionDelta)}</b></div>
          <div>Net delta: <b>{fmtCurrencyUSD(preview.netDelta)}</b></div>
          <div>Unpaid projections: <b>{fmtCurrencyUSD(preview.baseUnpaidTotal)}</b> {"->"} <b>{fmtCurrencyUSD(preview.nextUnpaidTotal)}</b></div>
          <div>Edited rows: <b>{preview.editedCount}</b> | Removed rows: <b>{preview.deletedCount}</b> | Added rows: <b>{preview.addedCount}</b></div>
        </div>
      </div>
    </Modal>
  );
}
