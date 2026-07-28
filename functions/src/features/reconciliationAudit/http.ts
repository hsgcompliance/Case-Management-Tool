// functions/src/features/reconciliationAudit/http.ts
import { secureHandler, orgIdFromClaims } from "../../core";
import { ReconciliationAuditScanBody } from "./schemas";
import { runReconciliationAuditScan } from "./service";

export const reconciliationAuditScan = secureHandler(
  async (req, res): Promise<void> => {
    const src = req.method === "GET" ? req.query : req.body;
    const body = ReconciliationAuditScanBody.parse(src || {});
    const caller = (req as any).user || {};
    const orgId = orgIdFromClaims(caller);
    if (!orgId) {
      res.status(400).json({ ok: false, error: "org_required" });
      return;
    }
    const out = await runReconciliationAuditScan(orgId, body.grantIds);
    res.json(out);
  },
  { auth: "admin", requireOrg: true, methods: ["GET", "POST", "OPTIONS"], memory: "512MiB", timeoutSeconds: 300 },
);
