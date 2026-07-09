"use client";

import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import FullPageModal from "@entities/ui/FullPageModal";
import { usePatchCustomers } from "@hooks/useCustomers";
import { qk } from "@hooks/queryKeys";
import { toast } from "@lib/toast";
import type { CustomersPatchReq } from "@types";
import { buildActionPreviews } from "./reconciliationActions";
import type { ReconciliationFinding } from "./reconciliationReview";

type HmisPatchRow = {
  id: string;
  findingId: string;
  customerId: string;
  customerLabel: string;
  dob: string;
  currentHmisId: string;
  proposedHmisId: string;
  sourceFile: string;
  sourceRowNumber: number | null;
  confidence: number;
  matchCriteria: string[];
  warnings: string[];
  blocked: boolean;
  blockReason: string;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function displayCustomerName(finding: ReconciliationFinding) {
  const matched = finding.matchedCustomer;
  const first = text(matched?.firstName);
  const last = text(matched?.lastName);
  return finding.customerLabel || text(matched?.name) || text(matched?.fullName) || `${first} ${last}`.trim() || text(finding.customerId) || "Unknown customer";
}

function customerDob(finding: ReconciliationFinding) {
  return text(finding.matchedCustomer?.dob ?? finding.matchedCustomer?.dateOfBirth ?? finding.matchedCustomer?.birthDate) || "-";
}

export function buildBulkHmisCustomerPatchRows(findings: ReconciliationFinding[]): HmisPatchRow[] {
  const rawRows: HmisPatchRow[] = [];
  for (const finding of findings) {
    for (const action of buildActionPreviews(finding)) {
      if (action.target !== "customers" || action.kind !== "push_hmis_id") continue;
      const customerId = text(action.targetId);
      const proposedHmisId = text(action.proposedValue);
      if (!customerId || !proposedHmisId) continue;
      const currentHmisId = action.currentValue === "(blank)" ? "" : text(action.currentValue);
      const warnings: string[] = [];
      if (finding.confidence < 0.95) warnings.push("Match is below the preferred confidence threshold; review DOB and source row before applying.");
      rawRows.push({
        id: `${customerId}:${proposedHmisId}`,
        findingId: finding.id,
        customerId,
        customerLabel: displayCustomerName(finding),
        dob: customerDob(finding),
        currentHmisId,
        proposedHmisId,
        sourceFile: finding.sourceFile,
        sourceRowNumber: finding.sourceRowNumber,
        confidence: finding.confidence,
        matchCriteria: finding.match?.criteria ?? [],
        warnings,
        blocked: Boolean(currentHmisId && currentHmisId !== proposedHmisId),
        blockReason: currentHmisId && currentHmisId !== proposedHmisId ? "Customer already has a different HMIS ID." : "",
      });
    }
  }

  const byPair = new Map<string, HmisPatchRow>();
  for (const row of rawRows) {
    const existing = byPair.get(row.id);
    if (!existing || row.confidence > existing.confidence) byPair.set(row.id, row);
  }

  const rows = Array.from(byPair.values());
  const hmisToCustomers = new Map<string, Set<string>>();
  const customerToHmis = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!hmisToCustomers.has(row.proposedHmisId)) hmisToCustomers.set(row.proposedHmisId, new Set());
    hmisToCustomers.get(row.proposedHmisId)!.add(row.customerId);
    if (!customerToHmis.has(row.customerId)) customerToHmis.set(row.customerId, new Set());
    customerToHmis.get(row.customerId)!.add(row.proposedHmisId);
  }

  return rows
    .map((row) => {
      const duplicateHmis = (hmisToCustomers.get(row.proposedHmisId)?.size ?? 0) > 1;
      const conflictingCustomer = (customerToHmis.get(row.customerId)?.size ?? 0) > 1;
      const blockReason =
        row.blockReason ||
        (duplicateHmis ? "Same HMIS ID is proposed for multiple dashboard customers." : "") ||
        (conflictingCustomer ? "Multiple HMIS IDs are proposed for this dashboard customer." : "");
      return { ...row, blocked: row.blocked || duplicateHmis || conflictingCustomer, blockReason };
    })
    .sort((a, b) => a.customerLabel.localeCompare(b.customerLabel));
}

