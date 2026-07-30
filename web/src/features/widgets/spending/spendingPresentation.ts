export type SpendingPresentationKind =
  | "grant-ledger"
  | "card-ledger"
  | "queue-projection"
  | "queue-credit-card"
  | "queue-invoice";

export type SpendingPresentationState = "open" | "closed";

export function isClosedGrantRecord(grant: Record<string, unknown>): boolean {
  const status = String(grant.status || "").trim().toLowerCase();
  if (grant.deleted === true || status === "closed" || status === "deleted") return true;
  return !status && grant.active === false;
}

export function spendingChargeGroupLabel(
  kind: SpendingPresentationKind,
): "Enrollment" | "Invoice" | "Credit Card" {
  if (kind === "grant-ledger" || kind === "queue-projection") return "Enrollment";
  if (kind === "queue-invoice") return "Invoice";
  return "Credit Card";
}

export function spendingDisplayTypeLabel(
  kind: SpendingPresentationKind,
  enrollmentTypeHint = "",
): "Arrears" | "Deposit" | "Prorated" | "Rent" | "Invoice" | "Credit Card" {
  if (kind === "queue-invoice") return "Invoice";
  if (kind === "card-ledger" || kind === "queue-credit-card") return "Credit Card";

  const hint = enrollmentTypeHint.trim().toLowerCase();
  if (hint.includes("arrears")) return "Arrears";
  if (hint.includes("deposit")) return "Deposit";
  if (hint.includes("prorat")) return "Prorated";
  return "Rent";
}

export function enrollmentPaymentStatus(
  kind: SpendingPresentationKind,
  workflowState: SpendingPresentationState,
  complianceStatus = "",
):
  | "Projected"
  | "Paid · Needs HMIS + CW"
  | "Paid · Needs HMIS"
  | "Paid · Needs CW"
  | "Paid · Data Entry Complete"
  | null {
  if (kind !== "grant-ledger" && kind !== "queue-projection") return null;
  if (workflowState === "open") return "Projected";
  if (complianceStatus === "Data Entry Complete") return "Paid · Data Entry Complete";
  if (complianceStatus.includes("HMIS Only")) return "Paid · Needs CW";
  if (complianceStatus.includes("CW Only")) return "Paid · Needs HMIS";
  return "Paid · Needs HMIS + CW";
}
