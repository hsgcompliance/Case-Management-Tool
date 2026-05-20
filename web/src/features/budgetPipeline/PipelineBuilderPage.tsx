"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useGrants } from "@hooks/useGrants";
import { useJotformFormQuestions } from "@hooks/useJotform";
import { usePipelineUpsert, usePipelinePreview, usePipeline } from "@hooks/useBudgetPipeline";
import { toast } from "@lib/toast";
import type {
  TBudgetPipeline,
  TPipelineCondition,
  TPipelineConditionGroup,
  TPipelineRuleNode,
  TPipelineStatus,
  TBudgetPipelinePreviewResult,
  TPipelineFormSchema,
} from "@types";
import {
  inferTransactionWindowModel,
  type TransactionWindowModel,
} from "@hdb/contracts";
import { LINE_ITEMS_FORM_IDS } from "@features/widgets/jotform/lineItemsFormMap";
import { HelpButton } from "@entities/help/HelpButton";
import { RuleTreeEditor } from "./components/RuleTreeEditor";
import { PreviewTable } from "./components/PreviewTable";
import { NORMALIZED_FIELDS, type PipelineFieldDef } from "./fieldDefs";

const SOURCE_FORMS = [
  { key: "creditCard", label: "Credit Card", title: "Line Items Card Checkout", id: LINE_ITEMS_FORM_IDS.creditCard },
  { key: "invoice", label: "Invoice", title: "Line Items Invoice", id: LINE_ITEMS_FORM_IDS.invoice },
] as const;

type SourceFormKey = (typeof SOURCE_FORMS)[number]["key"];

type FormSchemaDraft = Omit<TPipelineFormSchema, "includeTree" | "excludeTree"> & {
  enabled: boolean;
  includeTree: TPipelineRuleNode;
  excludeTree: TPipelineRuleNode;
};

type Draft = {
  id: string | null;
  name: string;
  status: TPipelineStatus;
  grantId: string | null;
  lineItemId: string | null;
  sourceFormId: string | null;
  sourceFormTitle: string | null;
  formSchemas: Record<SourceFormKey, FormSchemaDraft>;
  includeGroups: TPipelineConditionGroup[];
  excludeGroups: TPipelineConditionGroup[];
  includeTree: TPipelineRuleNode;
  excludeTree: TPipelineRuleNode;
};

function newId() {
  return crypto.randomUUID();
}

function emptyTree(logic: "AND" | "OR"): TPipelineRuleNode {
  return { id: newId(), type: "group", logic, children: [] };
}

function makeFormSchema(source: (typeof SOURCE_FORMS)[number], enabled: boolean): FormSchemaDraft {
  return {
    enabled,
    sourceFormId: source.id,
    sourceFormTitle: source.title,
    includeGroups: [],
    excludeGroups: [],
    includeTree: emptyTree("AND"),
    excludeTree: emptyTree("OR"),
  };
}

function makeDefaultFormSchemas(): Record<SourceFormKey, FormSchemaDraft> {
  return {
    creditCard: makeFormSchema(SOURCE_FORMS[0], true),
    invoice: makeFormSchema(SOURCE_FORMS[1], false),
  };
}

function makeEmptyDraft(): Draft {
  const source = SOURCE_FORMS[0];
  return {
    id: null,
    name: "New Pipeline",
    status: "draft",
    grantId: null,
    lineItemId: null,
    sourceFormId: source.id,
    sourceFormTitle: source.title,
    formSchemas: makeDefaultFormSchemas(),
    includeGroups: [],
    excludeGroups: [],
    includeTree: emptyTree("AND"),
    excludeTree: emptyTree("OR"),
  };
}

function conditionToNode(condition: TPipelineCondition): TPipelineRuleNode {
  return { id: condition.id, type: "condition", condition };
}

function groupsToTree(groups: TPipelineConditionGroup[], rootLogic: "AND" | "OR"): TPipelineRuleNode {
  return {
    id: newId(),
    type: "group",
    logic: rootLogic,
    children: groups.map((group) => ({
      id: group.id,
      type: "group",
      logic: group.logic,
      children: group.conditions.map(conditionToNode),
    })),
  };
}

