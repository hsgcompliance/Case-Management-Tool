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

function currentCustomerValue(finding: ReconciliationFinding, key: string) {
  return text(finding.matchedCustomer?.[key]);
}

export function buildActionPreviews(finding: ReconciliationFinding): ReconciliationActionPreview[] {
  const record = finding.reportRecord;
  const out: ReconciliationActionPreview[] = [];
  const customerId = text(finding.customerId || finding.matchedCustomer?.id);
  if (record && customerId) {
    const hmisId = text(record.customerIdentity.hmisId);
    if (hmisId && hmisId !== currentCustomerValue(finding, "hmisId") && hmisId !== currentCustomerValue(finding, "HMISId")) {
      out.push({
        id: `${finding.id}:push-hmis-id`,
        label: "Push HMIS ID to Customer doc",
        target: "customers",
        targetId: customerId,
        sourceValue: hmisId,
        currentValue: currentCustomerValue(finding, "hmisId") || currentCustomerValue(finding, "HMISId") || "(blank)",
        proposedValue: hmisId,
        confidence: finding.confidence,
      });
    }
    const caseworthyId = text(record.customerIdentity.caseworthyId);
    if (caseworthyId && caseworthyId !== currentCustomerValue(finding, "caseworthyId")) {
      out.push({
        id: `${finding.id}:push-caseworthy-id`,
        label: "Push Caseworthy ID to Customer doc",
        target: "customers",
        targetId: customerId,
        sourceValue: caseworthyId,
        currentValue: currentCustomerValue(finding, "caseworthyId") || "(blank)",
        proposedValue: caseworthyId,
        confidence: finding.confidence,
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
  if (finding.kind === "payment_missing_dashboard" || finding.kind === "payment_possible_match") {
    out.push({
      id: `${finding.id}:payment-review-task`,
      label: "Create payment reconciliation task",
      target: "userTasks",
      targetId: finding.customerId,
      sourceValue: finding.reportValue || text(record?.paymentEvidence.reference),
      currentValue: finding.dashboardValue || "(no dashboard match)",
      proposedValue: "Task for finance review",
      confidence: finding.confidence,
      warning: "Payment queue/ledger writes are not enabled from this workbench yet.",
    });
  }
  return out;
}
