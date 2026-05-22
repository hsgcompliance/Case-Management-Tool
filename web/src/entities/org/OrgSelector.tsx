"use client";

import React from "react";

export type OrgSelectorOrg = {
  id: string;
  name?: string;
  active?: boolean;
  teams?: Array<{ id: string; active?: boolean }>;
  config?: Record<string, unknown>;
  userCount?: number;
};

export function OrgSelector({
  orgs,
  selectedOrgId,
  onSelect,
  title = "Org Directory",
}: {
  orgs: OrgSelectorOrg[];
  selectedOrgId: string;
  onSelect: (orgId: string) => void;
  title?: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      <div className="mt-3 max-h-80 space-y-2 overflow-auto pr-1">
        {orgs.map((org) => {
          const selected = selectedOrgId === org.id;
          const teamCount = (org.teams || []).filter((team) => team.active !== false).length;
          const configCount = org.config ? Object.keys(org.config).length : 0;
          return (
            <button
              key={org.id}
              type="button"
              onClick={() => onSelect(org.id)}
              className={[
                "w-full rounded-lg border px-3 py-2 text-left transition",
                selected
                  ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-900/20"
                  : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-2">
                <code className="text-xs">{org.id}</code>
                <span className={["rounded-full px-2 py-0.5 text-[10px] font-semibold", org.active === false ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"].join(" ")}>
                  {org.active === false ? "inactive" : "active"}
                </span>
              </div>
              <div className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{org.name || org.id}</div>
              <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                <span>{teamCount} teams</span>
                <span>{configCount} config docs</span>
                {typeof org.userCount === "number" ? <span>{org.userCount} users</span> : null}
              </div>
            </button>
          );
        })}
        {!orgs.length ? <div className="py-6 text-center text-sm text-slate-500">No orgs found.</div> : null}
      </div>
    </section>
  );
}

export default OrgSelector;
