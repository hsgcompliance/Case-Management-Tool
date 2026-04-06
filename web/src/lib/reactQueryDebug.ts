import type { QueryClient } from "@tanstack/react-query";
import { stableStringify } from "@lib/stable";

const RQ_DEBUG_KEY = "hdb:debug:rq";
const RQ_DEBUG_FILTER_KEY = "hdb:debug:rq:filter";

function inBrowser() {
  return typeof window !== "undefined";
}

function parseBool(v: string | null | undefined): boolean {
  if (!v) return false;
  return ["1", "true", "yes", "on"].includes(String(v).toLowerCase());
}

function nowStamp() {
  return new Date().toISOString();
}

function readFilter(): string {
  if (!inBrowser()) return "";
  try {
    return String(window.localStorage.getItem(RQ_DEBUG_FILTER_KEY) || "").trim().toLowerCase();
  } catch {
    return "";
  }
}

function writeFilter(v: string) {
  if (!inBrowser()) return;
  try {
    const next = String(v || "").trim().toLowerCase();
    if (next) window.localStorage.setItem(RQ_DEBUG_FILTER_KEY, next);
    else window.localStorage.removeItem(RQ_DEBUG_FILTER_KEY);
  } catch {}
}

function isEnabled(): boolean {
  if (!inBrowser()) return false;
  try {
    if (parseBool(window.localStorage.getItem(RQ_DEBUG_KEY))) return true;
  } catch {}
  try {
    const qp = new URLSearchParams(window.location.search);
    if (parseBool(qp.get("debugRQ"))) return true;
    if (parseBool(qp.get("debugHooks"))) return true;
  } catch {}
  return false;
}

function setEnabled(enabled: boolean) {
  if (!inBrowser()) return;
  try {
    if (enabled) window.localStorage.setItem(RQ_DEBUG_KEY, "1");
    else window.localStorage.removeItem(RQ_DEBUG_KEY);
  } catch {}
}

function keyToText(queryKey: unknown): string {
  try {
    if (Array.isArray(queryKey)) return queryKey.map((x) => String(x)).join("::");
    return String(queryKey ?? "");
  } catch {
    return String(queryKey ?? "");
  }
}

function shouldLog(queryKey?: unknown): boolean {
  if (!isEnabled()) return false;
  const f = readFilter();
  if (!f) return true;
  return keyToText(queryKey).toLowerCase().includes(f);
}

function metaOfQuery(q: any) {
  return {
    key: q?.queryKey,
    keyText: keyToText(q?.queryKey),
    hash: q?.queryHash,
    status: q?.state?.status,
    fetchStatus: q?.state?.fetchStatus,
    isInvalidated: !!q?.state?.isInvalidated,
    dataUpdatedAt: q?.state?.dataUpdatedAt || 0,
    errorUpdatedAt: q?.state?.errorUpdatedAt || 0,
    observers: Number(q?.getObserversCount?.() || 0),
  };
}

function metaOfMutation(m: any) {
  return {
    key: m?.options?.mutationKey || null,
    status: m?.state?.status,
    variables: m?.state?.variables ?? null,
    submittedAt: m?.state?.submittedAt || 0,
    failureCount: m?.state?.failureCount || 0,
  };
}

function log(scope: string, event: string, payload: unknown) {
  console.log(`[rq-debug ${nowStamp()}] [${scope}] ${event}`, payload);
}

