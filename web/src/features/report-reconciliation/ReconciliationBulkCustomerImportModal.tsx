"use client";

import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import FullPageModal from "@entities/ui/FullPageModal";
import { useUpsertCustomers } from "@hooks/useCustomers";
import { useUsers } from "@hooks/useUsers";
import { qk } from "@hooks/queryKeys";
import { toast } from "@lib/toast";
import type { CustomersUpsertReq } from "@types";
import type { ReconciliationFinding } from "./reconciliationReview";

type PopulationValue = "" | "Youth" | "Individual" | "Family";

type ImportRow = {
  id: string;
  findingId: string;
  firstName: string;
  lastName: string;
  dob: string;
  cwId: string;
  hmisId: string;
  caseworthyId: string;
  population: PopulationValue;
  caseManagerId: string;
  active: boolean;
  sourceFile: string;
  sourceRowNumber: number | null;
  warnings: string[];
  blocked: boolean;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function normalizePopulation(value: unknown): PopulationValue {
  const lower = text(value).toLowerCase();
  if (lower === "youth") return "Youth";
  if (lower === "individual" || lower === "single adult" || lower === "adult") return "Individual";
  if (lower === "family" || lower === "families") return "Family";
  return "";
}

function normalizeNamePart(value: unknown) {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizedName(row: Pick<ImportRow, "firstName" | "lastName">) {
  return `${normalizeNamePart(row.firstName)} ${normalizeNamePart(row.lastName)}`.trim();
}

function editDistance(a: string, b: string) {
  const left = normalizeNamePart(a);
  const right = normalizeNamePart(b);
  if (left === right) return 0;
  if (!left || !right) return Math.max(left.length, right.length);
  const prev = Array.from({ length: right.length + 1 }, (_, index) => index);
  const curr = Array.from({ length: right.length + 1 }, () => 0);
  for (let i = 1; i <= left.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= right.length; j += 1) prev[j] = curr[j];
  }
  return prev[right.length];
}

function namesAreClose(left: Pick<ImportRow, "firstName" | "lastName">, right: Record<string, unknown>) {
  const rightFirst = text(right.firstName ?? right.givenName);
  const rightLast = text(right.lastName ?? right.surname);
  if (!left.firstName || !left.lastName || !rightFirst || !rightLast) return false;
  const exact = normalizeNamePart(left.firstName) === normalizeNamePart(rightFirst) && normalizeNamePart(left.lastName) === normalizeNamePart(rightLast);
  if (exact) return false;
  return editDistance(left.firstName, rightFirst) <= 2 && editDistance(left.lastName, rightLast) <= 2;
}

function identityKey(row: Pick<ImportRow, "hmisId" | "cwId" | "caseworthyId" | "firstName" | "lastName" | "dob">) {
  return [
    row.hmisId ? `hmis:${row.hmisId.toLowerCase()}` : "",
    row.cwId ? `cw:${row.cwId.toLowerCase()}` : "",
    row.caseworthyId ? `caseworthy:${row.caseworthyId.toLowerCase()}` : "",
    row.firstName || row.lastName || row.dob ? `name:${row.firstName.toLowerCase()}|${row.lastName.toLowerCase()}|${row.dob}` : "",
  ].filter(Boolean).join("::");
}

function externalIdSignature(row: Pick<ImportRow, "hmisId" | "cwId" | "caseworthyId">) {
  return [
    row.hmisId ? `hmis:${row.hmisId.toLowerCase()}` : "",
    row.cwId ? `cw:${row.cwId.toLowerCase()}` : "",
    row.caseworthyId ? `caseworthy:${row.caseworthyId.toLowerCase()}` : "",
  ].filter(Boolean).join("|");
}

function existingCustomerConflict(row: ImportRow, customers: Array<Record<string, unknown>>) {
  const hmis = row.hmisId.toLowerCase();
  const cw = row.cwId.toLowerCase();
  const caseworthy = row.caseworthyId.toLowerCase();
  const first = row.firstName.toLowerCase();
  const last = row.lastName.toLowerCase();
  const dob = row.dob;

  return customers.some((customer) => {
    if (hmis && text(customer.hmisId ?? customer.HMISId).toLowerCase() === hmis) return true;
    if (cw && text(customer.cwId ?? customer.CWID).toLowerCase() === cw) return true;
    if (caseworthy && text(customer.caseworthyId).toLowerCase() === caseworthy) return true;
    const customerFirst = text(customer.firstName ?? customer.givenName).toLowerCase();
    const customerLast = text(customer.lastName ?? customer.surname).toLowerCase();
    const customerDob = text(customer.dob ?? customer.dateOfBirth ?? customer.birthDate);
    return Boolean(first && last && dob && customerFirst === first && customerLast === last && customerDob === dob);
  });
}

function validateImportRows(rows: ImportRow[], customers: Array<Record<string, unknown>>) {
  const identityCounts = new Map<string, number>();
  const externalIdsByName = new Map<string, Set<string>>();
  for (const row of rows) {
    const key = identityKey(row);
    if (key) identityCounts.set(key, (identityCounts.get(key) ?? 0) + 1);
    const name = normalizedName(row);
    const external = externalIdSignature(row);
    if (name && external) {
      if (!externalIdsByName.has(name)) externalIdsByName.set(name, new Set());
      externalIdsByName.get(name)!.add(external);
    }
  }
  return rows.map((row) => {
    const warnings: string[] = [];
    const conflictingSourceIds = (externalIdsByName.get(normalizedName(row))?.size ?? 0) > 1;
    const fuzzyCustomer = customers.find((customer) => namesAreClose(row, customer));
    if (!row.firstName || !row.lastName) warnings.push("First and last name are required before create.");
    if (!row.dob) warnings.push("DOB is blank; add it if the source report has it.");
    if (!row.hmisId && !row.cwId && !row.caseworthyId) warnings.push("No external ID was parsed; review for duplicate risk.");
    if (identityKey(row) && (identityCounts.get(identityKey(row)) ?? 0) > 1) warnings.push("Duplicate identity appears in the selected import rows.");
    if (conflictingSourceIds) warnings.push("Blocked: the selected source rows contain the same name with different HMIS/CW/Caseworthy IDs.");
    if (existingCustomerConflict(row, customers)) warnings.push("A dashboard customer already appears to match this identity.");
    if (fuzzyCustomer) {
      const first = text(fuzzyCustomer.firstName ?? fuzzyCustomer.givenName);
      const last = text(fuzzyCustomer.lastName ?? fuzzyCustomer.surname);
      warnings.push(`Similar dashboard name: ${[first, last].filter(Boolean).join(" ")}. Review spelling before create.`);
    }
    return {
      ...row,
      warnings,
      blocked: !row.firstName || !row.lastName || conflictingSourceIds || existingCustomerConflict(row, customers),
    };
  });
}

export function buildBulkCustomerImportRows(
  findings: ReconciliationFinding[],
  customers: Array<Record<string, unknown>>,
  globalCaseManagerId = "",
): ImportRow[] {
  const rows: ImportRow[] = [];
  const seen = new Set<string>();

  for (const finding of findings) {
    const record = finding.reportRecord;
    if (!record || finding.matchedCustomer || finding.customerId) continue;
    const identity = record.customerIdentity;
    const parsed = splitName(identity.fullName || `${identity.firstName} ${identity.lastName}`.trim());
    const firstName = text(identity.firstName) || parsed.firstName;
    const lastName = text(identity.lastName) || parsed.lastName;
    const row: ImportRow = {
      id: `${finding.id}:${record.sourceRowNumber ?? rows.length}`,
      findingId: finding.id,
      firstName,
      lastName,
      dob: text(identity.dob),
      cwId: text((record.raw as Record<string, unknown>)?.cwId ?? (record.raw as Record<string, unknown>)?.CWID ?? (record.raw as Record<string, unknown>)?.["CW ID"]),
      hmisId: text(identity.hmisId),
      caseworthyId: text(identity.caseworthyId),
      population: normalizePopulation((record.raw as Record<string, unknown>)?.Population ?? (record.raw as Record<string, unknown>)?.population),
      caseManagerId: globalCaseManagerId,
      active: true,
      sourceFile: finding.sourceFile,
      sourceRowNumber: finding.sourceRowNumber,
      warnings: [],
      blocked: false,
    };
    const key = identityKey(row) || row.id;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }

  return validateImportRows(rows, customers).sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`));
}

export default function ReconciliationBulkCustomerImportModal({
  isOpen,
  findings,
  customers,
  onClose,
  onApplied,
}: {
  isOpen: boolean;
  findings: ReconciliationFinding[];
  customers: Array<Record<string, unknown>>;
  onClose: () => void;
  onApplied: () => void;
}) {
  const upsertCustomers = useUpsertCustomers();
  const queryClient = useQueryClient();
  const { data: users = [] } = useUsers({ status: "active", limit: 500 });
  const caseManagers = React.useMemo(
    () => users
      .filter((user) => user.uid && user.active !== false && !user.disabled)
      .map((user) => ({ id: user.uid, name: text(user.displayName) || text(user.email) || user.uid }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  );
  const [globalCaseManagerId, setGlobalCaseManagerId] = React.useState("");
  const [globalPopulation, setGlobalPopulation] = React.useState<PopulationValue>("");
  const [rows, setRows] = React.useState<ImportRow[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (!isOpen) return;
    const nextRows = buildBulkCustomerImportRows(findings, customers, globalCaseManagerId);
    setRows(nextRows);
    setSelectedIds(new Set(nextRows.filter((row) => !row.blocked).map((row) => row.id)));
  }, [customers, findings, globalCaseManagerId, isOpen]);

  if (!isOpen) return null;

  const displayRows = validateImportRows(rows, customers);
  const caseManagerNameById = new Map(caseManagers.map((cm) => [cm.id, cm.name]));
  const eligibleRows = displayRows.filter((row) => !row.blocked);
  const selectedRows = displayRows.filter((row) => selectedIds.has(row.id) && !row.blocked);
  const allEligibleSelected = eligibleRows.length > 0 && eligibleRows.every((row) => selectedIds.has(row.id));

  const updateRow = (id: string, patch: Partial<ImportRow>) => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
  };

  const toggleAll = () => {
    setSelectedIds(allEligibleSelected ? new Set() : new Set(eligibleRows.map((row) => row.id)));
  };

  const applyGlobalCaseManager = (id: string) => {
    setGlobalCaseManagerId(id);
  };

  const applyGlobalPopulation = (population: PopulationValue) => {
    setGlobalPopulation(population);
  };

  const apply = async () => {
    if (!selectedRows.length) {
      toast("Select at least one eligible customer create row.", { type: "warn" });
      return;
    }
    const payload = selectedRows.map((row) => {
      const resolvedCaseManagerId = row.caseManagerId || globalCaseManagerId;
      const resolvedPopulation = row.population || globalPopulation;
      const caseManagerName = resolvedCaseManagerId ? caseManagerNameById.get(resolvedCaseManagerId) || null : null;
      return {
        firstName: row.firstName.trim(),
        lastName: row.lastName.trim(),
        name: `${row.firstName} ${row.lastName}`.trim(),
        dob: row.dob.trim() || null,
        cwId: row.cwId.trim() || null,
        hmisId: row.hmisId.trim() || null,
        caseworthyId: row.caseworthyId.trim() || null,
        population: resolvedPopulation || null,
        status: row.active ? "active" : "inactive",
        active: row.active,
        deleted: false,
        enrolled: false,
        caseManagerId: resolvedCaseManagerId || null,
        caseManagerName,
      };
    }) as CustomersUpsertReq;

    try {
      await upsertCustomers.mutateAsync(payload);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.customers.root }),
        queryClient.invalidateQueries({ queryKey: qk.dashboard.root }),
      ]);
      toast(`Created ${selectedRows.length} customer${selectedRows.length === 1 ? "" : "s"}.`, { type: "success" });
      onApplied();
      onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to create customers.", { type: "error" });
    }
  };

  return (
    <FullPageModal
      isOpen
      onClose={onClose}
      disableOverlayClose={upsertCustomers.isPending}
      topBar={
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-600">Bulk Workspace</div>
            <div className="mt-1 text-xl font-semibold text-slate-950">Create Customers From Reports</div>
            <div className="mt-1 text-sm text-slate-500">Review parsed HMIS/Caseworthy rows, fill missing fields, then create customer records.</div>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={upsertCustomers.isPending}>
            Close
          </button>
        </div>
      }
      leftPane={
        <div className="space-y-4 p-5">
          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Selected Creates</div>
            <div className="mt-2 text-3xl font-semibold text-slate-950">{selectedRows.length}</div>
            <div className="mt-1 text-sm text-slate-500">{eligibleRows.length} eligible, {displayRows.length - eligibleRows.length} blocked</div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Global assign all to CM</label>
            <select className="select mt-2 w-full" value={globalCaseManagerId} onChange={(event) => applyGlobalCaseManager(event.currentTarget.value)}>
              <option value="">Unassigned</option>
              {caseManagers.map((cm) => <option key={cm.id} value={cm.id}>{cm.name}</option>)}
            </select>
            <div className="mt-2 text-xs text-slate-500">Blank rows use this value. Row-level CM wins when selected.</div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Global population</label>
            <select className="select mt-2 w-full" value={globalPopulation} onChange={(event) => applyGlobalPopulation(event.currentTarget.value as PopulationValue)}>
              <option value="">Blank</option>
              <option value="Youth">Youth</option>
              <option value="Individual">Individual</option>
              <option value="Family">Family</option>
            </select>
            <div className="mt-2 text-xs text-slate-500">Blank rows use this value. Row-level population wins when selected.</div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
            Creates are blocked when the dashboard already appears to have the customer or the source has the same name with different IDs. Names that are only a couple letters off are flagged for review.
          </div>
        </div>
      }
      rightPane={
        <div className="h-full overflow-y-auto bg-slate-50 p-6">
          <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-sm font-semibold text-slate-950">Customer Import Preview</div>
                <div className="text-xs text-slate-500">Rows come from selected findings and use the existing customersUpsert endpoint.</div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" className="btn btn-ghost btn-sm" onClick={toggleAll} disabled={!eligibleRows.length || upsertCustomers.isPending}>
                  {allEligibleSelected ? "Clear eligible" : "Select eligible"}
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => void apply()} disabled={upsertCustomers.isPending || selectedRows.length === 0}>
                  {upsertCustomers.isPending ? "Creating..." : `Create ${selectedRows.length}`}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[1180px] text-left text-xs">
                <thead className="bg-slate-50 uppercase tracking-[0.14em] text-slate-500">
                  <tr>
                    <th className="px-3 py-3">Create</th>
                    <th className="px-3 py-3">Name</th>
                    <th className="px-3 py-3">DOB</th>
                    <th className="px-3 py-3">CWID</th>
                    <th className="px-3 py-3">HMIS ID</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Population</th>
                    <th className="px-3 py-3">Assigned CM</th>
                    <th className="px-3 py-3">Source</th>
                    <th className="px-3 py-3">Warnings</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 align-top">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.id) && !row.blocked}
                          disabled={row.blocked || upsertCustomers.isPending}
                          onChange={() => setSelectedIds((current) => {
                            const next = new Set(current);
                            if (next.has(row.id)) next.delete(row.id);
                            else next.add(row.id);
                            return next;
                          })}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="grid grid-cols-2 gap-2">
                          <input className="input h-8 min-w-28" value={row.firstName} onChange={(event) => updateRow(row.id, { firstName: event.currentTarget.value })} placeholder="First" />
                          <input className="input h-8 min-w-28" value={row.lastName} onChange={(event) => updateRow(row.id, { lastName: event.currentTarget.value })} placeholder="Last" />
                        </div>
                      </td>
                      <td className="px-3 py-3"><input className="input h-8 min-w-28" value={row.dob} onChange={(event) => updateRow(row.id, { dob: event.currentTarget.value })} placeholder="YYYY-MM-DD" /></td>
                      <td className="px-3 py-3"><input className="input h-8 min-w-24" value={row.cwId} onChange={(event) => updateRow(row.id, { cwId: event.currentTarget.value })} /></td>
                      <td className="px-3 py-3"><input className="input h-8 min-w-24" value={row.hmisId} onChange={(event) => updateRow(row.id, { hmisId: event.currentTarget.value })} /></td>
                      <td className="px-3 py-3">
                        <select className="select h-8 min-w-24" value={row.active ? "active" : "inactive"} onChange={(event) => updateRow(row.id, { active: event.currentTarget.value === "active" })}>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <select className="select h-8 min-w-28" value={row.population} onChange={(event) => updateRow(row.id, { population: event.currentTarget.value as PopulationValue })}>
                          <option value="">{globalPopulation ? `Use global (${globalPopulation})` : "Blank"}</option>
                          <option value="Youth">Youth</option>
                          <option value="Individual">Individual</option>
                          <option value="Family">Family</option>
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <select className="select h-8 min-w-44" value={row.caseManagerId} onChange={(event) => updateRow(row.id, { caseManagerId: event.currentTarget.value })}>
                          <option value="">{globalCaseManagerId ? `Use global (${caseManagerNameById.get(globalCaseManagerId) || "CM"})` : "Unassigned"}</option>
                          {caseManagers.map((cm) => <option key={cm.id} value={cm.id}>{cm.name}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-3 text-slate-500">
                        <div className="max-w-40 truncate" title={row.sourceFile}>{row.sourceFile}</div>
                        <div>row {row.sourceRowNumber ?? "-"}</div>
                      </td>
                      <td className="px-3 py-3">
                        {row.blocked ? <div className="font-medium text-red-700">Blocked</div> : null}
                        {row.warnings.map((warning) => <div key={warning} className={row.blocked ? "text-red-700" : "text-amber-700"}>{warning}</div>)}
                        {!row.warnings.length ? <span className="text-emerald-700">Ready</span> : null}
                      </td>
                    </tr>
                  ))}
                  {!displayRows.length ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-sm text-slate-500">
                        No selected findings contain unmatched customer report rows.
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
