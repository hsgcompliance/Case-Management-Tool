"use client";

import React from "react";
import { Modal } from "@entities/ui/Modal";
import { GrantBudgetStrip } from "@entities/grants/GrantBudgetStrip";
import GrantSelect from "@entities/selectors/GrantSelect";
import LineItemSelect from "@entities/selectors/LineItemSelect";
import CreditCardSelect from "@entities/selectors/CreditCardSelect";
import type { LedgerCreateReq } from "@types";
import { toISODate } from "@lib/date";
import { fmtCurrencyUSD } from "@lib/formatters";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CardInvoiceEntryMode =
  | "manual-cc"       // New CC spend recorded directly to ledger
  | "manual-invoice"  // New invoice spend recorded directly to ledger
  | "adjustment"      // Positive or negative correction against a grant/LI
  | "reversal";       // Compensating negative entry for a previously posted item

type ModeConfig = {
  title: string;
  description: string;
  ledgerSource: "card" | "manual" | "adjustment";
  defaultSign: 1 | -1;
  showCardSelect: boolean;
  noteLabel: string;
  notePlaceholder: string;
};

const MODE_CONFIG: Record<CardInvoiceEntryMode, ModeConfig> = {
  "manual-cc": {
    title: "Record CC Spend",
    description:
      "Create a manual credit card ledger entry. Use when a transaction wasn't captured via Jotform, or the queued amount was wrong (void the queue item first, then use this).",
    ledgerSource: "card",
    defaultSign: 1,
    showCardSelect: true,
    noteLabel: "Note",
    notePlaceholder: "Transaction description...",
  },
  "manual-invoice": {
    title: "Record Invoice Payment",
    description:
      "Create a manual invoice ledger entry. Use for vendor payments that need to be applied directly to a grant line item.",
    ledgerSource: "manual",
    defaultSign: 1,
    showCardSelect: false,
    noteLabel: "Note",
    notePlaceholder: "Invoice description...",
  },
  "adjustment": {
    title: "Budget Adjustment",
    description:
      "Create a positive or negative adjustment against a grant line item. Positive = adds to spend (debit). Negative = reduces spend (credit).",
    ledgerSource: "adjustment",
    defaultSign: 1,
    showCardSelect: false,
    noteLabel: "Adjustment reason",
    notePlaceholder: "Why is this adjustment needed?",
  },
  "reversal": {
    title: "Create Reversal",
    description:
      "Create a compensating negative entry to reverse a previously posted amount. The original entry is not deleted — this writes a matching credit record.",
    ledgerSource: "adjustment",
    defaultSign: -1,
    showCardSelect: false,
    noteLabel: "Reversal reason",
    notePlaceholder: "Why is this being reversed?",
  },
};

