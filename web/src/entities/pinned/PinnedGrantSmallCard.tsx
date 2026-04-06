"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useGrant } from "@hooks/useGrants";
import type { TGrant as Grant } from "@types";

// ─── Types ────────────────────────────────────────────────────────────────────

type GrantKind = "grant" | "program";

// Mode cycle depends on kind:
//   grant:   budgetSpent → budgetProjected → enrollment → population
//   program: enrollment → population
type GrantMode = "budgetSpent" | "budgetProjected" | "enrollment" | "population";

const GRANT_MODES: GrantMode[] = ["budgetSpent", "budgetProjected", "enrollment", "population"];
const PROGRAM_MODES: GrantMode[] = ["enrollment", "population"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtUsd = (n: number) =>
  Number(n || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

function getKind(g: Grant): GrantKind {
  const k = String((g as any)?.kind || "").toLowerCase();
  if (k === "program") return "program";
  if (k === "grant") return "grant";
  return Number((g as any)?.budget?.total ?? 0) <= 0 ? "program" : "grant";
}

function getBudget(g: Grant) {
  const b = (g as any)?.budget ?? {};
  const total = Number(b.total ?? 0);
  const spent = Number(b.totals?.spent ?? b.spent ?? 0);
  const projected = Number(b.totals?.projected ?? b.projected ?? 0);
  const remaining = Number(b.totals?.remaining ?? b.remaining ?? Math.max(0, total - spent));
  const projectedRemaining = Math.max(0, total - projected);
  return { total, spent, projected, remaining, projectedRemaining };
}

function getEnrollment(g: Grant) {
  const m = (g as any)?.metrics?.enrollmentCounts ?? {};
  return {
    active: Number(m.active ?? 0),
    inactive: Number(m.inactive ?? 0),
    total: Number(m.total ?? 0),
    population: (m.population || {}) as Record<string, number>,
  };
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  draft: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  closed: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

const POP_COLORS: Record<string, string> = {
  Youth: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  Individual: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  Family: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

const MODE_LABELS: Record<GrantMode, string> = {
  budgetSpent: "Spent / Remaining",
  budgetProjected: "Projected / Remaining",
  enrollment: "Enrollments",
  population: "Population",
};

// ─── Content panels ───────────────────────────────────────────────────────────

function BudgetSpentPanel({ g }: { g: Grant }) {
  const { total, spent, remaining } = getBudget(g);
  const pct = total > 0 ? Math.min(100, (spent / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-slate-500">Spent</span>
        <span className="font-semibold text-amber-600 dark:text-amber-400">{fmtUsd(spent)}</span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-slate-500">Remaining</span>
        <span className={`font-semibold ${remaining < 0 ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400"}`}>
          {fmtUsd(remaining)}
        </span>
      </div>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={`h-full rounded-full ${pct >= 100 ? "bg-rose-500" : "bg-amber-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-right text-[10px] text-slate-400">
        {fmtUsd(total)} total
      </div>
    </div>
  );
}

function BudgetProjectedPanel({ g }: { g: Grant }) {
  const { total, projected, projectedRemaining } = getBudget(g);
  const pct = total > 0 ? Math.min(100, (projected / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-slate-500">Projected</span>
        <span className="font-semibold text-blue-600 dark:text-blue-400">{fmtUsd(projected)}</span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-slate-500">Proj. Remaining</span>
        <span className={`font-semibold ${projectedRemaining < 0 ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400"}`}>
          {fmtUsd(projectedRemaining)}
        </span>
      </div>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full rounded-full bg-blue-400" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-right text-[10px] text-slate-400">
        {fmtUsd(total)} total
      </div>
    </div>
  );
}

function EnrollmentPanel({ g }: { g: Grant }) {
  const { active, inactive } = getEnrollment(g);
  return (
    <div className="flex items-baseline gap-4">
      <div className="text-center">
        <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{active}</div>
        <div className="text-[10px] uppercase tracking-wide text-slate-400">Active</div>
      </div>
      {inactive > 0 && (
        <div className="text-center">
          <div className="text-xl font-bold text-slate-400">{inactive}</div>
          <div className="text-[10px] uppercase tracking-wide text-slate-400">Inactive</div>
        </div>
      )}
      {active === 0 && inactive === 0 && (
        <span className="text-xs italic text-slate-400">No enrollments yet</span>
      )}
    </div>
  );
}

function PopulationPanel({ g }: { g: Grant }) {
  const { population } = getEnrollment(g);
  const entries = Object.entries(population).filter(([, v]) => v > 0);
  if (!entries.length) {
    return <span className="text-xs italic text-slate-400">No population data</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([label, count]) => (
        <span
          key={label}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${POP_COLORS[label] ?? "bg-slate-100 text-slate-500"}`}
        >
          {label} <span className="opacity-80">{count}</span>
        </span>
      ))}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export interface PinnedGrantSmallCardProps {
  grantId: string;
  onUnpin?: () => void;
}

export function PinnedGrantSmallCard({ grantId, onUnpin }: PinnedGrantSmallCardProps) {
  const router = useRouter();
  const { data: grant, isLoading } = useGrant(grantId, { enabled: !!grantId });
  const [modeIdx, setModeIdx] = useState(0);

  if (isLoading || !grant) {
    return (
      <div className="flex h-36 animate-pulse items-center justify-center rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40">
        <span className="text-xs text-slate-400">Loading…</span>
      </div>
    );
  }

  const g = grant as Grant;
  const kind = getKind(g);
  const modes = kind === "program" ? PROGRAM_MODES : GRANT_MODES;
  const mode = modes[modeIdx % modes.length];
  const status = String((g as any)?.status || "draft");

  const cycleNext = () => setModeIdx((i) => (i + 1) % modes.length);

  return (
    <div
      className="relative flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-900 cursor-pointer select-none"
      onClick={cycleNext}
      title={`Click to cycle view (${MODE_LABELS[mode]})`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-3 pt-3 pb-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1">
            <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-600 dark:bg-sky-900/40 dark:text-sky-400">
              {kind === "program" ? "Program" : "Grant"}
            </span>
            <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${STATUS_COLORS[status] ?? STATUS_COLORS.draft}`}>
              {status}
            </span>
          </div>
          <div className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
            {String((g as any)?.name || grantId)}
          </div>
        </div>
        {onUnpin && (
          <button
            title="Unpin"
            onClick={(e) => { e.stopPropagation(); onUnpin(); }}
            className="shrink-0 rounded-full p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 text-sm leading-none"
          >
            ×
          </button>
        )}
      </div>

      {/* Mode label */}
      <div className="px-3 pb-1">
        <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
          {MODE_LABELS[mode]}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-3 pb-3 text-sm">
        {mode === "budgetSpent" && <BudgetSpentPanel g={g} />}
        {mode === "budgetProjected" && <BudgetProjectedPanel g={g} />}
        {mode === "enrollment" && <EnrollmentPanel g={g} />}
        {mode === "population" && <PopulationPanel g={g} />}
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between border-t border-slate-100 px-3 py-1.5 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1">
          {modes.map((m, i) => (
            <button
              key={m}
              onClick={(e) => { e.stopPropagation(); setModeIdx(i); }}
              title={MODE_LABELS[m]}
              className={`h-1 rounded-full transition ${
                i === modeIdx % modes.length
                  ? "w-4 bg-sky-500"
                  : "w-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700"
              }`}
            />
          ))}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); router.push(`/grants/${grantId}`); }}
          className="text-[10px] font-semibold text-sky-500 hover:text-sky-600 dark:text-sky-400"
        >
          View →
        </button>
      </div>
    </div>
  );
}

export default PinnedGrantSmallCard;
