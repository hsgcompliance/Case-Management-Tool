import type { PaymentQueuePatchReq } from "@client/paymentQueue";

export type TransactionAdjustmentInput = {
  amount?: number | null;
  amountCents: number;
  dueDate?: string | null;
  date?: string | null;
  grantId?: string | null;
  lineItemId?: string | null;
  creditCardId?: string | null;
  note?: unknown;
  comment?: unknown;
};

function noteText(value: unknown): string {
  if (Array.isArray(value)) return value.map((part) => String(part || "").trim()).filter(Boolean).join(" | ");
  return String(value || "").trim();
}

/** Convert the shared transaction form into an in-place queue/ledger edit. */
export function buildTransactionAdjustmentPatch(body: TransactionAdjustmentInput): PaymentQueuePatchReq {
  const amount = Number(body.amount ?? Number(body.amountCents || 0) / 100);
  const dueDate = String(body.dueDate || body.date || "").slice(0, 10);
  const grantId = String(body.grantId || "").trim();
  const lineItemId = String(body.lineItemId || "").trim();
  const reason = noteText(body.comment) || noteText(body.note) || "Adjusted transaction from Invoicing advanced controls";

  return {
    amount,
    amountAbs: Math.abs(amount),
    direction: amount < 0 ? "return" : "charge",
    dueDate,
    grantId: grantId || null,
    lineItemId: lineItemId || null,
    creditCardId: String(body.creditCardId || "").trim() || null,
    okUnassigned: !grantId,
    localModificationReason: reason,
  };
}
