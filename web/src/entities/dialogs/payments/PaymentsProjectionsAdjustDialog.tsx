"use client";

import React from "react";
import { Modal } from "@entities/ui/Modal";
import LineItemSelect from "@entities/selectors/LineItemSelect";
import type { TPayment } from "@types";
import type { PaymentsProjectionsAdjustInput } from "@hooks/usePayments";
import { calculateRentCertDueDate, usePaymentRentCert } from "@hooks/usePayments";
import { RentCertToggle, rentCertToggleValue, type RentCertToggleValue } from "./RentCertToggle";
import { fmtCurrencyUSD, fmtDateOrDash } from "@lib/formatters";
import { safeISODate10, todayISO } from "@lib/date";
import { isISO } from "@features/customers/components/paymentScheduleUtils";
import { paymentTypeLabel } from "@entities/payments/PaymentTypeLabel";
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
  kind: "monthlyRent" | "monthlyUtility" | "deposit" | "prorated" | "service" | "arrears";
  comment: string;
};

type Props = {
  open: boolean;
  enrollments: EnrollmentOption[];
  initialEnrollmentId?: string | null;
  paymentIssues?: Record<string, { label: string } | undefined>;
  rentCertDueDates?: Record<string, string | undefined>;
  busy?: boolean;
  onCancel: () => void;
  onApply: (payload: PaymentsProjectionsAdjustInput) => Promise<void> | void;
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

function addRowType(kind: AddRow["kind"]): TPayment["type"] {
  return (kind === "monthlyRent" || kind === "monthlyUtility" ? "monthly" : kind) as TPayment["type"];
}

function addRowNote(row: AddRow): string[] | undefined {
  if (row.kind === "monthlyRent") return ["sub:rent"];
  if (row.kind === "monthlyUtility") return ["sub:utility"];
  return undefined;
}

function signedAmountText(amount: number): string {
  const value = fmtCurrencyUSD(Math.abs(amount));
  if (amount < 0) return `-${value}`;
  return value;
}

export default function PaymentsProjectionsAdjustDialog({
  open,
  enrollments,
  initialEnrollmentId,
  paymentIssues,
  busy = false,
  onCancel,
  onApply,
}: Props) {
  const [enrollmentId, setEnrollmentId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [editedAmounts, setEditedAmounts] = React.useState<Record<string, string>>({});
  const [editedDueDates, setEditedDueDates] = React.useState<Record<string, string>>({});
  const [editedLineItems, setEditedLineItems] = React.useState<Record<string, string>>({});
  const [editedVendors, setEditedVendors] = React.useState<Record<string, string>>({});
  const [bulkVendor, setBulkVendor] = React.useState("");
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
  const [rentCertOverrides, setRentCertOverrides] = React.useState<Record<string, RentCertToggleValue>>({});
  const [pendingRentCertIds, setPendingRentCertIds] = React.useState<Record<string, boolean>>({});
  const rentCertMutation = usePaymentRentCert();

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
    setEditedVendors({});
    setBulkVendor("");
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
    setRentCertOverrides({});
    setPendingRentCertIds({});
  }, [open, enrollments, initialEnrollmentId]);

  const selectedEnrollment = React.useMemo(
    () => enrollments.find((e) => e.id === enrollmentId) || null,
    [enrollmentId, enrollments],
  );

  const lineItemOptions = React.useMemo(
    () => Array.from(new Set((selectedEnrollment?.lineItemIds || []).filter(Boolean))),
    [selectedEnrollment],
  );

  const issueForPayment = React.useCallback(
    (id: string) => paymentIssues?.[`${selectedEnrollment?.id || ""}:${id}`] || null,
    [paymentIssues, selectedEnrollment?.id],
  );

  const payments = React.useMemo(
    () =>
      (selectedEnrollment?.payments || [])
        .filter((p) => paymentId(p))
        .slice()
        .sort((a, b) =>
          `${iso10(a.dueDate || (a as Record<string, unknown>)?.date || "")}|${paymentTypeLabel(a as Record<string, unknown>)}`.localeCompare(
            `${iso10(b.dueDate || (b as Record<string, unknown>)?.date || "")}|${paymentTypeLabel(b as Record<string, unknown>)}`,
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

    const addedTotal = addRows.reduce((sum, r) => {
      const amount = Number(r.amount || 0);
      return sum + (Number.isFinite(amount) && amount !== 0 ? amount : 0);
    }, 0);
    nextTotal += addedTotal;
    for (const row of addRows) {
      const amount = Number(row.amount || 0);
      if (Number.isFinite(amount) && amount !== 0) addDelta(row.lineItemId, amount);
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
      addedCount: addRows.filter((r) => {
        const amount = Number(r.amount || 0);
        return Number.isFinite(amount) && amount !== 0;
      }).length,
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

  const driftedPaidCount = React.useMemo(
    () => payments.filter((p) => Boolean(p.paid) && !!issueForPayment(paymentId(p))).length,
    [payments, issueForPayment],
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

  const setEditVendor = (id: string, value: string) => {
    setEditedVendors((prev) => ({ ...prev, [id]: value }));
  };

  const applyBulkVendor = (futureOnly: boolean) => {
    if (!bulkVendor.trim()) return;
    const today = todayISO();
    setEditedVendors((prev) => {
      const next = { ...prev };
      for (const p of payments) {
        if (Boolean(p.paid) || deletedIds[paymentId(p)]) continue;
        const dueDate = iso10(p.dueDate || (p as Record<string, unknown>)?.date || "");
        if (futureOnly && dueDate && dueDate < today) continue;
        next[paymentId(p)] = bulkVendor.trim();
      }
      return next;
    });
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
    if (!Number.isFinite(amt) || amt < 0) {
      setError("Bulk amount must be 0 or greater.");
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
        comment: "",
      },
    ]);
  };

  const updateProjectionRow = (id: string, patch: Partial<AddRow>) => {
    setAddRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeProjectionRow = (id: string) => {
    setAddRows((prev) => prev.filter((r) => r.id !== id));
  };

  const paidBulkAdjustment = React.useMemo(() => {
    if (paidChangedIds.length <= 1) return null;

    const changedIds = new Set(paidChangedIds);
    const centsByLineItem: Record<string, number> = {};
    let totalCents = 0;
    let amountChangeCount = 0;
    let hasUnsupportedChange = false;
    let missingLineItem = false;

    for (const p of payments) {
      const id = paymentId(p);
      if (!changedIds.has(id)) continue;

      const currentAmountCents = Math.round(Number(p.amount || 0) * 100);
      const nextAmountRaw = editedAmounts[id];
      const amountChanged =
        nextAmountRaw != null &&
        nextAmountRaw !== "" &&
        Number.isFinite(Number(nextAmountRaw)) &&
        Math.round(Number(nextAmountRaw) * 100) !== currentAmountCents;
      const dueChanged =
        editedDueDates[id] != null &&
        editedDueDates[id] !== "" &&
        editedDueDates[id] !== iso10(p.dueDate || (p as Record<string, unknown>)?.date || "");
      const lineChanged =
        editedLineItems[id] != null &&
        editedLineItems[id] !== "" &&
        editedLineItems[id] !== String(p.lineItemId || "");

      if (dueChanged || lineChanged) {
        hasUnsupportedChange = true;
        continue;
      }
      if (!amountChanged) continue;

      const lineItemId = String(p.lineItemId || "").trim();
      if (!lineItemId) {
        missingLineItem = true;
        continue;
      }

      const deltaCents = Math.round(Number(nextAmountRaw) * 100) - currentAmountCents;
      if (deltaCents === 0) continue;
      amountChangeCount += 1;
      totalCents += deltaCents;
      centsByLineItem[lineItemId] = (centsByLineItem[lineItemId] || 0) + deltaCents;
    }

    const rows = Object.entries(centsByLineItem)
      .filter(([, cents]) => cents !== 0)
      .map(([lineItemId, cents]) => ({ lineItemId, amount: cents / 100 }));

    return {
      canAdd: !hasUnsupportedChange && !missingLineItem && rows.length > 0,
      changedCount: amountChangeCount,
      total: totalCents / 100,
      rows,
      reason: hasUnsupportedChange
        ? "Bulk recommendations only cover amount changes; date or line item changes still need one paid row at a time."
        : missingLineItem
          ? "One of the paid rows is missing a line item, so an adjustment row cannot be placed automatically."
          : "",
    };
  }, [paidChangedIds, payments, editedAmounts, editedDueDates, editedLineItems]);

  const addBulkPaidAdjustmentRows = () => {
    if (!paidBulkAdjustment?.canAdd) return;
    const kind = paidBulkAdjustment.total < 0 ? "credit" : "charge";
    const dueDate = todayISO();
    setAddRows((prev) => [
      ...prev,
      ...paidBulkAdjustment.rows.map((row) => ({
        id: rowKey(),
        dueDate,
        amount: row.amount.toFixed(2),
        lineItemId: row.lineItemId,
        kind: "service" as const,
        comment: `Bulk paid ${kind} for ${paidBulkAdjustment.changedCount} edited paid rows`,
      })),
    ]);
    setEditedAmounts((prev) => {
      const next = { ...prev };
      for (const id of paidChangedIds) delete next[id];
      return next;
    });
    setEditedDueDates((prev) => {
      const next = { ...prev };
      for (const id of paidChangedIds) delete next[id];
      return next;
    });
    setEditedLineItems((prev) => {
      const next = { ...prev };
      for (const id of paidChangedIds) delete next[id];
      return next;
    });
    setError(null);
  };

  const submit = async () => {
    setError(null);

    if (!selectedEnrollment?.id) {
      setError("Select an enrollment.");
      return;
    }

    if (paidChangedIds.length > 1) {
      if (paidBulkAdjustment?.canAdd) {
        const kind = paidBulkAdjustment.total < 0 ? "credit" : "charge";
        setError(`Only one payment can be adjusted at a time. Would you like to add a ${kind} of ${signedAmountText(paidBulkAdjustment.total)} instead?`);
      } else {
        setError(paidBulkAdjustment?.reason || "Only one payment can be adjusted at a time.");
      }
      return;
    }

    const driftedPaidChangedIds = paidChangedIds.filter((id) => !!issueForPayment(id));
    if (driftedPaidChangedIds.length > 0) {
      setError("Sync ledger/spend for the flagged paid row before adjusting it.");
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
        const vendorValue = editedVendors[id];
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
        const vendorChanged =
          vendorValue != null &&
          vendorValue !== String((p as Record<string, unknown>).vendor || "");
        if (!amountChanged && !dueDateChanged && !lineItemChanged && !vendorChanged) return null;
        return {
          paymentId: id,
          ...(amountChanged ? { amount: Number(amountValue) } : {}),
          ...(dueDateChanged ? { dueDate: dueDateValue } : {}),
          ...(lineItemChanged ? { lineItemId: lineItemValue } : {}),
          ...(vendorChanged ? { vendor: vendorValue } : {}),
        };
      })
      .filter((r): r is { paymentId: string; amount?: number; dueDate?: string; lineItemId?: string } => !!r);

    for (const edit of edits) {
      if (edit.amount != null && (!Number.isFinite(edit.amount) || edit.amount < 0)) {
        setError("Adjusted unpaid amounts must be 0 or greater.");
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
        ...(r.comment.trim() ? { comment: r.comment.trim() } : {}),
      }));

    for (const row of additions) {
      if (!Number.isFinite(row.amount)) {
        setError("Each added row must have a valid amount.");
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
      if (!Number.isFinite(monthly) || monthly < 0) {
        setError("Future recalc requires a monthly amount of 0 or greater.");
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

    try {
      await onApply(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to apply payment schedule changes.");
    }
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
            <button className="btn btn-sm" onClick={() => void submit()} disabled={busy}>{busy ? "Applying..." : "Apply Changes"}</button>
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

        {error ? <div className="whitespace-pre-line rounded border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-700">{error}</div> : null}

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
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-sm font-medium text-slate-800">Schedule Rows</div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={0}
                step="0.01"
                className="w-36 rounded border border-slate-300 px-2 py-1 text-xs"
                value={bulkFutureAmount}
                onChange={(e) => setBulkFutureAmount(e.currentTarget.value)}
                placeholder="Amount"
              />
              <button type="button" className="btn btn-ghost btn-sm" onClick={applyBulkFutureAmount}>
                Update all future amounts
              </button>
              <span className="text-slate-300">|</span>
              <input
                type="text"
                className="w-40 rounded border border-slate-300 px-2 py-1 text-xs"
                value={bulkVendor}
                onChange={(e) => setBulkVendor(e.currentTarget.value)}
                placeholder="Vendor"
              />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => applyBulkVendor(false)}>
                Update all vendors
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => applyBulkVendor(true)}>
                Update all future vendors
              </button>
              <span className="text-slate-300">|</span>
              <button type="button" className="btn btn-sm" onClick={addProjectionRow}>
                Add Row
              </button>
            </div>
          </div>
          {driftedPaidCount > 0 ? (
            <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {driftedPaidCount} paid row{driftedPaidCount === 1 ? "" : "s"} need ledger/spend sync before paid-row adjustments.
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 bg-white text-slate-500 shadow-[0_1px_0_rgb(226_232_240)]">
                <tr>
                  <th className="px-3 py-2 text-left">Due</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-right">Current</th>
                  <th className="px-3 py-2 text-right">Adjust Amount</th>
                  <th className="px-3 py-2 text-left">Vendor</th>
                  <th className="px-3 py-2 text-center">Paid</th>
                  <th className="px-3 py-2 text-left">Line Item</th>
                  <th className="px-3 py-2 text-left">Rent Cert Due</th>
                  <th className="px-3 py-2 text-center">Delete</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-slate-500" colSpan={9}>No payments in this enrollment.</td>
                  </tr>
                ) : payments.map((p, idx) => {
                  const id = paymentId(p);
                  const paid = Boolean(p.paid);
                  const deleted = Boolean(deletedIds[id]);
                  const issue = paid ? issueForPayment(id) : null;
                  const editDisabled = deleted || !!issue;
                  const currentDueDate = iso10(p.dueDate || (p as Record<string, unknown>)?.date || "");
                  return (
                    <tr key={id} className={["border-t border-slate-100", issue ? "bg-amber-50" : idx % 2 ? "bg-slate-50/60" : "bg-white", deleted ? "opacity-55" : ""].join(" ")}>
                      <td className="px-3 py-2 text-slate-800">
                        <input
                          type="date"
                          className="w-36 rounded border border-slate-300 px-2 py-1"
                          value={editedDueDates[id] ?? currentDueDate}
                          onChange={(e) => setEditDueDate(id, e.currentTarget.value)}
                          disabled={editDisabled}
                          title={issue?.label || `Current: ${fmtDateOrDash(currentDueDate)}`}
                        />
                      </td>
                      <td className="px-3 py-2 text-slate-800">
                        <span className="inline-flex items-center gap-2">
                          <span>{paymentTypeLabel(p as Record<string, unknown>)}</span>
                          {issue ? (
                            <span
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-amber-300 bg-amber-100 text-[11px] font-bold leading-none text-amber-800"
                              title={issue.label}
                            >
                              !
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-slate-800">{fmtCurrencyUSD(Number(p.amount || 0))}</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className="w-28 rounded border border-slate-300 px-2 py-1 text-right"
                          value={editedAmounts[id] ?? ""}
                          onChange={(e) => setEditAmount(id, e.currentTarget.value)}
                          disabled={editDisabled}
                          placeholder={amountText(p.amount)}
                          title={issue?.label || undefined}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          className="w-36 rounded border border-slate-300 px-2 py-1 text-xs"
                          value={editedVendors[id] ?? String((p as Record<string, unknown>).vendor || "")}
                          onChange={(e) => setEditVendor(id, e.currentTarget.value)}
                          disabled={editDisabled || paid}
                          placeholder={paid ? "—" : "Vendor"}
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
                          disabled={editDisabled}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <RentCertToggle
                          value={rentCertOverrides[id] ?? rentCertToggleValue((p as TPayment)?.rentCert)}
                          disabled={deleted || !!pendingRentCertIds[id]}
                          title={`Due ${calculateRentCertDueDate(currentDueDate) || "n/a"} (month prior to ${currentDueDate || "payment date"})`}
                          onChange={(next) => {
                            setRentCertOverrides((prev) => ({ ...prev, [id]: next }));
                            setPendingRentCertIds((prev) => ({ ...prev, [id]: true }));
                            void rentCertMutation.mutateAsync({
                              enrollmentId: selectedEnrollment?.id || "",
                              paymentId: id,
                              status: next,
                              dueDate: calculateRentCertDueDate(currentDueDate),
                            }).catch(() => {
                              setRentCertOverrides((prev) => {
                                const updated = { ...prev };
                                delete updated[id];
                                return updated;
                              });
                              setError("Failed to update rent cert.");
                            }).finally(() => setPendingRentCertIds((prev) => {
                              const updated = { ...prev };
                              delete updated[id];
                              return updated;
                            }));
                          }}
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

        {paidChangedIds.length > 1 && paidBulkAdjustment ? (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                Only one payment can be adjusted at a time.
                {paidBulkAdjustment.canAdd ? (
                  <>
                    {" "}Add a {paidBulkAdjustment.total < 0 ? "credit" : "charge"} of{" "}
                    <b>{signedAmountText(paidBulkAdjustment.total)}</b> instead.
                  </>
                ) : (
                  <> {paidBulkAdjustment.reason}</>
                )}
              </div>
              {paidBulkAdjustment.canAdd ? (
                <button type="button" className="btn btn-sm" onClick={addBulkPaidAdjustmentRows}>
                  Add {paidBulkAdjustment.total < 0 ? "credit" : "charge"}
                </button>
              ) : null}
            </div>
          </div>
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
                  <th className="px-3 py-2 text-left">Comment</th>
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
                        <option value="arrears">Arrears</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input type="number" step="0.01" className="w-28 rounded border border-slate-300 px-2 py-1 text-right" value={r.amount} onChange={(e) => updateProjectionRow(r.id, { amount: e.currentTarget.value })} />
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
                      <input className="w-40 rounded border border-slate-300 px-2 py-1" value={r.comment} onChange={(e) => updateProjectionRow(r.id, { comment: e.currentTarget.value })} />
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

        <details className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <summary className="cursor-pointer text-xs font-medium text-slate-700">Advanced options</summary>
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
        </details>
      </div>
    </Modal>
  );
}
