"use client";

import React from "react";
import type { TJotformDigestMap, TJotformDigestField, TJotformDigestSection } from "@types";
import type { JotformSubmission } from "@hooks/useJotform";
import CustomerSearch from "@entities/selectors/CustomerSearch";
import GrantSelect from "@entities/selectors/GrantSelect";
import EnrollmentSelect from "@entities/selectors/EnrollmentSelect";
import UserSelect from "@entities/selectors/UserSelect";
import { buildNormalizedAnswerFields } from "../jotformSubmissionView";
import { buildLineItemsDigestTemplate, isLineItemsFormId } from "../lineItemsFormMap";

// ── Types ─────────────────────────────────────────────────────────────────────

type DraftSection = TJotformDigestSection & { color?: string };

type DigestDraft = Omit<TJotformDigestMap, "sections"> & {
  sections: DraftSection[];
};

export type DigestLinkDraft = {
  grantId: string;
  customerId: string;
  enrollmentId: string;
  cwId: string;
  hmisId: string;
  formAlias: string;
};

type DragItem = { kind: "field"; key: string; sectionId: string | null } | { kind: "section"; id: string };

// ── Constants ────────────────────────────────────────────────────────────────

const PALETTE = [
  { key: "sky",     dot: "bg-sky-400",     header: "bg-sky-50 border-sky-200",       text: "text-sky-800" },
  { key: "violet",  dot: "bg-violet-400",  header: "bg-violet-50 border-violet-200", text: "text-violet-800" },
  { key: "emerald", dot: "bg-emerald-400", header: "bg-emerald-50 border-emerald-200", text: "text-emerald-800" },
  { key: "amber",   dot: "bg-amber-400",   header: "bg-amber-50 border-amber-200",   text: "text-amber-800" },
  { key: "rose",    dot: "bg-rose-400",    header: "bg-rose-50 border-rose-200",     text: "text-rose-800" },
  { key: "orange",  dot: "bg-orange-400",  header: "bg-orange-50 border-orange-200", text: "text-orange-800" },
  { key: "teal",    dot: "bg-teal-400",    header: "bg-teal-50 border-teal-200",     text: "text-teal-800" },
  { key: "indigo",  dot: "bg-indigo-400",  header: "bg-indigo-50 border-indigo-200", text: "text-indigo-800" },
] as const;

function getPalette(key?: string) {
  return PALETTE.find((p) => p.key === key) ?? PALETTE[0];
}

// ── Utilities ────────────────────────────────────────────────────────────────

function initDraft(
  digestMap: TJotformDigestMap | null,
  formId: string,
  formAlias?: string | null,
  formTitle?: string | null,
): DigestDraft {
  if (digestMap) {
    return {
      ...digestMap,
      sections: (digestMap.sections ?? []).map((s) => ({ ...s })) as DraftSection[],
      fields: (digestMap.fields ?? []).map((f) => ({ ...f })),
    } as DigestDraft;
  }
  return {
    id: formId,
    formId,
    formAlias: formAlias ?? null,
    formTitle: formTitle ?? null,
    orgId: null,
    header: { show: true, title: formTitle ?? null, subtitle: null },
    sections: [],
    fields: [],
    options: {
      hideEmptyFields: true,
      showQuestions: true,
      showAnswers: true,
      task: { enabled: false, assignedToGroup: "admin" as const, titlePrefix: null, titleFieldKeys: [], subtitleFieldKeys: [] },
      spending: {
        enabled: false,
        schemaKind: "other",
        grantFieldKeys: [],
        lineItemFieldKeys: [],
        customerFieldKeys: [],
        amountFieldKeys: [],
        merchantFieldKeys: [],
        keywordRules: [],
        notes: null,
      },
    },
    createdAt: null,
    updatedAt: null,
  } as unknown as DigestDraft;
}

function initLinkDraft(sub: JotformSubmission): DigestLinkDraft {
  const s = sub as Record<string, unknown>;
  return {
    grantId: String(s.grantId || ""),
    customerId: String(s.customerId || ""),
    enrollmentId: String(s.enrollmentId || ""),
    cwId: String(s.cwId || ""),
    hmisId: String(s.hmisId || ""),
    formAlias: String(s.formAlias || ""),
  };
}

