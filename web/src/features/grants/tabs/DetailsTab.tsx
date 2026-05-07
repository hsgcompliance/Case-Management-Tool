// src/features/grants/tabs/DetailsTab.tsx
"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { parseISO10, safeISODate10, toISODate, addYears, addDays } from "@lib/date";
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
  if (empty) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400 py-0.5">
        <span className="font-medium text-slate-500 min-w-[120px]">{label}</span>
        <span>—</span>
      </div>
    );
  }
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

function EligibilityEditor({
  model,
  setModel,
  grant,
}: {
  model: Record<string, any>;
  setModel: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  grant: Record<string, any> | null;
}) {
  const eligibility = eligibilityDraftObject(model.eligibility ?? grant?.eligibility);
  const rows = Object.entries(eligibility);

  const commit = (next: Record<string, string>) => {
    const cleaned = eligibilityDraftObject(next);
    setModel((m) => ({
      ...(m || {}),
      eligibility: Object.keys(cleaned).length ? cleaned : null,
    }));
  };

  const updateKey = (oldKey: string, newKeyRaw: string) => {
    const newKey = newKeyRaw.trim();
    if (!newKey || newKey === oldKey) return;
    if (eligibility[newKey]) return;
    const next = { ...eligibility };
    next[newKey] = next[oldKey] ?? "";
    delete next[oldKey];
    commit(next);
  };

  const updateValue = (key: string, value: string) => {
    commit({ ...eligibility, [key]: value });
  };

  const remove = (key: string) => {
    const next = { ...eligibility };
    delete next[key];
    commit(next);
  };

  const addRow = () => {
    let idx = rows.length + 1;
    let key = `Requirement ${idx}`;
    while (eligibility[key]) {
      idx += 1;
      key = `Requirement ${idx}`;
    }
    commit({ ...eligibility, [key]: "" });
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <div className="text-slate-500 dark:text-slate-400">Eligibility</div>
        <p className="mt-1 text-xs text-slate-500">
          Add structured eligibility criteria as key/value pairs.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-500">
          No eligibility criteria yet.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(([key, value]) => (
            <div key={key} className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(180px,220px)_1fr_auto]">
              <input
                className="input"
                type="text"
                defaultValue={key}
                onBlur={(e) => updateKey(key, e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    updateKey(key, e.currentTarget.value);
                    (e.currentTarget as HTMLInputElement).blur();
                  }
                }}
              />
              <input
                className="input"
                type="text"
                value={value}
                placeholder="Example: Household income below 60% AMI"
                onChange={(e) => updateValue(key, e.currentTarget.value)}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => remove(key)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <button type="button" className="btn btn-secondary btn-sm" onClick={addRow}>
        Add Criterion
      </button>
    </div>
  );
}

