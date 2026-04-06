// BEGIN FILE: src/features/tutorial/admin/tourStore.ts
import type { TourFlowT as Tour } from "@tour/schema";
import Tours from "@client/tours";
import { auth, appCheck } from "@lib/firebase";
import { getToken as getAppCheckToken } from "firebase/app-check";
import { dbg } from "@tour/debug";

type AnyObj = Record<string, unknown>;
type PublishTour = Tour & { active?: boolean; deleted?: boolean; meta?: Record<string, unknown> };

export type TourSummary = {
  id: string;
  name: string;
  source: "db" | "draft";
  stepCount?: number | null;
  updatedAt?: string | null;
};

const DB_CACHE = new Map<string, Tour>();

// ---------- local drafts ----------
const DRAFT_KEY = (id: string) => `hdb.tours.draft.${id}`;
const DRAFT_INDEX_KEY = "hdb.tours.draft.index";

function readDraftIndex(): string[] {
  try { return JSON.parse(localStorage.getItem(DRAFT_INDEX_KEY) || "[]"); } catch { return []; }
}
function writeDraftIndex(ids: string[]) {
  try { localStorage.setItem(DRAFT_INDEX_KEY, JSON.stringify(Array.from(new Set(ids)))); } catch {}
}

export function saveDraft(t: Tour) {
  const id = (t.id || "onboarding").trim();
  localStorage.setItem(DRAFT_KEY(id), JSON.stringify({ ...t, id, updatedAt: new Date().toISOString() }));
  const idx = readDraftIndex(); if (!idx.includes(id)) writeDraftIndex([...idx, id]);
}
export function loadDraft(id: string): Tour | undefined {
  try { const raw = localStorage.getItem(DRAFT_KEY(id)); return raw ? (JSON.parse(raw) as Tour) : undefined; } catch { return undefined; }
}
export function deleteDraft(id: string) {
  localStorage.removeItem(DRAFT_KEY(id)); writeDraftIndex(readDraftIndex().filter(x => x !== id));
}
export function listDraftSummaries(): TourSummary[] {
  return readDraftIndex().map(id => loadDraft(id)).filter(Boolean).map(t => ({
    id: t!.id, name: t!.name || t!.id, stepCount: t!.steps?.length || 0, updatedAt: t!.updatedAt || null, source: "draft" as const,
  }));
}

// ---------- helpers ----------
async function getBearer(forceRefresh = false) {
  const u = auth.currentUser;
  try {
    const tok = u ? await u.getIdToken(forceRefresh) : null;
    dbg("tour/store", "getBearer", { hasUser: !!u, present: !!tok });
    return tok ? `Bearer ${tok}` : null;
  } catch (e) {
    dbg("tour/store", "getBearer error", e);
    return null;
  }
}
async function getAppCheckHeader(): Promise<Record<string, string>> {
  try {
    if (!appCheck) return {};
    const t = await getAppCheckToken(appCheck, false);
    const hdr: Record<string, string> = t?.token ? { "X-Firebase-AppCheck": t.token } : {};
    dbg("tour/store", "AppCheck present:", !!t?.token);
    return hdr;
  } catch (e) {
    dbg("tour/store", "AppCheck error", e);
    return {};
  }
}

const asObj = (value: unknown): AnyObj | null =>
  value && typeof value === "object" ? (value as AnyObj) : null;

// Normalize backend variants to canonical TourFlow.
export function normalizeTourShape(x: unknown): Tour {
  const root = asObj(x) ?? {};
  const rootData = asObj(root.data);

  let t =
    asObj(root.tour) ??
    asObj(rootData?.tour) ??
    rootData ??
    root;

  if ((typeof t.id !== "string" || !t.id) && Array.isArray(root.items) && root.items[0]) {
    t = asObj(root.items[0]) ?? t;
  }
  if ((typeof t.id !== "string" || !t.id) && Array.isArray(root.tours) && root.tours[0]) {
    t = asObj(root.tours[0]) ?? t;
  }

  const tData = asObj(t.data);
  const steps = (Array.isArray(t.steps) ? t.steps : Array.isArray(tData?.steps) ? tData.steps : []) as Tour["steps"];

  const out: Tour = {
    id: String(t.id ?? "onboarding"),
    name: String(t.name ?? t.id ?? "Onboarding"),
    version: 2,
    steps,
    updatedAt: typeof t.updatedAt === "string" ? t.updatedAt : undefined,
  };
  return out;
}

