import api from "./api";
import { idemKey } from "@lib/idem";
import type {
  CreditCardsUpsertReq,
  CreditCardsUpsertResp,
  CreditCardsPatchReq,
  CreditCardsPatchResp,
  CreditCardsDeleteResp,
  CreditCardsAdminDeleteResp,
  CreditCardsListReq,
  CreditCardsListResp,
  CreditCardsGetReq,
  CreditCardsGetResp,
  CreditCardsStructureResp,
  CreditCardsSummaryReq,
  CreditCardsSummaryResp,
  CreditCardEntity,
} from "@types";

export type CreditCard = CreditCardEntity & { id: string };

const asIds = (idOrIds: string | string[]) =>
  (Array.isArray(idOrIds) ? idOrIds : [idOrIds]).map(String);

const STRIP_WRITE_KEYS = new Set(["createdAt", "updatedAt", "deletedAt", "deleted", "orgId"]);

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) return value.map((x) => stripUndefinedDeep(x)) as T;
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

function sanitizeCreditCardForWrite(row: unknown): unknown {
  if (!row || typeof row !== "object") return row;
  const out = { ...(row as Record<string, unknown>) };
  for (const key of STRIP_WRITE_KEYS) delete out[key];
  return stripUndefinedDeep(out);
}

function sanitizePatchBody(rows: CreditCardsPatchReq): CreditCardsPatchReq {
  const sanitizeRow = (row: unknown) => {
    if (!row || typeof row !== "object") return row;
    const src = row as Record<string, unknown>;
    return stripUndefinedDeep({
      ...src,
      patch: sanitizeCreditCardForWrite(src.patch),
    });
  };
  if (Array.isArray(rows)) return rows.map((row) => sanitizeRow(row)) as CreditCardsPatchReq;
  return sanitizeRow(rows) as CreditCardsPatchReq;
}

export const CreditCards = {
  upsert: (rows: CreditCardsUpsertReq) => {
    const body = Array.isArray(rows)
      ? (rows.map((row) => sanitizeCreditCardForWrite(row)) as CreditCardsUpsertReq)
      : (sanitizeCreditCardForWrite(rows) as CreditCardsUpsertReq);
    return api.callIdem(
      "creditCardsUpsert",
      body,
      idemKey({ scope: "creditCards", op: "upsert", rows: body })
    ) as Promise<CreditCardsUpsertResp>;
  },

  patch: (rows: CreditCardsPatchReq) =>
    api.callIdem(
      "creditCardsPatch",
      sanitizePatchBody(rows),
      idemKey({ scope: "creditCards", op: "patch", rows: sanitizePatchBody(rows) })
    ) as Promise<CreditCardsPatchResp>,

  delete: (idOrIds: string | string[]) => {
    const ids = asIds(idOrIds).sort();
    return api.callIdem(
      "creditCardsDelete",
      Array.isArray(idOrIds) ? ids : ids[0],
      idemKey({ scope: "creditCards", op: "delete", ids })
    ) as Promise<CreditCardsDeleteResp>;
  },

  adminDelete: (idOrIds: string | string[]) => {
    const ids = asIds(idOrIds).sort();
    return api.callIdem(
      "creditCardsAdminDelete",
      Array.isArray(idOrIds) ? ids : ids[0],
      idemKey({ scope: "creditCards", op: "adminDelete", ids })
    ) as Promise<CreditCardsAdminDeleteResp>;
  },

  list: async (query?: CreditCardsListReq) => {
    const res = (await api.get("creditCardsList", {
      ...(query || {}),
      ...(Number((query as Record<string, unknown> | undefined)?.limit) > 500 ? { limit: 500 } : {}),
    } as CreditCardsListReq)) as CreditCardsListResp | { items?: CreditCard[] };
    return Array.isArray((res as { items?: CreditCard[] })?.items) ? ((res as { items: CreditCard[] }).items || []) : [];
  },

  get: async (id: string) => {
    const res = (await api.get("creditCardsGet", { id } as CreditCardsGetReq)) as CreditCardsGetResp | { card?: CreditCard };
    return (res as { card?: CreditCard })?.card ?? null;
  },

  structure: () => api.get("creditCardsStructure") as Promise<CreditCardsStructureResp>,

  summary: (query?: CreditCardsSummaryReq) =>
    api.get("creditCardsSummary", (query || {}) as CreditCardsSummaryReq) as Promise<CreditCardsSummaryResp>,
};

export default CreditCards;
