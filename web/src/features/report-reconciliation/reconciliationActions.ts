"use client";

import type { ReconciliationFinding } from "./reconciliationReview";

export type ReconciliationActionTarget = "customers" | "customerEnrollments" | "paymentQueue" | "ledger" | "userTasks";
export type ReconciliationActionKind =
  | "push_hmis_id"
  | "push_cw_id"
  | "push_dob"
  | "create_customer"
  | "review_provider_mapping"
  | "patch_enrollment_compliance"
  | "create_payment_review_task"
  | "post_queue_payment"
  | "post_schedule_payment"
  | "extend_schedule"
  | "patch_queue_amount"
  | "void_queue_payment"
  | "patch_enrollment_dates";

/**
 * The action kinds the generic bulk-apply modal handles (payment/schedule
 * writeback only — customer identity and enrollment create/date actions
 * already have their own dedicated bulk modals with type-specific review UI,
 * so they're deliberately excluded here to avoid two competing apply paths
 * for the same finding).
 */
export const BULK_PAYMENT_ACTION_KINDS: ReadonlySet<ReconciliationActionKind> = new Set([
  "post_queue_payment",
  "post_schedule_payment",
  "extend_schedule",
  "patch_queue_amount",
  "void_queue_payment",
  "create_payment_review_task",
]);

/** Bulk-apply action kinds that default to UNCHECKED in the bulk modal — either explicitly destructive or not yet proven against live data. */
export const BULK_PAYMENT_ACTION_DEFAULT_OFF: ReadonlySet<ReconciliationActionKind> = new Set([
  "extend_schedule",
  "void_queue_payment",
]);