function getAnswerText(answers: Record<string, unknown>, key: string): string {
  const a = answers[key];
  if (!a) return "";
  const v = (a as Record<string, unknown>).answer ?? (a as Record<string, unknown>).value ?? (a as Record<string, unknown>).text ?? a;
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function computeAnalysis(draft: DigestDraft, answers: Record<string, unknown>) {
  const answerKeys = Object.keys(answers);
  const digestKeys = new Set(draft.fields.map((f) => f.key));
  return {
    newKeys: answerKeys.filter((k) => !digestKeys.has(k)),
    missingKeys: new Set<string>(draft.fields.filter((f) => !answerKeys.includes(f.key)).map((f) => String(f.key))),
    emptyKeys: new Set<string>(answerKeys.filter((k) => digestKeys.has(k) && !getAnswerText(answers, k))),
  };
}

function newSectionId() {
  return `sec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function reorderByIdx<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next.map((x, i) => ({ ...x, order: i }));
}

function splitKeys(value: string): string[] {
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

// ── ColorDot ──────────────────────────────────────────────────────────────────

function ColorDot({ color, size = "sm" }: { color?: string; size?: "sm" | "md" }) {
  const p = getPalette(color);
  const sz = size === "md" ? "h-3.5 w-3.5" : "h-2.5 w-2.5";
  return <span className={`inline-block flex-shrink-0 rounded-full ${sz} ${p.dot}`} />;
}

// ── ColorPicker ───────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }: { value?: string; onChange: (k: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title="Section color"
        className="flex h-5 w-5 items-center justify-center rounded hover:bg-white/60"
        onClick={() => setOpen((v) => !v)}
      >
        <ColorDot color={value} size="md" />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1 flex gap-1.5 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          {PALETTE.map((p) => (
            <button
              key={p.key}
              type="button"
              title={p.key}
              className={`h-5 w-5 rounded-full transition-transform hover:scale-125 ${p.dot} ${value === p.key ? "ring-2 ring-offset-1 ring-slate-500" : ""}`}
              onClick={() => { onChange(p.key); setOpen(false); }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 select-none">
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative h-5 w-9 rounded-full transition-colors ${value ? "bg-blue-500" : "bg-slate-300"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${value ? "translate-x-4" : "translate-x-0.5"}`} />
      </button>
      {label ? <span className="text-xs text-slate-700">{label}</span> : null}
    </label>
  );
}

// ── SettingsPanel ─────────────────────────────────────────────────────────────

type SettingsPanelProps = {
  draft: DigestDraft;
  linkDraft: DigestLinkDraft;
  onDraftChange: (d: DigestDraft) => void;
  onLinkChange: (l: DigestLinkDraft) => void;
};

