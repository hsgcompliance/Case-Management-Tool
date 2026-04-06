"use client";

import React from "react";
import { toast } from "@lib/toast";
import { toApiError } from "@client/api";
import {
  useJotformDigest,
  useJotformDigests,
  useJotformForms,
  useJotformSubmissions,
  useSyncJotformSelection,
  useUpsertJotformDigest,
} from "@hooks/useJotform";
import type { JotformDigestMap, JotformSubmission } from "@hooks/useJotform";
import type { JotformDigestUpsertReq, JotformSyncSelectionReq } from "@types";
import { buildLineItemsDigestTemplate, isLineItemsFormId, LINE_ITEMS_FORM_IDS } from "@widgets/jotform/lineItemsFormMap";

type DigestField = NonNullable<JotformDigestMap["fields"]>[number];
type DigestSection = NonNullable<JotformDigestMap["sections"]>[number];

type SampleField = {
  key: string;
  label: string;
  questionLabel: string;
  preview: string;
};

const asText = (value: unknown): string => {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const out = Object.values(value as Record<string, unknown>).map(asText).filter(Boolean).join(" ");
    return out;
  }
  return "";
};

const fieldPreview = (entry: unknown): string => {
  const obj = (entry && typeof entry === "object") ? (entry as Record<string, unknown>) : null;
  const value = obj?.answer ?? obj?.prettyFormat ?? obj?.value ?? entry;
  const txt = asText(value).trim();
  if (!txt) return "";
  return txt.length > 100 ? `${txt.slice(0, 100)}...` : txt;
};

const extractSampleFields = (submission: JotformSubmission | null | undefined): SampleField[] => {
  const answers = submission?.answers;
  if (!answers || typeof answers !== "object") return [];
  const out: SampleField[] = [];
  for (const [key, raw] of Object.entries(answers as Record<string, unknown>)) {
    const entry = (raw && typeof raw === "object") ? (raw as Record<string, unknown>) : null;
    const questionLabel = String(entry?.text || entry?.name || key).trim();
    const label = questionLabel || key;
    out.push({
      key: String(key),
      label,
      questionLabel,
      preview: fieldPreview(entry),
    });
  }
  return out;
};

const emptyDraft = (form: { id: string; title?: string | null; alias?: string | null }): JotformDigestMap => ({
  id: form.id,
  formId: form.id,
  formTitle: form.title || null,
  formAlias: form.alias || null,
  header: {
    show: true,
    title: form.title || null,
    subtitle: null,
  },
  sections: [],
  fields: [],
  options: {
    hideEmptyFields: true,
    showQuestions: true,
    showAnswers: true,
    task: {
      enabled: false,
      assignedToGroup: "admin",
      titlePrefix: null,
      titleFieldKeys: [],
      subtitleFieldKeys: [],
    },
  },
});

function mergeFields(existing: DigestField[] | null | undefined, sampled: SampleField[]): DigestField[] {
  const prev = Array.isArray(existing) ? existing : [];
  const byKey = new Map(prev.map((f) => [String(f.key), f]));
  const next: DigestField[] = [];

  sampled.forEach((s, idx) => {
    const hit = byKey.get(s.key);
    next.push(
      hit
        ? {
            ...hit,
            key: s.key,
            questionLabel: hit.questionLabel || s.questionLabel,
            label: hit.label || s.label,
            order: Number.isFinite(Number(hit.order)) ? Number(hit.order) : idx,
          }
        : {
            key: s.key,
            label: s.label,
            questionLabel: s.questionLabel || null,
            type: "question",
            sectionId: null,
            show: true,
            hideIfEmpty: true,
            order: idx,
          }
    );
  });

  prev.forEach((f) => {
    if (!sampled.find((s) => s.key === f.key)) next.push(f);
  });

  return next;
}

const digestSignature = (value: JotformDigestMap | null | undefined): string => {
  if (!value) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
};

