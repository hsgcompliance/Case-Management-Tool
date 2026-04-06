// web/src/hooks/useMetrics.ts
// React Query hooks for the metric platform.
// All summary hooks read dedicated Firestore metric docs — never lists.
import { useQuery } from "@tanstack/react-query";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@lib/firebase";
import { qk } from "./queryKeys";
import type {
  TSystemSummaryMetrics,
  TSystemMonthMetrics,
  TCaseManagerSummaryMetrics,
  TCaseManagerMonthMetrics,
  TGrantSummaryMetrics,
  TGrantMonthMetrics,
} from "@hdb/contracts";

// Metrics docs are reconciled weekly; treat as fresh for 2h.
const METRIC_STALE = 2 * 60 * 60_000;
const METRIC_GC = 4 * 60 * 60_000;

const RQ_METRIC = {
  staleTime: METRIC_STALE,
  gcTime: METRIC_GC,
  refetchOnWindowFocus: false,
  retry: 1,
};

// ── Firestore helpers ────────────────────────────────────────────────────────

async function fetchDoc<T>(path: string): Promise<T | null> {
  const snap = await getDoc(doc(db, path));
  if (!snap.exists()) return null;
  return snap.data() as T;
}

// ── System metrics ───────────────────────────────────────────────────────────

/**
 * System-wide summary: total CMs, customers, populations, enrollments, grants.
 * Source: `metrics/systemSummary` — reconciled weekly.
 */
export function useSystemMetrics() {
  return useQuery({
    ...RQ_METRIC,
    queryKey: qk.metrics.system(),
    queryFn: () => fetchDoc<TSystemSummaryMetrics>("metrics/systemSummary"),
  });
}

/**
 * System month metrics: tasks, payments, spending, jotform for a given month.
 * Source: `metrics/systemSummary/months/{month}` — reconciled weekly.
 */
export function useSystemMonthMetrics(month: string, opts?: { enabled?: boolean }) {
  return useQuery({
    ...RQ_METRIC,
    enabled: (opts?.enabled ?? true) && !!month,
    queryKey: qk.metrics.systemMonth(month),
    queryFn: () => fetchDoc<TSystemMonthMetrics>(`metrics/systemSummary/months/${month}`),
  });
}

// ── Case manager metrics ─────────────────────────────────────────────────────

/**
 * Per-case-manager summary: customers, enrollments, tasks, acuity, payments.
 * Source: `caseManagerMetrics/{uid}` — reconciled weekly.
 */
export function useCaseManagerMetrics(uid: string | undefined, opts?: { enabled?: boolean }) {
  const safeUid = String(uid || "").trim();
  return useQuery({
    ...RQ_METRIC,
    enabled: (opts?.enabled ?? true) && !!safeUid,
    queryKey: qk.metrics.cm(safeUid),
    queryFn: () => fetchDoc<TCaseManagerSummaryMetrics>(`caseManagerMetrics/${safeUid}`),
  });
}

/**
 * Per-case-manager month metrics: tasks, payments for a given month.
 * Source: `caseManagerMetrics/{uid}/months/{month}` — reconciled weekly.
 */
export function useCaseManagerMonthMetrics(
  uid: string | undefined,
  month: string,
  opts?: { enabled?: boolean },
) {
  const safeUid = String(uid || "").trim();
  return useQuery({
    ...RQ_METRIC,
    enabled: (opts?.enabled ?? true) && !!safeUid && !!month,
    queryKey: qk.metrics.cmMonth(safeUid, month),
    queryFn: () =>
      fetchDoc<TCaseManagerMonthMetrics>(`caseManagerMetrics/${safeUid}/months/${month}`),
  });
}

// ── Grant metrics ────────────────────────────────────────────────────────────

/**
 * Per-grant summary: enrollments, customers, CMs, spending.
 * Source: `grantMetrics/{grantId}` — reconciled weekly.
 */
export function useGrantMetrics(grantId: string | undefined, opts?: { enabled?: boolean }) {
  const safeId = String(grantId || "").trim();
  return useQuery({
    ...RQ_METRIC,
    enabled: (opts?.enabled ?? true) && !!safeId,
    queryKey: qk.metrics.grant(safeId),
    queryFn: () => fetchDoc<TGrantSummaryMetrics>(`grantMetrics/${safeId}`),
  });
}

/**
 * Per-grant month metrics: enrollments, payments, spending for a given month.
 * Source: `grantMetrics/{grantId}/months/{month}` — reconciled weekly.
 */
export function useGrantMonthMetrics(
  grantId: string | undefined,
  month: string,
  opts?: { enabled?: boolean },
) {
  const safeId = String(grantId || "").trim();
  return useQuery({
    ...RQ_METRIC,
    enabled: (opts?.enabled ?? true) && !!safeId && !!month,
    queryKey: qk.metrics.grantMonth(safeId, month),
    queryFn: () => fetchDoc<TGrantMonthMetrics>(`grantMetrics/${safeId}/months/${month}`),
  });
}

// ── Convenience: current month key ──────────────────────────────────────────

export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
