// Rent-cert schedule builder API — enrollment selection + reviewed-schedule
// apply. Mirrors functions/src/features/formSessions/rentCert.ts.
import { getAuthed, postAuthed } from "./authedApi";

export type EnrollmentLineItem = { id: string; label: string; locked: boolean };

export type EnrollmentPaymentSummary = {
  id: string;
  type: string;
  sub: string | null;
  /** Duplicate-prevention family: landlord | utility | deposit | … */
  family: string;
  dueDate: string;
  serviceMonth: string; // YYYY-MM
  amount: number;
  paid: boolean;
  void: boolean;
  srcSubmissionId: string | null;
};

export type FormsEnrollment = {
  id: string;
  customerId: string;
  grantId: string;
  grantName: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string | null;
  active: boolean;
  stage: string | null;
  /** Has at least one unlocked grant budget line item — i.e. can be billed. */
  billable: boolean;
  grantWindowStart: string | null;
  grantWindowEnd: string | null;
  lineItems: EnrollmentLineItem[];
  payments: EnrollmentPaymentSummary[];
};

export async function listEnrollmentsForCustomer(customerId: string): Promise<FormsEnrollment[]> {
  const out = await getAuthed<{ ok: true; items: FormsEnrollment[] }>("formsEnrollmentsList", { customerId });
  return out.items ?? [];
}

export type RentCertApplyRow = {
  enrollmentId: string;
  lineItemId: string;
  type: "deposit" | "prorated" | "arrears" | "monthly";
  sub?: "rent" | "utility";
  amount: number;
  dueDate: string; // YYYY-MM-DD
  label?: string;
};

export type RentCertRowResult = {
  index: number;
  enrollmentId: string;
  status: "created" | "already_applied" | "conflict_existing" | "conflict_in_batch" | "failed";
  existingPaymentId?: string;
  error?: string;
};

export async function applyRentCertSchedule(body: {
  customerId: string;
  submissionId: string;
  formId?: string;
  certification?: Record<string, string | number | boolean | null>;
  rows: RentCertApplyRow[];
}): Promise<{ ok: true; created: number; results: RentCertRowResult[] }> {
  return postAuthed("formsRentCertApply", body);
}
