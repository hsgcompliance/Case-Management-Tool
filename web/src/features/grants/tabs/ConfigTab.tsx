// src/features/grants/tabs/ConfigTab.tsx
"use client";

import React, { useState } from "react";
import type { TGrant as Grant } from "@types";
import { GRANT_ACCENT_COLORS, grantAccentSolid } from "@lib/colorRegistry";
import { InvoiceInfoEditor } from "./DetailsTab";

const RENTAL_ASSISTANCE_TAG = "rental-assistance";

const PIN_DEFS = [
  ["digest", "Budget Digest"],
  ["rentalAssistance", "Rental Assistance Digest"],
  ["invoice", "Invoice"],
  ["important", "Important"],
] as const;

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((t) => String(t || "").trim()).filter(Boolean);
}
const hasTag = (tags: string[], tag: string) => tags.some((t) => t.toLowerCase() === tag.toLowerCase());
const hasOwn = (obj: unknown, key: string) =>
  !!obj && typeof obj === "object" && Object.prototype.hasOwnProperty.call(obj, key);

function SectionCard({
  title,
  description,
  onClear,
  clearLabel = "Remove",
  canClear,
  children,
}: {
  title: string;
  description?: string;
  onClear?: () => void;
  clearLabel?: string;
  canClear?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</div>
          {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
        </div>
        {onClear && canClear ? (
          <button type="button" className="btn btn-ghost btn-xs text-red-600" onClick={onClear}>
            {clearLabel}
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function ConfigTab({
  editing,
  model,
  setModel,
  grant,
  allGrants,
}: {
  editing: boolean;
  model: Record<string, any>;
  setModel: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  grant: Grant | null;
  allGrants: Grant[];
}) {
  const [tagDraft, setTagDraft] = useState("");
  const isGrantKind = String(model.kind ?? grant?.kind ?? "grant") !== "program";

  const tags = normalizeTags(model.tags ?? grant?.tags);
  const rentalTagged = hasTag(tags, RENTAL_ASSISTANCE_TAG);

  // Explicit-null aware reads so "clear" buttons hide once a field is removed.
  const linkingSrc = hasOwn(model, "linking") ? model.linking : grant?.linking;
  const linking = (linkingSrc ?? {}) as Record<string, any>;
  const cycle = (linking.cycle ?? {}) as Record<string, any>;
  const rules = Array.isArray(linking.enrollmentRules) ? linking.enrollmentRules : [];
  const targetId = String(rules[0]?.targetGrantId || "");
  const hasLinking = !!(cycle.previousGrantId || cycle.nextGrantId || targetId);

  const invoicing = (hasOwn(model, "invoicing") ? model.invoicing : grant?.invoicing) as Record<string, any> | null | undefined;
  const hasInvoicing = !!invoicing && typeof invoicing === "object" && Object.keys(invoicing).length > 0;
  const pins = ((hasOwn(model, "pins") ? model.pins : grant?.pins) ?? {}) as Record<string, any>;
  const setPinEnabled = (key: "digest" | "rentalAssistance" | "invoice" | "important", enabled: boolean) =>
    setModel((current) => {
      const currentPins = (current.pins && typeof current.pins === "object") ? current.pins : pins;
      return { ...current, pins: { ...currentPins, [key]: { ...((currentPins[key] && typeof currentPins[key] === "object") ? currentPins[key] : {}), enabled } } };
    });
  const setPinField = (key: "invoice" | "important", field: "label" | "note" | "color", value: string | null) =>
    setModel((current) => {
      const currentPins = (current.pins && typeof current.pins === "object") ? current.pins : pins;
      const currentPin = (currentPins[key] && typeof currentPins[key] === "object") ? currentPins[key] : {};
      return { ...current, pins: { ...currentPins, [key]: { ...currentPin, [field]: value } } };
    });

  const safeAllGrants = Array.isArray(allGrants) ? allGrants : [];
  const grantOptions = safeAllGrants
    .filter(
      (row) =>
        String((row as any).id || "") &&
        String((row as any).id) !== String(grant?.id || model.id || "") &&
        (row as any).deleted !== true,
    )
    .sort((a, b) => String(a.name || (a as any).id).localeCompare(String(b.name || (b as any).id)));
  const nameOf = (id: string) => {
    const row = safeAllGrants.find((g) => String((g as any).id) === String(id));
    return row ? String(row.name || (row as any).id) : id;
  };

  const setTags = (next: string[]) => setModel((m) => ({ ...m, tags: next }));
  const addTag = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    const cur = normalizeTags(model.tags ?? grant?.tags);
    if (!hasTag(cur, t)) setTags([...cur, t]);
    setTagDraft("");
  };
  const removeTag = (tag: string) =>
    setTags(normalizeTags(model.tags ?? grant?.tags).filter((t) => t.toLowerCase() !== tag.toLowerCase()));
  const toggleRental = (on: boolean) => {
    const base = normalizeTags(model.tags ?? grant?.tags).filter((t) => t.toLowerCase() !== RENTAL_ASSISTANCE_TAG);
    setTags(on ? [...base, RENTAL_ASSISTANCE_TAG] : base);
  };

  const updateLinking = (patch: {
    previousGrantId?: string | null;
    nextGrantId?: string | null;
    targetGrantId?: string | null;
  }) => {
    setModel((current) => {
      const lk = current.linking && typeof current.linking === "object" ? current.linking : {};
      const cy = lk.cycle && typeof lk.cycle === "object" ? lk.cycle : {};
      const previousGrantId = patch.previousGrantId !== undefined ? patch.previousGrantId : cy.previousGrantId ?? null;
      const nextGrantId = patch.nextGrantId !== undefined ? patch.nextGrantId : cy.nextGrantId ?? null;
      const target =
        patch.targetGrantId !== undefined
          ? patch.targetGrantId
          : (Array.isArray(lk.enrollmentRules) ? lk.enrollmentRules[0]?.targetGrantId : null) ?? null;
      return {
        ...current,
        linking: {
          ...lk,
          cycle: { previousGrantId, nextGrantId },
          enrollmentRules: target
            ? [{ targetGrantId: target, onEnroll: "ensureActive", onAllSourcesClosed: "flagShouldUnenroll" }]
            : [],
        },
      };
    });
  };

  // ── View mode ─────────────────────────────────────────────────────────────
  if (!editing) {
    return (
      <div className="mt-4 space-y-4">
        <SectionCard title="Tags">
          {tags.length ? (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {t}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-500">No tags.</div>
          )}
        </SectionCard>
        <SectionCard title="Display and digest pins">
          <div className="text-xs text-slate-500">
            {PIN_DEFS.filter(([key]) => pins[key]?.enabled).map(([, label]) => label).join(", ") || "No pins enabled."}
          </div>
        </SectionCard>

        <SectionCard title="Links">
          {hasLinking ? (
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {cycle.previousGrantId ? (
                <>
                  <span className="text-slate-500">Previous cycle</span>
                  <span className="text-slate-800 dark:text-slate-200">{nameOf(String(cycle.previousGrantId))}</span>
                </>
              ) : null}
              {cycle.nextGrantId ? (
                <>
                  <span className="text-slate-500">Next cycle</span>
                  <span className="text-slate-800 dark:text-slate-200">{nameOf(String(cycle.nextGrantId))}</span>
                </>
              ) : null}
              {targetId ? (
                <>
                  <span className="text-slate-500">Ensure enrollment in</span>
                  <span className="text-slate-800 dark:text-slate-200">{nameOf(targetId)}</span>
                </>
              ) : null}
            </div>
          ) : (
            <div className="text-xs text-slate-500">No links configured.</div>
          )}
        </SectionCard>

        <SectionCard title="Legacy Grant Invoice Config">
          <div className="text-xs text-slate-500">
            {hasInvoicing ? "Used as a read fallback for line items without their own invoice config." : "Not configured."}
          </div>
        </SectionCard>
      </div>
    );
  }

  // ── Edit mode ─────────────────────────────────────────────────────────────
  return (
    <div className="mt-4 space-y-4">
      <SectionCard
        title="Tags"
        description="Free-form labels for grouping and reporting."
        onClear={() => setTags([])}
        clearLabel="Clear all"
        canClear={tags.length > 0}
      >
        <div className="space-y-3">
          {tags.length ? (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {t}
                  <button
                    type="button"
                    className="text-slate-400 hover:text-red-600"
                    onClick={() => removeTag(t)}
                    aria-label={`Remove ${t}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-500">No tags yet.</div>
          )}
          <div className="flex gap-2">
            <input
              className="input h-8 flex-1 text-sm"
              placeholder="Add a tag and press Enter"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag(tagDraft);
                }
              }}
            />
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => addTag(tagDraft)}>
              Add
            </button>
          </div>
          {isGrantKind ? (
            <label className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50/70 px-2.5 py-2 dark:border-emerald-900/60 dark:bg-emerald-950/30">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-slate-300 accent-emerald-600"
                checked={rentalTagged}
                onChange={(e) => toggleRental(e.currentTarget.checked)}
              />
              <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-100">Rental Assistance</span>
              <span className="text-xs text-emerald-800/75 dark:text-emerald-200/75">Budget grouping and reporting</span>
            </label>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title="Display and digest pins" description="Explicit participation in digest, invoice, rental-assistance, and priority surfaces.">
        <div className="grid gap-2 sm:grid-cols-2">
          {PIN_DEFS.map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
              <input type="checkbox" checked={pins[key]?.enabled === true} onChange={(event) => setPinEnabled(key, event.currentTarget.checked)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        {pins.invoice?.enabled === true ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-500">Invoice pin label</span>
              <input
                className="input w-full"
                placeholder="Invoice"
                value={String(pins.invoice?.label ?? "")}
                onChange={(e) => setPinField("invoice", "label", e.currentTarget.value)}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-500">Invoice pin note</span>
              <input
                className="input w-full"
                value={String(pins.invoice?.note ?? "")}
                onChange={(e) => setPinField("invoice", "note", e.currentTarget.value)}
              />
            </label>
          </div>
        ) : null}
        {pins.important?.enabled === true ? (
          <div className="mt-3 grid gap-3 md:grid-cols-[minmax(160px,240px)_auto_1fr]">
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-500">Important pin label</span>
              <input
                className="input w-full"
                placeholder="Important"
                value={String(pins.important?.label ?? "")}
                onChange={(e) => setPinField("important", "label", e.currentTarget.value)}
              />
            </label>
            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-500">Color</div>
              <div className="flex flex-wrap items-center gap-1.5 pt-2">
                {(["", ...GRANT_ACCENT_COLORS] as const).map((c) => (
                  <button
                    key={c || "none"}
                    type="button"
                    onClick={() => setPinField("important", "color", c || null)}
                    className={[
                      "h-4 w-4 rounded-full border-2 transition",
                      String(pins.important?.color ?? "") === c ? "border-slate-600 scale-110" : "border-transparent hover:border-slate-400",
                      c ? grantAccentSolid(c) : "bg-white border border-slate-300",
                    ].join(" ")}
                    title={c || "No color"}
                  />
                ))}
              </div>
            </div>
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-500">Note (optional)</span>
              <input
                className="input w-full"
                placeholder="Internal note about this pin..."
                value={String(pins.important?.note ?? "")}
                onChange={(e) => setPinField("important", "note", e.currentTarget.value)}
              />
            </label>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Links"
        description="Optional lifecycle links by grant ID. Drives cycle rollover and linked-enrollment automation."
        onClear={() => setModel((m) => ({ ...m, linking: null }))}
        clearLabel="Clear links"
        canClear={hasLinking}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-500">Previous cycle</span>
            <select
              className="select w-full"
              value={String(cycle.previousGrantId || "")}
              onChange={(e) => updateLinking({ previousGrantId: e.currentTarget.value || null })}
            >
              <option value="">None</option>
              {grantOptions.map((row) => (
                <option key={String((row as any).id)} value={String((row as any).id)}>
                  {String(row.name || (row as any).id)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-500">Next cycle</span>
            <select
              className="select w-full"
              value={String(cycle.nextGrantId || "")}
              onChange={(e) => updateLinking({ nextGrantId: e.currentTarget.value || null })}
            >
              <option value="">None</option>
              {grantOptions.map((row) => (
                <option key={String((row as any).id)} value={String((row as any).id)}>
                  {String(row.name || (row as any).id)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-500">Ensure linked enrollment in</span>
            <select
              className="select w-full"
              value={targetId}
              onChange={(e) => updateLinking({ targetGrantId: e.currentTarget.value || null })}
            >
              <option value="">None</option>
              {grantOptions.map((row) => (
                <option key={String((row as any).id)} value={String((row as any).id)}>
                  {String(row.name || (row as any).id)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          Source grants (e.g. YHDP RRH/PSH) can ensure one linked Continuum enrollment. Run cycle rollovers and
          reconciliation from the Admin tab.
        </div>
      </SectionCard>

      <SectionCard
        title="Legacy Grant Invoice Config"
        description="Compatibility fallback for existing records. New invoice metadata is configured on individual line items."
        onClear={() => setModel((m) => ({ ...m, invoicing: null }))}
        clearLabel="Remove config"
        canClear={hasInvoicing}
      >
        <InvoiceInfoEditor model={model} setModel={setModel} />
      </SectionCard>
    </div>
  );
}

export default ConfigTab;
