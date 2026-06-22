"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useGrants } from "@hooks/useGrants";
import { useJotformFormQuestions } from "@hooks/useJotform";
import { useJotformSubmissionsLite, useSyncJotformSelection } from "@hooks/useJotform";
import { usePipelineUpsert, usePipelinePreview, usePipeline } from "@hooks/useBudgetPipeline";
import { usePaymentQueueItems, usePatchPaymentQueueItem, usePostPaymentQueueToLedger, type PaymentQueueItem } from "@hooks/usePaymentQueue";
import { qk } from "@hooks/queryKeys";
import { useDashboardSharedData } from "@entities/Page/dashboardStyle/hooks/useDashboardSharedData";
import { toast } from "@lib/toast";
import { fmtCurrencyUSD, fmtDateOrDash } from "@lib/formatters";
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
import GrantSelect from "@entities/selectors/GrantSelect";
import LineItemSelect from "@entities/selectors/LineItemSelect";
import { SpendDetailModal, type SpendRow } from "@features/widgets/spending/SpendDetailModal";
import { RuleTreeEditor } from "./components/RuleTreeEditor";
import { PreviewTable } from "./components/PreviewTable";
import { NORMALIZED_FIELDS, type PipelineFieldDef } from "./fieldDefs";
import {
  inNullableDateRange,
  ledgerPostBlockers,
  matchesSourceFilter,
  rowSourceType,
  type MatchingSourceFilter,
} from "./matchingModalUtils";

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

function textValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(textValue).filter(Boolean).join(" ");
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).map(textValue).filter(Boolean).join(" ");
  }
  return "";
}

function queueSearchText(item: PaymentQueueItem, submission?: Record<string, unknown>): string {
  return [
    item.id,
    item.submissionId,
    item.formTitle,
    item.source,
    item.merchant,
    item.program,
    item.billedTo,
    item.project,
    item.expenseType,
    item.serviceType,
    item.descriptor,
    item.purpose,
    item.notes,
    item.note,
    item.customer,
    item.card,
    item.cardBucket,
    item.grantId,
    item.lineItemId,
    textValue(item.transactionFields),
    textValue(item.rawAnswers),
    textValue((submission as any)?.answers),
  ].filter(Boolean).join(" ").toLowerCase();
}

function queueItemToSpendRow(item: PaymentQueueItem): SpendRow {
  const source = rowSourceType(item);
  const date = String(item.dueDate || item.createdAt || item.postedAt || "").slice(0, 10);
  const title = String(item.merchant || item.descriptor || item.purpose || item.formTitle || item.id || "Spend row");
  return {
    id: item.id,
    kind: source === "invoice" ? "queue-invoice" : "queue-credit-card",
    sourceLabel: source === "invoice" ? "Invoice" : "Card",
    title,
    subtitle: String(item.submissionId || item.paymentId || item.id || ""),
    date,
    month: String(item.month || date.slice(0, 7)),
    amountCents: Math.round(Number(item.amount || 0) * 100),
    completed: item.queueStatus === "posted",
    workflowState: item.queueStatus === "posted" ? "closed" : "open",
    workflowReason: String(item.queueStatus || "pending"),
    grantId: String(item.grantId || ""),
    lineItemId: String(item.lineItemId || ""),
    customerId: String(item.customerId || ""),
    creditCardId: String(item.creditCardId || ""),
    creditCardName: String(item.card || ""),
    cardBucket: String(item.cardBucket || ""),
    taskToken: String(item.id || ""),
    linkedLedgerId: String(item.ledgerEntryId || "") || undefined,
    paymentQueueItem: item,
  };
}

