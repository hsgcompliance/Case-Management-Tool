"use client";

import type { ReconciliationFinding } from "./reconciliationReview";

export type ReconciliationActionTarget = "customers" | "customerEnrollments" | "paymentQueue" | "ledger" | "userTasks";
export type ReconciliationActionKind =
  | "push_hmis_id"
  | "push_cw_id"
  | "push_dob"
  | "create_customer"
  | "review_provider_mapping"
  | "create_payment_review_task"
  | "post_queue_payment"
  | "patch_queue_amount"
  | "void_queue_payment"
  | "patch_enrollment_dates";

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
  if (finding.kind === "payment_unpaid_dashboard" && finding.paymentId) {
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
      });
    }
  }
  if (
    finding.kind === "payment_missing_dashboard" ||
    finding.kind === "payment_missing_hmis" ||
    finding.kind === "payment_missing_financial_edge" ||
    finding.kind === "payment_missing_report" ||
    finding.kind === "payment_possible_match"
  ) {
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
      warning: "Payment/HMIS writeback is not enabled from this workbench yet.",
    });
  }
  return out;
}
