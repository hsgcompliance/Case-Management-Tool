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
  paymentQueueItems: Array<Record<string, unknown>>;
  ledger: Array<Record<string, unknown>>;
};

type PaymentUnit = {
  id: string;
  sourceId: string;
  sourceLabel: string;
  sourceKind: "report" | "database";
  name: string;
  nameKey: string;
  date: string;
  month: string;
  amount: number | null;
  amountCents: number | null;
  vendor: string;
  status: string;
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

function sourceId(label: string) {
  return label.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase() || "source";
}

function customerMaps(customers: Array<Record<string, unknown>>) {
  const byId = new Map<string, Record<string, unknown>>();
  const byName = new Map<string, Record<string, unknown>>();
  for (const customer of customers) {
    const id = text(customer.id);
    if (id) byId.set(id, customer);
    const name = normalizeCustomerName(customerLabel(customer));
    if (name) byName.set(name, customer);
  }
  return { byId, byName };
}

function reportPaymentUnit(packet: ReconciliationPacket, record: NormalizedReportRecord, index: number): PaymentUnit | null {
  if (record.paymentEvidence.amount == null) return null;
  const name = record.customerIdentity.fullName || `${record.customerIdentity.firstName} ${record.customerIdentity.lastName}`.trim();
  const date = record.paymentEvidence.transactionDate || record.paymentEvidence.serviceMonth;
  const amount = record.paymentEvidence.amount;
  return {
    id: `${packet.sourceFile}:${record.sourceRowNumber ?? index}`,
    sourceId: `report:${sourceId(packet.sourceFile)}`,
    sourceLabel: packet.sourceFile,
    sourceKind: "report",
    name,
    nameKey: normalizeCustomerName(name),
    date,
    month: record.paymentEvidence.serviceMonth || monthOf(date),
    amount,
    amountCents: amount == null ? null : Math.round(amount * 100),
    vendor: record.paymentEvidence.vendor || record.paymentEvidence.reference,
    status: record.paymentEvidence.invoice || packet.profileLabel,
    row: record.raw,
  };
}

function databasePaymentUnit(source: "paymentQueue" | "ledger", row: Record<string, unknown>, maps: ReturnType<typeof customerMaps>): PaymentUnit {
  const customer = maps.byId.get(text(row.customerId));
  const name = customerLabel(customer) || text(row.customerNameAtSpend ?? row.customerName ?? row.customer ?? row.name);
  const rawAmount = source === "ledger" ? (row.amountCents != null ? Number(row.amountCents) / 100 : row.amount) : (row.amountAbs ?? row.amount);
  const date = text(row.month) || normalizeDate(row.dueDate ?? row.transactionDate ?? row.postedAt ?? row.date);
  return {
    id: `${source}:${text(row.id) || Math.random().toString(36).slice(2)}`,
    sourceId: source,
    sourceLabel: source === "ledger" ? "Ledger" : "Payment queue",
    sourceKind: "database",
    name,
    nameKey: normalizeCustomerName(name),
    date,
    month: text(row.month) || monthOf(row.dueDate ?? row.transactionDate ?? row.postedAt ?? row.date),
    amount: money(rawAmount),
    amountCents: row.amountCents != null ? Math.round(Number(row.amountCents)) : cents(rawAmount),
    vendor: text(row.vendor ?? row.merchant ?? row.payee ?? row.landlord ?? row.description ?? row.note ?? row.notes),
    status: text(row.queueStatus ?? row.status ?? row.paid ?? row.source),
    row,
  };
}

function exactPaymentKey(unit: PaymentUnit) {
  return [unit.nameKey || "unknown", unit.month || unit.date || "nodate", unit.amountCents ?? "noamount"].join("|");
}

function loosePaymentKey(unit: PaymentUnit) {
  return [unit.nameKey || "unknown", unit.month || unit.date || "nodate"].join("|");
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
  for (const packet of packets) {
    packet.records.forEach((record, index) => {
      const unit = reportPaymentUnit(packet, record, index);
      if (unit) units.push(unit);
    });
  }
  for (const row of database.paymentQueueItems) units.push(databasePaymentUnit("paymentQueue", row, maps));
  for (const row of database.ledger) units.push(databasePaymentUnit("ledger", row, maps));

  const sources = Array.from(new Map(units.map((unit) => [unit.sourceId, { id: unit.sourceId, label: unit.sourceLabel, kind: unit.sourceKind }])).values());
  const byExact = new Map<string, PaymentUnit[]>();
  for (const unit of units) byExact.set(exactPaymentKey(unit), [...(byExact.get(exactPaymentKey(unit)) ?? []), unit]);

  const looseTotals = new Map<string, Map<string, number>>();
  for (const unit of units) {
    if (unit.amountCents == null) continue;
    const bySource = looseTotals.get(loosePaymentKey(unit)) ?? new Map<string, number>();
    bySource.set(unit.sourceId, (bySource.get(unit.sourceId) ?? 0) + unit.amountCents);
    looseTotals.set(loosePaymentKey(unit), bySource);
  }

  const rows: CompareRow[] = [];
  for (const [key, group] of byExact) {
    const first = group[0];
    const sourceIds = new Set(group.map((unit) => unit.sourceId));
    const hasReport = group.some((unit) => unit.sourceKind === "report");
    const hasDatabase = group.some((unit) => unit.sourceKind === "database");
    const loose = looseTotals.get(loosePaymentKey(first));
    const totalValues = loose ? Array.from(loose.values()) : [];
    const partial = totalValues.length > 1 && totalValues.every((value) => value === totalValues[0]) && !Array.from(byExact.values()).some((other) => other !== group && other.some((unit) => unit.nameKey === first.nameKey && unit.month === first.month && unit.amountCents === first.amountCents));
    const status: CompareCellStatus = hasReport && hasDatabase ? "matched" : partial ? "partial" : "unmatched";
    rows.push({
      id: `payment:${key}`,
      mode: "payments",
      name: first.name || "-",
      date: first.date || first.month || "-",
      amount: first.amount,
      status,
      matchStatus: status === "matched" ? "Matched by name/date/amount" : status === "partial" ? "Partial payment total lines up by name/month" : "Unmatched",
      fields: {
        vendor: first.vendor || "-",
        status: Array.from(new Set(group.map((unit) => unit.status).filter(Boolean))).join(", ") || "-",
      },
      cells: sources.map((source) => {
        const sourceUnits = group.filter((unit) => unit.sourceId === source.id);
        if (!sourceUnits.length) return { sourceId: source.id, sourceLabel: source.label, status: "missing", value: "-", detail: "No row in this source" };
        const value = sourceUnits.map((unit) => [unit.name, unit.date, unit.amount == null ? "" : `$${unit.amount.toFixed(2)}`].filter(Boolean).join(" / ")).join("; ");
        return { sourceId: source.id, sourceLabel: source.label, status: sourceIds.size > 1 ? status : "unmatched", value, row: sourceUnits[0].row };
      }),
      matchReasons: [
        status === "matched" ? "Exact normalized name + service month/date + amount." : "",
        status === "partial" ? "Same normalized name and month; per-source totals match, but line items differ." : "",
      ].filter(Boolean),
    });
  }
  return { sources, rows: rows.sort((a, b) => a.name.localeCompare(b.name) || a.date.localeCompare(b.date)) };
}

function enrollmentKeyFromRecord(record: NormalizedReportRecord, granularity: EnrollmentCompareGranularity) {
  const service = granularity === "service" ? record.paymentEvidence.reference || record.paymentEvidence.grant : "";
  return [
    record.customerIdentity.caseworthyId || record.customerIdentity.hmisId || record.customerIdentity.fullName,
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

  for (const packet of packets) {
    for (const record of packet.records) {
      if (!record.enrollmentEvidence.projectName && !record.enrollmentEvidence.entryDate && !record.enrollmentEvidence.exitDate && granularity !== "service") continue;
      const key = enrollmentKeyFromRecord(record, granularity);
      const name = record.customerIdentity.fullName || `${record.customerIdentity.firstName} ${record.customerIdentity.lastName}`.trim();
      put(key, {
        sourceId: `report:${sourceId(packet.sourceFile)}`,
        sourceLabel: packet.sourceFile,
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
    const key = [normalizeCustomerName(name), enrollmentName.toLowerCase(), startDate, endDate, granularity === "service" ? "dashboard-enrollment" : ""].join("|");
    put(key, {
      sourceId: "database:enrollments",
      sourceLabel: "Dashboard enrollments",
      status: "matched",
      value: [enrollmentName, startDate, endDate].filter(Boolean).join(" / ") || "present",
      row: enrollment,
    }, {
      name,
      date: startDate,
      fields: {
        cwid: text(customer?.caseworthyId ?? customer?.caseWorthyId ?? customer?.cwId) || "-",
        hmisId: text(customer?.hmisId ?? customer?.HMISId ?? customer?.hmisClientId) || "-",
        enrollmentName: enrollmentName || "-",
        startDate: startDate || "-",
        endDate: endDate || "-",
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
  for (const packet of packets) {
    for (const record of packet.records) {
      const name = record.customerIdentity.fullName || `${record.customerIdentity.firstName} ${record.customerIdentity.lastName}`.trim();
      if (!name && !record.customerIdentity.hmisId && !record.customerIdentity.caseworthyId) continue;
      const matched = maps.byName.get(normalizeCustomerName(name));
      const key = normalizeCustomerName(name) || record.customerIdentity.hmisId || record.customerIdentity.caseworthyId;
      const reportSourceId = `report:${sourceId(packet.sourceFile)}`;
      sources.set(reportSourceId, { id: reportSourceId, label: packet.sourceFile, kind: "report" });
      sources.set("database:customers", { id: "database:customers", label: "Dashboard customers", kind: "database" });
      rows.set(key, {
        id: `customer:${key}`,
        mode: "customer_exits",
        name,
        date: record.enrollmentEvidence.exitDate || record.enrollmentEvidence.entryDate || "-",
        amount: null,
        status: matched ? "matched" : "unmatched",
        matchStatus: matched ? "Customer exists in dashboard" : "Create/link customer candidate",
        fields: {
          cwid: record.customerIdentity.caseworthyId || text(matched?.caseworthyId) || "-",
          hmisId: record.customerIdentity.hmisId || text(matched?.hmisId ?? matched?.HMISId) || "-",
          activeState: matched ? (String(matched.active ?? matched.status ?? "present")) : "missing",
          actionHint: matched ? "Review active/inactive and IDs" : "Create customer, assign CM, link IDs/folder",
        },
        cells: [
          { sourceId: reportSourceId, sourceLabel: packet.sourceFile, status: "matched", value: "present", row: record.raw },
          { sourceId: "database:customers", sourceLabel: "Dashboard customers", status: matched ? "matched" : "missing", value: matched ? "present" : "missing", row: matched },
        ],
        matchReasons: [matched ? "Matched by normalized customer name." : "No dashboard customer matched this report row by normalized name."],
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
