// functions/src/features/payments/utils.ts
// tiny date helpers + projection / id helpers (pure) + org access helpers

import {
  getOrgId,
  assertOrgAccess as assertOrgAccessCtx,
  assertOrgAccessMaybe as assertOrgAccessMaybeCtx,
  requireUid as requireUidCtx,
  toDate as coreToDate,
  toDateOnly,
  addMonthsUtc,
} from "../../core";

import { createHash } from "crypto";

// ---------------- Date helpers ----------------
export const toISO10 = (d: Date | string | number) => toDateOnly(d as any);

export function toDate(val: any): Date | null {
  return coreToDate(val);
}

export function addMonths(d: Date, n: number) {
  return addMonthsUtc(d, n);
}

export function monthsBetween(a: Date | string, b: Date | string) {
  const A = new Date(a);
  const B = new Date(b);
  return (B.getUTCFullYear() - A.getUTCFullYear()) * 12 + (B.getUTCMonth() - A.getUTCMonth());
}

// ---------------- Org / auth helpers ----------------

/**
 * Pull org id from the common legacy/new claim shapes.
 * Prefer the central getOrgId() helper but keep legacy `claims.*` fallback.
 */
export function getOrgIdFromClaims(user: any): string | null {
  const primary = getOrgId(user as any);
  if (primary) return primary;

  const legacy = user?.claims?.orgId ?? user?.claims?.organizationId ?? null;

  return legacy ? String(legacy) : null;
}

/**
 * Enforce requester org matches doc org when doc org exists.
 * Legacy docs without orgId remain accessible.
 *
 * Implementation is centralized in core/requestContext.
 */
export function assertOrgAccess(user: any, doc: any) {
  return assertOrgAccessCtx(user as any, doc);
}

/**
 * Same as assertOrgAccess, but no-ops for system/scheduled calls.
 * Implementation is centralized in core/requestContext.
 */
export function assertOrgAccessMaybe(user: any, doc: any) {
  return assertOrgAccessMaybeCtx(user as any, doc);
}

/** Require authenticated uid (blocks anon writes). */
export function requireUid(user: any): string {
  return requireUidCtx(user as any);
}

// ---------------- Grant window helpers ----------------

export type GrantWindowISO = {
  startISO: string | null;
  endISO: string | null;
};

export function getGrantWindowISO(grant: any): GrantWindowISO {
  const s = toDate(grant?.startDate);
  const e = toDate(grant?.endDate);

  const startISO = s ? toISO10(s) : null;
  const endISO = e ? toISO10(e) : null;
  return { startISO, endISO };
}

/** Inclusive window check. If no window, treat as "in window". */
export function isInGrantWindow(dateISO: any, win: GrantWindowISO): boolean {
  const d = String(dateISO || "").slice(0, 10);
  if (!d) return false;

  const { startISO, endISO } = win;
  if (!startISO && !endISO) return true;
  if (startISO && d < startISO) return false;
  if (endISO && d > endISO) return false;
  return true;
}

// ---------------- Deterministic payment IDs ----------------

function iso10(val: any): string {
  const d = toDate(val);
  if (d) return toISO10(d);
  return String(val || "").slice(0, 10);
}
function iso7(val: any): string {
  const d = iso10(val);
  return d ? d.slice(0, 7) : "";
}
function safeStr(val: any): string {
  return String(val ?? "").trim();
}
function shortHash(input: string, len = 12): string {
  return createHash("sha256").update(input).digest("hex").slice(0, len);
}
function safeSlug(val: string, len = 8): string {
  const s = safeStr(val).replace(/[^a-zA-Z0-9]+/g, "");
  return (s || "x").slice(0, len);
}
function normType(p: any): string {
  const t = safeStr(p?.type || "monthly").toLowerCase();
  return t || "monthly";
}
function dueMonth(p: any): string {
  const m = iso7(p?.dueDate || p?.date);
  return m || "0000-00";
}

function noteArray(note: any): string[] {
  const raw = Array.isArray(note) ? note : note != null ? [note] : [];
  return raw
    .map((x: any) => safeStr(x))
    .filter((x: string) => !!x);
}