export type ReconciliationActionPreview = {
  id: string;
  kind: ReconciliationActionKind;
  label: string;
  target: ReconciliationActionTarget;
  targetId?: string;
  sourceValue: string;
  currentValue: string;
  proposedValue: string;
  confidence: number;
  warning?: string;
  executable?: boolean;
  patch?: Record<string, unknown>;
  create?: Record<string, unknown>;
  /**
   * `extend_schedule` only: the specific new (month, amount) rows this action
   * adds, separate from the enrollment's existing rows already folded into
   * `patch.payments`. Lets the Adjust modal edit/remove just the new rows
   * without reconstructing them from the full payments array — `patch.payments`
   * is always `[...existingPayments, ...these rows in the same order]`.
   */
  editableScheduleRows?: Array<{ month: string; amountCents: number; lineItemId: string }>;
  /**
   * Actions sharing the same non-empty pathGroup on the same finding are
   * mutually-exclusive resolution paths ("dashboard is wrong, fix it" vs.
   * "report/data-entry needs to catch up, flag it") — a choose-one-path UI
   * should render them as a single choice, not independent checkboxes.
   * Actions with no pathGroup (or a finding with only one action) aren't
   * part of a choice at all.
   */
  pathGroup?: string;
  /** Suggested default within a pathGroup. At most one per group. */
  recommended?: boolean;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function currentCustomerValue(finding: ReconciliationFinding, ...keys: string[]) {
  for (const key of keys) {
    const value = text(finding.matchedCustomer?.[key]);
    if (value) return value;
  }
  return "";
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function buildActionPreviews(finding: ReconciliationFinding): ReconciliationActionPreview[] {
  const record = finding.reportRecord;
  const out: ReconciliationActionPreview[] = [];
  const customerId = text(finding.customerId || finding.matchedCustomer?.id);
  if (record && customerId) {
    const hmisId = text(record.customerIdentity.hmisId);
    const currentHmisId = currentCustomerValue(finding, "hmisId", "HMISId", "hmisClientId", "clientId");
    const currentCaseworthyId = currentCustomerValue(finding, "caseworthyId", "caseWorthyId", "cwId", "CWID");
    const canPreviewIdentityPatch = finding.kind === "customer_possible_match" && finding.confidence >= 0.75;
    if (canPreviewIdentityPatch && hmisId && hmisId !== currentHmisId) {
      out.push({
        id: `${finding.id}:push-hmis-id`,
        kind: "push_hmis_id",
        label: "Push HMIS ID to Customer doc",
        target: "customers",
        targetId: customerId,
        sourceValue: hmisId,
        currentValue: currentHmisId || "(blank)",
        proposedValue: hmisId,
        confidence: finding.confidence,
        warning: currentHmisId ? "Customer already has an HMIS ID; review before replacing or adding another external ID." : undefined,
        executable: true,
        patch: { hmisId },
      });
    }
    const caseworthyId = text(record.customerIdentity.cwId || record.customerIdentity.caseworthyId);
    if (canPreviewIdentityPatch && caseworthyId && caseworthyId !== currentCaseworthyId) {
      out.push({
        id: `${finding.id}:push-caseworthy-id`,
        kind: "push_cw_id",
        label: "Push CW ID to Customer doc",
        target: "customers",
        targetId: customerId,
        sourceValue: caseworthyId,
        currentValue: currentCaseworthyId || "(blank)",
        proposedValue: caseworthyId,
        confidence: finding.confidence,
        warning: currentCaseworthyId ? "Customer already has a CW/Caseworthy ID; review before replacing or adding another external ID." : undefined,
        executable: true,
        patch: { cwId: caseworthyId },
      });
    }
    const reportDob = text(record.customerIdentity.dob);
    const currentDob = currentCustomerValue(finding, "dob", "dateOfBirth", "birthDate");
    if (canPreviewIdentityPatch && reportDob && reportDob !== currentDob) {
      out.push({
        id: `${finding.id}:push-dob`,
        kind: "push_dob",
        label: "Push DOB to Customer doc",
        target: "customers",
        targetId: customerId,
        sourceValue: reportDob,
        currentValue: currentDob || "(blank)",
        proposedValue: reportDob,
        confidence: finding.confidence,
        warning: currentDob ? "Customer already has a different DOB; review source identity before replacing it." : undefined,
        executable: true,
        patch: { dob: reportDob },
      });
    }
  }
  if (record && finding.kind === "customer_missing" && !customerId && !finding.matchedCustomer) {
    const identity = record.customerIdentity;
    const parsed = splitName(identity.fullName || `${identity.firstName} ${identity.lastName}`.trim());
    const firstName = text(identity.firstName) || parsed.firstName;
    const lastName = text(identity.lastName) || parsed.lastName;
    if (firstName && lastName) {
      const hmisId = text(identity.hmisId);
      const cwId = text(identity.cwId || identity.caseworthyId);
      const dob = text(identity.dob);
      const name = `${firstName} ${lastName}`.trim();
      out.push({
        id: `${finding.id}:create-customer`,
        kind: "create_customer",
        label: "Create Customer",
        target: "customers",
        sourceValue: name,
        currentValue: "(missing)",
        proposedValue: [name, dob ? `DOB ${dob}` : "", hmisId ? `HMIS ${hmisId}` : "", cwId ? `CW ${cwId}` : ""].filter(Boolean).join(" | "),
        confidence: finding.confidence,
        warning: !dob ? "DOB is blank; review before creating if the source has DOB elsewhere." : undefined,
        executable: true,
        create: {
          firstName,
          lastName,
          name,
          dob: dob || null,
          hmisId: hmisId || null,
          cwId: cwId || null,
          active: true,
          status: "active",
          deleted: false,
          enrolled: false,
        },
      });
    }
  }
  if (record && finding.matchedEnrollment && finding.enrollmentId) {
    const provider = text(record.enrollmentEvidence.projectName || record.enrollmentEvidence.programId || record.paymentEvidence.grant);
    const currentProvider = text(finding.matchedEnrollment.grantName ?? finding.matchedEnrollment.programName ?? finding.matchedEnrollment.grantId);
    if (provider && provider !== currentProvider) {
      out.push({
        id: `${finding.id}:review-provider-mapping`,
        kind: "review_provider_mapping",
        label: "Preview enrollment/provider mapping correction",
        target: "customerEnrollments",
        targetId: finding.enrollmentId,
        sourceValue: provider,
        currentValue: currentProvider || "(blank)",
        proposedValue: provider,
        confidence: finding.confidence,
        warning: "Provider/grant names often differ by system; review mapping before applying.",
      });
    }
  }
  if ((finding.kind === "entry_date_mismatch" || finding.kind === "exit_date_mismatch") && finding.enrollmentId && finding.reportValue) {
    const isEntry = finding.kind === "entry_date_mismatch";
    // Patch the key the matched doc already uses; fall back to the canonical
    // contract fields (startDate/endDate).
    const dateKeys = isEntry ? ["entryDate", "startDate", "enrolledAt"] : ["exitDate", "endDate", "closedAt"];
    const dateKey = dateKeys.find((key) => text(finding.matchedEnrollment?.[key])) ?? (isEntry ? "startDate" : "endDate");
    out.push({
      id: `${finding.id}:patch-enrollment-date`,
      kind: "patch_enrollment_dates",
      label: isEntry ? "Set enrollment entry date to report value" : "Set enrollment exit date to report value",
      target: "customerEnrollments",
      targetId: finding.enrollmentId,
      sourceValue: finding.reportValue,
      currentValue: finding.dashboardValue || "(blank)",
      proposedValue: finding.reportValue,
      confidence: finding.confidence,
      warning: "Confirm the report date is authoritative before overwriting the dashboard enrollment date.",
      executable: true,
      patch: { [dateKey]: finding.reportValue },
    });
  }
  if (finding.kind === "enrollment_compliance_missing" && finding.enrollmentId) {
    const isHmis = finding.recordKind.startsWith("hmis");
    const isCaseworthy = finding.recordKind.startsWith("caseworthy");
    const complianceField = isHmis ? "hmisEntryComplete" : isCaseworthy ? "caseworthyEntryComplete" : "";
    if (complianceField) {
      out.push({
        id: `${finding.id}:patch-enrollment-compliance`,
        kind: "patch_enrollment_compliance",
        label: `Mark ${isHmis ? "HMIS" : "Caseworthy"} entry compliance complete`,
        target: "customerEnrollments",
        targetId: finding.enrollmentId,
        sourceValue: "true",
        currentValue: "not complete",
        proposedValue: "complete",
        confidence: finding.confidence,
        warning: "Confirm this report row genuinely represents this enrollment's compliance entry before marking it complete.",
        executable: true,
        patch: { compliance: { [complianceField]: true } },
      });
    }
  }
  if (finding.kind === "payment_unpaid_dashboard" && finding.paymentId) {
    // paymentQueuePostToLedger throws `use_payments_spend_for_projection` for
    // schedule-derived (source:"projection") queue rows — i.e. the normal
    // case for any rental-assistance/enrollment-schedule payment. Those must
    // go through paymentsSpend instead, which is the one path that keeps
    // payments[].paid, the ledger entry, and the queue's posted status all
    // in sync atomically (see PROGRESS.md 2026-07-22 entry).
    const best = finding.matchedPaymentCandidates?.[0];
    const isScheduleDerived = text(best?.source) === "projection";
    const scheduleEnrollmentId = text(best?.enrollmentId);
    const schedulePaymentId = text(best?.paymentId);
    if (isScheduleDerived && scheduleEnrollmentId && schedulePaymentId) {
      out.push({
        id: `${finding.id}:post-schedule-payment`,
        kind: "post_schedule_payment",
        label: "Mark scheduled payment paid (creates ledger entry)",
        target: "customerEnrollments",
        targetId: scheduleEnrollmentId,
        sourceValue: finding.reportValue || "",
        currentValue: finding.dashboardValue || "pending",
        proposedValue: "paid (ledger entry created)",
        confidence: finding.confidence,
        warning: "Marks the enrollment's scheduled payment paid and creates its ledger entry. Confirm the report evidence describes this exact payment.",
        executable: true,
        patch: { enrollmentId: scheduleEnrollmentId, paymentId: schedulePaymentId },
      });
    } else {
      out.push({
        id: `${finding.id}:post-queue-payment`,
        kind: "post_queue_payment",
        label: "Post queue item to ledger (mark paid)",
        target: "paymentQueue",
        targetId: finding.paymentId,
        sourceValue: finding.reportValue || "",
        currentValue: finding.dashboardValue || "pending",
        proposedValue: "posted (ledger entry created)",
        confidence: finding.confidence,
        warning: "Creates a ledger entry and marks the queue item paid. Confirm the report evidence describes this exact payment.",
        executable: true,
      });
    }
  }
  if (finding.kind === "schedule_gap" && finding.enrollmentId && finding.matchedEnrollment) {
    const existingPayments = Array.isArray(finding.matchedEnrollment.payments)
      ? (finding.matchedEnrollment.payments as Array<Record<string, unknown>>)
      : [];
    const gapMonths = (finding.matchedPaymentCandidates ?? []) as Array<{ month?: string; amountCents?: number; reportPaid?: boolean }>;
    const targetAmountCents = gapMonths[0]?.amountCents;
    // Copy lineItemId/type from an existing recurring row at this amount —
    // the review pass already confirmed one exists before proposing this
    // finding at all, so this should always find a match here too.
    const template = targetAmountCents != null
      ? existingPayments.find((payment) => text(payment.type) === "monthly" && Math.abs(Math.round(Number(payment.amount ?? 0) * 100) - targetAmountCents) <= 1)
      : undefined;
    if (template && gapMonths.length) {
      const newRows = gapMonths.map((gap) => ({
        type: "monthly",
        lineItemId: template.lineItemId,
        amount: Number(gap.amountCents ?? 0) / 100,
        dueDate: `${gap.month}-01`,
        paid: false,
      }));
      const nextPayments = [...existingPayments, ...newRows];
      const monthList = gapMonths.map((gap) => gap.month).join(", ");
      out.push({
        id: `${finding.id}:extend-schedule`,
        kind: "extend_schedule",
        label: `Extend schedule (+${newRows.length} month${newRows.length === 1 ? "" : "s"})`,
        target: "customerEnrollments",
        targetId: finding.enrollmentId,
        sourceValue: monthList,
        currentValue: `${existingPayments.length} scheduled row(s)`,
        proposedValue: `+${newRows.length} unpaid row(s) at $${(Number(targetAmountCents ?? 0) / 100).toFixed(2)}/mo: ${monthList}`,
        confidence: finding.confidence,
        warning: "Adds new UNPAID projection rows to this enrollment's schedule for the missing months, at the recurring amount. Does not mark anything paid — confirm the customer is still active on this grant first, then use the normal post-payment flow for any months that were actually paid.",
        executable: true,
        patch: { enrollmentId: finding.enrollmentId, payments: nextPayments },
        editableScheduleRows: gapMonths.map((gap) => ({
          month: text(gap.month),
          amountCents: Number(gap.amountCents ?? 0),
          lineItemId: text(template.lineItemId),
        })),
        pathGroup: "resolve",
        recommended: true,
      });
    }
  }
  if (finding.kind === "payment_amount_mismatch" && record) {
    const best = finding.matchedPaymentCandidates?.[0];
    const bestId = text(best?.id);
    const isQueueRow = text(best?._matchSource) === "payment queue";
    const isPaid = text(best?.queueStatus).toLowerCase() === "posted" || best?.paid === true || text(best?.ledgerEntryId) !== "";
    const reportAmount = Math.abs(Number(record.paymentEvidence.amount ?? NaN));
    if (best && bestId && isQueueRow && !isPaid && Number.isFinite(reportAmount) && reportAmount > 0) {
      out.push({
        id: `${finding.id}:patch-queue-amount`,
        kind: "patch_queue_amount",
        label: "Set queue amount to report amount",
        target: "paymentQueue",
        targetId: bestId,
        sourceValue: String(record.paymentEvidence.amount),
        currentValue: finding.dashboardValue || String(best.amount ?? ""),
        proposedValue: reportAmount.toFixed(2),
        confidence: finding.confidence,
        warning: "Confirm the report amount is correct before overwriting the queue item amount.",
        executable: true,
        patch: { amount: reportAmount, amountAbs: reportAmount, localModificationReason: "reconciliation: matched report amount" },
      });
    }
  }
  if (finding.kind === "payment_missing_report") {
    const row = finding.matchedPaymentCandidates?.[0];
    const rowId = text(row?.id);
    const isPendingQueue = text(row?.queueStatus).toLowerCase() === "pending"
      || (finding.recordKind === "payment queue" && !text(row?.ledgerEntryId) && text(row?.queueStatus).toLowerCase() !== "posted");
    if (rowId && isPendingQueue) {
      out.push({
        id: `${finding.id}:void-queue-payment`,
        kind: "void_queue_payment",
        label: "Void scheduled payment (confirmed cancelled)",
        target: "paymentQueue",
        targetId: rowId,
        sourceValue: "(no report row)",
        currentValue: finding.dashboardValue || "scheduled",
        proposedValue: "void",
        confidence: finding.confidence,
        warning: "Destructive: only void if this scheduled payment is confirmed cancelled — the uploaded report may simply not cover it.",
        executable: true,
        pathGroup: "resolve",
      });
    }
  }
  // Findings where the dashboard has something a report doesn't back up (or
  // vice versa) genuinely have two different resolutions: the dashboard is
  // wrong (fix/remove it) or the report/data-entry just hasn't caught up yet
  // (flag it, don't touch the dashboard). Those two are the same pathGroup —
  // an operator should pick one, not apply both. schedule_gap's dashboard-side
  // fix is extend_schedule (added above); payment_missing_report's is
  // void_queue_payment (added above). The other kinds below have no concrete
  // dashboard-side fix action yet, so the task is their only path.
  if (
    finding.kind === "payment_missing_dashboard" ||
    finding.kind === "schedule_gap" ||
    finding.kind === "payment_missing_hmis" ||
    finding.kind === "payment_missing_financial_edge" ||
    finding.kind === "payment_missing_report" ||
    finding.kind === "payment_possible_match"
  ) {
    const hasAlternativeFix = finding.kind === "payment_missing_report" || finding.kind === "schedule_gap";
    out.push({
      id: `${finding.id}:payment-review-task`,
      kind: "create_payment_review_task",
      label: "Create payment reconciliation task",
      target: "userTasks",
      targetId: finding.customerId,
      sourceValue: finding.reportValue || text(record?.paymentEvidence.reference),
      currentValue: finding.dashboardValue || "(no dashboard match)",
      proposedValue: finding.kind === "payment_missing_hmis"
        ? "Task for HMIS/Caseworthy entry review"
        : finding.kind === "payment_missing_financial_edge"
          ? "Task for stale/cancelled payment data-entry review"
          : "Task for finance review",
      confidence: finding.confidence,
      warning: "Payment/HMIS writeback is not enabled from this workbench yet — this path only records the decision, it doesn't create a real task.",
      pathGroup: hasAlternativeFix ? "resolve" : undefined,
      // schedule_gap's real fix (extend_schedule) is recommended instead; for
      // payment_missing_report the task is the safer default, letting the
      // destructive void be a deliberate override rather than the default.
      recommended: finding.kind === "payment_missing_report",
    });
  }
  return out;
}
