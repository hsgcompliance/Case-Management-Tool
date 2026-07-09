"use client";

import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import FullPageModal from "@entities/ui/FullPageModal";
import { useEnrollmentsBulkEnroll, useEnrollmentsPatch } from "@hooks/useEnrollments";
import { qk } from "@hooks/queryKeys";
import { toast } from "@lib/toast";
import type { EnrollmentsBulkEnrollReq, EnrollmentsPatchReq } from "@types";
import type { ReconciliationFinding } from "./reconciliationReview";

type GrantOption = {
  id: string;
  name: string;
};

type EnrollmentReviewRow = {
  id: string;
  findingId: string;
  mode: "create" | "patch";
  customerId: string;
  customerLabel: string;
  enrollmentId: string;
  grantId: string;
  reportGrant: string;
  startDate: string;
  endDate: string;
  sourceFile: string;
  sourceRowNumber: number | null;
  confidence: number;
  warnings: string[];
  blocked: boolean;
  blockReason: string;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeDate(value: unknown) {
  const raw = text(value);
  if (!raw) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function customerLabel(finding: ReconciliationFinding) {
  const matched = finding.matchedCustomer;
  const first = text(matched?.firstName ?? matched?.givenName);
  const last = text(matched?.lastName ?? matched?.surname);
  return finding.customerLabel || text(matched?.name ?? matched?.fullName) || `${first} ${last}`.trim() || text(finding.customerId) || "Unknown customer";
}

function grantLabel(grant: GrantOption) {
  return `${grant.name} ${grant.id}`.toLowerCase();
}

function findGrantId(reportGrant: string, grants: GrantOption[]) {
  const needle = reportGrant.toLowerCase();
  if (!needle) return "";
  const exact = grants.find((grant) => grant.id.toLowerCase() === needle || grant.name.toLowerCase() === needle);
  if (exact) return exact.id;
  const loose = grants.find((grant) => {
    const haystack = grantLabel(grant);
    return haystack.includes(needle) || needle.includes(grant.name.toLowerCase());
  });
  return loose?.id || "";
}

function existingEnrollmentKey(row: Record<string, unknown>) {
  return [
    text(row.customerId ?? row.clientId),
    text(row.grantId ?? row.programId),
    normalizeDate(row.startDate ?? row.entryDate ?? row.enrolledAt),
    normalizeDate(row.endDate ?? row.exitDate ?? row.closedAt),
  ].join("|");
}

function validateRows(rows: EnrollmentReviewRow[], enrollments: Array<Record<string, unknown>>) {
  const existingKeys = new Set(enrollments.map(existingEnrollmentKey));
  const createCounts = new Map<string, number>();
  for (const row of rows) {
    if (row.mode !== "create") continue;
    const key = [row.customerId, row.grantId, row.startDate, row.endDate].join("|");
    createCounts.set(key, (createCounts.get(key) ?? 0) + 1);
  }

  return rows.map((row) => {
    const warnings = [...row.warnings.filter((warning) => !warning.startsWith("Duplicate selected source rows") && !warning.startsWith("Start date is blank") && !warning.startsWith("Match confidence is low"))];
    let blockReason = "";
    if (!row.customerId) blockReason = "No dashboard customer is matched.";
    if (row.mode === "create" && !row.grantId) blockReason = "Choose a dashboard grant for this report provider.";
    if (row.mode === "patch" && !row.enrollmentId) blockReason = "No dashboard enrollment is matched.";
    if (row.mode === "create" && !row.startDate) warnings.push("Start date is blank; confirm before creating.");
    if (row.confidence < 0.75) warnings.push("Match confidence is low; review identity before applying.");
    if (row.mode === "create" && existingKeys.has([row.customerId, row.grantId, row.startDate, row.endDate].join("|"))) {
      blockReason = "An enrollment with the same customer, grant, start date, and end date already exists.";
    }
    if (row.mode === "create" && (createCounts.get([row.customerId, row.grantId, row.startDate, row.endDate].join("|")) ?? 0) > 1) {
      warnings.push("Duplicate selected source rows describe the same enrollment; only one will be applied.");
    }
    return { ...row, warnings, blocked: Boolean(blockReason), blockReason };
  });
}

export function buildBulkEnrollmentRows(
  findings: ReconciliationFinding[],
  grants: GrantOption[],
  enrollments: Array<Record<string, unknown>>,
  globalGrantId = "",
): EnrollmentReviewRow[] {
  const rawRows: EnrollmentReviewRow[] = [];

  for (const finding of findings) {
    const record = finding.reportRecord;
    if (!record) continue;
    const sourceGrant = text(record.enrollmentEvidence.projectName || record.enrollmentEvidence.programId || record.paymentEvidence.grant);
    const grantId = globalGrantId || findGrantId(sourceGrant, grants);
    const customerId = text(finding.customerId || finding.matchedCustomer?.id);
    const enrollmentId = text(finding.enrollmentId || finding.matchedEnrollment?.id);
    const startDate = normalizeDate(record.enrollmentEvidence.entryDate);
    const endDate = normalizeDate(record.enrollmentEvidence.exitDate);

    if (finding.kind === "enrollment_missing") {
      const row: EnrollmentReviewRow = {
        id: `create:${customerId}:${grantId}:${startDate}:${endDate}:${finding.id}`,
        findingId: finding.id,
        mode: "create",
        customerId,
        customerLabel: customerLabel(finding),
        enrollmentId: "",
        grantId,
        reportGrant: sourceGrant,
        startDate,
        endDate,
        sourceFile: finding.sourceFile,
        sourceRowNumber: finding.sourceRowNumber,
        confidence: finding.confidence,
        warnings: [],
        blocked: false,
        blockReason: "",
      };
      rawRows.push(row);
    }

    if ((finding.kind === "entry_date_mismatch" || finding.kind === "exit_date_mismatch") && enrollmentId) {
      rawRows.push({
        id: `patch:${enrollmentId}:${startDate}:${endDate}:${finding.id}`,
        findingId: finding.id,
        mode: "patch",
        customerId,
        customerLabel: customerLabel(finding),
        enrollmentId,
        grantId: text(finding.matchedEnrollment?.grantId ?? finding.matchedEnrollment?.programId ?? grantId),
        reportGrant: sourceGrant,
        startDate,
        endDate,
        sourceFile: finding.sourceFile,
        sourceRowNumber: finding.sourceRowNumber,
        confidence: finding.confidence,
        warnings: [],
        blocked: false,
        blockReason: "",
      });
    }
  }

  const seen = new Set<string>();
  return validateRows(rawRows, enrollments)
    .filter((row) => {
      const dedupeKey = row.mode === "create"
        ? [row.mode, row.customerId, row.grantId, row.startDate, row.endDate].join("|")
        : [row.mode, row.enrollmentId].join("|");
      if (seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
      return true;
    })
    .sort((a, b) => a.customerLabel.localeCompare(b.customerLabel) || a.reportGrant.localeCompare(b.reportGrant));
}

export default function ReconciliationBulkEnrollmentModal({
  isOpen,
  findings,
  grants,
  enrollments,
  onClose,
  onApplied,
}: {
  isOpen: boolean;
  findings: ReconciliationFinding[];
  grants: GrantOption[];
  enrollments: Array<Record<string, unknown>>;
  onClose: () => void;
  onApplied: () => void;
}) {
  const bulkEnroll = useEnrollmentsBulkEnroll();
  const patchEnrollments = useEnrollmentsPatch();
  const queryClient = useQueryClient();
  const [globalGrantId, setGlobalGrantId] = React.useState("");
  const [closeExited, setCloseExited] = React.useState(true);
  const [rows, setRows] = React.useState<EnrollmentReviewRow[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (!isOpen) return;
    const nextRows = buildBulkEnrollmentRows(findings, grants, enrollments, globalGrantId);
    setRows(nextRows);
    setSelectedIds(new Set(nextRows.filter((row) => !row.blocked).map((row) => row.id)));
  }, [enrollments, findings, globalGrantId, grants, isOpen]);

  if (!isOpen) return null;

  const displayRows = validateRows(rows, enrollments);
  const eligibleRows = displayRows.filter((row) => !row.blocked);
  const selectedRows = displayRows.filter((row) => selectedIds.has(row.id) && !row.blocked);
  const createRows = selectedRows.filter((row) => row.mode === "create");
  const patchRows = selectedRows.filter((row) => row.mode === "patch");
  const blockedRows = displayRows.filter((row) => row.blocked);
  const allEligibleSelected = eligibleRows.length > 0 && eligibleRows.every((row) => selectedIds.has(row.id));
  const busy = bulkEnroll.isPending || patchEnrollments.isPending;

  const updateRow = (id: string, patch: Partial<EnrollmentReviewRow>) => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
  };

  const toggleAll = () => {
    setSelectedIds(allEligibleSelected ? new Set() : new Set(eligibleRows.map((row) => row.id)));
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
    if (!selectedRows.length) {
      toast("Select at least one enrollment update.", { type: "warn" });
      return;
    }
    try {
      const rowsByGrant = new Map<string, EnrollmentReviewRow[]>();
      for (const row of createRows) rowsByGrant.set(row.grantId, [...(rowsByGrant.get(row.grantId) ?? []), row]);
      for (const [grantId, grantRows] of rowsByGrant.entries()) {
        const perCustomerExtra: Record<string, Record<string, unknown>> = {};
        for (const row of grantRows) {
          const extra: Record<string, unknown> = {
            startDate: row.startDate || null,
            endDate: row.endDate || null,
            active: closeExited && row.endDate ? false : true,
            status: closeExited && row.endDate ? "closed" : "active",
          };
          if (row.sourceFile.toLowerCase().includes("hmis")) {
            extra.compliance = { hmisEntryComplete: true, hmisExitComplete: Boolean(row.endDate) };
          }
          perCustomerExtra[row.customerId] = {
            ...extra,
          };
        }
        await bulkEnroll.mutateAsync({
          grantId,
          customerIds: grantRows.map((row) => row.customerId),
          skipIfExists: true,
          existsMode: "nonDeleted",
          perCustomerExtra,
        } as EnrollmentsBulkEnrollReq);
      }

      if (patchRows.length) {
        const payload = patchRows.map((row) => {
          const patch: Record<string, unknown> = {};
          if (row.startDate) patch.startDate = row.startDate;
          if (row.endDate) patch.endDate = row.endDate;
          if (closeExited && row.endDate) {
            patch.active = false;
            patch.status = "closed";
          }
          return { id: row.enrollmentId, patch };
        }) as EnrollmentsPatchReq;
        await patchEnrollments.mutateAsync(payload);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.enrollments.root }),
        queryClient.invalidateQueries({ queryKey: qk.customers.root }),
        queryClient.invalidateQueries({ queryKey: qk.dashboard.root }),
      ]);
      toast(`Applied ${createRows.length} create and ${patchRows.length} date update row${selectedRows.length === 1 ? "" : "s"}.`, { type: "success" });
      onApplied();
      onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to apply enrollment updates.", { type: "error" });
    }
  };

  return (
    <FullPageModal
      isOpen
      onClose={onClose}
      disableOverlayClose={busy}
      topBar={
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-600">Bulk Workspace</div>
            <div className="mt-1 text-xl font-semibold text-slate-950">Bulk Enroll From Report</div>
            <div className="mt-1 text-sm text-slate-500">Create missing enrollments and align report end dates through existing enrollment endpoints.</div>
          </div>
          <div className="flex flex-wrap items-end justify-end gap-3">
            <label className="block w-64">
              <div className="mb-1 text-xs font-medium text-slate-600">Default Grant</div>
              <select className="input h-9 w-full text-sm" value={globalGrantId} onChange={(event) => setGlobalGrantId(event.currentTarget.value)}>
                <option value="">Auto-match by provider/name</option>
                {grants.map((grant) => <option key={grant.id} value={grant.id}>{grant.name || grant.id}</option>)}
              </select>
            </label>
            <label className="flex h-9 items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={closeExited} onChange={(event) => setCloseExited(event.currentTarget.checked)} />
              Close exited
            </label>
            <button type="button" className="btn btn-ghost btn-sm" onClick={toggleAll} disabled={!eligibleRows.length || busy}>
              {allEligibleSelected ? "Clear eligible" : "Select eligible"}
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void apply()} disabled={busy || selectedRows.length === 0}>
              {busy ? "Applying..." : `Apply ${selectedRows.length}`}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={busy}>
              Close
            </button>
          </div>
        </div>
      }
      leftPane={
        <div className="space-y-4 p-5">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Selected</div>
            <div className="mt-2 text-3xl font-semibold text-slate-950">{selectedRows.length}</div>
            <div className="mt-1 text-sm text-slate-500">{createRows.length} create, {patchRows.length} date update, {blockedRows.length} blocked</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
            Duplicate customer/grant/date rows are collapsed. Existing non-deleted enrollments are skipped by the backend bulk enroll guard.
          </div>
        </div>
      }
      rightPane={
        <div className="h-full overflow-y-auto bg-slate-50 p-6">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-sm font-semibold text-slate-950">Enrollment Preview</div>
                <div className="text-xs text-slate-500">Review grant mapping, start dates, and exit dates before applying.</div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Use</th>
                    <th className="px-3 py-2">Action</th>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2">Grant</th>
                    <th className="px-3 py-2">Start</th>
                    <th className="px-3 py-2">End</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Warnings</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-200 align-top">
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={selectedIds.has(row.id) && !row.blocked} disabled={row.blocked || busy} onChange={() => toggleOne(row.id)} />
                      </td>
                      <td className="px-3 py-2">
                        <span className={row.mode === "create" ? "rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-emerald-700" : "rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-sky-700"}>
                          {row.mode === "create" ? "create" : "update dates"}
                        </span>
                        {row.blocked ? <div className="mt-1 text-amber-700">{row.blockReason}</div> : null}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-800">{row.customerLabel}</div>
                        <div className="text-slate-400">{row.customerId || "-"}</div>
                      </td>
                      <td className="min-w-56 px-3 py-2">
                        {row.mode === "create" ? (
                          <select className="input h-8 w-full text-xs" value={row.grantId} onChange={(event) => updateRow(row.id, { grantId: event.currentTarget.value })} disabled={busy}>
                            <option value="">Choose grant</option>
                            {grants.map((grant) => <option key={grant.id} value={grant.id}>{grant.name || grant.id}</option>)}
                          </select>
                        ) : (
                          <div>{row.grantId || row.reportGrant || "-"}</div>
                        )}
                        <div className="mt-1 text-slate-400">{row.reportGrant || "No report provider parsed"}</div>
                      </td>
                      <td className="px-3 py-2">
                        <input className="input h-8 w-32 text-xs" value={row.startDate} onChange={(event) => updateRow(row.id, { startDate: normalizeDate(event.currentTarget.value) || event.currentTarget.value })} disabled={busy} />
                      </td>
                      <td className="px-3 py-2">
                        <input className="input h-8 w-32 text-xs" value={row.endDate} onChange={(event) => updateRow(row.id, { endDate: normalizeDate(event.currentTarget.value) || event.currentTarget.value })} disabled={busy} />
                      </td>
                      <td className="px-3 py-2">{row.sourceFile} row {row.sourceRowNumber ?? "-"}</td>
                      <td className="max-w-72 px-3 py-2 text-amber-700">
                        {[...row.warnings, row.confidence < 0.75 ? `${Math.round(row.confidence * 100)}% match` : ""].filter(Boolean).join(" | ") || "-"}
                      </td>
                    </tr>
                  ))}
                  {!displayRows.length ? (
                    <tr>
                      <td className="px-3 py-8 text-center text-sm text-slate-500" colSpan={8}>Select missing enrollment or date mismatch findings first.</td>
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