function hasAnyTag(tagsLower: string[], candidatesLower: string[]) {
  const set = new Set(tagsLower);
  for (const c of candidatesLower) if (set.has(c)) return true;
  return false;
}

function extractSubtypeFromTags(tagsLower: string[]): "rent" | "utility" | null {
  // Prefer explicit sub tags
  if (hasAnyTag(tagsLower, ["sub:utility"])) return "utility";
  if (hasAnyTag(tagsLower, ["sub:rent"])) return "rent";

  // Back-compat: treat exact legacy tags as subtype signals
  if (hasAnyTag(tagsLower, ["utility", "utility:"])) return "utility";
  if (hasAnyTag(tagsLower, ["rent", "rent:"])) return "rent";

  // Also allow prefix forms like "utility:gas" or "rent:tenant"
  if (tagsLower.some((t) => t.startsWith("sub:utility"))) return "utility";
  if (tagsLower.some((t) => t.startsWith("sub:rent"))) return "rent";
  if (tagsLower.some((t) => t.startsWith("utility:"))) return "utility";
  if (tagsLower.some((t) => t.startsWith("rent:"))) return "rent";

  return null;
}

/**
 * Deterministic subtype for monthly (rent/utility).
 * * IMPORTANT: scan all note tags (order not trusted). Prefer `sub:*` tags.
 */
export function primarySubtype(p: any) {
  const type = normType(p);
  if (type !== "monthly") return type; // deposit|prorated|service|...

  const explicit = safeStr(p?.sub || p?.subcategory).toLowerCase();
  if (explicit === "rent" || explicit === "utility") return explicit;

  const tags = noteArray(p?.note).map((x) => x.toLowerCase());
  return extractSubtypeFromTags(tags) || "rent";
}

/**
 * Stable identity key that does NOT include amount.
 * This is the critical change that stops ID drift when amounts change.
 *
 * Identity is anchored on: type + subtype + dueMonth + lineItemId
 */
export function compositeKey(p: any) {
  const t = normType(p);
  const sub = primarySubtype(p);
  const m = dueMonth(p);
  const li = safeStr(p?.lineItemId || "_") || "_";
  return [t, sub, m, li].join("|");
}

// utils.ts (new deterministic id format)
export function isDeterministicPaymentIdV2(id: any): boolean {
  const s = String(id || "").trim();
  // pay2_<type>_<sub>_<YYYY-MM>_<liSlug>_<index>_<12hex>
  return /^pay2_[a-z0-9]+_[a-z0-9]+_\d{4}-\d{2}_[a-z0-9]{1,8}_\d+_[0-9a-f]{12}$/i.test(s);
}

/**
 * Strong deterministic ID from the identity key + sequence index.
 * Readable prefix, collision-resistant hash, stable across amount edits.
 */
export function buildIdFromKey(key: string, index: number) {
  const [t, sub, m, li] = key.split("|");
  const liSlug = safeSlug(li, 8);
  const h = shortHash(`${key}|${index}`, 12);
  return `pay2_${t}_${sub}_${m}_${liSlug}_${index}_${h}`;
}

/**
 * Deterministic id assignment WITH reuse from existing list.
 * - Keeps provided ids when unique in batch
 * - Reuses existing ids for same compositeKey (now amount-insensitive)
 * - Otherwise creates new deterministic ids
 *
 * Reuse mapping is positional per key:
 * - if there are N existing payments with the same key, the first incoming with that key
 *   reuses the first existing id, etc.
 */