export default function ReconciliationBulkCustomerPatchModal({
  isOpen,
  findings,
  onClose,
  onApplied,
}: {
  isOpen: boolean;
  findings: ReconciliationFinding[];
  onClose: () => void;
  onApplied: () => void;
}) {
  const patchCustomers = usePatchCustomers();
  const queryClient = useQueryClient();
  const rows = React.useMemo(() => buildBulkHmisCustomerPatchRows(findings), [findings]);
  const eligibleIds = React.useMemo(() => new Set(rows.filter((row) => !row.blocked).map((row) => row.id)), [rows]);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (isOpen) setSelectedIds(new Set(eligibleIds));
  }, [eligibleIds, isOpen]);

  if (!isOpen) return null;

  const eligibleRows = rows.filter((row) => !row.blocked);
  const blockedRows = rows.filter((row) => row.blocked);
  const selectedRows = rows.filter((row) => selectedIds.has(row.id) && !row.blocked);
  const allEligibleSelected = eligibleRows.length > 0 && eligibleRows.every((row) => selectedIds.has(row.id));

  const toggleAll = () => {
    setSelectedIds(allEligibleSelected ? new Set() : new Set(eligibleIds));
  };

  const toggleOne = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const apply = async () => {
    const payload = selectedRows.map((row) => ({
      id: row.customerId,
      patch: { hmisId: row.proposedHmisId },
    })) as CustomersPatchReq;
    if (!selectedRows.length) {
      toast("Select at least one eligible HMIS ID update.", { type: "warn" });
      return;
    }
    try {
      await patchCustomers.mutateAsync(payload);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.customers.root }),
        queryClient.invalidateQueries({ queryKey: qk.dashboard.root }),
      ]);
      toast(`Updated ${selectedRows.length} customer${selectedRows.length === 1 ? "" : "s"} with HMIS IDs.`, { type: "success" });
      onApplied();
      onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to update customer HMIS IDs.", { type: "error" });
    }
  };

  return (
    <FullPageModal
      isOpen
      onClose={onClose}
      disableOverlayClose={patchCustomers.isPending}
      topBar={
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-600">Bulk Workspace</div>
            <div className="mt-1 text-xl font-semibold text-slate-950">Push HMIS IDs</div>
            <div className="mt-1 text-sm text-slate-500">Review matched report rows before patching customer documents.</div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button type="button" className="btn btn-ghost btn-sm" onClick={toggleAll} disabled={!eligibleRows.length || patchCustomers.isPending}>
              {allEligibleSelected ? "Clear eligible" : "Select eligible"}
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void apply()} disabled={patchCustomers.isPending || selectedRows.length === 0}>
              {patchCustomers.isPending ? "Updating..." : `Apply ${selectedRows.length}`}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={patchCustomers.isPending}>
              Close
            </button>
          </div>
        </div>
      }
      leftPane={
        <div className="space-y-4 p-5">
          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Selected Updates</div>
            <div className="mt-2 text-3xl font-semibold text-slate-950">{selectedRows.length}</div>
            <div className="mt-1 text-sm text-slate-500">{eligibleRows.length} eligible, {blockedRows.length} blocked</div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Guardrails</div>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <div>Existing different HMIS IDs are blocked.</div>
              <div>Duplicate proposed HMIS IDs are blocked.</div>
              <div>Lower-confidence matches stay selectable but show warnings.</div>
            </div>
          </div>
        </div>
      }
      rightPane={
        <div className="h-full overflow-y-auto bg-slate-50 p-6">
          <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-sm font-semibold text-slate-950">Customer Patch Preview</div>
                <div className="text-xs text-slate-500">Patches use the existing customersPatch endpoint and server BulkWriter.</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Apply</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Current HMIS</th>
                    <th className="px-4 py-3">Proposed HMIS</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Match</th>
                    <th className="px-4 py-3">Warnings</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 align-top">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.id) && !row.blocked}
                          disabled={row.blocked || patchCustomers.isPending}
                          onChange={() => toggleOne(row.id)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{row.customerLabel}</div>
                        <div className="text-xs text-slate-500">DOB {row.dob}</div>
                        <div className="text-xs text-slate-400">{row.customerId}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{row.currentHmisId || "(blank)"}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{row.proposedHmisId}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="max-w-56 truncate" title={row.sourceFile}>{row.sourceFile}</div>
                        <div className="text-xs text-slate-400">row {row.sourceRowNumber ?? "-"}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <div>{Math.round(row.confidence * 100)}%</div>
                        <div className="mt-1 max-w-80 text-xs text-slate-500">{row.matchCriteria.slice(0, 2).join(" ") || "No match criteria recorded."}</div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {row.blocked ? <div className="font-medium text-red-700">{row.blockReason}</div> : null}
                        {row.warnings.map((warning) => <div key={warning} className="text-amber-700">{warning}</div>)}
                        {!row.blocked && !row.warnings.length ? <span className="text-emerald-700">Ready</span> : null}
                      </td>
                    </tr>
                  ))}
                  {!rows.length ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                        No selected findings contain HMIS ID customer patch actions.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      }
    />
  );
}
