// web/src/hooks/useTableSort.ts
import React from "react";

export type SortDir = "asc" | "desc";
export type SortState = { col: string; dir: SortDir; part?: string } | null;
export type TableColumnPart = { id: string; label: string };
export type TableColumnFilterState = {
  part: string;
  selectedValues: string[];
};
export type TableColumnFilters = Record<string, TableColumnFilterState | undefined>;

const DEFAULT_PART = "header";

export function useTableSort() {
  const [sort, setSort] = React.useState<SortState>(null);
  const onSort = (col: string, defaultDir: SortDir = "asc", part = DEFAULT_PART) => {
    setSort((prev) =>
      prev?.col === col && (prev.part || DEFAULT_PART) === part
        ? { col, dir: prev.dir === "asc" ? "desc" : "asc", part }
        : { col, dir: defaultDir, part }
    );
  };
  const setSortDir = (col: string, dir: SortDir, part = DEFAULT_PART) => setSort({ col, dir, part });
  return { sort, onSort, setSortDir };
}

export function useTableColumnFilters(initial: TableColumnFilters = {}) {
  const [filters, setFilters] = React.useState<TableColumnFilters>(initial);
  const setColumnFilter = React.useCallback((col: string, next: TableColumnFilterState | undefined) => {
    setFilters((prev) => {
      const copy = { ...prev };
      if (!next) {
        delete copy[col];
      } else {
        copy[col] = next;
      }
      return copy;
    });
  }, []);
  const clearColumnFilter = React.useCallback((col: string) => {
    setFilters((prev) => {
      const copy = { ...prev };
      delete copy[col];
      return copy;
    });
  }, []);
  const clearFilters = React.useCallback(() => setFilters({}), []);
  return { filters, setColumnFilter, clearColumnFilter, clearFilters };
}

function normalizeFilterValue(value: string | number | null | undefined) {
  const raw = value == null ? "" : String(value).trim();
  return raw || "(Blank)";
}

function uniqueSortedValues(values: Array<string | number | null | undefined>) {
  return Array.from(new Set(values.map(normalizeFilterValue))).sort((a, b) => a.localeCompare(b));
}

