// web/src/features/programs/ProgramRow.tsx
"use client";
import React from "react";
import { useGrantMetrics } from "@hooks/useMetrics";
import { metricTextClass, populationChipClass } from "@lib/colorRegistry";
import type { TGrant as Grant } from "@types";
import { useTogglePinnedGrant, usePinnedGrantIds } from "@features/grants/PinnedGrantCards";
import { useTogglePinnedItem, usePinnedItems } from "@entities/pinned/PinnedItemsSection";

const POP_KEYS = ["youth", "individual", "family"] as const;
const POP_LABELS: Record<string, string> = { youth: "Y", family: "F", individual: "I" };

function PopPill({ popKey, count }: { popKey: string; count: number }) {
  if (!count) return null;
  const letter = POP_LABELS[popKey] ?? (popKey[0]?.toUpperCase() ?? "?");
  return (
    <span
      className={[
        "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        populationChipClass(popKey),
      ].join(" ")}
      title={`${popKey[0].toUpperCase() + popKey.slice(1)}: ${count}`}
    >
      {letter} {count}
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

  const gid = String(grant.id);
  const isPinned = pinnedIds.includes(gid);
  const isDashPinned = dashPinnedItems.some((x) => x.type === "grant" && x.id === gid);
  const isGrant = String((grant as any)?.kind || "").toLowerCase() !== "program";

  const enrollActive = gm?.enrollments.active ?? (grant as any)?.metrics?.enrollmentCounts?.active ?? "—";
  const uniqueClients = gm?.customers.uniqueTotal ?? "—";
  const cmCount = gm?.caseManagers.total ?? "—";
  const cmNames = gm?.caseManagers.refs?.map((r) => r.name ?? r.id).join(", ");

  const pop = gm?.enrollments.byPopulation;
  const embeddedPop = (grant as any)?.metrics?.enrollmentCounts?.population as
    | Record<string, number>
    | undefined;
  const displayPop =
    pop ??
    (embeddedPop
      ? {
          youth: embeddedPop.Youth ?? 0,
          family: embeddedPop.Family ?? 0,
          individual: embeddedPop.Individual ?? 0,
          unknown: embeddedPop.unknown ?? 0,
        }
      : null);

  return (
    <div className="group grid w-full grid-cols-12 items-center gap-3 border-b border-slate-200 dark:border-slate-700 last:border-b-0">
      {/* Main clickable row */}
      <button
        type="button"
        onClick={onClick}
        className="col-span-10 grid grid-cols-10 items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
      >
        {/* Name + kind chip */}
        <div className="col-span-10 md:col-span-4">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-sky-700 dark:group-hover:text-sky-400 transition-colors truncate">
              {labelOverride || String(grant.name || grant.id)}
            </span>
            {isGrant && (
              <span className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                Grant
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            ID: {String(grant.id || "-")}
          </div>
        </div>

        {/* Active enrollments */}
        <div
          className={[
            "col-span-4 text-right text-sm font-semibold md:col-span-2",
            metricTextClass("grant-active-enrollments"),
          ].join(" ")}
          title={gm?.enrollments.total != null ? `Active: ${enrollActive} · Total: ${gm.enrollments.total}` : undefined}
        >
          {isLoading ? "…" : enrollActive}
        </div>

        {/* Unique clients */}
        <div
          className={[
            "col-span-4 text-right text-sm font-semibold md:col-span-2",
            metricTextClass("grant-unique-clients"),
          ].join(" ")}
          title={gm ? `Unique: ${gm.customers.uniqueTotal} (${gm.customers.activeUniqueTotal} active)` : undefined}
        >
          {isLoading ? "…" : uniqueClients}
        </div>

        {/* Population pills */}
        <div className="col-span-4 flex flex-wrap justify-end gap-1 md:col-span-1">
          {displayPop ? (
            POP_KEYS.map((k) => (
              <PopPill key={k} popKey={k} count={displayPop[k] ?? 0} />
            ))
          ) : (
            <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
          )}
        </div>

        {/* CM count */}
        <div
          className="hidden md:block text-right text-xs text-slate-500 dark:text-slate-400 md:col-span-1"
          title={cmNames}
        >
          {isLoading ? "…" : cmCount !== "—" && cmCount > 0 ? `${cmCount} CMs` : "—"}
        </div>
      </button>

      {/* Pin buttons */}
      <div className="col-span-2 flex items-center justify-end gap-0.5 pr-3">
        <button
          type="button"
          title={isDashPinned ? "Unpin from dashboard" : "Pin to dashboard"}
          onClick={(e) => { e.stopPropagation(); toggleDashPin.mutate({ type: "grant", id: gid }); }}
          className={`flex items-center justify-center rounded-full p-1 text-xs transition ${isDashPinned ? "text-sky-400 hover:text-sky-500" : "text-slate-300 hover:text-sky-400 dark:text-slate-600"}`}
        >
          📌
        </button>
        <button
          type="button"
          title={isPinned ? "Unpin" : "Pin to programs page"}
          onClick={(e) => { e.stopPropagation(); togglePin.mutate(gid); }}
          className={`flex items-center justify-center rounded-full p-1 text-sm transition ${isPinned ? "text-amber-400 hover:text-amber-500" : "text-slate-300 hover:text-amber-400 dark:text-slate-600"}`}
        >
          {isPinned ? "★" : "☆"}
        </button>
      </div>
    </div>
  );
}
