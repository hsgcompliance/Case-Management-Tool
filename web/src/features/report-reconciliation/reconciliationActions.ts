"use client";

import type { ReconciliationFinding } from "./reconciliationReview";

export type ReconciliationActionTarget = "customers" | "customerEnrollments" | "paymentQueue" | "ledger" | "userTasks";

export type ReconciliationActionPreview = {
  id: string;
  label: string;
  target: ReconciliationActionTarget;
  targetId?: string;
  sourceValue: string;
  currentValue: string;
  proposedValue: string;
  confidence: number;
  warning?: string;
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

export function buildActionPreviews(finding: ReconciliationFinding): ReconciliationActionPreview[] {
  const record = finding.reportRecord;
  const out: ReconciliationActionPreview[] = [];
  const customerId = text(finding.customerId || finding.matchedCustomer?.id);
  if (record && customerId) {
    const hmisId = text(record.customerIdentity.hmisId);
    const currentHmisId = currentCustomerValue(finding, "hmisId", "HMISId", "hmisClientId", "clientId");
    const currentCaseworthyId = currentCustomerValue(finding, "caseworthyId", "caseWorthyId", "cwId", "CWID");
    const canPreviewIdentityPatch = finding.confidence >= 0.75;
    if (canPreviewIdentityPatch && hmisId && hmisId !== currentHmisId) {
      out.push({
        id: `${finding.id}:push-hmis-id`,
        label: "Push HMIS ID to Customer doc",
        target: "customers",
        targetId: customerId,
        sourceValue: hmisId,
        currentValue: currentHmisId || "(blank)",
        proposedValue: hmisId,
        confidence: finding.confidence,
        warning: currentHmisId ? "Customer already has an HMIS ID; review before replacing or adding another external ID." : undefined,
      });
    }
    const caseworthyId = text(record.customerIdentity.caseworthyId);
    if (canPreviewIdentityPatch && caseworthyId && caseworthyId !== currentCaseworthyId) {
      out.push({
        id: `${finding.id}:push-caseworthy-id`,
        label: "Push Caseworthy ID to Customer doc",
        target: "customers",
        targetId: customerId,
        sourceValue: caseworthyId,
        currentValue: currentCaseworthyId || "(blank)",
        proposedValue: caseworthyId,
        confidence: finding.confidence,
        warning: currentCaseworthyId ? "Customer already has a CW/Caseworthy ID; review before replacing or adding another external ID." : undefined,
      });
    }
  }
  if (record && finding.matchedEnrollment && finding.enrollmentId) {
    const provider = text(record.enrollmentEvidence.projectName || record.enrollmentEvidence.programId || record.paymentEvidence.grant);
    const currentProvider = text(finding.matchedEnrollment.grantName ?? finding.matchedEnrollment.programName ?? finding.matchedEnrollment.grantId);
    if (provider && provider !== currentProvider) {
      out.push({
        id: `${finding.id}:review-provider-mapping`,
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
  if (
    finding.kind === "payment_missing_dashboard" ||
    finding.kind === "payment_missing_hmis" ||
    finding.kind === "payment_missing_financial_edge" ||
    finding.kind === "payment_possible_match"
  ) {
    out.push({
      id: `${finding.id}:payment-review-task`,
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
