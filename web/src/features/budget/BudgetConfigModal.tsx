// web/src/features/budget/BudgetConfigModal.tsx
// Visual drag-and-drop budget group config editor.
"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@entities/ui/Modal";
import { useOrgConfig, useSaveOrgConfig } from "@hooks/useOrgConfig";
import type { BudgetGroupCfg, BudgetGroupItem, OrgDisplayConfig } from "@hooks/useOrgConfig";
import type { TGrant as Grant } from "@types";

// ─── Color palette ────────────────────────────────────────────────────────────

const COLOR_DEFS: Record<string, { bg: string; ring: string; chip: string; dot: string }> = {
  sky:     { bg: "bg-sky-500",     ring: "ring-sky-400",     chip: "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/40 dark:text-sky-200 dark:border-sky-700",     dot: "bg-sky-500" },
  blue:    { bg: "bg-blue-500",    ring: "ring-blue-400",    chip: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-700",    dot: "bg-blue-500" },
  indigo:  { bg: "bg-indigo-500",  ring: "ring-indigo-400",  chip: "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/40 dark:text-indigo-200 dark:border-indigo-700",  dot: "bg-indigo-500" },
  violet:  { bg: "bg-violet-500",  ring: "ring-violet-400",  chip: "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-900/40 dark:text-violet-200 dark:border-violet-700",  dot: "bg-violet-500" },
  purple:  { bg: "bg-purple-500",  ring: "ring-purple-400",  chip: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/40 dark:text-purple-200 dark:border-purple-700",  dot: "bg-purple-500" },
  pink:    { bg: "bg-pink-500",    ring: "ring-pink-400",    chip: "bg-pink-100 text-pink-800 border-pink-300 dark:bg-pink-900/40 dark:text-pink-200 dark:border-pink-700",    dot: "bg-pink-500" },
  rose:    { bg: "bg-rose-500",    ring: "ring-rose-400",    chip: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-700",    dot: "bg-rose-500" },
  red:     { bg: "bg-red-500",     ring: "ring-red-400",     chip: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-200 dark:border-red-700",     dot: "bg-red-500" },
  orange:  { bg: "bg-orange-500",  ring: "ring-orange-400",  chip: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/40 dark:text-orange-200 dark:border-orange-700",  dot: "bg-orange-500" },
  amber:   { bg: "bg-amber-500",   ring: "ring-amber-400",   chip: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700",   dot: "bg-amber-500" },
  lime:    { bg: "bg-lime-500",    ring: "ring-lime-400",    chip: "bg-lime-100 text-lime-800 border-lime-300 dark:bg-lime-900/40 dark:text-lime-200 dark:border-lime-700",    dot: "bg-lime-500" },
  green:   { bg: "bg-green-500",   ring: "ring-green-400",   chip: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-200 dark:border-green-700",   dot: "bg-green-500" },
  emerald: { bg: "bg-emerald-500", ring: "ring-emerald-400", chip: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-700", dot: "bg-emerald-500" },
  teal:    { bg: "bg-teal-500",    ring: "ring-teal-400",    chip: "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/40 dark:text-teal-200 dark:border-teal-700",    dot: "bg-teal-500" },
  cyan:    { bg: "bg-cyan-500",    ring: "ring-cyan-400",    chip: "bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-900/40 dark:text-cyan-200 dark:border-cyan-700",    dot: "bg-cyan-500" },
  slate:   { bg: "bg-slate-500",   ring: "ring-slate-400",   chip: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600",   dot: "bg-slate-500" },
};

const COLOR_KEYS = Object.keys(COLOR_DEFS);

function colorDef(key?: string) {
  return (key && COLOR_DEFS[key]) ? COLOR_DEFS[key] : COLOR_DEFS.slate;
}

// ─── ColorPicker ─────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }: { value?: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {COLOR_KEYS.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          onClick={() => onChange(c)}
          className={[
            "h-5 w-5 rounded-full transition",
            COLOR_DEFS[c].dot,
            value === c ? "ring-2 ring-offset-1 " + COLOR_DEFS[c].ring : "opacity-70 hover:opacity-100",
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

function encodeDrag(p: DragPayload): string {
  return JSON.stringify(p);
}

function decodeDrag(s: string): DragPayload | null {
  try { return JSON.parse(s) as DragPayload; } catch { return null; }
}

function makeItemId(grantId: string, lineItemId?: string): string {
  return `${grantId}::${lineItemId ?? "grant"}::${Date.now()}`;
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
          {lineItems.length > 0 && (
            <div className="text-[10px] text-slate-400">{lineItems.length} line items</div>
          )}
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
          Grant Sources
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
  onRemove,
}: {
  item: BudgetGroupItem;
  grantsById: Map<string, Grant>;
  isEditing: boolean;
  onEdit: () => void;
  onUpdate: (patch: Partial<BudgetGroupItem>) => void;
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
          <span className={["inline-block h-2 w-2 rounded-full flex-shrink-0", cd.dot].join(" ")} />
        )}
        <span className="truncate flex-1 min-w-0">{displayLabel}</span>
        {item.lineItemId && (
          <span className="flex-shrink-0 text-[9px] opacity-60 border rounded px-1">line</span>
        )}
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
              Card Type
            </label>
            <div className="mt-1 flex gap-1.5">
              {(["standard", "client-allocation"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onUpdate({ cardType: t })}
                  className={[
                    "rounded px-2 py-0.5 text-[10px] font-semibold capitalize transition",
                    (item.cardType ?? "standard") === t
                      ? "bg-sky-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300",
                  ].join(" ")}
                >
                  {t}
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
      <div className={["h-1.5 w-full rounded-t-xl", cd.bg].join(" ")} />

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
              <span className={["inline-block h-2.5 w-2.5 rounded-full flex-shrink-0", cd.dot].join(" ")} />
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
            Drop grants or line items here
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
