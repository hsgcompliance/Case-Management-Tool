"use client";

import React from "react";
import GrantWorkspaceModal from "@features/grants/GrantWorkspaceModal";
import { useGrant } from "@hooks/useGrants";
import { fmtCurrencyUSD } from "@lib/formatters";

type Props = {
  grantId: string | null | undefined;
  /** Additional projected spend from the current editing session (positive = more cost). */
  projectionDelta?: number;
  /** Optional per-line-item preview deltas. Positive means the edit increases projected/spent pressure. */
  lineItemDeltas?: Record<string, number>;
  className?: string;
};

const toCents = (value: unknown) => Math.round(Number(value || 0) * 100);
const fromCents = (cents: number) => cents / 100;

function Stat({
  label,
  value,
  delta = 0,
  warnNegative = false,
  bold = false,
}: {
  label: string;
  value: number | undefined | null;
  delta?: number;
  warnNegative?: boolean;
  bold?: boolean;
}) {
  if (value == null) return null;
  const adjusted = fromCents(toCents(value) + toCents(delta));
  const hasDelta = toCents(delta) !== 0;
  const isOverspend = warnNegative && adjusted < 0;

  return (
    <div
      className={`flex flex-col gap-0.5 rounded px-1.5 py-0.5 -mx-1.5 ${
        isOverspend ? "bg-rose-100 ring-1 ring-rose-200" : ""
      }`}
    >
      <span className="text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
      <span
        className={`text-xs ${bold ? "font-bold" : "font-medium"} ${
          isOverspend ? "text-rose-700" : hasDelta ? "text-amber-700" : "text-slate-700"
        }`}
      >
        {fmtCurrencyUSD(adjusted)}
        {hasDelta && (
          <span className={`ml-1 font-normal ${isOverspend ? "text-rose-400" : "text-slate-400"}`}>
            ({delta > 0 ? "+" : ""}{fmtCurrencyUSD(delta)})
          </span>
        )}
      </span>
    </div>
  );
}

function asRows(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((row): row is Record<string, unknown> => !!row && typeof row === "object" && !Array.isArray(row))
    : [];
}

function selectedInvoiceRows(value: unknown) {
  return asRows(value).filter((row) => row.enabled === true);
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  const text = String(value || "").trim();
  return text ? [text] : [];
}

function invoiceDocsFromGrant(grant: Record<string, unknown> | null | undefined): string[] {
  if (!grant) return [];
  const direct = stringList(grant.invoiceDocuments);
  if (direct.length) return direct;

  const legacyDetails = grant.details && typeof grant.details === "object"
    ? (grant.details as Record<string, unknown>)
    : {};
  const nested = stringList(legacyDetails.invoiceDocuments);
  if (nested.length) return nested;

  const dynamicKeys = ["Invoice Docs", "Invoice Documents"];
  for (const key of dynamicKeys) {
    const raw = grant[key];
    if (raw && typeof raw === "object" && !Array.isArray(raw) && "_value" in raw) {
      const rows = stringList((raw as Record<string, unknown>)._value);
      if (rows.length) return rows;
    }
    const rows = stringList(raw);
    if (rows.length) return rows;
  }
  return [];
}

