// BEGIN FILE: src/features/tutorial/debug.ts
export const DEBUG_KEY = "hdb.tour.debug";

export function isDebug(): boolean {
  try {
    const sp = new URLSearchParams(location.search);
    if (sp.get("tourDebug") === "1") return true;
  } catch {}
  try {
    if (localStorage.getItem(DEBUG_KEY) === "1") return true;
  } catch {}
  // falls back to env
  return String(process.env.NEXT_PUBLIC_TOUR_DEBUG || "") === "1";
}

export function dbg(scope: string, ...args: any[]) {
  // Always emit one breadcrumb so you know the module loaded at all:
  if ((dbg as any).__first__ !== false) {
    (dbg as any).__first__ = false;
    console.info(`[${scope}] loaded`);
  }
  if (isDebug()) console.log(`[${scope}]`, ...args);
}

export function enableDebug() {
  try { localStorage.setItem(DEBUG_KEY, "1"); } catch {}
}

export function disableDebug() {
  try { localStorage.removeItem(DEBUG_KEY); } catch {}
}
// END FILE