function GrantInfoPanel({
  model,
  grant,
  derived,
  showBudgetStrip,
  currency,
}: {
  model: Record<string, any>;
  grant: Record<string, any> | null;
  derived?: { total: number; spent: number; projected: number; balance: number; projectedBalance: number } | null;
  showBudgetStrip?: boolean;
  currency?: (n: number) => string;
}) {
  const g = (grant ?? model) as Record<string, any>;
  const fmt = (n: number) =>
    n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const fmtFn = currency ?? fmt;

  const startDate     = String(g.startDate   || "").slice(0, 10);
  const endDate       = String(g.endDate     || "").slice(0, 10);
  const description   = String(g.description || "").trim();
  const maxLen        = String(g.lengthOfAssistance ?? g.maxLengthOfAssistance ?? "").trim();
  const maxAmount     = String(g.maxAmount   ?? g.maximumAmount ?? g.maxAssistanceAmount ?? "").trim();
  const services      = g.servicesOffered;
  const eligibility   = g.eligibility;

  const hasServices   = Array.isArray(services) ? services.length > 0 : !!services;
  const hasEligibility = Object.keys(normalizeEligibility(eligibility)).length > 0;
  const hasMaxAmount  = !!maxAmount && maxAmount.toLowerCase() !== "n/a" && maxAmount !== "0";

  // Budget strip values
  const total    = derived?.total    ?? 0;
  const spent    = derived?.spent    ?? 0;
  const projected = derived?.projected ?? 0;
  const projBal  = derived?.projectedBalance ?? (total - spent - projected);
  const denom    = total > 0 ? total : 1;
  const spentPct = Math.min(100, (spent / denom) * 100);
  const projPct  = Math.min(100 - spentPct, (projected / denom) * 100);
  const remPct   = Math.max(0, 100 - spentPct - projPct);

  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-5 space-y-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Grant Info</div>

      {/* Dates row — always shown */}
      <div className="flex flex-wrap gap-4">
        <div>
          <div className="text-xs text-slate-400 mb-0.5">Start Date</div>
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {startDate ? new Date(startDate + "T00:00:00").toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400 mb-0.5">End Date</div>
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {endDate ? new Date(endDate + "T00:00:00").toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "—"}
          </div>
        </div>
      </div>

      {/* Budget strip (grants only) */}
      {showBudgetStrip && derived && total > 0 && (
        <div className="space-y-2">
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-amber-400 transition-all" style={{ width: `${spentPct}%` }} />
            <div className="h-full bg-blue-400 transition-all"  style={{ width: `${projPct}%`  }} />
            <div className={`h-full transition-all ${projBal < 0 ? "bg-red-400" : "bg-emerald-300"}`} style={{ width: `${remPct}%` }} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {[
              { label: "Total",    value: total,     color: "text-slate-700" },
              { label: "Spent",    value: spent,     color: "text-amber-700" },
              { label: "Projected", value: projected, color: "text-blue-700" },
              { label: "Balance",  value: projBal,   color: projBal >= 0 ? "text-emerald-700" : "text-red-600" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-lg border border-slate-100 px-2.5 py-1.5 bg-slate-50">
                <div className="text-slate-400 mb-0.5">{label}</div>
                <div className={`font-semibold ${color}`}>{fmtFn(value)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      <FieldBlock label="Description" empty={!description}>
        {description && <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{description}</p>}
      </FieldBlock>

      {/* Max Length of Assistance */}
      <FieldBlock label="Max Length of Assistance" empty={!maxLen}>
        {maxLen && <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-800">{maxLen}</span>}
      </FieldBlock>

      {/* Max Amount of Assistance */}
      <FieldBlock label="Max Amount of Assistance" empty={!hasMaxAmount}>
        {hasMaxAmount && <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-800">{maxAmount}</span>}
      </FieldBlock>

      {/* Services Offered */}
      <FieldBlock label="Services Offered" empty={!hasServices}>
        <ServicesOfferedDisplay value={services} />
      </FieldBlock>

      {/* Eligibility */}
      <FieldBlock label="Eligibility" empty={!hasEligibility}>
        <EligibilityDisplay value={eligibility} />
      </FieldBlock>
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
  derived,
  showBudgetStrip,
  currency,
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
    let nextEnd = model?.endDate ? String(model.endDate) : "";
    if (!nextEnd && iso) {
      const d = parseISO10(iso);
      if (d) nextEnd = toISODate(addDays(addYears(d, 1), -1));
    }
    console.debug("[DetailsTab] commit startDate ->", { raw, iso, autoEnd: nextEnd || null });
    setModel((m) => ({ ...m, startDate: iso, endDate: m?.endDate ? m.endDate : nextEnd }));
  }, [startB.buf, model?.endDate, setModel]);

  const commitEnd = useCallback(() => {
    const raw = iso10(endB.buf);
    const iso = toISOOrEmpty(raw);
    console.debug("[DetailsTab] commit endDate ->", { raw, iso });
    setModel((m) => ({ ...m, endDate: iso }));
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
  const kindVal = String(grant?.kind || model?.kind || "grant");
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
          </div>

          {/* Rich metric cards — powered by grantMetrics/{id} */}
          {grant?.id && <GrantMetricCards grantId={grant.id} />}

          {/* Grant info panel: dates, budget strip, description, services, eligibility */}
          <GrantInfoPanel
            model={model}
            grant={grant as any}
            derived={derived}
            showBudgetStrip={showBudgetStrip}
            currency={currency}
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

          {/* Start + End */}
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
              <div className="text-slate-500 dark:text-slate-400">End Date (optional)</div>
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
            </div>
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
            <div className="mt-1 text-xs text-slate-500">Programs are zero-budget. Change kind to escalate a program to a grant.</div>
          </div>

          {/* Promoted fields in edit mode */}
          <div className="md:col-span-2">
            <PromotedField label="Description" fieldKey="description" multiline editing={editing} model={model} setModel={setModel} grant={grant as any} />
          </div>
          <div className="md:col-span-2">
            <EligibilityEditor model={model} setModel={setModel} grant={grant as any} />
          </div>
          <div className="md:col-span-2">
            <PromotedField label="Length of Assistance" fieldKey="lengthOfAssistance" editing={editing} model={model} setModel={setModel} grant={grant as any} />
          </div>
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
                  hiddenKeys={["orgId", "kind", "deleted", "tags", "eligibility", "lengthOfAssistance", "description"]}
                  onChange={(next) => {
                    const candidate = next as Record<string, any>;
                    const nonMeta: Record<string, any> = {};
                    const SKIP = new Set(["orgId", "kind", "deleted", "tags", "eligibility", "lengthOfAssistance", "description"]);
                    for (const [k, v] of Object.entries(candidate)) {
                      if (!META_KEYS.has(k) && !SKIP.has(k)) nonMeta[k] = v;
                    }
                    setModel((m) => {
                      const nextModel = { ...(m || {}) };
                      for (const key of Object.keys(nextModel)) {
                        if (!META_KEYS.has(key) && !SKIP.has(key)) delete nextModel[key];
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

function ReadOnlyDetails({ obj }: { obj: Record<string, any> }) {
  const HIDE = new Set([
    "budget", "assessments", "tasks", "meta",
    "updatedAt", "createdAt", "deleted", "active", "orgId",
    "startDate", "endDate", "kind",
    "tags", "eligibility", "lengthOfAssistance",
    "description", "servicesOffered", "maxAmount", "maximumAmount", "maxAssistanceAmount",
    "maxLengthOfAssistance",
  ]);

  type FieldEntry = { key: string; rawValue: any; priority: Priority };

  const fields: FieldEntry[] = Object.entries(obj || {})
    .filter(([k]) => !META_KEYS.has(k) && !HIDE.has(k))
    .map(([k, v]) => {
      const { rawValue, priority } = readEnvelope(v);
      return { key: k, rawValue, priority };
    })
    .filter(({ priority }) => priority !== "hidden")
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
