"use client";

import {
  normalizeAmount,
  normalizeCustomerName,
  normalizeDate,
  type NormalizedReportRecord,
  type ReconciliationPacket,
} from "./reportProfiles";

export type CompareMode = "payments" | "enrollments" | "customer_exits";
export type EnrollmentCompareGranularity = "enrollment" | "service";
export type CompareCellStatus = "matched" | "missing" | "mismatch" | "partial" | "unmatched" | "not_scanned";

export type CompareCell = {
  sourceId: string;
  sourceLabel: string;
  status: CompareCellStatus;
  value: string;
  detail?: string;
  row?: Record<string, unknown>;
};

export type CompareRow = {
  id: string;
  mode: CompareMode;
  name: string;
  date: string;
  amount: number | null;
  status: CompareCellStatus;
  matchStatus: string;
  fields: Record<string, string>;
  cells: CompareCell[];
  matchReasons: string[];
};

export type CompareSource = {
  id: string;
  label: string;
  kind: "report" | "database";
};

export type CompareBuildOptions = {
  mode: CompareMode;
  enrollmentGranularity?: EnrollmentCompareGranularity;
  showMissingSystemEnrollments?: boolean;
};

type DatabaseRows = {
  customers: Array<Record<string, unknown>>;
  enrollments: Array<Record<string, unknown>>;
  grants: Array<Record<string, unknown>>;
  paymentQueueItems: Array<Record<string, unknown>>;
  ledger: Array<Record<string, unknown>>;
};

type PaymentUnit = {
  id: string;
  sourceId: string;
  sourceLabel: string;
  sourceKind: "report" | "database";
  sourceProfileId?: string;
  name: string;
  nameKey: string;
  initialNameKey: string;
  identityKey: string;
  grantKey: string;
  date: string;
  month: string;
  amount: number | null;
  amountCents: number | null;
  vendor: string;
  status: string;
  paidSignal: boolean;
  row: Record<string, unknown>;
};

const money = (value: unknown) => {
  const parsed = normalizeAmount(value);
  return parsed == null ? null : parsed;
};
const cents = (value: unknown) => {
  const parsed = money(value);
  return parsed == null ? null : Math.round(parsed * 100);
};
const text = (value: unknown) => String(value ?? "").trim();
const lower = (value: unknown) => text(value).toLowerCase();
const monthOf = (value: unknown) => normalizeDate(value).slice(0, 7);

function customerLabel(customer: Record<string, unknown> | null | undefined) {
  if (!customer) return "";
  const first = text(customer.firstName ?? customer.givenName);
  const last = text(customer.lastName ?? customer.surname);
  return text(customer.fullName ?? customer.name) || `${first} ${last}`.trim() || text(customer.id);
}

function customerHmisId(customer: Record<string, unknown> | null | undefined) {
  return text(customer?.hmisId ?? customer?.HMISId ?? customer?.hmisClientId ?? customer?.clientId);
}

function customerCaseworthyId(customer: Record<string, unknown> | null | undefined) {
  return text(customer?.caseworthyId ?? customer?.caseWorthyId ?? customer?.cwId ?? customer?.CWID);
}

function sourceId(label: string) {
  return label.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase() || "source";
}

function packetSourceMetas(packets: ReconciliationPacket[]) {
  const labelCounts = new Map<string, number>();
  for (const packet of packets) labelCounts.set(packet.sourceFile, (labelCounts.get(packet.sourceFile) ?? 0) + 1);
  const seen = new Map<string, number>();
  return packets.map((packet, index) => {
    const duplicateCount = labelCounts.get(packet.sourceFile) ?? 0;
    const nextSeen = (seen.get(packet.sourceFile) ?? 0) + 1;
    seen.set(packet.sourceFile, nextSeen);
    const suffix = duplicateCount > 1 ? ` #${nextSeen}` : "";
    return {
      id: `report:${sourceId(`${packet.sourceFile}:${packet.profileId}:${packet.headerRowIndex}:${index}`)}`,
      label: `${packet.sourceFile}${suffix}`,
    };
  });
}

