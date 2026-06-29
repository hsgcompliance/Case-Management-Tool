const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function centsToUsd(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(Number(cents))) return "—";
  return usd.format(Number(cents) / 100);
}

export function monthLabel(month: string | null | undefined): string {
  const m = String(month || "").slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(m)) return month ? String(month) : "—";
  const [y, mm] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mm - 1, 1));
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Public Jotform form URL for a given form id. */
export function jotformUrl(formId: string | null | undefined): string | null {
  const id = String(formId || "").trim();
  return id ? `https://form.jotform.com/${id}` : null;
}

/**
 * Display a date-of-birth tolerantly. Handles ISO `YYYY-MM-DD`; otherwise returns
 * the raw string (e.g. an already-formatted `MM/DD/YYYY`). Never throws.
 */
export function formatDob(dob: string | null | undefined): string {
  const s = String(dob || "").trim();
  if (!s) return "—";
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) {
    const [, y, m, d] = iso;
    const dt = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    if (!Number.isNaN(dt.getTime())) {
      return dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
    }
  }
  return s;
}
