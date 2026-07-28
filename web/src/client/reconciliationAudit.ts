import api from "./api";
import type { ReconciliationAuditScanReq, ReconciliationAuditScanResp } from "@types";

export const ReconciliationAudit = {
  scan: (body: ReconciliationAuditScanReq = {}): Promise<ReconciliationAuditScanResp> =>
    api.call("reconciliationAuditScan", {
      body,
      timeoutOverrideMs: 300_000,
      retriesOverride: 0,
    }),
};

export default ReconciliationAudit;
