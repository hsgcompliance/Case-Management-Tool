"use client";

import {
  normalizeAmount,
  normalizeCustomerName,
  normalizeDate,
  type NormalizedReportRecord,
  type ReconciliationPacket,
  type ReportDiagnosticSeverity,
} from "./reportProfiles";

export type ReconciliationFindingKind =
  | "customer_missing"
  | "customer_possible_match"
  | "enrollment_missing"
  | "entry_date_mismatch"
  | "exit_date_mismatch"
  | "enrollment_compliance_missing"
  | "payment_missing_dashboard"
  | "payment_possible_match"
  | "payment_amount_mismatch"
  | "grant_mapping_review"
  | "report_row_diagnostic";

export type ReconciliationFinding = {
  id: string;
  kind: ReconciliationFindingKind;
  severity: ReportDiagnosticSeverity;
  confidence: number;
  sourceFile: string;
  sourceRowNumber: number | null;
  recordKind: string;
  customerId?: string;
  customerLabel?: string;
  enrollmentId?: string;
  paymentId?: string;
  reportValue?: string;
  dashboardValue?: string;
  explanation: string[];
  proposedAction?: string;
};

export type ReconciliationReviewSummary = {
  packetCount: number;
  reportRows: number;
  findingCount: number;
  byKind: Record<string, number>;
  bySeverity: Record<ReportDiagnosticSeverity, number>;
};

export type ReconciliationReviewResult = {
  findings: ReconciliationFinding[];
  summary: ReconciliationReviewSummary;
};

type DashboardData = {
  customers: Array<Record<string, unknown>>;
  enrollments: Array<Record<string, unknown>>;
  grants: Array<Record<string, unknown>>;
  paymentQueueItems: Array<Record<string, unknown>>;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function lower(value: unknown) {
  return text(value).toLowerCase();
}

function cents(value: unknown) {
  const amount = normalizeAmount(value);
  return amount == null ? null : Math.round(amount * 100);
}

function monthKey(value: unknown) {
  return normalizeDate(value).slice(0, 7);
}

function isActiveLike(row: Record<string, unknown>) {
  if (row.deleted === true) return false;
  if (typeof row.active === "boolean") return row.active;
  const status = lower(row.status);
  if (status === "deleted" || status === "inactive" || status === "closed") return false;
  return true;
}

function customerLabel(customer: Record<string, unknown> | null | undefined) {
  if (!customer) return "";
  const first = text(customer.firstName ?? customer.givenName);
  const last = text(customer.lastName ?? customer.surname);
  return text(customer.fullName ?? customer.name) || `${first} ${last}`.trim() || text(customer.id);
}

function customerHmisId(customer: Record<string, unknown>) {
  return text(customer.hmisId ?? customer.HMISId ?? customer.hmisClientId ?? customer.clientId);
}

function customerDob(customer: Record<string, unknown>) {
  return normalizeDate(customer.dob ?? customer.dateOfBirth ?? customer.birthDate);
}

function customerNameKey(customer: Record<string, unknown>) {
  return normalizeCustomerName(customerLabel(customer));
}

function recordNameKey(record: NormalizedReportRecord) {
  return normalizeCustomerName(record.customerIdentity.fullName || `${record.customerIdentity.firstName} ${record.customerIdentity.lastName}`);
}

function buildCustomerIndexes(customers: Array<Record<string, unknown>>) {
  const byId = new Map<string, Record<string, unknown>>();
  const byHmis = new Map<string, Record<string, unknown>>();
  const byNameDob = new Map<string, Record<string, unknown>>();
  const byName = new Map<string, Record<string, unknown>[]>();
  for (const customer of customers) {
    const id = text(customer.id);
    if (id) byId.set(id, customer);
    const hmisId = customerHmisId(customer);
    if (hmisId) byHmis.set(hmisId, customer);
    const name = customerNameKey(customer);
    const dob = customerDob(customer);
    if (name && dob) byNameDob.set(`${name}|${dob}`, customer);
    if (name) byName.set(name, [...(byName.get(name) ?? []), customer]);
  }
  return { byId, byHmis, byNameDob, byName };
}

function findCustomer(record: NormalizedReportRecord, indexes: ReturnType<typeof buildCustomerIndexes>) {
  const dashboardId = text(record.customerIdentity.dashboardCustomerId);
  if (dashboardId && indexes.byId.has(dashboardId)) return { customer: indexes.byId.get(dashboardId) ?? null, confidence: 1, method: "dashboard id" };
  const hmisId = text(record.customerIdentity.hmisId);
  if (hmisId && indexes.byHmis.has(hmisId)) return { customer: indexes.byHmis.get(hmisId) ?? null, confidence: 0.95, method: "HMIS ID" };
  const name = recordNameKey(record);
  const dob = normalizeDate(record.customerIdentity.dob);
  if (name && dob && indexes.byNameDob.has(`${name}|${dob}`)) {
    return { customer: indexes.byNameDob.get(`${name}|${dob}`) ?? null, confidence: 0.85, method: "name + DOB" };
  }
  const nameMatches = name ? indexes.byName.get(name) ?? [] : [];
  if (nameMatches.length === 1) return { customer: nameMatches[0], confidence: 0.55, method: "name only" };
  return { customer: null, confidence: 0, method: "" };
}

function enrollmentGrantKey(enrollment: Record<string, unknown>) {
  return lower(enrollment.grantId ?? enrollment.programId ?? enrollment.projectId ?? enrollment.grantName ?? enrollment.programName);
}

function recordGrantKey(record: NormalizedReportRecord) {
  return lower(record.paymentEvidence.grant || record.enrollmentEvidence.projectName || record.enrollmentEvidence.programId);
}

function dateOf(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = normalizeDate(row[key]);
    if (value) return value;
  }
  return "";
}