function pipelineToDraft(p: TBudgetPipeline): Draft {
  const source = SOURCE_FORMS.find((form) => form.id === p.sourceFormId) ?? SOURCE_FORMS[0];
  const schemas = makeDefaultFormSchemas();
  const savedSchemas = (p as any).formSchemas as Partial<Record<SourceFormKey, Partial<FormSchemaDraft>>> | undefined;

  if (savedSchemas) {
    for (const sourceForm of SOURCE_FORMS) {
      const saved = savedSchemas[sourceForm.key];
      if (!saved) continue;
      schemas[sourceForm.key] = {
        enabled: saved.enabled !== false,
        sourceFormId: saved.sourceFormId || sourceForm.id,
        sourceFormTitle: saved.sourceFormTitle || sourceForm.title,
        includeGroups: saved.includeGroups ?? [],
        excludeGroups: saved.excludeGroups ?? [],
        includeTree: saved.includeTree ?? groupsToTree(saved.includeGroups ?? [], "AND"),
        excludeTree: saved.excludeTree ?? groupsToTree(saved.excludeGroups ?? [], "OR"),
      };
    }
  } else {
    const legacyKey = source.key;
    schemas.creditCard.enabled = false;
    schemas.invoice.enabled = false;
    schemas[legacyKey] = {
      enabled: true,
      sourceFormId: source.id,
      sourceFormTitle: source.title,
      includeGroups: p.includeGroups ?? [],
      excludeGroups: p.excludeGroups ?? [],
      includeTree: (p as any).includeTree ?? groupsToTree(p.includeGroups ?? [], "OR"),
      excludeTree: (p as any).excludeTree ?? groupsToTree(p.excludeGroups ?? [], "OR"),
    };
  }

  return {
    id: p.id,
    name: p.name,
    status: p.status,
    grantId: p.grantId,
    lineItemId: p.lineItemId,
    sourceFormId: p.sourceFormId || source.id,
    sourceFormTitle: p.sourceFormTitle || source.title,
    formSchemas: schemas,
    includeGroups: p.includeGroups ?? [],
    excludeGroups: p.excludeGroups ?? [],
    includeTree: (p as any).includeTree ?? groupsToTree(p.includeGroups ?? [], "OR"),
    excludeTree: (p as any).excludeTree ?? groupsToTree(p.excludeGroups ?? [], "OR"),
  };
}

function formKeyFromId(formId: string | null): SourceFormKey {
  return SOURCE_FORMS.find((form) => form.id === formId)?.key ?? "creditCard";
}

function toPipelineFields(
  fields: Array<{
    key: string;
    label: string;
    type: string;
    options?: string[];
    rawFieldId?: string;
    rawType?: string;
    logicType?: PipelineFieldDef["logicType"];
    typeLabel?: string;
    order?: number;
  }>,
): PipelineFieldDef[] {
  return fields.map((field) => ({
    ...(() => {
      const type =
        field.type === "number" || field.type === "date" || field.type === "boolean" || field.type === "select"
          ? field.type
          : "text";
      const inferredTypeLabel =
        type === "select"
          ? "Dropdown"
          : type === "date"
            ? "Date"
            : type === "number"
              ? "Number"
              : type === "boolean"
                ? "Boolean"
                : "Text";
      return {
        type,
        typeLabel: field.typeLabel || inferredTypeLabel,
      };
    })(),
    key: field.key,
    label: field.label || field.rawFieldId || field.key,
    options: field.options,
    rawFieldId: field.rawFieldId,
    rawType: field.rawType,
    logicType: field.logicType,
  }));
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });
  } catch {
    return iso;
  }
}

const HIDDEN_GLOBAL_KEYS_BY_SOURCE: Record<SourceFormKey, Set<string>> = {
  creditCard: new Set(["merchant", "expenseType", "program", "customer", "purpose", "amount", "isFlex"]),
  invoice: new Set(["program", "billedTo", "project", "amount"]),
};

function buildGlobalFields(sourceKey: SourceFormKey): PipelineFieldDef[] {
  const hidden = HIDDEN_GLOBAL_KEYS_BY_SOURCE[sourceKey];
  return NORMALIZED_FIELDS.filter((field) => !hidden.has(field.key));
}

