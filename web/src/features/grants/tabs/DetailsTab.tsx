// src/features/grants/tabs/DetailsTab.tsx
"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { fmtMDY, parseISO10, safeISODate10, toISODate, addYears, addDays } from "@lib/date";
import {
  DynamicFieldsEditor,
  META_KEYS,
  readEnvelope,
  PRIORITY_ORDER,
  PRIORITY_META,
  type Priority,
} from "@entities/ui/DynamicFormFields";
import type { TGrant as Grant } from "@types";
import { GrantMetricCards } from "@entities/metrics/cards/GrantMetricCards";
import { GRANT_ACCENT_COLORS, type GrantAccentColor, grantAccentChip, grantAccentSolid } from "@lib/colorRegistry";
import { parseGrantMaxAssistanceMonths } from "@hdb/contracts";
import { grantDriveTemplates, inferDriveTemplateType, parseDriveFileId } from "../driveTemplates";
import {
  EnrollmentControlsEditor,
  EnrollmentControlsSummary,
  LEGACY_COMPLIANCE_CONFIG,
} from "../EnrollmentControlsEditor";

function normalizeEligibility(value: unknown): Record<string, string> {
  if (!value) return {};
  if (typeof value === "string") {
    const text = value.trim();
    return text ? { Notes: text } : {};
  }
  if (typeof value !== "object" || Array.isArray(value)) return {};

  return Object.entries(value as Record<string, unknown>).reduce(
    (acc: Record<string, string>, [key, raw]) => {
      const nextKey = String(key || "").trim();
      const nextValue = String(raw ?? "").trim();
      if (!nextKey || !nextValue) return acc;
      acc[nextKey] = nextValue;
      return acc;
    },
    {},
  );
}

function eligibilityDraftObject(value: unknown): Record<string, string> {
  if (!value) return {};
  if (typeof value === "string") {
    const text = value.trim();
    return text ? { Notes: text } : {};
  }
  if (typeof value !== "object" || Array.isArray(value)) return {};

  return Object.entries(value as Record<string, unknown>).reduce(
    (acc: Record<string, string>, [key, raw]) => {
      const nextKey = String(key || "").trim();
      if (!nextKey) return acc;
      acc[nextKey] = String(raw ?? "");
      return acc;
    },
    {},
  );
}

const RENTAL_ASSISTANCE_TAG = "rental-assistance";

const FINANCIAL_MODEL_PRESETS = {
  budgeted: {
    model: "budgeted",
    budgetEnabled: true,
    billingEnabled: false,
    allocationEnabled: false,
    ledgerEnabled: true,
    ledgerMode: "spendDown",
  },
  billable: {
    model: "billable",
    budgetEnabled: false,
    billingEnabled: true,
    allocationEnabled: true,
    ledgerEnabled: true,
    ledgerMode: "billing",
  },
  serviceOnly: {
    model: "serviceOnly",
    budgetEnabled: false,
    billingEnabled: false,
    allocationEnabled: false,
    ledgerEnabled: false,
    ledgerMode: "none",
  },
} as const;

type FinancialModel = keyof typeof FINANCIAL_MODEL_PRESETS;

const FINANCIAL_MODEL_COPY: Record<FinancialModel, { title: string; body: string }> = {
  budgeted: {
    title: "Budgeted spend-down",
    body: "Line-item amounts are real allocations and drive budget remaining math.",
  },
  billable: {
    title: "Billable ledger",
    body: "Line items are billing/allocation categories, not hard budget caps.",
  },
  serviceOnly: {
    title: "Service only",
    body: "No budget, billing, allocation, or ledger workspace for this record.",
  },
};

function emptyBudget() {
  return { total: 0, lineItems: [] };
}

function financialModelOf(model: Record<string, any>, grant: Grant | null): FinancialModel {
  const raw = String((model.financialConfig ?? grant?.financialConfig ?? {})?.model || "").trim();
  if (raw === "budgeted" || raw === "billable" || raw === "serviceOnly") return raw;
  return String(model.kind ?? grant?.kind ?? "grant") === "program" ? "serviceOnly" : "budgeted";
}

// ── Pin system ────────────────────────────────────────────────────────────────

const PIN_COLORS = GRANT_ACCENT_COLORS;
type PinColor = GrantAccentColor;

function pinColorChipCls(color: string | null | undefined): string {
  return grantAccentChip(color);
}

function pinColorDotCls(color: string | null | undefined): string {
  return grantAccentSolid(color);
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((tag) => String(tag || "").trim()).filter(Boolean);
}

function hasRentalAssistanceTag(value: unknown): boolean {
  return normalizeTags(value).some((tag) => tag.toLowerCase() === RENTAL_ASSISTANCE_TAG);
}

type InvoiceOption = {
  id: string;
  label: string;
  code?: string;
  template?: string;
  enabled?: boolean;
  custom?: boolean;
};

const DEFAULT_EXPENSE_CATEGORIES: InvoiceOption[] = [
  { id: "housing-non-hrdc", label: "Housing Assistance (non-HRDC Property)", code: "UNR-9520-300-00" },
  { id: "housing-hrdc", label: "Housing Assistance (HRDC Property)", code: "UNR-9960-300-00" },
  { id: "deposit", label: "Deposit Assistance", code: "UNR-9545-300-00" },
  { id: "preventative-arrears", label: "Preventative Arrears", code: "UNR-9548-300-00" },
  { id: "personal-needs", label: "Personal Needs", code: "UNR-5607-300-00" },
  { id: "utility", label: "Utility Assistance", code: "UNR-8510-300-00" },
];

const DEFAULT_DESCRIPTION_TEMPLATES: InvoiceOption[] = [
  { id: "rental-assistance", label: "Rental Assistance", template: "J. Doe: March RA" },
  { id: "prorated-rental-assistance", label: "Prorated Rental Assistance", template: "J. Doe: Feb Prorated Rent" },
  { id: "deposit-assistance", label: "Deposit Assistance", template: "J. Doe: DA" },
  { id: "utility-assistance", label: "Utility Assistance", template: "J. Doe: March Util Assistance" },
];

function listFromUnknown(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  const text = String(value || "").trim();
  return text ? [text] : [];
}

function invoiceDocumentsFrom(row: Record<string, any> | null | undefined): string[] {
  if (!row) return [];
  const direct = listFromUnknown(row.invoiceDocuments);
  if (direct.length) return direct;
  const details = row.details && typeof row.details === "object" ? row.details as Record<string, unknown> : {};
  const nested = listFromUnknown(details.invoiceDocuments);
  if (nested.length) return nested;
  for (const key of ["Invoice Docs", "Invoice Documents"]) {
    const raw = row[key];
    if (raw && typeof raw === "object" && !Array.isArray(raw) && "_value" in raw) {
      const docs = listFromUnknown((raw as Record<string, unknown>)._value);
      if (docs.length) return docs;
    }
    const docs = listFromUnknown(raw);
    if (docs.length) return docs;
  }
  return [];
}

function levelOfAssistanceFrom(row: Record<string, any> | null | undefined): Record<string, string> {
  if (!row) return {};
  const candidates = [
    row.levelOfAssistance,
    row["Level of Assistance"],
    row.details?.levelOfAssistanceEligibility,
  ];
  for (const candidate of candidates) {
    const raw = candidate && typeof candidate === "object" && !Array.isArray(candidate) && "_value" in candidate
      ? (candidate as Record<string, unknown>)._value
      : candidate;
    const normalized = eligibilityDraftObject(raw);
    if (Object.keys(normalized).length) return normalized;
  }
  return {};
}

