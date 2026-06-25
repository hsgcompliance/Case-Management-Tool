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
