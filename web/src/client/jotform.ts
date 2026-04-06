import api from "./api";
import { idemKey } from "@lib/idem";
import type {
  JotformSubmissionsUpsertReq,
  JotformSubmissionsUpsertResp,
  JotformSubmissionsPatchReq,
  JotformSubmissionsPatchResp,
  JotformSubmissionsDeleteResp,
  JotformSubmissionsAdminDeleteResp,
  JotformSubmissionsListReq,
  JotformSubmissionsListResp,
  JotformSubmissionsGetResp,
  JotformSubmissionsStructureResp,
  JotformFormsListReq,
  JotformFormsListResp,
  JotformLinkSubmissionReq,
  JotformLinkSubmissionResp,
  JotformSyncSelectionReq,
  JotformSyncSelectionResp,
  JotformDigestUpsertReq,
  JotformDigestUpsertResp,
  JotformDigestGetReq,
  JotformDigestGetResp,
  JotformDigestListReq,
  JotformDigestListResp,
  JotformSyncSubmissionsReq,
  JotformSyncSubmissionsResp,
  JotformApiListReq,
  JotformApiListResp,
  JotformApiGetResp,
} from "@types";

const asIds = (idOrIds: string | string[]) =>
  Array.isArray(idOrIds) ? idOrIds.map(String) : String(idOrIds);

export const Jotform = {
  upsert: (body: JotformSubmissionsUpsertReq): Promise<JotformSubmissionsUpsertResp> =>
    api.callIdem(
      "jotformSubmissionsUpsert",
      body,
      idemKey({ scope: "jotform", op: "upsert", body })
    ),

  patch: (body: JotformSubmissionsPatchReq): Promise<JotformSubmissionsPatchResp> =>
    api.callIdem(
      "jotformSubmissionsPatch",
      body,
      idemKey({ scope: "jotform", op: "patch", body })
    ),

  delete: (idOrIds: string | string[]): Promise<JotformSubmissionsDeleteResp> =>
    api.callIdem(
      "jotformSubmissionsDelete",
      asIds(idOrIds),
      idemKey({ scope: "jotform", op: "delete", idOrIds: asIds(idOrIds) })
    ),

  adminDelete: (idOrIds: string | string[]): Promise<JotformSubmissionsAdminDeleteResp> =>
    api.callIdem(
      "jotformSubmissionsAdminDelete",
      asIds(idOrIds),
      idemKey({ scope: "jotform", op: "adminDelete", idOrIds: asIds(idOrIds) })
    ),

  list: async (query: JotformSubmissionsListReq = {}): Promise<JotformSubmissionsListResp> => {
    const maxPerPage = 500;
    const requested = Number((query as any)?.limit);
    const needsPagination = Number.isFinite(requested) && requested > maxPerPage;

    const first = (await api.get("jotformSubmissionsList", {
      ...(query || {}),
      ...(needsPagination ? { limit: maxPerPage } : {}),
    } as any)) as JotformSubmissionsListResp;

    if (!needsPagination) return first;

    const target = Math.max(1, requested);
    const outItems = Array.isArray((first as any)?.items) ? [...((first as any).items as any[])] : [];
    let next = ((first as any)?.next as { cursorUpdatedAt?: unknown; cursorId?: string } | null | undefined) ?? null;

    while (outItems.length < target && next?.cursorId) {
      const remaining = target - outItems.length;
      const page = (await api.get("jotformSubmissionsList", {
        ...(query || {}),
        limit: Math.min(maxPerPage, remaining),
        cursorUpdatedAt: next.cursorUpdatedAt,
        cursorId: next.cursorId,
      } as any)) as JotformSubmissionsListResp;

      const items = Array.isArray((page as any)?.items) ? ((page as any).items as any[]) : [];
      if (!items.length) break;
      outItems.push(...items);
      next = ((page as any)?.next as { cursorUpdatedAt?: unknown; cursorId?: string } | null | undefined) ?? null;
    }

    return {
      ...(first as any),
      items: outItems.slice(0, target),
      next,
    } as JotformSubmissionsListResp;
  },

  get: (id: string): Promise<JotformSubmissionsGetResp> =>
    api.get("jotformSubmissionsGet", { id }),

  structure: (): Promise<JotformSubmissionsStructureResp> =>
    api.get("jotformSubmissionsStructure"),

  formsList: (query: JotformFormsListReq = {}): Promise<JotformFormsListResp> =>
    api.get("jotformFormsList", {
      ...query,
      ...(Number((query as any)?.limit) > 500 ? { limit: 500 } : {}),
    } as any),

  linkSubmission: (body: JotformLinkSubmissionReq): Promise<JotformLinkSubmissionResp> =>
    api.callIdem(
      "jotformLinkSubmission",
      body,
      idemKey({ scope: "jotform", op: "linkSubmission", body })
    ),

  syncSelection: (body: JotformSyncSelectionReq): Promise<JotformSyncSelectionResp> =>
    api.callIdem(
      "jotformSyncSelection",
      body,
      idemKey({ scope: "jotform", op: "syncSelection", body })
    ),

  digestUpsert: (body: JotformDigestUpsertReq): Promise<JotformDigestUpsertResp> =>
    api.callIdem(
      "jotformDigestUpsert",
      body,
      idemKey({ scope: "jotform", op: "digestUpsert", body })
    ),

  digestGet: (query: JotformDigestGetReq): Promise<JotformDigestGetResp> =>
    api.get("jotformDigestGet", query),

  digestList: (query: JotformDigestListReq = {}): Promise<JotformDigestListResp> =>
    api.get("jotformDigestList", {
      ...query,
      ...(Number((query as any)?.limit) > 500 ? { limit: 500 } : {}),
    } as any),

  syncSubmissions: (body: JotformSyncSubmissionsReq): Promise<JotformSyncSubmissionsResp> =>
    api.callIdem(
      "jotformSyncSubmissions",
      body,
      idemKey({ scope: "jotform", op: "syncSubmissions", body })
    ),

  // Live proxies — fetch directly from Jotform API, nothing stored in Firestore
  apiList: (query: JotformApiListReq): Promise<JotformApiListResp> =>
    api.get("jotformApiSubmissionsList", query as any),

  apiGet: (id: string): Promise<JotformApiGetResp> =>
    api.get("jotformApiSubmissionGet", { id }),
};

export default Jotform;
