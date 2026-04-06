//CaseManagerPanel.tsx
"use client";

import React from "react";
import { populationChipClass, statusChipClass } from "@lib/colorRegistry";
import type { CaseManagerUser, CustomerRow, EnrollmentRow } from "./model";
import {
  cmLabel,
  customerLabel,
  isActiveCustomer,
  isInactiveCustomer,
  populationLabel,
} from "./model";
import CaseManagerClientRow from "./CaseManagerClientRow";

type Props = {
  user: CaseManagerUser;
  customers: CustomerRow[];
  enrollmentsByCustomerId: Map<string, EnrollmentRow[]>;
  monthKey: string;
  defaultOpen?: boolean;
};

type Scope = "active" | "inactive";

type DerivedStats = {
  active: number;
  inactive: number;
  youth: number;
  individual: number;
  family: number;
  acuitySum: number;
  acuityCount: number;
};

function deriveStats(customers: CustomerRow[]): DerivedStats {
  let active = 0;
  let inactive = 0;
  let youth = 0;
  let individual = 0;
  let family = 0;
  let acuitySum = 0;
  let acuityCount = 0;

  for (const c of customers) {
    if (isInactiveCustomer(c)) {
      inactive += 1;
      continue;
    }

    active += 1;
    const pop = populationLabel(c.population);
    if (pop === "YOUTH") youth += 1;
    if (pop === "INDIVIDUAL") individual += 1;
    if (pop === "FAMILY") family += 1;

    const rawScore = c.acuity?.score ?? c.acuityScore;
    if (rawScore !== null && rawScore !== undefined) {
      const score = Number(rawScore);
      if (Number.isFinite(score)) {
        acuitySum += score;
        acuityCount += 1;
      }
    }
  }

  return { active, inactive, youth, individual, family, acuitySum, acuityCount };
}

export default function CaseManagerPanel({
  user,
  customers,
  enrollmentsByCustomerId,
  monthKey,
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [scope, setScope] = React.useState<Scope>("active");

  const label = cmLabel(user);
  const sortedCustomers = React.useMemo(
    () => customers.slice().sort((a, b) => customerLabel(a).localeCompare(customerLabel(b))),
    [customers]
  );

  const filtered = React.useMemo(
    () => sortedCustomers.filter((c) => (scope === "active" ? isActiveCustomer(c) : isInactiveCustomer(c))),
    [sortedCustomers, scope]
  );

  const computed = React.useMemo(() => deriveStats(customers), [customers]);
  const extras = (user.extras || {}) as Record<string, unknown>;
  const legacyMetrics = (extras.metrics as Record<string, unknown> | undefined) || {};

  const activeCount = Number(extras.clientActive ?? legacyMetrics.clientActive);
  const avgAcuity = Number(extras.acuityScoreAvg ?? legacyMetrics.acuityScoreAvg);
  const acuitySum = Number(extras.acuityScoreSum ?? legacyMetrics.acuityScoreSum);
  const acuityCount = Number(extras.acuityScoreCount ?? legacyMetrics.acuityScoreCount);

  const activeDisplay = Number.isFinite(activeCount) ? activeCount : computed.active;
  const acuitySumDisplay = Number.isFinite(acuitySum) ? acuitySum : computed.acuitySum;
  const acuityCountDisplay = Number.isFinite(acuityCount) ? acuityCount : computed.acuityCount;
  const avgAcuityDisplay = Number.isFinite(avgAcuity)
    ? avgAcuity
    : acuityCountDisplay > 0
      ? acuitySumDisplay / acuityCountDisplay
      : NaN;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div
        role="button"
        tabIndex={0}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
      >
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold text-slate-900 dark:text-slate-100">{label}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className={["rounded-full border px-2 py-0.5", statusChipClass("active")].join(" ")}>
              {activeDisplay} active
            </span>
            <span className={["rounded-full border px-2 py-0.5", statusChipClass("inactive")].join(" ")}>
              {computed.inactive} inactive
            </span>
            <span className={["rounded-full border px-2 py-0.5", populationChipClass("youth")].join(" ")}>
              Y {computed.youth}
            </span>
            <span className={["rounded-full border px-2 py-0.5", populationChipClass("individual")].join(" ")}>
              I {computed.individual}
            </span>
            <span className={["rounded-full border px-2 py-0.5", populationChipClass("family")].join(" ")}>
              F {computed.family}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
            Acuity: Sum <b>{acuitySumDisplay.toFixed(2)}</b> | Avg{" "}
            <b>{Number.isFinite(avgAcuityDisplay) ? avgAcuityDisplay.toFixed(2) : "-"}</b>
          </div>
        </div>

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <div className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 p-1 text-xs dark:border-slate-700 dark:bg-slate-800">
            <button
              className={`rounded-full px-3 py-1 ${scope === "active" ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "text-slate-700 dark:text-slate-300"}`}
              onClick={() => setScope("active")}
              title="Show active customers"
            >
              Active
            </button>
            <button
              className={`rounded-full px-3 py-1 ${scope === "inactive" ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "text-slate-700 dark:text-slate-300"}`}
              onClick={() => setScope("inactive")}
              title="Show inactive customers"
            >
              Inactive
            </button>
          </div>
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{open ? "Collapse" : "Expand"}</span>
        </div>
      </div>

      {open ? (
        <div className="border-t border-slate-200 bg-slate-50/40 p-3 dark:border-slate-700 dark:bg-slate-900/50">
          {filtered.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">No customers.</div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((customer) => (
                <CaseManagerClientRow
                  key={String(customer.id)}
                  customer={customer}
                  enrollments={enrollmentsByCustomerId.get(String(customer.id)) || []}
                  monthKey={monthKey}
                  cmName={label}
                  cmUid={String(user.uid || "")}
                />
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
