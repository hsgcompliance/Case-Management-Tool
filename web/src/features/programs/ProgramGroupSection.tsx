// web/src/features/programs/ProgramGroupSection.tsx
"use client";
import React from "react";
import { ProgramRow } from "./ProgramRow";
import type { TGrant as Grant } from "@types";

interface ProgramGroupSectionProps {
  label: string;
  programs: Grant[];
  itemConfig: Record<string, { visible?: boolean; labelOverride?: string }>;
  onOpen: (id: string) => void;
  renderHeader: (
    col: string,
    label: React.ReactNode,
    defaultDir?: "asc" | "desc",
    align?: "right",
  ) => React.ReactNode;
}

export function ProgramGroupSection({
  label,
  programs,
  itemConfig,
  onOpen,
  renderHeader,
}: ProgramGroupSectionProps) {
  if (programs.length === 0) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-5 w-1 rounded-full bg-sky-500" />
          <h2 className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{label}</h2>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
          {programs.length} {programs.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      <div className="grid grid-cols-12 gap-3 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        <div className="col-span-9 md:col-span-4">{renderHeader("name", "Name")}</div>
        <div className="hidden text-right md:block md:col-span-1">{renderHeader("active", "Active", "desc", "right")}</div>
        <div className="hidden text-right md:block md:col-span-1">{renderHeader("inactive", "Inactive", "desc", "right")}</div>
        <div className="hidden text-right md:block md:col-span-1">{renderHeader("clients", "Clients", "desc", "right")}</div>
        <div className="hidden md:block md:col-span-2">{renderHeader("population", "Population")}</div>
        <div className="hidden text-right md:block md:col-span-1">{renderHeader("cms", "CMs", "desc", "right")}</div>
        <div className="hidden text-right md:block md:col-span-1">{renderHeader("budget", "Budget", "desc", "right")}</div>
        <div className="col-span-3 md:col-span-1" />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {programs.map((g) => {
          const cfg = itemConfig[String(g.id)] ?? {};
          return (
            <ProgramRow
              key={String(g.id)}
              grant={g}
              labelOverride={cfg.labelOverride}
              onClick={() => onOpen(String(g.id))}
            />
          );
        })}
      </div>
    </section>
  );
}