export function ensurePaymentIds(incoming: any[] = [], existing: any[] = []) {
  const existingIdsByKey = new Map<string, string[]>();

  // Preserve existing order within each key (enrollment doc order is the only stable truth we have).
  for (const p of existing || []) {
    const id = p?.id ? String(p.id) : "";
    if (!id) continue;
    const k = compositeKey(p);
    const arr = existingIdsByKey.get(k) || [];
    arr.push(id);
    existingIdsByKey.set(k, arr);
  }

  const usedInBatch = new Set<string>();
  const seq = new Map<string, number>();

  return (incoming || []).map((p: any) => {
    const key = compositeKey(p);

    // 1) respect provided id if unique in this batch
    if (p?.id) {
      const provided = String(p.id);
      if (provided && isDeterministicPaymentIdV2(provided) && !usedInBatch.has(provided)) {
        usedInBatch.add(provided);
        return { ...p, id: provided };
      }
    }

    // 2) reuse existing id for this key (positional)
    const arr = existingIdsByKey.get(key) || [];
    let nUsed = seq.get(key) || 0;

    while (nUsed < arr.length) {
      const candidate = arr[nUsed];
      nUsed += 1;
      if (candidate && !usedInBatch.has(candidate)) {
        seq.set(key, nUsed);
        usedInBatch.add(candidate);
        return { ...p, id: candidate };
      }
    }

    // 3) generate deterministic new id for this key + index
    let idx = nUsed;
    let id = buildIdFromKey(key, idx);

    // just in case (extremely unlikely), keep bumping index until unique
    while (usedInBatch.has(id)) {
      idx += 1;
      id = buildIdFromKey(key, idx);
    }

    seq.set(key, idx + 1);
    usedInBatch.add(id);
    return { ...p, id };
  });
}

/**
 * Normalize monthly payments to carry an explicit subtype tag:
 * - ensures EXACTLY ONE of: sub:rent | sub:utility (default rent)
 * - strips legacy exact tags: rent / utility (to avoid ambiguity)
 * - does NOT touch non-monthly payments
 */
export function ensureMonthlySubtypeTag(p: any) {
  const type = normType(p);
  if (type !== "monthly") return p;

  const explicit = safeStr(p?.sub || p?.subcategory).toLowerCase();
  let subtype: "rent" | "utility" =
    explicit === "utility" ? "utility" : explicit === "rent" ? "rent" : "rent";

  const tags = noteArray(p?.note);
  const tagsLower = tags.map((t) => t.toLowerCase());
  const fromTags = extractSubtypeFromTags(tagsLower);
  if (fromTags) subtype = fromTags;

  const wanted = `sub:${subtype}`;

  // Remove old/duplicate subtype tags (only exact ones — don’t nuke user comments)
  const cleaned = tags.filter((t) => {
    const L = t.toLowerCase();
    if (L === "rent" || L === "utility") return false; // legacy exact tags
    if (L === "sub:rent" || L === "sub:utility") return false; // normalize to single
    return true;
  });

  // Prepend for visibility; cap to 10 to match existing behavior elsewhere
  return {
    ...p,
    note: [wanted, ...cleaned].slice(0, 10),
  };
}

// ---------------- Projections ----------------
export function generateMonthlyProjections(opts: {
  startDate: any;
  months: number;
  monthlyAmount: number;
  deposit?: number;
}) {
  const start = toDate(opts.startDate);
  const { months, monthlyAmount, deposit = 0 } = opts;
  if (!start || !months || !monthlyAmount) return [];

  const out: any[] = [];
  for (let i = 0; i < months; i++) {
    const due = addMonths(start, i);
    out.push({
      type: "monthly",
      amount: Number(monthlyAmount),
      dueDate: toISO10(due),
      paid: false,
      paidFromGrant: false,
      note: ["sub:rent"],
    });
  }

  if (deposit > 0) {
    out.unshift({
      type: "deposit",
      amount: Number(deposit),
      dueDate: toISO10(start),
      paid: false,
      paidFromGrant: false,
    });
  }

  // deterministic for generated schedules; amount does NOT affect ids
  return ensurePaymentIds(out.map(ensureMonthlySubtypeTag), []);
}

export function recalcFutureMonthly(existing: any[] = [], newMonthlyAmount = 0) {
  const todayISO = toDateOnly(new Date()); // canonical YYYY-MM-DD (UTC)

  return (existing || []).map((p: any) => {
    if (p?.paid || String(p?.type || "") !== "monthly") return p;

    const dueISO = toDateOnly(p?.dueDate || p?.date);
    if (!dueISO || dueISO < todayISO) return p;

    return { ...p, amount: Number(newMonthlyAmount) };
  });
}