export function SortableHeader({
  label,
  col,
  sort,
  onSort,
  defaultDir = "asc",
  align,
}: {
  label: React.ReactNode;
  col: string;
  sort: SortState;
  onSort: (col: string, defaultDir?: SortDir, part?: string) => void;
  defaultDir?: SortDir;
  align?: "right";
}) {
  const active = sort?.col === col;
  const dir = active ? sort!.dir : null;
  return (
    <button
      type="button"
      onClick={() => onSort(col, defaultDir)}
      className={[
        "group inline-flex items-center gap-1 select-none whitespace-nowrap",
        align === "right" ? "w-full justify-end" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span>{label}</span>
      <span
        className={`text-[10px] ${
          active ? "text-slate-600" : "text-slate-300 group-hover:text-slate-400"
        }`}
      >
        {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </button>
  );
}

export function SmartFilterHeader({
  label,
  col,
  sort,
  onSort,
  setSortDir,
  defaultDir = "asc",
  align,
  parts,
  filter,
  onFilterChange,
  values,
}: {
  label: React.ReactNode;
  col: string;
  sort: SortState;
  onSort: (col: string, defaultDir?: SortDir, part?: string) => void;
  setSortDir: (col: string, dir: SortDir, part?: string) => void;
  defaultDir?: SortDir;
  align?: "right";
  parts?: TableColumnPart[];
  filter?: TableColumnFilterState;
  onFilterChange: (next: TableColumnFilterState | undefined) => void;
  values: (part: string) => Array<string | number | null | undefined>;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const availableParts = parts?.length ? parts : [{ id: DEFAULT_PART, label: "Header" }];
  const [selectedPart, setSelectedPart] = React.useState(availableParts[0]?.id || DEFAULT_PART);
  const activePart = filter?.part || selectedPart;
  const active = sort?.col === col && (sort.part || DEFAULT_PART) === activePart;
  const dir = active ? sort!.dir : null;
  const selected = React.useMemo(() => new Set(filter?.selectedValues || []), [filter?.selectedValues]);
  const allValues = React.useMemo(() => uniqueSortedValues(values(activePart)), [activePart, values]);
  const visibleValues = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? allValues.filter((value) => value.toLowerCase().includes(needle)) : allValues;
  }, [allValues, query]);
  const hasFilter = !!filter;

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const commitSelected = (nextSelected: Set<string>, part = activePart) => {
    onFilterChange({ part, selectedValues: Array.from(nextSelected) });
  };

  const setPart = (part: string) => {
    setQuery("");
    setSelectedPart(part);
    onFilterChange(undefined);
  };

  return (
    <div ref={rootRef} className={["relative inline-flex w-full", align === "right" ? "justify-end" : ""].join(" ")}>
      <button
        type="button"
        onClick={() => onSort(col, defaultDir, activePart)}
        className={["group inline-flex min-w-0 items-center gap-1 whitespace-nowrap", align === "right" ? "justify-end" : ""].join(" ")}
      >
        <span className="truncate">{label}</span>
        <span className={active ? "text-[10px] text-slate-700" : "text-[10px] text-slate-300 group-hover:text-slate-400"}>
          {active ? (dir === "asc" ? "A-Z" : "Z-A") : "Sort"}
        </span>
      </button>
      <button
        type="button"
        className={["ml-1 rounded px-1 text-[10px] hover:bg-slate-100", hasFilter ? "text-sky-700" : "text-slate-400"].join(" ")}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Filter column"
      >
        Filter
      </button>

      {open ? (
        <div className={["absolute z-30 mt-6 w-[280px] rounded-lg border border-slate-200 bg-white p-3 text-left shadow-lg", align === "right" ? "right-0" : "left-0"].join(" ")}>
          <div className="space-y-2">
            <div className="flex gap-2">
              <button type="button" className="btn btn-xs btn-ghost flex-1" onClick={() => setSortDir(col, "asc", activePart)}>
                Sort A-Z
              </button>
              <button type="button" className="btn btn-xs btn-ghost flex-1" onClick={() => setSortDir(col, "desc", activePart)}>
                Sort Z-A
              </button>
            </div>

            {availableParts.length > 1 ? (
              <select className="input input-sm w-full" value={activePart} onChange={(event) => setPart(event.currentTarget.value)}>
                {availableParts.map((part) => (
                  <option key={part.id} value={part.id}>{part.label}</option>
                ))}
              </select>
            ) : null}

            <input
              type="search"
              className="input input-sm w-full"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Search values"
            />

            <div className="flex items-center justify-between text-[11px]">
              <button type="button" className="text-slate-500 hover:text-slate-800" onClick={() => commitSelected(new Set(allValues))}>
                Select all
              </button>
              <button type="button" className="text-slate-500 hover:text-slate-800" onClick={() => onFilterChange(undefined)}>
                Clear
              </button>
            </div>

            <div className="max-h-52 space-y-1 overflow-auto rounded border border-slate-100 p-1">
              {visibleValues.length ? visibleValues.map((value) => {
                const checked = !hasFilter || selected.has(value);
                return (
                  <label key={value} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-xs"
                      checked={checked}
                      onChange={(event) => {
                        const next = new Set(hasFilter ? selected : allValues);
                        if (event.currentTarget.checked) next.add(value);
                        else next.delete(value);
                        commitSelected(next);
                      }}
                    />
                    <span className="truncate">{value}</span>
                  </label>
                );
              }) : (
                <div className="px-2 py-3 text-center text-xs text-slate-400">No values</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function sortRows<T>(
  rows: T[],
  sort: SortState,
  getValue: (row: T, col: string, part?: string) => string | number | null | undefined
): T[] {
  if (!sort) return rows;
  const { col, dir, part } = sort;
  return [...rows].sort((a, b) => {
    const av = getValue(a, col, part || DEFAULT_PART);
    const bv = getValue(b, col, part || DEFAULT_PART);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") {
      return dir === "asc" ? av - bv : bv - av;
    }
    const as = String(av);
    const bs = String(bv);
    return dir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
  });
}

export function filterRows<T>(
  rows: T[],
  filters: TableColumnFilters,
  getValue: (row: T, col: string, part?: string) => string | number | null | undefined,
): T[] {
  const active = Object.entries(filters).filter(([, filter]) => !!filter);
  if (!active.length) return rows;
  return rows.filter((row) =>
    active.every(([col, filter]) => {
      if (!filter) return true;
      const value = normalizeFilterValue(getValue(row, col, filter.part || DEFAULT_PART));
      return filter.selectedValues.includes(value);
    })
  );
}
