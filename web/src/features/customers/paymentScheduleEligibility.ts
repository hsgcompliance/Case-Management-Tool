import { normalizeGrantFinancialConfig } from "@hdb/contracts";

/** Payment schedules belong only to records with a financial billing model. */
export function isPaymentScheduleGrantEligible(
  grant: Record<string, unknown> | null | undefined,
): boolean {
  const model = normalizeGrantFinancialConfig(grant).model;
  return model === "budgeted" || model === "billable";
}

export function paymentScheduleGrantIds(
  grants: Array<Record<string, unknown>>,
): Set<string> {
  return new Set(
    grants
      .filter(isPaymentScheduleGrantEligible)
      .map((grant) => String(grant.id || "").trim())
      .filter(Boolean),
  );
}
