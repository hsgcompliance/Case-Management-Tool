"use client";

import React from "react";
import {
  DEFAULT_DATABASE_FILTER_CONFIG,
  countActiveFilters,
  type DatabaseCollectionKey,
  type DatabaseFilterConfig,
  type TriState,
} from "./databaseFilters";

type Props = {
  value: DatabaseFilterConfig;
  onChange: (next: DatabaseFilterConfig) => void;
  toolKind?: "enrollment" | "payment" | "identity";
  onRefreshCollection?: (key: DatabaseCollectionKey) => void;
  refreshingCollection?: DatabaseCollectionKey | null;
  embedded?: boolean;
};

const COLLECTION_LABELS: Record<DatabaseCollectionKey, string> = {
  customers: "Customers",
  enrollments: "Enrollments",
  grants: "Grants",
  paymentQueue: "Payment queue",
  ledger: "Ledger",
};

const TOOL_COLLECTIONS: Record<NonNullable<Props["toolKind"]>, DatabaseCollectionKey[]> = {
  enrollment: ["customers", "enrollments", "grants"],
  payment: ["customers", "enrollments", "grants", "paymentQueue", "ledger"],
  identity: ["customers"],
};

function cloneConfig(value: DatabaseFilterConfig): DatabaseFilterConfig {
  return {
    customers: { ...value.customers },
    enrollments: { ...value.enrollments },
    grants: { ...value.grants },
    paymentQueue: { ...value.paymentQueue },
    ledger: { ...value.ledger },
  };
}

function MonthRangeFields({
  from,
  to,
  onFrom,
  onTo,
}: {
  from: string;
  to: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
}) {
  return (
    <>
      <label className="text-xs">
        <span className="mb-1 block font-medium text-slate-500">From month</span>
        <input className="input h-9 w-full px-2 py-1 text-sm leading-5" type="month" value={from} onChange={(event) => onFrom(event.currentTarget.value)} />
      </label>
      <label className="text-xs">
        <span className="mb-1 block font-medium text-slate-500">To month</span>
        <input className="input h-9 w-full px-2 py-1 text-sm leading-5" type="month" value={to} onChange={(event) => onTo(event.currentTarget.value)} />
      </label>
    </>
  );
}

function TriStateSelect({ label, value, onChange }: { label: string; value: TriState; onChange: (value: TriState) => void }) {
  return (
    <label className="text-xs">
      <span className="mb-1 block font-medium text-slate-500">{label}</span>
      <select className="input h-9 w-full px-2 py-1 text-sm leading-5" value={value} onChange={(event) => onChange(event.currentTarget.value as TriState)}>
        <option value="any">Any</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </label>
  );
}

