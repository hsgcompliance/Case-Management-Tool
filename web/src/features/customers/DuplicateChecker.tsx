"use client";

import React from "react";
import type { DupMatch, DupTier } from "@lib/duplicateScore";
import { DUP_WARN_THRESHOLD } from "@lib/duplicateScore";
import type { TCustomerEntity } from "@types";

// ── Tier metadata ─────────────────────────────────────────────────────────────

const TIER_META: Record<DupTier, { label: string; color: string; dotColor: string }> = {
  "exact-cwid":    { label: "CW ID Match",     color: "bg-red-100 text-red-800 border-red-200",       dotColor: "bg-red-500" },
  "exact-all":     { label: "Exact Match",      color: "bg-red-100 text-red-800 border-red-200",       dotColor: "bg-red-500" },
  "name-dob-year": { label: "Strong Match",     color: "bg-orange-100 text-orange-800 border-orange-200", dotColor: "bg-orange-500" },
  "name-only":     { label: "Name Match",       color: "bg-orange-100 text-orange-800 border-orange-200", dotColor: "bg-orange-500" },
  "last-dob":      { label: "Last + DOB",       color: "bg-amber-100 text-amber-800 border-amber-200", dotColor: "bg-amber-500" },
  "first-dob":     { label: "First + DOB",      color: "bg-amber-100 text-amber-800 border-amber-200", dotColor: "bg-amber-500" },
  "dob-only":      { label: "DOB Match",        color: "bg-yellow-100 text-yellow-800 border-yellow-200", dotColor: "bg-yellow-500" },
  "fuzzy-name":    { label: "Similar Name",     color: "bg-sky-100 text-sky-800 border-sky-200",       dotColor: "bg-sky-500" },
};

function ScoreBadge({ score, tier }: { score: number; tier: DupTier }) {
  const meta = TIER_META[tier];
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        meta.color,
      ].join(" ")}
    >
      <span className={["h-1.5 w-1.5 rounded-full", meta.dotColor].join(" ")} />
      {meta.label} — {score}%
    </span>
  );
}

function formatDob(dob?: string | null): string {
  if (!dob) return "—";
  // ISO date → MM/DD/YYYY display
  const parts = dob.slice(0, 10).split("-");
  if (parts.length === 3) return `${parts[1]}/${parts[2]}/${parts[0]}`;
  return dob;
}

function displayName(c: TCustomerEntity): string {
  const full = String(c.name || "").trim();
  if (full) return full;
  return [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || "(Unnamed)";
}

// ── Match row ─────────────────────────────────────────────────────────────────

function MatchRow({ match }: { match: DupMatch<TCustomerEntity> }) {
  const { customer, score, tier, reasons } = match;
  const isHigh = score >= DUP_WARN_THRESHOLD;

  return (
    <div
      className={[
        "flex flex-col gap-2 rounded-[18px] border p-3 sm:flex-row sm:items-start sm:gap-4",
        isHigh ? "border-orange-200 bg-orange-50" : "border-slate-200 bg-white",
      ].join(" ")}
    >
      {/* Name + details */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-950">{displayName(customer)}</span>
          <ScoreBadge score={score} tier={tier} />
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
          <span>DOB: {formatDob(customer.dob)}</span>
          {customer.cwId ? <span>CW ID: {customer.cwId}</span> : null}
          <span className="italic">{reasons.join(" · ")}</span>
        </div>
      </div>

      {/* Action */}
      <a
        href={`/customers/${customer.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-ghost btn-sm shrink-0 whitespace-nowrap"
      >
        View record ↗
      </a>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export type DupCheckState = "idle" | "checking" | "done";

interface DuplicateCheckerProps {
  checkState: DupCheckState;
  matches: DupMatch<TCustomerEntity>[];
  onCheck: () => void;
  /** Called when user explicitly acknowledges the warning and wants to proceed. */
  onOverride?: () => void;
  overrideConfirmed?: boolean;
}

export function DuplicateChecker({
  checkState,
  matches,
  onCheck,
  onOverride,
  overrideConfirmed = false,
}: DuplicateCheckerProps) {
  const hasHighMatch = matches.some((m) => m.score >= DUP_WARN_THRESHOLD);
  const isDone = checkState === "done";
  const isChecking = checkState === "checking";

  return (
    <div className="space-y-3">
      {/* Check button row */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onCheck}
          disabled={isChecking}
        >
          {isChecking ? (
            <span className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
              Checking…
            </span>
          ) : isDone ? (
            "Re-check duplicates"
          ) : (
            "Check for duplicates"
          )}
        </button>

        {isDone && matches.length === 0 && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            No duplicates found
          </span>
        )}

        {isDone && matches.length > 0 && (
          <span className="text-sm text-slate-500">
            {matches.length} potential match{matches.length !== 1 ? "es" : ""} found
          </span>
        )}
      </div>

      {/* Results list */}
      {isDone && matches.length > 0 && (
        <div className="space-y-2">
          {matches.map((m) => (
            <MatchRow key={m.customer.id} match={m} />
          ))}
        </div>
      )}

      {/* High-match warning + override */}
      {isDone && hasHighMatch && !overrideConfirmed && (
        <div className="rounded-[18px] border border-red-200 bg-red-50 p-4">
          <div className="text-sm font-semibold text-red-800">
            High similarity match detected
          </div>
          <p className="mt-1 text-sm text-red-700">
            One or more existing clients closely match the information entered. Please review the records above before
            creating a new client to avoid duplicates.
          </p>
          {onOverride && (
            <button
              type="button"
              className="btn btn-ghost btn-sm mt-3 border border-red-300 text-red-700 hover:bg-red-100"
              onClick={onOverride}
            >
              I've reviewed the matches — continue anyway
            </button>
          )}
        </div>
      )}

      {isDone && hasHighMatch && overrideConfirmed && (
        <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Override confirmed — proceeding despite high similarity match.
        </div>
      )}
    </div>
  );
}