export function attachReactQueryDebug(qc: QueryClient): () => void {
  if (!inBrowser()) return () => {};
  if ((qc as any).__hdbRqDebugAttached) return () => {};
  (qc as any).__hdbRqDebugAttached = true;

  const queryUnsub = qc.getQueryCache().subscribe((evt: any) => {
    const q = evt?.query;
    if (!shouldLog(q?.queryKey)) return;
    log("query", evt?.type || "event", {
      actionType: evt?.action?.type || null,
      action: evt?.action || null,
      query: metaOfQuery(q),
    });
  });

  const mutationUnsub = qc.getMutationCache().subscribe((evt: any) => {
    const m = evt?.mutation;
    const key = m?.options?.mutationKey;
    if (!isEnabled()) return;
    if (!shouldLog(key)) return;
    log("mutation", evt?.type || "event", {
      actionType: evt?.action?.type || null,
      action: evt?.action || null,
      mutation: metaOfMutation(m),
    });
  });

  const rawInvalidate = qc.invalidateQueries.bind(qc);
  qc.invalidateQueries = (async (...args: any[]) => {
    if (isEnabled()) log("client", "invalidateQueries:start", { args });
    const out = await rawInvalidate(...args);
    if (isEnabled()) log("client", "invalidateQueries:done", { args });
    return out;
  }) as typeof qc.invalidateQueries;

  const rawSetQueryData = qc.setQueryData.bind(qc);
  qc.setQueryData = ((...args: any[]) => {
    const [key] = args;
    if (shouldLog(key)) log("client", "setQueryData", { key, updater: typeof args[1] });
    const out = rawSetQueryData(...args);
    if (shouldLog(key)) {
      const next = qc.getQueryData(key as any);
      const size = Array.isArray(next) ? next.length : next ? 1 : 0;
      log("client", "setQueryData:after", { key, size });
    }
    return out;
  }) as typeof qc.setQueryData;

  const rawSetQueriesData = qc.setQueriesData.bind(qc);
  qc.setQueriesData = ((...args: any[]) => {
    if (isEnabled()) log("client", "setQueriesData", { args });
    return rawSetQueriesData(...args);
  }) as typeof qc.setQueriesData;

  const rawRemoveQueries = qc.removeQueries.bind(qc);
  qc.removeQueries = ((...args: any[]) => {
    if (isEnabled()) log("client", "removeQueries", { args });
    return rawRemoveQueries(...args);
  }) as typeof qc.removeQueries;

  const rawRefetchQueries = qc.refetchQueries.bind(qc);
  qc.refetchQueries = (async (...args: any[]) => {
    if (isEnabled()) log("client", "refetchQueries:start", { args });
    const out = await rawRefetchQueries(...args);
    if (isEnabled()) log("client", "refetchQueries:done", { args });
    return out;
  }) as typeof qc.refetchQueries;

  const rawGetQueriesData = qc.getQueriesData.bind(qc);
  qc.getQueriesData = ((...args: any[]) => {
    const out = rawGetQueriesData(...args);
    if (isEnabled()) {
      const sample = (out || []).slice(0, 8).map(([k, v]: [unknown, unknown]) => ({
        key: k,
        size: Array.isArray(v) ? v.length : v ? 1 : 0,
        preview: typeof v === "object" && v ? stableStringify(v).slice(0, 180) : String(v),
      }));
      log("client", "getQueriesData", { args, count: out.length, sample });
    }
    return out;
  }) as typeof qc.getQueriesData;

  try {
    (window as any).__hdbRQDebug = {
      enable: (filter?: string) => {
        setEnabled(true);
        if (typeof filter === "string") writeFilter(filter);
        log("control", "enabled", { filter: readFilter() || null });
      },
      disable: () => {
        setEnabled(false);
        log("control", "disabled", {});
      },
      filter: (value?: string) => {
        writeFilter(String(value || ""));
        log("control", "filter", { filter: readFilter() || null });
      },
      status: () => ({
        enabled: isEnabled(),
        filter: readFilter() || null,
      }),
      snapshot: () => {
        const queries = qc.getQueryCache().getAll().map((q: any) => metaOfQuery(q));
        const mutations = qc.getMutationCache().getAll().map((m: any) => metaOfMutation(m));
        const snap = { queries, mutations };
        log("control", "snapshot", snap);
        return snap;
      },
    };
  } catch {}

  return () => {
    queryUnsub();
    mutationUnsub();
    try {
      delete (qc as any).__hdbRqDebugAttached;
    } catch {}
  };
}