function BulkGrantDesignationModal({
  open,
  previewResult,
  defaultGrantId,
  defaultLineItemId,
  onClose,
}: {
  open: boolean;
  previewResult: TBudgetPipelinePreviewResult | null;
  defaultGrantId: string | null;
  defaultLineItemId: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { grantNameById, customerNameById, grants } = useDashboardSharedData();
  const patchQueue = usePatchPaymentQueueItem();
  const postQueue = usePostPaymentQueueToLedger();
  const syncSelection = useSyncJotformSelection();
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(previewResult?.matched.map((item) => item.id) ?? []));
  const [targetGrantId, setTargetGrantId] = useState(defaultGrantId ?? "");
  const [targetLineItemId, setTargetLineItemId] = useState(defaultLineItemId ?? "");
  const [showOnlyPreview, setShowOnlyPreview] = useState(true);
  const [applying, setApplying] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<MatchingSourceFilter>("all");
  const [submissionScope, setSubmissionScope] = useState<"cached" | "pullAll" | "pullDateRange">("cached");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedQueueId, setSelectedQueueId] = useState<string>("");
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const creditCardQueueQ = usePaymentQueueItems(
    { source: "credit-card", queueStatus: "pending", limit: 500 },
    { enabled: open, staleTime: 20_000 },
  );
  const invoiceQueueQ = usePaymentQueueItems(
    { source: "invoice", queueStatus: "pending", limit: 500 },
    { enabled: open, staleTime: 20_000 },
  );
  const creditCardSubmissionsQ = useJotformSubmissionsLite(
    { formId: LINE_ITEMS_FORM_IDS.creditCard, limit: 500 },
    { enabled: open, staleTime: 20_000 },
  );
  const invoiceSubmissionsQ = useJotformSubmissionsLite(
    { formId: LINE_ITEMS_FORM_IDS.invoice, limit: 500 },
    { enabled: open, staleTime: 20_000 },
  );

  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set(previewResult?.matched.map((item) => item.id) ?? []));
    setTargetGrantId(defaultGrantId ?? "");
    setTargetLineItemId(defaultLineItemId ?? "");
    setShowOnlyPreview(true);
    setSourceFilter("all");
    setSubmissionScope("cached");
    setStartDate("");
    setEndDate("");
    setSelectedQueueId("");
    setDirtyIds(new Set());
    setReviewedIds(new Set());
    setExcludedIds(new Set());
    setConfirmCloseOpen(false);
    setDetailOpen(false);
  }, [defaultGrantId, defaultLineItemId, open, previewResult]);

  const previewIds = useMemo(
    () => new Set(previewResult?.matched.map((item) => item.id) ?? []),
    [previewResult],
  );
  const conflictIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of previewResult?.perItem ?? []) {
      if (item.conflictPipelineIds.length > 0) ids.add(item.itemId);
    }
    return ids;
  }, [previewResult]);
  const lineItemLookup = useMemo(() => {
    const map = new Map<string, { grantName: string; lineItemLabel: string }>();
    for (const grant of grants as Array<Record<string, any>>) {
      const grantId = String(grant?.id || "");
      const grantName = String(grant?.name || grantId);
      const lineItems = Array.isArray((grant as any)?.budget?.lineItems) ? (grant as any).budget.lineItems : [];
      for (const li of lineItems) {
        const lineItemId = String(li?.id || "");
        if (grantId && lineItemId) map.set(`${grantId}:${lineItemId}`, { grantName, lineItemLabel: String(li?.label || lineItemId) });
      }
    }
    return map;
  }, [grants]);
  const submissionsById = useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    for (const submission of [...(creditCardSubmissionsQ.data ?? []), ...(invoiceSubmissionsQ.data ?? [])] as Array<Record<string, unknown>>) {
      const id = String((submission as any).submissionId || (submission as any).id || "");
      if (id) map.set(id, submission);
    }
    return map;
  }, [creditCardSubmissionsQ.data, invoiceSubmissionsQ.data]);
  const queueRows = useMemo(() => {
    const byId = new Map<string, PaymentQueueItem>();
    for (const item of [...(creditCardQueueQ.data ?? []), ...(invoiceQueueQ.data ?? [])]) byId.set(item.id, item);
    return Array.from(byId.values()).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  }, [creditCardQueueQ.data, invoiceQueueQ.data]);
  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return queueRows.filter((item) => {
      if (showOnlyPreview && previewIds.size > 0 && !previewIds.has(item.id)) return false;
      if (!matchesSourceFilter(item, sourceFilter)) return false;
      if (!inNullableDateRange(item, startDate, endDate)) return false;
      if (excludedIds.has(item.id)) return false;
      const submission = submissionsById.get(String(item.submissionId || ""));
      return !q || queueSearchText(item, submission).includes(q);
    });
  }, [excludedIds, previewIds, queueRows, search, showOnlyPreview, sourceFilter, startDate, endDate, submissionsById]);

  if (!open) return null;

  const loading = creditCardQueueQ.isLoading || invoiceQueueQ.isLoading || creditCardSubmissionsQ.isLoading || invoiceSubmissionsQ.isLoading;
  const selectedCount = selectedIds.size;
  const canApply = selectedCount > 0 && (!targetGrantId || !!targetLineItemId) && !applying;
  const selectedQueueItem = queueRows.find((item) => item.id === selectedQueueId) || null;
  const detailRow = selectedQueueItem ? queueItemToSpendRow(selectedQueueItem) : null;

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectVisible = () => setSelectedIds(new Set(visibleRows.map((row) => row.id)));
  const selectedRows = queueRows.filter((row) => selectedIds.has(row.id));

  function requestClose() {
    if (dirtyIds.size > 0) setConfirmCloseOpen(true);
    else onClose();
  }

  async function refreshSubmissions() {
    if (submissionScope === "cached") {
      await Promise.all([
        creditCardQueueQ.refetch(),
        invoiceQueueQ.refetch(),
        creditCardSubmissionsQ.refetch(),
        invoiceSubmissionsQ.refetch(),
      ]);
      return;
    }
    try {
      await syncSelection.mutateAsync({
        mode: "formIds",
        formIds: [LINE_ITEMS_FORM_IDS.creditCard, LINE_ITEMS_FORM_IDS.invoice],
        limit: 500,
        maxPages: submissionScope === "pullAll" ? 25 : 10,
        includeRaw: true,
        ...(submissionScope === "pullDateRange" && startDate ? { since: startDate } : {}),
      });
      await Promise.all([creditCardQueueQ.refetch(), invoiceQueueQ.refetch(), creditCardSubmissionsQ.refetch(), invoiceSubmissionsQ.refetch()]);
      toast("Submission list refreshed.", { type: "success" });
    } catch {
      toast("Could not refresh Jotform submissions.", { type: "error" });
    }
  }

  function assignDraftToSelected() {
    if (!selectedIds.size) return;
    if (targetGrantId && !targetLineItemId) {
      toast("Select a line item before assigning a grant.", { type: "error" });
      return;
    }
    setDirtyIds((prev) => new Set([...prev, ...selectedIds]));
    toast(`${selectedIds.size} selected row${selectedIds.size === 1 ? "" : "s"} staged for allocation.`, { type: "success" });
  }

  async function applyClassification() {
    if (!canApply) return false;
    setApplying(true);
    try {
      const ids = Array.from(selectedIds);
      for (const id of ids) {
        await patchQueue.mutateAsync({
          id,
          body: targetGrantId
            ? { grantId: targetGrantId, lineItemId: targetLineItemId, okUnassigned: false, localModificationReason: "Bulk grant designation from budget pipeline preview" }
            : { grantId: null, lineItemId: null, okUnassigned: true, localModificationReason: "Bulk marked no grant from budget pipeline preview" },
        });
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.pipeline.root }),
        qc.invalidateQueries({ queryKey: qk.grants.root }),
      ]);
      toast(`Updated ${ids.length} queue row${ids.length === 1 ? "" : "s"}.`, { type: "success" });
      setDirtyIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      return true;
    } catch {
      toast("Bulk grant designation failed.", { type: "error" });
      return false;
    } finally {
      setApplying(false);
    }
  }

  function markReviewed() {
    setReviewedIds((prev) => new Set([...prev, ...selectedIds]));
  }

  function excludeSelected() {
    setExcludedIds((prev) => new Set([...prev, ...selectedIds]));
    setSelectedIds(new Set());
  }

  async function postSelectedToLedger() {
    const blocked = selectedRows
      .map((item) => ({
        item,
        blockers: ledgerPostBlockers(item, {
          unsaved: dirtyIds.has(item.id),
          conflict: conflictIds.has(item.id),
          duplicate: !!item.ledgerEntryId,
        }),
      }))
      .filter((entry) => entry.blockers.length > 0);
    if (blocked.length > 0) {
      toast(`Cannot post ${blocked.length} selected row${blocked.length === 1 ? "" : "s"}: ${blocked[0].blockers.join(", ")}.`, { type: "error" });
      return;
    }
    if (!selectedRows.length) return;
    setApplying(true);
    try {
      for (const row of selectedRows) await postQueue.mutateAsync({ id: row.id });
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.paymentQueue.root }),
        qc.invalidateQueries({ queryKey: qk.pipeline.root }),
        qc.invalidateQueries({ queryKey: qk.grants.root }),
      ]);
      toast(`Posted ${selectedRows.length} row${selectedRows.length === 1 ? "" : "s"} to ledger.`, { type: "success" });
    } catch {
      toast("Post to ledger failed.", { type: "error" });
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onClick={requestClose}>
      <div className="grid h-[min(900px,calc(100vh-40px))] w-full max-w-[1480px] grid-rows-[50px_1fr_48px] overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100">Advanced Pipeline Matching</div>
            <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">Filter Preview - Match Review</span>
            {dirtyIds.size > 0 ? <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Unsaved allocation</span> : null}
          </div>
          <button type="button" className="btn btn-xs btn-ghost" onClick={requestClose}>Close</button>
        </div>

        <div className="grid min-h-0 grid-cols-[320px_minmax(680px,1fr)_340px] bg-slate-50 dark:bg-slate-900/40">
          <aside className="min-h-0 overflow-hidden border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
            <div className="border-b border-slate-200 p-3 dark:border-slate-700">
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Form Submissions</div>
              <div className="grid grid-cols-3 gap-1 rounded-md border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
                {([
                  ["invoice", "Invoices"],
                  ["card", "Cards"],
                  ["all", "All"],
                ] as const).map(([key, label]) => (
                  <button key={key} type="button" className={`rounded px-2 py-1.5 text-xs font-semibold ${sourceFilter === key ? "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white" : "text-slate-500"}`} onClick={() => setSourceFilter(key)}>
                    {label}
                  </button>
                ))}
              </div>
              <label className="mt-3 block text-[11px] font-semibold uppercase text-slate-500">Submission Scope</label>
              <select className="select w-full" value={submissionScope} onChange={(e) => setSubmissionScope(e.currentTarget.value as typeof submissionScope)}>
                <option value="cached">Cached Only</option>
                <option value="pullAll">Pull All Submissions</option>
                <option value="pullDateRange">Pull Date Range</option>
              </select>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="relative">
                  <label className="block text-[11px] font-semibold uppercase text-slate-500">Start Date</label>
                  <input className="input pr-8" type="date" value={startDate} onChange={(e) => setStartDate(e.currentTarget.value)} />
                  {startDate ? <button type="button" className="absolute bottom-1 right-1 h-6 w-6 rounded text-slate-400 hover:bg-slate-100 hover:text-rose-600" onClick={() => setStartDate("")}>x</button> : null}
                </div>
                <div className="relative">
                  <label className="block text-[11px] font-semibold uppercase text-slate-500">End Date</label>
                  <input className="input pr-8" type="date" value={endDate} onChange={(e) => setEndDate(e.currentTarget.value)} />
                  {endDate ? <button type="button" className="absolute bottom-1 right-1 h-6 w-6 rounded text-slate-400 hover:bg-slate-100 hover:text-rose-600" onClick={() => setEndDate("")}>x</button> : null}
                </div>
              </div>
              <button type="button" className="btn btn-sm mt-3 w-full" disabled={syncSelection.isPending} onClick={() => void refreshSubmissions()}>
                {syncSelection.isPending ? "Refreshing..." : "Refresh Submission List"}
              </button>
            </div>
            <div className="min-h-0 overflow-auto">
              <table className="w-full table-fixed text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-900">
                  <tr><th className="w-14 px-2 py-2">Type</th><th className="px-2 py-2">Vendor / Submitter</th><th className="w-24 px-2 py-2 text-right">Amount</th><th className="w-8 px-2 py-2" /></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visibleRows.map((item) => {
                    const type = rowSourceType(item);
                    const active = selectedQueueId === item.id;
                    return (
                      <tr key={`source-${item.id}`} className={`cursor-pointer ${active ? "bg-sky-50 dark:bg-sky-950/30" : selectedIds.has(item.id) ? "bg-slate-50 text-slate-500 dark:bg-slate-900" : "hover:bg-slate-50 dark:hover:bg-slate-900"}`} onClick={() => { setSelectedQueueId(item.id); setSelectedIds((prev) => new Set(prev).add(item.id)); setDetailOpen(true); }}>
                        <td className="px-2 py-2 text-xs">{type === "invoice" ? "Inv" : "Card"}</td>
                        <td className="min-w-0 px-2 py-2">
                          <div className="truncate font-semibold text-slate-900 dark:text-slate-100">{String(item.merchant || item.descriptor || item.formTitle || "Spend row")}</div>
                          <div className="truncate text-xs text-slate-500">{fmtDateOrDash(item.createdAt || item.dueDate)} - {String(item.purchaser || item.customer || item.submissionId || "")}</div>
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-xs">{fmtCurrencyUSD(item.amount)}</td>
                        <td className="px-2 py-2 text-xs">{selectedIds.has(item.id) ? "OK" : ">"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </aside>

          <section className="min-w-0 min-h-0 overflow-hidden bg-white dark:bg-slate-950">
            <div className="flex h-12 items-center justify-between border-b border-slate-200 px-3 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <strong className="text-sm text-slate-800 dark:text-slate-200">Matching Rows</strong>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">{selectedCount} selected</span>
                <span className="text-xs text-slate-400">Rows originate from current budget pipeline filter logic.</span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" className="btn btn-xs" onClick={assignDraftToSelected}>Match Selected</button>
                <button type="button" className="btn btn-xs" disabled={!canApply} onClick={() => void applyClassification()}>{applying ? "Saving..." : "Assign/Reallocate Grant"}</button>
                <button type="button" className="btn btn-xs btn-ghost" onClick={markReviewed}>Mark Reviewed</button>
                <button type="button" className="btn btn-xs btn-ghost" onClick={excludeSelected}>Exclude</button>
                <button type="button" className="btn btn-xs btn-primary" disabled={applying || selectedRows.length === 0} onClick={() => void postSelectedToLedger()}>Post to Ledger</button>
              </div>
            </div>
            <div className="grid gap-3 border-b border-slate-200 p-3 dark:border-slate-700 lg:grid-cols-[1.2fr_1fr_1fr_auto]">
              <input className="input" placeholder="Search all pulled Jotform/queue fields" value={search} onChange={(e) => setSearch(e.currentTarget.value)} />
              <GrantSelect value={targetGrantId || null} onChange={(next) => { setTargetGrantId(String(next || "")); setTargetLineItemId(""); }} includeUnassigned mode="grant" placeholderLabel="No Grant Classification" />
              <LineItemSelect grantId={targetGrantId || null} value={targetLineItemId || null} onChange={(next) => setTargetLineItemId(String(next || ""))} disabled={!targetGrantId} inputClassName="w-full" />
              <button type="button" className="btn btn-xs btn-ghost" onClick={selectVisible}>Select visible</button>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-700">
              <div>{loading ? "Loading pulled Jotforms..." : `${visibleRows.length} visible of ${queueRows.length} pending rows - ${submissionsById.size} cached submissions`}</div>
              <label className="inline-flex items-center gap-1"><input type="checkbox" checked={showOnlyPreview} onChange={(e) => setShowOnlyPreview(e.currentTarget.checked)} /> Preview matches only</label>
            </div>
            <div className="min-h-0 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="w-10 px-3 py-2" />
                <th className="w-24 px-3 py-2">Date</th>
                <th className="px-3 py-2">Vendor</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Grant</th>
                <th className="px-3 py-2">Confidence</th>
                <th className="px-3 py-2">Allocation</th>
                <th className="px-3 py-2">Ledger</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {visibleRows.map((item) => {
                const submission = submissionsById.get(String(item.submissionId || ""));
                const checked = selectedIds.has(item.id);
                const conflict = conflictIds.has(item.id);
                const reviewed = reviewedIds.has(item.id);
                const blockers = ledgerPostBlockers(item, { unsaved: dirtyIds.has(item.id), conflict, duplicate: !!item.ledgerEntryId });
                const confidence = conflict ? "Conflict" : previewIds.has(item.id) ? "Matched" : "Possible";
                const allocation = dirtyIds.has(item.id) ? "Unsaved" : reviewed ? "Reviewed" : item.grantId && item.lineItemId ? "Saved" : "Draft";
                const ledger = blockers.length ? "Blocked" : item.queueStatus === "posted" ? "Posted" : "Ready";
                return (
                  <tr
                    key={item.id}
                    className={`${checked ? "bg-sky-50 dark:bg-sky-950/30" : "bg-white dark:bg-slate-950"} ${conflict ? "shadow-[inset_3px_0_0_#dc2626]" : ""} cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900`}
                    onClick={() => setSelectedQueueId(item.id)}
                    onDoubleClick={() => setDetailOpen(true)}
                  >
                    <td className="px-3 py-2 align-top">
                      <input type="checkbox" checked={checked} onChange={() => toggleOne(item.id)} onClick={(e) => e.stopPropagation()} />
                    </td>
                    <td className="px-3 py-2 align-top text-xs">{fmtDateOrDash(item.createdAt || item.dueDate)}</td>
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{String(item.merchant || item.descriptor || item.formTitle || "Jotform spend")}</div>
                      <div className="text-xs text-slate-500">{String(item.source || "")} - {String(item.submissionId || item.id)}</div>
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-slate-600 dark:text-slate-400">
                      <div className="line-clamp-2">{String(item.purpose || item.notes || item.note || item.descriptor || (submission as any)?.formTitle || "-")}</div>
                      <div className="mt-0.5 text-slate-400">{String(item.program || item.project || item.billedTo || item.customer || "")}</div>
                    </td>
                    <td className="px-3 py-2 align-top tabular-nums text-slate-700 dark:text-slate-300">
                      {fmtCurrencyUSD(item.amount)}
                    </td>
                    <td className="px-3 py-2 align-top text-xs">
                      {rowSourceType(item) === "invoice" ? "Invoice" : "Card"}
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-slate-600 dark:text-slate-400">
                      <div>{grantNameById.get(String(item.grantId || "")) || String(item.grantId || "unassigned")}</div>
                      <div>{String(item.lineItemId || "")}</div>
                    </td>
                    <td className="px-3 py-2 align-top text-xs">
                      <span className={conflict ? "rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-700" : previewIds.has(item.id) ? "rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700" : "rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700"}>{confidence}</span>
                    </td>
                    <td className="px-3 py-2 align-top text-xs">
                      <span className={dirtyIds.has(item.id) ? "rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700" : reviewed || (item.grantId && item.lineItemId) ? "rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700" : "rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600"}>{allocation}</span>
                    </td>
                    <td className="px-3 py-2 align-top text-xs" title={blockers.join(", ")}>
                      <span className={ledger === "Blocked" ? "rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-700" : ledger === "Ready" ? "rounded-full bg-sky-100 px-2 py-0.5 font-semibold text-sky-700" : "rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600"}>{ledger}</span>
                    </td>
                  </tr>
                );
              })}
              {!loading && visibleRows.length === 0 ? (
                <tr><td colSpan={10} className="px-3 py-8 text-center text-sm text-slate-500">No pending pulled spending rows match this view.</td></tr>
              ) : null}
            </tbody>
          </table>
            </div>
          </section>

          <aside className="min-h-0 overflow-hidden border-l border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
            <div className="border-b border-slate-200 p-3 dark:border-slate-700">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Adjust Payment</div>
              <div className="mt-1 text-xs text-slate-500">Uses the existing invoice/card payment detail flow.</div>
            </div>
            <div className="min-h-0 overflow-auto p-3">
              {selectedQueueItem ? (
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{String(selectedQueueItem.merchant || selectedQueueItem.descriptor || selectedQueueItem.formTitle || "Spend item")}</div>
                      <div className="text-xs text-slate-500">{String(selectedQueueItem.submissionId || selectedQueueItem.id)}</div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{fmtCurrencyUSD(selectedQueueItem.amount)}</span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <div><span className="font-semibold text-slate-500">Source:</span> {rowSourceType(selectedQueueItem) === "invoice" ? "Invoice submission" : "Credit card documentation"}</div>
                    <div><span className="font-semibold text-slate-500">Current grant:</span> {grantNameById.get(String(selectedQueueItem.grantId || "")) || String(selectedQueueItem.grantId || "unassigned")}</div>
                    <div><span className="font-semibold text-slate-500">Line item:</span> {String(selectedQueueItem.lineItemId || "-")}</div>
                    <div><span className="font-semibold text-slate-500">Risk:</span> {ledgerPostBlockers(selectedQueueItem, { unsaved: dirtyIds.has(selectedQueueItem.id), conflict: conflictIds.has(selectedQueueItem.id), duplicate: !!selectedQueueItem.ledgerEntryId }).join(", ") || "Ready"}</div>
                  </div>
                  <button type="button" className="btn btn-sm btn-primary mt-3 w-full" onClick={() => setDetailOpen(true)}>
                    Open Payment Detail
                  </button>
                  <button type="button" className="btn btn-sm mt-2 w-full" disabled={!canApply || !selectedIds.has(selectedQueueItem.id)} onClick={() => void applyClassification()}>
                    Save Spend Item Allocation
                  </button>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-500">
                  Select a source submission or matched spend row to adjust it.
                </div>
              )}
            </div>
          </aside>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 dark:border-slate-700 dark:bg-slate-900">
          <button type="button" className="btn btn-sm btn-ghost" onClick={requestClose}>Cancel Session</button>
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-sm" disabled={!canApply} onClick={() => void applyClassification()}>Save Draft</button>
            <button type="button" className="btn btn-sm" onClick={() => dirtyIds.size ? setConfirmCloseOpen(true) : onClose()}>Save and Close</button>
            <button type="button" className="btn btn-sm btn-primary" disabled={selectedRows.length === 0 || applying} onClick={() => void postSelectedToLedger()}>Post All Ready to Ledger</button>
          </div>
        </div>

        {confirmCloseOpen ? (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
            <div className="w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-950">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold dark:border-slate-700 dark:bg-slate-900">Unsaved Changes</div>
              <div className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
                Save spend item allocation before closing? {dirtyIds.size} row{dirtyIds.size === 1 ? " has" : "s have"} unsaved grant allocation changes.
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirmCloseOpen(false)}>Cancel</button>
                <button type="button" className="btn btn-sm text-rose-700" onClick={onClose}>Close Without Saving</button>
                <button type="button" className="btn btn-sm btn-primary" disabled={!canApply} onClick={async () => { if (await applyClassification()) onClose(); }}>Save and Close</button>
              </div>
            </div>
          </div>
        ) : null}

        <SpendDetailModal
          row={detailRow}
          isOpen={detailOpen && !!detailRow}
          onClose={() => { setDetailOpen(false); void Promise.all([creditCardQueueQ.refetch(), invoiceQueueQ.refetch()]); }}
          grantNameById={grantNameById}
          lineItemLookup={lineItemLookup}
          customerNameById={customerNameById}
        />
      </div>
    </div>
  );
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
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

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
  }, [selectedSource, selectedSourceKey]);

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

        <PreviewTable
          result={previewResult}
          isLoading={isPreviewLoading}
          onRun={handlePreview}
          onAdvanced={() => setBulkModalOpen(true)}
        />
      </main>

      <BulkGrantDesignationModal
        open={bulkModalOpen}
        previewResult={previewResult}
        defaultGrantId={draft.grantId}
        defaultLineItemId={draft.lineItemId}
        onClose={() => setBulkModalOpen(false)}
      />
    </div>
  );
}

export default PipelineBuilderPage;
