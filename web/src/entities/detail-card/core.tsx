"use client";

import React from "react";

export function DetailCardShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string | null;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white text-sm shadow-sm overflow-hidden">
      {/* Card header — type label + subtitle only, no action buttons */}
      <div className="px-4 pt-4 pb-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{title}</div>
        {subtitle ? <div className="mt-0.5 text-sm text-slate-800 break-words">{subtitle}</div> : null}
      </div>

      {/* Card body */}
      <div className="px-4 pb-4 space-y-4">
        {children}
      </div>

      {/* Action footer — visually distinct bottom strip */}
      {actions ? (
        <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
          {actions}
        </div>
      ) : null}
    </section>
  );
}

export function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

export function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[132px_1fr] gap-2 items-start rounded px-2 py-1 hover:bg-white/70">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-slate-900 break-words">{value}</div>
    </div>
  );
}
