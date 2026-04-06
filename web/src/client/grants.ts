// web/src/client/grants.ts
import api from "./api";
import { idemKey } from "@lib/idem";
import type {
  GrantsUpsertReq,
  GrantsUpsertResp,
  GrantsPatchReq,
  GrantsPatchResp,
  GrantsDeleteResp,
  GrantsAdminDeleteResp,
  GrantsListQuery,
  GrantsListResp,
  GrantsGetReq,
  GrantsGetResp,
  GrantsStructureResp,
  GrantsActivityReq,
  GrantsActivityResp,
  TGrant,
  GrantsActivityItem,
} from "@types";

export type Grant = TGrant & { id: string };

/* ---------------- helpers ---------------- */

const asIds = (idOrIds: string | string[]) =>
  (Array.isArray(idOrIds) ? idOrIds : [idOrIds]).map(String);

const STRIP_WRITE_KEYS = new Set(["createdAt", "updatedAt", "deleted", "orgId"]);

function isReservedRouteId(value: unknown): boolean {
  const s = String(value ?? "").trim().toLowerCase();
  if (!s) return false;
  if (s === "new") return true;
  if (s.startsWith("(") && s.endsWith(")new")) return true;
  return false;
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((x) => stripUndefinedDeep(x)) as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = stripUndefinedDeep(v);
    }
    return out as T;
  }
  return value;
}

function sanitizeGrantForWrite(row: unknown): unknown {
  if (!row || typeof row !== "object") return row;
  const out = { ...(row as Record<string, unknown>) };
  for (const k of STRIP_WRITE_KEYS) delete out[k];
  if (isReservedRouteId(out.id)) delete out.id;
  return stripUndefinedDeep(out);
}

function sanitizeGrantsUpsertBody(rows: GrantsUpsertReq): GrantsUpsertReq {
  if (Array.isArray(rows)) {
    return rows.map((r) => sanitizeGrantForWrite(r)) as GrantsUpsertReq;
  }
  return sanitizeGrantForWrite(rows) as GrantsUpsertReq;
}

function sanitizeGrantsPatchBody(rows: GrantsPatchReq): GrantsPatchReq {
  const sanitizeRow = (row: unknown) => {
    if (!row || typeof row !== "object") return row;
    const src = row as Record<string, unknown>;
    return stripUndefinedDeep({
      ...src,
      patch: sanitizeGrantForWrite(src.patch),
    });
  };
  if (Array.isArray(rows)) return rows.map((r) => sanitizeRow(r)) as GrantsPatchReq;
  return sanitizeRow(rows) as GrantsPatchReq;
}

/* ---------------- client ---------------- */

