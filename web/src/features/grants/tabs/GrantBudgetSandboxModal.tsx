"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "@entities/ui/Modal";
import { toApiError } from "@client/api";
import { fmtMDY, safeISODate10, toISODate } from "@lib/date";
import { toast } from "@lib/toast";
import { useGrantBudgetManagerLoad, useSaveGrantBudgetManager } from "@hooks/useGrantBudgetManager";
import type { TGrantBudgetManagerRow } from "@types";

type SortDirection = "asc" | "desc";
type SandboxScale = "tight" | "compact" | "regular" | "large";
type SandboxSortKey = "grant" | "date" | "amount" | "customer" | "caseManager" | "lineItem" | "sourceType" | "type" | "note" | "sourceStatus" | "sandboxChange";
type SandboxRowState = "clean" | "changed" | "new" | "deleted";
type EditableField = "date" | "amountCents" | "customerLabel" | "caseManagerLabel" | "lineItemId" | "budgetTypeLabel" | "noteText";

export type GrantBudgetSandboxSeedRow = {
  sourceId: string;
  sourceKind: string;
  sourceType?: "ledger" | "paymentQueue" | "newProjection";
  ledgerItemId?: string | null;
  paymentQueueItemId?: string | null;
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
  isWritable?: boolean;
  lockedReason?: string | null;
  original?: TGrantBudgetManagerRow["original"];
  rentCertDueOn?: string;
  statusLabel: string;
};

export type GrantBudgetSandboxLineItem = {
  id: string;
  label: string;
  typeLabel: string;
  budgetCents: number;
};

type SandboxRow = GrantBudgetSandboxSeedRow & {
  sandboxId: string;
  rowState: SandboxRowState;
  original: GrantBudgetSandboxSeedRow;
};

type BlankDraft = {
  date: string;
  amount: string;
  grantId: string;
  customerLabel: string;
  caseManagerLabel: string;
  lineItemId: string;
  budgetTypeLabel: string;
  noteText: string;
};

type ContextMenuState = {
  x: number;
  y: number;
  rowId: string;
};

