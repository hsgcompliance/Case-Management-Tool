"use client";

import React from "react";
import ActionMenu, { type ActionItem } from "@entities/ui/ActionMenu";

export type RowState = "active" | "inactive" | "completed" | "deleted";
export type RowClearStatus =
  | "none"
  | "deleted"
  | "moved"
  | "completed"
  | "markedActive"
  | "markedInactive";

type RowStateTone = {
  badge: string;
  row: string;
};

const ROW_STATE_TONES: Record<RowState, RowStateTone> = {
  active: {
    badge: "border-sky-200 bg-sky-50 text-sky-700",
    row: "border-slate-200 bg-slate-50",
  },
  inactive: {
    badge: "border-slate-300 bg-white text-slate-700",
    row: "border-slate-200 bg-white opacity-80",
  },
  completed: {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    row: "border-slate-200 bg-white opacity-80",
  },
  deleted: {
    badge: "border-red-200 bg-red-50 text-red-700",
    row: "border-red-200 bg-red-50",
  },
};

export function rowStateSurfaceClass(state: RowState, base = "rounded border p-2"): string {
  return `${base} ${ROW_STATE_TONES[state].row}`;
}

export function rowStateBadgeClass(state: RowState, base = "rounded-full border px-2 py-0.5 text-xs font-medium"): string {
  return `${base} ${ROW_STATE_TONES[state].badge}`;
}

export function RowStateBadge({
  state,
  label,
  className = "",
}: {
  state: RowState;
  label?: string;
  className?: string;
}) {
  return (
    <span className={`${rowStateBadgeClass(state)} ${className}`.trim()}>
      {label || state}
    </span>
  );
}

export function asRowState(input: unknown): RowState {
  const v = String(input || "").toLowerCase();
  if (v === "deleted") return "deleted";
  if (v === "completed" || v === "done" || v === "verified" || v === "closed") return "completed";
  if (v === "inactive" || v === "disabled") return "inactive";
  return "active";
}

function clearTone(clearStatus: RowClearStatus): { row: string; note: string } | null {
  if (clearStatus === "none") return null;
  if (clearStatus === "deleted") {
    return { row: "border-red-200 bg-red-50", note: "Deleted" };
  }
  return { row: "border-sky-200 bg-sky-50", note: "Updated" };
}

export function RowClearShell({
  state,
  clearStatus = "none",
  children,
  extraButtons,
  menuItems = [],
  onManage,
  manageLabel = "Manage",
  disabled = false,
  className = "",
  contentClassName = "",
  collapseOnClear = true,
  clearMs = 900,
}: {
  state: RowState;
  clearStatus?: RowClearStatus;
  children: React.ReactNode;
  extraButtons?: React.ReactNode;
  menuItems?: ActionItem[];
  onManage?: () => void | Promise<void>;
  manageLabel?: string;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  collapseOnClear?: boolean;
  clearMs?: number;
}) {
  const [hidden, setHidden] = React.useState(false);
  const [collapsing, setCollapsing] = React.useState(false);
  const clear = clearTone(clearStatus);

  React.useEffect(() => {
    if (!collapseOnClear || !clear || clearStatus === "none") {
      setCollapsing(false);
      setHidden(false);
      return;
    }
    setHidden(false);
    setCollapsing(false);
    const t1 = window.setTimeout(() => setCollapsing(true), Math.max(80, Math.floor(clearMs * 0.45)));
    const t2 = window.setTimeout(() => setHidden(true), clearMs);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [clearStatus, clear, collapseOnClear, clearMs]);

  if (hidden) return null;

  const items: ActionItem[] = [
    ...(onManage ? [{ key: "manage", label: manageLabel, onSelect: onManage }] : []),
    ...menuItems,
  ];

  const shellClass = clear
    ? `rounded border p-2 transition-all duration-300 ${clear.row}`
    : rowStateSurfaceClass(state, "rounded border p-2 transition-all duration-300");

  return (
    <div
      className={[
        shellClass,
        collapsing ? "opacity-0 max-h-0 py-0 overflow-hidden scale-[0.99]" : "opacity-100 max-h-48",
        className,
      ].join(" ").trim()}
    >
      <div className={`flex items-center justify-between gap-2 ${contentClassName}`.trim()}>
        <div className="min-w-0 flex-1">{children}</div>
        <div className="flex shrink-0 items-center gap-1">
          {clear ? <span className="text-[11px] text-slate-600">{clear.note}</span> : null}
          {extraButtons}
          {items.length ? <ActionMenu items={items} disabled={disabled} /> : null}
        </div>
      </div>
    </div>
  );
}
