"use client";

import React from "react";

/* ============================================================================
   MultiSelectField
   Generic, presentational multi-select: search-to-filter input + scrollable
   checkbox list + removable chips for the current selection. No data
   fetching — callers pass `options` (already-loaded data, e.g. dashboard
   cache arrays) so this never triggers its own network requests.
============================================================================ */

export type MultiSelectOption = {
  value: string;
  label: string;
  hint?: string;
};

type Props = {
  label?: string;
  value: string[];
  onChange: (next: string[]) => void;
  options: MultiSelectOption[];
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
};

export default function MultiSelectField({
  label,
  value,
  onChange,
  options,
  placeholder = "Search…",
  loading = false,
  disabled = false,
  className = "",
}: Props) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selected = React.useMemo(() => new Set(value), [value]);
  const labelByValue = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const opt of options) map.set(opt.value, opt.label);
    return map;
  }, [options]);

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(q) || opt.hint?.toLowerCase().includes(q));
  }, [options, query]);

  React.useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function toggle(optValue: string) {
    const next = new Set(value);
    if (next.has(optValue)) next.delete(optValue);
    else next.add(optValue);
    onChange(Array.from(next));
  }

  function remove(optValue: string) {
    onChange(value.filter((v) => v !== optValue));
  }

  const inputCls = [
    "input h-9 w-full px-2 py-1 text-sm leading-5",
    disabled ? "opacity-50 cursor-not-allowed" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <div ref={containerRef} className="relative text-xs">
      {label ? <span className="mb-1 block font-medium text-slate-500">{label}</span> : null}

      {value.length > 0 && (
        <div className="mb-1 flex flex-wrap gap-1">
          {value.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {labelByValue.get(v) || v}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(v)}
                  className="text-slate-400 hover:text-slate-600"
                  aria-label={`Remove ${labelByValue.get(v) || v}`}
                >
                  ✕
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        onFocus={() => !disabled && setOpen(true)}
        placeholder={loading ? "Loading…" : placeholder}
        disabled={disabled || loading}
        className={inputCls}
        autoComplete="off"
        spellCheck={false}
      />

      {open && !disabled && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-slate-400">No matches</li>
          ) : (
            results.map((opt) => {
              const isSelected = selected.has(opt.value);
              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    toggle(opt.value);
                  }}
                  className={[
                    "flex cursor-pointer select-none items-center gap-2 px-3 py-1.5 text-sm",
                    isSelected ? "bg-slate-100 dark:bg-slate-800" : "hover:bg-slate-50 dark:hover:bg-slate-800/60",
                  ].join(" ")}
                >
                  <input type="checkbox" checked={isSelected} readOnly className="pointer-events-none" />
                  <span className="truncate text-slate-700 dark:text-slate-200">{opt.label}</span>
                  {opt.hint ? <span className="ml-auto shrink-0 text-[11px] text-slate-400">{opt.hint}</span> : null}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
