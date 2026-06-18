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
  | "payment_missing_hmis"
  | "payment_missing_financial_edge"
  | "payment_possible_match"
  | "payment_amount_mismatch"
  | "grant_mapping_review"
  | "report_row_diagnostic";

export type ReconciliationSourceSystem = "hmis" | "financial_edge" | "caseworthy" | "dashboard" | "unknown";

export type ReconciliationMatchContext = {
  criteria: string[];
  customerMethod?: string;
  customerConfidence?: number;
  paymentCandidateCount?: number;
};

export type ReconciliationFinding = {
  id: string;
  kind: ReconciliationFindingKind;
  /** Human-readable, context-aware headline (filled in post-pass). */
  title?: string;
  sourceSystem: ReconciliationSourceSystem;
  sourceSystemLabel: string;
  severity: ReportDiagnosticSeverity;
  confidence: number;
  sourceFile: string;
  sourceProfileId?: string;
  sourceProfileLabel?: string;
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
  reportRecord?: NormalizedReportRecord;
  matchedCustomer?: Record<string, unknown>;
  matchedEnrollment?: Record<string, unknown>;
  matchedPaymentCandidates?: Array<Record<string, unknown>>;
  match?: ReconciliationMatchContext;
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
  ledger?: Array<Record<string, unknown>>;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function lower(value: unknown) {
  return text(value).toLowerCase();
}

function sourceSystemFor(sourceType: unknown, recordKind: unknown): ReconciliationSourceSystem {
  const value = lower(`${sourceType || ""} ${recordKind || ""}`);
  if (value.includes("financial") || value.includes("edge")) return "financial_edge";
  if (value.includes("hmis") || value.includes("coordinated")) return "hmis";
  if (value.includes("caseworthy")) return "caseworthy";
  if (value.includes("dashboard")) return "dashboard";
  return "unknown";
}

function sourceSystemLabel(system: ReconciliationSourceSystem) {
  if (system === "financial_edge") return "Financial Edge";
  if (system === "hmis") return "HMIS";
  if (system === "caseworthy") return "Caseworthy";
  if (system === "dashboard") return "Dashboard";
  return "Unknown source";
}

function cents(value: unknown) {
  const amount = normalizeAmount(value);
  return amount == null ? null : Math.round(amount * 100);
}

function rowCents(row: Record<string, unknown>) {
  const amountCents = Number(row.amountCents);
  if (Number.isFinite(amountCents)) return Math.round(amountCents);
  return cents(row.amount ?? row.amountAbs);
}

function monthKey(value: unknown) {
  return normalizeDate(value).slice(0, 7);
}

function tokenSet(value: unknown) {
  return new Set(lower(value).split(/[^a-z0-9]+/).filter((token) => token.length >= 3));
}

function hasTokenOverlap(a: unknown, b: unknown) {
  const left = tokenSet(a);
  if (!left.size) return false;
  for (const token of tokenSet(b)) if (left.has(token)) return true;
  return false;
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

function customerCaseworthyId(customer: Record<string, unknown>) {
  return text(customer.caseworthyId ?? customer.caseWorthyId ?? customer.cwId ?? customer.CWID);
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

function namePartsFromCustomer(customer: Record<string, unknown>) {
  const first = normalizeCustomerName(customer.firstName ?? customer.givenName);
  const last = normalizeCustomerName(customer.lastName ?? customer.surname);
  if (first || last) return { first, last };
  const parts = customerNameKey(customer).split(" ").filter(Boolean);
  return { first: parts[0] ?? "", last: parts.length > 1 ? parts[parts.length - 1] : "" };
}

function namePartsFromRecord(record: NormalizedReportRecord) {
  const first = normalizeCustomerName(record.customerIdentity.firstName);
  const last = normalizeCustomerName(record.customerIdentity.lastName);
  if (first || last) return { first, last };
  const parts = recordNameKey(record).split(" ").filter(Boolean);
  return { first: parts[0] ?? "", last: parts.length > 1 ? parts[parts.length - 1] : "" };
}

function editDistance(a: string, b: string) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = Array.from({ length: b.length + 1 }, () => 0);
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j];
  }
  return prev[b.length];
}

function closeSpelling(a: string, b: string) {
  if (!a || !b) return false;
  const max = Math.max(a.length, b.length);
  if (max < 4) return a === b;
  return editDistance(a, b) <= (max <= 6 ? 1 : 2);
}

