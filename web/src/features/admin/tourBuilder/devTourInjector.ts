// src/features/tutorial/admin/devInjector.ts
/**
 * DEV-ONLY helper to tag DOM nodes with [data-tour] for easier selector building.
 * - No auto-install, no observers unless you explicitly call installDevTourInjector().
 * - No legacy key writers. (Still reads once for compatibility.)
 */

type MapItem = { id: string; sel: string };
const LS_KEY = "hdb.tour.inj.map";
const LS_PREFIX_LEGACY = "tour-hook:"; // read-only compat
const isDev = process.env.NODE_ENV !== "production";

const BOOTSTRAP_MAP: MapItem[] = []; // optional starter entries

function readLegacyOnce(): MapItem[] {
  const out: MapItem[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (!k.startsWith(LS_PREFIX_LEGACY)) continue;
      const id = k.slice(LS_PREFIX_LEGACY.length);
      const sel = localStorage.getItem(k) || "";
      if (sel) out.push({ id, sel });
    }
  } catch {}
  return out;
}

function readLS(): MapItem[] {
  try { const raw = localStorage.getItem(LS_KEY); const arr: MapItem[] = raw ? JSON.parse(raw) : []; return Array.isArray(arr) ? arr.filter(x => x && x.id && x.sel) : []; }
  catch { return []; }
}
function writeLS(items: MapItem[]) { localStorage.setItem(LS_KEY, JSON.stringify(dedupe(items))); }
function dedupe(items: MapItem[]) { const seen = new Set<string>(); const out: MapItem[] = []; for (const m of items) { const k = `${m.id}@@${m.sel}`; if (!seen.has(k)) { seen.add(k); out.push(m); } } return out; }
function currentMap(extra: MapItem[] = []): MapItem[] { return dedupe([...BOOTSTRAP_MAP, ...readLS(), ...readLegacyOnce(), ...extra]); }

function applyMapToDOM(map: MapItem[], root: ParentNode = document) {
  for (const { sel, id } of map) {
    let list: NodeListOf<Element>;
    try { list = root.querySelectorAll(sel); } catch { continue; }
    list.forEach(el => { const ht = el as HTMLElement; if (!ht.dataset.tour) ht.dataset.tour = id; });
  }
}

// build a decent unique selector for an element
const utilityClass = /^(m[trblxy]?|p[trblxy]?|gap|grid|flex|items|justify|text|bg|rounded|border|shadow|w-|h-)/;
function CSS_escape(s: string) { return s.replace(/([ !"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, "\\$1"); }
function shortSeg(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.getAttribute("id");
  if (id && !/react-|generated|__/.test(id)) return `#${CSS_escape(id)}`;
  const dt = (el as HTMLElement).dataset.tour; if (dt) return `[data-tour="${dt}"]`;
  const name = el.getAttribute("name"); if (name) return `${tag}[name="${name}"]`;
  const role = el.getAttribute("role"); if (role) return `${tag}[role="${role}"]`;
  const classes = (el.getAttribute("class") || "").split(/\s+/).filter(c => c && !utilityClass.test(c)).slice(0, 2);
  if (classes.length) return `${tag}.${classes.map(CSS_escape).join(".")}`;
  return tag;
}
function uniqueSelector(el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el; let hops = 0;
  while (cur && hops < 5) {
    const seg = shortSeg(cur); parts.unshift(seg);
    const sel = parts.join(" > ");
    try { const matches = document.querySelectorAll(sel); if (matches.length === 1 && matches[0] === el) return sel; } catch {}
    if ((cur as HTMLElement).dataset.tour || (cur as HTMLElement).id) return sel;
    cur = cur.parentElement; hops++;
  }
  const parent = el.parentElement;
  if (parent) {
    const seg = shortSeg(el);
    const index = Array.from(parent.children).indexOf(el) + 1;
    return `${shortSeg(parent)} > ${seg}:nth-child(${index})`;
  }
  return shortSeg(el);
}

// Track last hovered (only when installed)
let lastHover: Element | null = null;
function attachHoverTracker() {
  const onMove = (e: MouseEvent) => { lastHover = e.target as Element; };
  window.addEventListener("mousemove", onMove, { passive: true });
  return () => window.removeEventListener("mousemove", onMove);
}

// Public API: install/uninstall (DEV only)
export function installDevTourInjector(extra?: MapItem[]) {
  if (!isDev) return () => {};
  applyMapToDOM(currentMap(extra)); // one-time apply

  const obs = new MutationObserver(() => { applyMapToDOM(currentMap(extra)); });
  obs.observe(document.documentElement, { childList: true, subtree: true });

  const detachHover = attachHoverTracker();

  (window as any).__tourInj = {
    add(id: string, sel: string) { const next = currentMap([{ id, sel }]); writeLS(next); applyMapToDOM(next); return next; },
    list(): MapItem[] { return currentMap(); },
    clear() { localStorage.removeItem(LS_KEY); applyMapToDOM(currentMap([])); },
    pick(id: string, build?: (el: Element) => string) {
      if (!lastHover) throw new Error("Hover an element, then call __tourInj.pick('id').");
      const sel = (build ? build(lastHover) : uniqueSelector(lastHover));
      const next = currentMap([{ id, sel }]); writeLS(next); applyMapToDOM(next);
      console.info(`[tour] mapped ${id} -> ${sel}`); return sel;
    },
  };

  return () => { obs.disconnect(); detachHover(); delete (window as any).__tourInj; };
}

declare global {
  interface Window {
    __tourInj?: {
      add(id: string, sel: string): MapItem[];
      list(): MapItem[];
      clear(): void;
      pick(id: string, build?: (el: Element) => string): string;
    };
  }
}
