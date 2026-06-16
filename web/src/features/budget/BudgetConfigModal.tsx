// web/src/features/budget/BudgetConfigModal.tsx
// Visual drag-and-drop budget group config editor.
"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@entities/ui/Modal";
import { useOrgConfig, useSaveOrgConfig } from "@hooks/useOrgConfig";
import type { BudgetGroupCfg, BudgetGroupItem, OrgDisplayConfig } from "@hooks/useOrgConfig";
import type { TGrant as Grant } from "@types";
import { GRANT_ACCENT_COLORS, GRANT_ACCENT_REGISTRY, grantAccentSolid, grantAccentRing } from "@lib/colorRegistry";
import { getGrantFinancialCapabilities } from "@hdb/contracts";

// ─── ColorPicker ─────────────────────────────────────────────────────────────

function colorDef(key?: string) {
  return key && key in GRANT_ACCENT_REGISTRY ? GRANT_ACCENT_REGISTRY[key as keyof typeof GRANT_ACCENT_REGISTRY] : GRANT_ACCENT_REGISTRY.slate;
}

function ColorPicker({ value, onChange }: { value?: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {GRANT_ACCENT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          onClick={() => onChange(c)}
          className={[
            "h-5 w-5 rounded-full transition",
            grantAccentSolid(c),
            value === c ? "ring-2 ring-offset-1 " + grantAccentRing(c) : "opacity-70 hover:opacity-100",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

// ─── ColsPicker ──────────────────────────────────────────────────────────────

function ColsPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={[
            "rounded px-2 py-0.5 text-xs font-semibold transition",
            value === n
              ? "bg-sky-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600",
          ].join(" ")}
        >
          {n}
        </button>
      ))}
      <span className="ml-1 text-[10px] text-slate-400">cols</span>
    </div>
  );
}

// ─── Drag payload types ───────────────────────────────────────────────────────

type DragPayload =
  | { type: "grant"; grantId: string }
  | { type: "lineItem"; grantId: string; lineItemId: string };

const RENTAL_ASSISTANCE_GROUP_KEY = "rental-assistance";

function encodeDrag(p: DragPayload): string {
  return JSON.stringify(p);
}

function decodeDrag(s: string): DragPayload | null {
  try { return JSON.parse(s) as DragPayload; } catch { return null; }
}

function makeItemId(grantId: string, lineItemId?: string): string {
  return `${grantId}::${lineItemId ?? "grant"}::${Date.now()}`;
}

function normalizeCardType(cardType: BudgetGroupItem["cardType"]): "budget" | "allocation" | "billable" {
  if (cardType === "client-allocation" || cardType === "allocation") return "allocation";
  if (cardType === "billable") return "billable";
  return "budget";
}

// ─── Left panel: Grant source list ───────────────────────────────────────────

type LineItemDef = { id: string; label: string };

function getLineItems(grant: Grant): LineItemDef[] {
  const lis = (grant as any)?.budget?.lineItems as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(lis)) return [];
  return lis.map((li) => ({ id: String(li.id ?? ""), label: String(li.label ?? li.id ?? "") })).filter((l) => l.id);
}