function grantMaxLengthFrom(row: Record<string, any> | null | undefined): string {
  if (!row) return "";
  const months = parseGrantMaxAssistanceMonths(row.maxAssistanceMonths);
  if (months) return `${months} months`;
  const direct = String(row.lengthOfAssistance ?? row.maxLengthOfAssistance ?? row.maximumLengthOfAssistance ?? "").trim();
  if (direct) return direct;
  const dynamic = row["Maximum Length of Assistance"];
  if (dynamic && typeof dynamic === "object" && !Array.isArray(dynamic) && "_value" in dynamic) {
    return String((dynamic as Record<string, unknown>)._value || "").trim();
  }
  return String(row.details?.maximumLengthOfAssistance || "").trim();
}

function grantMaxMonthsFrom(row: Record<string, any> | null | undefined): string {
  if (!row) return "";
  const months =
    parseGrantMaxAssistanceMonths(row.maxAssistanceMonths) ??
    parseGrantMaxAssistanceMonths(grantMaxLengthFrom(row));
  return months ? String(months) : "";
}

function maxAssistanceInputValue(model: Record<string, any>, grant: Record<string, any> | null | undefined): string {
  if (Object.prototype.hasOwnProperty.call(model, "maxAssistanceMonths")) {
    return model.maxAssistanceMonths == null ? "" : String(model.maxAssistanceMonths);
  }
  return grantMaxMonthsFrom(grant);
}

function maxAssistancePatchFromInput(raw: string): { maxAssistanceMonths: number | null; lengthOfAssistance: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { maxAssistanceMonths: null, lengthOfAssistance: null };
  const months = parseGrantMaxAssistanceMonths(trimmed);
  return {
    maxAssistanceMonths: months,
    lengthOfAssistance: months ? `${months} months` : null,
  };
}

function asInvoiceOptions(value: unknown): InvoiceOption[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is Record<string, unknown> => !!row && typeof row === "object" && !Array.isArray(row))
    .map((row, index) => ({
      id: String(row.id || row.label || `invoice_${index}`),
      label: String(row.label || ""),
      code: row.code == null ? undefined : String(row.code),
      template: row.template == null ? undefined : String(row.template),
      enabled: row.enabled === true,
      custom: row.custom === true,
    }))
    .filter((row) => row.id && row.label);
}

function mergeInvoiceOptions(defaults: InvoiceOption[], saved: unknown): InvoiceOption[] {
  const savedRows = asInvoiceOptions(saved);
  const byId = new Map(savedRows.map((row) => [row.id, row]));
  const defaultRows = defaults.map((row) => ({ ...row, ...(byId.get(row.id) || {}) }));
  const customRows = savedRows.filter((row) => row.custom && !defaults.some((def) => def.id === row.id));
  return [...defaultRows, ...customRows];
}

function invoiceText(value: unknown): string {
  return String(value ?? "").trim();
}

const PROMOTED_DETAIL_KEYS = [
  "orgId",
  "kind",
  "deleted",
  "active",
  "_tags",
  "meta",
  "metrics",
  "system",
  "pins",
  "taskTypes",
  "tasks",
  "tags",
  "eligibility",
  "levelOfAssistanceEligibility",
  "services",
  "lengthOfAssistance",
  "maximumLengthOfAssistance",
  "maximumAssistance",
  "description",
  "invoicing",
  "linking",
  "invoiceDocuments",
  "levelOfAssistance",
  "servicesOffered",
  "duration",
  "maxAmount",
  "maximumAmount",
  "maxAssistanceAmount",
  "Invoice Docs",
  "Invoice Documents",
  "Level of Assistance",
  "Maximum Length of Assistance",
];

const PROMOTED_DETAIL_KEY_SET = new Set(PROMOTED_DETAIL_KEYS);

