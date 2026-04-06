export type SelectorOpts = {
  /** If provided, try to express selector relative to this root. E.g. "main" or "[data-app-shell='1']" */
  root?: string;
  /** Max depth to walk up the DOM when building a path */
  maxDepth?: number;
};

export function cssSelectorFor(el: Element, opts: SelectorOpts = {}): string {
  if (!(el instanceof Element)) return "";
  const prefer = ["data-tour", "data-testid", "data-qa", "data-cy", "data-name"];

  // If inside a known root, we’ll produce a shorter relative selector
  const rootEl = opts.root ? document.querySelector(opts.root) : null;
  const withinRoot = rootEl && rootEl.contains(el);

  // direct attributes (strongest)
  for (const attr of prefer) {
    const v = el.getAttribute(attr);
    if (v) return withinRoot ? `${opts.root} [${attr}="${cssEscape(v)}"]` : `[${attr}="${cssEscape(v)}"]`;
  }

  // safe ID
  if (el.id && isValidId(el.id)) {
    const idSel = `#${cssEscape(el.id)}`;
    return withinRoot ? `${opts.root} ${idSel}` : idSel;
  }

  // role/name
  const role = el.getAttribute("role");
  const name = (el as HTMLElement).getAttribute("aria-label") || el.getAttribute("name");
  if (role && name) {
    const base = `${el.tagName.toLowerCase()}[role="${cssEscape(role)}"][aria-label="${cssEscape(name)}"]`;
    return withinRoot ? `${opts.root} ${base}` : base;
  }
  if (role) {
    const base = `${el.tagName.toLowerCase()}[role="${cssEscape(role)}"]`;
    return withinRoot ? `${opts.root} ${base}` : base;
  }

  // walk up with nth-of-type (bounded)
  const parts: string[] = [];
  let cur: Element | null = el;
  let depth = 0;
  const maxDepth = Math.max(1, Math.min(8, opts.maxDepth ?? 5));

  while (cur && depth < maxDepth) {
    if (withinRoot && cur === rootEl) break;

    let part = cur.tagName.toLowerCase();

    const id = cur.getAttribute("id");
    if (id && isValidId(id)) {
      part = `#${cssEscape(id)}`;
      parts.unshift(part);
      break;
    }

    // prefer data-* anywhere in the chain
    let usedAttr = false;
    for (const attr of prefer) {
      const v = cur.getAttribute(attr);
      if (v) { part = `${part}[${attr}="${cssEscape(v)}"]`; usedAttr = true; break; }
    }

    const parentEl: HTMLElement | null = cur.parentElement;
    if (!parentEl) { parts.unshift(part); break; }

    // add :nth-of-type only if needed (multiple siblings of same tag)
    if (!usedAttr) {
      const siblings = Array.from(parentEl.children).filter(c => c.tagName === cur!.tagName);
      if (siblings.length > 1) {
        const idx = siblings.indexOf(cur) + 1;
        part += `:nth-of-type(${idx})`;
      }
    }

    parts.unshift(part);
    cur = parentEl;
    depth++;
  }

  const base = parts.join(" > ");
  if (withinRoot) return `${opts.root} ${base}`;
  return base;
}

function cssEscape(s: string) {
  return s.replace(/["\\]/g, "\\$&");
}

function isValidId(id: string) {
  return !/^\d|[^A-Za-z0-9\-_:.]/.test(id);
}
