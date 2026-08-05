import type { CustomerPaymentRow } from "@client/payments";

export function isVoidedSchedulePayment(payment: unknown): boolean {
  if (!payment || typeof payment !== "object") return false;
  const record = payment as Record<string, unknown>;
  return record.void === true || String(record.status || "").toLowerCase() === "voided";
}

export function activeScheduleRows(rows: CustomerPaymentRow[]): CustomerPaymentRow[] {
  return rows.filter((row) => !isVoidedSchedulePayment(row.payment));
}
