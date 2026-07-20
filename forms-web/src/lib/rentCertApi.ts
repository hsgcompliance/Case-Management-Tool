// Rent-cert schedule builder API — enrollment selection + reviewed-schedule
// apply. Mirrors functions/src/features/formSessions/rentCert.ts.
import { getAuthed, postAuthed } from "./authedApi";

export type EnrollmentLineItem = { id: string; label: string; locked: boolean };

export type FormsProgram = {
  grantId: string;
  grantName: string;
  lineItems: EnrollmentLineItem[];
};

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

export async function listEnrollmentsForCustomer(customerId: string): Promise<{ enrollments: FormsEnrollment[]; programs: FormsProgram[] }> {
  const out = await getAuthed<{ ok: true; items: FormsEnrollment[]; programs?: FormsProgram[] }>("formsEnrollmentsList", { customerId });
  return { enrollments: out.items ?? [], programs: out.programs ?? [] };
}

export type RentCertApplyRow = {
  enrollmentId?: string;
  grantId?: string;
  lineItemId: string;
  type: "deposit" | "prorated" | "arrears" | "monthly";
  sub?: "rent" | "utility";
  amount: number;
  dueDate: string; // YYYY-MM-DD
  label?: string;
  vendor?: string;
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

export async function markCustomerNotEligible(body: { customerId: string; enrollmentId: string }): Promise<{ ok: true; customerInactivated: boolean }> {
  return postAuthed("formsCustomerNotEligible", body);
}
