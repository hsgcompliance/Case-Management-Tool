import { useMutation } from "@tanstack/react-query";
import ReconciliationAudit from "@client/reconciliationAudit";
import type { ReconciliationAuditScanReq } from "@types";

export function useReconciliationAuditScan() {
  return useMutation({
    mutationFn: (body: ReconciliationAuditScanReq = {}) => ReconciliationAudit.scan(body),
  });
}