function GrantSourceRow({
  grant,
  placedSet,
}: {
  grant: Grant;
  placedSet: Set<string>;  // "grantId::lineItemId" strings that are placed
}) {
  const [expanded, setExpanded] = useState(false);
  const lineItems = getLineItems(grant);
  const grantPlaced = placedSet.has(`${grant.id}::grant`);
  const capabilities = getGrantFinancialCapabilities(grant as Record<string, unknown>);
  const sourceType = capabilities.billingEnabled || capabilities.usesBillingLedger
    ? "billable program"
    : capabilities.drawsDownBudget
    ? "budget"
    : capabilities.allocationEnabled
    ? "allocation"
    : "financial source";

  return (
    <div className="select-none">
      {/* Grant row */}
      <div
        className={[
          "group flex cursor-grab items-center gap-2 rounded-lg px-3 py-2 transition",
          grantPlaced
            ? "opacity-50 hover:opacity-70"
            : "hover:bg-slate-100 dark:hover:bg-slate-700/50",
        ].join(" ")}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "copy";
          e.dataTransfer.setData("text/plain", encodeDrag({ type: "grant", grantId: String(grant.id) }));
        }}
      >
        {/* Expand toggle */}
        {lineItems.length > 0 ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
            className="flex-shrink-0 text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 w-4"
          >
            {expanded ? "▼" : "▶"}
          </button>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}

        <span className="drag-handle flex-shrink-0 text-[11px] text-slate-300 dark:text-slate-600">⠿</span>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
            {String(grant.name || grant.id)}
          </div>
          <div className="text-[10px] text-slate-400">
            {[sourceType, lineItems.length > 0 ? `${lineItems.length} line items` : ""].filter(Boolean).join(" | ")}
          </div>
        </div>

        {grantPlaced && (
          <span className="flex-shrink-0 text-[9px] text-slate-400 border border-slate-300 rounded-full px-1.5 py-0.5">in group</span>
        )}
      </div>

      {/* Line items (expanded) */}
      {expanded && (
        <div className="ml-5 border-l border-slate-200 dark:border-slate-700 pl-2 pb-1">
          {lineItems.map((li) => {
            const placed = placedSet.has(`${grant.id}::${li.id}`);
            return (
              <div
                key={li.id}
                className={[
                  "group flex cursor-grab items-center gap-2 rounded-md px-2 py-1.5 transition",
                  placed ? "opacity-50 hover:opacity-70" : "hover:bg-slate-100 dark:hover:bg-slate-700/50",
                ].join(" ")}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "copy";
                  e.dataTransfer.setData(
                    "text/plain",
                    encodeDrag({ type: "lineItem", grantId: String(grant.id), lineItemId: li.id }),
                  );
                }}
              >
                <span className="flex-shrink-0 text-[11px] text-slate-300 dark:text-slate-600">⠿</span>
                <span className={["truncate text-xs", placed ? "text-slate-400" : "text-slate-700 dark:text-slate-300"].join(" ")}>
                  {li.label}
                </span>
                {placed && (
                  <span className="flex-shrink-0 text-[9px] text-slate-400 border border-slate-300 rounded-full px-1 py-0.5">✓</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GrantSourcePanel({
  grants,
  placedSet,
  search,
  onSearchChange,
}: {
  grants: Grant[];
  placedSet: Set<string>;
  search: string;
  onSearchChange: (s: string) => void;
}) {
  const searchLower = search.toLowerCase();
  const filtered = searchLower
    ? grants.filter((g) => String(g.name || g.id).toLowerCase().includes(searchLower))
    : grants;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-shrink-0 border-b border-slate-200 dark:border-slate-700 px-3 py-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
          Budget Sources
        </div>
        <input
          type="search"
          placeholder="Search grants…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
        <p className="mt-1.5 text-[10px] text-slate-400">
          Drag a grant or line item into a bucket →
        </p>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-xs text-slate-400">No grants found.</div>
        ) : (
          filtered.map((g) => (
            <GrantSourceRow key={String(g.id)} grant={g} placedSet={placedSet} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Bucket item chip ─────────────────────────────────────────────────────────

function BucketItemChip({
  item,
  grantsById,
  isEditing,
  onEdit,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  item: BudgetGroupItem;
  grantsById: Map<string, Grant>;
  isEditing: boolean;
  onEdit: () => void;
  onUpdate: (patch: Partial<BudgetGroupItem>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const grant = grantsById.get(item.grantId);
  const lineItems = grant ? getLineItems(grant) : [];
  const li = item.lineItemId ? lineItems.find((l) => l.id === item.lineItemId) : null;

  const defaultLabel = item.lineItemId
    ? (li?.label ?? item.lineItemId)
    : String(grant?.name ?? item.grantId);

  const displayLabel = item.labelOverride || defaultLabel;
  const cd = colorDef(item.color);
  const displayType = normalizeCardType(item.cardType);

  return (
    <div>
      {/* Chip */}
      <div
        className={[
          "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition cursor-pointer",
          cd.chip,
          isEditing ? "ring-2 " + cd.ring : "hover:opacity-90",
        ].join(" ")}
        onClick={onEdit}
        title="Click to edit display name and color"
      >
        {item.color && (
          <span className={["inline-block h-2 w-2 rounded-full flex-shrink-0", cd.solid].join(" ")} />
        )}
        <span className="truncate flex-1 min-w-0">{displayLabel}</span>
        {item.lineItemId && (
          <span className="flex-shrink-0 text-[9px] opacity-60 border rounded px-1">line</span>
        )}
        <button
          type="button"
          title="Move up"
          onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
          className="flex-shrink-0 text-current opacity-45 transition hover:opacity-100"
        >
          ↑
        </button>
        <button
          type="button"
          title="Move down"
          onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
          className="flex-shrink-0 text-current opacity-45 transition hover:opacity-100"
        >
          ↓
        </button>
        <button
          type="button"
          title="Remove from group"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="flex-shrink-0 ml-0.5 text-current opacity-50 hover:opacity-100 transition"
        >
          ✕
        </button>
      </div>

      {/* Inline edit form */}
      {isEditing && (
        <div className="mt-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 space-y-2 shadow-sm">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Label
            </label>
            <input
              autoFocus
              type="text"
              placeholder={defaultLabel}
              value={item.labelOverride ?? ""}
              onChange={(e) => onUpdate({ labelOverride: e.target.value || undefined })}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Accent Color
            </label>
            <div className="mt-1">
              <ColorPicker value={item.color} onChange={(c) => onUpdate({ color: c })} />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Card Display
            </label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {([
                ["budget", "Budget"],
                ["allocation", "Allocation"],
                ["billable", "Billable"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onUpdate({ cardType: value })}
                  className={[
                    "rounded px-2 py-0.5 text-[10px] font-semibold transition",
                    displayType === value
                      ? "bg-sky-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(); }} // toggle off
            className="text-[10px] font-semibold text-sky-600 hover:text-sky-800"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Group bucket ─────────────────────────────────────────────────────────────

function GroupBucket({
  group,
  grantsById,
  editingItemId,
  onEditItem,
  onChange,
  onDelete,
}: {
  group: BudgetGroupCfg;
  grantsById: Map<string, Grant>;
  editingItemId: string | null;
  onEditItem: (id: string | null) => void;
  onChange: (patch: Partial<BudgetGroupCfg>) => void;
  onDelete: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [editingHeader, setEditingHeader] = useState(false);
  const [nameDraft, setNameDraft] = useState(group.label);
  const headerRef = useRef<HTMLDivElement>(null);

  // Close header edit on outside click
  useEffect(() => {
    if (!editingHeader) return;
    const handler = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        onChange({ label: nameDraft });
        setEditingHeader(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [editingHeader, nameDraft, onChange]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const raw = e.dataTransfer.getData("text/plain");
    const payload = decodeDrag(raw);
    if (!payload) return;
    if (group.key === RENTAL_ASSISTANCE_GROUP_KEY && payload.type !== "grant") return;

    const newItem: BudgetGroupItem = {
      id: makeItemId(payload.grantId, payload.type === "lineItem" ? payload.lineItemId : undefined),
      grantId: payload.grantId,
      lineItemId: payload.type === "lineItem" ? payload.lineItemId : undefined,
    };

    onChange({ items: [...group.items, newItem] });
  };

  const updateItem = (itemId: string, patch: Partial<BudgetGroupItem>) => {
    onChange({
      items: group.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
    });
  };

  const removeItem = (itemId: string) => {
    onChange({ items: group.items.filter((it) => it.id !== itemId) });
    if (editingItemId === itemId) onEditItem(null);
  };

  const moveItem = (itemId: string, direction: -1 | 1) => {
    const index = group.items.findIndex((it) => it.id === itemId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= group.items.length) return;
    const next = [...group.items];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange({ items: next });
  };

  const cd = colorDef(group.color);
  const colLabel = group.cols ?? 3;

  return (
    <div
      className={[
        "flex flex-col rounded-xl border transition-all",
        "bg-white dark:bg-slate-900",
        dragOver
          ? "border-sky-400 ring-2 ring-sky-300 ring-offset-1 dark:ring-sky-600"
          : "border-slate-200 dark:border-slate-700",
      ].join(" ")}
      style={{ minWidth: 240, maxWidth: 320, width: "100%" }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Color accent strip */}
      <div className={["h-1.5 w-full rounded-t-xl", cd.solid].join(" ")} />

      {/* Bucket header */}
      <div ref={headerRef} className="border-b border-slate-100 dark:border-slate-800 px-3 py-2.5">
        {editingHeader ? (
          <div className="space-y-2">
            <input
              autoFocus
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { onChange({ label: nameDraft }); setEditingHeader(false); }
                if (e.key === "Escape") { setNameDraft(group.label); setEditingHeader(false); }
              }}
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm font-semibold dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            <ColorPicker value={group.color} onChange={(c) => onChange({ color: c })} />
            <div className="flex items-center justify-between">
              <ColsPicker value={colLabel} onChange={(n) => onChange({ cols: n })} />
              <button
                type="button"
                onClick={() => { onChange({ label: nameDraft }); setEditingHeader(false); }}
                className="text-[10px] font-semibold text-sky-600 hover:text-sky-800"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="flex items-center gap-2 text-left hover:opacity-80 flex-1 min-w-0"
              onClick={() => { setNameDraft(group.label); setEditingHeader(true); }}
              title="Click to edit group name, color, and columns"
            >
              <span className={["inline-block h-2.5 w-2.5 rounded-full flex-shrink-0", cd.solid].join(" ")} />
              <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{group.label}</span>
            </button>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[10px] text-slate-400">{colLabel}c</span>
              <button
                type="button"
                title="Edit group"
                onClick={() => { setNameDraft(group.label); setEditingHeader(true); }}
                className="rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-xs"
              >
                ✏
              </button>
              <button
                type="button"
                title="Delete group"
                onClick={onDelete}
                className="rounded p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition text-xs"
              >
                🗑
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 min-h-[80px]">
        {group.items.length === 0 && !dragOver && (
          <div className="flex h-full min-h-[60px] items-center justify-center text-[11px] text-slate-400 dark:text-slate-600 italic">
            {group.key === RENTAL_ASSISTANCE_GROUP_KEY ? "Drop grants here" : "Drop grants or line items here"}
          </div>
        )}

        {dragOver && group.items.length === 0 && (
          <div className="flex h-full min-h-[60px] items-center justify-center rounded-lg border-2 border-dashed border-sky-400 text-xs text-sky-500">
            Drop here
          </div>
        )}

        {group.items.map((item) => (
          <BucketItemChip
            key={item.id}
            item={item}
            grantsById={grantsById}
            isEditing={editingItemId === item.id}
            onEdit={() => onEditItem(editingItemId === item.id ? null : item.id)}
            onUpdate={(patch) => updateItem(item.id, patch)}
            onMoveUp={() => moveItem(item.id, -1)}
            onMoveDown={() => moveItem(item.id, 1)}
            onRemove={() => removeItem(item.id)}
          />
        ))}

        {/* Drop zone indicator at bottom when items exist */}
        {dragOver && group.items.length > 0 && (
          <div className="rounded-lg border-2 border-dashed border-sky-400 py-2 text-center text-xs text-sky-500">
            + Drop here
          </div>
        )}
      </div>

      {/* Footer: item count */}
      <div className="border-t border-slate-100 dark:border-slate-800 px-3 py-1.5 text-[10px] text-slate-400">
        {group.items.length} {group.items.length === 1 ? "item" : "items"}
      </div>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface BudgetConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  grants: Grant[];
}

export function BudgetConfigModal({ isOpen, onClose, grants }: BudgetConfigModalProps) {
  const { data: savedConfig } = useOrgConfig();
  const save = useSaveOrgConfig();

  const [groups, setGroups] = useState<BudgetGroupCfg[]>([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [sourceSearch, setSourceSearch] = useState("");

  // Sync local state when modal opens or saved config changes
  useEffect(() => {
    if (isOpen) {
      setGroups(savedConfig?.budgetDisplay.groups ?? []);
      setEditingItemId(null);
    }
  }, [isOpen, savedConfig]);

  const grantsById = useMemo(() => {
    const map = new Map<string, Grant>();
    for (const g of grants) map.set(String(g.id), g);
    return map;
  }, [grants]);

  // Set of "grantId::lineItemId" (or "grantId::grant") placed in any bucket
  const placedSet = useMemo(() => {
    const s = new Set<string>();
    for (const grp of groups) {
      for (const item of grp.items) {
        s.add(`${item.grantId}::${item.lineItemId ?? "grant"}`);
      }
    }
    return s;
  }, [groups]);

  const addGroup = () => {
    const key = `group_${Date.now()}`;
    setGroups((prev) => [
      ...prev,
      { key, label: "New Group", color: "slate", cols: 3, items: [] },
    ]);
  };

  const updateGroup = (key: string, patch: Partial<BudgetGroupCfg>) => {
    setGroups((prev) =>
      prev.map((g) => (g.key === key ? { ...g, ...patch } : g)),
    );
  };

  const deleteGroup = (key: string) => {
    setGroups((prev) => prev.filter((g) => g.key !== key));
  };

  const handleSave = async () => {
    if (!savedConfig) return;
    const next: OrgDisplayConfig = {
      ...savedConfig,
      budgetDisplay: { ...savedConfig.budgetDisplay, groups },
    };
    await save.mutateAsync(next);
    onClose();
  };

  const isDirty = JSON.stringify(groups) !== JSON.stringify(savedConfig?.budgetDisplay.groups ?? []);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      widthClass="max-w-7xl w-full"
      title={
        <div className="flex items-center gap-2">
          <span className="font-bold">Configure Budget Layout</span>
          {isDirty && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Unsaved changes
            </span>
          )}
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Drag grants (or individual line items) from the left into group buckets.
          </p>
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={save.isPending || !isDirty}
            >
              {save.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      }
      disableOverlayClose={isDirty}
    >
      {/* Two-column layout: left source panel + right bucket area */}
      <div className="flex h-[70vh] gap-0 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
        {/* Left: grant source panel */}
        <div className="w-72 flex-shrink-0 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50">
          <GrantSourcePanel
            grants={grants}
            placedSet={placedSet}
            search={sourceSearch}
            onSearchChange={setSourceSearch}
          />
        </div>

        {/* Right: buckets area */}
        <div className="flex-1 overflow-auto p-4">
          {groups.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400 dark:text-slate-600">
              <div className="text-4xl">📦</div>
              <p className="text-sm">No groups yet. Create a bucket to start organizing.</p>
              <button type="button" className="btn btn-primary btn-sm" onClick={addGroup}>
                + Add Group
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-4 content-start">
              {groups.map((group) => (
                <GroupBucket
                  key={group.key}
                  group={group}
                  grantsById={grantsById}
                  editingItemId={editingItemId}
                  onEditItem={setEditingItemId}
                  onChange={(patch) => updateGroup(group.key, patch)}
                  onDelete={() => deleteGroup(group.key)}
                />
              ))}

              {/* Add group button */}
              <button
                type="button"
                onClick={addGroup}
                className="flex h-24 w-full min-w-[200px] max-w-[240px] items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-sm text-slate-400 transition hover:border-sky-400 hover:bg-sky-50/50 hover:text-sky-600 dark:border-slate-700 dark:hover:border-sky-600 dark:hover:bg-sky-950/20 dark:hover:text-sky-400"
              >
                <span className="text-xl font-light">+</span>
                <span>Add Group</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
