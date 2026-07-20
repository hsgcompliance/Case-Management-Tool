"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "@entities/ui/Modal";
import { toApiError } from "@client/api";
import { fmtMDY, safeISODate10, toISODate } from "@lib/date";
import { toast } from "@lib/toast";
import { useGrantBudgetManagerLoad, useSaveGrantBudgetManager } from "@hooks/useGrantBudgetManager";
import { calculateRentCertDueDate, usePaymentRentCert, usePaymentsSpend, usePaymentsUpdateCompliance } from "@hooks/usePayments";
import type { TGrantBudgetManagerRow } from "@types";

type SortDirection = "asc" | "desc";
type SandboxScale = "tight" | "compact" | "regular" | "large";
type SandboxSortKey = "grant" | "date" | "amount" | "customer" | "caseManager" | "lineItem" | "sourceType" | "type" | "note" | "sourceStatus" | "sandboxChange";
type SandboxRowState = "clean" | "changed" | "new" | "deleted";
type EditableField = "date" | "amountCents" | "customerLabel" | "caseManagerLabel" | "lineItemId" | "budgetTypeLabel" | "noteText" | "statusLabel" | "rentCertDueOn";

export type GrantBudgetSandboxSeedRow = {
  sourceId: string;
  sourceKind: string;
  sourceType?: "ledger" | "paymentQueue" | "newProjection";
  ledgerItemId?: string | null;
  paymentQueueItemId?: string | null;
  enrollmentId?: string | null;
  paymentId?: string | null;
  grantId: string;
  grantName?: string;
  lineItemId: string;
  date: string;
  amountCents: number;
  customerId?: string | null;
  customerLabel: string;
  caseManagerId?: string | null;
  caseManagerLabel?: string;
  budgetTypeLabel: string;
  noteText: string;
  vendor?: string | null;
  category?: string | null;
  reversalOf?: string | null;
  reversedByLedgerItemIds?: string[];
  isWritable?: boolean;
  lockedReason?: string | null;
  original?: TGrantBudgetManagerRow["original"];
  rentCertDueOn?: string;
  statusLabel: string;
};

export type GrantBudgetSandboxLineItem = {
  id: string;
  grantId?: string;
  label: string;
  typeLabel: string;
  budgetCents: number;
};

type SandboxRow = GrantBudgetSandboxSeedRow & {
  sandboxId: string;
  rowState: SandboxRowState;
  original: GrantBudgetSandboxSeedRow;
};

const SCALE_ORDER: SandboxScale[] = ["tight", "compact", "regular", "large"];
const SCALE_CONFIG: Record<SandboxScale, {
  label: string;
  table: string;
  cell: string;
  header: string;
  input: string;
  badge: string;
}> = {
  tight: {
    label: "Tight",
    table: "text-[11px]",
    cell: "px-1.5 py-0.5",
    header: "px-1.5 py-1",
    input: "h-6 text-[11px]",
    badge: "text-[9px]",
  },
  compact: {
    label: "Compact",
    table: "text-xs",
    cell: "px-2 py-1",
    header: "px-2 py-1",
    input: "h-7 text-xs",
    badge: "text-[10px]",
  },
  regular: {
    label: "Regular",
    table: "text-sm",
    cell: "px-2.5 py-1.5",
    header: "px-2.5 py-1.5",
    input: "h-8 text-sm",
    badge: "text-[11px]",
  },
  large: {
    label: "Large",
    table: "text-base",
    cell: "px-3 py-2",
    header: "px-3 py-2",
    input: "h-9 text-sm",
    badge: "text-xs",
  },
};

const SOURCE_FILTERS = [
  { value: "all", label: "All sources" },
  { value: "ledger", label: "Ledger" },
  { value: "paymentQueue", label: "Payment Queue" },
  { value: "newProjection", label: "New Projection" },
] as const;

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "posted", label: "Posted" },
  { value: "projected", label: "Projected" },
  { value: "open", label: "Open" },
  { value: "new", label: "New" },
  { value: "reversal", label: "Reversal/Reversed" },
] as const;

function compareText(a: unknown, b: unknown) {
  return String(a || "").localeCompare(String(b || ""), undefined, { numeric: true, sensitivity: "base" });
}