function findEnrollments(customerId: string, enrollments: Array<Record<string, unknown>>) {
  return enrollments.filter((enrollment) => text(enrollment.customerId ?? enrollment.clientId) === customerId && isActiveLike(enrollment));
}

function findPaymentCandidates(record: NormalizedReportRecord, paymentQueueItems: Array<Record<string, unknown>>, customerId?: string) {
  const amount = cents(record.paymentEvidence.amount);
  const serviceMonth = record.paymentEvidence.serviceMonth || monthKey(record.paymentEvidence.transactionDate);
  return paymentQueueItems.filter((item) => {
    if (customerId && text(item.customerId) && text(item.customerId) !== customerId) return false;
    const itemAmount = cents(item.amount ?? item.amountAbs);
    if (amount != null && itemAmount != null && Math.abs(amount - itemAmount) > 1) return false;
    const itemMonth = text(item.month) || monthKey(item.dueDate ?? item.transactionDate ?? item.postedAt);
    if (serviceMonth && itemMonth && serviceMonth !== itemMonth) return false;
    return true;
  });
}

function findingId(kind: ReconciliationFindingKind, record: NormalizedReportRecord, suffix: string) {
  return [kind, record.sourceFile, record.sourceRowNumber ?? "row", suffix].join("::");
}

function addRecordDiagnostics(findings: ReconciliationFinding[], packet: ReconciliationPacket) {
  for (const diagnostic of packet.diagnostics) {
    findings.push({
      id: `diagnostic::${packet.sourceFile}::${diagnostic.fieldKey || diagnostic.code}`,
      kind: "report_row_diagnostic",
      severity: diagnostic.severity,
      confidence: 1,
      sourceFile: packet.sourceFile,
      sourceRowNumber: diagnostic.sourceRowNumber ?? null,
      recordKind: packet.summary.recordKind,
      reportValue: diagnostic.fieldKey,
      explanation: [diagnostic.message],
      proposedAction: "Review report mapping or source report headers.",
    });
  }
}