// ---------- public API ----------
export async function listAllTourSummaries(limit = 200, includeDeleted = false): Promise<TourSummary[]> {
  const bearer = await getBearer();
  if (!bearer) { dbg("tour/store", "listAllTourSummaries: no bearer"); return []; }
  // Ensure token is fresh for contract client calls below.
  await getAppCheckHeader();
  const items = await Tours.list({ limit, deleted: includeDeleted ? undefined : false });
  const out = items.map(t => ({
    id: t.id, name: t.name ?? t.id, stepCount: Array.isArray(t.steps) ? t.steps.length : null,
    updatedAt: typeof t.updatedAt === "string" ? t.updatedAt : null, source: "db" as const,
  }));
  dbg("tour/store", "toursList", { count: out.length });
  return out;
}

export async function fetchTour(id: string): Promise<Tour> {
  const bearer = await getBearer();
  if (!bearer) throw new Error("Not authenticated");
  await getAppCheckHeader();
  const res = await Tours.get(id);
  const t = normalizeTourShape(res || { id, name: id, steps: [] });
  DB_CACHE.set(t.id, t);
  dbg("tour/store", "toursGet", { id: t.id, steps: t.steps?.length ?? 0 });
  return t;
}

export async function publishTour(tour: Tour, opts: { ensureUnique?: boolean; merge?: boolean } = {}) {
  const bearer = await getBearer();
  if (!bearer) throw new Error("Not authenticated");
  await getAppCheckHeader();
  // Current contracts/functions accept TourFlow; keep opts for caller API compatibility for now.
  void opts;
  const draft = tour as PublishTour;
  const payload = {
    ...draft,
    active: draft.active ?? true,
    deleted: draft.deleted ?? false,
    meta: draft.meta ?? {},
  };
  await Tours.upsert(payload);
  const t = normalizeTourShape(payload);
  DB_CACHE.set(t.id, t);
  dbg("tour/store", "toursUpsert", { id: t.id, steps: t.steps?.length ?? 0 });
  return t;
}

export async function deleteTourDb(id: string) {
  const bearer = await getBearer();
  if (!bearer) throw new Error("Not authenticated");
  await getAppCheckHeader();
  const res = await Tours.delete(id);
  dbg("tour/store", "toursDelete", { id, ok: !!res });
  return res;
}

export function resolveTourById(id?: string): Tour | null {
  if (!id) return null;
  const d = loadDraft(id);
  if (d) { dbg("tour/store", "resolve -> draft", { id, steps: d.steps?.length ?? 0 }); return d; }
  const c = DB_CACHE.get(id);
  if (c) { dbg("tour/store", "resolve -> db-cache", { id, steps: c.steps?.length ?? 0 }); return c; }
  dbg("tour/store", "resolve -> null", { id });
  return null;
}

function slugifyId(base: string): string {
  const s = (base || "onboarding")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "");
  return s || "onboarding";
}

/** Ensure a unique, URL-safe id across drafts, DB cache, and remote summaries. */
export async function ensureUniqueId(base: string, maxTries = 50): Promise<string> {
  const root = slugifyId(base);
  const existing = new Set<string>();
  // drafts
  readDraftIndex().forEach(id => existing.add(id));
  // db cache
  Array.from(DB_CACHE.keys()).forEach(id => existing.add(id));
  // remote summaries (best effort)
  try {
    const list = await listAllTourSummaries(500, false);
    list.forEach(t => existing.add(t.id));
  } catch {
    /* offline/unauth → ignore */
  }
  if (!existing.has(root)) return root;
  for (let i = 2; i <= maxTries; i++) {
    const cand = `${root}-${i}`;
    if (!existing.has(cand)) return cand;
  }
  // ultra-fallback with date suffix
  const fallback = `${root}-${new Date().toISOString().slice(0,10)}`;
  return existing.has(fallback) ? `${fallback}-${Date.now().toString(36)}` : fallback;
}
// END FILE
