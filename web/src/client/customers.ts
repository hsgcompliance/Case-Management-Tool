//web/src/client/customers.ts
import api from "./api";
import { idemKey } from "@lib/idem";
import type {
  ReqOf,
  RespOf,
  CustomersGetResp,
  CustomersUpsertReq,
  CustomersUpsertResp,
  CustomersListQuery,
  CustomersPatchReq,
  CustomersPatchResp,
  CustomersSoftDeleteResp,
  CustomersHardDeleteResp,
  TCustomerEntity,
} from "@types";

function normalizeUpsertResp(res: unknown): CustomersUpsertResp {
  // Goal: always expose `items: Customer[]` if the server returned rows in *any* common shape.
  if (Array.isArray(res)) {
    return {
      ok: true,
      items: res as TCustomerEntity[],
    } as unknown as CustomersUpsertResp;
  }
  if (res && typeof res === "object") {
    const obj = res as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj as CustomersUpsertResp;
    if (Array.isArray(obj.customers))
      return {
        ...obj,
        ok: true,
        items: obj.customers,
      } as unknown as CustomersUpsertResp;
    if (Array.isArray(obj.rows))
      return {
        ...obj,
        ok: true,
        items: obj.rows,
      } as unknown as CustomersUpsertResp;
    if (Array.isArray(obj.data))
      return {
        ...obj,
        ok: true,
        items: obj.data,
      } as unknown as CustomersUpsertResp;
  }
  return res as CustomersUpsertResp;
}