const LINE_ITEM_FORM_CARDS = [
  {
    id: LINE_ITEMS_FORM_IDS.creditCard,
    label: "Credit Card Checkout",
    accent: "from-sky-500 to-cyan-400",
    tone: "Card spending form",
    description: "Card used, purchaser, transaction rows, and supporting uploads.",
  },
  {
    id: LINE_ITEMS_FORM_IDS.invoice,
    label: "Invoice Intake",
    accent: "from-amber-400 to-orange-300",
    tone: "Invoice spending form",
    description: "Vendor invoices, split allocations, and uploaded backup docs.",
  },
] as const;

export default function JotformDigestPanel({ initialFormId }: { initialFormId?: string }) {
  const [selectedFormId, setSelectedFormId] = React.useState(String(initialFormId || ""));
  const [draft, setDraft] = React.useState<JotformDigestMap | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [formSearch, setFormSearch] = React.useState("");
  const [builderMode, setBuilderMode] = React.useState<"basic" | "advanced">("basic");
  const [rawDraft, setRawDraft] = React.useState("");
  const [rawError, setRawError] = React.useState("");
  const [rawDirty, setRawDirty] = React.useState(false);

  const formsQ = useJotformForms({ search: formSearch || undefined, includeNoSubmissions: true, limit: 300 }, { staleTime: 60_000 });
  const digestsQ = useJotformDigests({}, { staleTime: 30_000 });
  const digestQ = useJotformDigest(
    selectedFormId ? { formId: selectedFormId } : undefined,
    { enabled: !!selectedFormId, staleTime: 10_000 }
  );
  const subsQ = useJotformSubmissions(
    selectedFormId ? { formId: selectedFormId, active: true, limit: 25 } : undefined,
    { enabled: !!selectedFormId, staleTime: 20_000 }
  );
  const upsert = useUpsertJotformDigest();
  const syncSelection = useSyncJotformSelection();

  const forms = React.useMemo(() => formsQ.data || [], [formsQ.data]);
  const existing = React.useMemo(() => digestsQ.data || [], [digestsQ.data]);
  const selectedForm =
    forms.find((f) => String(f.id) === String(selectedFormId)) ||
    (digestQ.data ? { id: digestQ.data.formId, title: digestQ.data.formTitle || digestQ.data.formId, alias: digestQ.data.formAlias || null } : null);
  const latestSubmission = (subsQ.data || [])[0] || null;
  const sampleFields = React.useMemo(() => extractSampleFields(latestSubmission), [latestSubmission]);
  const draftSig = React.useMemo(() => digestSignature(draft), [draft]);
  const digestByFormId = React.useMemo(
    () => new Map(existing.map((map) => [String(map.formId || map.id || ""), map])),
    [existing]
  );

  const selectForm = React.useCallback(
    (nextId: string) => {
      const normalized = String(nextId || "").trim();
      if (!normalized || normalized === selectedFormId) return;
      if (dirty && !window.confirm("You have unsaved changes. Switch forms and discard them?")) return;
      setSelectedFormId(normalized);
      setDirty(false);
    },
    [dirty, selectedFormId]
  );

  const lineItemCards = React.useMemo(
    () =>
      LINE_ITEM_FORM_CARDS.map((card) => {
        const form = forms.find((item) => String(item.id) === card.id) || null;
        const digest = digestByFormId.get(card.id) || null;
        return {
          ...card,
          form,
          digest,
          selected: selectedFormId === card.id,
          submissionCount: Number(form?.count || 0),
        };
      }),
    [digestByFormId, forms, selectedFormId]
  );

  React.useEffect(() => {
    const next = String(initialFormId || "").trim();
    if (!next || dirty || next === selectedFormId) return;
    setSelectedFormId(next);
    setDirty(false);
  }, [dirty, initialFormId, selectedFormId]);

  React.useEffect(() => {
    if (!selectedFormId) {
      setDraft(null);
      setDirty(false);
      return;
    }
    if (dirty) return;
    const base = digestQ.data
      ? ({ ...digestQ.data } as JotformDigestMap)
      : emptyDraft({
          id: selectedFormId,
          title: selectedForm?.title || null,
          alias: selectedForm?.alias || null,
        });
    const merged: JotformDigestMap = {
      ...base,
      formId: selectedFormId,
      id: selectedFormId,
      formTitle: base.formTitle || selectedForm?.title || null,
      formAlias: base.formAlias || selectedForm?.alias || null,
      fields: mergeFields(base.fields, sampleFields),
      sections: Array.isArray(base.sections) ? base.sections : [],
      options: {
        hideEmptyFields: base.options?.hideEmptyFields !== false,
        showQuestions: base.options?.showQuestions !== false,
        showAnswers: base.options?.showAnswers !== false,
        task: {
          enabled: base.options?.task?.enabled === true,
          assignedToGroup:
            base.options?.task?.assignedToGroup === "compliance" || base.options?.task?.assignedToGroup === "casemanager"
              ? base.options?.task?.assignedToGroup
              : "admin",
          titlePrefix: String(base.options?.task?.titlePrefix || "").trim() || null,
          titleFieldKeys: Array.isArray(base.options?.task?.titleFieldKeys)
            ? base.options.task.titleFieldKeys.map((k) => String(k || "").trim()).filter(Boolean)
            : [],
          subtitleFieldKeys: Array.isArray(base.options?.task?.subtitleFieldKeys)
            ? base.options.task.subtitleFieldKeys.map((k) => String(k || "").trim()).filter(Boolean)
            : [],
        },
      },
      header: {
        show: base.header?.show !== false,
        title: base.header?.title || selectedForm?.title || null,
        subtitle: base.header?.subtitle || null,
      },
    };
    setDraft((prev) => {
      if (digestSignature(prev) === digestSignature(merged)) return prev;
      return merged;
    });
  }, [selectedFormId, digestQ.data, selectedForm?.title, selectedForm?.alias, sampleFields, dirty]);

  React.useEffect(() => {
    if (!draft) {
      setRawDraft("");
      setRawError("");
      setRawDirty(false);
      return;
    }
    if (builderMode === "advanced" && rawDirty) return;
    setRawDraft(JSON.stringify(draft, null, 2));
    setRawError("");
    setRawDirty(false);
  }, [draftSig, draft, builderMode, rawDirty]);

  const markDirty = () => setDirty(true);

  const applySample = () => {
    if (!draft) return;
    setDraft((prev) => (prev ? { ...prev, fields: mergeFields(prev.fields, sampleFields) } : prev));
    markDirty();
  };

  const addSection = () => {
    if (!draft) return;
    const id = `section_${Date.now()}`;
    const next: DigestSection = { id, label: "New Section", show: true, order: (draft.sections || []).length };
    setDraft((prev) => (prev ? { ...prev, sections: [...(prev.sections || []), next] } : prev));
    markDirty();
  };

  const addField = () => {
    if (!draft) return;
    const maxOrder = Math.max(-1, ...(draft.fields || []).map((f) => Number(f.order || 0)));
    const next: DigestField = {
      key: `field_${Date.now()}`,
      label: "New Field",
      questionLabel: null,
      type: "question",
      sectionId: null,
      show: true,
      hideIfEmpty: true,
      order: maxOrder + 1,
    };
    setDraft((prev) => (prev ? { ...prev, fields: [...(prev.fields || []), next] } : prev));
    markDirty();
  };

  const patchFieldByKey = (key: string, patcher: (field: DigestField) => DigestField) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const fields = [...(prev.fields || [])];
      const at = fields.findIndex((x) => String(x.key) === String(key));
      if (at < 0) return prev;
      fields[at] = patcher(fields[at]);
      return { ...prev, fields };
    });
    markDirty();
  };

  const seedLineItemsTemplate = () => {
    if (!selectedFormId) return;
    if (!isLineItemsFormId(selectedFormId)) {
      toast("Selected form is not a configured line-items form.", { type: "error" });
      return;
    }
    const template = buildLineItemsDigestTemplate({
      formId: selectedFormId,
      formTitle: selectedForm?.title || null,
      formAlias: selectedForm?.alias || null,
    });
    if (!template) {
      toast("Unable to build line-items template.", { type: "error" });
      return;
    }
    setDraft(template as JotformDigestMap);
    setDirty(true);
    toast("Line-items template loaded into draft.", { type: "success" });
  };

  const applyAdvancedJson = () => {
    if (!rawDraft.trim()) {
      setRawError("JSON cannot be empty.");
      return;
    }
    try {
      const parsed = JSON.parse(rawDraft) as Record<string, unknown>;
      const normalized = {
        ...parsed,
        id: String(parsed.id || parsed.formId || selectedFormId || ""),
        formId: String(parsed.formId || parsed.id || selectedFormId || ""),
        formTitle: String(parsed.formTitle || selectedForm?.title || "") || null,
        formAlias: String(parsed.formAlias || selectedForm?.alias || "") || null,
        sections: Array.isArray(parsed.sections) ? parsed.sections : [],
        fields: Array.isArray(parsed.fields) ? parsed.fields : [],
      } as JotformDigestMap;
      setDraft(normalized);
      setDirty(true);
      setRawError("");
      setRawDirty(false);
      toast("Advanced map applied to draft.", { type: "success" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Invalid JSON";
      setRawError(msg);
      toast(`Invalid JSON: ${msg}`, { type: "error" });
    }
  };

  const save = async () => {
    if (!draft || !draft.formId) return;
    try {
      const payload: JotformDigestUpsertReq = {
        ...draft,
        id: draft.formId,
        formId: draft.formId,
        formAlias: draft.formAlias || selectedForm?.alias || null,
        formTitle: draft.formTitle || selectedForm?.title || null,
      };
      await upsert.mutateAsync(payload);
      toast("Jotform digest map saved.", { type: "success" });
      setDirty(false);
    } catch (e: unknown) {
      toast(toApiError(e).error, { type: "error" });
    }
  };

  const syncSelectedForm = async () => {
    if (!selectedFormId) return;
    try {
      const payload: JotformSyncSelectionReq = { mode: "formIds", formIds: [selectedFormId], includeRaw: true, limit: 1000, maxPages: 5 };
      await syncSelection.mutateAsync(payload);
      toast("Synced selected form submissions.", { type: "success" });
    } catch (e: unknown) {
      toast(toApiError(e).error, { type: "error" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-slate-800">Jotform Digest Panel</div>

      <div className="grid gap-3 xl:grid-cols-2">
        {lineItemCards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => selectForm(card.id)}
            className={[
              "overflow-hidden rounded-[24px] border bg-white text-left shadow-sm transition hover:-translate-y-0.5",
              card.selected ? "border-slate-900 ring-1 ring-slate-900/10" : "border-slate-200 hover:border-slate-300",
            ].join(" ")}
          >
            <div className={`h-2 w-full bg-gradient-to-r ${card.accent}`} />
            <div className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{card.tone}</div>
                  <div className="mt-2 text-xl font-black tracking-tight text-slate-950">{card.label}</div>
                  <div className="mt-1 text-sm text-slate-500">{card.description}</div>
                </div>
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ${card.digest ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20" : "bg-amber-500/10 text-amber-700 ring-amber-500/20"}`}>
                  {card.digest ? "Map ready" : "Needs map"}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Form ID</div>
                  <div className="mt-1 font-mono text-xs text-slate-700">{card.id}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Stored Submissions</div>
                  <div className="mt-1 text-xl font-bold text-slate-950">{card.submissionCount}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Alias</div>
                  <div className="mt-1 text-sm font-medium text-slate-700">{String(card.form?.alias || card.form?.title || "Not loaded")}</div>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="text-sm md:col-span-2">
            <div className="text-xs text-slate-600">Select Jotform Form</div>
            <select
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5"
              value={selectedFormId}
              onChange={(e) => selectForm(e.currentTarget.value)}
            >
              <option value="">-- Select form --</option>
              {forms.map((f) => (
                <option key={String(f.id)} value={String(f.id)}>
                  {String(f.title || f.id)} ({String(f.alias || "")})
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <div className="text-xs text-slate-600">Find form</div>
            <input
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5"
              placeholder="Search title/id/alias"
              value={formSearch}
              onChange={(e) => setFormSearch(e.currentTarget.value)}
            />
          </label>

          <label className="text-sm">
            <div className="text-xs text-slate-600">Existing digest maps</div>
            <select
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5"
              value=""
              onChange={(e) => {
                const id = e.currentTarget.value;
                if (!id) return;
                selectForm(id);
              }}
            >
              <option value="">-- Load existing map --</option>
              {existing.map((m) => (
                <option key={String(m.formId)} value={String(m.formId)}>
                  {String(m.formTitle || m.formAlias || m.formId)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className={`rounded border px-2 py-1 text-xs ${builderMode === "basic" ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300 bg-white"}`}
            onClick={() => setBuilderMode("basic")}
            type="button"
          >
            Basic Builder
          </button>
          <button
            className={`rounded border px-2 py-1 text-xs ${builderMode === "advanced" ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300 bg-white"}`}
            onClick={() => setBuilderMode("advanced")}
            type="button"
          >
            Advanced Builder
          </button>
          <button
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
            onClick={syncSelectedForm}
            disabled={!selectedFormId || syncSelection.isPending}
            type="button"
          >
            {syncSelection.isPending ? "Syncing..." : "Sync Selected Form"}
          </button>
          <button
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
            onClick={applySample}
            disabled={!selectedFormId}
            type="button"
          >
            Merge Latest Questions/Answers
          </button>
          <button
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
            onClick={seedLineItemsTemplate}
            disabled={!selectedFormId || !isLineItemsFormId(selectedFormId)}
            type="button"
          >
            Seed Line-Items Template
          </button>
          <div className="text-xs text-slate-600 self-center">
            Latest sample fields: {sampleFields.length} | Existing maps: {existing.length}
          </div>
        </div>
      </div>

      {selectedForm ? (
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-slate-400">Selected Form</div>
            <div className="mt-1 text-lg font-bold text-slate-950">{String(selectedForm.title || selectedForm.id)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-slate-400">Digest Status</div>
            <div className="mt-1 text-lg font-bold text-slate-950">{digestQ.data ? "Configured" : "Draft / new"}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-slate-400">Latest Sample Fields</div>
            <div className="mt-1 text-lg font-bold text-slate-950">{sampleFields.length}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-slate-400">Stored Submissions</div>
            <div className="mt-1 text-lg font-bold text-slate-950">{Number(selectedForm.count || 0)}</div>
          </div>
        </div>
      ) : null}

      {!selectedFormId || !draft ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
          Select a form to edit or create its digest map.
        </div>
      ) : (
        <>
          {builderMode === "advanced" ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
              <div className="text-sm font-medium text-slate-800">Advanced Digest Builder</div>
              <div className="text-xs text-slate-600">
                Edit the full map JSON (including custom metadata like schema snapshots and map versions), then apply.
              </div>
              <textarea
                className="h-[420px] w-full rounded border border-slate-300 bg-white p-2 font-mono text-xs"
                value={rawDraft}
                onChange={(e) => {
                  setRawDraft(e.currentTarget.value);
                  setRawDirty(true);
                }}
              />
              {rawError ? <div className="text-xs text-rose-700">{rawError}</div> : null}
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                  onClick={() => {
                    if (!draft) return;
                    setRawDraft(JSON.stringify(draft, null, 2));
                    setRawError("");
                    setRawDirty(false);
                  }}
                  type="button"
                >
                  Reset JSON To Draft
                </button>
                <button
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                  onClick={() => {
                    try {
                      const obj = JSON.parse(rawDraft);
                      setRawDraft(JSON.stringify(obj, null, 2));
                      setRawError("");
                    } catch (e: unknown) {
                      const msg = e instanceof Error ? e.message : "Invalid JSON";
                      setRawError(msg);
                    }
                  }}
                  type="button"
                >
                  Format JSON
                </button>
                <button
                  className="rounded border border-slate-900 bg-slate-900 px-2 py-1 text-xs text-white"
                  onClick={applyAdvancedJson}
                  type="button"
                >
                  Apply JSON To Draft
                </button>
              </div>
            </div>
          ) : null}

          {builderMode === "basic" ? (
          <>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
            <div className="text-sm font-medium text-slate-800">Digest Display Options</div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.options?.hideEmptyFields !== false}
                  onChange={(e) => {
                    const checked = e.currentTarget.checked;
                    setDraft((prev) =>
                      prev
                        ? { ...prev, options: { ...(prev.options || {}), hideEmptyFields: checked } }
                        : prev
                    );
                    markDirty();
                  }}
                />
                Hide Empty Fields
              </label>
              <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.options?.showQuestions !== false}
                  onChange={(e) => {
                    const checked = e.currentTarget.checked;
                    setDraft((prev) =>
                      prev
                        ? { ...prev, options: { ...(prev.options || {}), showQuestions: checked } }
                        : prev
                    );
                    markDirty();
                  }}
                />
                Show Questions
              </label>
              <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.options?.showAnswers !== false}
                  onChange={(e) => {
                    const checked = e.currentTarget.checked;
                    setDraft((prev) =>
                      prev
                        ? { ...prev, options: { ...(prev.options || {}), showAnswers: checked } }
                        : prev
                    );
                    markDirty();
                  }}
                />
                Show Answers
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
            <div className="text-sm font-medium text-slate-800">Submission Task Mapping</div>
            <div className="text-xs text-slate-600">
              Enable to create inbox submission tasks for this form. By default, only spending forms create tasks automatically.
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
              <label className="inline-flex items-center gap-2 text-xs text-slate-700 md:col-span-1">
                <input
                  type="checkbox"
                  checked={draft.options?.task?.enabled === true}
                  onChange={(e) => {
                    const checked = e.currentTarget.checked;
                    setDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            options: {
                              ...(prev.options || {}),
                              task: {
                                enabled: checked,
                                assignedToGroup: prev.options?.task?.assignedToGroup || "admin",
                                titlePrefix: prev.options?.task?.titlePrefix || null,
                                titleFieldKeys: prev.options?.task?.titleFieldKeys || [],
                                subtitleFieldKeys: prev.options?.task?.subtitleFieldKeys || [],
                              },
                            },
                          }
                        : prev
                    );
                    markDirty();
                  }}
                />
                Enable Task Creation
              </label>
              <label className="text-xs text-slate-700">
                <div className="mb-1">Assigned Group</div>
                <select
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
                  value={String(draft.options?.task?.assignedToGroup || "admin")}
                  onChange={(e) => {
                    const group = e.currentTarget.value as "admin" | "compliance" | "casemanager";
                    setDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            options: {
                              ...(prev.options || {}),
                              task: {
                                enabled: prev.options?.task?.enabled === true,
                                assignedToGroup: group,
                                titlePrefix: prev.options?.task?.titlePrefix || null,
                                titleFieldKeys: prev.options?.task?.titleFieldKeys || [],
                                subtitleFieldKeys: prev.options?.task?.subtitleFieldKeys || [],
                              },
                            },
                          }
                        : prev
                    );
                    markDirty();
                  }}
                >
                  <option value="admin">admin</option>
                  <option value="compliance">compliance</option>
                  <option value="casemanager">casemanager</option>
                </select>
              </label>
              <label className="text-xs text-slate-700 md:col-span-2">
                <div className="mb-1">Task Title Prefix</div>
                <input
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
                  value={String(draft.options?.task?.titlePrefix || "")}
                  placeholder="e.g. Credit Card Purchase Documentation"
                  onChange={(e) => {
                    const titlePrefix = e.currentTarget.value || null;
                    setDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            options: {
                              ...(prev.options || {}),
                              task: {
                                enabled: prev.options?.task?.enabled === true,
                                assignedToGroup: prev.options?.task?.assignedToGroup || "admin",
                                titlePrefix,
                                titleFieldKeys: prev.options?.task?.titleFieldKeys || [],
                                subtitleFieldKeys: prev.options?.task?.subtitleFieldKeys || [],
                              },
                            },
                          }
                        : prev
                    );
                    markDirty();
                  }}
                />
              </label>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <label className="text-xs text-slate-700">
                <div className="mb-1">Title Field Keys (comma separated)</div>
                <input
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono"
                  value={(draft.options?.task?.titleFieldKeys || []).join(",")}
                  placeholder="33,55"
                  onChange={(e) => {
                    const keys = e.currentTarget.value
                      .split(",")
                      .map((k) => k.trim())
                      .filter(Boolean);
                    setDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            options: {
                              ...(prev.options || {}),
                              task: {
                                enabled: prev.options?.task?.enabled === true,
                                assignedToGroup: prev.options?.task?.assignedToGroup || "admin",
                                titlePrefix: prev.options?.task?.titlePrefix || null,
                                titleFieldKeys: keys,
                                subtitleFieldKeys: prev.options?.task?.subtitleFieldKeys || [],
                              },
                            },
                          }
                        : prev
                    );
                    markDirty();
                  }}
                />
              </label>
              <label className="text-xs text-slate-700">
                <div className="mb-1">Subtitle Field Keys (comma separated)</div>
                <input
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono"
                  value={(draft.options?.task?.subtitleFieldKeys || []).join(",")}
                  placeholder="56,101"
                  onChange={(e) => {
                    const keys = e.currentTarget.value
                      .split(",")
                      .map((k) => k.trim())
                      .filter(Boolean);
                    setDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            options: {
                              ...(prev.options || {}),
                              task: {
                                enabled: prev.options?.task?.enabled === true,
                                assignedToGroup: prev.options?.task?.assignedToGroup || "admin",
                                titlePrefix: prev.options?.task?.titlePrefix || null,
                                titleFieldKeys: prev.options?.task?.titleFieldKeys || [],
                                subtitleFieldKeys: keys,
                              },
                            },
                          }
                        : prev
                    );
                    markDirty();
                  }}
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
            <div className="text-sm font-medium text-slate-800">Header</div>
            <label className="inline-flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
              checked={draft.header?.show !== false}
              onChange={(e) => {
                  const checked = e.currentTarget.checked;
                  setDraft((prev) => (prev ? { ...prev, header: { ...(prev.header || {}), show: checked } } : prev));
                  markDirty();
                }}
              />
              Show Header
            </label>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <input
                className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
                value={String(draft.header?.title || "")}
                placeholder="Header title"
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setDraft((prev) => (prev ? { ...prev, header: { ...(prev.header || {}), title: value } } : prev));
                  markDirty();
                }}
              />
              <input
                className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
                value={String(draft.header?.subtitle || "")}
                placeholder="Header subtitle"
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setDraft((prev) => (prev ? { ...prev, header: { ...(prev.header || {}), subtitle: value } } : prev));
                  markDirty();
                }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-slate-800">Sections</div>
              <div className="flex items-center gap-2">
                <button className="rounded border border-slate-300 bg-white px-2 py-1 text-xs" onClick={addSection} type="button">
                  + Add Section
                </button>
                <button className="rounded border border-slate-300 bg-white px-2 py-1 text-xs" onClick={addField} type="button">
                  + Add Field
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {(draft.sections || []).map((section, idx) => (
                <div key={String(section.id)} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_120px_80px_60px]">
                  <input
                    className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
                    value={String(section.label || "")}
                    onChange={(e) => {
                      const value = e.currentTarget.value;
                      setDraft((prev) => {
                        if (!prev) return prev;
                        const sections = [...(prev.sections || [])];
                        sections[idx] = { ...sections[idx], label: value };
                        return { ...prev, sections };
                      });
                      markDirty();
                    }}
                  />
                  <input
                    className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
                    value={String(section.id || "")}
                    onChange={(e) => {
                      const value = e.currentTarget.value.trim();
                      setDraft((prev) => {
                        if (!prev) return prev;
                        const sections = [...(prev.sections || [])];
                        sections[idx] = { ...sections[idx], id: value };
                        return { ...prev, sections };
                      });
                      markDirty();
                    }}
                  />
                  <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                    checked={section.show !== false}
                    onChange={(e) => {
                        const checked = e.currentTarget.checked;
                        setDraft((prev) => {
                          if (!prev) return prev;
                          const sections = [...(prev.sections || [])];
                          sections[idx] = { ...sections[idx], show: checked };
                          return { ...prev, sections };
                        });
                        markDirty();
                      }}
                    />
                    Show
                  </label>
                  <button
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    onClick={() => {
                      setDraft((prev) =>
                        prev ? { ...prev, sections: (prev.sections || []).filter((_, i) => i !== idx) } : prev
                      );
                      markDirty();
                    }}
                    type="button"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
            <div className="text-sm font-medium text-slate-800">Questions / Answers Mapping</div>
            <div className="overflow-x-auto rounded border border-slate-200 bg-white">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr className="border-b">
                    <th className="p-2 text-left">Show</th>
                    <th className="p-2 text-left">Key</th>
                    <th className="p-2 text-left">Label</th>
                    <th className="p-2 text-left">Type</th>
                    <th className="p-2 text-left">Section</th>
                    <th className="p-2 text-left">Hide Empty</th>
                    <th className="p-2 text-left">Sample Answer</th>
                  </tr>
                </thead>
                <tbody>
                  {(draft.fields || [])
                    .slice()
                    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
                    .map((f) => {
                      const sample = sampleFields.find((x) => x.key === f.key);
                      const rowKey = String(f.key);
                      return (
                        <tr key={rowKey} className="border-b">
                          <td className="p-2">
                            <input
                              type="checkbox"
                              checked={f.show !== false}
                              onChange={(e) => {
                                const checked = e.currentTarget.checked;
                                patchFieldByKey(rowKey, (cur) => ({ ...cur, show: checked }));
                              }}
                            />
                          </td>
                          <td className="p-2 font-mono text-[11px]">
                            <input
                              className="w-full rounded border border-slate-300 px-2 py-1 font-mono text-[11px]"
                              value={String(f.key || "")}
                              onChange={(e) => {
                                const value = e.currentTarget.value.trim();
                                patchFieldByKey(rowKey, (cur) => ({ ...cur, key: value }));
                              }}
                            />
                          </td>
                          <td className="p-2">
                            <input
                              className="w-full rounded border border-slate-300 px-2 py-1"
                              value={String(f.label || "")}
                              onChange={(e) => {
                                const value = e.currentTarget.value;
                                patchFieldByKey(rowKey, (cur) => ({ ...cur, label: value }));
                              }}
                            />
                          </td>
                          <td className="p-2">
                            <select
                              className="rounded border border-slate-300 px-2 py-1"
                              value={String(f.type || "question")}
                              onChange={(e) => {
                                const type = e.currentTarget.value as "question" | "header" | "section";
                                patchFieldByKey(rowKey, (cur) => ({ ...cur, type }));
                              }}
                            >
                              <option value="question">question</option>
                              <option value="header">header</option>
                              <option value="section">section</option>
                            </select>
                          </td>
                          <td className="p-2">
                            <select
                              className="rounded border border-slate-300 px-2 py-1"
                              value={String(f.sectionId || "")}
                              onChange={(e) => {
                                const sectionId = e.currentTarget.value || null;
                                patchFieldByKey(rowKey, (cur) => ({ ...cur, sectionId }));
                              }}
                            >
                              <option value="">-- none --</option>
                              {(draft.sections || []).map((s) => (
                                <option key={String(s.id)} value={String(s.id)}>
                                  {String(s.label || s.id)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="checkbox"
                              checked={f.hideIfEmpty !== false}
                              onChange={(e) => {
                                const checked = e.currentTarget.checked;
                                patchFieldByKey(rowKey, (cur) => ({ ...cur, hideIfEmpty: checked }));
                              }}
                            />
                          </td>
                          <td className="p-2 text-slate-600">{sample?.preview || "-"}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
          </>
          ) : null}

          <div className="flex justify-end">
            <button
              className="rounded bg-slate-900 px-3 py-1.5 text-xs text-white disabled:opacity-50"
              onClick={save}
              disabled={upsert.isPending || !draft.formId}
              type="button"
            >
              {upsert.isPending ? "Saving..." : dirty ? "Save Digest Map*" : "Save Digest Map"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
