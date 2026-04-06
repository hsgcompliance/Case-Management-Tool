"use client";

import React from "react";
import { AnyDashboardToolDefinition } from "../types";

export interface GlobalTopbarProps {
  tools: readonly AnyDashboardToolDefinition[];
  activeToolId: string;
  pinnedToolIds: readonly string[];
  onOpenTool: (toolId: string) => void;
  onUnpinTool: (toolId: string) => void;
  /** Tool IDs to animate with bounce+flash hint when no tool is active */
  hintToolIds?: readonly string[];
}

export function GlobalTopbar({ tools, activeToolId, pinnedToolIds, onOpenTool, onUnpinTool, hintToolIds = [] }: GlobalTopbarProps) {
  const [overflowOpen, setOverflowOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [ctx, setCtx] = React.useState<{ toolId: string; x: number; y: number } | null>(null);
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);

  React.useEffect(() => {
    const closeMenus = () => {
      setOverflowOpen(false);
      setCtx(null);
    };
    window.addEventListener("click", closeMenus);
    return () => window.removeEventListener("click", closeMenus);
  }, []);

  const visibleTools = React.useMemo(() => tools.filter((t) => !t.hidden), [tools]);

  const pinnedTools = React.useMemo(() => {
    const pinned = visibleTools.filter((t) => pinnedToolIds.includes(t.id));
    const activePinned = pinned.find((t) => t.id === activeToolId);
    if (activePinned) return pinned;
    const activeTool = visibleTools.find((t) => t.id === activeToolId);
    return activeTool ? [...pinned, activeTool] : pinned;
  }, [visibleTools, pinnedToolIds, activeToolId]);

  const overflowTools = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return visibleTools
      .filter((t) => !pinnedToolIds.includes(t.id))
      .filter((t) => (q ? t.title.toLowerCase().includes(q) : true));
  }, [visibleTools, pinnedToolIds, query]);

  const otherToolsCount = React.useMemo(
    () => visibleTools.filter((t) => !pinnedToolIds.includes(t.id)).length,
    [visibleTools, pinnedToolIds]
  );

  return (
    <div className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-center gap-1">

        <div className="flex items-center justify-center gap-1 flex-wrap">
          {pinnedTools.map((tool, idx) => {
            const isActive = tool.id === activeToolId;
            const isPinned = pinnedToolIds.includes(tool.id);
            const isHint = !isActive && hintToolIds.includes(tool.id);
            return (
              <button
                key={tool.id}
                ref={(el) => { refs.current[idx] = el; }}
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                className={[
                  "max-w-[240px] rounded-lg border font-medium truncate transition-all duration-150",
                  isActive
                    ? "px-5 py-2 text-sm bg-amber-400 text-amber-950 border-amber-500 shadow-sm scale-105 dark:bg-amber-500 dark:text-amber-950 dark:border-amber-600"
                    : isHint
                    ? "hdb-hint-tool px-4 py-1.5 text-xs text-slate-700 border-slate-200 bg-slate-50 dark:text-slate-300 dark:border-slate-700 dark:bg-slate-800"
                    : "px-4 py-1.5 text-xs text-slate-700 border-slate-200 bg-slate-50 hover:bg-slate-100 hover:scale-110 hover:text-slate-900 dark:text-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:hover:text-slate-100",
                ].join(" ")}
                onClick={() => onOpenTool(tool.id)}
                onContextMenu={(e) => {
                  if (!isPinned) return;
                  e.preventDefault();
                  setCtx({ toolId: tool.id, x: e.clientX, y: e.clientY });
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight") {
                    e.preventDefault();
                    refs.current[(idx + 1) % pinnedTools.length]?.focus();
                  }
                  if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    refs.current[(idx - 1 + pinnedTools.length) % pinnedTools.length]?.focus();
                  }
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenTool(tool.id);
                  }
                  if (e.key === "F10" && e.shiftKey && isPinned) {
                    e.preventDefault();
                    const rect = refs.current[idx]?.getBoundingClientRect();
                    if (!rect) return;
                    setCtx({ toolId: tool.id, x: rect.left, y: rect.bottom + 6 });
                  }
                }}
              >
                {tool.title}
              </button>
            );
          })}
        </div>

        {otherToolsCount > 0 && (
          <div className="relative shrink-0 ml-2">
            <button
              type="button"
              className="btn btn-ghost h-8 px-3 text-xs"
              aria-haspopup="menu"
              aria-expanded={overflowOpen}
              aria-label={`${otherToolsCount} other tools`}
              onClick={(e) => {
                e.stopPropagation();
                setOverflowOpen((v) => !v);
              }}
            >
              +{otherToolsCount} more
            </button>
            {overflowOpen ? (
              <div
                className="absolute right-0 top-10 z-40 w-72 rounded-md border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  className="input mb-2 w-full"
                  placeholder="Find tools..."
                  value={query}
                  onChange={(e) => setQuery(e.currentTarget.value)}
                />
                <div className="max-h-72 overflow-auto">
                  {overflowTools.length ? (
                    overflowTools.map((tool) => (
                      <button
                        key={tool.id}
                        type="button"
                        className="w-full rounded px-2 py-2 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                        onClick={() => {
                          onOpenTool(tool.id);
                          setOverflowOpen(false);
                        }}
                      >
                        {tool.title}
                      </button>
                    ))
                  ) : (
                    <div className="px-2 py-2 text-xs text-slate-500">No tools.</div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {ctx ? (
        <div
          className="fixed z-50 min-w-[140px] rounded border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          style={{ left: ctx.x, top: ctx.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={() => {
              onUnpinTool(ctx.toolId);
              setCtx(null);
            }}
          >
            Unpin
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default GlobalTopbar;
