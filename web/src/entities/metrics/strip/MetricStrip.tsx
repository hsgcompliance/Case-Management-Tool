"use client";

import React from "react";
import { MetricStripCard, type MetricStripCardProps } from "./MetricStripCard";
import { MetricsDropdown } from "./MetricsDropdown";

export interface MetricStripItem extends MetricStripCardProps {
  id: string;
}

export interface MetricStripResetOption {
  label: string;
  /** @deprecated Use largeIds / smallIds */
  ids?: string[];
  largeIds?: string[];
  smallIds?: string[];
  disabled?: boolean;
}

export interface TierState {
  large: string[];
  small: string[];
}

export interface MetricStripProps {
  items: MetricStripItem[];
  /** IDs to show in the large top row by default (before any user customisation). */
  defaultLargeIds?: string[];
  /** IDs to show in the compact bottom row by default. */
  defaultSmallIds?: string[];
  /** @deprecated Pass defaultLargeIds instead. */
  defaultVisibleIds?: string[];
  resetOptions?: MetricStripResetOption[];
  storageKey?: string;
  configurable?: boolean;
  hideable?: boolean;
  className?: string;
  gridClassName?: string;
  emptyMessage?: string;
}

// ─── localStorage helpers ────────────────────────────────────────────────────

function sk(base: string | undefined, suffix: string) {
  return base ? `${base}_${suffix}` : null;
}

function readTiers(storageKey: string | undefined, defaultLarge: string[], defaultSmall: string[]): TierState {
  if (typeof window === "undefined" || !storageKey) return { large: defaultLarge, small: defaultSmall };
  try {
    const raw = window.localStorage.getItem(storageKey + "_tiers");
    if (!raw) return { large: defaultLarge, small: defaultSmall };
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as TierState).large) &&
      Array.isArray((parsed as TierState).small)
    ) {
      return parsed as TierState;
    }
  } catch {}
  return { large: defaultLarge, small: defaultSmall };
}

function writeTiers(storageKey: string | undefined, tiers: TierState) {
  if (typeof window === "undefined" || !storageKey) return;
  try {
    window.localStorage.setItem(storageKey + "_tiers", JSON.stringify(tiers));
  } catch {}
}

function readHidden(storageKey?: string): boolean {
  const key = sk(storageKey, "hidden");
  if (!key || typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeHidden(storageKey: string | undefined, hidden: boolean) {
  const key = sk(storageKey, "hidden");
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, hidden ? "1" : "0");
  } catch {}
}

// ─── MetricStrip ─────────────────────────────────────────────────────────────