export function GrantBudgetStrip({ grantId, projectionDelta = 0, lineItemDeltas, className }: Props) {
  const { data: grant, isLoading } = useGrant(grantId ?? undefined, { enabled: !!grantId });
  const [grantModalOpen, setGrantModalOpen] = React.useState(false);

  if (!grantId) return null;

  if (isLoading) {
    return (
      <div className={`animate-pulse rounded border border-slate-200 bg-slate-50 px-3 py-2.5 ${className ?? ""}`}>
        <div className="mb-1.5 h-2.5 w-32 rounded bg-slate-200" />
        <div className="flex gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-7 w-20 rounded bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  const totals = grant?.budget?.totals;
  const grantRecord = (grant || null) as Record<string, unknown> | null;
  const invoicing = grantRecord?.invoicing && typeof grantRecord.invoicing === "object"
    ? (grantRecord.invoicing as Record<string, unknown>)
    : {};
  const enabledCategories = selectedInvoiceRows(invoicing.expenseCategories);
  const enabledDescriptions = selectedInvoiceRows(invoicing.descriptionTemplates);
  const grantCode = String(invoicing.grantCode || "").trim();
  const functionalGroup = String(invoicing.functionalGroup || "").trim();
  const invoiceDocs = invoiceDocsFromGrant(grantRecord);
  const grantButton = (
    <button
      type="button"
      onClick={() => setGrantModalOpen(true)}
      className="text-left text-xs font-semibold text-slate-700 underline-offset-2 hover:text-sky-700 hover:underline"
    >
      {grant?.name || grantId}
    </button>
  );
  const grantModal = grantModalOpen ? (
    <GrantWorkspaceModal grantId={String(grantId)} onClose={() => setGrantModalOpen(false)} />
  ) : null;

  if (!totals) {
    return (
      <>
        <div className={`rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 ${className ?? ""}`}>
          {grantButton} <span className="text-slate-400">-</span> No budget totals available.
        </div>
        {grantModal}
      </>
    );
  }

  const projectedBalance =
    totals.projectedBalance ?? fromCents(toCents(totals.total) - toCents(totals.spent) - toCents(totals.projected));
  const adjustedBalance = fromCents(toCents(projectedBalance) - toCents(projectionDelta));
  const isOverspend = adjustedBalance < 0;
  const lineItems = Array.isArray(grant?.budget?.lineItems) ? grant.budget.lineItems : [];
  const visibleLineItemImpacts = Object.entries(lineItemDeltas || {})
    .filter(([, delta]) => Math.abs(Number(delta || 0)) >= 0.005)
    .map(([lineItemId, delta]) => {
      const li = lineItems.find((item: Record<string, unknown>) => String(item?.id || "") === lineItemId) as
        | Record<string, unknown>
        | undefined;
      const label = String(li?.label || li?.name || li?.title || li?.code || lineItemId);
      const projected = Number(li?.projected || 0);
      const spent = Number(li?.spent || 0);
      const cap = Number(li?.amount || 0);
      const after = fromCents(toCents(projected) + toCents(delta));
      return {
        lineItemId,
        label,
        delta: fromCents(toCents(delta)),
        after,
        overBy: Math.max(0, fromCents(toCents(spent) + toCents(after) - toCents(cap))),
      };
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 6);

  return (
    <>
      <div
        className={`rounded border px-3 py-2.5 ${
          isOverspend ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-slate-50"
        } ${className ?? ""}`}
      >
      <div className="mb-2 flex items-center justify-between">
        {grantButton}
        {isOverspend && (
          <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Overspend
          </span>
        )}
      </div>
      {(grantCode || functionalGroup || enabledCategories.length || enabledDescriptions.length || invoiceDocs.length) ? (
        <div className="mb-2 rounded border border-indigo-100 bg-white px-2 py-1.5 text-[11px] text-slate-600">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {grantCode ? <span><b>Grant Code:</b> <span className="font-mono">{grantCode}</span></span> : null}
            {functionalGroup ? <span><b>Group:</b> {functionalGroup}</span> : null}
            {enabledCategories.length ? (
              <span>
                <b>Categories:</b>{" "}
                {enabledCategories.slice(0, 3).map((row) => `${String(row.label || "")}${row.code ? ` (${String(row.code)})` : ""}`).join("; ")}
                {enabledCategories.length > 3 ? ` +${enabledCategories.length - 3}` : ""}
              </span>
            ) : null}
            {enabledDescriptions.length ? (
              <span>
                <b>Descriptions:</b>{" "}
                {enabledDescriptions.slice(0, 2).map((row) => String(row.template || row.label || "")).join("; ")}
                {enabledDescriptions.length > 2 ? ` +${enabledDescriptions.length - 2}` : ""}
              </span>
            ) : null}
            {invoiceDocs.length ? (
              <span>
                <b>Docs:</b> {invoiceDocs.slice(0, 4).join(", ")}{invoiceDocs.length > 4 ? ` +${invoiceDocs.length - 4}` : ""}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-x-8 gap-y-2 justify-evenly">
        <Stat label="Budget" value={totals.total} />
        <Stat label="Spent" value={totals.spent} />
        <Stat label="Projected" value={totals.projected} delta={projectionDelta} />
        <Stat
          label="Proj. Remaining"
          value={projectedBalance}
          delta={-projectionDelta}
          warnNegative
          bold
        />
        {totals.balance != null && <Stat label="Balance" value={totals.balance} />}
      </div>
      {visibleLineItemImpacts.length ? (
        <div className="mt-2 border-t border-slate-200 pt-2">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Line item impact
          </div>
          <div className="grid gap-1 text-xs md:grid-cols-2">
            {visibleLineItemImpacts.map((item) => (
              <div
                key={item.lineItemId}
                className={`flex items-center justify-between gap-3 rounded px-2 py-1 ${
                  item.overBy > 0 ? "bg-rose-100 text-rose-800" : "bg-white text-slate-700"
                }`}
              >
                <span className="min-w-0 truncate" title={item.lineItemId}>{item.label}</span>
                <span className="shrink-0 font-medium">
                  {item.delta > 0 ? "+" : ""}{fmtCurrencyUSD(item.delta)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      </div>
      {grantModal}
    </>
  );
}

export default GrantBudgetStrip;
