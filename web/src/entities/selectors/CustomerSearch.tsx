"use client";

import React from "react";
import { useCustomers } from "@hooks/useCustomers";

/* ============================================================================
   CustomerSearch
   Autocomplete input that searches customers by name or CWID.
   Returns { id, name, cwid? } via onChange.
============================================================================ */

export type CustomerSearchResult = {
  id: string;
  name: string;
  cwid?: string;
};

type Props = {
  /** Controlled: the currently-selected customer ID (or null/undefined for none). */
  value?: string | null;
  onChange: (result: CustomerSearchResult | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Maximum results to show in dropdown (default 10). */
  maxResults?: number;
};

function fullName(c: any): string {
  const first = String(c?.firstName || "").trim();
  const last = String(c?.lastName || "").trim();
  return `${first} ${last}`.trim() || String(c?.name || c?.displayName || c?.id || "");
}

export default function CustomerSearch({
  value,
  onChange,
  placeholder = "Search by name or CWID…",
  className = "",
  disabled = false,
  maxResults = 10,
}: Props) {
  const { data: customers = [], isLoading } = useCustomers(
    { active: "all", deleted: "exclude", limit: 2000 },
    { staleTime: 120_000 }
  );

  // The text currently shown in the input
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [activeIdx, setActiveIdx] = React.useState(0);

  const containerRef = React.useRef<HTMLDivElement>(null);

  // When `value` changes externally, sync the input text to the customer name
  React.useEffect(() => {
    if (!value) {
      // Don't clear if user is actively typing
      return;
    }
    const match = (customers as any[]).find((c: any) => c?.id === value);
    if (match) setQuery(fullName(match));
  }, [value, customers]);

  // Filtered list of matching customers
  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    return (customers as any[])
      .filter((c: any) => {
        if (!c?.id) return false;
        const name = fullName(c).toLowerCase();
        const cwid = String((c as any).cwid || "").toLowerCase();
        return name.includes(q) || (cwid && cwid.includes(q));
      })
      .slice(0, maxResults);
  }, [customers, query, maxResults]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function selectResult(c: any) {
    const name = fullName(c);
    setQuery(name);
    setOpen(false);
    onChange({ id: String(c.id), name, cwid: (c as any).cwid ?? undefined });
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    setActiveIdx(0);
    setOpen(v.trim().length > 0);
    if (!v.trim()) {
      onChange(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const c = results[activeIdx];
      if (c) selectResult(c);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function handleClear() {
    setQuery("");
    setOpen(false);
    onChange(null);
  }

  const inputCls = [
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm",
    "focus:outline-none focus:ring-2 focus:ring-slate-300",
    value ? "pr-8" : "",
    disabled ? "opacity-50 cursor-not-allowed" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        type="text"
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (query.trim()) setOpen(true); }}
        placeholder={isLoading ? "Loading customers…" : placeholder}
        disabled={disabled || isLoading}
        className={inputCls}
        autoComplete="off"
        spellCheck={false}
      />

      {/* Clear button — shown when a value is selected */}
      {(value || query) && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          tabIndex={-1}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs px-1"
          aria-label="Clear selection"
        >
          ✕
        </button>
      )}

      {/* Dropdown results */}
      {open && results.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg max-h-60 overflow-y-auto py-1"
        >
          {results.map((c: any, idx: number) => {
            const name = fullName(c);
            const cwid = String((c as any).cwid || "");
            const isActive = idx === activeIdx;
            return (
              <li
                key={String(c.id)}
                role="option"
                aria-selected={isActive}
                onPointerDown={(e) => {
                  e.preventDefault(); // keep focus on input
                  selectResult(c);
                }}
                onMouseEnter={() => setActiveIdx(idx)}
                className={[
                  "flex items-center justify-between px-3 py-2 text-sm cursor-pointer select-none",
                  isActive ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-50",
                ].join(" ")}
              >
                <span className="truncate">{name}</span>
                {cwid && (
                  <span className="ml-2 shrink-0 text-xs text-slate-400 font-mono">{cwid}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* No results hint */}
      {open && query.trim().length > 0 && results.length === 0 && !isLoading && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg px-3 py-2 text-sm text-slate-400">
          No customers match "{query}"
        </div>
      )}
    </div>
  );
}