export function MetricStrip({
  items,
  defaultLargeIds,
  defaultSmallIds,
  defaultVisibleIds,
  resetOptions,
  storageKey,
  configurable = false,
  hideable = false,
  className,
  gridClassName,
  emptyMessage = "No metrics selected.",
}: MetricStripProps) {
  const allIds = React.useMemo(() => items.map((item) => item.id), [items]);

  // Resolve defaults — honour deprecated defaultVisibleIds as large fallback
  const resolvedDefaultLarge = React.useMemo(
    () => (defaultLargeIds ?? defaultVisibleIds ?? allIds).filter((id) => allIds.includes(id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allIds.join(","), (defaultLargeIds ?? defaultVisibleIds)?.join(",")],
  );
  const resolvedDefaultSmall = React.useMemo(
    () => (defaultSmallIds ?? []).filter((id) => allIds.includes(id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allIds.join(","), defaultSmallIds?.join(",")],
  );

  const [tiers, setTiersRaw] = React.useState<TierState>(() =>
    readTiers(storageKey, resolvedDefaultLarge, resolvedDefaultSmall),
  );

  // Sync if storageKey changes
  React.useEffect(() => {
    setTiersRaw(readTiers(storageKey, resolvedDefaultLarge, resolvedDefaultSmall));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Persist whenever tiers change
  function setTiers(update: React.SetStateAction<TierState>) {
    setTiersRaw((prev) => {
      const next = typeof update === "function" ? update(prev) : update;
      writeTiers(storageKey, next);
      return next;
    });
  }

  const [hidden, setHidden] = React.useState(() => readHidden(storageKey));
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Drag state
  const [dragging, setDragging] = React.useState<{ id: string; from: "large" | "small" } | null>(null);
  const [dragOverTier, setDragOverTier] = React.useState<"large" | "small" | null>(null);

  React.useEffect(() => {
    if (!menuOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, [menuOpen]);

  // Filter items to valid IDs
  const largeItems = React.useMemo(() => {
    const set = new Set(tiers.large);
    return items.filter((item) => set.has(item.id));
  }, [items, tiers.large]);

  const smallItems = React.useMemo(() => {
    const set = new Set(tiers.small);
    return items.filter((item) => set.has(item.id));
  }, [items, tiers.small]);

  const canHide = hideable && !!storageKey;
  const canConfigure = configurable && (items.length > 1 || !!resetOptions?.length);

  // ─── DnD handlers ──────────────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent, id: string, from: "large" | "small") {
    setDragging({ id, from });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }

  function handleDragEnd() {
    setDragging(null);
    setDragOverTier(null);
  }

  function handleDragOver(e: React.DragEvent, tier: "large" | "small") {
    if (!dragging || dragging.from === tier) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverTier(tier);
  }

  function handleDragLeave() {
    setDragOverTier(null);
  }

  function handleDrop(e: React.DragEvent, tier: "large" | "small") {
    e.preventDefault();
    if (!dragging || dragging.from === tier) return;
    const { id } = dragging;
    setTiers((prev) => ({
      large: tier === "large"
        ? [...prev.large, id]
        : prev.large.filter((x) => x !== id),
      small: tier === "small"
        ? [...prev.small, id]
        : prev.small.filter((x) => x !== id),
    }));
    setDragging(null);
    setDragOverTier(null);
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (hidden) {
    if (!canHide) return null;
    return (
      <div className={["flex justify-end", className].filter(Boolean).join(" ")}>
        <button
          type="button"
          onClick={() => {
            setHidden(false);
            writeHidden(storageKey, false);
          }}
          className="text-[11px] text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
        >
          Show metrics
        </button>
      </div>
    );
  }

  const hasLarge = largeItems.length > 0;
  const hasSmall = smallItems.length > 0;
  const hasAny = hasLarge || hasSmall;

  return (
    <div className={["space-y-2", className].filter(Boolean).join(" ")}>
      {/* Toolbar */}
      {(canConfigure || canHide) ? (
        <div className="flex justify-end gap-1">
          {canConfigure ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded text-base text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Metric display options"
                onClick={() => setMenuOpen((open) => !open)}
              >
                ···
              </button>
              {menuOpen ? (
                <MetricsDropdown
                  items={items}
                  tiers={tiers}
                  resetOptions={resetOptions}
                  setTiers={setTiers}
                  onClose={() => setMenuOpen(false)}
                />
              ) : null}
            </div>
          ) : null}
          {canHide ? (
            <button
              type="button"
              onClick={() => {
                setHidden(true);
                writeHidden(storageKey, true);
              }}
              className="flex h-7 w-7 items-center justify-center rounded text-xs text-slate-300 transition hover:text-slate-500"
              title="Hide metrics"
            >
              ×
            </button>
          ) : null}
        </div>
      ) : null}

      {!hasAny ? (
        <div className="py-2 text-sm text-slate-400">{emptyMessage}</div>
      ) : null}

      {/* Large row — full cards */}
      {hasLarge ? (
        <div
          onDragOver={(e) => handleDragOver(e, "large")}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, "large")}
          className={[
            "transition-all",
            gridClassName ?? "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4",
            dragOverTier === "large" ? "ring-2 ring-sky-300 ring-offset-2 rounded-2xl dark:ring-sky-600" : "",
          ].filter(Boolean).join(" ")}
        >
          {largeItems.map((item) => (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => handleDragStart(e, item.id, "large")}
              onDragEnd={handleDragEnd}
              className={["cursor-grab active:cursor-grabbing", dragging?.id === item.id ? "opacity-50" : ""].filter(Boolean).join(" ")}
            >
              <MetricStripCard {...item} />
            </div>
          ))}
        </div>
      ) : dragging?.from === "small" ? (
        // Drop target when large row is empty and user is dragging from small
        <div
          onDragOver={(e) => handleDragOver(e, "large")}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, "large")}
          className="flex h-20 items-center justify-center rounded-2xl border-2 border-dashed border-sky-300 text-sm text-sky-400 dark:border-sky-700 dark:text-sky-600"
        >
          Drop here to promote to large
        </div>
      ) : null}

      {/* Small row — compact chips */}
      {hasSmall ? (
        <div
          onDragOver={(e) => handleDragOver(e, "small")}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, "small")}
          className={[
            "flex flex-wrap gap-2 transition-all",
            dragOverTier === "small" ? "ring-2 ring-sky-300 ring-offset-1 rounded-xl dark:ring-sky-600" : "",
          ].filter(Boolean).join(" ")}
        >
          {smallItems.map((item) => (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => handleDragStart(e, item.id, "small")}
              onDragEnd={handleDragEnd}
              className={["cursor-grab active:cursor-grabbing", dragging?.id === item.id ? "opacity-50" : ""].filter(Boolean).join(" ")}
            >
              <MetricStripCard {...item} compact />
            </div>
          ))}
        </div>
      ) : dragging?.from === "large" ? (
        // Drop target when small row is empty and user is dragging from large
        <div
          onDragOver={(e) => handleDragOver(e, "small")}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, "small")}
          className="flex h-12 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-sm text-slate-400 dark:border-slate-600"
        >
          Drop here to move to compact row
        </div>
      ) : null}
    </div>
  );
}

export default MetricStrip;
