import api from "./api";
import { idemKey } from "@lib/idem";
import type {
  LedgerListReq,
  LedgerListResp,
  LedgerCreateReq,
  LedgerCreateResp,
  LedgerClassifyReq,
  LedgerClassifyResp,
  LedgerAutoAssignReq,
  LedgerAutoAssignResp,
  LedgerGetByIdReq,
  LedgerGetByIdResp,
  LedgerBalanceReq,
  LedgerBalanceResp,
  LedgerDeleteReq,
  LedgerDeleteResp,
} from "@types";

export const Ledger = {
  list: (query?: Partial<LedgerListReq>): Promise<LedgerListResp> =>
    api.get(
      "ledgerList",
      {
        ...(query || {}),
        ...(Number((query as any)?.limit) > 500 ? { limit: 500 } : {}),
      } as LedgerListReq
    ),

  create: (body: LedgerCreateReq): Promise<LedgerCreateResp> =>
    api.callIdem(
      "ledgerCreate",
      body,
      idemKey({ scope: "ledger", op: "create", body })
    ),

  classify: (body: LedgerClassifyReq): Promise<LedgerClassifyResp> =>
    api.callIdem(
      "ledgerClassify",
      body,
      idemKey({ scope: "ledger", op: "classify", body })
    ),

  autoAssign: (body: LedgerAutoAssignReq): Promise<LedgerAutoAssignResp> =>
    api.callIdem(
      "ledgerAutoAssign",
      body,
      idemKey({ scope: "ledger", op: "autoAssign", body })
    ),

  getById: (query: LedgerGetByIdReq): Promise<LedgerGetByIdResp> =>
    api.get("ledgerGetById", query),

  balance: (query?: Partial<LedgerBalanceReq>): Promise<LedgerBalanceResp> =>
    api.get("ledgerBalance", (query || {}) as LedgerBalanceReq),

  delete: (entryId: string): Promise<LedgerDeleteResp> => {
    const req: LedgerDeleteReq = { entryId };
    return api.callIdem(
      "ledgerDelete",
      req,
      idemKey({ scope: "ledger", op: "delete", entryId })
    );
  },
};

export default Ledger;