export const Grants = {
  // ---- mutations (idempotent via api.callIdem + idemKey) -------------------

  upsert: (rows: GrantsUpsertReq) => {
    const body = sanitizeGrantsUpsertBody(rows);
    return api.callIdem(
      "grantsUpsert",
      body,
      idemKey({ scope: "grants", op: "upsert", rows: body })
    ) as Promise<GrantsUpsertResp>;
  },

  patch: (rows: GrantsPatchReq) => {
    const body = sanitizeGrantsPatchBody(rows);
    return api.callIdem(
      "grantsPatch",
      body,
      idemKey({ scope: "grants", op: "patch", rows: body })
    ) as Promise<GrantsPatchResp>;
  },

  delete: (idOrIds: string | string[]) => {
    const ids = asIds(idOrIds).sort();
    return api.callIdem(
      "grantsDelete",
      Array.isArray(idOrIds) ? ids : ids[0],
      idemKey({ scope: "grants", op: "delete", ids })
    ) as Promise<GrantsDeleteResp>;
  },

  adminDelete: (idOrIds: string | string[]) => {
    const ids = asIds(idOrIds).sort();
    return api.callIdem(
      "grantsAdminDelete",
      Array.isArray(idOrIds) ? ids : ids[0],
      idemKey({ scope: "grants", op: "adminDelete", ids })
    ) as Promise<GrantsAdminDeleteResp>;
  },

  // ---- reads ---------------------------------------------------------------

  // Return a plain array for the UI
  list: async (query?: GrantsListQuery) => {
    const maxPerPage = 500;
    const reqLimitRaw =
      query && "limit" in query ? Number((query as any).limit) : NaN;
    const needsPagination = Number.isFinite(reqLimitRaw) && reqLimitRaw > maxPerPage;

    const firstReq = {
      ...(query || {}),
      ...(needsPagination ? { limit: maxPerPage } : {}),
    } as GrantsListQuery;

    const asItems = (res: unknown): Grant[] =>
      Array.isArray((res as { items?: Grant[] } | null | undefined)?.items)
        ? ((res as { items: Grant[] }).items || [])
        : [];

    const first = (await api.get("grantsList", firstReq)) as GrantsListResp | { items?: Grant[]; next?: any };
    if (!needsPagination) return asItems(first);

    const target = Math.max(1, reqLimitRaw);
    const out: Grant[] = asItems(first);
    let next =
      first && typeof first === "object"
        ? ((first as { next?: { cursorUpdatedAt?: unknown; cursorId?: string } | null }).next ?? null)
        : null;

    while (out.length < target && next?.cursorId) {
      const remaining = target - out.length;
      const page = (await api.get("grantsList", {
        ...(query || {}),
        limit: Math.min(maxPerPage, remaining),
        cursorUpdatedAt: next.cursorUpdatedAt,
        cursorId: next.cursorId,
      } as any)) as GrantsListResp | { items?: Grant[]; next?: any };

      const items = asItems(page);
      if (!items.length) break;
      out.push(...items);
      next =
        page && typeof page === "object"
          ? ((page as { next?: { cursorUpdatedAt?: unknown; cursorId?: string } | null }).next ?? null)
          : null;
    }

    return out.slice(0, target);
  },

  // Return all pages (guarded) for accurate totals.
  listAll: async (
    query?: Omit<GrantsListQuery, "limit" | "cursorUpdatedAt" | "cursorId">,
    opts?: { maxPages?: number; maxItems?: number }
  ) => {
    const maxPerPage = 500;
    const maxPages = Math.max(1, Number(opts?.maxPages ?? 200));
    const maxItems = Math.max(maxPerPage, Number(opts?.maxItems ?? 50_000));

    const asItems = (res: unknown): Grant[] =>
      Array.isArray((res as { items?: Grant[] } | null | undefined)?.items)
        ? ((res as { items: Grant[] }).items || [])
        : [];

    const out: Grant[] = [];
    let cursorUpdatedAt: unknown = undefined;
    let cursorId: string | undefined = undefined;

    for (let i = 0; i < maxPages; i++) {
      const page: unknown = await api.get("grantsList", {
        ...(query || {}),
        limit: maxPerPage,
        cursorUpdatedAt: cursorUpdatedAt as any,
        cursorId,
      } as any);

      const items = asItems(page);
      if (!items.length) break;
      out.push(...items);
      if (out.length >= maxItems) break;

      const next =
        page && typeof page === "object"
          ? ((page as { next?: { cursorUpdatedAt?: unknown; cursorId?: string } | null }).next ?? null)
          : null;

      if (!next?.cursorId) break;
      cursorUpdatedAt = next.cursorUpdatedAt;
      cursorId = next.cursorId;
    }

    return out.slice(0, maxItems);
  },

  // Return a single grant or null
  get: async (id: string) => {
    const req: GrantsGetReq = { id };
    const res = (await api.get("grantsGet", req)) as GrantsGetResp | { grant?: Grant };
    const g = (res as { grant?: Grant })?.grant;
    return g ? (g as Grant) : null;
  },

  // Server structure passthrough (tools/tab schema)
  structure: () => api.get("grantsStructure") as Promise<GrantsStructureResp>,

  // Return activity array for the UI
  activity: async (query: GrantsActivityReq) => {
    const safeQuery = {
      ...query,
      ...(Number((query as any)?.limit) > 1000 ? { limit: 1000 } : {}),
    } as GrantsActivityReq;
    const res = (await api.get("grantsActivity", safeQuery)) as GrantsActivityResp | { items?: GrantsActivityItem[] };
    return (res as { items?: GrantsActivityItem[] })?.items ?? [];
  },
};

export default Grants;