function InvoiceInfoPanel({ value, invoiceDocuments = [] }: { value: unknown; invoiceDocuments?: string[] }) {
  const inv = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const grantCode = invoiceText(inv.grantCode);
  const functionalGroup = invoiceText(inv.functionalGroup || "Housing");
  const categories = asInvoiceOptions(inv.expenseCategories).filter((row) => row.enabled);
  const descriptions = asInvoiceOptions(inv.descriptionTemplates).filter((row) => row.enabled);

  if (!grantCode && categories.length === 0 && descriptions.length === 0 && invoiceDocuments.length === 0) return null;

  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Invoice Info</div>
        {functionalGroup ? (
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
            {functionalGroup}
          </span>
        ) : null}
      </div>
      <div className="space-y-4">
        {grantCode ? (
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Grant Code</div>
            <div className="mt-1 font-mono text-sm text-slate-800">{grantCode}</div>
          </div>
        ) : null}
        {categories.length ? (
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Expense Categories</div>
            <div className="grid gap-2 md:grid-cols-2">
              {categories.map((row) => (
                <div key={row.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-sm font-medium text-slate-800">{row.label}</div>
                  <div className="mt-0.5 font-mono text-xs text-slate-500">{row.code || "-"}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {descriptions.length ? (
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Description Templates</div>
            <div className="grid gap-2 md:grid-cols-2">
              {descriptions.map((row) => (
                <div key={row.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div className="text-sm font-medium text-slate-800">{row.label}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{row.template || "-"}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {invoiceDocuments.length ? (
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Invoice Docs</div>
            <div className="flex flex-wrap gap-1.5">
              {invoiceDocuments.map((doc) => (
                <span key={doc} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
                  {doc}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function InvoiceInfoEditor({
  model,
  setModel,
}: {
  model: Record<string, any>;
  setModel: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}) {
  const inv = ((model.invoicing && typeof model.invoicing === "object") ? model.invoicing : {}) as Record<string, unknown>;
  const categories = mergeInvoiceOptions(DEFAULT_EXPENSE_CATEGORIES, inv.expenseCategories);
  const descriptions = mergeInvoiceOptions(DEFAULT_DESCRIPTION_TEMPLATES, inv.descriptionTemplates);

  const setInv = (patch: Record<string, unknown>) => {
    setModel((m) => ({ ...m, invoicing: { ...((m.invoicing || {}) as Record<string, unknown>), ...patch } }));
  };

  const setCategory = (id: string, patch: Partial<InvoiceOption>) => {
    setInv({ expenseCategories: categories.map((row) => (row.id === id ? { ...row, ...patch } : row)) });
  };

  const setDescription = (id: string, patch: Partial<InvoiceOption>) => {
    setInv({ descriptionTemplates: descriptions.map((row) => (row.id === id ? { ...row, ...patch } : row)) });
  };

  const addCustomCategory = () => {
    const id = `custom_${Date.now().toString(36)}`;
    setInv({
      expenseCategories: [
        ...categories,
        { id, label: "Other Category", code: "", enabled: true, custom: true },
      ],
    });
  };

  const removeCustomCategory = (id: string) => {
    setInv({ expenseCategories: categories.filter((row) => row.id !== id) });
  };

  return (
    <div className="space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
      <div>
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Invoice Info</div>
        <p className="mt-1 text-xs text-slate-500">
          Select the values this grant should surface in payment and invoice workflows.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-500">Functional Group</span>
          <input
            className="input w-full"
            value={String(inv.functionalGroup ?? "Housing")}
            onChange={(e) => setInv({ functionalGroup: e.currentTarget.value })}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-500">Grant Code</span>
          <input
            className="input w-full font-mono"
            placeholder="#237"
            value={String(inv.grantCode ?? "")}
            onChange={(e) => setInv({ grantCode: e.currentTarget.value })}
          />
        </label>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Expense Category</div>
          <button type="button" className="btn btn-secondary btn-xs" onClick={addCustomCategory}>
            Add Other
          </button>
        </div>
        <div className="space-y-2">
          {categories.map((row) => (
            <div key={row.id} className="grid gap-2 rounded-lg border border-slate-200 bg-white p-2 md:grid-cols-[auto_minmax(180px,1fr)_minmax(150px,220px)_auto]">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                  checked={row.enabled === true}
                  onChange={(e) => setCategory(row.id, { enabled: e.currentTarget.checked })}
                />
              </label>
              <input
                className="input h-8 text-sm"
                value={row.label}
                readOnly={!row.custom}
                onChange={(e) => setCategory(row.id, { label: e.currentTarget.value })}
              />
              <input
                className="input h-8 font-mono text-xs"
                value={row.code || ""}
                placeholder="UNR-0000-000-00"
                onChange={(e) => setCategory(row.id, { code: e.currentTarget.value })}
              />
              {row.custom ? (
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => removeCustomCategory(row.id)}>
                  Remove
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</div>
        <div className="space-y-2">
          {descriptions.map((row) => (
            <div key={row.id} className="grid gap-2 rounded-lg border border-slate-200 bg-white p-2 md:grid-cols-[auto_minmax(150px,220px)_1fr]">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                  checked={row.enabled === true}
                  onChange={(e) => setDescription(row.id, { enabled: e.currentTarget.checked })}
                />
              </label>
              <div className="flex items-center text-sm font-medium text-slate-700">{row.label}</div>
              <input
                className="input h-8 text-sm"
                value={row.template || ""}
                onChange={(e) => setDescription(row.id, { template: e.currentTarget.value })}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** normalize to either "" or YYYY-MM-DD (string) — only use on COMMIT */
const toISOOrEmpty = (x: any): string => {
  if (!x) return "";
  if (typeof x === "string") {
    const d = parseISO10(x) ?? new Date(x);
    return Number.isNaN(d.getTime()) ? "" : toISODate(d);
  }
  if (x instanceof Date) return toISODate(x);
  if (typeof x === "number") return toISODate(x);
  if (x && typeof x.toMillis === "function") return toISODate(x.toMillis());
  if (x && (x._seconds != null)) {
    const ms = x._seconds * 1000 + Math.floor((x._nanoseconds ?? 0) / 1e6);
    return toISODate(ms);
  }
  return "";
};

const iso10 = (s: string) => safeISODate10(s) || "";

function useBufferedField(ext: string, label: string) {
  const [buf, setBuf] = useState<string>(ext ?? "");
  const focused = useRef(false);

  // resync only when not focused, to avoid clobbering while typing
  useEffect(() => {
    if (!focused.current) {
      if ((ext ?? "") !== buf) {
        console.debug(`[DetailsTab] resync ${label}`, { from: buf, to: ext ?? "" });
        setBuf(ext ?? "");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ext]);

  const onFocus = () => (focused.current = true);
  const onBlurFlag = () => (focused.current = false);

  return { buf, setBuf, onFocus, onBlurFlag };
}

function PromotedField({
  label,
  fieldKey,
  multiline,
  editing,
  model,
  setModel,
  grant,
}: {
  label: string;
  fieldKey: string;
  multiline?: boolean;
  editing: boolean;
  model: Record<string, any>;
  setModel: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  grant: Record<string, any> | null;
}) {
  const value = String(model[fieldKey] ?? (grant as any)?.[fieldKey] ?? "");
  if (!editing && !value) return null;
  return (
    <div className="text-sm">
      <div className="text-slate-500 dark:text-slate-400">{label}</div>
      {editing ? (
        multiline ? (
          <textarea
            className="input w-full"
            rows={3}
            value={value}
            onChange={(e) => { const v = e.currentTarget.value; setModel((m) => ({ ...m, [fieldKey]: v })); }}
          />
        ) : (
          <input
            className="input"
            type="text"
            value={value}
            onChange={(e) => { const v = e.currentTarget.value; setModel((m) => ({ ...m, [fieldKey]: v })); }}
          />
        )
      ) : (
        <div
          className={[
            "whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 text-slate-800",
            multiline ? "min-h-[88px] px-4 py-3" : "px-3 py-2",
          ].join(" ")}
        >
        <div className="whitespace-pre-wrap">{value || "—"}</div>
        </div>
      )}
    </div>
  );
}

// ── Compact structured grant-info fields ─────────────────────────────────────

function FieldBlock({
  label,
  empty,
  children,
}: {
  label: string;
  empty: boolean;
  children?: React.ReactNode;
}) {
  if (empty) return null;
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      {children}
    </div>
  );
}

function ServicesOfferedDisplay({ value }: { value: unknown }) {
  const items = Array.isArray(value)
    ? value.map((v) => String(v)).filter(Boolean)
    : typeof value === "string" && value.trim()
      ? [value]
      : [];
  if (items.length === 0) return null;
  return (
    <ul className="ml-3 space-y-0.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-slate-800">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function EligibilityDisplay({ value }: { value: unknown }) {
  const entries = Object.entries(normalizeEligibility(value));
  if (entries.length === 0) return null;
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      {entries.map(([k, v]) => (
        <React.Fragment key={k}>
          <span className="font-medium text-slate-600">{k}</span>
          <span className="text-slate-800">{String(v)}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

function KeyValueRecommendedEditor({
  title,
  description,
  value,
  onChange,
  onDelete,
}: {
  title: string;
  description?: string;
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  onDelete?: () => void;
}) {
  const rows = Object.entries(value);
  const commit = (next: Record<string, string>) => {
    const cleaned = Object.entries(next).reduce((acc: Record<string, string>, [key, raw]) => {
      const k = String(key || "").trim();
      if (!k) return acc;
      acc[k] = String(raw ?? "");
      return acc;
    }, {});
    onChange(cleaned);
  };
  const addRow = () => {
    let idx = rows.length + 1;
    let key = `Item ${idx}`;
    while (value[key] != null) {
      idx += 1;
      key = `Item ${idx}`;
    }
    commit({ ...value, [key]: "" });
  };
  const remove = (key: string) => {
    const next = { ...value };
    delete next[key];
    commit(next);
  };
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-800">{title}</div>
          {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
        </div>
        {onDelete ? <button type="button" className="btn btn-ghost btn-xs text-red-600" onClick={onDelete}>Delete field</button> : null}
      </div>
      {rows.length ? (
        <div className="space-y-2">
          {rows.map(([key, val]) => (
          <div key={key} className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(180px,240px)_1fr_auto]">
            <input
              className="input"
              defaultValue={key}
              onBlur={(e) => {
                const nextKey = e.currentTarget.value.trim();
                if (!nextKey || nextKey === key) return;
                const next = { ...value };
                next[nextKey] = next[key] ?? "";
                delete next[key];
                commit(next);
              }}
            />
            <input
              className="input"
              value={val}
              onChange={(e) => {
                commit({ ...value, [key]: e.currentTarget.value });
              }}
            />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(key)}>
              Remove
            </button>
          </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-500">
          No rows configured.
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary btn-sm" onClick={addRow}>
          Add Row
        </button>
      </div>
    </div>
  );
}

function ListRecommendedEditor({
  title,
  description,
  value,
  onChange,
  onDelete,
}: {
  title: string;
  description?: string;
  value: string[];
  onChange: (next: string[]) => void;
  onDelete?: () => void;
}) {
  const rows = value;
  const commit = (next: string[]) => onChange(next.map((item) => String(item || "").trim()).filter(Boolean));
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-800">{title}</div>
          {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
        </div>
        {onDelete ? <button type="button" className="btn btn-ghost btn-xs text-red-600" onClick={onDelete}>Delete field</button> : null}
      </div>
      {rows.length ? (
        <div className="space-y-2">
          {rows.map((doc, index) => (
          <div key={`${doc}:${index}`} className="grid grid-cols-[1fr_auto] gap-2">
            <input
              className="input"
              value={doc}
              onChange={(e) => {
                const next = [...rows];
                next[index] = e.currentTarget.value;
                commit(next);
              }}
            />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => commit(rows.filter((_, i) => i !== index))}>
              Remove
            </button>
          </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-500">
          No documents configured.
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => commit([...rows, ""])}>
          Add Document
        </button>
      </div>
    </div>
  );
}

function RecommendedGrantInfoEditor({
  model,
  setModel,
  grant,
}: {
  model: Record<string, any>;
  setModel: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  grant: Record<string, any> | null;
}) {
  const kind = String(model.kind ?? grant?.kind ?? "grant");
  const isGrant = kind !== "program";
  const eligibility = eligibilityDraftObject(model.eligibility ?? grant?.eligibility);
  const level = levelOfAssistanceFrom((Object.keys(model || {}).length ? model : grant) as Record<string, any> | null);
  const invoiceDocuments = invoiceDocumentsFrom((Object.keys(model || {}).length ? model : grant) as Record<string, any> | null);
  const duration = String(model.duration ?? grant?.duration ?? "");
  const maxLength = maxAssistanceInputValue(model, grant);
  const [hiddenFields, setHiddenFields] = useState<Set<string>>(() => new Set());
  const hideField = (field: string, clear: () => void) => {
    clear();
    setHiddenFields((current) => new Set(current).add(field));
  };
  const restoreField = (field: string) => {
    setHiddenFields((current) => {
      const next = new Set(current);
      next.delete(field);
      return next;
    });
  };

  return (
    <div className="md:col-span-2 space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-500">Duration</span>
          <input
            className="input w-full"
            value={duration}
            placeholder={isGrant ? "1 Year" : ""}
            onChange={(e) => setModel((m) => ({ ...m, duration: e.currentTarget.value }))}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-500">Max Length of Assistance</span>
          <input
            className="input w-full"
            type="number"
            min={1}
            max={240}
            step={1}
            value={maxLength}
            placeholder={isGrant ? "18" : ""}
            onChange={(e) => {
              const patch = maxAssistancePatchFromInput(e.currentTarget.value);
              setModel((m) => ({ ...m, ...patch }));
            }}
          />
        </label>
      </div>

      {!hiddenFields.has("eligibility") ? (
        <KeyValueRecommendedEditor
          title="Eligibility Criteria"
          description="Optional criteria for this grant."
          value={eligibility}
          onChange={(next) => setModel((m) => ({ ...m, eligibility: next }))}
          onDelete={() => hideField("eligibility", () => setModel((m) => ({ ...m, eligibility: {} })))}
        />
      ) : null}

      {!hiddenFields.has("levelOfAssistance") ? (
        <KeyValueRecommendedEditor
          title="Level of Assistance"
          description="Optional internal guidance for what assistance level is expected."
          value={level}
          onChange={(next) => setModel((m) => ({ ...m, levelOfAssistance: next }))}
          onDelete={() => hideField("levelOfAssistance", () => setModel((m) => ({ ...m, levelOfAssistance: {} })))}
        />
      ) : null}

      {!hiddenFields.has("invoiceDocuments") ? (
        <ListRecommendedEditor
          title="Invoice Docs"
          description="Optional documents expected before payment or invoice processing."
          value={invoiceDocuments}
          onChange={(next) => setModel((m) => ({ ...m, invoiceDocuments: next }))}
          onDelete={() => hideField("invoiceDocuments", () => setModel((m) => ({ ...m, invoiceDocuments: [] })))}
        />
      ) : null}

      {hiddenFields.size ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-3">
          <span className="text-xs font-medium text-slate-500">Add optional field:</span>
          {hiddenFields.has("eligibility") ? <button type="button" className="btn btn-secondary btn-xs" onClick={() => restoreField("eligibility")}>Eligibility Criteria</button> : null}
          {hiddenFields.has("levelOfAssistance") ? <button type="button" className="btn btn-secondary btn-xs" onClick={() => restoreField("levelOfAssistance")}>Level of Assistance</button> : null}
          {hiddenFields.has("invoiceDocuments") ? <button type="button" className="btn btn-secondary btn-xs" onClick={() => restoreField("invoiceDocuments")}>Invoice Docs</button> : null}
        </div>
      ) : null}
    </div>
  );
}

function GrantInfoPanel({
  model,
  grant,
}: {
  model: Record<string, any>;
  grant: Record<string, any> | null;
}) {
  const g = (grant ?? model) as Record<string, any>;

  const startDate     = String(g.startDate   || "").slice(0, 10);
  const endDate       = String(g.endDate     || "").slice(0, 10);
  const duration      = String(g.duration || "").trim();
  const description   = String(g.description || "").trim();
  const maxLen        = grantMaxLengthFrom(g);
  const services      = g.servicesOffered;
  const eligibility   = g.eligibility;
  const levelRows     = Object.entries(levelOfAssistanceFrom(g));
  const invoiceDocs   = invoiceDocumentsFrom(g);
  const financialModel = financialModelOf(g, g as Grant);
  const financialConfig = (g.financialConfig ?? FINANCIAL_MODEL_PRESETS[financialModel]) as Record<string, unknown>;
  const authorizationMonths = Number(g.enrollmentDefaults?.authorizationMonths || 0);

  const hasServices   = Array.isArray(services) ? services.length > 0 : !!services;
  const hasEligibility = Object.keys(normalizeEligibility(eligibility)).length > 0;

  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-5 space-y-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Grant Info</div>

      {/* Dates row — always shown */}
      <div className="flex flex-wrap gap-4">
        <div>
          <div className="text-xs text-slate-400 mb-0.5">Start Date</div>
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {startDate ? fmtMDY(startDate) : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400 mb-0.5">End Date</div>
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {endDate ? fmtMDY(endDate) : "—"}
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_1.35fr]">
        <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Financial model</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {financialModel === "budgeted" ? "Budgeted spend-down" : financialModel === "billable" ? "Billable ledger" : "Service only"}
          </div>
          <div className="mt-1 text-xs text-slate-600">
            {financialModel === "budgeted"
              ? "Line-item amounts are spend-down allocations."
              : financialModel === "billable"
                ? `Billing and allocation enabled; ledger mode ${String(financialConfig.ledgerMode || "billing")}.`
                : "Budget, billing, allocation, and ledger activity are off."}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Enrollment controls</div>
            {authorizationMonths > 0 ? (
              <span className="text-xs font-semibold text-slate-600">Default authorization: {authorizationMonths} months</span>
            ) : null}
          </div>
          <div className="mt-2">
            <EnrollmentControlsSummary value={g.complianceConfig} />
          </div>
        </div>
      </div>

      {/* Description */}
      <FieldBlock label="Description" empty={!description}>
        {description && <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{description}</p>}
      </FieldBlock>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <FieldBlock label="Duration" empty={!duration}>
            {duration && <span className="text-sm font-semibold text-slate-900">{duration}</span>}
          </FieldBlock>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <FieldBlock label="Max Length" empty={!maxLen}>
            {maxLen && <span className="text-sm font-semibold text-slate-900">{maxLen}</span>}
          </FieldBlock>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3">
          <FieldBlock label="Services Offered" empty={!hasServices}>
            <ServicesOfferedDisplay value={services} />
          </FieldBlock>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr]">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
          <FieldBlock label="Eligibility" empty={!hasEligibility}>
            <EligibilityDisplay value={eligibility} />
          </FieldBlock>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
          <FieldBlock label="Level of Assistance" empty={!levelRows.length}>
            {levelRows.length ? (
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                {levelRows.map(([key, value]) => (
                  <React.Fragment key={key}>
                    <span className="font-medium text-slate-600">{key}</span>
                    <span className="text-slate-800">{String(value)}</span>
                  </React.Fragment>
                ))}
              </div>
            ) : null}
          </FieldBlock>
        </div>
      </div>

      <InvoiceInfoPanel value={g.invoicing} invoiceDocuments={invoiceDocs} />
    </div>
  );
}

export function DetailsTab({
  editing,
  model,
  setModel,
  grant,
  dynamicValue,
  readInput,
  readSelect,
  canEditKind,
  onRequestKindChange,
  STATUS_OPTS,
}: {
  editing: boolean;
  model: Record<string, any>;
  setModel: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  grant: Grant | null;
  dynamicValue: Record<string, any>;
  readInput: (e: React.ChangeEvent<HTMLInputElement>) => string;
  readSelect: (e: React.ChangeEvent<HTMLSelectElement>) => string;
  canEditKind: boolean;
  onRequestKindChange: (nextKind: "grant" | "program") => void;
  STATUS_OPTS: readonly string[];
  derived?: { total: number; spent: number; projected: number; balance: number; projectedBalance: number } | null;
  showBudgetStrip?: boolean;
  currency?: (n: number) => string;
}) {
  // external canonical values (used for initial buffer + read mode)
  const extName = String(model.name ?? "");
  const extStart = String(model.startDate ?? ""); // DO NOT normalize every render
  const extEnd = String(model.endDate ?? "");

  // buffers
  const nameB = useBufferedField(extName, "name");
  const startB = useBufferedField(extStart, "startDate");
  const endB = useBufferedField(extEnd, "endDate");

  // commits (normalize on commit)
  const commitName = useCallback(() => {
    const next = nameB.buf;
    console.debug("[DetailsTab] commit name ->", next);
    setModel((m) => (m?.name === next ? m : { ...m, name: next }));
  }, [nameB.buf, setModel]);

  const commitStart = useCallback(() => {
    const raw = iso10(startB.buf);
    const iso = toISOOrEmpty(raw);
    console.debug("[DetailsTab] commit startDate ->", { raw, iso });
    setModel((m) => ({ ...m, startDate: iso || null }));
  }, [startB.buf, setModel]);

  const commitEnd = useCallback(() => {
    const raw = iso10(endB.buf);
    const iso = toISOOrEmpty(raw);
    console.debug("[DetailsTab] commit endDate ->", { raw, iso });
    setModel((m) => ({ ...m, endDate: iso || null }));
  }, [endB.buf, setModel]);

  const onStatus = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const v = readSelect(e);
      console.debug("[DetailsTab] status ->", v);
      setModel((m) => ({ ...m, status: v, active: v === "active" }));
    },
    [readSelect, setModel]
  );

  const statusVal = String((grant?.status ?? model?.status ?? "draft") || "draft");
  const kindVal = String(model?.kind || grant?.kind || "grant");
  const isGrantKind = kindVal !== "program";
  const financialModel = financialModelOf(model, grant);
  const financialConfig = (model.financialConfig ?? grant?.financialConfig ?? FINANCIAL_MODEL_PRESETS[financialModel]) as Record<string, any>;
  const hasFinancialActivity = financialModel !== "serviceOnly";
  const complianceConfig = model.complianceConfig ?? grant?.complianceConfig ?? LEGACY_COMPLIANCE_CONFIG;
  const driveTemplates = grantDriveTemplates((model ?? grant) as Record<string, unknown>);
  const updateDriveTemplate = (index: number, patch: Record<string, unknown>) => {
    setModel((m) => {
      const rows = grantDriveTemplates((m ?? grant) as Record<string, unknown>).map((row) => ({ ...row }));
      rows[index] = { ...rows[index], ...patch } as any;
      const normalized = rows
        .map((row, idx) => {
          const fileUrl = String(row.fileUrl || "").trim();
          const fileId = String(row.fileId || parseDriveFileId(fileUrl)).trim();
          const label = String(row.label || "").trim();
          if (!fileId && !fileUrl && !label) return null;
          return {
            ...row,
            key: String(row.key || fileId || `template_${idx + 1}`).trim(),
            label: label || `Template ${idx + 1}`,
            fileId,
            fileUrl: fileUrl || null,
            type: inferDriveTemplateType(fileUrl || row.type),
            defaultChecked: row.defaultChecked !== false,
          };
        })
        .filter(Boolean);
      return { ...m, driveTemplates: normalized };
    });
  };
  const onFinancialModel = useCallback(
    (nextModel: FinancialModel) => {
      const financialConfig = FINANCIAL_MODEL_PRESETS[nextModel];
      setModel((m) => ({
        ...m,
        financialConfig,
        ...(nextModel === "serviceOnly" ? { budget: { total: 0, lineItems: [] } } : {}),
        ...(nextModel === "serviceOnly" ? {} : { budget: m?.budget ?? grant?.budget ?? emptyBudget() }),
      }));
    },
    [grant, setModel],
  );
  const rentalAssistanceTagged = hasRentalAssistanceTag(model.tags ?? grant?.tags);
  const additionalFieldCount = Object.keys(dynamicValue || {}).length;
  const [advancedOpen, setAdvancedOpen] = useState(additionalFieldCount > 0);

  const STATUS_CHIP: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300",
    draft: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300",
    closed: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400",
  };

  return (
    <>
      {/* ── View mode: metrics + grant info ──────────────────────────── */}
      {!editing && (
        <div className="mt-4 space-y-4">
          {/* Kind + Status chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-sky-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-sky-600 dark:bg-sky-900/40 dark:text-sky-400">
              {kindVal === "program" ? "Program" : "Grant"}
            </span>
            <span className={`rounded-md border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${STATUS_CHIP[statusVal] ?? STATUS_CHIP.draft}`}>
              {statusVal}
            </span>
            {isGrantKind && rentalAssistanceTagged ? (
              <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                Rental Assistance
              </span>
            ) : null}
            {/* Important Pin badge */}
            {!!(grant as any)?.pins?.important?.enabled && (
              <span
                className={`rounded-md border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${pinColorChipCls((grant as any).pins.important.color)}`}
                title={(grant as any).pins.important.note || undefined}
              >
                {(grant as any).pins.important.label || "Important"}
              </span>
            )}
            {/* Digest Pin badge */}
            {!!(grant as any)?.pins?.digest?.enabled && (
              <span className="rounded-md border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-sky-700">
                Digest
              </span>
            )}
            {/* Invoice Pin badge */}
            {!!(grant as any)?.pins?.invoice?.enabled && (
              <span
                className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-indigo-700"
                title={(grant as any).pins.invoice.note || undefined}
              >
                {(grant as any).pins.invoice.label || "Invoice"}
              </span>
            )}
          </div>

          {/* Rich metric cards — powered by grantMetrics/{id} */}
          {grant?.id && <GrantMetricCards grantId={grant.id} />}

          {/* Grant info panel: dates, budget strip, description, services, eligibility */}
          <GrantInfoPanel
            model={model}
            grant={grant as any}
          />
        </div>
      )}

      {/* ── Edit mode: name, dates, status, kind ─────────────────────── */}
      {editing && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mt-4">
          {/* Name */}
          <div className="md:col-span-2">
            <div className="text-slate-500 dark:text-slate-400">Name</div>
            <input
              className="input pointer-events-auto"
              type="text"
              name="grant-name"
              autoComplete="off"
              value={nameB.buf}
              onChange={(e) => nameB.setBuf(readInput(e))}
              onFocus={nameB.onFocus}
              onBlur={() => { nameB.onBlurFlag(); commitName(); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitName(); (e.currentTarget as HTMLInputElement).blur(); } }}
            />
          </div>

          <div className="md:col-span-2 border-t border-slate-200 pt-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Lifecycle</div>
          </div>

          {/* Lifecycle dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:col-span-2">
            <div>
              <div className="text-slate-500 dark:text-slate-400">Start Date</div>
              <input
                className="input pointer-events-auto"
                type="date"
                name="grant-startDate"
                autoComplete="off"
                value={iso10(startB.buf)}
                onChange={(e) => startB.setBuf(readInput(e))}
                onFocus={startB.onFocus}
                onBlur={() => { startB.onBlurFlag(); commitStart(); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitStart(); (e.currentTarget as HTMLInputElement).blur(); } }}
              />
            </div>
            <div>
              <div className="text-slate-500 dark:text-slate-400">
                {isGrantKind ? "End Date" : "End Date / Review Date"}
              </div>
              <input
                className="input pointer-events-auto"
                type="date"
                name="grant-endDate"
                autoComplete="off"
                value={iso10(endB.buf)}
                onChange={(e) => endB.setBuf(readInput(e))}
                onFocus={endB.onFocus}
                onBlur={() => { endB.onBlurFlag(); commitEnd(); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitEnd(); (e.currentTarget as HTMLInputElement).blur(); } }}
                placeholder={iso10(startB.buf) ? (() => { const d = parseISO10(iso10(startB.buf)); return d ? toISODate(addDays(addYears(d, 1), -1)) : ""; })() : ""}
                min={iso10(startB.buf) || undefined}
              />
              <div className="mt-1 text-xs text-slate-500">
                {isGrantKind
                  ? "Funding grants usually use a close date."
                  : "Programs can stay open; use this only for sunset, renewal, or review timing."}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:col-span-2 md:grid-cols-3">
            <label>
              <div className="text-slate-500 dark:text-slate-400">Duration Label</div>
              <input
                className="input pointer-events-auto mt-1"
                value={String(model.duration ?? grant?.duration ?? "")}
                placeholder={isGrantKind ? "1 Year" : ""}
                onChange={(e) => setModel((m) => ({ ...m, duration: e.currentTarget.value }))}
              />
            </label>
            <label>
              <div className="text-slate-500 dark:text-slate-400">Max Length of Assistance</div>
              <input
                className="input pointer-events-auto mt-1"
                type="number"
                min={0}
                max={240}
                step={1}
                value={maxAssistanceInputValue(model, grant as Record<string, any> | null)}
                placeholder={isGrantKind ? "18" : "Indefinite"}
                onChange={(e) => {
                  const patch = maxAssistancePatchFromInput(e.currentTarget.value);
                  setModel((m) => ({ ...m, ...patch }));
                }}
              />
              <div className="mt-1 text-xs text-slate-500">
                Leave blank for indefinite assistance.
              </div>
            </label>
            <label>
              <div className="text-slate-500 dark:text-slate-400">Default Authorization Window</div>
              <input
                className="input pointer-events-auto mt-1"
                type="number"
                min={1}
                max={120}
                step={1}
                value={String(model.enrollmentDefaults?.authorizationMonths ?? grant?.enrollmentDefaults?.authorizationMonths ?? "")}
                placeholder="No default"
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setModel((current) => ({
                    ...current,
                    enrollmentDefaults: {
                      ...(current.enrollmentDefaults ?? grant?.enrollmentDefaults ?? {}),
                      authorizationMonths: value ? Number(value) : null,
                    },
                  }));
                }}
              />
              <div className="mt-1 text-xs text-slate-500">
                Sets the suggested end date for new enrollments.
              </div>
            </label>
          </div>

          {!!grant?.id && (
            <div className="md:col-span-2">
              <div className="text-slate-500 dark:text-slate-400">Grant ID</div>
              <div className="font-mono text-xs break-all">{grant?.id}</div>
            </div>
          )}

          {/* Status */}
          <div className="md:col-span-2">
            <div className="text-slate-500 dark:text-slate-400">Status</div>
            <select
              className="select pointer-events-auto"
              value={String(model.status ?? (model.active ? "active" : "draft"))}
              onChange={onStatus}
            >
              {STATUS_OPTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Kind */}
          <div className="md:col-span-2">
            <div className="text-slate-500 dark:text-slate-400">Kind</div>
            {canEditKind ? (
              <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
                <button type="button" className={["px-3 py-1.5 text-sm rounded-md", String(model.kind ?? grant?.kind ?? "grant") === "grant" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"].join(" ")} onClick={() => onRequestKindChange("grant")}>Grant</button>
                <button type="button" className={["px-3 py-1.5 text-sm rounded-md", String(model.kind ?? grant?.kind ?? "grant") === "program" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"].join(" ")} onClick={() => onRequestKindChange("program")}>Program</button>
              </div>
            ) : (
              <div className="text-sm text-slate-700">
                {String(grant?.kind || model?.kind || "grant")}
                <span className="ml-2 text-xs text-slate-500">(admin only)</span>
              </div>
            )}
            <div className="mt-1 text-xs text-slate-500">
              Kind controls lifecycle expectations. Financial settings control budget, billing, ledger, and allocation behavior.
            </div>
          </div>

          <div className="md:col-span-2 border-t border-slate-200 pt-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Budget Model</div>
          </div>

          <div className="md:col-span-2">
            <div className="text-slate-500 dark:text-slate-400">Financial Model</div>
            {editing ? (
              <div className="mt-1 grid gap-2 md:grid-cols-3">
                {(["budgeted", "billable", "serviceOnly"] as FinancialModel[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={[
                      "rounded-md border px-3 py-2 text-left transition",
                      financialModel === option
                        ? "border-sky-300 bg-sky-50 text-slate-950"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                    ].join(" ")}
                    onClick={() => onFinancialModel(option)}
                  >
                    <span className="block text-sm font-semibold">{FINANCIAL_MODEL_COPY[option].title}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-600">{FINANCIAL_MODEL_COPY[option].body}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-700">
                {financialModel === "budgeted"
                  ? "Budgeted spend-down"
                  : financialModel === "billable"
                    ? "Billable with ledger/allocation"
                    : "Service only"}
              </div>
            )}
            <div className="mt-1 text-xs text-slate-500">
              TSS should use Program plus Billable with ledger/allocation.
            </div>
          </div>

          {hasFinancialActivity ? (
            <div className="md:col-span-2 rounded-md border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {financialModel === "budgeted" ? "Budget behavior" : "Billing behavior"}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Line items are edited in the Budget & Activity tab. Save will reconcile the record through the selected financial shape.
                  </div>
                </div>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-4">
                {[
                  ["Budget", financialConfig.budgetEnabled === true ? "On" : "Off"],
                  ["Billing", financialConfig.billingEnabled === true ? "On" : "Off"],
                  ["Allocation", financialConfig.allocationEnabled === true ? "On" : "Off"],
                  ["Ledger", String(financialConfig.ledgerMode || "none")],
                ].map(([label, value]) => (
                  <div key={label} className="rounded border border-slate-200 bg-white px-2.5 py-2">
                    <div className="text-[11px] font-semibold uppercase text-slate-500">{label}</div>
                    <div className="text-sm font-semibold text-slate-900">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="md:col-span-2">
            <EnrollmentControlsEditor
              value={complianceConfig}
              onChange={(next) => setModel((current) => ({ ...current, complianceConfig: next }))}
            />
          </div>

          <div className="md:col-span-2 rounded-md border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Drive Templates</div>
                <div className="mt-1 text-xs text-slate-500">
                  Google Doc, Sheet, or file templates copied into a customer enrollment folder.
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={() => setModel((m) => ({
                  ...m,
                  driveTemplates: [
                    ...grantDriveTemplates((m ?? grant) as Record<string, unknown>),
                    {
                      key: `template_${Date.now()}`,
                      label: "New Template",
                      fileId: "",
                      fileUrl: "",
                      type: "other",
                      defaultChecked: true,
                    },
                  ],
                }))}
              >
                Add template
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {driveTemplates.length ? driveTemplates.map((template, index) => (
                <div key={`${template.key}_${index}`} className="grid gap-2 rounded border border-slate-200 bg-slate-50 p-2 md:grid-cols-[minmax(140px,220px)_1fr_auto_auto]">
                  <label className="field">
                    <span className="label">Label</span>
                    <input
                      className="input input-sm"
                      value={template.label}
                      onChange={(e) => updateDriveTemplate(index, { label: e.currentTarget.value })}
                    />
                  </label>
                  <label className="field">
                    <span className="label">Google file URL or ID</span>
                    <input
                      className="input input-sm"
                      value={String(template.fileUrl || template.fileId || "")}
                      onChange={(e) => {
                        const value = e.currentTarget.value;
                        updateDriveTemplate(index, {
                          fileUrl: value,
                          fileId: parseDriveFileId(value) || value.trim(),
                          type: inferDriveTemplateType(value),
                        });
                      }}
                    />
                  </label>
                  <label className="mt-5 flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={template.defaultChecked !== false}
                      onChange={(e) => updateDriveTemplate(index, { defaultChecked: e.currentTarget.checked })}
                    />
                    Default
                  </label>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs mt-5"
                    onClick={() => setModel((m) => ({
                      ...m,
                      driveTemplates: grantDriveTemplates((m ?? grant) as Record<string, unknown>).filter((_, i) => i !== index),
                    }))}
                  >
                    Remove
                  </button>
                </div>
              )) : (
                <div className="text-xs text-slate-500">No Drive templates configured.</div>
              )}
            </div>
          </div>

          {/* ── Pins ──────────────────────────────────────────────────────── */}
          {isGrantKind && (
            <div className="md:col-span-2 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Grant Pins</div>

              {/* Important Pin */}
              <div className="rounded-md border border-slate-200 bg-slate-50/70 px-2.5 py-2 space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-300 accent-violet-600"
                    checked={!!model?.pins?.important?.enabled}
                    onChange={(e) => {
                      const checked = e.currentTarget.checked;
                      setModel((m) => ({
                        ...m,
                        pins: { ...(m?.pins ?? {}), important: { ...(m?.pins?.important ?? {}), enabled: checked } },
                      }));
                    }}
                  />
                  <span className="text-xs font-semibold text-slate-800">Important Pin</span>
                  <span className="text-xs text-slate-500">
                    Floats grant to top of lists
                  </span>
                </label>

                {model?.pins?.important?.enabled && (
                  <div className="grid gap-2 pl-5 md:grid-cols-[minmax(160px,240px)_auto_minmax(180px,1fr)]">
                    {/* Label */}
                    <div>
                      <div className="text-xs text-slate-500 mb-0.5">Label</div>
                      <input
                        className="input input-sm h-8 w-full text-xs"
                        type="text"
                        placeholder="Important (default)"
                        value={String(model?.pins?.important?.label ?? "")}
                        onChange={(e) => {
                          const v = e.currentTarget.value;
                          setModel((m) => ({
                            ...m,
                            pins: { ...(m?.pins ?? {}), important: { ...(m?.pins?.important ?? {}), label: v } },
                          }));
                        }}
                      />
                    </div>
                    {/* Color */}
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Color</div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(["", ...PIN_COLORS] as const).map((c) => (
                          <button
                            key={c || "none"}
                            type="button"
                            onClick={() => setModel((m) => ({
                              ...m,
                              pins: { ...(m?.pins ?? {}), important: { ...(m?.pins?.important ?? {}), color: c || null } },
                            }))}
                            className={[
                              "h-4 w-4 rounded-full border-2 transition",
                              (model?.pins?.important?.color ?? "") === c
                                ? "border-slate-600 scale-110"
                                : "border-transparent hover:border-slate-400",
                              c ? pinColorDotCls(c as PinColor) : "bg-white border border-slate-300",
                            ].join(" ")}
                            title={c || "No color"}
                          />
                        ))}
                      </div>
                    </div>
                    {/* Note */}
                    <div>
                      <div className="text-xs text-slate-500 mb-0.5">Note (optional)</div>
                      <input
                        className="input h-8 w-full text-xs"
                        type="text"
                        placeholder="Internal note about this pin..."
                        value={String(model?.pins?.important?.note ?? "")}
                        onChange={(e) => {
                          const v = e.currentTarget.value;
                          setModel((m) => ({
                            ...m,
                            pins: { ...(m?.pins ?? {}), important: { ...(m?.pins?.important ?? {}), note: v } },
                          }));
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Digest Pin */}
              <div className="grid gap-2 md:grid-cols-2">
                <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50/70 px-2.5 py-2">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-300 accent-sky-600"
                    checked={!!model?.pins?.digest?.enabled}
                    onChange={(e) => {
                      const checked = e.currentTarget.checked;
                      setModel((m) => ({
                        ...m,
                        pins: { ...(m?.pins ?? {}), digest: { ...(m?.pins?.digest ?? {}), enabled: checked } },
                      }));
                    }}
                  />
                  <span className="text-xs font-semibold text-slate-800">Digest Pin</span>
                  <span className="text-xs text-slate-500">
                    Include in org digests
                  </span>
                </label>
                <label className="flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50/70 px-2.5 py-2">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-300 accent-indigo-600"
                    checked={!!model?.pins?.invoice?.enabled}
                    onChange={(e) => {
                      const checked = e.currentTarget.checked;
                      setModel((m) => ({
                        ...m,
                        pins: { ...(m?.pins ?? {}), invoice: { ...(m?.pins?.invoice ?? {}), enabled: checked, label: m?.pins?.invoice?.label || "Invoice" } },
                      }));
                    }}
                  />
                  <span className="text-xs font-semibold text-indigo-900">Invoice Pin</span>
                  <span className="text-xs text-indigo-700/80">
                    Surface in invoice/payment workflows
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Promoted fields in edit mode */}
          <div className="md:col-span-2">
            <PromotedField label="Description" fieldKey="description" multiline editing={editing} model={model} setModel={setModel} grant={grant as any} />
          </div>
          <RecommendedGrantInfoEditor model={model} setModel={setModel} grant={grant as any} />
        </div>
      )}

      {/* Dynamic fields */}
      <div className="mt-6">
        {editing ? (
          <div className="rounded-xl border border-slate-200 bg-white">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-left"
              onClick={() => setAdvancedOpen((v) => !v)}
            >
              <div>
                <div className="text-sm font-semibold text-slate-800">Advanced Fields</div>
                <div className="text-xs text-slate-500">
                  Custom fields and schema-level grant metadata.
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="rounded-full bg-slate-100 px-2 py-0.5">
                  {additionalFieldCount} field{additionalFieldCount === 1 ? "" : "s"}
                </span>
                <span>{advancedOpen ? "Hide" : "Show"}</span>
              </div>
            </button>
            {advancedOpen && (
              <div className="border-t border-slate-200 p-4">
                <DynamicFieldsEditor
                  value={dynamicValue}
                  hiddenKeys={PROMOTED_DETAIL_KEYS}
                  showExistingFields={false}
                  onChange={(next) => {
                    const candidate = next as Record<string, any>;
                    const nonMeta: Record<string, any> = {};
                    for (const [k, v] of Object.entries(candidate)) {
                      if (!META_KEYS.has(k) && !PROMOTED_DETAIL_KEY_SET.has(k)) nonMeta[k] = v;
                    }
                    setModel((m) => {
                      const nextModel = { ...(m || {}) };
                      for (const key of Object.keys(nextModel)) {
                        if (!META_KEYS.has(key) && !PROMOTED_DETAIL_KEY_SET.has(key)) delete nextModel[key];
                      }
                      return { ...nextModel, ...nonMeta };
                    });
                  }}
                />
              </div>
            )}
          </div>
        ) : (
          <ReadOnlyDetails obj={grant ?? model} />
        )}
      </div>
    </>
  );
}

// ─── Read-only field value renderer ─────────────────────────────────────────

function ReadOnlyFieldValue({ rawValue }: { rawValue: any }) {
  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return <span className="text-slate-400 italic text-xs">—</span>;
  }
  if (typeof rawValue === "boolean") {
    return (
      <span
        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
          rawValue ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
        }`}
      >
        {rawValue ? "Yes" : "No"}
      </span>
    );
  }
  if (typeof rawValue === "number") {
    return <span>{Number.isFinite(rawValue) ? rawValue.toLocaleString() : "—"}</span>;
  }
  if (Array.isArray(rawValue)) {
    if (rawValue.length === 0)
      return <span className="text-slate-400 italic text-xs">[ empty ]</span>;
    const firstIsObj =
      typeof rawValue[0] === "object" && rawValue[0] !== null && !Array.isArray(rawValue[0]);
    if (firstIsObj) {
      return (
        <div className="space-y-1">
          {rawValue.map((item, i) => (
            <div key={i} className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
              {Object.entries(item || {}).map(([k, v]) => (
                <span key={k} className="mr-3">
                  <span className="text-slate-500">{k}:</span>{" "}
                  <span className="font-medium">{String(v ?? "")}</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="flex flex-wrap gap-1">
        {rawValue.map((item, i) => (
          <span
            key={i}
            className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
          >
            {String(item)}
          </span>
        ))}
      </div>
    );
  }
  if (typeof rawValue === "object") {
    const entries = Object.entries(rawValue).filter(([k]) => k !== "_priority");
    if (entries.length === 0)
      return <span className="text-slate-400 italic text-xs">{ }</span>;
    return (
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        {entries.map(([k, v]) => (
          <React.Fragment key={k}>
            <span className="text-slate-500 font-medium">{k}</span>
            <span className="text-slate-800">{String(v ?? "")}</span>
          </React.Fragment>
        ))}
      </div>
    );
  }
  return <span className="whitespace-pre-wrap">{String(rawValue)}</span>;
}

// ─── Read-only details panel ─────────────────────────────────────────────────

function isEmptyReadOnlyValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return !value.trim();
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(([key]) => key !== "_priority");
    return entries.length === 0 || entries.every(([, entryValue]) => isEmptyReadOnlyValue(entryValue));
  }
  return false;
}

function ReadOnlyDetails({ obj }: { obj: Record<string, any> }) {
  const HIDE = new Set([
    "budget", "assessments", "tasks", "meta",
    "updatedAt", "createdAt", "deleted", "active", "orgId",
    "startDate", "endDate", "kind",
    "tags", "eligibility", "lengthOfAssistance", "linking",
    "invoicing", "invoiceDocuments", "levelOfAssistance",
    "Invoice Docs", "Invoice Documents", "Level of Assistance", "Maximum Length of Assistance",
    "description", "servicesOffered", "duration", "maxAmount", "maximumAmount", "maxAssistanceAmount",
    "maxLengthOfAssistance", "details",
  ]);

  type FieldEntry = { key: string; rawValue: any; priority: Priority };

  const fields: FieldEntry[] = Object.entries(obj || {})
    .filter(([k]) => !META_KEYS.has(k) && !HIDE.has(k))
    .map(([k, v]) => {
      const { rawValue, priority } = readEnvelope(v);
      return { key: k, rawValue, priority };
    })
    .filter(({ priority }) => priority !== "hidden")
    .filter(({ rawValue }) => !isEmptyReadOnlyValue(rawValue))
    .sort(
      (a, b) =>
        (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1)
    );

  if (fields.length === 0) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">No additional details.</p>
    );
  }

  const important = fields.filter((f) => f.priority === "important");
  const rest = fields.filter((f) => f.priority !== "important");

  return (
    <div className="space-y-3">
      {/* Important fields — full-width, amber accent */}
      {important.map(({ key, rawValue }) => (
        <div
          key={key}
          className="rounded-lg border border-amber-200 border-l-4 border-l-amber-400 bg-amber-50/60 px-4 py-3 text-sm"
        >
          <div className="mb-1 flex items-center gap-2">
            <span className="font-semibold text-amber-900">{key}</span>
            <span className="rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
              {PRIORITY_META.important.label}
            </span>
          </div>
          <div className="text-slate-800">
            <ReadOnlyFieldValue rawValue={rawValue} />
          </div>
        </div>
      ))}

      {/* Medium + Low fields — 2-column grid */}
      {rest.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {rest.map(({ key, rawValue, priority }) => {
            const pm = PRIORITY_META[priority];
            return (
              <div
                key={key}
                className={`rounded-lg border px-3 py-2 text-sm ${pm.rowCls}`}
              >
                <div className={`mb-0.5 text-xs font-medium ${pm.labelCls}`}>
                  {key}
                </div>
                <div className={priority === "low" ? "text-slate-500 text-xs" : "text-slate-800"}>
                  <ReadOnlyFieldValue rawValue={rawValue} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default React.memo(DetailsTab);
