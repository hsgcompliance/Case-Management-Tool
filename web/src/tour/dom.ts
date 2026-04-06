//src/features/tutorial/dom.ts
// Safe DOM selector utilities (no-throw, no global crashes)

export function isValidSelector(sel?: string | null): boolean {
  if (!sel || !sel.trim()) return false;
  try {
    // Detached root => zero layout/reflow side-effects
    const frag = document.createDocumentFragment() as unknown as ParentNode;
    frag.querySelector(sel);
    return true;
  } catch {
    return false;
  }
}

export function qsSafe<T extends Element = HTMLElement>(
  sel?: string | null,
  root: ParentNode = document
): T | null {
  if (!sel || !sel.trim()) return null;
  try {
    return (root.querySelector(sel) as T) ?? null;
  } catch {
    return null;
  }
}

export function qsaSafe<T extends Element = HTMLElement>(
  sel?: string | null,
  root: ParentNode = document
): NodeListOf<T> {
  try {
    return (sel && sel.trim()
      ? (root.querySelectorAll(sel) as NodeListOf<T>)
      : (document.querySelectorAll(":not(*)") as NodeListOf<T>));
  } catch {
    return document.querySelectorAll(":not(*)") as NodeListOf<T>;
  }
}

export function selectorStatus(sel?: string | null) {
  if (!sel || !sel.trim()) return { valid: false, reason: "empty", count: 0 };
  if (!isValidSelector(sel))   return { valid: false, reason: "invalid", count: 0 };
  const count = qsaSafe(sel).length;
  if (count === 0)             return { valid: true,  reason: "nomatch", count: 0 };
  return                         { valid: true,  reason: "ok",      count };
}