export type CardInvoiceEntryDialogProps = {
  open: boolean;
  mode: CardInvoiceEntryMode;
  // Context for reversal/adjustment — pre-seeds the form
  sourceEntryId?: string;
  sourceAmountCents?: number;
  sourceGrantId?: string;
  sourceLineItemId?: string;
  sourceCreditCardId?: string;
  sourceDate?: string;
  sourceCustomerId?: string;
  sourceNote?: string;
  busy?: boolean;
  onCancel: () => void;
  onSave: (body: LedgerCreateReq) => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayISO() {
  return toISODate(new Date());
}

function parseDollarAmount(str: string): number {
  const n = Number(str);
  return Number.isFinite(n) && n > 0 ? Number(n.toFixed(2)) : 0;
}

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

export default function CardInvoiceEntryDialog({
  open,
  mode,
  sourceEntryId,
  sourceAmountCents,
  sourceGrantId,
  sourceLineItemId,
  sourceCreditCardId,
  sourceDate,
  sourceCustomerId,
  sourceNote,
  busy = false,
  onCancel,
  onSave,
}: CardInvoiceEntryDialogProps) {
  const cfg = MODE_CONFIG[mode];

  const [amountStr, setAmountStr] = React.useState("");
  const [sign, setSign] = React.useState<1 | -1>(cfg.defaultSign);
  const [date, setDate] = React.useState(todayISO());
  const [grantId, setGrantId] = React.useState("");
  const [lineItemId, setLineItemId] = React.useState("");
  const [creditCardId, setCreditCardId] = React.useState("");
  const [note, setNote] = React.useState("");
  const [vendor, setVendor] = React.useState("");
  const [comment, setComment] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const c = MODE_CONFIG[mode];
    setSign(c.defaultSign);
    setDate(sourceDate || todayISO());
    setGrantId(sourceGrantId || "");
    setLineItemId(sourceLineItemId || "");
    setCreditCardId(sourceCreditCardId || "");
    setNote("");
    setVendor("");
    setComment("");
    setError(null);
    if (mode === "reversal" && sourceAmountCents != null) {
      setAmountStr(String(Math.abs(sourceAmountCents) / 100));
    } else {
      setAmountStr("");
    }
  }, [open, mode, sourceGrantId, sourceLineItemId, sourceCreditCardId, sourceDate, sourceAmountCents]);

  const parsedAmount = parseDollarAmount(amountStr);
  const isValidAmount = parsedAmount > 0;
  const signedAmountCents = isValidAmount ? Math.round(parsedAmount * 100) * sign : 0;
  const signedAmountDollars = signedAmountCents / 100;
  const isNegative = signedAmountCents < 0;

  // projectionDelta: positive = more spend (Projected +delta, Proj.Balance -delta)
  const projectionDelta = isValidAmount ? signedAmountDollars : 0;

  const submit = () => {
    setError(null);

    if (!isValidAmount) return setError("Amount must be greater than 0.");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError("Date must be YYYY-MM-DD.");
    if (grantId && !lineItemId) return setError("Select a line item when a grant is assigned.");
    if (!grantId && mode !== "adjustment") {
      return setError("Grant and line item are required.");
    }

    const noteLines: string[] = [];
    if (note.trim()) noteLines.push(note.trim());
    if (mode === "reversal" && sourceEntryId) noteLines.push(`Reversal of: ${sourceEntryId}`);

    const labels: string[] =
      mode === "reversal" ? ["reversal"]
      : mode === "adjustment" ? ["adjustment"]
      : [];

    onSave({
      source: cfg.ledgerSource,
      amountCents: signedAmountCents,
      amount: signedAmountDollars,
      dueDate: date,
      grantId: grantId || null,
      lineItemId: lineItemId || null,
      creditCardId: creditCardId || null,
      customerId: sourceCustomerId || null,
      note: noteLines.length === 1 ? noteLines[0] : noteLines.length > 1 ? noteLines : undefined,
      vendor: vendor.trim() || undefined,
      comment: comment.trim() || undefined,
      labels,
    });
  };

  const amountDisplay = isValidAmount ? fmtCurrencyUSD(parsedAmount) : null;
  const signedDisplay = amountDisplay
    ? isNegative ? `−${amountDisplay}` : amountDisplay
    : null;

  return (
    <Modal
      isOpen={open}
      title={cfg.title}
      onClose={onCancel}
      widthClass="max-w-xl"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <div className="text-xs text-slate-500">
            {isNegative
              ? "Credit — reduces ledger spend on this line item"
              : "Debit — adds to ledger spend on this line item"}
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary btn-sm" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button className="btn btn-sm" onClick={submit} disabled={busy}>
              {busy ? "Saving..." : "Create Entry"}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Mode description */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {cfg.description}
        </div>

        {error && (
          <div className="rounded border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-700">
            {error}
          </div>
        )}

        {/* Source entry context for reversal */}
        {sourceEntryId && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
            <div className="font-semibold text-amber-800 mb-1">Reversing Entry</div>
            <div className="text-slate-700">
              ID: <span className="font-mono">{sourceEntryId}</span>
            </div>
            {sourceAmountCents != null && (
              <div className="text-slate-700">
                Original amount:{" "}
                <b>{fmtCurrencyUSD(Math.abs(sourceAmountCents) / 100)}</b>
              </div>
            )}
            {sourceNote && (
              <div className="text-slate-600 mt-0.5">
                Note: {typeof sourceNote === "string" ? sourceNote : JSON.stringify(sourceNote)}
              </div>
            )}
          </div>
        )}

        {/* Amount + sign toggle (adjustment mode only) */}
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-xs font-medium text-slate-700">Amount</span>
            {mode === "adjustment" && (
              <div className="inline-flex rounded border border-slate-300 bg-white p-0.5 text-xs">
                <button
                  type="button"
                  className={`rounded px-2.5 py-0.5 ${sign === 1 ? "bg-sky-600 text-white" : "text-slate-700"}`}
                  onClick={() => setSign(1)}
                >
                  + Debit
                </button>
                <button
                  type="button"
                  className={`rounded px-2.5 py-0.5 ${sign === -1 ? "bg-rose-600 text-white" : "text-slate-700"}`}
                  onClick={() => setSign(-1)}
                >
                  − Credit
                </button>
              </div>
            )}
            {isNegative && mode !== "adjustment" && (
              <span className="text-xs font-semibold text-rose-600 uppercase tracking-wide">Negative / Credit</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step="0.01"
              className={`flex-1 rounded border px-2 py-1.5 text-sm tabular-nums ${
                isNegative
                  ? "border-rose-300 bg-rose-50 text-rose-700"
                  : "border-slate-300"
              }`}
              value={amountStr}
              onChange={(e) => setAmountStr(e.currentTarget.value)}
              placeholder="0.00"
              autoFocus
            />
            {signedDisplay && (
              <span
                className={`text-sm font-bold tabular-nums shrink-0 ${
                  isNegative ? "text-rose-600" : "text-slate-800"
                }`}
              >
                {signedDisplay}
              </span>
            )}
          </div>
        </div>

        {/* Date */}
        <label className="block">
          <div className="mb-1 text-xs font-medium text-slate-700">Date</div>
          <input
            type="date"
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={date}
            onChange={(e) => setDate(e.currentTarget.value)}
          />
        </label>

        {/* Grant + Line Item + Budget Strip */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-700">
            Grant &amp; Line Item
            {mode !== "adjustment" && <span className="ml-1 text-rose-500">*</span>}
          </div>
          <GrantSelect
            value={grantId || null}
            onChange={(v) => {
              setGrantId(String(v || ""));
              setLineItemId("");
            }}
            includeUnassigned
          />
          {grantId && (
            <GrantBudgetStrip grantId={grantId} projectionDelta={projectionDelta} />
          )}
          <div>
            <div className="mb-1 text-xs text-slate-600 flex items-center gap-1">
              Line Item
              {grantId && !lineItemId && (
                <span className="text-amber-600 font-medium">(required — select a line item)</span>
              )}
            </div>
            <LineItemSelect
              grantId={grantId || null}
              value={lineItemId || null}
              onChange={(v) => setLineItemId(String(v || ""))}
              inputClassName="w-full"
            />
          </div>
        </div>

        {/* Credit card */}
        {(cfg.showCardSelect || creditCardId) && (
          <div>
            <div className="mb-1 text-xs font-medium text-slate-700">
              Credit Card
              {!cfg.showCardSelect && (
                <span className="ml-1 font-normal text-slate-400">(optional)</span>
              )}
            </div>
            <CreditCardSelect
              value={creditCardId || null}
              onChange={(v) => setCreditCardId(String(v || ""))}
              includeUnassigned
              inputClassName="w-full"
            />
          </div>
        )}

        {/* Note / vendor / comment */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="block text-sm md:col-span-2">
            <div className="mb-1 text-xs text-slate-600">{cfg.noteLabel}</div>
            <input
              className="w-full rounded border border-slate-300 px-2 py-1.5"
              value={note}
              onChange={(e) => setNote(e.currentTarget.value)}
              placeholder={cfg.notePlaceholder}
            />
          </label>
          <label className="block text-sm">
            <div className="mb-1 text-xs text-slate-600">Vendor</div>
            <input
              className="w-full rounded border border-slate-300 px-2 py-1.5"
              value={vendor}
              onChange={(e) => setVendor(e.currentTarget.value)}
            />
          </label>
          <label className="block text-sm">
            <div className="mb-1 text-xs text-slate-600">Comment</div>
            <input
              className="w-full rounded border border-slate-300 px-2 py-1.5"
              value={comment}
              onChange={(e) => setComment(e.currentTarget.value)}
            />
          </label>
        </div>

        {/* Impact summary */}
        {signedDisplay && (
          <div
            className={`rounded-lg border px-3 py-2 text-xs ${
              isNegative
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : "border-sky-200 bg-sky-50 text-sky-800"
            }`}
          >
            {isNegative
              ? `${signedDisplay} credit — reduces grant spend${lineItemId ? " on this line item" : ""}.`
              : `${signedDisplay} debit — adds to grant spend${lineItemId ? " on this line item" : ""}.`}
          </div>
        )}
      </div>
    </Modal>
  );
}