function csvCell(value: unknown) {
  const raw = value == null ? "" : String(value);
  if (!/[",\r\n]/.test(raw)) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function filenamePart(value: string) {
  return String(value || "budget-manager")
    .trim()
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "budget-manager";
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function applyDirection(value: number, direction: SortDirection) {
  return direction === "asc" ? value : -value;
}

function centsFromAmountInput(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function amountInputFromCents(value: number) {
  return (Math.round(value) / 100).toFixed(2);
}

function normalizeDate(value: string) {
  const iso = safeISODate10(value);
  if (iso) return iso;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : toISODate(date);
}

function rowSearchText(row: SandboxRow, lineItemLabel: string) {
  return [
    row.customerLabel,
    row.caseManagerLabel,
    row.grantName,
    row.budgetTypeLabel,
    row.noteText,
    row.rentCertDueOn,
    lineItemLabel,
    row.statusLabel,
    row.sourceKind,
  ].join(" ");
}

function seedRows(rows: GrantBudgetSandboxSeedRow[]): SandboxRow[] {
  return rows.map((row, index) => ({
    ...row,
    sandboxId: `seed:${row.sourceId || index}`,
    rowState: "clean",
    original: { ...row },
  }));
}

function isChanged(row: SandboxRow) {
  return (
    row.date !== row.original.date ||
    row.amountCents !== row.original.amountCents ||
    row.grantId !== row.original.grantId ||
    row.customerLabel !== row.original.customerLabel ||
    row.caseManagerLabel !== row.original.caseManagerLabel ||
    row.lineItemId !== row.original.lineItemId ||
    row.budgetTypeLabel !== row.original.budgetTypeLabel ||
    row.noteText !== row.original.noteText ||
    row.statusLabel !== row.original.statusLabel
  );
}

function isIncompleteProjectionDraft(row: SandboxRow) {
  return row.rowState === "new"
    && row.sourceType === "newProjection"
    && (!row.customerLabel.trim() || row.amountCents <= 0);
}

function rowStateLabel(state: SandboxRowState) {
  return state === "clean" ? "Clean" : state === "changed" ? "Edited" : state === "new" ? "Added" : "Removed";
}

function deltaClass(value: number) {
  return value >= 0 ? "text-emerald-600" : "text-red-600";
}

function sourceStatusClass(label: string) {
  const normalized = normalizeText(label);
  if (normalized.includes("reversal") || normalized.includes("reversed")) return "bg-red-100 text-red-700";
  if (normalized.includes("project")) return "bg-purple-100 text-purple-700";
  if (normalized.includes("posted") || normalized.includes("paid")) return "bg-emerald-100 text-emerald-700";
  if (normalized.includes("new")) return "bg-yellow-100 text-yellow-800";
  return "bg-slate-100 text-slate-600";
}

function statusBucket(row: Pick<SandboxRow, "statusLabel" | "sourceType" | "sourceKind">) {
  const normalized = normalizeText([row.statusLabel, row.sourceType, row.sourceKind].join(" "));
  if (normalized.includes("reversal") || normalized.includes("reversed")) return "reversal";
  if (normalized.includes("posted") || normalized.includes("paid")) return "posted";
  if (normalized.includes("project") || normalized.includes("payment queue") || normalized.includes("pending")) return "projected";
  if (normalized.includes("open")) return "open";
  if (normalized.includes("new")) return "new";
  return "other";
}

function statusDisplayLabel(row: Pick<SandboxRow, "statusLabel" | "sourceType" | "sourceKind">) {
  const bucket = statusBucket(row);
  if (bucket === "posted") return "Posted";
  if (bucket === "projected") return "Projected";
  if (bucket === "reversal") return "Reversal";
  if (bucket === "new") return "New";
  if (bucket === "open") return "Open";
  return row.statusLabel || "Status";
}

function isReversalRelated(row: SandboxRow) {
  const normalized = normalizeText([row.statusLabel, row.sourceKind, row.noteText].join(" "));
  return Boolean(
    row.reversalOf ||
    row.reversedByLedgerItemIds?.length ||
    normalized.includes("reversal") ||
    normalized.includes("reversed"),
  );
}

function sandboxChangeClass(state: SandboxRowState) {
  if (state === "deleted") return "bg-red-100 text-red-700";
  if (state === "changed") return "bg-yellow-200 text-yellow-900";
  if (state === "new") return "bg-amber-200 text-amber-900";
  return "bg-slate-100 text-slate-600";
}

function LoadingSpinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
  );
}

function seedFromManagerRows(rows: TGrantBudgetManagerRow[]): GrantBudgetSandboxSeedRow[] {
  return rows.map((row) => ({
    sourceId: row.sourceId || row.ledgerItemId || row.paymentQueueItemId || row.rowId,
    sourceKind: row.sourceType,
    sourceType: row.sourceType,
    ledgerItemId: row.ledgerItemId || null,
    paymentQueueItemId: row.paymentQueueItemId || null,
    enrollmentId: row.enrollmentId || null,
    paymentId: row.paymentId || null,
    grantId: row.grantId,
    grantName: String((row as Record<string, unknown>).grantName || row.grantId),
    lineItemId: String(row.lineItemId || ""),
    date: String(row.date || row.serviceDate || row.paymentDate || ""),
    amountCents: Math.round(Number(row.amount || 0) * 100),
    customerId: row.customerId || null,
    customerLabel: String(row.customerName || row.customerId || ""),
    caseManagerId: row.caseManagerId || null,
    caseManagerLabel: String(row.caseManagerName || ""),
    budgetTypeLabel: String(row.category || ""),
    noteText: String(row.description || row.memo || ""),
    vendor: row.vendor || null,
    category: row.category || null,
    reversalOf: row.reversalOf || null,
    reversedByLedgerItemIds: Array.isArray(row.reversedByLedgerItemIds) ? row.reversedByLedgerItemIds : [],
    isWritable: row.isWritable !== false,
    lockedReason: row.lockedReason || null,
    original: row.original,
    rentCertDueOn: row.rentCertDueOn || "",
    statusLabel: String(row.status || row.sourceType),
  }));
}

function useLocalSandboxScenario(seed: GrantBudgetSandboxSeedRow[], lineItems: GrantBudgetSandboxLineItem[]) {
  const loadScenario = useCallback(() => seedRows(seed), [seed]);
  const [rows, setRows] = useState<SandboxRow[]>(() => loadScenario());

  // Reseed when fresh data arrives, but never clobber in-progress edits —
  // background refetches (query invalidation, window refocus) must not wipe
  // pending rows. Explicit resetScenario/replaceScenario still replace.
  useEffect(() => {
    setRows((current) => (current.some((row) => row.rowState !== "clean") ? current : loadScenario()));
  }, [loadScenario]);

  const lineItemById = useMemo(() => new Map(lineItems.map((item) => [item.id, item])), [lineItems]);

  const updateRow = useCallback((sandboxId: string, patch: Partial<Pick<SandboxRow, EditableField>>) => {
    setRows((current) => current.map((row) => {
      if (row.sandboxId !== sandboxId) return row;
      const next = { ...row, ...patch };
      return {
        ...next,
        rowState: row.rowState === "deleted" ? "deleted" : row.rowState === "new" ? "new" : isChanged(next) ? "changed" : "clean",
      };
    }));
  }, []);

  const duplicateRow = useCallback((sandboxId: string) => {
    setRows((current) => {
      const source = current.find((row) => row.sandboxId === sandboxId);
      if (!source) return current;
      // A duplicate is a brand-new projection: it must not carry the source
      // row's ledger/queue identity or payment linkage.
      const duplicate: SandboxRow = {
        ...source,
        sandboxId: `dup:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 7)}`,
        sourceId: "",
        sourceKind: "sandbox",
        sourceType: "newProjection",
        ledgerItemId: null,
        paymentQueueItemId: null,
        enrollmentId: null,
        paymentId: null,
        reversalOf: null,
        reversedByLedgerItemIds: [],
        isWritable: true,
        lockedReason: null,
        rentCertDueOn: "",
        rowState: "new",
        statusLabel: "New",
        original: {
          ...source.original,
          sourceId: "",
          sourceKind: "sandbox",
          amountCents: 0,
          date: source.date,
          caseManagerLabel: source.caseManagerLabel,
          statusLabel: "New",
          original: undefined,
        },
      };
      const sourceIndex = current.findIndex((row) => row.sandboxId === sandboxId);
      return [
        ...current.slice(0, sourceIndex + 1),
        duplicate,
        ...current.slice(sourceIndex + 1),
      ];
    });
  }, []);

  const addRowBelow = useCallback((sandboxId: string) => {
    const incompleteDraft = rows.find(isIncompleteProjectionDraft);
    if (incompleteDraft) return incompleteDraft.sandboxId;
    const newSandboxId = `new:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 7)}`;
    setRows((current) => {
      const sourceIndex = current.findIndex((row) => row.sandboxId === sandboxId);
      const source = sourceIndex >= 0 ? current[sourceIndex] : null;
      const lineItem = source ? lineItemById.get(source.lineItemId) : null;
      const date = source?.date || toISODate(new Date());
      const row: SandboxRow = {
        sandboxId: newSandboxId,
        sourceId: "",
        sourceKind: "sandbox",
        sourceType: "newProjection",
        grantId: source?.grantId || "",
        grantName: source?.grantName || source?.grantId || "",
        lineItemId: source?.lineItemId || "",
        date,
        amountCents: 0,
        customerLabel: "",
        caseManagerLabel: "",
        budgetTypeLabel: lineItem?.typeLabel || "N/A",
        noteText: "",
        rentCertDueOn: "",
        statusLabel: "New",
        rowState: "new",
        original: {
          sourceId: "",
          sourceKind: "sandbox",
          grantId: source?.grantId || "",
          grantName: source?.grantName || source?.grantId || "",
          lineItemId: source?.lineItemId || "",
          date,
          amountCents: 0,
          customerLabel: "",
          caseManagerLabel: "",
          budgetTypeLabel: "N/A",
          noteText: "",
          rentCertDueOn: "",
          statusLabel: "New",
        },
      };
      const insertIndex = sourceIndex >= 0 ? sourceIndex + 1 : current.length;
      return [
        ...current.slice(0, insertIndex),
        row,
        ...current.slice(insertIndex),
      ];
    });
    return newSandboxId;
  }, [lineItemById, rows]);

  const removeRow = useCallback((sandboxId: string) => {
    setRows((current) => current.flatMap((row) => {
      if (row.sandboxId !== sandboxId) return [row];
      if (row.rowState === "new") return [];
      if (row.sourceType === "ledger") {
        // The save endpoint always skips deleted ledger rows
        // (unsupported_source_action) — surface that before save, not after.
        toast("Ledger rows can't be removed here — reverse the payment from its payment workflow instead.", { type: "warn" });
        return [row];
      }
      return [{ ...row, rowState: "deleted" }];
    }));
  }, []);

  const restoreRow = useCallback((sandboxId: string) => {
    setRows((current) => current.map((row) => {
      if (row.sandboxId !== sandboxId) return row;
      if (!row.sourceId) return { ...row, rowState: "new" };
      const next = { ...row, rowState: "clean" as SandboxRowState };
      return { ...next, rowState: isChanged(next) ? "changed" : "clean" };
    }));
  }, []);

  const resetScenario = useCallback(() => {
    setRows(loadScenario());
  }, [loadScenario]);

  const replaceScenario = useCallback((nextSeed: GrantBudgetSandboxSeedRow[]) => {
    setRows(seedRows(nextSeed));
  }, []);

  return { rows, updateRow, duplicateRow, addRowBelow, removeRow, restoreRow, resetScenario, replaceScenario };
}

export function GrantBudgetSandboxModal({
  isOpen,
  onClose,
  grantIds,
  readOnly = false,
  canSave = false,
  grantId,
  grantName,
  seedRows: seed,
  lineItems,
  currency,
  onOpenPayment,
  onOpenCustomer,
}: {
  isOpen: boolean;
  onClose: () => void;
  grantIds?: string[];
  readOnly?: boolean;
  canSave?: boolean;
  grantId: string;
  grantName: string;
  seedRows: GrantBudgetSandboxSeedRow[];
  lineItems: GrantBudgetSandboxLineItem[];
  currency: (n: number) => string;
  onOpenPayment?: (sourceId: string) => void;
  onOpenCustomer?: (customerId: string) => void;
}) {
  const managerGrantIds = useMemo(
    () => Array.from(new Set((grantIds || []).map((id) => String(id || "").trim()).filter(Boolean))),
    [grantIds],
  );
  const managerMode = managerGrantIds.length > 0;
  const managerQ = useGrantBudgetManagerLoad(managerGrantIds, { enabled: isOpen && managerMode });
  const saveManager = useSaveGrantBudgetManager();
  const rentCertMutation = usePaymentRentCert();
  const spendMutation = usePaymentsSpend();
  const complianceMutation = usePaymentsUpdateCompliance();
  const loadedRows = managerQ.data?.ok ? managerQ.data.rows : [];
  const activeSeed = useMemo<GrantBudgetSandboxSeedRow[]>(() => {
    if (!managerMode) return seed;
    return seedFromManagerRows(loadedRows);
  }, [loadedRows, managerMode, seed]);
  const activeLineItems = useMemo<GrantBudgetSandboxLineItem[]>(() => {
    if (!managerMode) return lineItems;
    return (managerQ.data?.ok ? managerQ.data.lineItems : []).map((item) => ({
      id: item.id,
      grantId: item.grantId,
      label: item.label,
      typeLabel: item.typeLabel || "",
      budgetCents: Math.round(Number(item.budget || 0) * 100),
    }));
  }, [lineItems, managerMode, managerQ.data]);
  const { rows, updateRow, duplicateRow, addRowBelow, removeRow, restoreRow, resetScenario, replaceScenario } = useLocalSandboxScenario(activeSeed, activeLineItems);
  const [lineItemFilter, setLineItemFilter] = useState("all");
  const [grantFilter, setGrantFilter] = useState("all");
  const [search, setSearch] = useState("");
  const deferredSearch = React.useDeferredValue(search);
  const [showDeleted, setShowDeleted] = useState(false);
  const [showReversals, setShowReversals] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<(typeof SOURCE_FILTERS)[number]["value"]>("all");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]["value"]>("all");
  const [sortStack, setSortStack] = useState<Array<{ key: SandboxSortKey; direction: SortDirection }>>([{ key: "date", direction: "desc" }]);
  const [scale, setScale] = useState<SandboxScale>("compact");
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: EditableField; value: string } | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [saveMode, setSaveMode] = useState<"preview" | "applyOpen" | "applyAll">("applyOpen");
  const [saveResult, setSaveResult] = useState<Awaited<ReturnType<typeof saveManager.mutateAsync>> | null>(null);
  const [refreshingAfterSave, setRefreshingAfterSave] = useState(false);
  const [pendingRentCertRowId, setPendingRentCertRowId] = useState<string | null>(null);

  // Reset only on the closed -> open transition. resetScenario's identity
  // changes whenever fresh data loads, and re-running this effect mid-session
  // would wipe the user's filters, sort, and in-progress edits.
  const wasOpenRef = React.useRef(false);
  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = isOpen;
    if (!isOpen || wasOpen) return;
    setLineItemFilter("all");
    setSearch("");
    setShowDeleted(false);
    setShowReversals(false);
    setShowAdvancedFilters(false);
    setSourceFilter("all");
    setStatusFilter("all");
    setSortStack([{ key: "date", direction: "desc" }]);
    setGrantFilter("all");
    setScale("compact");
    setEditingCell(null);
    setSelectedRowId(null);
    setSaveMode("applyOpen");
    setSaveResult(null);
    setRefreshingAfterSave(false);
    resetScenario();
  }, [isOpen, resetScenario]);

  const lineItemById = useMemo(() => new Map(activeLineItems.map((item) => [item.id, item])), [activeLineItems]);
  const grantsInSandbox = useMemo(() => {
    const fromRows = activeSeed.map((row) => ({ id: row.grantId, label: row.grantName || row.grantId })).filter((row) => row.id);
    const byId = new Map(fromRows.map((row) => [row.id, row]));
    return Array.from(byId.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [activeSeed]);
  const budgetPipelineRefs = useMemo(() => {
    const refs: Array<{ id: string; name: string; grantId: string }> = [];
    if (!managerQ.data?.ok) return refs;
    for (const grant of managerQ.data.grants || []) {
      const raw = grant as Record<string, unknown>;
      const grantIdValue = String(raw.id || "").trim();
      const pipelineRefs = Array.isArray(raw.budgetPipelineRefs) ? raw.budgetPipelineRefs : [];
      for (const ref of pipelineRefs) {
        const item = ref && typeof ref === "object" ? ref as Record<string, unknown> : {};
        const id = String(item.id || "").trim();
        if (!id) continue;
        refs.push({ id, name: String(item.name || id), grantId: grantIdValue });
      }
    }
    const seen = new Set<string>();
    return refs.filter((ref) => {
      if (seen.has(ref.id)) return false;
      seen.add(ref.id);
      return true;
    });
  }, [managerQ.data]);
  const pipelineHref = budgetPipelineRefs.length === 1
    ? `/budget/pipeline/${encodeURIComponent(budgetPipelineRefs[0]?.id || "")}`
    : "/budget/pipeline";
  const selectedRow = useMemo(() => rows.find((row) => row.sandboxId === selectedRowId) ?? null, [rows, selectedRowId]);
  const selectedRowBusy = spendMutation.isPending || complianceMutation.isPending;
  const refreshManagerRows = useCallback(async (keepSelectedId?: string | null) => {
    const refreshed = await managerQ.refetch();
    if (refreshed.data?.ok) {
      replaceScenario(seedFromManagerRows(refreshed.data.rows));
      setSelectedRowId(keepSelectedId || null);
    }
  }, [managerQ, replaceScenario]);

  const markSelectedPaid = useCallback(async (row: SandboxRow) => {
    const enrollmentId = String(row.enrollmentId || "").trim();
    const paymentId = String(row.paymentId || "").trim();
    if (!enrollmentId || !paymentId) {
      toast("This standalone projection is not linked to an enrollment payment. Link it to a payment schedule before marking it paid.", { type: "warning" });
      return;
    }
    try {
      await spendMutation.mutateAsync({ body: { enrollmentId, paymentId, reverse: false, forceSync: false } });
      toast("Payment marked paid. Ledger and spend mirrors are syncing.", { type: "success" });
      void refreshManagerRows(row.sandboxId);
    } catch (error) {
      toast(toApiError(error).error || "Failed to mark payment paid.", { type: "error" });
    }
  }, [refreshManagerRows, spendMutation]);

  const markSelectedDataEntryComplete = useCallback(async (row: SandboxRow) => {
    const enrollmentId = String(row.enrollmentId || "").trim();
    const paymentId = String(row.paymentId || "").trim();
    if (!enrollmentId || !paymentId) {
      toast("This row is not linked to an enrollment payment, so payment compliance cannot be updated here.", { type: "warning" });
      return;
    }
    try {
      await complianceMutation.mutateAsync({
        enrollmentId,
        paymentId,
        patch: { hmisComplete: true, caseworthyComplete: true, status: "data-entry-complete" },
      });
      toast("Data entry marked complete.", { type: "success" });
      void refreshManagerRows(row.sandboxId);
    } catch (error) {
      toast(toApiError(error).error || "Failed to update payment compliance.", { type: "error" });
    }
  }, [complianceMutation, refreshManagerRows]);
  const updateRentCert = useCallback(async (row: SandboxRow) => {
    const enrollmentId = String(row.enrollmentId || "").trim();
    const paymentId = String(row.paymentId || "").trim();
    if (!enrollmentId || !paymentId) {
      toast("This budget row is not linked to an enrollment payment.", { type: "error" });
      return;
    }
    const current = row.rentCertDueOn || calculateRentCertDueDate(row.date);
    const raw = window.prompt("Rent cert due date (YYYY-MM-DD). Leave blank to clear.", current);
    if (raw == null) return;
    const dueDate = raw.trim() || null;
    if (dueDate && !safeISODate10(dueDate)) {
      toast("Enter a valid YYYY-MM-DD rent-cert date.", { type: "error" });
      return;
    }
    const previousDueDate = row.rentCertDueOn || "";
    updateRow(row.sandboxId, { rentCertDueOn: dueDate || "" });
    setPendingRentCertRowId(row.sandboxId);
    try {
      await rentCertMutation.mutateAsync({ enrollmentId, paymentId, dueDate });
      void managerQ.refetch();
      toast(dueDate ? "Rent cert updated." : "Rent cert cleared.", { type: "success" });
    } catch (error) {
      updateRow(row.sandboxId, { rentCertDueOn: previousDueDate });
      toast(toApiError(error).error || "Failed to update rent cert.", { type: "error" });
    } finally {
      setPendingRentCertRowId(null);
    }
  }, [managerQ, rentCertMutation, updateRow]);

  useEffect(() => {
    if (!selectedRowId) return;
    const onDocMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-sandbox-actionbar]") || target?.closest("[data-sandbox-row-id]")) return;
      setSelectedRowId(null);
    };
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedRowId(null);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [selectedRowId]);

  useEffect(() => {
    if (!selectedRowId) return;
    const frame = window.requestAnimationFrame(() => {
      const selectedElement = Array.from(document.querySelectorAll<HTMLElement>("[data-sandbox-row-id]"))
        .find((element) => element.dataset.sandboxRowId === selectedRowId);
      selectedElement?.scrollIntoView({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedRowId]);

  const visibleRows = useMemo(() => {
    const normalizedSearch = normalizeText(deferredSearch);
    const compareByKey = (key: SandboxSortKey, a: SandboxRow, b: SandboxRow) => {
      const aLine = lineItemById.get(a.lineItemId)?.label || a.lineItemId;
      const bLine = lineItemById.get(b.lineItemId)?.label || b.lineItemId;
      return key === "date" ? compareText(a.date, b.date)
        : key === "amount" ? a.amountCents - b.amountCents
        : key === "grant" ? compareText(a.grantName || a.grantId, b.grantName || b.grantId)
        : key === "customer" ? compareText(a.customerLabel, b.customerLabel)
        : key === "caseManager" ? compareText(a.caseManagerLabel, b.caseManagerLabel)
        : key === "lineItem" ? compareText(aLine, bLine)
        : key === "sourceType" ? compareText(a.sourceType || a.sourceKind, b.sourceType || b.sourceKind)
        : key === "type" ? compareText(a.budgetTypeLabel, b.budgetTypeLabel)
        : key === "note" ? compareText(a.noteText, b.noteText)
        : key === "sourceStatus" ? compareText(a.statusLabel, b.statusLabel)
        : compareText(a.rowState, b.rowState);
    };
    return rows
      .filter((row) => {
        if (!showDeleted && row.rowState === "deleted") return false;
        if (row.sandboxId === selectedRowId && row.rowState === "new") return true;
        if (!showReversals && isReversalRelated(row)) return false;
        if (sourceFilter !== "all" && row.sourceType !== sourceFilter) return false;
        if (statusFilter !== "all" && statusBucket(row) !== statusFilter) return false;
        if (grantFilter !== "all" && row.grantId !== grantFilter) return false;
        if (lineItemFilter !== "all" && row.lineItemId !== lineItemFilter) return false;
        if (!normalizedSearch) return true;
        const lineItemLabel = lineItemById.get(row.lineItemId)?.label || "";
        return normalizeText(rowSearchText(row, lineItemLabel)).includes(normalizedSearch);
      })
      .sort((a, b) => {
        for (const entry of sortStack) {
          const result = compareByKey(entry.key, a, b);
          if (result !== 0) return applyDirection(result, entry.direction);
        }
        return 0;
      });
  }, [deferredSearch, grantFilter, lineItemById, lineItemFilter, rows, selectedRowId, showDeleted, showReversals, sortStack, sourceFilter, statusFilter]);

  const grantSummaryRows = useMemo(() => {
    const ids = grantFilter === "all"
      ? grantsInSandbox.map((grant) => grant.id)
      : [grantFilter].filter(Boolean);
    return ids.map((id) => {
      const grant = grantsInSandbox.find((item) => item.id === id);
      const budgetCents = activeLineItems.reduce((sum, item) => {
        if (item.grantId && item.grantId !== id) return sum;
        return sum + item.budgetCents;
      }, 0);
      const originalCents = activeSeed.reduce((sum, row) => row.grantId === id ? sum + row.amountCents : sum, 0);
      const sandboxCents = rows.reduce((sum, row) => {
        if (row.grantId !== id || row.rowState === "deleted") return sum;
        return sum + row.amountCents;
      }, 0);
      return {
        id,
        label: grant?.label || id,
        budgetCents,
        originalCents,
        sandboxCents,
        deltaCents: sandboxCents - originalCents,
        leftCents: budgetCents - sandboxCents,
      };
    });
  }, [activeLineItems, activeSeed, grantFilter, grantsInSandbox, rows]);
  const pendingChangeCount = rows.filter((row) => row.rowState !== "clean").length;
  const scaleConfig = SCALE_CONFIG[scale];
  const budgetSummaryRows = useMemo(() => {
    return activeLineItems
      .filter((item) => (grantFilter === "all" || !item.grantId || item.grantId === grantFilter) && (lineItemFilter === "all" || item.id === lineItemFilter))
      .map((item) => {
        const originalSpendCents = activeSeed.reduce((sum, row) => {
          if (row.lineItemId !== item.id) return sum;
          if (item.grantId && row.grantId !== item.grantId) return sum;
          return sum + row.amountCents;
        }, 0);
        const sandboxSpendCents = rows.reduce((sum, row) => {
          if (row.lineItemId !== item.id || row.rowState === "deleted") return sum;
          if (item.grantId && row.grantId !== item.grantId) return sum;
          return sum + row.amountCents;
        }, 0);
        return {
          id: `${item.grantId || "grant"}:${item.id}`,
          label: item.label,
          grantLabel: grantsInSandbox.find((grant) => grant.id === item.grantId)?.label || item.grantId || "",
          typeLabel: item.typeLabel,
          budgetCents: item.budgetCents,
          originalSpendCents,
          sandboxSpendCents,
          spendDeltaCents: sandboxSpendCents - originalSpendCents,
          sandboxRemainingCents: item.budgetCents - sandboxSpendCents,
        };
      });
  }, [activeLineItems, activeSeed, grantFilter, grantsInSandbox, lineItemFilter, rows]);
  const summaryTotals = useMemo(() => budgetSummaryRows.reduce(
    (acc, item) => ({
      budgetCents: acc.budgetCents + item.budgetCents,
      originalSpendCents: acc.originalSpendCents + item.originalSpendCents,
      sandboxSpendCents: acc.sandboxSpendCents + item.sandboxSpendCents,
      spendDeltaCents: acc.spendDeltaCents + item.spendDeltaCents,
      leftCents: acc.leftCents + item.sandboxRemainingCents,
    }),
    { budgetCents: 0, originalSpendCents: 0, sandboxSpendCents: 0, spendDeltaCents: 0, leftCents: 0 },
  ), [budgetSummaryRows]);

  const toggleSort = useCallback((key: SandboxSortKey) => {
    setSortStack((current) => {
      const existing = current.find((entry) => entry.key === key);
      const next: SortDirection = existing?.direction === "asc" ? "desc" : "asc";
      return [{ key, direction: next }, ...current.filter((entry) => entry.key !== key)].slice(0, 3);
    });
  }, []);

  const adjustScale = useCallback((direction: -1 | 1) => {
    setScale((current) => {
      const index = SCALE_ORDER.indexOf(current);
      const nextIndex = Math.min(SCALE_ORDER.length - 1, Math.max(0, index + direction));
      return SCALE_ORDER[nextIndex] || "compact";
    });
  }, []);

  const startEdit = useCallback((row: SandboxRow, field: EditableField) => {
    const value = field === "amountCents" ? amountInputFromCents(row.amountCents) : String(row[field] || "");
    setEditingCell({ rowId: row.sandboxId, field, value });
  }, []);

  const commitEdit = useCallback(() => {
    if (!editingCell) return;
    const field = editingCell.field;
    const value = editingCell.value;
    if (field === "amountCents") updateRow(editingCell.rowId, { amountCents: centsFromAmountInput(value) });
    else if (field === "date") updateRow(editingCell.rowId, { date: normalizeDate(value) });
    else updateRow(editingCell.rowId, { [field]: value } as Partial<Pick<SandboxRow, EditableField>>);
    setEditingCell(null);
  }, [editingCell, updateRow]);

  const cancelEdit = useCallback(() => setEditingCell(null), []);

  const onEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  };

  const primarySort = sortStack[0];
  const headerButton = (key: SandboxSortKey, label: string, className = "") => (
    <button type="button" className={`w-full text-left ${className}`} onClick={() => toggleSort(key)}>
      {label}
      {primarySort?.key === key ? (
        <span className="ml-1 text-slate-400">{primarySort.direction === "asc" ? "▲" : "▼"}</span>
      ) : null}
    </button>
  );

  const exportVisibleRows = useCallback(() => {
    if (!visibleRows.length) {
      toast("No Budget Manager rows to export.", { type: "warn" });
      return;
    }
    const exportRows: unknown[][] = [
      [
        "Grant",
        "Grant ID",
        "Line Item",
        "Line Item ID",
        "Date",
        "Amount",
        "Customer",
        "Customer ID",
        "Case Manager",
        "Case Manager ID",
        "Status",
        "Change",
        "Source",
        "Source ID",
        "Ledger Item ID",
        "Payment Queue Item ID",
        "Vendor",
        "Category",
        "Note",
      ],
      ...visibleRows.map((row) => {
        const lineItem = lineItemById.get(row.lineItemId);
        const source = row.sourceType === "paymentQueue"
          ? "Payment Queue"
          : row.sourceType === "newProjection"
            ? "New Projection"
            : row.sourceType === "ledger"
              ? "Ledger"
              : row.sourceKind;
        return [
          row.grantName || grantsInSandbox.find((grant) => grant.id === row.grantId)?.label || row.grantId,
          row.grantId,
          lineItem?.label || row.lineItemId,
          row.lineItemId,
          row.date,
          (row.amountCents / 100).toFixed(2),
          row.customerLabel,
          row.customerId || "",
          row.caseManagerLabel || "",
          row.caseManagerId || "",
          statusDisplayLabel(row),
          rowStateLabel(row.rowState),
          source,
          row.sourceId,
          row.ledgerItemId || "",
          row.paymentQueueItemId || "",
          row.vendor || "",
          row.category || row.budgetTypeLabel || "",
          row.noteText || "",
        ];
      }),
    ];
    const grantPart = grantFilter !== "all"
      ? grantsInSandbox.find((grant) => grant.id === grantFilter)?.label || grantFilter
      : managerMode && grantsInSandbox.length === 1
        ? grantsInSandbox[0]?.label || "grant"
        : managerMode
          ? `${grantsInSandbox.length || managerGrantIds.length}-grants`
          : grantName || grantId;
    downloadCsv(`budget-manager-${filenamePart(grantPart)}-${toISODate(new Date())}.csv`, exportRows);
    toast(`Exported ${visibleRows.length} Budget Manager row${visibleRows.length === 1 ? "" : "s"}.`, { type: "success" });
  }, [grantFilter, grantId, grantName, grantsInSandbox, lineItemById, managerGrantIds.length, managerMode, visibleRows]);

  const toManagerRows = useCallback((): TGrantBudgetManagerRow[] => rows
    .filter((row) => row.rowState !== "clean")
    .map((row) => ({
      rowId: row.sourceId || row.sandboxId,
      sourceType: row.sourceType || (row.rowState === "new" ? "newProjection" : "ledger"),
      sourceId: row.sourceId || "",
      ledgerItemId: row.ledgerItemId || (row.sourceType === "ledger" ? row.sourceId : null),
      paymentQueueItemId: row.paymentQueueItemId || (row.sourceType === "paymentQueue" ? row.sourceId : null),
      grantId: row.grantId || grantId,
      lineItemId: row.lineItemId || null,
      customerId: row.customerId || null,
      customerName: row.customerLabel || null,
      caseManagerId: row.caseManagerId || null,
      caseManagerName: row.caseManagerLabel || null,
      amount: row.amountCents / 100,
      date: row.date || null,
      serviceDate: row.date || null,
      paymentDate: row.sourceType === "ledger" ? row.date || null : null,
      description: row.noteText || null,
      memo: row.noteText || null,
      category: row.category || row.budgetTypeLabel || null,
      vendor: row.vendor || null,
      status: row.statusLabel || null,
      isWritable: row.isWritable !== false,
      lockedReason: row.lockedReason || null,
      rowState: row.rowState,
      // Always send the manager-row original shape (dollars + updatedAt), not
      // the sandbox seed shape — the server's stale-row check reads
      // original.updatedAt to detect concurrent edits.
      original: {
        grantId: row.original.grantId,
        lineItemId: row.original.lineItemId || null,
        customerId: row.original.customerId || null,
        caseManagerId: row.original.caseManagerId || null,
        amount: row.original.amountCents / 100,
        date: row.original.date || null,
        description: row.original.noteText || null,
        memo: row.original.noteText || null,
        category: row.original.budgetTypeLabel || null,
        vendor: row.original.vendor || null,
        status: row.original.statusLabel || null,
        updatedAt: row.original.original?.updatedAt || null,
      },
    })), [grantId, rows]);

  const saveChanges = useCallback(async () => {
    if (!managerMode || !canSave || readOnly) return;
    const payloadRows = toManagerRows();
    if (!payloadRows.length) {
      toast("No Budget Manager changes to save.", { type: "warn" });
      return;
    }
    try {
      const result = await saveManager.mutateAsync({
        mode: saveMode,
        grantIds: managerGrantIds,
        rows: payloadRows,
        loadedAt: managerQ.data?.ok ? managerQ.data.loadedAt : undefined,
        reason: "Budget Manager edit",
      });
      setSaveResult(result);
      if (result.ok) {
        const issues = (result.skipped?.length || 0) + (result.failed?.length || 0);
        toast(
          saveMode === "preview"
            ? `Preview complete${issues ? ` with ${issues} issue${issues === 1 ? "" : "s"}` : ""}.`
            : `Budget Manager save complete${issues ? ` with ${issues} issue${issues === 1 ? "" : "s"}` : ""}.`,
          { type: issues ? "warning" : "success" },
        );
      }
      if (saveMode !== "preview") {
        setRefreshingAfterSave(true);
        const refreshed = await managerQ.refetch();
        if (refreshed.data?.ok) {
          replaceScenario(seedFromManagerRows(refreshed.data.rows));
          setSelectedRowId(null);
        } else {
          resetScenario();
        }
      }
    } catch (error: unknown) {
      toast(toApiError(error, "Budget Manager save failed.").error, { type: "error" });
    } finally {
      setRefreshingAfterSave(false);
    }
  }, [canSave, managerGrantIds, managerMode, managerQ, readOnly, replaceScenario, resetScenario, saveManager, saveMode, toManagerRows]);

  const hasUnsavedChanges = pendingChangeCount > 0;
  const savingOrRefreshing = saveManager.isPending || refreshingAfterSave;
  const colSpan = managerMode ? 11 : 10;

  const renderEditableCell = (row: SandboxRow, field: EditableField, display: React.ReactNode, className = "") => {
    const active = editingCell?.rowId === row.sandboxId && editingCell.field === field;
    // Line items stay editable on payment-queue rows: the save endpoint
    // requires a grant/line-item pair, so unassigned queue rows must be
    // classifiable here (ledger reclassification stays in the ledger tools).
    const editable = !readOnly && row.isWritable !== false && (
      field === "date" ||
      field === "amountCents" ||
      field === "noteText" ||
      (field === "lineItemId" && row.sourceType === "paymentQueue") ||
      row.rowState === "new"
    );
    if (active) {
      if (field === "lineItemId") {
        return (
          <select
            className={`input min-w-36 ${scaleConfig.input}`}
            value={editingCell.value}
            onChange={(e) => {
              const value = e.currentTarget.value;
              const lineItem = lineItemById.get(value);
              setEditingCell((current) => current ? { ...current, value } : current);
              if (lineItem) updateRow(row.sandboxId, { budgetTypeLabel: lineItem.typeLabel });
            }}
            onBlur={commitEdit}
            onKeyDown={onEditKeyDown}
            autoFocus
          >
            <option value="">Unassigned</option>
            {activeLineItems.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        );
      }
      return (
        <input
          className={`input ${scaleConfig.input} ${field === "amountCents" ? "w-24 text-right" : "min-w-28"}`}
          type={field === "date" ? "date" : field === "amountCents" ? "number" : "text"}
          value={editingCell.value}
          onChange={(e) => {
            const value = e.currentTarget.value;
            setEditingCell((current) => current ? { ...current, value } : current);
          }}
          onBlur={commitEdit}
          onKeyDown={onEditKeyDown}
          autoFocus
        />
      );
    }
    return (
      <button
        type="button"
        className={`block w-full truncate text-left ${className} ${editable ? "cursor-text" : "cursor-default"}`}
        onDoubleClick={() => {
          if (editable) startEdit(row, field);
        }}
        title={editable ? "Double-click to edit" : undefined}
      >
        {display}
      </button>
    );
  };

  const renderCustomerCell = (row: SandboxRow) => {
    if (!row.customerId) {
      return renderEditableCell(row, "customerLabel", row.customerLabel || "-");
    }
    return (
      <button
        type="button"
        className="block w-full truncate text-left font-medium text-sky-700 hover:text-sky-900 hover:underline"
        title="Open customer"
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onOpenCustomer?.(String(row.customerId));
        }}
      >
        {row.customerLabel || row.customerId}
      </button>
    );
  };

  const titleGrantChips = (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {(managerMode ? grantsInSandbox : [{ id: grantId, label: grantName || grantId }]).slice(0, 4).map((grant) => (
        <button
          key={grant.id}
          type="button"
          className={`max-w-[180px] truncate rounded-full border px-2.5 py-1 text-xs font-medium ${grantFilter === grant.id ? "border-sky-300 bg-sky-50 text-sky-700" : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
          onClick={(e) => {
            e.stopPropagation();
            setGrantFilter((current) => current === grant.id ? "all" : grant.id);
          }}
          title={grant.label}
        >
          {grant.label}
        </button>
      ))}
      {managerMode && grantsInSandbox.length > 4 ? (
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
          +{grantsInSandbox.length - 4}
        </span>
      ) : null}
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onBeforeClose={() => {
        if (savingOrRefreshing) return true;
        if (!hasUnsavedChanges) return true;
        return window.confirm("Discard unsaved Budget Manager changes?");
      }}
      widthClass="max-w-[96vw]"
      title={(
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="shrink-0">{managerMode ? "Budget Manager" : "Budget Sandbox"}</span>
          {titleGrantChips}
          {managerMode && canSave && !readOnly ? (
            <select
              className="input h-8 w-auto min-w-[150px] text-xs"
              value={saveMode}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setSaveMode(e.currentTarget.value as typeof saveMode)}
            >
              <option value="preview">Preview Only</option>
              <option value="applyOpen">Apply Open Items</option>
              <option value="applyAll">Apply All Source Rows</option>
            </select>
          ) : null}
        </div>
      )}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{managerMode ? (readOnly ? "Read-only view." : "Save required to apply changes.") : "Local scratch only."} {pendingChangeCount} pending change{pendingChangeCount === 1 ? "" : "s"}.</span>
            {budgetPipelineRefs.length > 0 ? (
              <a
                href={pipelineHref}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-sky-700 hover:text-sky-900 hover:underline"
              >
                {budgetPipelineRefs.length === 1 ? "Open Budget Pipeline in New Tab" : "Open Budget Pipelines in New Tab"}
              </a>
            ) : null}
            <a
              href="/tools/spending"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-sky-700 hover:text-sky-900 hover:underline"
            >
              Open Invoicing Tool
            </a>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
              if (!savingOrRefreshing && hasUnsavedChanges && !window.confirm("Discard unsaved Budget Manager changes?")) return;
              onClose();
            }}>Close</button>
          </div>
        </div>
      }
    >
      <div className="space-y-3" data-grant-id={grantId}>
        {managerQ.isLoading && managerMode ? (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
            <LoadingSpinner className="h-4 w-4 text-slate-400" />
            <span>Loading Budget Manager rows...</span>
          </div>
        ) : null}
        {savingOrRefreshing ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
            <div className="flex items-center gap-2">
              <LoadingSpinner className="h-4 w-4 text-sky-600" />
              <span>{refreshingAfterSave ? "Refreshing saved Budget Manager rows..." : saveMode === "preview" ? "Building save preview..." : "Saving Budget Manager changes..."}</span>
            </div>
            <span className="text-xs font-medium text-sky-700">Safe to close this modal; saved rows will refresh when complete.</span>
          </div>
        ) : null}
        {managerQ.error && managerMode ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">Failed to load Budget Manager rows.</div>
        ) : null}
        {saveResult?.ok && ((saveResult.skipped?.length || 0) > 0 || (saveResult.failed?.length || 0) > 0) ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <div className="font-semibold">Save Results</div>
            <div className="mt-1 flex flex-wrap gap-3">
              <span>{saveResult.skipped.length} skipped</span>
              <span>{saveResult.failed.length} failed</span>
              <span>{saveResult.created} created</span>
              <span>{saveResult.updated} updated</span>
            </div>
            <div className="mt-2 max-h-24 overflow-auto">
              {[...saveResult.skipped.map((x) => `${x.sourceId || x.rowId}: ${x.reason}`), ...saveResult.failed.map((x) => `${x.sourceId || x.rowId}: ${x.error}`)].slice(0, 20).map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          </div>
        ) : null}
        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-500">
              {grantFilter === "all" ? "All opened grants" : grantsInSandbox.find((grant) => grant.id === grantFilter)?.label || grantFilter}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-secondary btn-sm" onClick={exportVisibleRows}>
                Export
              </button>
              {managerMode && canSave && !readOnly ? (
                <>
                  <button type="button" className="btn btn-primary btn-sm" disabled={savingOrRefreshing || !pendingChangeCount} onClick={() => void saveChanges()}>
                    {savingOrRefreshing ? "Working..." : saveMode === "preview" ? "Preview" : "Save"}
                  </button>
                </>
              ) : null}
              {!readOnly && <button type="button" className="btn btn-ghost btn-sm" onClick={resetScenario}>Undo All Changes</button>}
            </div>
          </div>
          <div className="grid gap-2 lg:grid-cols-[180px_minmax(180px,1fr)_auto_auto]">
            <select className="input h-9 text-sm" value={lineItemFilter} onChange={(e) => setLineItemFilter(e.currentTarget.value)}>
              <option value="all">All line items</option>
              {activeLineItems.map((item) => <option key={`${item.grantId || "grant"}:${item.id}`} value={item.id}>{item.label}</option>)}
            </select>
            <input
              className="input h-9 text-sm"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              placeholder="Search customer, case manager, line item, note..."
            />
            <button type="button" className="btn btn-secondary btn-sm h-9" onClick={() => setShowAdvancedFilters((value) => !value)}>
              Advanced Filters
            </button>
            <div className="flex h-9 items-center overflow-hidden rounded-md border border-slate-200 text-xs font-medium text-slate-600">
              <button type="button" className="h-full px-2.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300" onClick={() => adjustScale(-1)} disabled={scale === SCALE_ORDER[0]} title="Smaller rows">-</button>
              <div className="min-w-16 border-x border-slate-200 px-2 text-center">{scaleConfig.label}</div>
              <button type="button" className="h-full px-2.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300" onClick={() => adjustScale(1)} disabled={scale === SCALE_ORDER[SCALE_ORDER.length - 1]} title="Larger rows">+</button>
            </div>
          </div>
          {showAdvancedFilters ? (
            <div className="grid gap-2 border-t border-slate-100 pt-2 sm:grid-cols-2 lg:grid-cols-4">
              <select className="input h-9 text-sm" value={sourceFilter} onChange={(e) => setSourceFilter(e.currentTarget.value as typeof sourceFilter)}>
                {SOURCE_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <select className="input h-9 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.currentTarget.value as typeof statusFilter)}>
                {STATUS_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <label className="flex h-9 items-center gap-2 whitespace-nowrap rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-600">
                <input type="checkbox" className="h-3.5 w-3.5 accent-sky-600" checked={showDeleted} onChange={(e) => setShowDeleted(e.currentTarget.checked)} />
                Show removed rows
              </label>
              <label className="flex h-9 items-center gap-2 whitespace-nowrap rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-600">
                <input type="checkbox" className="h-3.5 w-3.5 accent-sky-600" checked={showReversals} onChange={(e) => setShowReversals(e.currentTarget.checked)} />
                Show reversals
              </label>
            </div>
          ) : null}
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {grantSummaryRows.map((row) => (
              <div key={row.id} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="mb-1 truncate text-xs font-semibold text-slate-700">{row.label}</div>
                <div className="grid grid-cols-5 gap-2 text-right text-[11px]">
                  <div><div className="text-slate-400">Budget</div><div className="font-semibold text-slate-800">{currency(row.budgetCents / 100)}</div></div>
                  <div><div className="text-slate-400">Original</div><div className="font-semibold text-slate-800">{currency(row.originalCents / 100)}</div></div>
                  <div><div className="text-slate-400">Preview</div><div className="font-semibold text-slate-800">{currency(row.sandboxCents / 100)}</div></div>
                  <div><div className="text-slate-400">Delta</div><div className={`font-semibold ${deltaClass(row.deltaCents)}`}>{currency(row.deltaCents / 100)}</div></div>
                  <div><div className="text-slate-400">Left</div><div className={`font-semibold ${deltaClass(row.leftCents)}`}>{currency(row.leftCents / 100)}</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="max-h-[68vh] overflow-auto rounded-lg border border-slate-200">
          <table className={`w-full table-fixed border-separate ${scaleConfig.table}`} style={{ borderSpacing: 0 }}>
            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
              <tr>
                {managerMode && <th className={`w-40 ${scaleConfig.header} font-medium`}>{headerButton("grant", "Grant")}</th>}
                <th className={`w-28 ${scaleConfig.header} font-medium`}>{headerButton("date", "Date")}</th>
                <th className={`w-28 ${scaleConfig.header} text-right font-medium`}>{headerButton("amount", "Amount", "text-right")}</th>
                <th className={`w-40 ${scaleConfig.header} font-medium`}>{headerButton("customer", "Customer")}</th>
                <th className={`w-44 ${scaleConfig.header} font-medium`}>{headerButton("caseManager", "Purchaser/Filler")}</th>
                <th className={`w-44 ${scaleConfig.header} font-medium`}>{headerButton("lineItem", "Line Item")}</th>
                <th className={`w-28 ${scaleConfig.header} font-medium`}>Rent Cert Due</th>
                <th className={`w-36 ${scaleConfig.header} font-medium`}>{headerButton("type", "Type")}</th>
                <th className={`w-56 ${scaleConfig.header} font-medium`}>{headerButton("note", "Note")}</th>
                <th className={`w-28 ${scaleConfig.header} font-medium`}>{headerButton("sourceStatus", "Source Status")}</th>
                <th className={`w-28 ${scaleConfig.header} font-medium`}>{headerButton("sandboxChange", "Sandbox Change")}</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const lineItem = lineItemById.get(row.lineItemId);
                const rowClass =
                  row.rowState === "deleted" ? "bg-red-50 text-red-500 line-through opacity-80"
                  : row.rowState === "changed" || row.rowState === "new" ? "bg-yellow-50 hover:bg-yellow-100/70"
                  : "hover:bg-slate-50";
                const selectedClass = selectedRowId === row.sandboxId ? "ring-2 ring-inset ring-sky-300 bg-sky-50" : "";
                return (
                  <tr
                    key={row.sandboxId}
                    data-sandbox-row-id={row.sandboxId}
                    className={`border-b border-slate-100 transition-colors ${rowClass} ${selectedClass}`}
                    onMouseDown={() => setSelectedRowId(row.sandboxId)}
                  >
                    {managerMode && <td className={`w-40 border-b border-slate-100 ${scaleConfig.cell}`}><span className="block truncate">{row.grantName || row.grantId}</span></td>}
                    <td className={`w-28 border-b border-slate-100 ${scaleConfig.cell}`}>{renderEditableCell(row, "date", row.date ? fmtMDY(row.date) : "-")}</td>
                    <td className={`w-28 border-b border-slate-100 text-right font-mono ${scaleConfig.cell}`}>{renderEditableCell(row, "amountCents", currency(row.amountCents / 100), "text-right font-mono")}</td>
                    <td className={`w-40 border-b border-slate-100 ${scaleConfig.cell}`}>{renderCustomerCell(row)}</td>
                    <td className={`w-44 border-b border-slate-100 ${scaleConfig.cell}`}>{renderEditableCell(row, "caseManagerLabel", row.caseManagerLabel || "-")}</td>
                    <td className={`w-44 border-b border-slate-100 ${scaleConfig.cell}`}>{renderEditableCell(row, "lineItemId", lineItem?.label || "Unassigned")}</td>
                    <td className={`w-28 border-b border-slate-100 text-slate-600 ${scaleConfig.cell}`}>
                      {row.enrollmentId && row.paymentId ? (
                        <button type="button" className="rounded px-1 text-left hover:bg-sky-50 hover:text-sky-700" disabled={pendingRentCertRowId === row.sandboxId} onClick={(event) => { event.stopPropagation(); void updateRentCert(row); }}>
                          {row.rentCertDueOn ? fmtMDY(row.rentCertDueOn) : "+ Add"}
                        </button>
                      ) : row.rentCertDueOn ? fmtMDY(row.rentCertDueOn) : "—"}
                    </td>
                    <td className={`w-36 border-b border-slate-100 ${scaleConfig.cell}`}>{renderEditableCell(row, "budgetTypeLabel", row.budgetTypeLabel || row.category || "-")}</td>
                    <td className={`w-56 border-b border-slate-100 ${scaleConfig.cell}`}>{renderEditableCell(row, "noteText", row.noteText || "-")}</td>
                    <td className={`w-28 border-b border-slate-100 ${scaleConfig.cell}`}>
                      <button
                        type="button"
                        className={`cursor-default rounded px-1.5 py-0.5 font-semibold uppercase ${scaleConfig.badge} ${sourceStatusClass(statusDisplayLabel(row))}`}
                        title="Payment state is changed through the payment workflow."
                        onClick={(e) => e.stopPropagation()}
                      >
                        {statusDisplayLabel(row)}
                      </button>
                    </td>
                    <td className={`w-28 border-b border-slate-100 ${scaleConfig.cell}`}>
                      <span className={`rounded px-1.5 py-0.5 font-semibold uppercase ${scaleConfig.badge} ${sandboxChangeClass(row.rowState)}`}>
                        {rowStateLabel(row.rowState)}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!managerQ.isLoading && visibleRows.length === 0 ? (
                <tr>
                  <td className="border-b border-slate-100 px-4 py-10 text-center text-sm text-slate-500" colSpan={colSpan}>
                    No Budget Manager rows found for the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {selectedRow ? (
          <div
            data-sandbox-actionbar
            className="fixed bottom-5 left-1/2 z-[1550] flex max-w-[94vw] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {selectedRow.customerId && onOpenCustomer ? (
              <button
                type="button"
                className="max-w-[260px] truncate font-semibold text-sky-700 hover:text-sky-900 hover:underline"
                onClick={() => onOpenCustomer(String(selectedRow.customerId))}
              >
                {selectedRow.customerLabel || selectedRow.customerId}
              </button>
            ) : (
              <div className="max-w-[260px] truncate font-semibold text-slate-800">{selectedRow.customerLabel || "Selected row"}</div>
            )}
            <div className="text-xs text-slate-400">{selectedRow.date ? fmtMDY(selectedRow.date) : "No date"}</div>
            {!readOnly && canSave && statusBucket(selectedRow) === "projected" ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={selectedRowBusy}
                title={selectedRow.enrollmentId && selectedRow.paymentId ? "Post through the linked enrollment payment" : "Standalone projections must first be linked to an enrollment payment"}
                onClick={() => void markSelectedPaid(selectedRow)}
              >
                {spendMutation.isPending ? "Posting..." : "Mark Paid"}
              </button>
            ) : null}
            {!readOnly && canSave && selectedRow.enrollmentId && selectedRow.paymentId ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={selectedRowBusy}
                onClick={() => void markSelectedDataEntryComplete(selectedRow)}
              >
                {complianceMutation.isPending ? "Updating..." : "Data Entry Complete"}
              </button>
            ) : null}
            {!readOnly ? (
              <div className="flex items-center gap-2 border-l border-slate-200 pl-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSelectedRowId(addRowBelow(selectedRow.sandboxId))}
                >
                  Add Row Below
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => duplicateRow(selectedRow.sandboxId)}>Duplicate</button>
                {selectedRow.rowState === "deleted" ? (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => restoreRow(selectedRow.sandboxId)}>Restore</button>
                ) : (
                  <button type="button" className="btn btn-ghost btn-sm text-red-600" onClick={() => removeRow(selectedRow.sandboxId)}>Remove</button>
                )}
              </div>
            ) : null}
            {selectedRow.sourceId && onOpenPayment ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onOpenPayment(selectedRow.sourceId)}>Open Payment</button>
            ) : null}
            {selectedRow.enrollmentId && selectedRow.paymentId ? (
              <button type="button" className="btn btn-secondary btn-sm" disabled={pendingRentCertRowId === selectedRow.sandboxId} onClick={() => void updateRentCert(selectedRow)}>
                {selectedRow.rentCertDueOn ? "Update Rent Cert" : "Add Rent Cert"}
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
            <div>
              <div className="text-xs font-semibold uppercase text-slate-500">Budget Summary</div>
              <div className="text-xs text-slate-500">
                {lineItemFilter === "all" ? "All line items" : lineItemById.get(lineItemFilter)?.label || "Selected line item"}
              </div>
            </div>
            {lineItemFilter === "all" && (
              <div className="grid min-w-[560px] grid-cols-5 gap-3 text-right text-xs">
                <div>
                  <div className="text-slate-400">Total Budget</div>
                  <div className="font-semibold text-slate-800">{currency(summaryTotals.budgetCents / 100)}</div>
                </div>
                <div>
                  <div className="text-slate-400">Original Spend</div>
                  <div className="font-semibold text-slate-800">{currency(summaryTotals.originalSpendCents / 100)}</div>
                </div>
                <div>
                  <div className="text-slate-400">Sandbox Spend</div>
                  <div className="font-semibold text-slate-800">{currency(summaryTotals.sandboxSpendCents / 100)}</div>
                </div>
                <div>
                  <div className="text-slate-400">Spend Delta</div>
                  <div className={`font-semibold ${deltaClass(summaryTotals.spendDeltaCents)}`}>{currency(summaryTotals.spendDeltaCents / 100)}</div>
                </div>
                <div>
                  <div className="text-slate-400">Left</div>
                  <div className={`font-semibold ${deltaClass(summaryTotals.leftCents)}`}>{currency(summaryTotals.leftCents / 100)}</div>
                </div>
              </div>
            )}
          </div>
          <div className="max-h-52 overflow-auto">
            <table className={`w-full border-separate ${scaleConfig.table}`} style={{ borderSpacing: 0 }}>
              <thead className="sticky top-0 bg-white text-slate-500">
                <tr>
                  <th className={`border-b border-slate-100 text-left font-medium ${scaleConfig.header}`}>Line Item</th>
                  <th className={`border-b border-slate-100 text-right font-medium ${scaleConfig.header}`}>Budget</th>
                  <th className={`border-b border-slate-100 text-right font-medium ${scaleConfig.header}`}>Original</th>
                  <th className={`border-b border-slate-100 text-right font-medium ${scaleConfig.header}`}>Preview</th>
                  <th className={`border-b border-slate-100 text-right font-medium ${scaleConfig.header}`}>Change</th>
                  <th className={`border-b border-slate-100 text-right font-medium ${scaleConfig.header}`}>Left</th>
                </tr>
              </thead>
              <tbody>
                {budgetSummaryRows.map((item) => {
                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className={`max-w-[220px] border-b border-slate-100 font-medium text-slate-800 ${scaleConfig.cell}`}>
                        <span className="block truncate" title={item.label}>{item.label}</span>
                        {item.grantLabel ? <span className="block truncate text-[10px] font-normal text-slate-400">{item.grantLabel}</span> : null}
                      </td>
                      <td className={`border-b border-slate-100 text-right font-mono ${scaleConfig.cell}`}>{currency(item.budgetCents / 100)}</td>
                      <td className={`border-b border-slate-100 text-right font-mono ${scaleConfig.cell}`}>{currency(item.originalSpendCents / 100)}</td>
                      <td className={`border-b border-slate-100 text-right font-mono ${scaleConfig.cell}`}>{currency(item.sandboxSpendCents / 100)}</td>
                      <td className={`border-b border-slate-100 text-right font-mono font-semibold ${scaleConfig.cell} ${deltaClass(item.spendDeltaCents)}`}>{currency(item.spendDeltaCents / 100)}</td>
                      <td className={`border-b border-slate-100 text-right font-mono font-semibold ${scaleConfig.cell} ${deltaClass(item.sandboxRemainingCents)}`}>{currency(item.sandboxRemainingCents / 100)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </Modal>
  );
}

export default GrantBudgetSandboxModal;
