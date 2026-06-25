// Compare a submitted name against the active customer name. Tolerant of middle
// names, order, punctuation, and "Last, First" — submissions are messy.

export type NameMatch = "exact" | "partial" | "none";

function tokens(s: string): string[] {
  return String(s || "")
    .toLowerCase()
    .replace(/,/g, " ")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

export function matchName(submitted: string, customer: string): NameMatch {
  const a = tokens(submitted);
  const b = tokens(customer);
  if (!a.length || !b.length) return "none";

  const norm = (t: string[]) => [...t].sort().join(" ");
  if (norm(a) === norm(b)) return "exact";

  const setB = new Set(b);
  const overlap = a.filter((t) => setB.has(t));
  // Two shared tokens (e.g. first + last) = strong; one shared when a side is a
  // single token = weak partial.
  if (overlap.length >= 2) return "partial";
  if (overlap.length >= 1 && (a.length === 1 || b.length === 1)) return "partial";
  return "none";
}