function buildCustomerIndexes(customers: Array<Record<string, unknown>>) {
  const byId = new Map<string, Record<string, unknown>>();
  const byCaseworthy = new Map<string, Record<string, unknown>>();
  const byHmis = new Map<string, Record<string, unknown>>();
  const byNameDob = new Map<string, Record<string, unknown>>();
  const byName = new Map<string, Record<string, unknown>[]>();
  for (const customer of customers) {
    const id = text(customer.id);
    if (id) byId.set(id, customer);
    const caseworthyId = customerCaseworthyId(customer);
    if (caseworthyId) byCaseworthy.set(caseworthyId, customer);
    const hmisId = customerHmisId(customer);
    if (hmisId) byHmis.set(hmisId, customer);
    const name = customerNameKey(customer);
    const dob = customerDob(customer);
    if (name && dob) byNameDob.set(`${name}|${dob}`, customer);
    if (name) byName.set(name, [...(byName.get(name) ?? []), customer]);
  }
  return { byId, byCaseworthy, byHmis, byNameDob, byName, all: customers };
}

function findCustomer(record: NormalizedReportRecord, indexes: ReturnType<typeof buildCustomerIndexes>) {
  const dashboardId = text(record.customerIdentity.dashboardCustomerId);
  if (dashboardId && indexes.byId.has(dashboardId)) return { customer: indexes.byId.get(dashboardId) ?? null, confidence: 1, method: "dashboard customer ID" };
  const caseworthyId = text(record.customerIdentity.caseworthyId);
  if (caseworthyId && indexes.byCaseworthy.has(caseworthyId)) return { customer: indexes.byCaseworthy.get(caseworthyId) ?? null, confidence: 1, method: "Caseworthy ID (CWID)" };
  const hmisId = text(record.customerIdentity.hmisId);
  if (hmisId && indexes.byHmis.has(hmisId)) return { customer: indexes.byHmis.get(hmisId) ?? null, confidence: 1, method: "HMIS ID" };
  const name = recordNameKey(record);
  const dob = normalizeDate(record.customerIdentity.dob);
  if (name && dob && indexes.byNameDob.has(`${name}|${dob}`)) {
    return { customer: indexes.byNameDob.get(`${name}|${dob}`) ?? null, confidence: 0.97, method: "first + last name + DOB" };
  }
  const nameMatches = name ? indexes.byName.get(name) ?? [] : [];
  if (nameMatches.length === 1) return { customer: nameMatches[0], confidence: 0.9, method: "first + last name exact; verify DOB" };

  const recordParts = namePartsFromRecord(record);
  let fuzzy: Record<string, unknown> | null = null;
  for (const customer of indexes.all) {
    const customerParts = namePartsFromCustomer(customer);
    const firstExact = recordParts.first && customerParts.first && recordParts.first === customerParts.first;
    const lastExact = recordParts.last && customerParts.last && recordParts.last === customerParts.last;
    if ((firstExact && !lastExact) || (lastExact && !firstExact)) continue;
    const firstClose = closeSpelling(recordParts.first, customerParts.first);
    const lastClose = closeSpelling(recordParts.last, customerParts.last);
    if (firstClose && lastClose) {
      fuzzy = customer;
      break;
    }
  }
  if (fuzzy) return { customer: fuzzy, confidence: 0.5, method: "close first + last spelling; manual review required" };
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

function paymentRowMonth(row: Record<string, unknown>) {
  return text(row.month) || monthKey(row.dueDate ?? row.transactionDate ?? row.postedAt ?? row.date ?? row.serviceDate);
}

function paymentRowVendor(row: Record<string, unknown>) {
  return text(row.vendor ?? row.merchant ?? row.payee ?? row.landlord ?? row.customerNameAtSpend ?? row.description ?? row.note ?? row.notes);
}

function paymentRowGrant(row: Record<string, unknown>) {
  return text(row.grantId ?? row.grantName ?? row.program ?? row.project ?? row.lineItemName);
}

function paymentRowSource(row: Record<string, unknown>) {
  const source = lower(row.source ?? row.kind ?? row.originSource ?? (row.origin as Record<string, unknown> | undefined)?.paymentQueueSource);
  if (source.includes("ledger") || "amountCents" in row || "paid" in row) return "ledger";
  if (source.includes("queue") || "queueStatus" in row) return "payment queue";
  return "dashboard payment";
}

function reportPaymentKey(record: NormalizedReportRecord) {
  return [
    recordNameKey(record),
    record.paymentEvidence.serviceMonth || monthKey(record.paymentEvidence.transactionDate),
    cents(record.paymentEvidence.amount) ?? "noamount",
  ].join("|");
}

function scoreReportPaymentCandidate(source: NormalizedReportRecord, candidate: NormalizedReportRecord) {
  const sourceName = recordNameKey(source);
  const candidateName = recordNameKey(candidate);
  const sourceMonth = source.paymentEvidence.serviceMonth || monthKey(source.paymentEvidence.transactionDate);
  const candidateMonth = candidate.paymentEvidence.serviceMonth || monthKey(candidate.paymentEvidence.transactionDate);
  const sourceAmount = cents(source.paymentEvidence.amount);
  const candidateAmount = cents(candidate.paymentEvidence.amount);
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 0;

  if (source.customerIdentity.hmisId && candidate.customerIdentity.hmisId && source.customerIdentity.hmisId === candidate.customerIdentity.hmisId) {
    score += 45;
    reasons.push("HMIS ID exact");
  } else if (sourceName && candidateName && sourceName === candidateName) {
    score += 35;
    reasons.push("name exact");
  } else if (sourceName && candidateName && hasTokenOverlap(sourceName, candidateName)) {
    score += 18;
    reasons.push("name token overlap");
  }

  if (sourceMonth && candidateMonth && sourceMonth === candidateMonth) {
    score += 30;
    reasons.push("same service month");
  } else if (sourceMonth && candidateMonth) {
    warnings.push(`month differs (${sourceMonth} vs ${candidateMonth})`);
    score -= 15;
  }

  if (sourceAmount != null && candidateAmount != null) {
    const diff = Math.abs(sourceAmount - candidateAmount);
    if (diff <= 1) {
      score += 35;
      reasons.push("amount exact");
    } else if (diff <= 5000) {
      score += 12;
      warnings.push(`amount differs by ${(diff / 100).toFixed(2)}`);
    } else {
      score -= 25;
      warnings.push(`amount differs by ${(diff / 100).toFixed(2)}`);
    }
  }

  if (hasTokenOverlap(source.paymentEvidence.grant || source.enrollmentEvidence.projectName, candidate.paymentEvidence.grant || candidate.enrollmentEvidence.projectName)) {
    score += 8;
    reasons.push("grant/provider overlap");
  }

  return { record: candidate, score, reasons, warnings, amountDiffCents: sourceAmount != null && candidateAmount != null ? sourceAmount - candidateAmount : null };
}

function findReportPaymentCandidates(source: NormalizedReportRecord, candidates: NormalizedReportRecord[]) {
  return candidates
    .map((candidate) => scoreReportPaymentCandidate(source, candidate))
    .filter((candidate) => candidate.score >= 45)
    .sort((a, b) => b.score - a.score);
}

function scorePaymentCandidate(record: NormalizedReportRecord, row: Record<string, unknown>, customerId?: string) {
  const amount = cents(record.paymentEvidence.amount);
  const serviceMonth = record.paymentEvidence.serviceMonth || monthKey(record.paymentEvidence.transactionDate);
  const itemAmount = rowCents(row);
  const itemMonth = paymentRowMonth(row);
  const reportVendor = record.paymentEvidence.vendor || record.paymentEvidence.reference;
  const itemVendor = paymentRowVendor(row);
  const reportGrant = record.paymentEvidence.grant || record.enrollmentEvidence.projectName;
  const itemGrant = paymentRowGrant(row);
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 0;

  if (customerId && text(row.customerId) === customerId) {
    score += 40;
    reasons.push("customerId exact");
  } else if (customerId && text(row.customerId)) {
    score -= 30;
    warnings.push("different customerId");
  } else if (record.customerIdentity.fullName && hasTokenOverlap(record.customerIdentity.fullName, row.customerNameAtSpend ?? row.customerName ?? row.customer)) {
    score += 18;
    reasons.push("customer name token overlap");
  }

  if (serviceMonth && itemMonth && serviceMonth === itemMonth) {
    score += 25;
    reasons.push("same service month");
  } else if (serviceMonth && itemMonth) {
    score -= 15;
    warnings.push(`month differs (${serviceMonth} vs ${itemMonth})`);
  }

  if (amount != null && itemAmount != null) {
    const diff = Math.abs(amount - itemAmount);
    if (diff <= 1) {
      score += 30;
      reasons.push("amount exact");
    } else if (diff <= 5000) {
      score += 8;
      warnings.push(`amount differs by ${(diff / 100).toFixed(2)}`);
    } else {
      score -= 20;
      warnings.push(`amount differs by ${(diff / 100).toFixed(2)}`);
    }
  }

  if (reportVendor && itemVendor && hasTokenOverlap(reportVendor, itemVendor)) {
    score += 10;
    reasons.push("vendor/payee overlap");
  }

  if (reportGrant && itemGrant && hasTokenOverlap(reportGrant, itemGrant)) {
    score += 10;
    reasons.push("grant/project overlap");
  }

  if (lower(row.queueStatus) === "void") {
    score -= 20;
    warnings.push("queue item is void");
  }

  return { row, score, reasons, warnings, amountDiffCents: amount != null && itemAmount != null ? amount - itemAmount : null };
}

function findPaymentCandidates(record: NormalizedReportRecord, paymentRows: Array<Record<string, unknown>>, customerId?: string) {
  return paymentRows
    .map((row) => scorePaymentCandidate(record, row, customerId))
    .filter((candidate) => candidate.score >= 35)
    .sort((a, b) => b.score - a.score)
    .map((candidate) => ({
      ...candidate.row,
      _matchScore: candidate.score,
      _matchReasons: candidate.reasons,
      _matchWarnings: candidate.warnings,
      _matchSource: paymentRowSource(candidate.row),
      _amountDiffCents: candidate.amountDiffCents,
    }));
}

function findingId(kind: ReconciliationFindingKind, record: NormalizedReportRecord, suffix: string) {
  return [kind, record.sourceFile, record.sourceRowNumber ?? "row", suffix].join("::");
}

function addRecordDiagnostics(findings: ReconciliationFinding[], packet: ReconciliationPacket) {
  const system = sourceSystemFor(packet.summary.sourceType, packet.summary.recordKind);
  for (const diagnostic of packet.diagnostics) {
    findings.push({
      id: `diagnostic::${packet.sourceFile}::${diagnostic.fieldKey || diagnostic.code}`,
      kind: "report_row_diagnostic",
      sourceSystem: system,
      sourceSystemLabel: sourceSystemLabel(system),
      severity: diagnostic.severity,
      confidence: 1,
      sourceFile: packet.sourceFile,
      sourceProfileId: packet.profileId,
      sourceProfileLabel: packet.profileLabel,
      sourceRowNumber: diagnostic.sourceRowNumber ?? null,
      recordKind: packet.summary.recordKind,
      reportValue: diagnostic.fieldKey,
      explanation: [diagnostic.message],
      proposedAction: "Review report mapping or source report headers.",
    });
  }
}

function findingTitle(finding: ReconciliationFinding): string {
  const who = finding.customerLabel || finding.customerId || "Unmatched row";
  const source = finding.sourceSystemLabel;
  switch (finding.kind) {
    case "customer_missing":
      return `${source} name/ID missing from dashboard: ${finding.reportValue || who}`;
    case "customer_possible_match":
      return `Low-confidence ${source} customer match: ${who}`;
    case "enrollment_missing":
      return `${source} enrollment missing from dashboard: ${who}`;
    case "entry_date_mismatch":
      return `${source} entry date differs from dashboard: ${who}`;
    case "exit_date_mismatch":
      return `${source} exit date differs from dashboard: ${who}`;
    case "enrollment_compliance_missing":
      return `${source} evidence not marked complete in dashboard: ${who}`;
    case "payment_missing_dashboard":
      return `${source} payment row missing from dashboard queue/ledger: ${who}`;
    case "payment_missing_hmis":
      return `FE payment row missing from HMIS: ${who}`;
    case "payment_missing_financial_edge":
      return `${source} payment row missing from FE: ${who}`;
    case "payment_possible_match":
      return `Multiple dashboard payment matches for ${source} row: ${who}`;
    case "payment_amount_mismatch":
      return `${source} payment amount differs from dashboard: ${who}`;
    case "grant_mapping_review":
      return `${source} grant/provider mapping needs review: ${who}`;
    case "report_row_diagnostic":
      return `${source} report data issue${finding.reportValue ? `: ${finding.reportValue}` : ""}`;
    default:
      return finding.kind.replace(/_/g, " ");
  }
}

export function buildReconciliationReview(packets: ReconciliationPacket[], dashboard: DashboardData): ReconciliationReviewResult {
  const findings: ReconciliationFinding[] = [];
  const customerIndexes = buildCustomerIndexes(dashboard.customers);
  const paymentRecords = packets.flatMap((packet) => packet.records.map((record) => ({ packet, record })))
    .filter(({ record }) => record.paymentEvidence.amount != null);
  const fePaymentRecords = paymentRecords.filter(({ record }) => sourceSystemFor(record.sourceType, record.recordKind) === "financial_edge");
  const hmisPaymentRecords = paymentRecords.filter(({ record }) => {
    const system = sourceSystemFor(record.sourceType, record.recordKind);
    return system === "hmis" || system === "caseworthy";
  });
  const feKeys = new Set(fePaymentRecords.map(({ record }) => reportPaymentKey(record)));
  const matchedHmisKeys = new Set<string>();

  for (const packet of packets) {
    addRecordDiagnostics(findings, packet);
    for (const record of packet.records) {
      const sourceSystem = sourceSystemFor(record.sourceType, record.recordKind);
      const sourceLabel = sourceSystemLabel(sourceSystem);
      const match = findCustomer(record, customerIndexes);
      const customer = match.customer;
      const customerId = customer ? text(customer.id) : "";
      const name = recordNameKey(record);
      const hasIdentity = Boolean(record.customerIdentity.caseworthyId || record.customerIdentity.hmisId || name);

      if (!customer && hasIdentity) {
        findings.push({
          id: findingId("customer_missing", record, record.customerIdentity.hmisId || name),
          kind: "customer_missing",
          sourceSystem,
          sourceSystemLabel: sourceLabel,
          severity: "error",
          confidence: 0.8,
          sourceFile: record.sourceFile,
          sourceProfileId: packet.profileId,
          sourceProfileLabel: packet.profileLabel,
          sourceRowNumber: record.sourceRowNumber,
          recordKind: record.recordKind,
          reportValue: record.customerIdentity.hmisId || name,
          explanation: [`${sourceLabel} row has a customer identity that was not found in dashboard cached customers.`],
          proposedAction: "Review customer identity and create or link the dashboard customer if appropriate.",
          reportRecord: record,
          match: { criteria: ["No dashboard customer matched by dashboard ID, CWID, HMIS ID, exact first + last name, first + last + DOB, or close first + last spelling."] },
        });
        continue;
      }

      if (customer && match.confidence < 0.95) {
        findings.push({
          id: findingId("customer_possible_match", record, customerId),
          kind: "customer_possible_match",
          sourceSystem,
          sourceSystemLabel: sourceLabel,
          severity: "warning",
          confidence: match.confidence,
          sourceFile: record.sourceFile,
          sourceProfileId: packet.profileId,
          sourceProfileLabel: packet.profileLabel,
          sourceRowNumber: record.sourceRowNumber,
          recordKind: record.recordKind,
          customerId,
          customerLabel: customerLabel(customer),
          explanation: [`${sourceLabel} customer matched by ${match.method}; review before applying any identity changes.`],
          proposedAction: "Confirm customer identity.",
          reportRecord: record,
          matchedCustomer: customer,
          match: { criteria: [`Matched customer by ${match.method}.`], customerMethod: match.method, customerConfidence: match.confidence },
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
            sourceSystem,
            sourceSystemLabel: sourceLabel,
            severity: "error",
            confidence: 0.75,
            sourceFile: record.sourceFile,
            sourceProfileId: packet.profileId,
            sourceProfileLabel: packet.profileLabel,
            sourceRowNumber: record.sourceRowNumber,
            recordKind: record.recordKind,
            customerId,
            customerLabel: customerLabel(customer),
            reportValue: record.enrollmentEvidence.projectName || record.enrollmentEvidence.programId,
            explanation: [`${sourceLabel} row indicates enrollment evidence, but no matching dashboard enrollment was found for this customer/profile.`],
            proposedAction: "Review for CREATE_ENROLLMENT.",
            reportRecord: record,
            matchedCustomer: customer,
            match: { criteria: [`Customer matched by ${match.method}.`, "No active dashboard enrollment matched the report grant/provider signal."] },
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
              sourceSystem,
              sourceSystemLabel: sourceLabel,
              severity: "warning",
              confidence: 0.7,
              sourceFile: record.sourceFile,
              sourceProfileId: packet.profileId,
              sourceProfileLabel: packet.profileLabel,
              sourceRowNumber: record.sourceRowNumber,
              recordKind: record.recordKind,
              customerId,
              customerLabel: customerLabel(customer),
              enrollmentId,
              reportValue: record.enrollmentEvidence.entryDate,
              dashboardValue: dashboardEntry,
              explanation: [`${sourceLabel} entry date differs from dashboard enrollment entry/start date.`],
              proposedAction: "Review enrollment date source of truth.",
              reportRecord: record,
              matchedCustomer: customer,
              matchedEnrollment: matchingEnrollment,
              match: { criteria: [`Customer matched by ${match.method}.`, `Enrollment matched by ${reportGrant ? "grant/provider signal" : "first active enrollment fallback"}.`] },
            });
          }
          if (record.enrollmentEvidence.exitDate && record.enrollmentEvidence.exitDate !== dashboardExit) {
            findings.push({
              id: findingId("exit_date_mismatch", record, enrollmentId),
              kind: "exit_date_mismatch",
              sourceSystem,
              sourceSystemLabel: sourceLabel,
              severity: "warning",
              confidence: 0.75,
              sourceFile: record.sourceFile,
              sourceProfileId: packet.profileId,
              sourceProfileLabel: packet.profileLabel,
              sourceRowNumber: record.sourceRowNumber,
              recordKind: record.recordKind,
              customerId,
              customerLabel: customerLabel(customer),
              enrollmentId,
              reportValue: record.enrollmentEvidence.exitDate,
              dashboardValue: dashboardExit || "active/no exit date",
              explanation: [`${sourceLabel} exit date differs from the dashboard enrollment exit/closed date.`],
              proposedAction: dashboardExit ? "Review enrollment exit date conflict." : "Review for CLOSE_ENROLLMENT.",
              reportRecord: record,
              matchedCustomer: customer,
              matchedEnrollment: matchingEnrollment,
              match: { criteria: [`Customer matched by ${match.method}.`, `Enrollment matched by ${reportGrant ? "grant/provider signal" : "first active enrollment fallback"}.`] },
            });
          }

          const compliance = matchingEnrollment.compliance && typeof matchingEnrollment.compliance === "object"
            ? matchingEnrollment.compliance as Record<string, unknown>
            : {};
          if (record.recordKind.startsWith("hmis") && compliance.hmisEntryComplete !== true) {
            findings.push({
              id: findingId("enrollment_compliance_missing", record, `${enrollmentId}:hmisEntry`),
              kind: "enrollment_compliance_missing",
              sourceSystem,
              sourceSystemLabel: sourceLabel,
              severity: "warning",
              confidence: 0.65,
              sourceFile: record.sourceFile,
              sourceProfileId: packet.profileId,
              sourceProfileLabel: packet.profileLabel,
              sourceRowNumber: record.sourceRowNumber,
              recordKind: record.recordKind,
              customerId,
              customerLabel: customerLabel(customer),
              enrollmentId,
              explanation: [`${sourceLabel} report evidence exists, but the dashboard enrollment does not show HMIS entry compliance complete.`],
              proposedAction: "Review HMIS enrollment compliance flag.",
              reportRecord: record,
              matchedCustomer: customer,
              matchedEnrollment: matchingEnrollment,
              match: { criteria: [`Customer matched by ${match.method}.`, "Dashboard enrollment compliance.hmisEntryComplete is not true."] },
            });
          }
        }
      }

      if (record.paymentEvidence.amount != null) {
        const isFinancialEdge = sourceSystem === "financial_edge";
        const isHmisLike = sourceSystem === "hmis" || sourceSystem === "caseworthy";
        if (!isFinancialEdge && !isHmisLike) continue;

        if (isFinancialEdge) {
          const hmisCandidates = findReportPaymentCandidates(record, hmisPaymentRecords.map((item) => item.record));
          const bestHmis = hmisCandidates[0];
          if (!bestHmis) {
            findings.push({
              id: findingId("payment_missing_hmis", record, `${record.paymentEvidence.amount}:${record.paymentEvidence.serviceMonth}`),
              kind: "payment_missing_hmis",
              sourceSystem,
              sourceSystemLabel: sourceLabel,
              severity: "error",
              confidence: 0.78,
              sourceFile: record.sourceFile,
              sourceProfileId: packet.profileId,
              sourceProfileLabel: packet.profileLabel,
              sourceRowNumber: record.sourceRowNumber,
              recordKind: record.recordKind,
              customerId: customerId || undefined,
              customerLabel: customer ? customerLabel(customer) : undefined,
              reportValue: `${record.paymentEvidence.amount} ${record.paymentEvidence.serviceMonth || record.paymentEvidence.transactionDate}`,
              explanation: ["Financial Edge has this payment in the selected date frame, but no HMIS/Caseworthy service row matched by name/ID, amount, and month."],
              proposedAction: "Enter or correct the HMIS/Caseworthy service/payment row, or document why FE should be corrected.",
              reportRecord: record,
              matchedCustomer: customer ?? undefined,
              match: {
                criteria: ["FE is source of truth for payment reconciliation.", "No HMIS/Caseworthy row matched by name/ID + service month + amount."],
                customerMethod: match.method || undefined,
                customerConfidence: match.confidence || undefined,
                paymentCandidateCount: 0,
              },
            });
          } else {
            matchedHmisKeys.add(reportPaymentKey(bestHmis.record));
            const amountDiff = Number(bestHmis.amountDiffCents);
            if (Number.isFinite(amountDiff) && Math.abs(amountDiff) > 1) {
              findings.push({
                id: findingId("payment_amount_mismatch", record, `hmis:${bestHmis.record.sourceFile}:${bestHmis.record.sourceRowNumber}`),
                kind: "payment_amount_mismatch",
                sourceSystem,
                sourceSystemLabel: sourceLabel,
                severity: "warning",
                confidence: Math.min(0.95, bestHmis.score / 100),
                sourceFile: record.sourceFile,
                sourceProfileId: packet.profileId,
                sourceProfileLabel: packet.profileLabel,
                sourceRowNumber: record.sourceRowNumber,
                recordKind: record.recordKind,
                customerId: customerId || undefined,
                customerLabel: customer ? customerLabel(customer) : undefined,
                reportValue: String(record.paymentEvidence.amount),
                dashboardValue: String(bestHmis.record.paymentEvidence.amount ?? ""),
                explanation: ["Financial Edge and HMIS/Caseworthy appear to describe the same payment, but the amounts differ."],
                proposedAction: "Correct the HMIS/Caseworthy amount or verify FE needs correction.",
                reportRecord: record,
                matchedCustomer: customer ?? undefined,
                match: {
                  criteria: ["FE is source of truth for payment reconciliation.", ...bestHmis.reasons, ...bestHmis.warnings],
                  customerMethod: match.method || undefined,
                  customerConfidence: match.confidence || undefined,
                  paymentCandidateCount: hmisCandidates.length,
                },
              });
            }
          }
        }

        if (isHmisLike && !feKeys.has(reportPaymentKey(record)) && !matchedHmisKeys.has(reportPaymentKey(record))) {
          findings.push({
            id: findingId("payment_missing_financial_edge", record, `${record.paymentEvidence.amount}:${record.paymentEvidence.serviceMonth}`),
            kind: "payment_missing_financial_edge",
            sourceSystem,
            sourceSystemLabel: sourceLabel,
            severity: "warning",
            confidence: 0.65,
            sourceFile: record.sourceFile,
            sourceProfileId: packet.profileId,
            sourceProfileLabel: packet.profileLabel,
            sourceRowNumber: record.sourceRowNumber,
            recordKind: record.recordKind,
            customerId: customerId || undefined,
            customerLabel: customer ? customerLabel(customer) : undefined,
            reportValue: `${record.paymentEvidence.amount} ${record.paymentEvidence.serviceMonth || record.paymentEvidence.transactionDate}`,
            explanation: [`${sourceLabel} has a payment/service row in the selected date frame, but no FE row matched. This is often stale data entry after a cancelled payment.`],
            proposedAction: "Verify whether the payment was cancelled; remove/correct HMIS/Caseworthy data entry if FE is correct.",
            reportRecord: record,
            matchedCustomer: customer ?? undefined,
            match: {
              criteria: ["HMIS/Caseworthy row did not match a Financial Edge row by name/ID + service month + amount."],
              customerMethod: match.method || undefined,
              customerConfidence: match.confidence || undefined,
            },
          });
          continue;
        }

        if (!isFinancialEdge) continue;
        const dashboardPaymentRows = [...dashboard.paymentQueueItems, ...(dashboard.ledger ?? [])];
        const candidates = findPaymentCandidates(record, dashboardPaymentRows, customerId || undefined);
        if (!candidates.length) {
          findings.push({
            id: findingId("payment_missing_dashboard", record, `${record.paymentEvidence.amount}:${record.paymentEvidence.serviceMonth}`),
            kind: "payment_missing_dashboard",
            sourceSystem,
            sourceSystemLabel: sourceLabel,
            severity: record.recordKind === "financialEdgeTransaction" ? "error" : "warning",
            confidence: 0.7,
            sourceFile: record.sourceFile,
            sourceProfileId: packet.profileId,
            sourceProfileLabel: packet.profileLabel,
            sourceRowNumber: record.sourceRowNumber,
            recordKind: record.recordKind,
            customerId: customerId || undefined,
            customerLabel: customer ? customerLabel(customer) : undefined,
            reportValue: `${record.paymentEvidence.amount} ${record.paymentEvidence.serviceMonth || record.paymentEvidence.transactionDate}`,
            explanation: [`${sourceLabel} payment/service row did not match cached dashboard payment queue or ledger rows by customer, amount, and month.`],
            proposedAction: "Review for missing payment schedule, unmatched FE transaction, or mapping issue.",
            reportRecord: record,
            matchedCustomer: customer ?? undefined,
            match: {
              criteria: [
                customer ? `Customer matched by ${match.method}.` : "No dashboard customer match was available for payment matching.",
                "No payment queue or ledger row matched amount and service month.",
              ],
              customerMethod: match.method || undefined,
              customerConfidence: match.confidence || undefined,
              paymentCandidateCount: 0,
            },
          });
        } else {
          const best = candidates[0];
          const amountDiff = Number((best as Record<string, unknown>)._amountDiffCents);
          if (Number.isFinite(amountDiff) && Math.abs(amountDiff) > 1) {
            findings.push({
              id: findingId("payment_amount_mismatch", record, String(best.id ?? amountDiff)),
              kind: "payment_amount_mismatch",
              sourceSystem,
              sourceSystemLabel: sourceLabel,
              severity: "warning",
              confidence: Math.min(0.95, Number((best as Record<string, unknown>)._matchScore ?? 55) / 100),
              sourceFile: record.sourceFile,
              sourceProfileId: packet.profileId,
              sourceProfileLabel: packet.profileLabel,
              sourceRowNumber: record.sourceRowNumber,
              recordKind: record.recordKind,
              customerId: customerId || undefined,
              customerLabel: customer ? customerLabel(customer) : undefined,
              reportValue: String(record.paymentEvidence.amount),
              dashboardValue: String((rowCents(best) ?? 0) / 100),
              explanation: [`Best ${String((best as Record<string, unknown>)._matchSource || "dashboard payment")} match has the same customer/month context but a different amount.`],
              proposedAction: "Review source of truth before updating payment queue or ledger.",
              reportRecord: record,
              matchedCustomer: customer ?? undefined,
              matchedPaymentCandidates: candidates.slice(0, 5),
              match: {
                criteria: [
                  customer ? `Customer matched by ${match.method}.` : "Payment matched without a confirmed dashboard customer.",
                  ...((best as Record<string, unknown>)._matchReasons as string[] ?? []),
                  ...((best as Record<string, unknown>)._matchWarnings as string[] ?? []),
                ],
                customerMethod: match.method || undefined,
                customerConfidence: match.confidence || undefined,
                paymentCandidateCount: candidates.length,
              },
            });
          } else if (candidates.length > 1) {
          findings.push({
            id: findingId("payment_possible_match", record, String(candidates.length)),
            kind: "payment_possible_match",
            sourceSystem,
            sourceSystemLabel: sourceLabel,
            severity: "warning",
            confidence: 0.55,
            sourceFile: record.sourceFile,
            sourceProfileId: packet.profileId,
            sourceProfileLabel: packet.profileLabel,
            sourceRowNumber: record.sourceRowNumber,
            recordKind: record.recordKind,
            customerId: customerId || undefined,
            customerLabel: customer ? customerLabel(customer) : undefined,
            explanation: [`Found ${candidates.length} possible dashboard payment matches by customer, amount, and month.`],
            proposedAction: "Review candidate payment match manually.",
            reportRecord: record,
            matchedCustomer: customer ?? undefined,
            matchedPaymentCandidates: candidates.slice(0, 5),
            match: {
              criteria: [
                customer ? `Customer matched by ${match.method}.` : "Payment matched without a confirmed dashboard customer.",
                `Found ${candidates.length} scored queue/ledger candidates.`,
                ...(((candidates[0] as Record<string, unknown>)._matchReasons as string[] | undefined) ?? []),
              ],
              customerMethod: match.method || undefined,
              customerConfidence: match.confidence || undefined,
              paymentCandidateCount: candidates.length,
            },
          });
          }
        }
      }
    }
  }

  const byKind: Record<string, number> = {};
  const bySeverity: Record<ReportDiagnosticSeverity, number> = { info: 0, warning: 0, error: 0 };
  for (const finding of findings) {
    finding.title = findingTitle(finding);
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
