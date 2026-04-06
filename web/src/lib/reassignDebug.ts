const REASSIGN_DEBUG_KEY = "hdb:debug:reassign";

function inBrowser() {
  return typeof window !== "undefined";
}

export function isReassignDebugEnabled(): boolean {
  if (!inBrowser()) return false;
  try {
    const raw = window.localStorage.getItem(REASSIGN_DEBUG_KEY);
    if (raw && ["1", "true", "yes", "on"].includes(raw.toLowerCase())) return true;
    const global = window.localStorage.getItem("hdb:debug:rq");
    if (global && ["1", "true", "yes", "on"].includes(global.toLowerCase())) return true;
  } catch {}
  try {
    const qp = new URLSearchParams(window.location.search);
    const flag = qp.get("debugReassign");
    if (flag && ["1", "true", "yes", "on"].includes(flag.toLowerCase())) return true;
    const global = qp.get("debugRQ") || qp.get("debugHooks");
    if (global && ["1", "true", "yes", "on"].includes(global.toLowerCase())) return true;
  } catch {}
  return false;
}

export function setReassignDebugEnabled(enabled: boolean) {
  if (!inBrowser()) return;
  try {
    if (enabled) window.localStorage.setItem(REASSIGN_DEBUG_KEY, "1");
    else window.localStorage.removeItem(REASSIGN_DEBUG_KEY);
  } catch {}
}

export function reassignDebugLog(scope: string, event: string, payload?: unknown) {
  const stamp = new Date().toISOString();
  const isErrorEvent = event.includes(":error") || event.includes("error");
  if (!isReassignDebugEnabled() && !isErrorEvent) return;
  const logger = isErrorEvent ? console.error : console.log;
  if (payload === undefined) {
    logger(`[reassign-debug ${stamp}] [${scope}] ${event}`);
    return;
  }
  logger(`[reassign-debug ${stamp}] [${scope}] ${event}`, payload);
}

if (inBrowser()) {
  try {
    (window as any).__hdbReassignDebug = {
      enable: () => setReassignDebugEnabled(true),
      disable: () => setReassignDebugEnabled(false),
      isEnabled: () => isReassignDebugEnabled(),
    };
  } catch {}
}
