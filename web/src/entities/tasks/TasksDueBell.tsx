// web/src/entities/tasks/TasksDueBell.tsx
"use client";
import React from "react";
import { useMyTasksDue } from "@hooks/useInbox";
import { useTasksDueModal } from "./TasksDueModalController";
import type { InboxItem } from "@types";

const PREVIEW_LIMIT = 5;

export function TasksDueBell() {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const { openTasksDueModal } = useTasksDueModal();

  const dueQ = useMyTasksDue();
  const items = ((dueQ.data || []) as InboxItem[]).filter((i) => i.status !== "done");
  const count = items.length;
  const preview = items.slice(0, PREVIEW_LIMIT);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={rootRef} data-tour="topbar-tasks-due-bell">
      <button
        type="button"
        className="relative rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Tasks due this month"
      >
        <span aria-hidden>🔔</span>
        {count > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-[310] mt-2 w-72 rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Due this month
          </div>
          {preview.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-500">Nothing due this month.</div>
          ) : (
            preview.map((item) => (
              <div key={item.utid} className="px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200">
                <div className="truncate font-medium">{item.title}</div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="truncate">{item.customerName ? String(item.customerName) : ""}</span>
                  <span>{item.dueDate || ""}</span>
                </div>
              </div>
            ))
          )}
          <button
            type="button"
            role="menuitem"
            className="mt-1 block w-full border-t border-slate-100 px-3 py-2 text-left text-sm font-medium text-blue-700 hover:bg-slate-50 dark:border-slate-800 dark:text-blue-300 dark:hover:bg-slate-800"
            onClick={() => {
              setOpen(false);
              openTasksDueModal();
            }}
          >
            View all ({count}) →
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default TasksDueBell;
