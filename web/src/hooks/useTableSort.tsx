// web/src/hooks/useTableSort.ts
import React from "react";

export type SortDir = "asc" | "desc";
export type SortState = { col: string; dir: SortDir } | null;

export function useTableSort() {
  const [sort, setSort] = React.useState<SortState>(null);
  const onSort = (col: string, defaultDir: SortDir = "asc") => {
    setSort((prev) =>
      prev?.col === col
        ? { col, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { col, dir: defaultDir }
    );
  };
  return { sort, onSort };
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
  onSort: (col: string, defaultDir?: SortDir) => void;
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

export function sortRows<T>(
  rows: T[],
  sort: SortState,
  getValue: (row: T, col: string) => string | number | null | undefined
): T[] {
  if (!sort) return rows;
  const { col, dir } = sort;
  return [...rows].sort((a, b) => {
    const av = getValue(a, col);
    const bv = getValue(b, col);
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
