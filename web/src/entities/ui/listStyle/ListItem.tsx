"use client";

import React from "react";

export interface ListItemProps {
  /** Primary label */
  label: React.ReactNode;
  /** Secondary line below the label */
  sublabel?: React.ReactNode;
  /** Right-side content (badge, value, actions) */
  right?: React.ReactNode;
  /** Left-side slot (icon, avatar, status dot) */
  left?: React.ReactNode;
  /** Makes the row clickable */
  onClick?: () => void;
  /** Highlight state (selected, active) */
  active?: boolean;
  /** Muted / disabled visual */
  muted?: boolean;
  className?: string;
}

export function ListItem({ label, sublabel, right, left, onClick, active, muted, className }: ListItemProps) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={[
        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition",
        onClick ? "cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" : "",
        active ? "bg-sky-50 dark:bg-sky-900/30 ring-1 ring-sky-300/50" : "",
        muted ? "opacity-50" : "",
        className,
      ].filter(Boolean).join(" ")}
    >
      {left ? <div className="shrink-0">{left}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{label}</div>
        {sublabel ? <div className="truncate text-xs text-slate-500">{sublabel}</div> : null}
      </div>
      {right ? <div className="shrink-0 text-sm text-slate-500">{right}</div> : null}
    </Tag>
  );
}

export default ListItem;