function customerMaps(customers: Array<Record<string, unknown>>) {
  const byId = new Map<string, Record<string, unknown>>();
  const byCwid = new Map<string, Record<string, unknown>>();
  const byHmis = new Map<string, Record<string, unknown>>();
  const byName = new Map<string, Record<string, unknown>>();
  for (const customer of customers) {
    const id = text(customer.id);
    if (id) byId.set(id, customer);
    const cwid = customerCaseworthyId(customer);
    if (cwid) byCwid.set(cwid, customer);
    const hmis = customerHmisId(customer);
    if (hmis) byHmis.set(hmis, customer);
    const name = normalizeCustomerName(customerLabel(customer));
    if (name) byName.set(name, customer);
  }
  return { byId, byCwid, byHmis, byName, all: customers };
}

function identityKeyFromValues(cwid: unknown, hmisId: unknown, name: unknown) {
  const cw = text(cwid);
  if (cw) return `cwid:${cw}`;
  const hmis = text(hmisId);
  if (hmis) return `hmis:${hmis}`;
  const normalizedName = normalizeCustomerName(name);
  return normalizedName ? `name:${normalizedName}` : "";
}

function tokenKey(value: unknown) {
  return lower(value).replace(/[^a-z0-9]+/g, " ").split(" ").filter((token) => token.length >= 3).slice(0, 8).join(" ");
}

function bestGrantKey(...values: unknown[]) {
  for (const value of values) {
    const key = tokenKey(value);
    if (key) return key;
  }
  return "";
}

function nameParts(value: unknown) {
  const parts = normalizeCustomerName(value).split(" ").filter(Boolean);
  return { first: parts[0] ?? "", last: parts.length > 1 ? parts[parts.length - 1] : "" };
}

