"use client";

import type { ExportColumn } from "@entities/ui/dashboardStyle/SmartExportButton";
import type { ReconciliationFinding, ReconciliationReviewResult } from "./reconciliationReview";

export type ReconciliationExportRow = {
  tool: string;
  severity: string;
  kind: string;
  confidence: string;
  sourceFile: string;
  sourceRowNumber: string;
  recordKind: string;
  customerId: string;
  customerLabel: string;
  enrollmentId: string;
  paymentId: string;
  reportValue: string;
  dashboardValue: string;
  proposedAction: string;
  explanation: string;
};

function titleCase(value: string) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export const RECONCILIATION_EXPORT_COLUMNS: ExportColumn<ReconciliationExportRow>[] = [
  { key: "tool", label: "Tool", value: (row) => row.tool },
  { key: "severity", label: "Severity", value: (row) => row.severity },
  { key: "kind", label: "Finding Kind", value: (row) => row.kind },
  { key: "confidence", label: "Confidence", value: (row) => row.confidence },
  { key: "sourceFile", label: "Source File", value: (row) => row.sourceFile },
  { key: "sourceRowNumber", label: "Source Row", value: (row) => row.sourceRowNumber },
  { key: "recordKind", label: "Record Kind", value: (row) => row.recordKind },
  { key: "customerId", label: "Customer ID", value: (row) => row.customerId },
  { key: "customerLabel", label: "Customer", value: (row) => row.customerLabel },
  { key: "enrollmentId", label: "Enrollment ID", value: (row) => row.enrollmentId },
  { key: "paymentId", label: "Payment ID", value: (row) => row.paymentId },
  { key: "reportValue", label: "Report Value", value: (row) => row.reportValue },
  { key: "dashboardValue", label: "Dashboard Value", value: (row) => row.dashboardValue },
  { key: "proposedAction", label: "Proposed Action", value: (row) => row.proposedAction },
  { key: "explanation", label: "Explanation", value: (row) => row.explanation },
];

export function reconciliationFindingToExportRow(toolTitle: string, finding: ReconciliationFinding): ReconciliationExportRow {
  return {
    tool: toolTitle,
    severity: finding.severity,
    kind: titleCase(finding.kind),
    confidence: `${Math.round(finding.confidence * 100)}%`,
    sourceFile: finding.sourceFile,
    sourceRowNumber: finding.sourceRowNumber == null ? "" : String(finding.sourceRowNumber),
    recordKind: finding.recordKind,
    customerId: finding.customerId ?? "",
    customerLabel: finding.customerLabel ?? "",
    enrollmentId: finding.enrollmentId ?? "",
    paymentId: finding.paymentId ?? "",
    reportValue: finding.reportValue ?? "",
    dashboardValue: finding.dashboardValue ?? "",
    proposedAction: finding.proposedAction ?? "",
    explanation: finding.explanation.join(" | "),
  };
}

export function reconciliationFindingsToRows(toolTitle: string, findings: ReconciliationFinding[]) {
  return findings.map((finding) => reconciliationFindingToExportRow(toolTitle, finding));
}

export function buildReviewSummaryRows(review: ReconciliationReviewResult) {
  const bySeverity = Object.entries(review.summary.bySeverity).map(([key, value]) => ["severity", key, String(value)]);
  const byKind = Object.entries(review.summary.byKind).map(([key, value]) => ["kind", titleCase(key), String(value)]);
  return [
    ["metric", "value", ""],
    ["packets", String(review.summary.packetCount), ""],
    ["report rows", String(review.summary.reportRows), ""],
    ["findings", String(review.summary.findingCount), ""],
    ...bySeverity,
    ...byKind,
  ];
}