export function buildReconciliationReview(packets: ReconciliationPacket[], dashboard: DashboardData): ReconciliationReviewResult {
  const findings: ReconciliationFinding[] = [];
  const customerIndexes = buildCustomerIndexes(dashboard.customers);

  for (const packet of packets) {
    addRecordDiagnostics(findings, packet);
    for (const record of packet.records) {
      const match = findCustomer(record, customerIndexes);
      const customer = match.customer;
      const customerId = customer ? text(customer.id) : "";
      const name = recordNameKey(record);
      const hasIdentity = Boolean(record.customerIdentity.hmisId || name);

      if (!customer && hasIdentity) {
        findings.push({
          id: findingId("customer_missing", record, record.customerIdentity.hmisId || name),
          kind: "customer_missing",
          severity: "error",
          confidence: 0.8,
          sourceFile: record.sourceFile,
          sourceRowNumber: record.sourceRowNumber,
          recordKind: record.recordKind,
          reportValue: record.customerIdentity.hmisId || name,
          explanation: ["Report row has a customer identity that was not found in dashboard cached customers."],
          proposedAction: "Review customer identity and create or link the dashboard customer if appropriate.",
        });
        continue;
      }

      if (customer && match.confidence < 0.8) {
        findings.push({
          id: findingId("customer_possible_match", record, customerId),
          kind: "customer_possible_match",
          severity: "warning",
          confidence: match.confidence,
          sourceFile: record.sourceFile,
          sourceRowNumber: record.sourceRowNumber,
          recordKind: record.recordKind,
          customerId,
          customerLabel: customerLabel(customer),
          explanation: [`Customer matched by ${match.method}; review before applying any identity changes.`],
          proposedAction: "Confirm customer identity.",
        });
      }

      if (customer) {
        const activeEnrollments = findEnrollments(customerId, dashboard.enrollments);
        const reportGrant = recordGrantKey(record);
        const matchingEnrollment =
          activeEnrollments.find((enrollment) => {
            const key = enrollmentGrantKey(enrollment);
            return reportGrant && key && (reportGrant.includes(key) || key.includes(reportGrant));
          }) ?? activeEnrollments[0] ?? null;

        if ((record.recordKind === "coordinatedEntryEnrollment" || record.enrollmentEvidence.projectName || record.enrollmentEvidence.entryDate) && !matchingEnrollment) {
          findings.push({
            id: findingId("enrollment_missing", record, customerId),
            kind: "enrollment_missing",
            severity: "error",
            confidence: 0.75,
            sourceFile: record.sourceFile,
            sourceRowNumber: record.sourceRowNumber,
            recordKind: record.recordKind,
            customerId,
            customerLabel: customerLabel(customer),
            reportValue: record.enrollmentEvidence.projectName || record.enrollmentEvidence.programId,
            explanation: ["Report row indicates enrollment evidence, but no active dashboard enrollment was found for this customer/profile."],
            proposedAction: "Review for CREATE_ENROLLMENT.",
          });
        }

        if (matchingEnrollment) {
          const enrollmentId = text(matchingEnrollment.id);
          const dashboardEntry = dateOf(matchingEnrollment, ["entryDate", "startDate", "enrolledAt"]);
          const dashboardExit = dateOf(matchingEnrollment, ["exitDate", "endDate", "closedAt"]);
          if (record.enrollmentEvidence.entryDate && dashboardEntry && record.enrollmentEvidence.entryDate !== dashboardEntry) {
            findings.push({
              id: findingId("entry_date_mismatch", record, enrollmentId),
              kind: "entry_date_mismatch",
              severity: "warning",
              confidence: 0.7,
              sourceFile: record.sourceFile,
              sourceRowNumber: record.sourceRowNumber,
              recordKind: record.recordKind,
              customerId,
              customerLabel: customerLabel(customer),
              enrollmentId,
              reportValue: record.enrollmentEvidence.entryDate,
              dashboardValue: dashboardEntry,
              explanation: ["Report entry date differs from dashboard enrollment entry/start date."],
              proposedAction: "Review enrollment date source of truth.",
            });
          }
          if (record.enrollmentEvidence.exitDate && record.enrollmentEvidence.exitDate !== dashboardExit) {
            findings.push({
              id: findingId("exit_date_mismatch", record, enrollmentId),
              kind: "exit_date_mismatch",
              severity: "warning",
              confidence: 0.75,
              sourceFile: record.sourceFile,
              sourceRowNumber: record.sourceRowNumber,
              recordKind: record.recordKind,
              customerId,
              customerLabel: customerLabel(customer),
              enrollmentId,
              reportValue: record.enrollmentEvidence.exitDate,
              dashboardValue: dashboardExit || "active/no exit date",
              explanation: ["Report exit date differs from the dashboard enrollment exit/closed date."],
              proposedAction: dashboardExit ? "Review enrollment exit date conflict." : "Review for CLOSE_ENROLLMENT.",
            });
          }

          const compliance = matchingEnrollment.compliance && typeof matchingEnrollment.compliance === "object"
            ? matchingEnrollment.compliance as Record<string, unknown>
            : {};
          if (record.recordKind.startsWith("hmis") && compliance.hmisEntryComplete !== true) {
            findings.push({
              id: findingId("enrollment_compliance_missing", record, `${enrollmentId}:hmisEntry`),
              kind: "enrollment_compliance_missing",
              severity: "warning",
              confidence: 0.65,
              sourceFile: record.sourceFile,
              sourceRowNumber: record.sourceRowNumber,
              recordKind: record.recordKind,
              customerId,
              customerLabel: customerLabel(customer),
              enrollmentId,
              explanation: ["HMIS report evidence exists, but the dashboard enrollment does not show HMIS entry compliance complete."],
              proposedAction: "Review HMIS enrollment compliance flag.",
            });
          }
        }
      }

      if (record.paymentEvidence.amount != null) {
        const candidates = findPaymentCandidates(record, dashboard.paymentQueueItems, customerId || undefined);
        if (!candidates.length) {
          findings.push({
            id: findingId("payment_missing_dashboard", record, `${record.paymentEvidence.amount}:${record.paymentEvidence.serviceMonth}`),
            kind: "payment_missing_dashboard",
            severity: record.recordKind === "financialEdgeTransaction" ? "error" : "warning",
            confidence: 0.7,
            sourceFile: record.sourceFile,
            sourceRowNumber: record.sourceRowNumber,
            recordKind: record.recordKind,
            customerId: customerId || undefined,
            customerLabel: customer ? customerLabel(customer) : undefined,
            reportValue: `${record.paymentEvidence.amount} ${record.paymentEvidence.serviceMonth || record.paymentEvidence.transactionDate}`,
            explanation: ["Report payment/service row did not match a cached dashboard payment queue item by customer, amount, and month."],
            proposedAction: "Review for missing payment schedule, unmatched FE transaction, or mapping issue.",
          });
        } else if (candidates.length > 1) {
          findings.push({
            id: findingId("payment_possible_match", record, String(candidates.length)),
            kind: "payment_possible_match",
            severity: "warning",
            confidence: 0.55,
            sourceFile: record.sourceFile,
            sourceRowNumber: record.sourceRowNumber,
            recordKind: record.recordKind,
            customerId: customerId || undefined,
            customerLabel: customer ? customerLabel(customer) : undefined,
            explanation: [`Found ${candidates.length} possible dashboard payment matches by amount/month.`],
            proposedAction: "Review candidate payment match manually.",
          });
        }
      }
    }
  }

  const byKind: Record<string, number> = {};
  const bySeverity: Record<ReportDiagnosticSeverity, number> = { info: 0, warning: 0, error: 0 };
  for (const finding of findings) {
    byKind[finding.kind] = (byKind[finding.kind] ?? 0) + 1;
    bySeverity[finding.severity] += 1;
  }

  return {
    findings,
    summary: {
      packetCount: packets.length,
      reportRows: packets.reduce((sum, packet) => sum + packet.summary.totalRows, 0),
      findingCount: findings.length,
      byKind,
      bySeverity,
    },
  };
}