function buildTransactionFields(model: TransactionWindowModel | null): PipelineFieldDef[] {
  return (model?.fields ?? []).map((field) => ({
    key: field.key,
    label: field.label,
    type: field.type,
    rawType: field.rawType,
    logicType: field.logicType,
    typeLabel: field.typeLabel,
    description: "Live transaction field inferred from the current Jotform schema.",
    options: field.options,
  }));
}

function countRuleConditions(node: TPipelineRuleNode): number {
  if (node.type === "condition") return 1;
  return node.children.reduce((total, child) => total + countRuleConditions(child), 0);
}

function StatusBadge({ status }: { status: TPipelineStatus }) {
  const colors: Record<TPipelineStatus, string> = {
    draft: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    inactive: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  };
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors[status]}`}>{status}</span>;
}

type Props = {
  pipelineId?: string | null;
  onBack?: () => void;
  onSaved?: (id: string) => void;
};

export function PipelineBuilderPage({ pipelineId, onBack, onSaved }: Props) {
  const router = useRouter();
  const isNew = !pipelineId || pipelineId === "new";
  const isEmbedded = !!onBack;

  const { data: existingPipeline, isLoading: isLoadingPipeline } = usePipeline(isNew ? null : pipelineId ?? null);
  const { data: grantsData = [] } = useGrants({ active: true, limit: 200 });
  const upsert = usePipelineUpsert();
  const preview = usePipelinePreview();

  const [draft, setDraft] = useState<Draft>(() => makeEmptyDraft());
  const [previewResult, setPreviewResult] = useState<TBudgetPipelinePreviewResult | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSourceKey, setActiveSourceKey] = useState<SourceFormKey>("creditCard");

  useEffect(() => {
    if (!existingPipeline) return;
    const nextDraft = pipelineToDraft(existingPipeline);
    setDraft(nextDraft);
    const firstEnabled =
      SOURCE_FORMS.find((source) => nextDraft.formSchemas[source.key]?.enabled)?.key ??
      formKeyFromId(existingPipeline.sourceFormId) ??
      "creditCard";
    setActiveSourceKey(firstEnabled);
  }, [existingPipeline]);

  const selectedSource = SOURCE_FORMS.find((form) => form.key === activeSourceKey) ?? SOURCE_FORMS[0];
  const selectedSourceKey = selectedSource.key;
  const activeSchema = draft.formSchemas[selectedSourceKey] ?? makeFormSchema(selectedSource, false);
  const questionsQ = useJotformFormQuestions(selectedSource.id, { enabled: !!selectedSource.id, staleTime: 10 * 60_000 });
  const formFields = useMemo(() => toPipelineFields(questionsQ.data ?? []), [questionsQ.data]);
  const transactionModelResult = useMemo(() => {
    if (!questionsQ.data?.length) return { model: null as TransactionWindowModel | null, error: null as string | null };
    try {
      return {
        model: inferTransactionWindowModel(selectedSource.id, questionsQ.data),
        error: null as string | null,
      };
    } catch (error) {
      return {
        model: null as TransactionWindowModel | null,
        error: error instanceof Error ? error.message : "Could not infer transaction windows.",
      };
    }
  }, [questionsQ.data, selectedSource.id]);
  const normalizedFields = useMemo(
    () => [...buildGlobalFields(selectedSourceKey), ...buildTransactionFields(transactionModelResult.model)],
    [selectedSourceKey, transactionModelResult.model],
  );

  const selectedGrant = useMemo(
    () => (grantsData as any[]).find((g: any) => g.id === draft.grantId) ?? null,
    [grantsData, draft.grantId],
  );
  const lineItems: Array<{ id: string; label: string }> = useMemo(
    () => selectedGrant?.budget?.lineItems ?? [],
    [selectedGrant],
  );

  const updateActiveSchema = useCallback((patch: Partial<FormSchemaDraft>) => {
    setDraft((d) => ({
      ...d,
      formSchemas: {
        ...d.formSchemas,
        [selectedSourceKey]: {
          ...(d.formSchemas[selectedSourceKey] ?? makeFormSchema(selectedSource, false)),
          ...patch,
          sourceFormId: selectedSource.id,
          sourceFormTitle: selectedSource.title,
        },
      },
    }));
  }, [selectedSource.id, selectedSource.title, selectedSourceKey]);

  const selectSourceForm = useCallback((key: SourceFormKey) => {
    setActiveSourceKey(key);
    setPreviewResult(null);
  }, []);

  async function handleSave(statusOverride?: TPipelineStatus) {
    const enabledSchemas = SOURCE_FORMS
      .map((source) => draft.formSchemas[source.key])
      .filter((schema) => schema?.enabled);
    if (enabledSchemas.length === 0) {
      toast("Enable at least one source form schema before saving.", { type: "error" });
      return;
    }
    const activeLegacySchema = activeSchema;
    const sourceFormTitle =
      enabledSchemas.length === 1
        ? enabledSchemas[0].sourceFormTitle
        : enabledSchemas.map((schema) => schema.sourceFormTitle.replace(/^Line Items /, "")).join(" + ");

    setIsSaving(true);
    try {
      const result = await upsert.mutateAsync({
        ...(draft.id ? { id: draft.id } : {}),
        name: draft.name || "Unnamed Pipeline",
        status: statusOverride ?? draft.status,
        grantId: draft.grantId,
        lineItemId: draft.lineItemId,
        sourceFormId: enabledSchemas.length === 1 ? enabledSchemas[0].sourceFormId : null,
        sourceFormTitle,
        formSchemas: draft.formSchemas,
        includeGroups: [],
        excludeGroups: [],
        includeTree: activeLegacySchema.includeTree,
        excludeTree: activeLegacySchema.excludeTree,
      });
      const newId = (result as any)?.id as string | undefined;
      if (newId) {
        setDraft((d) => ({ ...d, id: newId, status: statusOverride ?? d.status }));
        if (onSaved) onSaved(newId);
        else if (isNew) router.push(`/budget/pipeline/${newId}`);
      }
      toast(statusOverride === "active" ? "Pipeline activated." : "Pipeline saved.", { type: "success" });
    } catch {
      toast("Failed to save pipeline.", { type: "error" });
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePreview() {
    setIsPreviewLoading(true);
    try {
      const result = await preview.mutateAsync({
        grantId: draft.grantId,
        lineItemId: draft.lineItemId,
        sourceFormId: selectedSource.id,
        includeGroups: [],
        excludeGroups: [],
        includeTree: activeSchema.includeTree,
        excludeTree: activeSchema.excludeTree,
        ...(draft.id ? { pipelineId: draft.id } : {}),
      });
      setPreviewResult(result as unknown as TBudgetPipelinePreviewResult);
    } catch {
      toast("Preview failed. Check your rule syntax.", { type: "error" });
    } finally {
      setIsPreviewLoading(false);
    }
  }

  if (!isNew && isLoadingPipeline) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-slate-400 dark:text-slate-500">
        Loading pipeline...
      </div>
    );
  }

  const inputCls =
    "text-sm border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500";
  const selectCls = inputCls;
  const activeIncludeCount = countRuleConditions(activeSchema.includeTree);
  const activeExcludeCount = countRuleConditions(activeSchema.excludeTree);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 flex flex-wrap items-center gap-3 shadow-sm">
        {isEmbedded ? (
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors mr-1 shrink-0"
          >
            Back to pipelines
          </button>
        ) : null}

        <div className="flex items-center gap-1.5 min-w-0">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">Grant</label>
          <select
            className={`${selectCls} max-w-[180px]`}
            value={draft.grantId ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, grantId: e.target.value || null, lineItemId: null }))}
          >
            <option value="">Any grant</option>
            {(grantsData as any[]).map((g: any) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5 min-w-0">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">Line Item</label>
          <select
            className={`${selectCls} max-w-[160px]`}
            value={draft.lineItemId ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, lineItemId: e.target.value || null }))}
            disabled={!draft.grantId}
          >
            <option value="">Any line item</option>
            {lineItems.map((li) => (
              <option key={li.id} value={li.id}>
                {li.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">Name</label>
          <input
            type="text"
            className={`${inputCls} min-w-[160px] flex-1`}
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Pipeline name"
          />
        </div>

        <StatusBadge status={draft.status} />
        <HelpButton pageKey="budgetPipeline" />

        <div className="flex items-center gap-2 ml-auto">
          <button type="button" className="btn btn-sm btn-ghost" onClick={handlePreview} disabled={isPreviewLoading || isSaving}>
            Preview
          </button>
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </button>
          {draft.status !== "active" ? (
            <button type="button" className="btn btn-sm btn-primary" onClick={() => void handleSave("active")} disabled={isSaving}>
              Activate
            </button>
          ) : (
            <button type="button" className="btn btn-sm btn-ghost text-slate-500" onClick={() => void handleSave("inactive")} disabled={isSaving}>
              Deactivate
            </button>
          )}
        </div>
      </div>

      <main className="flex-1 min-h-0 overflow-y-auto p-6 space-y-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Pipeline schemas</div>
              <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{selectedSource.title}</div>
              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Save one budget target with separate Credit Card and Invoice rule pages.
              </div>
            </div>
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-inner dark:border-slate-700 dark:bg-slate-800">
              {SOURCE_FORMS.map((source) => (
                <button
                  key={source.key}
                  type="button"
                  title={`Edit the ${source.label} schema for this pipeline.`}
                  className={[
                    "rounded-lg px-5 py-2.5 text-sm font-semibold transition",
                    selectedSourceKey === source.key
                      ? "bg-white text-slate-950 shadow-sm dark:bg-slate-950 dark:text-white"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100",
                  ].join(" ")}
                  onClick={() => selectSourceForm(source.key)}
                >
                  <span>{source.label}</span>
                  <span className={[
                    "ml-2 rounded-full px-1.5 py-0.5 text-[10px]",
                    draft.formSchemas[source.key]?.enabled
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                      : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400",
                  ].join(" ")}>
                    {draft.formSchemas[source.key]?.enabled ? "on" : "off"}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label
                className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200"
                title="Disabled schemas are saved for later, but active pipelines will not evaluate this form."
              >
                <input
                  type="checkbox"
                  className="accent-sky-500"
                  checked={activeSchema.enabled}
                  onChange={(e) => updateActiveSchema({ enabled: e.currentTarget.checked })}
                />
                Use {selectedSource.label} schema in this pipeline
              </label>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span title="The Jotform form id this schema evaluates against." className="font-mono">{selectedSource.id}</span>
                <span title="Include/exclude condition count for this form page.">
                  {activeIncludeCount} include · {activeExcludeCount} exclude
                </span>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Keep shared target settings above, then tune form-specific transaction fields here. Empty include rules match all pending {selectedSource.label.toLowerCase()} payment objects; empty exclude rules exclude nothing.
            </p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className={questionsQ.isLoading ? "text-amber-600" : "text-emerald-600"}>
              {questionsQ.isLoading ? "Loading form fields..." : `${formFields.length} form fields loaded`}
            </span>
            <span>Rules use live inferred transaction windows.</span>
            {questionsQ.isError ? <span className="text-rose-600">Could not load live Jotform fields.</span> : null}
          </div>
          {transactionModelResult.error ? (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
              <div className="font-semibold">Transaction schema error</div>
              <div className="mt-1">{transactionModelResult.error}</div>
            </div>
          ) : null}
        </section>

        <RuleTreeEditor
          title={`${selectedSource.label} Include Rules`}
          description="Payment objects from this form must match this rule tree. Empty root = match all pending objects for this form."
          root={activeSchema.includeTree}
          tone="include"
          fieldDefs={normalizedFields}
          onChange={(includeTree) => updateActiveSchema({ includeTree })}
        />

        <hr className="border-slate-200 dark:border-slate-700" />

        <RuleTreeEditor
          title={`${selectedSource.label} Exclude Rules`}
          description="Transactions matching this rule tree are excluded even if they passed include rules."
          root={activeSchema.excludeTree}
          tone="exclude"
          fieldDefs={normalizedFields}
          onChange={(excludeTree) => updateActiveSchema({ excludeTree })}
        />

        <hr className="border-slate-200 dark:border-slate-700" />

        <PreviewTable result={previewResult} isLoading={isPreviewLoading} onRun={handlePreview} />
      </main>
    </div>
  );
}

export default PipelineBuilderPage;
