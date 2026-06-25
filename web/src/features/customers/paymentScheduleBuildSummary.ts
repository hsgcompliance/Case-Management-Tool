import type { PaymentScheduleBuildInput } from "@hooks/usePayments";

type EnrollmentLike = {
  id?: unknown;
  label?: unknown;
};

export type PaymentScheduleBuildSummary = {
  enrollmentId: string;
  enrollmentLabel: string;
  rowCount: number;
};

export function summarizePaymentScheduleBuild(
  payload: PaymentScheduleBuildInput,
  enrollments: EnrollmentLike[],
): PaymentScheduleBuildSummary {
  const enrollmentId = String(payload.enrollmentId || "").trim();
  const enrollment = enrollments.find((row) => String(row.id || "").trim() === enrollmentId);
  const monthlyRows = Array.isArray(payload.monthlyPlans)
    ? payload.monthlyPlans.reduce((sum, plan) => {
        const months = Math.max(0, Math.floor(Number(plan?.months || 0)));
        return sum + months;
      }, 0)
    : Math.max(0, Math.floor(Number(payload.months || 0)));
  const additionRows = Array.isArray(payload.additions)
    ? payload.additions.length
    : payload.includeDeposit && Number(payload.depositAmount || 0) > 0
      ? 1
      : 0;

  return {
    enrollmentId,
    enrollmentLabel: String(enrollment?.label || enrollmentId || "selected enrollment"),
    rowCount: monthlyRows + additionRows,
  };
}
