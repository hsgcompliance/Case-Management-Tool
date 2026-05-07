import React from "react";

export type ComplexDateMode = "month" | "before" | "after" | "between";

export type ComplexDateValue = {
  mode: ComplexDateMode;
  month?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
};

type ComplexDateSelectorProps = {
  value?: ComplexDateValue | null;
  onChange: (next: ComplexDateValue) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
};

const MODE_LABELS: Record<ComplexDateMode, string> = {
  month: "Month =",
  before: "Date before",
  after: "Date after",
  between: "Date between",
};

const VALID_MODES = new Set<ComplexDateMode>(["month", "before", "after", "between"]);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH_RE = /^\d{4}-\d{2}$/;

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && ISO_DATE_RE.test(value);
}

function isIsoMonth(value: unknown): value is string {
  return typeof value === "string" && ISO_MONTH_RE.test(value);
}

function monthFromToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function sanitizeMode(value: unknown): ComplexDateMode {
  return VALID_MODES.has(value as ComplexDateMode) ? (value as ComplexDateMode) : "month";
}

export function normalizeComplexDateValue(
  value?: Partial<ComplexDateValue> | null,
  fallbackMonth = "",
): ComplexDateValue {
  const mode = sanitizeMode(value?.mode);
  if (mode === "month") {
    return {
      mode,
      month: isIsoMonth(value?.month) ? value.month : isIsoMonth(fallbackMonth) ? fallbackMonth : monthFromToday(),
    };
  }
  if (mode === "before" || mode === "after") {
    return { mode, date: isIsoDate(value?.date) ? value.date : "" };
  }
  return {
    mode,
    startDate: isIsoDate(value?.startDate) ? value.startDate : "",
    endDate: isIsoDate(value?.endDate) ? value.endDate : "",
  };
}

export function complexDatePrimaryMonth(value?: Partial<ComplexDateValue> | null) {
  const next = normalizeComplexDateValue(value);
  return next.mode === "month" ? next.month || "" : "";
}

export function complexDateMatchesIsoDate(value: Partial<ComplexDateValue> | null | undefined, isoDate: string) {
  if (!isIsoDate(isoDate)) return false;
  const next = normalizeComplexDateValue(value);
  if (next.mode === "month") return !!next.month && isoDate.slice(0, 7) === next.month;
  if ((next.mode === "before" || next.mode === "after") && !next.date) return true;
  if (next.mode === "before") return isoDate <= String(next.date);
  if (next.mode === "after") return isoDate >= String(next.date);

  const start = next.startDate || "";
  const end = next.endDate || "";
  if (!start && !end) return true;
  if (start && end) {
    const min = start <= end ? start : end;
    const max = start <= end ? end : start;
    return isoDate >= min && isoDate <= max;
  }
  return start ? isoDate >= start : isoDate <= end;
}

export function complexDateValueLabel(value?: Partial<ComplexDateValue> | null) {
  const next = normalizeComplexDateValue(value);
  if (next.mode === "month") return next.month ? `Month = ${next.month}` : "All dates";
  if (next.mode === "before") return next.date ? `Date before ${next.date}` : "Date before";
  if (next.mode === "after") return next.date ? `Date after ${next.date}` : "Date after";
  if (next.startDate && next.endDate) return `Date between ${next.startDate} and ${next.endDate}`;
  if (next.startDate) return `Date after ${next.startDate}`;
  if (next.endDate) return `Date before ${next.endDate}`;
  return "Date between";
}

export function ComplexDateSelector({
  value,
  onChange,
  label = "Date",
  className = "",
  disabled = false,
}: ComplexDateSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const normalized = normalizeComplexDateValue(value);

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

  const setMode = (mode: ComplexDateMode) => {
    if (mode === normalized.mode) return;
    const carriedDate = normalized.date || normalized.startDate || normalized.endDate || "";
    if (mode === "month") {
      onChange({ mode, month: normalized.month || monthFromToday() });
    } else if (mode === "between") {
      onChange({ mode, startDate: carriedDate, endDate: carriedDate });
    } else {
      onChange({ mode, date: carriedDate });
    }
  };

  return (
    <div ref={rootRef} className={["relative", className].filter(Boolean).join(" ")}>
      <button
        type="button"
        className="btn btn-sm btn-ghost min-w-[170px] justify-between border border-slate-200 bg-white text-left text-slate-700 hover:border-slate-300"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="truncate">{label}: {complexDateValueLabel(normalized)}</span>
        <span className="ml-2 text-slate-400">{open ? "^" : "v"}</span>
      </button>

      {open ? (
        <div className="absolute left-0 z-30 mt-1 w-[290px] rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          <div className="space-y-2">
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Date filter
            </label>
            <select
              className="input input-sm w-full"
              value={normalized.mode}
              onChange={(event) => setMode(event.currentTarget.value as ComplexDateMode)}
            >
              <option value="month">{MODE_LABELS.month}</option>
              <option value="before">{MODE_LABELS.before}</option>
              <option value="after">{MODE_LABELS.after}</option>
              <option value="between">{MODE_LABELS.between}</option>
            </select>

            {normalized.mode === "month" ? (
              <input
                type="month"
                className="input input-sm w-full"
                value={normalized.month || ""}
                onChange={(event) => onChange({ mode: "month", month: event.currentTarget.value })}
              />
            ) : null}

            {normalized.mode === "before" || normalized.mode === "after" ? (
              <input
                type="date"
                className="input input-sm w-full"
                value={normalized.date || ""}
                onChange={(event) => onChange({ mode: normalized.mode, date: event.currentTarget.value })}
              />
            ) : null}

            {normalized.mode === "between" ? (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  className="input input-sm w-full"
                  value={normalized.startDate || ""}
                  onChange={(event) => onChange({ ...normalized, startDate: event.currentTarget.value })}
                  aria-label="Start date"
                />
                <input
                  type="date"
                  className="input input-sm w-full"
                  value={normalized.endDate || ""}
                  onChange={(event) => onChange({ ...normalized, endDate: event.currentTarget.value })}
                  aria-label="End date"
                />
              </div>
            ) : null}

            <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
              <span>Dates are inclusive.</span>
              <button type="button" className="btn btn-xs btn-ghost" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