function SearchField({ label, value, onChange, placeholder = "Search" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="text-xs">
      <span className="mb-1 block font-medium text-slate-500">{label}</span>
      <input className="input h-9 w-full px-2 py-1 text-sm leading-5" value={value} placeholder={placeholder} onChange={(event) => onChange(event.currentTarget.value)} />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) {
  return (
    <label className="text-xs">
      <span className="mb-1 block font-medium text-slate-500">{label}</span>
      <input
        className="input h-9 w-full px-2 py-1 text-sm leading-5"
        type="number"
        value={value ?? ""}
        onChange={(event) => {
          const raw = event.currentTarget.value;
          onChange(raw === "" ? null : Number(raw));
        }}
      />
    </label>
  );
}

export function DatabaseFilterPanel({ value, onChange, toolKind, onRefreshCollection, refreshingCollection, embedded = false }: Props) {
  const [open, setOpen] = React.useState(false);
  const keys = toolKind ? TOOL_COLLECTIONS[toolKind] : (Object.keys(COLLECTION_LABELS) as DatabaseCollectionKey[]);
  const activeCount = keys.reduce((sum, key) => sum + countActiveFilters(key, value), 0);

  const patch = <K extends DatabaseCollectionKey>(key: K, patchValue: Partial<DatabaseFilterConfig[K]>) => {
    const next = cloneConfig(value);
    next[key] = { ...next[key], ...patchValue } as DatabaseFilterConfig[K];
    onChange(next);
  };

  const reset = () => {
    const next = cloneConfig(value);
    for (const key of keys) next[key] = { ...DEFAULT_DATABASE_FILTER_CONFIG[key] } as never;
    onChange(next);
  };

  const content = (
    <div className={embedded ? "rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950" : "absolute right-0 z-30 mt-2 w-[min(92vw,760px)] rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-800 dark:bg-slate-950"}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">Database filters</div>
          <div className="text-xs text-slate-500">Limit cached rows for this review. Eventual upgrade: move these inputs into backend report queries.</div>
        </div>
        <button type="button" className="btn btn-ghost btn-xs" onClick={reset}>Reset</button>
      </div>

      <div className="space-y-3">
        {keys.map((key) => {
          const enabled = value[key].enabled;
          return (
            <section key={key} className="rounded border border-slate-200 p-3 dark:border-slate-800">
              <div className="mb-3 flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <input type="checkbox" checked={enabled} onChange={(event) => patch(key, { enabled: event.currentTarget.checked } as never)} />
                  {COLLECTION_LABELS[key]}
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{countActiveFilters(key, value)} active</span>
                  {onRefreshCollection ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      disabled={refreshingCollection === key}
                      onClick={() => onRefreshCollection(key)}
                    >
                      {refreshingCollection === key ? "Refreshing" : "Refresh"}
                    </button>
                  ) : null}
                </div>
              </div>

              {key === "customers" ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  <SearchField label="Customer search" value={value.customers.search} placeholder="Name, ID, HMIS, CW, CM" onChange={(search) => patch("customers", { search })} />
                  <label className="text-xs">
                    <span className="mb-1 block font-medium text-slate-500">Customer status</span>
                    <select className="input h-9 w-full px-2 py-1 text-sm leading-5" value={value.customers.status} onChange={(event) => patch("customers", { status: event.currentTarget.value as DatabaseFilterConfig["customers"]["status"] })}>
                      <option value="any">Active and inactive</option>
                      <option value="active">Active only</option>
                      <option value="inactive">Inactive only</option>
                    </select>
                  </label>
                  <label className="text-xs">
                    <span className="mb-1 block font-medium text-slate-500">Caseload</span>
                    <select className="input h-9 w-full px-2 py-1 text-sm leading-5" value={value.customers.caseload} onChange={(event) => patch("customers", { caseload: event.currentTarget.value as DatabaseFilterConfig["customers"]["caseload"] })}>
                      <option value="any">Any caseload</option>
                      <option value="active">Active caseload</option>
                      <option value="inactive">Inactive caseload</option>
                    </select>
                  </label>
                  <label className="text-xs">
                    <span className="mb-1 block font-medium text-slate-500">Case manager</span>
                    <select className="input h-9 w-full px-2 py-1 text-sm leading-5" value={value.customers.caseManager} onChange={(event) => patch("customers", { caseManager: event.currentTarget.value as DatabaseFilterConfig["customers"]["caseManager"] })}>
                      <option value="any">Any assignment</option>
                      <option value="assigned">Assigned</option>
                      <option value="unassigned">Unassigned</option>
                    </select>
                  </label>
                  <TriStateSelect label="HMIS ID" value={value.customers.hmisId} onChange={(hmisId) => patch("customers", { hmisId })} />
                  <TriStateSelect label="Caseworthy ID" value={value.customers.caseworthyId} onChange={(caseworthyId) => patch("customers", { caseworthyId })} />
                  <TriStateSelect label="DOB" value={value.customers.dob} onChange={(dob) => patch("customers", { dob })} />
                </div>
              ) : null}

              {key === "enrollments" ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  <SearchField label="Enrollment search" value={value.enrollments.search} placeholder="Customer, grant, program" onChange={(search) => patch("enrollments", { search })} />
                  <label className="text-xs">
                    <span className="mb-1 block font-medium text-slate-500">Enrollment status</span>
                    <select className="input h-9 w-full px-2 py-1 text-sm leading-5" value={value.enrollments.status} onChange={(event) => patch("enrollments", { status: event.currentTarget.value as DatabaseFilterConfig["enrollments"]["status"] })}>
                      <option value="any">Active, inactive, and exited</option>
                      <option value="active">Active only</option>
                      <option value="closed">Inactive/exited only</option>
                    </select>
                  </label>
                  <SearchField label="Grant ID" value={value.enrollments.grantId} placeholder="Exact grant ID" onChange={(grantId) => patch("enrollments", { grantId })} />
                  <TriStateSelect label="Exit date" value={value.enrollments.exitDate} onChange={(exitDate) => patch("enrollments", { exitDate })} />
                  <TriStateSelect label="Scheduled payments" value={value.enrollments.hasScheduledPayments} onChange={(hasScheduledPayments) => patch("enrollments", { hasScheduledPayments })} />
                  <MonthRangeFields
                    from={value.enrollments.entryFrom.slice(0, 7)}
                    to={value.enrollments.entryTo.slice(0, 7)}
                    onFrom={(month) => patch("enrollments", { entryFrom: month ? `${month}-01` : "" })}
                    onTo={(month) => patch("enrollments", { entryTo: month ? `${month}-31` : "" })}
                  />
                </div>
              ) : null}

              {key === "grants" ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  <SearchField label="Grant search" value={value.grants.search} placeholder="Name, type, FY" onChange={(search) => patch("grants", { search })} />
                  <label className="text-xs">
                    <span className="mb-1 block font-medium text-slate-500">Grant status</span>
                    <select className="input h-9 w-full px-2 py-1 text-sm leading-5" value={value.grants.status} onChange={(event) => patch("grants", { status: event.currentTarget.value as DatabaseFilterConfig["grants"]["status"] })}>
                      <option value="any">Active and inactive</option>
                      <option value="active">Active only</option>
                      <option value="inactive">Inactive only</option>
                    </select>
                  </label>
                  <SearchField label="Grant type" value={value.grants.grantType} placeholder="Type/category" onChange={(grantType) => patch("grants", { grantType })} />
                  <SearchField label="Fiscal year" value={value.grants.fiscalYear} placeholder="FY" onChange={(fiscalYear) => patch("grants", { fiscalYear })} />
                  <TriStateSelect label="Has budget" value={value.grants.hasBudget} onChange={(hasBudget) => patch("grants", { hasBudget })} />
                  <TriStateSelect label="Has balance" value={value.grants.hasBalance} onChange={(hasBalance) => patch("grants", { hasBalance })} />
                </div>
              ) : null}

              {key === "paymentQueue" ? (
                <div className="grid gap-2 sm:grid-cols-4">
                  <SearchField label="Queue search" value={value.paymentQueue.search} placeholder="Customer, vendor, grant" onChange={(search) => patch("paymentQueue", { search })} />
                  <label className="text-xs">
                    <span className="mb-1 block font-medium text-slate-500">Queue status</span>
                    <select className="input h-9 w-full px-2 py-1 text-sm leading-5" value={value.paymentQueue.queueStatus} onChange={(event) => patch("paymentQueue", { queueStatus: event.currentTarget.value as DatabaseFilterConfig["paymentQueue"]["queueStatus"] })}>
                      <option value="any">Queued, paid, and void</option>
                      <option value="pending">Queued/unpaid</option>
                      <option value="posted">Paid/posted</option>
                      <option value="void">Void</option>
                    </select>
                  </label>
                  <label className="text-xs">
                    <span className="mb-1 block font-medium text-slate-500">Source</span>
                    <select className="input h-9 w-full px-2 py-1 text-sm leading-5" value={value.paymentQueue.source} onChange={(event) => patch("paymentQueue", { source: event.currentTarget.value as DatabaseFilterConfig["paymentQueue"]["source"] })}>
                      <option value="any">Any source</option>
                      <option value="projection">Projection</option>
                      <option value="invoice">Invoice</option>
                      <option value="credit-card">Credit card</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </label>
                  <label className="text-xs">
                    <span className="mb-1 block font-medium text-slate-500">Matched</span>
                    <select className="input h-9 w-full px-2 py-1 text-sm leading-5" value={value.paymentQueue.matched} onChange={(event) => patch("paymentQueue", { matched: event.currentTarget.value as DatabaseFilterConfig["paymentQueue"]["matched"] })}>
                      <option value="any">Any match state</option>
                      <option value="matched">Matched grant</option>
                      <option value="unmatched">Unmatched grant</option>
                    </select>
                  </label>
                  <TriStateSelect label="Has customer" value={value.paymentQueue.hasCustomer} onChange={(hasCustomer) => patch("paymentQueue", { hasCustomer })} />
                  <TriStateSelect label="Credit card/flex" value={value.paymentQueue.isFlex} onChange={(isFlex) => patch("paymentQueue", { isFlex })} />
                  <MonthRangeFields
                    from={value.paymentQueue.monthFrom}
                    to={value.paymentQueue.monthTo}
                    onFrom={(monthFrom) => patch("paymentQueue", { monthFrom })}
                    onTo={(monthTo) => patch("paymentQueue", { monthTo })}
                  />
                  <NumberField label="Min amount" value={value.paymentQueue.amountMin} onChange={(amountMin) => patch("paymentQueue", { amountMin })} />
                  <NumberField label="Max amount" value={value.paymentQueue.amountMax} onChange={(amountMax) => patch("paymentQueue", { amountMax })} />
                </div>
              ) : null}

              {key === "ledger" ? (
                <div className="grid gap-2 sm:grid-cols-4">
                  <SearchField label="Ledger search" value={value.ledger.search} placeholder="Customer, vendor, grant" onChange={(search) => patch("ledger", { search })} />
                  <label className="text-xs">
                    <span className="mb-1 block font-medium text-slate-500">Paid status</span>
                    <select className="input h-9 w-full px-2 py-1 text-sm leading-5" value={value.ledger.paidStatus} onChange={(event) => patch("ledger", { paidStatus: event.currentTarget.value as DatabaseFilterConfig["ledger"]["paidStatus"] })}>
                      <option value="any">Paid and unpaid</option>
                      <option value="paid">Paid only</option>
                      <option value="unpaid">Unpaid only</option>
                    </select>
                  </label>
                  <label className="text-xs">
                    <span className="mb-1 block font-medium text-slate-500">Source</span>
                    <select className="input h-9 w-full px-2 py-1 text-sm leading-5" value={value.ledger.source} onChange={(event) => patch("ledger", { source: event.currentTarget.value as DatabaseFilterConfig["ledger"]["source"] })}>
                      <option value="any">Any source</option>
                      <option value="enrollment">Enrollment/payment</option>
                      <option value="card">Card</option>
                      <option value="manual">Manual</option>
                      <option value="adjustment">Adjustment</option>
                      <option value="system">System</option>
                    </select>
                  </label>
                  <SearchField label="Grant ID" value={value.ledger.grantId} placeholder="Exact grant ID" onChange={(grantId) => patch("ledger", { grantId })} />
                  <label className="text-xs">
                    <span className="mb-1 block font-medium text-slate-500">Direction</span>
                    <select className="input h-9 w-full px-2 py-1 text-sm leading-5" value={value.ledger.direction} onChange={(event) => patch("ledger", { direction: event.currentTarget.value as DatabaseFilterConfig["ledger"]["direction"] })}>
                      <option value="any">Any direction</option>
                      <option value="charge">Charge</option>
                      <option value="return">Return</option>
                    </select>
                  </label>
                  <TriStateSelect label="Has customer" value={value.ledger.hasCustomer} onChange={(hasCustomer) => patch("ledger", { hasCustomer })} />
                  <TriStateSelect label="Reversal" value={value.ledger.isReversal} onChange={(isReversal) => patch("ledger", { isReversal })} />
                  <MonthRangeFields
                    from={value.ledger.monthFrom}
                    to={value.ledger.monthTo}
                    onFrom={(monthFrom) => patch("ledger", { monthFrom })}
                    onTo={(monthTo) => patch("ledger", { monthTo })}
                  />
                  <NumberField label="Min amount" value={value.ledger.amountMin} onChange={(amountMin) => patch("ledger", { amountMin })} />
                  <NumberField label="Max amount" value={value.ledger.amountMax} onChange={(amountMax) => patch("ledger", { amountMax })} />
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );

  if (embedded) return content;

  return (
    <div className="relative">
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen((current) => !current)}>
        DB filters{activeCount ? ` (${activeCount})` : ""}
      </button>
      {open ? content : null}
    </div>
  );
}

export default DatabaseFilterPanel;
