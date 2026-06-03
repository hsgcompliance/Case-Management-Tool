// web/src/features/programs/ProgramRow.tsx
"use client";
import React from "react";
import { useGrantMetrics } from "@hooks/useMetrics";
import { useEnrollmentsList } from "@hooks/useEnrollments";
import { metricTextClass, populationChipClass } from "@lib/colorRegistry";
import { formatEnrollmentLabel } from "@lib/enrollmentLabels";
import type { TGrant as Grant } from "@types";
import { useTogglePinnedGrant, usePinnedGrantIds } from "@features/grants/PinnedGrantCards";
import { useTogglePinnedItem, usePinnedItems } from "@entities/pinned/PinnedItemsSection";
import { getGrantFinancialCapabilities } from "@hdb/contracts";

const POP_KEYS = ["youth", "individual", "family"] as const;
const POP_LABELS: Record<string, string> = { youth: "Youth", family: "Family", individual: "Individual" };

function asObj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function fmtUsd(n: number) {
  if (!n) return "-";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function budgetTotal(grant: Grant) {
  const budget = asObj(asObj(grant).budget);
  const totals = asObj(budget.totals);
  const total = Number(totals.total ?? budget.total ?? 0);
  return Number.isFinite(total) ? total : 0;
}

function fmtDate(value: unknown) {
  const text = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "-";
  return text;
}

function enrollmentPopulation(enrollment: Record<string, unknown>) {
  return String(
    enrollment.population ||
      enrollment.clientPopulation ||
      enrollment.customerPopulation ||
      enrollment.householdPopulation ||
      "",
  ).trim().toLowerCase();
}

function isOtherPopulation(enrollment: Record<string, unknown>) {
  const pop = enrollmentPopulation(enrollment);
  return !pop || (pop !== "youth" && pop !== "family" && pop !== "individual");
}

function PopPill({ popKey, count }: { popKey: string; count: number }) {
  if (!count) return null;
  return (
    <span
      className={[
        "inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
        populationChipClass(popKey),
      ].join(" ")}
      title={`${POP_LABELS[popKey] ?? popKey}: ${count}`}
    >
      {POP_LABELS[popKey] ?? popKey} {count}
    </span>
  );
}

interface ProgramRowProps {
  grant: Grant;
  labelOverride?: string;
  onClick: () => void;
}

export function ProgramRow({ grant, labelOverride, onClick }: ProgramRowProps) {
  const { data: gm, isLoading } = useGrantMetrics(grant.id);
  const { data: pinnedIds = [] } = usePinnedGrantIds();
  const togglePin = useTogglePinnedGrant();
  const { data: dashPinnedItems = [] } = usePinnedItems();
  const toggleDashPin = useTogglePinnedItem();
  const [otherOpen, setOtherOpen] = React.useState(false);

  const gid = String(grant.id);
  const isPinned = pinnedIds.includes(gid);
  const isDashPinned = dashPinnedItems.some((x) => x.type === "grant" && x.id === gid);
  const grantRecord = asObj(grant);
  const allMetrics = asObj(grantRecord.metrics);
  const embeddedCounts = asObj(allMetrics.enrollmentCounts);
  const embeddedCustomers = asObj(allMetrics.customers);
  const embeddedCaseManagers = asObj(allMetrics.caseManagers);
  const isGrant = String(grantRecord.kind || "").toLowerCase() !== "program";
  const totalBudget = budgetTotal(grant);
  const financialCapabilities = getGrantFinancialCapabilities(grantRecord);
  const financeLabel = financialCapabilities.drawsDownBudget
    ? `${fmtUsd(totalBudget)} budget`
    : financialCapabilities.billingEnabled
      ? "Billing"
      : financialCapabilities.hasFinancialActivity
        ? "Tracked"
        : "Service";

  const enrollActive = gm?.enrollments?.active ?? embeddedCounts.active ?? "-";
  const enrollInactive = gm?.enrollments?.inactive ?? embeddedCounts.inactive ?? "-";
  const uniqueClients = gm?.customers?.uniqueTotal ?? embeddedCustomers.uniqueTotal ?? "-";
  const cmCount = gm?.caseManagers?.total ?? embeddedCaseManagers.total ?? "-";
  const cmNames = gm?.caseManagers?.refs?.map((r) => r.name ?? r.id).join(", ");

  const pop = gm?.enrollments?.byPopulation;
  const embeddedPop = asObj(embeddedCounts.population);
  const hasEmbeddedPop = Object.keys(embeddedPop).length > 0;
  const displayPop =
    pop ??
    (hasEmbeddedPop
      ? {
          youth: Number(embeddedPop.youth ?? embeddedPop.Youth ?? 0),
          family: Number(embeddedPop.family ?? embeddedPop.Family ?? 0),
          individual: Number(embeddedPop.individual ?? embeddedPop.Individual ?? 0),
          other: Number(embeddedPop.other ?? embeddedPop.Other ?? embeddedPop.unknown ?? embeddedPop.Unknown ?? 0),
        }
      : null);
  const otherCount = Number(
    (displayPop as Record<string, unknown> | null | undefined)?.other ??
      (displayPop as Record<string, unknown> | null | undefined)?.unknown ??
      0,
  );
  const { data: otherEnrollments = [], isFetching: otherLoading } = useEnrollmentsList(
    { grantId: gid, limit: 500 },
    { enabled: otherOpen && otherCount > 0 },
  );
  const visibleOtherEnrollments = React.useMemo(
    () => (otherEnrollments as Array<Record<string, unknown>>).filter(isOtherPopulation),
    [otherEnrollments],
  );

  return (
    <div
      className={[
        "group grid w-full grid-cols-12 items-center gap-3 border-b border-slate-200 transition-colors last:border-b-0 dark:border-slate-700",
        isGrant ? "border-l-4 border-l-amber-400" : "border-l-4 border-l-sky-400",
      ].join(" ")}
    >
      <div className="col-span-9 grid grid-cols-9 items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/40 md:col-span-11 md:grid-cols-12">
        <div className="col-span-9 min-w-0 md:col-span-4">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="select-text truncate text-lg font-bold leading-tight text-slate-900 transition-colors group-hover:text-sky-700 dark:text-slate-100 dark:group-hover:text-sky-400">
              {labelOverride || String(grant.name || grant.id)}
            </span>
            <span
              className={[
                "hidden shrink-0 text-[11px] font-semibold md:inline",
                isGrant ? "text-amber-700 dark:text-amber-300" : "text-sky-700 dark:text-sky-300",
              ].join(" ")}
            >
              {isGrant ? "Grant" : "Program"}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="select-text truncate">ID: {String(grant.id || "-")}</span>
            <span className="select-text">{financeLabel}</span>
          </div>
        </div>

        <div
          className={[
            "col-span-3 text-right text-sm font-bold md:col-span-1",
            metricTextClass("grant-active-enrollments"),
          ].join(" ")}
          title={gm?.enrollments?.total != null ? `Active: ${enrollActive} / Total: ${gm.enrollments?.total}` : undefined}
        >
          <span className="select-text">{isLoading ? "..." : enrollActive}</span>
        </div>

        <div className="col-span-3 text-right text-sm font-semibold text-slate-500 dark:text-slate-400 md:col-span-1">
          <span className="select-text">{isLoading ? "..." : enrollInactive}</span>
        </div>

        <div
          className={[
            "col-span-3 text-right text-sm font-semibold md:col-span-1",
            metricTextClass("grant-unique-clients"),
          ].join(" ")}
          title={gm?.customers ? `Unique: ${gm.customers?.uniqueTotal} (${gm.customers?.activeUniqueTotal} active)` : undefined}
        >
          <span className="select-text">{isLoading ? "..." : uniqueClients}</span>
        </div>

        <div className="hidden flex-wrap justify-start gap-1 md:col-span-2 md:flex">
          {displayPop ? (
            <>
              {POP_KEYS.map((k) => (
                <PopPill key={k} popKey={k} count={displayPop[k] ?? 0} />
              ))}
              {otherCount > 0 ? (
                <button
                  type="button"
                  className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  title="Show other/unknown population enrollments"
                  onClick={(event) => {
                    event.stopPropagation();
                    setOtherOpen((prev) => !prev);
                  }}
                >
                  Other {otherCount}
                </button>
              ) : null}
            </>
          ) : (
            <span className="text-xs text-slate-300 dark:text-slate-600">-</span>
          )}
        </div>

        <div
          className="hidden text-right text-xs text-slate-500 dark:text-slate-400 md:col-span-1 md:block"
          title={cmNames}
        >
          <span className="select-text">{isLoading ? "..." : cmCount !== "-" && Number(cmCount) > 0 ? `${cmCount}` : "-"}</span>
        </div>

        <div className="hidden text-right text-xs font-semibold text-slate-600 dark:text-slate-300 md:col-span-2 md:block">
          <span className="select-text">{financeLabel}</span>
        </div>
        {otherOpen ? (
          <div className="col-span-9 rounded-lg border border-slate-200 bg-slate-50 p-3 md:col-span-12 dark:border-slate-700 dark:bg-slate-950/40">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Other Enrollments</div>
              <button
                type="button"
                className="text-xs font-semibold text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
                onClick={() => setOtherOpen(false)}
              >
                Hide
              </button>
            </div>
            {otherLoading ? (
              <div className="text-sm text-slate-500">Loading enrollments...</div>
            ) : visibleOtherEnrollments.length ? (
              <div className="max-h-56 overflow-y-auto rounded border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                {visibleOtherEnrollments.map((enrollment) => (
                  <div key={String(enrollment.id || "")} className="grid gap-2 border-b border-slate-100 px-3 py-2 text-xs last:border-b-0 md:grid-cols-4 dark:border-slate-800">
                    <div className="select-text font-semibold text-slate-800 dark:text-slate-100">
                      {formatEnrollmentLabel(enrollment, { fallback: String(enrollment.customerName || enrollment.clientName || enrollment.id || "Enrollment") })}
                    </div>
                    <div className="select-text text-slate-500">Status: {String(enrollment.status || (enrollment.active === false ? "closed" : "active"))}</div>
                    <div className="select-text text-slate-500">Start: {fmtDate(enrollment.startDate)}</div>
                    <div className="select-text text-slate-500">End: {fmtDate(enrollment.endDate)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-500">No other/unknown population enrollments returned.</div>
            )}
          </div>
        ) : null}
      </div>

      <div className="col-span-3 flex items-center justify-end gap-1 pr-3 md:col-span-1">
        <button
          type="button"
          title="Open program"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="flex h-7 min-w-12 items-center justify-center rounded-md border border-slate-200 px-2 text-xs font-semibold text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-sky-800 dark:hover:bg-sky-950/40"
        >
          Open
        </button>
        <button
          type="button"
          title={isDashPinned ? "Unpin from dashboard" : "Pin to dashboard"}
          onClick={(e) => {
            e.stopPropagation();
            toggleDashPin.mutate({ type: "grant", id: gid });
          }}
          className={[
            "flex h-7 w-7 items-center justify-center rounded-md border text-xs font-bold transition",
            isDashPinned
              ? "border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300"
              : "border-transparent text-slate-300 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-500 dark:text-slate-600",
          ].join(" ")}
        >
          D
        </button>
        <button
          type="button"
          title={isPinned ? "Unpin from programs page" : "Pin to programs page"}
          onClick={(e) => {
            e.stopPropagation();
            togglePin.mutate(gid);
          }}
          className={[
            "flex h-7 w-7 items-center justify-center rounded-md border text-xs font-bold transition",
            isPinned
              ? "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
              : "border-transparent text-slate-300 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-500 dark:text-slate-600",
          ].join(" ")}
        >
          P
        </button>
      </div>
    </div>
  );
}
