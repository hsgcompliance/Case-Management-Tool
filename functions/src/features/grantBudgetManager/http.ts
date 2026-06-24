import { secureHandler, orgIdFromClaims } from "../../core";
import {
  GrantBudgetManagerLoadBody,
  GrantBudgetManagerReconcileBody,
  GrantBudgetManagerSaveBody,
} from "./schemas";
import {
  loadGrantBudgetManager,
  reconcileGrantBudgetManager,
  saveGrantBudgetManager,
} from "./service";

export const grantBudgetManagerLoad = secureHandler(
  async (req, res): Promise<void> => {
    const src = req.method === "GET" ? req.query : req.body;
    const body = GrantBudgetManagerLoadBody.parse(src || {});
    const caller = (req as any).user || {};
    const orgId = orgIdFromClaims(caller);
    if (!orgId) {
      res.status(400).json({ ok: false, error: "org_required" });
      return;
    }
    const out = await loadGrantBudgetManager(orgId, body.grantIds);
    res.json(out);
  },
  { auth: "viewer", requireOrg: true, methods: ["GET", "POST", "OPTIONS"], memory: "512MiB", timeoutSeconds: 120 },
);

export const grantBudgetManagerSave = secureHandler(
  async (req, res): Promise<void> => {
    const body = GrantBudgetManagerSaveBody.parse(req.body || {});
    const caller = (req as any).user || {};
    const orgId = orgIdFromClaims(caller);
    if (!orgId) {
      res.status(400).json({ ok: false, error: "org_required" });
      return;
    }
    const out = await saveGrantBudgetManager(orgId, body.grantIds, body.rows, body.mode, caller, body.reason);
    res.json(out);
  },
  { auth: "admin", requireOrg: true, methods: ["POST", "OPTIONS"], memory: "512MiB", timeoutSeconds: 300, concurrency: 4 },
);

export const grantBudgetManagerReconcile = secureHandler(
  async (req, res): Promise<void> => {
    const body = GrantBudgetManagerReconcileBody.parse(req.body || {});
    const caller = (req as any).user || {};
    const orgId = orgIdFromClaims(caller);
    if (!orgId) {
      res.status(400).json({ ok: false, error: "org_required" });
      return;
    }
    const out = await reconcileGrantBudgetManager(orgId, body.grantIds);
    res.json(out);
  },
  { auth: "admin", requireOrg: true, methods: ["POST", "OPTIONS"], memory: "512MiB", timeoutSeconds: 300, concurrency: 4 },
);
