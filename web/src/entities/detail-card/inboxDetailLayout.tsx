"use client";

import React from "react";
import { fmtDateOrDash } from "@lib/formatters";
import { isInboxClosed } from "@hooks/useInboxDetail";
import { DetailSection } from "./core";

function val(v: unknown): string {
  const s = String(v || "").trim();
  return s || "-";
}

function isoToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isOverdue(item: any): boolean {
  const due = String(item?.dueDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return false;
  if (isInboxClosed(item?.status)) return false;
  return due < isoToday();
}

function statusText(item: any): string {
  return isInboxClosed(item?.status) ? "closed" : "open";
}

function customerId(item: any): string {
  return String(item?.customerId || item?.clientId || "").trim();
}

function enrollmentId(item: any): string {
  return String(item?.enrollmentId || "").trim();
}

function grantId(item: any): string {
  return String(item?.grantId || "").trim();
}

function formId(item: any): string {
  return String(item?.formId || "").trim();
}

function customerHref(item: any): string | null {
  const id = customerId(item);
  if (!id) return null;
  return `/customers/${id}`;
}

function enrollmentHref(item: any): string | null {
  const eid = enrollmentId(item);
  if (!eid) return null;
  const cid = customerId(item);
  if (!cid) return null;
  return `/customers/${cid}?enrollmentId=${encodeURIComponent(eid)}`;
}

function grantHref(item: any): string | null {
  const id = grantId(item);
  if (!id) return null;
  return `/grants/${id}`;
}

function budgetHref(item: any): string {
  const id = grantId(item);
  if (!id) return "/reports/grant-budgets";
  return `/reports/grant-budgets?grantId=${encodeURIComponent(id)}`;
}

function jotformDigestHref(item: any): string {
  const id = formId(item);
  if (!id) return "/reports/jotform-dashboard";
  return `/reports/jotform-dashboard?formId=${encodeURIComponent(id)}&detailView=custom`;
}

function jotformDashboardHref(item: any): string {
  const id = formId(item);
  if (!id) return "/reports/jotform-dashboard";
  return `/reports/jotform-dashboard?formId=${encodeURIComponent(id)}`;
}

/** Top banner — replaces the old <DetailSection title="Header"> so the literal word "Header" never appears. */
export function DetailUniversalHeader({ item }: { item: any }) {
  const overdue = isOverdue(item);
  const closed = isInboxClosed(item?.status);
  const status = statusText(item);

  // Customer name: prefer composite firstName+lastName, fall back to stored customerName, then ID
  const firstName = String(item?.firstName || "").trim();
  const lastName = String(item?.lastName || "").trim();
  const fullName =
    [firstName, lastName].filter(Boolean).join(" ") ||
    String(item?.customerName || item?.clientName || item?.customerId || item?.clientId || "").trim() ||
    "Unknown Customer";

  const customerLink = customerHref(item);

  // Enrollment name: prefer stored enrollmentName, then build "Grant · StartDate", then Grant alone, then ID
  const rawEnrollmentName = String(item?.enrollmentName || "").trim();
  const grantName = String(item?.grantName || "").trim();
  const grantId = String(item?.grantId || "").trim();
  const startDate = String(item?.startDate || "").trim();
  const enrollmentDisplay =
    rawEnrollmentName ||
    (grantName && startDate ? `${grantName} · ${startDate}` : "") ||
    grantName ||
    grantId ||
    String(item?.enrollmentId || "").trim() ||
    "-";

  // Grant display
  const grantDisplay = val(grantName || grantId);

  // CM name: prefer stored name, then uid
  const cmName = val(
    item?.caseManagerName ||
    item?.cmName ||
    item?.cmUid ||
    item?.assignedToUid
  );

  const dueDate = fmtDateOrDash(item?.dueDate);

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
      {/* Customer name banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-medium mb-0.5">Customer</div>
          {customerLink ? (
            <a
              href={customerLink}
              className="text-base font-bold text-white hover:text-blue-300 transition-colors leading-tight"
            >
              {fullName}
            </a>
          ) : (
            <div className="text-base font-bold text-white leading-tight">{fullName}</div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide border ${
              closed
                ? "bg-slate-700 border-slate-600 text-slate-300"
                : "bg-emerald-900/60 border-emerald-700 text-emerald-300"
            }`}
          >
            {status}
          </span>
          {overdue && (
            <span className="inline-flex items-center rounded-full border border-rose-600 bg-rose-900/60 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-rose-300">
              Overdue
            </span>
          )}
        </div>
      </div>

      {/* Meta strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-slate-100 bg-slate-50">
        {[
          { label: "Enrollment", value: enrollmentDisplay },
          { label: "Grant", value: grantDisplay },
          { label: "Case Manager", value: cmName },
          { label: "Due Date", value: dueDate },
        ].map(({ label, value }) => (
          <div key={label} className="px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">{label}</div>
            <div className="text-sm font-semibold text-slate-800 truncate" title={value}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DetailAdvancedView({ item }: { item: any }) {
  return (
    <details className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
      <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">
        Advanced View
      </summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Routing Status</div>
          <div className="text-slate-900">{val(item?.workflowBlocked ? "blocked" : item?.status)}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Assigned Group</div>
          <div className="text-slate-900">{val(item?.assignedToGroup)}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Assigned User</div>
          <div className="text-slate-900">{val(item?.assignedToUid)}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Source</div>
          <div className="text-slate-900">{val(item?.source)}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Source Path</div>
          <div className="break-words text-slate-900">{val(item?.sourcePath)}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">UTID</div>
          <div className="break-words text-slate-900">{val(item?.utid || item?.id)}</div>
        </div>
      </div>
    </details>
  );
}

function LinkBtn({ href, label }: { href: string | null; label: string }) {
  if (!href) return null;
  return (
    <a className="btn btn-ghost btn-xs" href={href}>
      {label}
    </a>
  );
}

export function DetailQuickLinks({ item }: { item: any }) {
  const src = String(item?.source || "").toLowerCase();
  const showJotform = src === "jotform" || !!formId(item);
  return (
    <DetailSection title="Quick Links">
      <div className="flex flex-wrap gap-2">
        <LinkBtn href={enrollmentHref(item)} label="Edit Enrollment" />
        <LinkBtn href={grantHref(item)} label="View Grant" />
        <LinkBtn href={customerHref(item)} label="View Customer" />
        {showJotform ? <LinkBtn href={jotformDigestHref(item)} label="Open Jotform Digest" /> : null}
        {showJotform ? <LinkBtn href={jotformDashboardHref(item)} label="Open Jotform Dashboard" /> : null}
        <LinkBtn href={budgetHref(item)} label="View Budget Tool" />
      </div>
    </DetailSection>
  );
}
