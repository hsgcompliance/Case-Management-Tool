// entities/PageFilterBar.tsx
// Sticky filter bar that can be dragged into a floating modal.
//
// Pinned (default): sticky below the topbar, full content width, grey/square style.
//   – Search is always visible.
//   – Click anywhere on the bar (except the search input) to expand/collapse filters.
//   – Drag the grip handle (⠿) more than 8px to detach into float mode.
//
// Floating: fixed modal layer above all content, resizable + scrollable.
//   – Drag the header to reposition.
//   – Large ✕ button returns the bar to its pinned position.
"use client";

import React, { useCallback, useState } from "react";

const DRAG_THRESHOLD = 8;

type PageFilterBarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  /** Called when the user presses Enter in the search box — use to trigger a full-pool search */
  onSearchEnter?: () => void;
  searchPlaceholder?: string;
  /** Summary shown to the right of the search input, e.g. "24 / 156 Customers" */
  resultLabel?: string;
  /** Buttons / actions rendered at the far right of the bar header (Clear, New, etc.) */
  actions?: React.ReactNode;
  /** The expanded filter controls shown below the search row when the bar is open */
  children?: React.ReactNode;
  /** Start expanded (default: false) */
  defaultExpanded?: boolean;
};

export function PageFilterBar({
  search,
  onSearchChange,
  onSearchEnter,
  searchPlaceholder = "Search…",
  resultLabel,
  actions,
  children,
  defaultExpanded = false,
}: PageFilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isFloating, setIsFloating] = useState(false);
  const [floatPos, setFloatPos] = useState({ x: 80, y: 100 });

  // ── Grip → float ──────────────────────────────────────────────────────────
  const handleGripMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isFloating) return;
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startY = e.clientY;
      let detached = false;

      const onMouseMove = (me: MouseEvent) => {
        if (detached) return;
        const dx = me.clientX - startX;
        const dy = me.clientY - startY;
        if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
          detached = true;
          setIsFloating(true);
          setIsExpanded(true);
          setFloatPos({ x: me.clientX - 220, y: me.clientY - 24 });
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
        }
      };
      const onMouseUp = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [isFloating],
  );

  // ── Float header drag (reposition) ────────────────────────────────────────
  const handleFloatHeaderMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const offsetX = e.clientX - floatPos.x;
      const offsetY = e.clientY - floatPos.y;

      const onMouseMove = (me: MouseEvent) => {
        setFloatPos({ x: me.clientX - offsetX, y: me.clientY - offsetY });
      };
      const onMouseUp = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [floatPos],
  );

  const returnToPinned = () => {
    setIsFloating(false);
    setIsExpanded(false);
  };

  // ── Shared search input ───────────────────────────────────────────────────
  const searchInput = (stopProp: boolean) => (
    <div
      className="flex min-w-0 flex-1 items-center rounded-lg border border-slate-200 bg-white px-3 shadow-sm dark:border-slate-600 dark:bg-slate-950"
      onMouseDown={stopProp ? (e) => e.stopPropagation() : undefined}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="search"
        className="min-w-0 flex-1 bg-transparent py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
        placeholder={searchPlaceholder}
        value={search}
        onChange={(e) => onSearchChange(e.currentTarget.value)}
        onKeyDown={onSearchEnter ? (e) => { if (e.key === "Enter") { e.preventDefault(); onSearchEnter(); } } : undefined}
      />
    </div>
  );

  // ── PINNED mode ───────────────────────────────────────────────────────────
  if (!isFloating) {
    return (
      <div className="sticky z-40" style={{ top: "var(--topbar-height)" }}>
        <div className="rounded-md border border-slate-300 bg-slate-100 shadow-sm dark:border-slate-700 dark:bg-slate-800/80">
          {/* Header row */}
          <div
            className="flex cursor-pointer select-none items-center gap-2 px-3 py-2"
            onClick={() => setIsExpanded((v) => !v)}
          >
            {/* Grip */}
            <span
              className="shrink-0 cursor-grab text-base leading-none text-slate-400 hover:text-slate-600 active:cursor-grabbing dark:hover:text-slate-200"
              onMouseDown={handleGripMouseDown}
              onClick={(e) => e.stopPropagation()}
              title="Drag to detach"
            >
              ⠿
            </span>

            {searchInput(false)}

            {resultLabel ? (
              <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                {resultLabel}
              </span>
            ) : null}

            {actions ? (
              <div
                className="flex shrink-0 items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                {actions}
              </div>
            ) : null}

            <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
              {isExpanded ? "▲" : "▼"}
            </span>
          </div>

          {/* Expanded filter controls */}
          {isExpanded && children ? (
            <div className="border-t border-slate-200 px-3 py-3 dark:border-slate-700">
              {children}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // ── FLOATING mode ─────────────────────────────────────────────────────────
  return (
    <>
      {/* Ghost placeholder so the layout doesn't collapse */}
      <div className="pointer-events-none h-[40px]" aria-hidden />

      <div
        className="fixed z-[200] min-w-[320px] overflow-auto rounded-md border border-slate-300 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        style={{
          top: floatPos.y,
          left: floatPos.x,
          width: 500,
          maxWidth: "90vw",
          maxHeight: "80vh",
          resize: "both",
        }}
      >
        {/* Float header — drag to reposition */}
        <div
          className="flex cursor-move select-none items-center gap-2 border-b border-slate-200 bg-slate-100 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
          onMouseDown={handleFloatHeaderMouseDown}
        >
          <span className="shrink-0 text-base leading-none text-slate-400">⠿</span>

          {searchInput(true)}

          {resultLabel ? (
            <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
              {resultLabel}
            </span>
          ) : null}

          {/* Large ✕ — returns to pinned */}
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={returnToPinned}
            className="ml-1 shrink-0 text-2xl font-light leading-none text-slate-400 transition hover:text-slate-800 dark:hover:text-slate-100"
            title="Return to pinned position"
          >
            ✕
          </button>
        </div>

        {/* Filter content */}
        <div className="overflow-auto px-3 py-3">
          {children}
          {actions ? (
            <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

export default PageFilterBar;
