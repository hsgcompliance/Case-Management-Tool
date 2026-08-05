export type GrantDeletionEnrollment = {
  payments?: unknown;
  spends?: unknown;
};

export type GrantDeletionSafetyInput = {
  enrollments: GrantDeletionEnrollment[];
  ledgerCount: number;
  paymentQueueCount: number;
  spendMirrorCount: number;
};

export type GrantDeletionSafetySummary = {
  ledger: number;
  paymentQueue: number;
  enrollmentPaymentSchedules: number;
  embeddedSpendMirrors: number;
  spendSubcollectionMirrors: number;
  blocked: boolean;
};

/** Counts retained financial relationships without exposing amounts or customer data. */
export function summarizeGrantDeletionSafety(
  input: GrantDeletionSafetyInput,
): GrantDeletionSafetySummary {
  const enrollmentPaymentSchedules = input.enrollments.filter(
    (row) => Array.isArray(row.payments) && row.payments.length > 0,
  ).length;
  const embeddedSpendMirrors = input.enrollments.reduce(
    (count, row) => count + (Array.isArray(row.spends) ? row.spends.length : 0),
    0,
  );
  const summary = {
    ledger: Math.max(0, input.ledgerCount || 0),
    paymentQueue: Math.max(0, input.paymentQueueCount || 0),
    enrollmentPaymentSchedules,
    embeddedSpendMirrors,
    spendSubcollectionMirrors: Math.max(0, input.spendMirrorCount || 0),
  };
  return {
    ...summary,
    blocked: Object.values(summary).some((count) => count > 0),
  };
}
