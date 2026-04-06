//src/features/tutorial/progress.ts
export type ProgressStatus = "in_progress" | "completed" | "abandoned";
export type ProgressEntry = { stepIndex?: number; status?: ProgressStatus; updatedAt?: number };

const KEY = (uid?: string) => `hdb.tours.progress.${uid || "me"}`;

// --- tiny event bus so banners & pickers live-update ---
const PROGRESS_EVENT = "tour:progress";
const bus = new EventTarget();
function emit() { try { bus.dispatchEvent(new Event(PROGRESS_EVENT)); } catch {} }
export function onProgress(cb: () => void) {
  const h = () => cb();
  bus.addEventListener(PROGRESS_EVENT, h);
  return () => bus.removeEventListener(PROGRESS_EVENT, h);
}

export function getAllProgress(uid?: string): Record<string, ProgressEntry> {
  try {
    const raw = localStorage.getItem(KEY(uid));
    const obj = raw ? JSON.parse(raw) : {};
    return (obj && typeof obj === "object") ? obj : {};
  } catch { return {}; }
}

const toUpdatedAt = (v: unknown): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Date.parse(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (v && typeof v === "object") {
    const maybe = v as { _seconds?: number; seconds?: number };
    if (typeof maybe._seconds === "number") return maybe._seconds * 1000;
    if (typeof maybe.seconds === "number") return maybe.seconds * 1000;
  }
  return 0;
};

export function mergeAllProgress(uid: string | undefined, incoming: Record<string, unknown>) {
  if (!incoming || typeof incoming !== "object") return;
  const prev = getAllProgress(uid);
  const next: Record<string, ProgressEntry> = { ...prev };
  for (const [tourId, raw] of Object.entries(incoming)) {
    if (!raw || typeof raw !== "object") continue;
    const candidate = raw as ProgressEntry & { updatedAt?: unknown };
    const cur = prev[tourId];
    const curAt = toUpdatedAt(cur?.updatedAt);
    const nextAt = toUpdatedAt(candidate.updatedAt);
    if (!cur || nextAt >= curAt) {
      next[tourId] = {
        stepIndex: typeof candidate.stepIndex === "number" ? candidate.stepIndex : cur?.stepIndex,
        status: candidate.status || cur?.status,
        updatedAt: nextAt || curAt || Date.now(),
      };
    }
  }
  try { localStorage.setItem(KEY(uid), JSON.stringify(next)); } catch {}
  emit();
}

function write(uid: string | undefined, patch: Record<string, ProgressEntry>) {
  const prev = getAllProgress(uid);
  const next = { ...prev, ...patch };
  try { localStorage.setItem(KEY(uid), JSON.stringify(next)); } catch {}
  emit();
}

export function markIndex(uid: string | undefined, tourId: string, stepIndex: number) {
  if (!tourId) return;
  const cur = getAllProgress(uid)[tourId] || {};
  write(uid, { [tourId]: { ...cur, stepIndex, status: cur.status === "completed" ? "completed" : "in_progress", updatedAt: Date.now() } });
}

export function markCompleted(uid: string | undefined, tourId: string) {
  if (!tourId) return;
  const cur = getAllProgress(uid)[tourId] || {};
  write(uid, { [tourId]: { ...cur, status: "completed", updatedAt: Date.now() } });
}
