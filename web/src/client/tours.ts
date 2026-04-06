import api from "./api";
import { idemKey } from "@lib/idem";
import type {
  TourFlowT,
  ToursUpsertReq,
  ToursUpsertResp,
  ToursPatchReq,
  ToursPatchResp,
  ToursDeleteResp,
  ToursAdminDeleteResp,
  ToursListReq,
  ToursListResp,
  ToursGetReq,
  ToursGetResp,
  ToursStructureResp,
} from "@types";

const asIds = (idOrIds: string | string[]) =>
  (Array.isArray(idOrIds) ? idOrIds : [idOrIds]).map(String);

export const Tours = {
  upsert: (rows: ToursUpsertReq) =>
    api.callIdem(
      "toursUpsert",
      rows,
      idemKey({ scope: "tours", op: "upsert", rows })
    ) as Promise<ToursUpsertResp>,

  patch: (rows: ToursPatchReq) =>
    api.callIdem(
      "toursPatch",
      rows,
      idemKey({ scope: "tours", op: "patch", rows })
    ) as Promise<ToursPatchResp>,

  delete: (idOrIds: string | string[]) => {
    const ids = asIds(idOrIds).sort();
    return api.callIdem(
      "toursDelete",
      Array.isArray(idOrIds) ? ids : ids[0],
      idemKey({ scope: "tours", op: "delete", ids })
    ) as Promise<ToursDeleteResp>;
  },

  adminDelete: (idOrIds: string | string[]) => {
    const ids = asIds(idOrIds).sort();
    return api.callIdem(
      "toursAdminDelete",
      Array.isArray(idOrIds) ? ids : ids[0],
      idemKey({ scope: "tours", op: "adminDelete", ids })
    ) as Promise<ToursAdminDeleteResp>;
  },

  list: async (query?: ToursListReq): Promise<TourFlowT[]> => {
    const maxPerPage = 500;
    const reqLimitRaw =
      query && "limit" in query ? Number((query as any).limit) : NaN;
    const needsPagination = Number.isFinite(reqLimitRaw) && reqLimitRaw > maxPerPage;

    const firstReq = {
      ...(query || {}),
      ...(needsPagination ? { limit: maxPerPage } : {}),
    } as ToursListReq;

    const asItems = (res: unknown): TourFlowT[] => {
      const asObj = res as { items?: unknown };
      return Array.isArray(asObj?.items) ? (asObj.items as TourFlowT[]) : [];
    };

    const first = (await api.get("toursList", firstReq)) as ToursListResp | { next?: string | null };
    if (!needsPagination) return asItems(first);

    const target = Math.max(1, reqLimitRaw);
    const out = [...asItems(first)];
    let next =
      first && typeof first === "object"
        ? ((first as { next?: string | null }).next ?? null)
        : null;

    while (out.length < target && next) {
      const remaining = target - out.length;
      const page = (await api.get("toursList", {
        ...(query || {}),
        limit: Math.min(maxPerPage, remaining),
        startAfter: next,
      } as any)) as ToursListResp | { next?: string | null };

      const items = asItems(page);
      if (!items.length) break;
      out.push(...items);
      next =
        page && typeof page === "object"
          ? ((page as { next?: string | null }).next ?? null)
          : null;
    }

    return out.slice(0, target);
  },

  get: async (id: string): Promise<TourFlowT | null> => {
    const query: ToursGetReq = { id };
    const res = (await api.get("toursGet", query)) as ToursGetResp;
    const asObj = res as { tour?: unknown };
    return asObj.tour && typeof asObj.tour === "object" ? (asObj.tour as TourFlowT) : null;
  },

  structure: () => api.get("toursStructure") as Promise<ToursStructureResp>,
};

export default Tours;