export const Customers = {
  async upsert(rows: CustomersUpsertReq): Promise<CustomersUpsertResp> {
    const res = await api.callIdem(
      "customersUpsert",
      rows,
      idemKey(["customersUpsert", rows]),
    );
    return normalizeUpsertResp(res);
  },

  patch: (rows: CustomersPatchReq) =>
    api.callIdem(
      "customersPatch",
      rows,
      idemKey(["customersPatch", rows]),
    ) as Promise<CustomersPatchResp>,

  delete: (ids: string | string[]) => {
    const payload = Array.isArray(ids) ? { ids } : { ids: [ids] };
    return api.callIdem(
      "customersDelete",
      payload,
      idemKey(["customersDelete", payload]),
    ) as Promise<CustomersSoftDeleteResp>;
  },

  adminDelete: (ids: string | string[]) => {
    const payload = Array.isArray(ids) ? { ids } : { ids: [ids] };
    return api.callIdem(
      "customersAdminDelete",
      payload,
      idemKey(["customersAdminDelete", payload]),
    ) as Promise<CustomersHardDeleteResp>;
  },

  /** Return Customer | null (404 becomes null) */
  async get(id: string): Promise<TCustomerEntity | null> {
    try {
      const res = (await api.get("customersGet", { id })) as CustomersGetResp;
      return (res?.customer as TCustomerEntity) ?? null;
    } catch (e: unknown) {
      const err = e as { meta?: { status?: number } };
      if (err?.meta?.status === 404) return null;
      throw e;
    }
  },

  /** Always return an array of customers */
  async list(query?: {
    limit?: number | string;
    active?:
      | "all"
      | "true"
      | "false"
      | "1"
      | "0"
      | "yes"
      | "no"
      | "active"
      | "inactive";
    deleted?: "exclude" | "only" | "include";
    cursorUpdatedAt?:
      | number
      | string
      | { seconds: number; nanoseconds: number };
    cursorId?: string;
    caseManagerId?: string;
    contactCaseManagerId?: string;
  }): Promise<TCustomerEntity[]> {
    const maxPerPage = 500;
    const requestedLimitRaw =
      query?.limit === undefined
        ? undefined
        : typeof query.limit === "string"
          ? Number(query.limit)
          : query.limit;

    const req: CustomersListQuery | undefined = query
      ? {
          ...query,
          limit: requestedLimitRaw,
          active:
            query.active === "active" ||
            query.active === "true" ||
            query.active === "1" ||
            query.active === "yes"
              ? true
              : query.active === "inactive" ||
                  query.active === "false" ||
                  query.active === "0" ||
                  query.active === "no"
                ? false
                : "all",
        }
      : undefined;

    const asItems = (res: unknown): TCustomerEntity[] => {
      if (Array.isArray(res)) return res as TCustomerEntity[];
      if (
        res &&
        typeof res === "object" &&
        Array.isArray((res as { items?: unknown }).items)
      ) {
        return (res as { items: TCustomerEntity[] }).items;
      }
      return [];
    };

    const needsPagination =
      Number.isFinite(requestedLimitRaw) && (requestedLimitRaw as number) > maxPerPage;
    const firstReq: CustomersListQuery | undefined = req
      ? { ...req, limit: needsPagination ? maxPerPage : req.limit }
      : req;

    const onePage = await api.get("customersList", firstReq);
    if (!needsPagination) {
      return asItems(onePage);
    }

    const target = Math.max(1, requestedLimitRaw as number);
    const firstItems = asItems(onePage);
    const firstNext =
      onePage && typeof onePage === "object"
        ? ((onePage as { next?: { cursorUpdatedAt?: unknown; cursorId?: string } | null }).next ?? null)
        : null;

    const out: TCustomerEntity[] = [...firstItems];
    let next = firstNext;

    while (out.length < target && next?.cursorId) {
      const remaining = target - out.length;
      const page = await api.get("customersList", {
        ...(req || {}),
        limit: Math.min(maxPerPage, remaining),
        cursorUpdatedAt: next.cursorUpdatedAt as any,
        cursorId: next.cursorId,
      });
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

  /** Fetch every page (up to guard rails) for accurate counts/aggregates. */
  async listAll(
    query?: Omit<
      {
        limit?: number | string;
        active?:
          | "all"
          | "true"
          | "false"
          | "1"
          | "0"
          | "yes"
          | "no"
          | "active"
          | "inactive";
        deleted?: "exclude" | "only" | "include";
        cursorUpdatedAt?:
          | number
          | string
          | { seconds: number; nanoseconds: number };
        cursorId?: string;
        caseManagerId?: string;
        contactCaseManagerId?: string;
      },
      "limit" | "cursorUpdatedAt" | "cursorId"
    >,
    opts?: { maxPages?: number; maxItems?: number }
  ): Promise<TCustomerEntity[]> {
    const maxPerPage = 500;
    const maxPages = Math.max(1, Number(opts?.maxPages ?? 200));
    const maxItems = Math.max(maxPerPage, Number(opts?.maxItems ?? 50_000));

    const base: CustomersListQuery = {
      ...(query || {}),
      active:
        query?.active === "active" ||
        query?.active === "true" ||
        query?.active === "1" ||
        query?.active === "yes"
          ? true
          : query?.active === "inactive" ||
              query?.active === "false" ||
              query?.active === "0" ||
              query?.active === "no"
            ? false
            : "all",
      limit: maxPerPage,
    } as CustomersListQuery;

    const asItems = (res: unknown): TCustomerEntity[] => {
      if (Array.isArray(res)) return res as TCustomerEntity[];
      if (res && typeof res === "object" && Array.isArray((res as any).items)) {
        return (res as any).items as TCustomerEntity[];
      }
      return [];
    };

    const out: TCustomerEntity[] = [];
    let cursorUpdatedAt: unknown = undefined;
    let cursorId: string | undefined = undefined;

    for (let i = 0; i < maxPages; i++) {
      const page: unknown = await api.get("customersList", {
        ...base,
        cursorUpdatedAt: cursorUpdatedAt as any,
        cursorId,
      });
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

  backfillNames: (body: ReqOf<"customersBackfillNames">) =>
    api.callIdem(
      "customersBackfillNames",
      body,
      idemKey(["customersBackfillNames", body]),
    ) as Promise<RespOf<"customersBackfillNames">>,

  backfillCaseManagerNames: (body: ReqOf<"customersBackfillCaseManagerNames">) =>
    api.callIdem(
      "customersBackfillCaseManagerNames",
      body,
      idemKey(["customersBackfillCaseManagerNames", body]),
    ) as Promise<RespOf<"customersBackfillCaseManagerNames">>,

  backfillAssistanceLength: (body: ReqOf<"customersBackfillAssistanceLength">) =>
    api.callIdem(
      "customersBackfillAssistanceLength",
      body,
      idemKey(["customersBackfillAssistanceLength", body]),
    ) as Promise<RespOf<"customersBackfillAssistanceLength">>,
};

export default Customers;