function SettingsPanel({ draft, linkDraft, onDraftChange, onLinkChange }: SettingsPanelProps) {
  const opts = draft.options;
  const task = opts?.task;
  const spending = (opts as Record<string, unknown> | undefined)?.spending as Record<string, unknown> | undefined;
  const setOpts = (patch: Partial<typeof opts>) => onDraftChange({ ...draft, options: { ...opts, ...patch } as typeof opts });
  const setTask = (patch: Partial<typeof task>) => setOpts({ task: { ...task, ...patch } as typeof task });
  const setSpending = (patch: Record<string, unknown>) => setOpts({ spending: { ...(spending || {}), ...patch } } as Partial<typeof opts>);
  const applySpendingPreset = () => {
    const template = buildLineItemsDigestTemplate({
      formId: draft.formId,
      formAlias: draft.formAlias,
      formTitle: draft.formTitle,
    });
    const preset = (template?.options as Record<string, unknown> | undefined)?.spending as Record<string, unknown> | undefined;
    if (!preset) return;
    setSpending(preset);
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      {/* Form meta */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Form Title</label>
          <input
            className="input w-full text-sm"
            value={draft.formTitle || ""}
            onChange={(e) => onDraftChange({ ...draft, formTitle: e.currentTarget.value || null })}
            placeholder="Display title"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Form Alias</label>
          <input
            className="input w-full text-sm"
            value={draft.formAlias || ""}
            onChange={(e) => onDraftChange({ ...draft, formAlias: e.currentTarget.value || null })}
            placeholder="e.g. credit-card-purchases"
          />
        </div>
      </div>

      {/* Submission linking */}
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Link Submission To</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[11px] text-slate-500">Grant</label>
            <GrantSelect
              value={linkDraft.grantId || null}
              onChange={(id) => onLinkChange({ ...linkDraft, grantId: id || "" })}
              includeUnassigned
              placeholderLabel="— No grant —"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-slate-500">Customer</label>
            <CustomerSearch
              value={linkDraft.customerId || null}
              onChange={(r) => onLinkChange({ ...linkDraft, customerId: r?.id || "" })}
              placeholder="— No customer —"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-slate-500">Enrollment</label>
            <EnrollmentSelect
              value={linkDraft.enrollmentId || null}
              onChange={(id) => onLinkChange({ ...linkDraft, enrollmentId: id || "" })}
              filterByClientIds={linkDraft.customerId ? [linkDraft.customerId] : undefined}
              filterByGrantId={linkDraft.grantId || null}
              includeUnassigned
              placeholderLabel="— No enrollment —"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-slate-500">CW ID / HMIS</label>
            <div className="flex gap-2">
              <input className="input w-full text-sm" placeholder="CW ID" value={linkDraft.cwId} onChange={(e) => onLinkChange({ ...linkDraft, cwId: e.currentTarget.value })} />
              <input className="input w-full text-sm" placeholder="HMIS" value={linkDraft.hmisId} onChange={(e) => onLinkChange({ ...linkDraft, hmisId: e.currentTarget.value })} />
            </div>
          </div>
        </div>
      </div>

      {/* Display options */}
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Display Options</div>
        <div className="flex flex-wrap gap-4">
          <Toggle value={opts?.hideEmptyFields !== false} onChange={(v) => setOpts({ hideEmptyFields: v })} label="Hide empty fields" />
          <Toggle value={opts?.showQuestions !== false} onChange={(v) => setOpts({ showQuestions: v })} label="Show questions" />
          <Toggle value={opts?.showAnswers !== false} onChange={(v) => setOpts({ showAnswers: v })} label="Show answers" />
          <Toggle value={draft.header?.show !== false} onChange={(v) => onDraftChange({ ...draft, header: { ...draft.header, show: v } })} label="Show header" />
        </div>
        {draft.header?.show !== false ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <input className="input text-sm" placeholder="Header title" value={draft.header?.title || ""} onChange={(e) => onDraftChange({ ...draft, header: { ...draft.header, title: e.currentTarget.value || null } })} />
            <input className="input text-sm" placeholder="Header subtitle" value={draft.header?.subtitle || ""} onChange={(e) => onDraftChange({ ...draft, header: { ...draft.header, subtitle: e.currentTarget.value || null } })} />
          </div>
        ) : null}
      </div>

      {/* Spending map config */}
      <div>
        <div className="mb-2 flex items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Spending Map</span>
          <Toggle value={spending?.enabled === true} onChange={(v) => setSpending({ enabled: v })} />
          {isLineItemsFormId(draft.formId) ? (
            <button type="button" className="btn btn-ghost btn-xs" onClick={applySpendingPreset}>
              Load spending preset
            </button>
          ) : null}
        </div>
        {spending?.enabled === true ? (
          <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">Form Kind</label>
                <select
                  className="input w-full text-sm"
                  value={String(spending?.schemaKind || "other")}
                  onChange={(e) => setSpending({ schemaKind: e.currentTarget.value })}
                >
                  <option value="credit-card">Credit card</option>
                  <option value="invoice">Invoice</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">Amount Field Keys</label>
                <input
                  className="input w-full text-sm"
                  value={Array.isArray(spending?.amountFieldKeys) ? (spending.amountFieldKeys as string[]).join(", ") : ""}
                  onChange={(e) => setSpending({ amountFieldKeys: splitKeys(e.currentTarget.value) })}
                  placeholder="86, 107, 291"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">Grant Field Keys</label>
                <input className="input w-full text-sm" value={Array.isArray(spending?.grantFieldKeys) ? (spending.grantFieldKeys as string[]).join(", ") : ""} onChange={(e) => setSpending({ grantFieldKeys: splitKeys(e.currentTarget.value) })} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">Line Item Field Keys</label>
                <input className="input w-full text-sm" value={Array.isArray(spending?.lineItemFieldKeys) ? (spending.lineItemFieldKeys as string[]).join(", ") : ""} onChange={(e) => setSpending({ lineItemFieldKeys: splitKeys(e.currentTarget.value) })} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">Customer Field Keys</label>
                <input className="input w-full text-sm" value={Array.isArray(spending?.customerFieldKeys) ? (spending.customerFieldKeys as string[]).join(", ") : ""} onChange={(e) => setSpending({ customerFieldKeys: splitKeys(e.currentTarget.value) })} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">Merchant Field Keys</label>
                <input className="input w-full text-sm" value={Array.isArray(spending?.merchantFieldKeys) ? (spending.merchantFieldKeys as string[]).join(", ") : ""} onChange={(e) => setSpending({ merchantFieldKeys: splitKeys(e.currentTarget.value) })} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">Card Field Keys</label>
                <input className="input w-full text-sm" value={Array.isArray(spending?.cardFieldKeys) ? (spending.cardFieldKeys as string[]).join(", ") : ""} onChange={(e) => setSpending({ cardFieldKeys: splitKeys(e.currentTarget.value) })} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">Direction Field Keys</label>
                <input className="input w-full text-sm" value={Array.isArray(spending?.directionFieldKeys) ? (spending.directionFieldKeys as string[]).join(", ") : ""} onChange={(e) => setSpending({ directionFieldKeys: splitKeys(e.currentTarget.value) })} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">Category Field Keys</label>
                <input className="input w-full text-sm" value={Array.isArray(spending?.categoryFieldKeys) ? (spending.categoryFieldKeys as string[]).join(", ") : ""} onChange={(e) => setSpending({ categoryFieldKeys: splitKeys(e.currentTarget.value) })} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">Split Field Keys</label>
                <input
                  className="input w-full text-sm"
                  value={Array.isArray(spending?.splitFieldKeys) ? (spending.splitFieldKeys as string[]).join(", ") : ""}
                  onChange={(e) => setSpending({ splitFieldKeys: splitKeys(e.currentTarget.value) })}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">Flex Field Keys</label>
                <input
                  className="input w-full text-sm"
                  value={Array.isArray(spending?.flexFieldKeys) ? (spending.flexFieldKeys as string[]).join(", ") : ""}
                  onChange={(e) => setSpending({ flexFieldKeys: splitKeys(e.currentTarget.value) })}
                />
              </div>
            </div>
            <textarea
              className="input min-h-20 w-full text-sm"
              value={String(spending?.notes || "")}
              onChange={(e) => setSpending({ notes: e.currentTarget.value || null })}
              placeholder="Special mapping notes, PATH categories, keyword buckets, exact aliases, or review instructions."
            />
          </div>
        ) : null}
      </div>

      {/* Task config */}
      <div>
        <div className="mb-2 flex items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Task Creation</span>
          <Toggle value={task?.enabled === true} onChange={(v) => setTask({ enabled: v })} />
        </div>
        {task?.enabled ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">Assigned To Group</label>
                <select className="input w-full text-sm" value={task?.assignedToGroup || "admin"} onChange={(e) => setTask({ assignedToGroup: e.currentTarget.value as "admin" | "compliance" | "casemanager" })}>
                  <option value="admin">Admin</option>
                  <option value="compliance">Compliance</option>
                  <option value="casemanager">Case Manager</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">Assigned User (optional)</label>
                <UserSelect
                  value={(task as Record<string, unknown>)?.assignedToUid as string | null ?? null}
                  onChange={(uid) => setTask({ assignedToUid: uid || null } as Record<string, unknown>)}
                  includeUnassigned
                  placeholderLabel="— Auto by group —"
                />
              </div>
            </div>
            <input className="input w-full text-sm" placeholder="Task title prefix (e.g. 'Review:')" value={task?.titlePrefix || ""} onChange={(e) => setTask({ titlePrefix: e.currentTarget.value || null })} />
            <div className="text-[11px] text-slate-500">Title / subtitle field keys (comma-separated)</div>
            <div className="grid grid-cols-2 gap-3">
              <input className="input text-sm" placeholder="Title field keys" value={(task?.titleFieldKeys || []).join(", ")} onChange={(e) => setTask({ titleFieldKeys: splitKeys(e.currentTarget.value) })} />
              <input className="input text-sm" placeholder="Subtitle field keys" value={(task?.subtitleFieldKeys || []).join(", ")} onChange={(e) => setTask({ subtitleFieldKeys: splitKeys(e.currentTarget.value) })} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── MissingFieldsBanner ───────────────────────────────────────────────────────

function MissingFieldsBanner({
  newKeys,
  answers,
  onAddAll,
  onAddOne,
}: {
  newKeys: string[];
  answers: Record<string, unknown>;
  onAddAll: () => void;
  onAddOne: (key: string) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  if (!newKeys.length) return null;
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-blue-800">
            {newKeys.length} new field{newKeys.length !== 1 ? "s" : ""} found in this submission
          </span>
          <span className="rounded-full bg-blue-200 px-1.5 py-0.5 text-[11px] font-bold text-blue-800">{newKeys.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-sm text-blue-700 hover:bg-blue-100" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Hide" : "Show"}
          </button>
          <button className="btn btn-sm bg-blue-600 text-white hover:bg-blue-700" onClick={onAddAll}>
            Add All
          </button>
        </div>
      </div>
      {expanded ? (
        <div className="mt-3 space-y-1.5">
          {newKeys.map((key) => {
            const preview = getAnswerText(answers, key);
            return (
              <div key={key} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-xs">
                <div>
                  <span className="font-mono text-slate-700">{key}</span>
                  {preview ? <span className="ml-2 text-slate-500">"{preview.slice(0, 60)}{preview.length > 60 ? "…" : ""}"</span> : <span className="ml-2 italic text-slate-400">empty</span>}
                </div>
                <button className="btn btn-ghost btn-sm text-blue-600" onClick={() => onAddOne(key)}>+ Add</button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

// ── FieldRow ──────────────────────────────────────────────────────────────────

type FieldRowProps = {
  field: TJotformDigestField;
  answerPreview: string;
  isMissing: boolean;
  isEmpty: boolean;
  sections: DraftSection[];
  isDragOver: boolean;
  onChange: (patch: Partial<TJotformDigestField>) => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
};

function FieldRow({ field, answerPreview, isMissing, isEmpty, sections, isDragOver, onChange, onRemove, onDragStart, onDragOver, onDrop }: FieldRowProps) {
  const [editing, setEditing] = React.useState(false);
  return (
    <div
      className={`group relative flex items-center gap-2 rounded-lg border px-3 py-2 transition-all ${
        isDragOver ? "border-blue-400 bg-blue-50" : isMissing ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white hover:border-slate-300"
      }`}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Drag handle */}
      <div className="flex-shrink-0 cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing">
        <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor"><circle cx="4" cy="3" r="1.5"/><circle cx="8" cy="3" r="1.5"/><circle cx="4" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="4" cy="13" r="1.5"/><circle cx="8" cy="13" r="1.5"/></svg>
      </div>

      {/* Show/hide toggle */}
      <button
        type="button"
        title={field.show ? "Visible — click to hide" : "Hidden — click to show"}
        onClick={() => onChange({ show: !field.show })}
        className={`flex-shrink-0 h-5 w-5 rounded-full border-2 transition-colors ${field.show ? "border-blue-400 bg-blue-400" : "border-slate-300 bg-white"}`}
      />

      {/* Label */}
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            className="input w-full py-0.5 text-sm"
            value={field.label}
            onChange={(e) => onChange({ label: e.currentTarget.value })}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditing(false); }}
          />
        ) : (
          <button
            type="button"
            className={`text-left text-sm font-medium transition-colors ${field.show ? "text-slate-900" : "text-slate-400 line-through"}`}
            onClick={() => setEditing(true)}
            title="Click to edit label"
          >
            {field.label || field.key}
          </button>
        )}
        <div className="mt-0.5 flex items-center gap-2">
          <span className="font-mono text-[10px] text-slate-400">{field.key}</span>
          {isMissing && <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">missing from form</span>}
        </div>
      </div>

      {/* Answer preview */}
      <div className="hidden w-40 flex-shrink-0 truncate text-right text-xs md:block">
        {isMissing ? (
          <span className="italic text-rose-400">field removed from form</span>
        ) : answerPreview ? (
          <span className="text-slate-600" title={answerPreview}>{answerPreview.slice(0, 40)}{answerPreview.length > 40 ? "…" : ""}</span>
        ) : (
          <span className="italic text-slate-400">{isEmpty ? "⚠ empty answer" : "no answer"}</span>
        )}
      </div>

      {/* Section assignment */}
      <select
        className="hidden flex-shrink-0 rounded border border-slate-200 bg-slate-50 py-1 pl-2 pr-6 text-xs text-slate-600 md:block"
        value={field.sectionId || ""}
        onChange={(e) => onChange({ sectionId: e.currentTarget.value || null })}
      >
        <option value="">Ungrouped</option>
        {sections.map((s) => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>

      {/* More options */}
      <div className="flex flex-shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          title={field.hideIfEmpty ? "Hides when empty (click to always show)" : "Always visible (click to hide when empty)"}
          onClick={() => onChange({ hideIfEmpty: !field.hideIfEmpty })}
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${field.hideIfEmpty ? "bg-slate-100 text-slate-500 hover:bg-slate-200" : "bg-amber-100 text-amber-700"}`}
        >
          {field.hideIfEmpty ? "hide∅" : "show∅"}
        </button>
        <button
          type="button"
          title="Remove from digest"
          onClick={onRemove}
          className="rounded px-1.5 py-0.5 text-[10px] text-rose-400 hover:bg-rose-50 hover:text-rose-600"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ── SectionBlock ──────────────────────────────────────────────────────────────

type SectionBlockProps = {
  section: DraftSection;
  fields: TJotformDigestField[];
  allSections: DraftSection[];
  answers: Record<string, unknown>;
  missingKeys: Set<string>;
  emptyKeys: Set<string>;
  dragOverId: string | null;
  onSectionChange: (patch: Partial<DraftSection>) => void;
  onSectionRemove: () => void;
  onFieldChange: (key: string, patch: Partial<TJotformDigestField>) => void;
  onFieldRemove: (key: string) => void;
  onDragStartField: (key: string, sectionId: string | null) => void;
  onDragStartSection: (id: string) => void;
  onDragOver: (e: React.DragEvent, targetId: string) => void;
  onDropOnField: (targetKey: string) => void;
  onDropOnSection: (targetId: string) => void;
};

function SectionBlock({
  section, fields, allSections, answers, missingKeys, emptyKeys, dragOverId,
  onSectionChange, onSectionRemove, onFieldChange, onFieldRemove,
  onDragStartField, onDragStartSection, onDragOver, onDropOnField, onDropOnSection,
}: SectionBlockProps) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [editingLabel, setEditingLabel] = React.useState(false);
  const pal = getPalette(section.color);

  return (
    <div
      className={`rounded-xl border ${pal.header} overflow-hidden transition-all`}
      onDragOver={(e) => onDragOver(e, section.id)}
      onDrop={() => onDropOnSection(section.id)}
    >
      {/* Section header */}
      <div
        className={`flex items-center gap-2 border-b px-3 py-2 ${pal.header}`}
        draggable
        onDragStart={() => onDragStartSection(section.id)}
      >
        <div className="cursor-grab text-slate-400 active:cursor-grabbing">
          <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor"><circle cx="4" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/><circle cx="4" cy="7" r="1.5"/><circle cx="8" cy="7" r="1.5"/><circle cx="4" cy="12" r="1.5"/><circle cx="8" cy="12" r="1.5"/></svg>
        </div>

        <ColorPicker value={section.color} onChange={(c) => onSectionChange({ color: c })} />

        {editingLabel ? (
          <input
            autoFocus
            className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-sm font-semibold"
            value={section.label}
            onChange={(e) => onSectionChange({ label: e.currentTarget.value })}
            onBlur={() => setEditingLabel(false)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditingLabel(false); }}
          />
        ) : (
          <button
            type="button"
            className={`min-w-0 flex-1 text-left text-sm font-semibold ${pal.text}`}
            onClick={() => setEditingLabel(true)}
          >
            {section.label}
          </button>
        )}

        <span className="text-[11px] text-slate-500">{fields.length} field{fields.length !== 1 ? "s" : ""}</span>

        <Toggle value={section.show !== false} onChange={(v) => onSectionChange({ show: v })} />

        <button
          type="button"
          title="Collapse / expand section"
          onClick={() => setCollapsed((v) => !v)}
          className="text-slate-400 hover:text-slate-600"
        >
          {collapsed ? "▸" : "▾"}
        </button>

        <button
          type="button"
          title="Remove section (fields become ungrouped)"
          onClick={onSectionRemove}
          className="text-slate-400 hover:text-rose-500"
        >
          ✕
        </button>
      </div>

      {/* Section fields */}
      {!collapsed ? (
        <div className="space-y-1.5 p-2">
          {fields.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-400">
              Drop fields here or assign from field rows
            </div>
          ) : (
            fields.map((f) => (
              <FieldRow
                key={f.key}
                field={f}
                answerPreview={getAnswerText(answers, f.key)}
                isMissing={missingKeys.has(f.key)}
                isEmpty={emptyKeys.has(f.key)}
                sections={allSections}
                isDragOver={dragOverId === f.key}
                onChange={(patch) => onFieldChange(f.key, patch)}
                onRemove={() => onFieldRemove(f.key)}
                onDragStart={() => onDragStartField(f.key, section.id)}
                onDragOver={(e) => onDragOver(e, f.key)}
                onDrop={() => onDropOnField(f.key)}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

// ── AddFieldDialog ────────────────────────────────────────────────────────────

type AddFieldDialogProps = {
  newKeys: string[];
  answers: Record<string, unknown>;
  onAdd: (field: TJotformDigestField) => void;
  onClose: () => void;
};

function AddFieldDialog({ newKeys, answers, onAdd, onClose }: AddFieldDialogProps) {
  const [tab, setTab] = React.useState<"submission" | "custom">("submission");
  const [customKey, setCustomKey] = React.useState("");
  const [customLabel, setCustomLabel] = React.useState("");
  const [customType, setCustomType] = React.useState<"question" | "header" | "section">("question");
  const nextOrder = 9999;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="text-base font-semibold text-slate-900">Add Field to Digest</div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <div className="flex gap-1 border-b border-slate-200 px-5 pt-3">
          {(["submission", "custom"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-t px-3 py-1.5 text-sm transition ${tab === t ? "border border-b-white border-slate-200 bg-white font-semibold text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
            >
              {t === "submission" ? `From Submission (${newKeys.length})` : "Custom Field"}
            </button>
          ))}
        </div>

        <div className="max-h-80 overflow-auto p-5">
          {tab === "submission" ? (
            newKeys.length ? (
              <div className="space-y-1.5">
                {newKeys.map((key) => {
                  const preview = getAnswerText(answers, key);
                  return (
                    <button
                      key={key}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-left hover:border-blue-300 hover:bg-blue-50 transition-colors"
                      onClick={() => onAdd({ key, label: key, questionLabel: null, type: "question", sectionId: null, show: true, hideIfEmpty: true, order: nextOrder })}
                    >
                      <div>
                        <div className="font-mono text-sm text-slate-700">{key}</div>
                        {preview ? <div className="mt-0.5 truncate text-xs text-slate-500">"{preview.slice(0, 60)}"</div> : <div className="mt-0.5 text-xs italic text-slate-400">empty answer</div>}
                      </div>
                      <span className="text-sm text-blue-500">+ Add</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-slate-500">All submission fields are already in the digest.</div>
            )
          ) : (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Field Key</label>
                <input className="input w-full" placeholder="e.g. custom_note" value={customKey} onChange={(e) => setCustomKey(e.currentTarget.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Display Label</label>
                <input className="input w-full" placeholder="e.g. Notes" value={customLabel} onChange={(e) => setCustomLabel(e.currentTarget.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Field Type</label>
                <select className="input w-full" value={customType} onChange={(e) => setCustomType(e.currentTarget.value as typeof customType)}>
                  <option value="question">Question / Answer</option>
                  <option value="header">Header (visual divider)</option>
                  <option value="section">Section marker</option>
                </select>
              </div>
              <button
                type="button"
                className="btn w-full"
                disabled={!customKey.trim() || !customLabel.trim()}
                onClick={() => {
                  onAdd({ key: customKey.trim(), label: customLabel.trim(), questionLabel: null, type: customType, sectionId: null, show: true, hideIfEmpty: false, order: nextOrder });
                  setCustomKey(""); setCustomLabel("");
                }}
              >
                Add Field
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── DigestEditorPane ──────────────────────────────────────────────────────────

export type DigestEditorPaneProps = {
  submission: JotformSubmission;
  digestMap: TJotformDigestMap | null;
  formId: string;
  formAlias?: string | null;
  formTitle?: string | null;
  saving: boolean;
  onSave: (draft: TJotformDigestMap, linkDraft: DigestLinkDraft) => Promise<void>;
  onCancel: () => void;
};

export function DigestEditorPane({ submission, digestMap, formId, formAlias, formTitle, saving, onSave, onCancel }: DigestEditorPaneProps) {
  const [draft, setDraft] = React.useState<DigestDraft>(() => initDraft(digestMap, formId, formAlias, formTitle));
  const [linkDraft, setLinkDraft] = React.useState<DigestLinkDraft>(() => initLinkDraft(submission));
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [addFieldOpen, setAddFieldOpen] = React.useState(false);
  const [dragItem, setDragItem] = React.useState<DragItem | null>(null);
  const [dragOverId, setDragOverId] = React.useState<string | null>(null);

  // Rebuild answer map from submission
  const answers = React.useMemo<Record<string, unknown>>(
    () => ((submission as Record<string, unknown>).answers as Record<string, unknown>) ?? {},
    [submission],
  );

  // Missing / new field analysis
  const { newKeys, missingKeys, emptyKeys } = React.useMemo(
    () => computeAnalysis(draft, answers),
    [draft, answers],
  );

  const dirty = React.useMemo(() => {
    if (!digestMap) return draft.fields.length > 0 || draft.sections.length > 0;
    return JSON.stringify(draft) !== JSON.stringify(initDraft(digestMap, formId, formAlias, formTitle));
  }, [draft, digestMap, formId, formAlias, formTitle]);

  // ── Draft helpers ──────────────────────────────────────────────────────────

  const setField = (key: string, patch: Partial<TJotformDigestField>) => {
    setDraft((d) => ({ ...d, fields: d.fields.map((f) => f.key === key ? { ...f, ...patch } : f) }));
  };

  const removeField = (key: string) => {
    setDraft((d) => ({ ...d, fields: d.fields.filter((f) => f.key !== key) }));
  };

  const addField = (field: TJotformDigestField) => {
    setDraft((d) => {
      if (d.fields.some((f) => f.key === field.key)) return d;
      const maxOrder = d.fields.reduce((m, f) => Math.max(m, f.order), -1);
      return { ...d, fields: [...d.fields, { ...field, order: maxOrder + 1 }] };
    });
    setAddFieldOpen(false);
  };

  const addAllNewFields = () => {
    setDraft((d) => {
      const existing = new Set(d.fields.map((f) => f.key));
      const maxOrder = d.fields.reduce((m, f) => Math.max(m, f.order), -1);
      const toAdd = newKeys
        .filter((k) => !existing.has(k))
        .map((k, i) => ({ key: k, label: k, questionLabel: null, type: "question" as const, sectionId: null, show: true, hideIfEmpty: true, order: maxOrder + 1 + i }));
      return { ...d, fields: [...d.fields, ...toAdd] };
    });
  };

  const setSection = (id: string, patch: Partial<DraftSection>) => {
    setDraft((d) => ({ ...d, sections: d.sections.map((s) => s.id === id ? { ...s, ...patch } : s) }));
  };

  const removeSection = (id: string) => {
    setDraft((d) => ({
      ...d,
      sections: d.sections.filter((s) => s.id !== id),
      fields: d.fields.map((f) => f.sectionId === id ? { ...f, sectionId: null } : f),
    }));
  };

  const addSection = () => {
    const id = newSectionId();
    const nextColor = PALETTE[draft.sections.length % PALETTE.length].key;
    setDraft((d) => ({
      ...d,
      sections: [...d.sections, { id, label: "New Section", show: true, order: d.sections.length, color: nextColor }],
    }));
  };

  // ── Drag-and-drop ──────────────────────────────────────────────────────────

  const handleDragStartField = (key: string, sectionId: string | null) => {
    setDragItem({ kind: "field", key, sectionId });
  };

  const handleDragStartSection = (id: string) => {
    setDragItem({ kind: "section", id });
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverId(targetId);
  };

  const handleDropOnField = (targetKey: string) => {
    if (!dragItem || dragItem.kind !== "field" || dragItem.key === targetKey) {
      setDragItem(null); setDragOverId(null); return;
    }
    setDraft((d) => {
      const fromIdx = d.fields.findIndex((f) => f.key === dragItem.key);
      const toIdx = d.fields.findIndex((f) => f.key === targetKey);
      if (fromIdx === -1 || toIdx === -1) return d;
      return { ...d, fields: reorderByIdx(d.fields, fromIdx, toIdx) };
    });
    setDragItem(null); setDragOverId(null);
  };

  const handleDropOnSection = (targetSectionId: string) => {
    if (!dragItem) { setDragItem(null); setDragOverId(null); return; }
    if (dragItem.kind === "field") {
      // Move field into this section
      setDraft((d) => ({ ...d, fields: d.fields.map((f) => f.key === dragItem.key ? { ...f, sectionId: targetSectionId } : f) }));
    } else if (dragItem.kind === "section" && dragItem.id !== targetSectionId) {
      // Reorder sections
      setDraft((d) => {
        const fromIdx = d.sections.findIndex((s) => s.id === dragItem.id);
        const toIdx = d.sections.findIndex((s) => s.id === targetSectionId);
        if (fromIdx === -1 || toIdx === -1) return d;
        return { ...d, sections: reorderByIdx(d.sections, fromIdx, toIdx) };
      });
    }
    setDragItem(null); setDragOverId(null);
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    // Normalize field orders
    const normalized: TJotformDigestMap = {
      ...draft,
      fields: draft.fields.map((f, i) => ({ ...f, order: i })),
      sections: draft.sections.map((s, i) => ({ ...s, order: i })),
    } as unknown as TJotformDigestMap;
    await onSave(normalized, linkDraft);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const sortedSections = [...draft.sections].sort((a, b) => a.order - b.order);
  const fieldsBySection = React.useMemo(() => {
    const map = new Map<string | null, TJotformDigestField[]>();
    map.set(null, []);
    sortedSections.forEach((s) => map.set(s.id, []));
    [...draft.fields].sort((a, b) => a.order - b.order).forEach((f) => {
      const bucket = (f.sectionId && map.has(f.sectionId)) ? f.sectionId : null;
      map.get(bucket)!.push(f);
    });
    return map;
  }, [draft.fields, sortedSections]);

  return (
    <div className="relative flex flex-col gap-0 rounded-2xl ring-2 ring-blue-400 overflow-hidden shadow-lg">
      {/* Edit mode header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-200 bg-blue-600 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">✏ Editing Digest</span>
          <span className="rounded-full bg-blue-500 px-2 py-0.5 text-xs text-blue-100">
            {formTitle || formAlias || formId}
          </span>
          {dirty ? <span className="rounded-full bg-blue-400 px-2 py-0.5 text-[11px] text-white">unsaved changes</span> : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-sm border border-blue-400 bg-blue-700 text-white hover:bg-blue-800"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-sm bg-white text-blue-700 hover:bg-blue-50 disabled:opacity-60"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save Digest"}
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-auto bg-slate-50">
        {/* Settings toggle */}
        <div className="border-b border-slate-200 bg-white px-4">
          <button
            type="button"
            className="flex w-full items-center justify-between py-3 text-sm font-medium text-slate-700 hover:text-slate-900"
            onClick={() => setSettingsOpen((v) => !v)}
          >
            <span>⚙ Settings — Form, Linking &amp; Display Options</span>
            <span className="text-slate-400">{settingsOpen ? "▲" : "▼"}</span>
          </button>
          {settingsOpen ? (
            <div className="pb-4">
              <SettingsPanel
                draft={draft}
                linkDraft={linkDraft}
                onDraftChange={setDraft}
                onLinkChange={setLinkDraft}
              />
            </div>
          ) : null}
        </div>

        {/* Field editor */}
        <div className="p-4 space-y-3">
          {/* New-field banner */}
          <MissingFieldsBanner
            newKeys={newKeys}
            answers={answers}
            onAddAll={addAllNewFields}
            onAddOne={(key) => addField({ key, label: key, questionLabel: null, type: "question", sectionId: null, show: true, hideIfEmpty: true, order: 9999 })}
          />

          {/* Field list toolbar */}
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Fields ({draft.fields.length})
              {missingKeys.size > 0 ? <span className="ml-2 rounded-full bg-rose-100 px-1.5 py-0.5 text-rose-700">{missingKeys.size} missing</span> : null}
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAddFieldOpen(true)}>+ Add Field</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={addSection}>+ Add Section</button>
            </div>
          </div>

          {/* Ungrouped fields */}
          {(fieldsBySection.get(null) ?? []).length > 0 ? (
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Ungrouped</div>
              {(fieldsBySection.get(null) ?? []).map((f) => (
                <FieldRow
                  key={f.key}
                  field={f}
                  answerPreview={getAnswerText(answers, f.key)}
                  isMissing={missingKeys.has(f.key)}
                  isEmpty={emptyKeys.has(f.key)}
                  sections={draft.sections}
                  isDragOver={dragOverId === f.key}
                  onChange={(patch) => setField(f.key, patch)}
                  onRemove={() => removeField(f.key)}
                  onDragStart={() => handleDragStartField(f.key, null)}
                  onDragOver={(e) => handleDragOver(e, f.key)}
                  onDrop={() => handleDropOnField(f.key)}
                />
              ))}
            </div>
          ) : null}

          {/* Section blocks */}
          {sortedSections.map((section) => (
            <SectionBlock
              key={section.id}
              section={section}
              fields={fieldsBySection.get(section.id) ?? []}
              allSections={draft.sections}
              answers={answers}
              missingKeys={missingKeys}
              emptyKeys={emptyKeys}
              dragOverId={dragOverId}
              onSectionChange={(patch) => setSection(section.id, patch)}
              onSectionRemove={() => removeSection(section.id)}
              onFieldChange={setField}
              onFieldRemove={removeField}
              onDragStartField={handleDragStartField}
              onDragStartSection={handleDragStartSection}
              onDragOver={handleDragOver}
              onDropOnField={handleDropOnField}
              onDropOnSection={handleDropOnSection}
            />
          ))}

          {draft.fields.length === 0 && newKeys.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-400">
              No fields configured. Pull a submission then click <strong>Add Field</strong> or <strong>Add All</strong> to populate.
            </div>
          ) : null}
        </div>
      </div>

      {/* Add field dialog */}
      {addFieldOpen ? (
        <AddFieldDialog
          newKeys={newKeys}
          answers={answers}
          onAdd={addField}
          onClose={() => setAddFieldOpen(false)}
        />
      ) : null}
    </div>
  );
}
