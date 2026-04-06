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
}

export function ProgramGroupSection({
  label,
  programs,
  itemConfig,
  onOpen,
}: ProgramGroupSectionProps) {
  if (programs.length === 0) return null;

  return (
    <section className="space-y-2">
      {/* Section header */}
      <div className="flex items-baseline justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-2">
        <h2 className="text-base font-semibold text-slate-700 dark:text-slate-300">{label}</h2>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {programs.length} {programs.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {/* Column headers — 12 cols; 10 for content + 2 for pins */}
      <div className="grid grid-cols-12 gap-3 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        <div className="col-span-10 md:col-span-4">Name</div>
        <div className="hidden md:block col-span-2 text-right">Active Enroll.</div>
        <div className="hidden md:block col-span-2 text-right">Unique Clients</div>
        <div className="hidden md:block col-span-1 text-right">Pop.</div>
        <div className="hidden md:block col-span-1 text-right">CMs</div>
        <div className="col-span-2" />
      </div>

      {/* Rows */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
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
