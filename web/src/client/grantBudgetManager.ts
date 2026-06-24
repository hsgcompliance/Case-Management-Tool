import api from "./api";
import { idemKey } from "@lib/idem";
import type {
  GrantBudgetManagerLoadReq,
  GrantBudgetManagerLoadResp,
  GrantBudgetManagerSaveReq,
  GrantBudgetManagerSaveResp,
  GrantBudgetManagerReconcileReq,
  GrantBudgetManagerReconcileResp,
} from "@types";

export const GrantBudgetManager = {
  load: (body: GrantBudgetManagerLoadReq): Promise<GrantBudgetManagerLoadResp> =>
    api.post("grantBudgetManagerLoad", body),

  save: (body: GrantBudgetManagerSaveReq): Promise<GrantBudgetManagerSaveResp> =>
    api.call("grantBudgetManagerSave", {
      body,
      idempotencyKey: idemKey({ scope: "grantBudgetManager", op: "save", body }),
      timeoutOverrideMs: 300_000,
      retriesOverride: 0,
    }),

  reconcile: (body: GrantBudgetManagerReconcileReq): Promise<GrantBudgetManagerReconcileResp> =>
    api.call("grantBudgetManagerReconcile", {
      body,
      idempotencyKey: idemKey({ scope: "grantBudgetManager", op: "reconcile", body }),
      timeoutOverrideMs: 300_000,
      retriesOverride: 0,
    }),
};

export default GrantBudgetManager;