const EMPTY_DRAFT: BlankDraft = {
  date: "",
  amount: "",
  grantId: "",
  customerLabel: "",
  caseManagerLabel: "",
  lineItemId: "",
  budgetTypeLabel: "",
  noteText: "",
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

function compareText(a: unknown, b: unknown) {
  return String(a || "").localeCompare(String(b || ""), undefined, { numeric: true, sensitivity: "base" });
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

function hasDraftValue(draft: BlankDraft) {
  return Boolean(
    draft.date ||
    draft.amount ||
    draft.grantId ||
    draft.customerLabel.trim() ||
    draft.caseManagerLabel.trim() ||
    draft.lineItemId ||
    draft.budgetTypeLabel.trim() ||
    draft.noteText.trim(),
  );
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
    row.noteText !== row.original.noteText
  );
}

function sumRowAmounts(rows: SandboxRow[] | GrantBudgetSandboxSeedRow[], lineItemId?: string) {
  return rows.reduce((sum, row) => {
    if (lineItemId && row.lineItemId !== lineItemId) return sum;
    if ("rowState" in row && row.rowState === "deleted") return sum;
    return sum + row.amountCents;
  }, 0);
}

function rowStateLabel(state: SandboxRowState) {
  return state === "clean" ? "Clean" : state === "changed" ? "Edited" : state === "new" ? "Added" : "Removed";
}

function deltaClass(value: number) {
  return value >= 0 ? "text-emerald-600" : "text-red-600";
}

function sourceStatusClass(label: string) {
  const normalized = normalizeText(label);
  if (normalized.includes("reversal")) return "bg-red-100 text-red-700";
  if (normalized.includes("project")) return "bg-blue-100 text-blue-700";
  if (normalized.includes("paid")) return "bg-emerald-100 text-emerald-700";
  if (normalized.includes("new")) return "bg-yellow-100 text-yellow-800";
  return "bg-slate-100 text-slate-600";
}

function sandboxChangeClass(state: SandboxRowState) {
  if (state === "deleted") return "bg-red-100 text-red-700";
  if (state === "changed") return "bg-yellow-200 text-yellow-900";
  if (state === "new") return "bg-amber-200 text-amber-900";
  return "bg-slate-100 text-slate-600";
}

function useLocalSandboxScenario(seed: GrantBudgetSandboxSeedRow[], lineItems: GrantBudgetSandboxLineItem[]) {
  const loadScenario = useCallback(() => seedRows(seed), [seed]);
  const [rows, setRows] = useState<SandboxRow[]>(() => loadScenario());

  useEffect(() => {
    setRows(loadScenario());
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

  const addBlankRow = useCallback((draft: Partial<BlankDraft> = {}) => {
    const lineItemId = String(draft.lineItemId || "").trim();
    const lineItem = lineItemById.get(lineItemId);
    const date = normalizeDate(String(draft.date || "")) || toISODate(new Date());
    const amountCents = centsFromAmountInput(String(draft.amount || "0"));
    const now = Date.now().toString(36);
    const row: SandboxRow = {
      sandboxId: `new:${now}:${Math.random().toString(36).slice(2, 7)}`,
      sourceId: "",
      sourceKind: "sandbox",
      sourceType: "newProjection",
      grantId: String(draft.grantId || "").trim(),
      lineItemId,
      date,
      amountCents,
      customerLabel: String(draft.customerLabel || "").trim(),
      caseManagerLabel: String(draft.caseManagerLabel || "").trim(),
      budgetTypeLabel: String(draft.budgetTypeLabel || lineItem?.typeLabel || "").trim() || "N/A",
      noteText: String(draft.noteText || "").trim(),
      rentCertDueOn: "",
      statusLabel: "New",
      rowState: "new",
      original: {
        sourceId: "",
        sourceKind: "sandbox",
        sourceType: "newProjection",
        grantId: String(draft.grantId || "").trim(),
        lineItemId,
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
    setRows((current) => [...current, row]);
  }, [lineItemById]);

  const duplicateRow = useCallback((sandboxId: string) => {
    setRows((current) => {
      const source = current.find((row) => row.sandboxId === sandboxId);
      if (!source) return current;
      const duplicate: SandboxRow = {
        ...source,
        sandboxId: `dup:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 7)}`,
        sourceId: source.sourceId,
        sourceKind: source.sourceKind,
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
    setRows((current) => {
      const sourceIndex = current.findIndex((row) => row.sandboxId === sandboxId);
      const source = sourceIndex >= 0 ? current[sourceIndex] : null;
      const lineItem = source ? lineItemById.get(source.lineItemId) : null;
      const date = source?.date || toISODate(new Date());
      const row: SandboxRow = {
        sandboxId: `new:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 7)}`,
        sourceId: "",
        sourceKind: "sandbox",
        sourceType: "newProjection",
        grantId: source?.grantId || "",
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
  }, [lineItemById]);

  const removeRow = useCallback((sandboxId: string) => {
    setRows((current) => current.flatMap((row) => {
      if (row.sandboxId !== sandboxId) return [row];
      if (row.rowState === "new") return [];
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

  return { rows, updateRow, duplicateRow, addBlankRow, addRowBelow, removeRow, restoreRow, resetScenario };
}

function SandboxContextMenu({
  menu,
  row,
  showDeleted,
  onDuplicate,
  onOpenPayment,
  onAddRowBelow,
  onRemove,
  onRestore,
  onClose,
}: {
  menu: ContextMenuState;
  row: SandboxRow | null;
  showDeleted: boolean;
  onDuplicate: (rowId: string) => void;
  onOpenPayment?: (row: SandboxRow) => void;
  onAddRowBelow: (rowId: string) => void;
  onRemove: (rowId: string) => void;
  onRestore: (rowId: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onDoc = () => onClose();
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [onClose]);

  if (!row) return null;
  const buttonClass = "block w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-sky-50 hover:text-sky-700";

  const runAction = (action: () => void) => (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    action();
    onClose();
  };

  return (
    <div
      className="fixed z-[1600] min-w-[180px] rounded-md border border-slate-200 bg-white py-1 shadow-xl"
      style={{ top: menu.y, left: menu.x }}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <button type="button" className={buttonClass} onMouseDown={runAction(() => onDuplicate(row.sandboxId))}>
        Duplicate Row
      </button>
      {row.sourceId && onOpenPayment ? (
        <button type="button" className={buttonClass} onMouseDown={runAction(() => onOpenPayment(row))}>
          Open Payment
        </button>
      ) : null}
      <button type="button" className={buttonClass} onMouseDown={runAction(() => onAddRowBelow(row.sandboxId))}>
        Add Row Below
      </button>
      {row.rowState === "deleted" && showDeleted ? (
        <button type="button" className={buttonClass} onMouseDown={runAction(() => onRestore(row.sandboxId))}>
          Restore Row
        </button>
      ) : (
        <button type="button" className={`${buttonClass} text-red-600 hover:text-red-700`} onMouseDown={runAction(() => onRemove(row.sandboxId))}>
          Remove Row
        </button>
      )}
    </div>
  );
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
}) {
  const managerGrantIds = useMemo(
    () => Array.from(new Set((grantIds || []).map((id) => String(id || "").trim()).filter(Boolean))),
    [grantIds],
  );
  const managerMode = managerGrantIds.length > 0;
  const managerQ = useGrantBudgetManagerLoad(managerGrantIds, { enabled: isOpen && managerMode });
  const saveManager = useSaveGrantBudgetManager();
  const loadedRows = managerQ.data?.ok ? managerQ.data.rows : [];
  const activeSeed = useMemo<GrantBudgetSandboxSeedRow[]>(() => {
    if (!managerMode) return seed;
    return loadedRows.map((row) => ({
      sourceId: row.sourceId || row.ledgerItemId || row.paymentQueueItemId || row.rowId,
      sourceKind: row.sourceType,
      sourceType: row.sourceType,
      ledgerItemId: row.ledgerItemId || null,
      paymentQueueItemId: row.paymentQueueItemId || null,
      grantId: row.grantId,
      grantName: String((row as Record<string, unknown>).grantName || row.grantId),
      lineItemId: String(row.lineItemId || ""),
      date: String(row.date || row.serviceDate || row.paymentDate || ""),
      amountCents: Math.round(Number(row.amount || 0) * 100),
      customerId: row.customerId || null,
      customerLabel: String(row.customerName || row.customerId || ""),
      caseManagerId: row.caseManagerId || null,
      caseManagerLabel: String(row.caseManagerName || row.caseManagerId || ""),
      budgetTypeLabel: String(row.category || ""),
      noteText: String(row.description || row.memo || ""),
      vendor: row.vendor || null,
      category: row.category || null,
      isWritable: row.isWritable !== false,
      lockedReason: row.lockedReason || null,
      original: row.original,
      statusLabel: String(row.status || row.sourceType),
    }));
  }, [loadedRows, managerMode, seed]);
  const activeLineItems = useMemo<GrantBudgetSandboxLineItem[]>(() => {
    if (!managerMode) return lineItems;
    return (managerQ.data?.ok ? managerQ.data.lineItems : []).map((item) => ({
      id: item.id,
      label: `${managerGrantIds.length > 1 ? `${item.grantId} - ` : ""}${item.label}`,
      typeLabel: item.typeLabel || "",
      budgetCents: Math.round(Number(item.budget || 0) * 100),
    }));
  }, [lineItems, managerGrantIds.length, managerMode, managerQ.data]);
  const { rows, updateRow, duplicateRow, addBlankRow, addRowBelow, removeRow, restoreRow, resetScenario } = useLocalSandboxScenario(activeSeed, activeLineItems);
  const [lineItemFilter, setLineItemFilter] = useState("all");
  const [grantFilter, setGrantFilter] = useState("all");
  const [search, setSearch] = useState("");
  const deferredSearch = React.useDeferredValue(search);
  const [showDeleted, setShowDeleted] = useState(false);
  const [sort, setSort] = useState<{ key: SandboxSortKey; direction: SortDirection }>({ key: "date", direction: "desc" });
  const [scale, setScale] = useState<SandboxScale>("compact");
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: EditableField; value: string } | null>(null);
  const [blankDraft, setBlankDraft] = useState<BlankDraft>(EMPTY_DRAFT);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [saveMode, setSaveMode] = useState<"preview" | "applyOpen" | "applyAll">("preview");
  const [saveResult, setSaveResult] = useState<Awaited<ReturnType<typeof saveManager.mutateAsync>> | null>(null);
  const blankRowRef = React.useRef<HTMLTableRowElement | null>(null);
  const blankFirstInputRef = React.useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLineItemFilter("all");
    setSearch("");
    setShowDeleted(false);
    setSort({ key: "date", direction: "desc" });
    setGrantFilter("all");
    setScale("compact");
    setEditingCell(null);
    setBlankDraft(EMPTY_DRAFT);
    setContextMenu(null);
    setSaveMode("preview");
    setSaveResult(null);
    resetScenario();
  }, [isOpen, resetScenario]);

  const lineItemById = useMemo(() => new Map(activeLineItems.map((item) => [item.id, item])), [activeLineItems]);
  const grantsInSandbox = useMemo(() => {
    const fromRows = activeSeed.map((row) => ({ id: row.grantId, label: row.grantName || row.grantId })).filter((row) => row.id);
    const byId = new Map(fromRows.map((row) => [row.id, row]));
    return Array.from(byId.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [activeSeed]);
  const contextRow = useMemo(() => rows.find((row) => row.sandboxId === contextMenu?.rowId) ?? null, [contextMenu?.rowId, rows]);

  const originalTotalCents = useMemo(
    () => activeSeed.reduce((sum, row) => sum + row.amountCents, 0),
    [activeSeed],
  );

  const visibleRows = useMemo(() => {
    const normalizedSearch = normalizeText(deferredSearch);
    return rows
      .filter((row) => {
        if (!showDeleted && row.rowState === "deleted") return false;
        if (grantFilter !== "all" && row.grantId !== grantFilter) return false;
        if (lineItemFilter !== "all" && row.lineItemId !== lineItemFilter) return false;
        if (!normalizedSearch) return true;
        const lineItemLabel = lineItemById.get(row.lineItemId)?.label || "";
        return normalizeText(rowSearchText(row, lineItemLabel)).includes(normalizedSearch);
      })
      .sort((a, b) => {
        const aLine = lineItemById.get(a.lineItemId)?.label || a.lineItemId;
        const bLine = lineItemById.get(b.lineItemId)?.label || b.lineItemId;
        const result =
          sort.key === "date" ? compareText(a.date, b.date)
          : sort.key === "amount" ? a.amountCents - b.amountCents
          : sort.key === "grant" ? compareText(a.grantName || a.grantId, b.grantName || b.grantId)
          : sort.key === "customer" ? compareText(a.customerLabel, b.customerLabel)
          : sort.key === "caseManager" ? compareText(a.caseManagerLabel, b.caseManagerLabel)
          : sort.key === "lineItem" ? compareText(aLine, bLine)
          : sort.key === "sourceType" ? compareText(a.sourceType || a.sourceKind, b.sourceType || b.sourceKind)
          : sort.key === "type" ? compareText(a.budgetTypeLabel, b.budgetTypeLabel)
          : sort.key === "note" ? compareText(a.noteText, b.noteText)
          : sort.key === "sourceStatus" ? compareText(a.statusLabel, b.statusLabel)
          : compareText(a.rowState, b.rowState);
        return applyDirection(result, sort.direction);
      });
  }, [deferredSearch, grantFilter, lineItemById, lineItemFilter, rows, showDeleted, sort.direction, sort.key]);

  const draftAmountCents = hasDraftValue(blankDraft) ? centsFromAmountInput(blankDraft.amount || "0") : 0;
  const draftLineItemId = String(blankDraft.lineItemId || "").trim();
  const sandboxTotalCents = useMemo(
    () => sumRowAmounts(rows) + draftAmountCents,
    [draftAmountCents, rows],
  );
  const deltaCents = sandboxTotalCents - originalTotalCents;
  const pendingChangeCount = rows.filter((row) => row.rowState !== "clean").length;
  const scaleConfig = SCALE_CONFIG[scale];
  const totalBudgetCents = useMemo(
    () => activeLineItems.reduce((sum, item) => sum + item.budgetCents, 0),
    [activeLineItems],
  );
  const budgetSummaryRows = useMemo(() => {
    return activeLineItems
      .filter((item) => lineItemFilter === "all" || item.id === lineItemFilter)
      .map((item) => {
        const originalSpendCents = sumRowAmounts(activeSeed, item.id);
        const sandboxSpendCents = sumRowAmounts(rows, item.id) + (draftLineItemId === item.id ? draftAmountCents : 0);
        return {
          id: item.id,
          label: item.label,
          typeLabel: item.typeLabel,
          budgetCents: item.budgetCents,
          originalSpendCents,
          sandboxSpendCents,
          spendDeltaCents: sandboxSpendCents - originalSpendCents,
          sandboxRemainingCents: item.budgetCents - sandboxSpendCents,
        };
      });
  }, [activeLineItems, activeSeed, draftAmountCents, draftLineItemId, lineItemFilter, rows]);

  const toggleSort = useCallback((key: SandboxSortKey) => {
    setSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
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

  const updateBlankDraft = (patch: Partial<BlankDraft>) => {
    setBlankDraft((current) => {
      const next = { ...current, ...patch };
      if (patch.lineItemId) {
        const lineItem = lineItemById.get(patch.lineItemId);
        if (lineItem && !next.budgetTypeLabel) next.budgetTypeLabel = lineItem.typeLabel;
      }
      return next;
    });
  };

  const commitBlankDraft = () => {
    if (!hasDraftValue(blankDraft)) return;
    if (managerMode && !blankDraft.grantId) {
      toast("Choose a grant before adding a new projection.", { type: "error" });
      return;
    }
    addBlankRow(blankDraft);
    setBlankDraft(EMPTY_DRAFT);
  };

  const handleBlankBlur = () => {
    window.setTimeout(() => {
      if (!blankRowRef.current?.contains(document.activeElement)) commitBlankDraft();
    }, 0);
  };

  const handleBlankKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitBlankDraft();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setBlankDraft(EMPTY_DRAFT);
    }
  };

  const openRowContextMenu = useCallback((e: React.MouseEvent, rowId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, rowId });
  }, []);

  const headerButton = (key: SandboxSortKey, label: string, className = "") => (
    <button type="button" className={`w-full text-left ${className}`} onClick={() => toggleSort(key)}>
      {label}
    </button>
  );

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
      original: row.original || {
        grantId: row.original.grantId,
        lineItemId: row.original.lineItemId,
        customerId: row.original.customerId || null,
        caseManagerId: row.original.caseManagerId || null,
        amount: row.original.amountCents / 100,
        date: row.original.date,
        description: row.original.noteText,
        category: row.original.budgetTypeLabel,
        vendor: row.original.vendor || null,
        status: row.original.statusLabel,
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
        resetScenario();
        void managerQ.refetch();
      }
    } catch (error: unknown) {
      toast(toApiError(error, "Budget Manager save failed.").error, { type: "error" });
    }
  }, [canSave, managerGrantIds, managerMode, managerQ, readOnly, resetScenario, saveManager, saveMode, toManagerRows]);

  const hasUnsavedChanges = pendingChangeCount > 0 || hasDraftValue(blankDraft);

  const renderEditableCell = (row: SandboxRow, field: EditableField, display: React.ReactNode, className = "") => {
    const active = editingCell?.rowId === row.sandboxId && editingCell.field === field;
    const editable = !readOnly && row.isWritable !== false && (field === "date" || field === "amountCents" || field === "noteText" || row.rowState === "new");
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onBeforeClose={() => {
        if (!hasUnsavedChanges) return true;
        return window.confirm("Discard unsaved Budget Manager changes?");
      }}
      widthClass="max-w-[96vw]"
      title={<span>{managerMode ? "Budget Manager" : "Budget Sandbox"}{grantName && !managerMode ? ` - ${grantName}` : managerMode ? ` - ${managerGrantIds.length} grant${managerGrantIds.length === 1 ? "" : "s"}` : ""}</span>}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {managerMode ? (readOnly ? "Read-only view." : "Save required to apply changes.") : "Local scratch only."} {pendingChangeCount} pending change{pendingChangeCount === 1 ? "" : "s"}.
          </div>
          <div className="flex items-center gap-2">
            {managerMode && canSave && !readOnly ? (
              <>
                <select className="input h-8 text-xs" value={saveMode} onChange={(e) => setSaveMode(e.currentTarget.value as typeof saveMode)}>
                  <option value="preview">Preview Only</option>
                  <option value="applyOpen">Apply Open Items</option>
                  <option value="applyAll">Apply All Source Rows</option>
                </select>
                <button type="button" className="btn btn-primary btn-sm" disabled={saveManager.isPending || !pendingChangeCount} onClick={() => void saveChanges()}>
                  {saveManager.isPending ? "Saving..." : saveMode === "preview" ? "Preview" : "Save"}
                </button>
              </>
            ) : null}
            {!readOnly && <button type="button" className="btn btn-ghost btn-sm" onClick={resetScenario}>Undo All Changes</button>}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
              if (hasUnsavedChanges && !window.confirm("Discard unsaved Budget Manager changes?")) return;
              onClose();
            }}>Close</button>
          </div>
        </div>
      }
    >
      <div className="space-y-3" data-grant-id={grantId}>
        {managerQ.isLoading && managerMode ? (
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">Loading Budget Manager rows...</div>
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
        <div className="grid gap-2 lg:grid-cols-[180px_180px_minmax(180px,1fr)_auto_auto_auto]">
          {managerMode && grantsInSandbox.length > 1 ? (
            <select className="input h-9 text-sm" value={grantFilter} onChange={(e) => setGrantFilter(e.currentTarget.value)}>
              <option value="all">All grants</option>
              {grantsInSandbox.map((grant) => <option key={grant.id} value={grant.id}>{grant.label}</option>)}
            </select>
          ) : (
            <div />
          )}
          <select className="input h-9 text-sm" value={lineItemFilter} onChange={(e) => setLineItemFilter(e.currentTarget.value)}>
            <option value="all">All line items</option>
            {activeLineItems.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <input
            className="input h-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            placeholder="Search customer, type, note..."
          />
          <label className="flex h-9 items-center gap-2 whitespace-nowrap rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-600">
            <input type="checkbox" className="h-3.5 w-3.5 accent-sky-600" checked={showDeleted} onChange={(e) => setShowDeleted(e.currentTarget.checked)} />
            Show Removed Rows
          </label>
          <div className="flex h-9 items-center overflow-hidden rounded-md border border-slate-200 text-xs font-medium text-slate-600">
            <button
              type="button"
              className="h-full px-2.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
              onClick={() => adjustScale(-1)}
              disabled={scale === SCALE_ORDER[0]}
              title="Smaller rows"
            >
              -
            </button>
            <div className="min-w-16 border-x border-slate-200 px-2 text-center">{scaleConfig.label}</div>
            <button
              type="button"
              className="h-full px-2.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
              onClick={() => adjustScale(1)}
              disabled={scale === SCALE_ORDER[SCALE_ORDER.length - 1]}
              title="Larger rows"
            >
              +
            </button>
          </div>
          <div className="grid min-w-[360px] grid-cols-3 overflow-hidden rounded-md border border-slate-200 text-xs">
            <div className="px-3 py-1.5">
              <div className="text-slate-400">Original</div>
              <div className="font-semibold text-slate-800">{currency(originalTotalCents / 100)}</div>
            </div>
            <div className="border-l border-slate-200 px-3 py-1.5">
              <div className="text-slate-400">Sandbox</div>
              <div className="font-semibold text-slate-800">{currency(sandboxTotalCents / 100)}</div>
            </div>
            <div className="border-l border-slate-200 px-3 py-1.5">
              <div className="text-slate-400">Delta</div>
              <div className={`font-semibold ${deltaClass(deltaCents)}`}>{currency(deltaCents / 100)}</div>
            </div>
          </div>
        </div>

        <div className="max-h-[68vh] overflow-auto rounded-lg border border-slate-200">
          <table className={`w-full border-separate ${scaleConfig.table}`} style={{ borderSpacing: 0 }}>
            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
              <tr>
                {managerMode && <th className={`${scaleConfig.header} font-medium`}>{headerButton("grant", "Grant")}</th>}
                <th className={`${scaleConfig.header} font-medium`}>{headerButton("sourceType", "Source")}</th>
                <th className={`${scaleConfig.header} font-medium`}>{headerButton("date", "Date")}</th>
                <th className={`${scaleConfig.header} text-right font-medium`}>{headerButton("amount", "Amount", "text-right")}</th>
                <th className={`${scaleConfig.header} font-medium`}>{headerButton("customer", "Customer")}</th>
                <th className={`${scaleConfig.header} font-medium`}>{headerButton("caseManager", "Case Manager")}</th>
                <th className={`${scaleConfig.header} font-medium`}>{headerButton("lineItem", "Line Item")}</th>
                <th className={`${scaleConfig.header} font-medium`}>Rent Cert Due</th>
                <th className={`${scaleConfig.header} font-medium`}>{headerButton("note", "Note")}</th>
                <th className={`${scaleConfig.header} font-medium`}>{headerButton("sourceStatus", "Source Status")}</th>
                <th className={`${scaleConfig.header} font-medium`}>{headerButton("sandboxChange", "Sandbox Change")}</th>
              </tr>
            </thead>
            <tbody
              onContextMenu={(e) => {
                const target = e.target as HTMLElement | null;
                const rowEl = target?.closest("[data-sandbox-row-id]") as HTMLElement | null;
                if (!rowEl) return;
                openRowContextMenu(e, rowEl.dataset.sandboxRowId || "");
              }}
            >
              {visibleRows.map((row) => {
                const lineItem = lineItemById.get(row.lineItemId);
                const rowClass =
                  row.rowState === "deleted" ? "bg-red-50 text-red-500 line-through opacity-80"
                  : row.rowState === "changed" || row.rowState === "new" ? "bg-yellow-50 hover:bg-yellow-100/70"
                  : "hover:bg-slate-50";
                return (
                  <tr
                    key={row.sandboxId}
                    data-sandbox-row-id={row.sandboxId}
                    className={`border-b border-slate-100 transition-colors ${rowClass}`}
                  >
                    {managerMode && <td className={`max-w-[180px] border-b border-slate-100 ${scaleConfig.cell}`}><span className="block truncate">{row.grantName || row.grantId}</span></td>}
                    <td className={`w-28 border-b border-slate-100 ${scaleConfig.cell}`}>
                      <span className={`rounded px-1.5 py-0.5 font-semibold uppercase ${scaleConfig.badge} ${sourceStatusClass(row.sourceType || row.sourceKind)}`}>
                        {row.sourceType === "paymentQueue" ? "Payment Queue" : row.sourceType === "newProjection" ? "New Projection" : row.sourceType || row.sourceKind}
                      </span>
                    </td>
                    <td className={`w-28 border-b border-slate-100 ${scaleConfig.cell}`}>{renderEditableCell(row, "date", row.date ? fmtMDY(row.date) : "-")}</td>
                    <td className={`w-28 border-b border-slate-100 text-right font-mono ${scaleConfig.cell}`}>{renderEditableCell(row, "amountCents", currency(row.amountCents / 100), "text-right font-mono")}</td>
                    <td className={`max-w-[180px] border-b border-slate-100 ${scaleConfig.cell}`}>{renderEditableCell(row, "customerLabel", row.customerLabel || "-")}</td>
                    <td className={`max-w-[180px] border-b border-slate-100 ${scaleConfig.cell}`}>{renderEditableCell(row, "caseManagerLabel", row.caseManagerLabel || "-")}</td>
                    <td className={`max-w-[190px] border-b border-slate-100 ${scaleConfig.cell}`}>{renderEditableCell(row, "lineItemId", lineItem?.label || "Unassigned")}</td>
                    <td className={`w-28 border-b border-slate-100 text-slate-600 ${scaleConfig.cell}`}>{row.rentCertDueOn ? fmtMDY(row.rentCertDueOn) : "—"}</td>
                    <td className={`max-w-[260px] border-b border-slate-100 ${scaleConfig.cell}`}>{renderEditableCell(row, "noteText", row.noteText || "-")}</td>
                    <td className={`w-28 border-b border-slate-100 ${scaleConfig.cell}`}>
                      <span className={`rounded px-1.5 py-0.5 font-semibold uppercase ${scaleConfig.badge} ${sourceStatusClass(row.statusLabel)}`}>
                        {row.statusLabel}
                      </span>
                    </td>
                    <td className={`w-28 border-b border-slate-100 ${scaleConfig.cell}`}>
                      <span className={`rounded px-1.5 py-0.5 font-semibold uppercase ${scaleConfig.badge} ${sandboxChangeClass(row.rowState)}`}>
                        {rowStateLabel(row.rowState)}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!readOnly && (
              <tr className="bg-white" ref={blankRowRef}>
                {managerMode && <td className={scaleConfig.cell}>
                  <select className={`input min-w-36 ${scaleConfig.input}`} value={blankDraft.grantId} onChange={(e) => updateBlankDraft({ grantId: e.currentTarget.value })} onBlur={handleBlankBlur} onKeyDown={handleBlankKeyDown}>
                    <option value="">Grant</option>
                    {grantsInSandbox.map((grant) => <option key={grant.id} value={grant.id}>{grant.label}</option>)}
                  </select>
                </td>}
                <td className={`${scaleConfig.cell} font-semibold uppercase text-slate-400 ${scaleConfig.badge}`}>New Projection</td>
                <td className={scaleConfig.cell}><input ref={blankFirstInputRef} className={`input w-28 ${scaleConfig.input}`} type="date" value={blankDraft.date} onChange={(e) => updateBlankDraft({ date: e.currentTarget.value })} onBlur={handleBlankBlur} onKeyDown={handleBlankKeyDown} /></td>
                <td className={scaleConfig.cell}><input className={`input w-24 text-right ${scaleConfig.input}`} type="number" placeholder="0.00" value={blankDraft.amount} onChange={(e) => updateBlankDraft({ amount: e.currentTarget.value })} onBlur={handleBlankBlur} onKeyDown={handleBlankKeyDown} /></td>
                <td className={scaleConfig.cell}><input className={`input min-w-36 ${scaleConfig.input}`} placeholder="Customer" value={blankDraft.customerLabel} onChange={(e) => updateBlankDraft({ customerLabel: e.currentTarget.value })} onBlur={handleBlankBlur} onKeyDown={handleBlankKeyDown} /></td>
                <td className={scaleConfig.cell}><input className={`input min-w-36 ${scaleConfig.input}`} placeholder="Case manager" value={blankDraft.caseManagerLabel} onChange={(e) => updateBlankDraft({ caseManagerLabel: e.currentTarget.value })} onBlur={handleBlankBlur} onKeyDown={handleBlankKeyDown} /></td>
                <td className={scaleConfig.cell}>
                  <select className={`input min-w-36 ${scaleConfig.input}`} value={blankDraft.lineItemId} onChange={(e) => updateBlankDraft({ lineItemId: e.currentTarget.value })} onBlur={handleBlankBlur} onKeyDown={handleBlankKeyDown}>
                    <option value="">Unassigned</option>
                    {activeLineItems.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </td>
                <td className={`${scaleConfig.cell} text-slate-400`}>—</td>
                <td className={scaleConfig.cell}><input className={`input min-w-44 ${scaleConfig.input}`} placeholder="Note" value={blankDraft.noteText} onChange={(e) => updateBlankDraft({ noteText: e.currentTarget.value })} onBlur={handleBlankBlur} onKeyDown={handleBlankKeyDown} /></td>
                <td className={`${scaleConfig.cell} font-semibold uppercase text-slate-400 ${scaleConfig.badge}`}>Draft</td>
                <td className={`${scaleConfig.cell} font-semibold uppercase text-slate-400 ${scaleConfig.badge}`}>Blank</td>
              </tr>
              )}
            </tbody>
          </table>
        </div>

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
                  <div className="font-semibold text-slate-800">{currency(totalBudgetCents / 100)}</div>
                </div>
                <div>
                  <div className="text-slate-400">Original Spend</div>
                  <div className="font-semibold text-slate-800">{currency(originalTotalCents / 100)}</div>
                </div>
                <div>
                  <div className="text-slate-400">Sandbox Spend</div>
                  <div className="font-semibold text-slate-800">{currency(sandboxTotalCents / 100)}</div>
                </div>
                <div>
                  <div className="text-slate-400">Spend Delta</div>
                  <div className={`font-semibold ${deltaClass(deltaCents)}`}>{currency(deltaCents / 100)}</div>
                </div>
                <div>
                  <div className="text-slate-400">Left Delta</div>
                  <div className={`font-semibold ${deltaClass(-deltaCents)}`}>{currency(-deltaCents / 100)}</div>
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

      {contextMenu && !readOnly && (
        <SandboxContextMenu
          menu={contextMenu}
          row={contextRow}
          showDeleted={showDeleted}
          onDuplicate={duplicateRow}
          onOpenPayment={onOpenPayment ? (row) => onOpenPayment(row.sourceId) : undefined}
          onAddRowBelow={addRowBelow}
          onRemove={removeRow}
          onRestore={restoreRow}
          onClose={() => setContextMenu(null)}
        />
      )}
    </Modal>
  );
}

export default GrantBudgetSandboxModal;