function firstInitialLastKey(value: unknown) {
  const parts = nameParts(value);
  if (!parts.first || !parts.last) return "";
  return `namefi:${parts.first.slice(0, 1)}|${parts.last}`;
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
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
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

function findCustomerForRecord(record: NormalizedReportRecord, maps: ReturnType<typeof customerMaps>) {
  const cwid = text(record.customerIdentity.caseworthyId);
  if (cwid && maps.byCwid.has(cwid)) return { customer: maps.byCwid.get(cwid) ?? null, confidence: 1, reason: "CWID exact match" };
  const hmis = text(record.customerIdentity.hmisId);
  if (hmis && maps.byHmis.has(hmis)) return { customer: maps.byHmis.get(hmis) ?? null, confidence: 1, reason: "HMIS ID exact match" };
  const reportName = record.customerIdentity.fullName || `${record.customerIdentity.firstName} ${record.customerIdentity.lastName}`.trim();
  const exact = maps.byName.get(normalizeCustomerName(reportName));
  if (exact) return { customer: exact, confidence: 0.9, reason: "First + last name exact; verify DOB" };
  const reportParts = nameParts(reportName);
  for (const customer of maps.all) {
    const customerParts = nameParts(customerLabel(customer));
    const firstExact = reportParts.first && customerParts.first && reportParts.first === customerParts.first;
    const lastExact = reportParts.last && customerParts.last && reportParts.last === customerParts.last;
    if ((firstExact && !lastExact) || (lastExact && !firstExact)) continue;
    if (closeSpelling(reportParts.first, customerParts.first) && closeSpelling(reportParts.last, customerParts.last)) {
      return { customer, confidence: 0.5, reason: "Close spelling on first + last; 50% certainty" };
    }
  }
  return { customer: null, confidence: 0, reason: "No CWID/HMIS/exact-name/fuzzy-name match" };
}

function reportPaymentUnit(packet: ReconciliationPacket, source: { id: string; label: string }, record: NormalizedReportRecord, index: number): PaymentUnit | null {
  if (record.paymentEvidence.amount == null) return null;
  const name = record.customerIdentity.fullName || `${record.customerIdentity.firstName} ${record.customerIdentity.lastName}`.trim();
  const date = record.paymentEvidence.transactionDate || record.paymentEvidence.serviceMonth;
  const amount = record.paymentEvidence.amount;
  return {
    id: `${packet.sourceFile}:${record.sourceRowNumber ?? index}`,
    sourceId: source.id,
    sourceLabel: source.label,
    sourceKind: "report",
    sourceProfileId: packet.profileId,
    name,
    nameKey: normalizeCustomerName(name),
    initialNameKey: firstInitialLastKey(name),
    identityKey: identityKeyFromValues(record.customerIdentity.caseworthyId, record.customerIdentity.hmisId, ""),
    grantKey: bestGrantKey(record.paymentEvidence.grant, record.enrollmentEvidence.projectName, record.enrollmentEvidence.programId, packet.sourceFile),
    date,
    month: record.paymentEvidence.serviceMonth || monthOf(date),
    amount,
    amountCents: amount == null ? null : Math.round(amount * 100),
    vendor: record.paymentEvidence.vendor || record.paymentEvidence.reference,
    status: record.paymentEvidence.invoice || packet.profileLabel,
    paidSignal: ["financial_edge_project_activity", "hmis_service_payment_report", "caseworthy_service_detail", "caseworthy_service_total"].includes(packet.profileId),
    row: record.raw,
  };
}

function databasePaymentUnit(source: "paymentQueue" | "ledger", row: Record<string, unknown>, maps: ReturnType<typeof customerMaps>): PaymentUnit {
  const customer = maps.byId.get(text(row.customerId));
  const name = customerLabel(customer) || text(row.customerNameAtSpend ?? row.customerName ?? row.customer ?? row.name);
  const rawAmount = source === "ledger" ? (row.amountCents != null ? Number(row.amountCents) / 100 : row.amount) : (row.amountAbs ?? row.amount);
  const date = text(row.month) || normalizeDate(row.dueDate ?? row.transactionDate ?? row.postedAt ?? row.date);
  const grantKey = bestGrantKey(row.grantName, row.grantId, row.programName, row.programId, row.projectName, row.enrollmentName, row.source, row.category, row.lineItem);
  return {
    id: `${source}:${text(row.id) || Math.random().toString(36).slice(2)}`,
    sourceId: source,
    sourceLabel: source === "ledger" ? "Ledger" : "Payment queue",
    sourceKind: "database",
    name,
    nameKey: normalizeCustomerName(name),
    initialNameKey: firstInitialLastKey(name),
    identityKey: identityKeyFromValues(customerCaseworthyId(customer), customerHmisId(customer), ""),
    grantKey,
    date,
    month: text(row.month) || monthOf(row.dueDate ?? row.transactionDate ?? row.postedAt ?? row.date),
    amount: money(rawAmount),
    amountCents: row.amountCents != null ? Math.round(Number(row.amountCents)) : cents(rawAmount),
    vendor: text(row.vendor ?? row.merchant ?? row.payee ?? row.landlord ?? row.description ?? row.note ?? row.notes),
    status: text(row.queueStatus ?? row.status ?? row.paid ?? row.source),
    paidSignal: source === "ledger" || lower(row.queueStatus) === "posted" || row.paid === true || text(row.ledgerEntryId) !== "",
    row,
  };
}

function grantLabel(grant: Record<string, unknown>) {
  return text(grant.name ?? grant.grantName ?? grant.label ?? grant.title ?? grant.id);
}

function budgetLineItemUnits(grants: Array<Record<string, unknown>>): PaymentUnit[] {
  const out: PaymentUnit[] = [];
  for (const grant of grants) {
    const budget = grant.budget && typeof grant.budget === "object" ? grant.budget as Record<string, unknown> : {};
    const lineItems = Array.isArray(budget.lineItems) ? budget.lineItems as Array<Record<string, unknown>> : [];
    const grantName = grantLabel(grant);
    for (const [index, item] of lineItems.entries()) {
      const label = text(item.label ?? item.name ?? item.id ?? `Line item ${index + 1}`);
      const grantKey = bestGrantKey(grantName, grant.id, label, item.type);
      const baseRow = {
        grantId: grant.id,
        grantName,
        lineItemId: item.id,
        lineItemLabel: label,
        lineItemType: item.type,
        budgetAmount: item.amount,
        projected: item.projected,
        spent: item.spent,
        projectedInWindow: item.projectedInWindow,
        spentInWindow: item.spentInWindow,
      };
      const add = (kind: "projected" | "spent", rawAmount: unknown) => {
        const amount = money(rawAmount);
        if (amount == null || amount === 0) return;
        out.push({
          id: `budget:${kind}:${text(grant.id) || sourceId(grantName)}:${text(item.id) || index}`,
          sourceId: kind === "spent" ? "budgetSpent" : "budgetProjected",
          sourceLabel: kind === "spent" ? "Budget spent line items" : "Budget projected line items",
          sourceKind: "database",
          name: "",
          nameKey: "",
          initialNameKey: "",
          identityKey: "",
          grantKey,
          date: "",
          month: "",
          amount,
          amountCents: Math.round(amount * 100),
          vendor: label,
          status: kind === "spent" ? "budget spent rollup" : "budget projected rollup",
          paidSignal: kind === "spent",
          row: { ...baseRow, budgetRollupKind: kind, amount },
        });
      };
      add("projected", item.projected);
      add("spent", item.spent);
    }
  }
  return out;
}

function exactPaymentKey(unit: PaymentUnit) {
  return [unit.identityKey || unit.initialNameKey || unit.nameKey || "unknown", unit.month || unit.date || "nodate", unit.amountCents ?? "noamount"].join("|");
}

function loosePaymentKey(unit: PaymentUnit) {
  return [unit.identityKey || unit.initialNameKey || unit.nameKey || "unknown", unit.month || unit.date || "nodate"].join("|");
}

function amountMonthGrantKey(unit: PaymentUnit) {
  return [unit.month || unit.date || "nodate", unit.amountCents ?? "noamount", unit.grantKey || "nogrant"].join("|");
}

function amountMonthKey(unit: PaymentUnit) {
  return [unit.month || unit.date || "nodate", unit.amountCents ?? "noamount"].join("|");
}

function amountGrantKey(unit: PaymentUnit) {
  return [unit.amountCents ?? "noamount", unit.grantKey || "nogrant"].join("|");
}

function hasReportAndDatabase(group: PaymentUnit[]) {
  return group.some((unit) => unit.sourceKind === "report") && group.some((unit) => unit.sourceKind === "database");
}

function isFinancialEdgeUnit(unit: PaymentUnit) {
  return unit.sourceProfileId === "financial_edge_project_activity";
}

function isHmisLikeUnit(unit: PaymentUnit) {
  return unit.sourceProfileId === "hmis_service_payment_report" || unit.sourceProfileId === "caseworthy_service_detail" || unit.sourceProfileId === "caseworthy_service_total";
}

function hasFinancialEdge(group: PaymentUnit[]) {
  return group.some(isFinancialEdgeUnit);
}

function hasHmisLike(group: PaymentUnit[]) {
  return group.some(isHmisLikeUnit);
}

function groupByPaymentKey(units: PaymentUnit[], keyFor: (unit: PaymentUnit) => string) {
  const groups = new Map<string, PaymentUnit[]>();
  for (const unit of units) {
    const key = keyFor(unit);
    groups.set(key, [...(groups.get(key) ?? []), unit]);
  }
  return groups;
}

function statusPriority(status: CompareCellStatus) {
  return { matched: 1, partial: 2, unmatched: 3, missing: 4, mismatch: 5, not_scanned: 0 }[status];
}

function mergeStatus(current: CompareCellStatus, next: CompareCellStatus): CompareCellStatus {
  return statusPriority(next) > statusPriority(current) ? next : current;
}

function buildPaymentCompareRows(packets: ReconciliationPacket[], database: DatabaseRows): { sources: CompareSource[]; rows: CompareRow[] } {
  const maps = customerMaps(database.customers);
  const units: PaymentUnit[] = [];
  const packetSources = packetSourceMetas(packets);
  for (const [packetIndex, packet] of packets.entries()) {
    const source = packetSources[packetIndex];
    packet.records.forEach((record, index) => {
      const unit = reportPaymentUnit(packet, source, record, index);
      if (unit) units.push(unit);
    });
  }
  for (const row of database.paymentQueueItems) units.push(databasePaymentUnit("paymentQueue", row, maps));
  for (const row of database.ledger) units.push(databasePaymentUnit("ledger", row, maps));
  units.push(...budgetLineItemUnits(database.grants));

  const sources = Array.from(new Map(units.map((unit) => [unit.sourceId, { id: unit.sourceId, label: unit.sourceLabel, kind: unit.sourceKind }])).values());
  const consumed = new Set<string>();
  const rowGroups: Array<{ key: string; group: PaymentUnit[]; method: "identity" | "identity_month" | "amount_grant" | "unique_amount" | "budget_rollup" | "unmatched" }> = [];
  const consumeGroup = (key: string, group: PaymentUnit[], method: "identity" | "identity_month" | "amount_grant" | "unique_amount" | "budget_rollup" | "unmatched") => {
    const available = group.filter((unit) => !consumed.has(unit.id));
    if (!available.length) return;
    for (const unit of available) consumed.add(unit.id);
    rowGroups.push({ key, group: available, method });
  };

  for (const [key, group] of groupByPaymentKey(units, exactPaymentKey)) {
    if (hasReportAndDatabase(group)) consumeGroup(key, group, "identity");
  }
  for (const [key, group] of groupByPaymentKey(units.filter((unit) => !consumed.has(unit.id)), loosePaymentKey)) {
    if (hasFinancialEdge(group) && (hasHmisLike(group) || group.some((unit) => unit.sourceKind === "database"))) {
      consumeGroup(key, group, "identity_month");
    }
  }
  for (const [key, group] of groupByPaymentKey(units.filter((unit) => !consumed.has(unit.id) && unit.amountCents != null && unit.grantKey), amountMonthGrantKey)) {
    if (hasReportAndDatabase(group)) consumeGroup(key, group, "amount_grant");
  }
  for (const [key, group] of groupByPaymentKey(units.filter((unit) => !consumed.has(unit.id) && unit.amountCents != null), amountMonthKey)) {
    const reportCount = group.filter((unit) => unit.sourceKind === "report").length;
    const databaseCount = group.filter((unit) => unit.sourceKind === "database").length;
    if (reportCount === 1 && databaseCount === 1) consumeGroup(key, group, "unique_amount");
  }
  for (const [key, group] of groupByPaymentKey(units.filter((unit) => !consumed.has(unit.id) && unit.amountCents != null && unit.grantKey), amountGrantKey)) {
    const hasExternal = group.some((unit) => unit.sourceKind === "report" && unit.paidSignal);
    const hasBudget = group.some((unit) => unit.sourceId === "budgetProjected" || unit.sourceId === "budgetSpent");
    if (hasExternal && hasBudget) consumeGroup(key, group, "budget_rollup");
  }
  for (const unit of units) {
    if (!consumed.has(unit.id)) consumeGroup(unit.id, [unit], "unmatched");
  }

  const looseTotals = new Map<string, Map<string, number>>();
  for (const unit of units) {
    if (unit.amountCents == null) continue;
    const bySource = looseTotals.get(loosePaymentKey(unit)) ?? new Map<string, number>();
    bySource.set(unit.sourceId, (bySource.get(unit.sourceId) ?? 0) + unit.amountCents);
    looseTotals.set(loosePaymentKey(unit), bySource);
  }

  const rows: CompareRow[] = [];
  for (const { key, group, method } of rowGroups) {
    const groupHasFe = hasFinancialEdge(group);
    const groupHasHmis = hasHmisLike(group);
    const groupHasDatabase = group.some((unit) => unit.sourceKind === "database");
    if (!groupHasFe && !groupHasHmis) continue;
    if (!groupHasFe && groupHasDatabase) continue;
    const first = group[0];
    const sourceIds = new Set(group.map((unit) => unit.sourceId));
    const hasReport = group.some((unit) => unit.sourceKind === "report");
    const hasDatabase = group.some((unit) => unit.sourceKind === "database");
    const hasExternalPaidSignal = group.some((unit) => unit.sourceKind === "report" && unit.paidSignal);
    const hasDashboardPaid = group.some((unit) => unit.sourceKind === "database" && unit.paidSignal);
    const amountValues = Array.from(new Set(group.map((unit) => unit.amountCents).filter((value) => value != null)));
    const amountMismatch = method === "identity_month" && amountValues.length > 1;
    const hasBudgetProjected = group.some((unit) => unit.sourceId === "budgetProjected");
    const hasBudgetSpent = group.some((unit) => unit.sourceId === "budgetSpent");
    const loose = looseTotals.get(loosePaymentKey(first));
    const totalValues = loose ? Array.from(loose.values()) : [];
    const partial = totalValues.length > 1 && totalValues.every((value) => value === totalValues[0]) && method === "unmatched";
    const status: CompareCellStatus = hasReport && hasDatabase
      ? (amountMismatch ? "mismatch" : method === "identity" && (!hasExternalPaidSignal || hasDashboardPaid) ? "matched" : "partial")
      : amountMismatch ? "mismatch"
      : partial ? "partial" : "unmatched";
    const matchStatus = status === "matched"
      ? "Matched by CWID/HMIS/name + date/month + amount"
      : amountMismatch
        ? "Name/ID and month match, but amounts differ"
      : method === "amount_grant"
        ? "Likely payment match by amount + month + grant/category"
        : method === "unique_amount"
          ? "Possible payment match by unique amount + month"
          : method === "budget_rollup"
            ? "External paid/service row lines up with a grant budget rollup amount"
          : status === "partial"
            ? "Partial payment total lines up by identity/month"
            : "Unmatched";
    const paidFlag = hasExternalPaidSignal && !hasDashboardPaid
      ? "External HMIS/FE evidence exists; mark the dashboard payment paid or link/create a ledger row."
      : hasExternalPaidSignal && hasDashboardPaid
        ? "External HMIS/FE evidence and dashboard paid evidence both exist."
        : hasBudgetProjected && hasExternalPaidSignal
          ? "Projected budget rollup has external paid evidence; review payment queue posting."
          : "";
    const sourceOfTruthFlag = groupHasFe
      ? [
          !groupHasHmis ? "HMIS/Caseworthy missing for FE row" : "",
          !groupHasDatabase ? "Dashboard queue/ledger missing for FE row" : "",
          amountMismatch ? "Amount mismatch against FE" : "",
        ].filter(Boolean).join("; ")
      : groupHasHmis ? "HMIS/Caseworthy row has no matching FE row; verify cancelled/stale data entry." : "";
    rows.push({
      id: `payment:${key}`,
      mode: "payments",
      name: first.name || "-",
      date: first.date || first.month || "-",
      amount: first.amount,
      status,
      matchStatus,
      fields: {
        vendor: Array.from(new Set(group.map((unit) => unit.vendor).filter(Boolean))).join(", ") || "-",
        status: Array.from(new Set(group.map((unit) => unit.status).filter(Boolean))).join(", ") || "-",
        grant: Array.from(new Set(group.map((unit) => unit.grantKey).filter(Boolean))).join(", ") || "-",
        paidFlag: paidFlag || "-",
        budgetState: [
          hasBudgetProjected ? "projected" : "",
          hasBudgetSpent ? "spent" : "",
        ].filter(Boolean).join(" + ") || "-",
        sourceOfTruth: sourceOfTruthFlag || "-",
        actionHint: sourceOfTruthFlag || paidFlag || (status === "matched" ? "No database write implied." : "Review source rows before creating or linking payment queue/ledger structure."),
      },
      cells: sources.map((source) => {
        const sourceUnits = group.filter((unit) => unit.sourceId === source.id);
        if (!sourceUnits.length) return { sourceId: source.id, sourceLabel: source.label, status: "missing", value: "-", detail: "No row in this source" };
        const value = sourceUnits.map((unit) => [unit.name, unit.date, unit.amount == null ? "" : `$${unit.amount.toFixed(2)}`].filter(Boolean).join(" / ")).join("; ");
        return {
          sourceId: source.id,
          sourceLabel: source.label,
          status: sourceIds.size > 1 ? status : "unmatched",
          value,
          detail: sourceUnits.map((unit) => [unit.vendor, unit.status, unit.month].filter(Boolean).join(" / ")).filter(Boolean).join("; "),
          row: sourceUnits[0].row,
        };
      }),
      matchReasons: [
        method === "identity" ? "Exact CWID/HMIS when available, otherwise first-initial + last name or normalized first + last name, plus service month/date + amount." : "",
        method === "identity_month" ? "Name/ID or first-initial + last name and service month matched across sources; amount is reviewed separately." : "",
        method === "amount_grant" ? "Customer identity was weak or absent; amount, service month/date, and grant/category lined up across report and database rows." : "",
        method === "unique_amount" ? "Customer identity and grant/category were weak; this amount/month had exactly one report row and one database row." : "",
        method === "budget_rollup" ? "Grant budget projected/spent line-item rollup matched the external paid/service amount; confirm the exact payment event before writeback." : "",
        sourceOfTruthFlag,
        paidFlag,
        status === "partial" && method === "unmatched" ? "Same CWID/HMIS/name identity and month; per-source totals match, but line items differ." : "",
      ].filter(Boolean),
    });
  }
  return { sources, rows: rows.sort((a, b) => a.name.localeCompare(b.name) || a.date.localeCompare(b.date)) };
}

function enrollmentKeyFromRecord(record: NormalizedReportRecord, granularity: EnrollmentCompareGranularity) {
  const service = granularity === "service" ? record.paymentEvidence.reference || record.paymentEvidence.grant : "";
  const name = record.customerIdentity.fullName || `${record.customerIdentity.firstName} ${record.customerIdentity.lastName}`.trim();
  return [
    identityKeyFromValues(record.customerIdentity.caseworthyId, record.customerIdentity.hmisId, name),
    record.enrollmentEvidence.projectName || record.enrollmentEvidence.programId || record.paymentEvidence.grant,
    record.enrollmentEvidence.entryDate,
    record.enrollmentEvidence.exitDate,
    service,
  ].map((value) => lower(value)).join("|");
}

function buildEnrollmentCompareRows(
  packets: ReconciliationPacket[],
  database: DatabaseRows,
  options: CompareBuildOptions,
): { sources: CompareSource[]; rows: CompareRow[] } {
  const granularity = options.enrollmentGranularity ?? "enrollment";
  const maps = customerMaps(database.customers);
  const sources = new Map<string, CompareSource>();
  const rows = new Map<string, CompareRow>();
  const packetSources = packetSourceMetas(packets);
  const put = (key: string, cell: CompareCell, base: Partial<CompareRow>) => {
    sources.set(cell.sourceId, { id: cell.sourceId, label: cell.sourceLabel, kind: cell.sourceId.startsWith("report:") ? "report" : "database" });
    const row = rows.get(key) ?? {
      id: `enrollment:${key}`,
      mode: "enrollments",
      name: base.name || "-",
      date: base.date || "-",
      amount: null,
      status: "matched",
      matchStatus: "Matched",
      fields: base.fields || {},
      cells: [],
      matchReasons: [],
    };
    row.cells.push(cell);
    row.status = mergeStatus(row.status, cell.status);
    rows.set(key, row);
  };

  for (const [packetIndex, packet] of packets.entries()) {
    const reportSource = packetSources[packetIndex];
    for (const record of packet.records) {
      if (!record.enrollmentEvidence.projectName && !record.enrollmentEvidence.entryDate && !record.enrollmentEvidence.exitDate && granularity !== "service") continue;
      const key = enrollmentKeyFromRecord(record, granularity);
      const name = record.customerIdentity.fullName || `${record.customerIdentity.firstName} ${record.customerIdentity.lastName}`.trim();
      put(key, {
        sourceId: reportSource.id,
        sourceLabel: reportSource.label,
        status: "matched",
        value: [record.enrollmentEvidence.projectName || record.paymentEvidence.grant, record.enrollmentEvidence.entryDate, record.enrollmentEvidence.exitDate].filter(Boolean).join(" / ") || "present",
        row: record.raw,
      }, {
        name,
        date: record.enrollmentEvidence.entryDate,
        fields: {
          cwid: record.customerIdentity.caseworthyId || "-",
          hmisId: record.customerIdentity.hmisId || "-",
          enrollmentName: record.enrollmentEvidence.projectName || record.paymentEvidence.grant || "-",
          startDate: record.enrollmentEvidence.entryDate || "-",
          endDate: record.enrollmentEvidence.exitDate || "-",
          status: record.enrollmentEvidence.exitDate ? "Exited in report" : "Active/no report exit",
        },
      });
    }
  }

  for (const enrollment of database.enrollments) {
    const customer = maps.byId.get(text(enrollment.customerId ?? enrollment.clientId));
    if (!customer && options.showMissingSystemEnrollments === false) continue;
    const name = customerLabel(customer) || text(enrollment.customerName ?? enrollment.name);
    const startDate = normalizeDate(enrollment.entryDate ?? enrollment.startDate ?? enrollment.enrolledAt);
    const endDate = normalizeDate(enrollment.exitDate ?? enrollment.endDate ?? enrollment.closedAt);
    const enrollmentName = text(enrollment.grantName ?? enrollment.programName ?? enrollment.projectName ?? enrollment.grantId ?? enrollment.programId);
    const key = [identityKeyFromValues(customerCaseworthyId(customer), customerHmisId(customer), name), enrollmentName.toLowerCase(), startDate, endDate, granularity === "service" ? "dashboard-enrollment" : ""].join("|");
    put(key, {
      sourceId: "database:enrollments",
      sourceLabel: "Dashboard enrollments",
      status: "matched",
      value: [enrollmentName, startDate, endDate].filter(Boolean).join(" / ") || "present",
      detail: text(enrollment.status ?? enrollment.active ?? ""),
      row: enrollment,
    }, {
      name,
      date: startDate,
      fields: {
        cwid: customerCaseworthyId(customer) || "-",
        hmisId: customerHmisId(customer) || "-",
        enrollmentName: enrollmentName || "-",
        startDate: startDate || "-",
        endDate: endDate || "-",
        status: text(enrollment.status ?? enrollment.active ?? "") || "-",
      },
    });
  }

  const sourceList = Array.from(sources.values());
  const out = Array.from(rows.values()).map((row) => {
    const existingSources = new Set(row.cells.map((cell) => cell.sourceId));
    row.cells = sourceList.map((source) => row.cells.find((cell) => cell.sourceId === source.id) ?? {
      sourceId: source.id,
      sourceLabel: source.label,
      status: "missing",
      value: "-",
    });
    const hasReport = row.cells.some((cell) => cell.sourceId.startsWith("report:") && cell.status !== "missing");
    const hasDashboard = existingSources.has("database:enrollments");
    row.status = hasReport && hasDashboard ? "matched" : "unmatched";
    row.matchStatus = hasReport && hasDashboard ? "Enrollment exists in report and dashboard" : hasReport ? "Missing from dashboard" : "Only in dashboard";
    row.matchReasons = [granularity === "service" ? "Service-level view; dashboard does not track services separately." : "Enrollment-level view."];
    return row;
  });
  return { sources: sourceList, rows: out.sort((a, b) => a.name.localeCompare(b.name) || a.date.localeCompare(b.date)) };
}

function buildCustomerExitCompareRows(packets: ReconciliationPacket[], database: DatabaseRows): { sources: CompareSource[]; rows: CompareRow[] } {
  const maps = customerMaps(database.customers);
  const sources = new Map<string, CompareSource>();
  const rows = new Map<string, CompareRow>();
  const packetSources = packetSourceMetas(packets);
  for (const [packetIndex, packet] of packets.entries()) {
    const reportSource = packetSources[packetIndex];
    for (const record of packet.records) {
      const name = record.customerIdentity.fullName || `${record.customerIdentity.firstName} ${record.customerIdentity.lastName}`.trim();
      if (!name && !record.customerIdentity.hmisId && !record.customerIdentity.caseworthyId) continue;
      const match = findCustomerForRecord(record, maps);
      const matched = match.customer;
      const key = identityKeyFromValues(record.customerIdentity.caseworthyId, record.customerIdentity.hmisId, name);
      const reportSourceId = reportSource.id;
      sources.set(reportSourceId, { id: reportSourceId, label: reportSource.label, kind: "report" });
      sources.set("database:customers", { id: "database:customers", label: "Dashboard customers", kind: "database" });
      rows.set(key, {
        id: `customer:${key}`,
        mode: "customer_exits",
        name,
        date: record.enrollmentEvidence.exitDate || record.enrollmentEvidence.entryDate || "-",
        amount: null,
        status: matched ? "matched" : "unmatched",
        matchStatus: matched ? `Customer exists in dashboard (${Math.round(match.confidence * 100)}%)` : "Create/link customer candidate",
        fields: {
          cwid: record.customerIdentity.caseworthyId || customerCaseworthyId(matched) || "-",
          hmisId: record.customerIdentity.hmisId || customerHmisId(matched) || "-",
          activeState: matched ? (String(matched.active ?? matched.status ?? "present")) : "missing",
          actionHint: matched ? "Review active/inactive and IDs" : "Create customer, assign CM, link IDs/folder",
        },
        cells: [
          { sourceId: reportSourceId, sourceLabel: reportSource.label, status: "matched", value: "present", row: record.raw },
          { sourceId: "database:customers", sourceLabel: "Dashboard customers", status: matched ? "matched" : "missing", value: matched ? "present" : "missing", row: matched },
        ],
        matchReasons: [match.reason],
      });
    }
  }
  return { sources: Array.from(sources.values()), rows: Array.from(rows.values()).sort((a, b) => a.name.localeCompare(b.name)) };
}

export function buildReconciliationCompare(
  packets: ReconciliationPacket[],
  database: DatabaseRows,
  options: CompareBuildOptions,
): { sources: CompareSource[]; rows: CompareRow[] } {
  if (options.mode === "payments") return buildPaymentCompareRows(packets, database);
  if (options.mode === "enrollments") return buildEnrollmentCompareRows(packets, database, options);
  return buildCustomerExitCompareRows(packets, database);
}
