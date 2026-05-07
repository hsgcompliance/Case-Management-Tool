"use client";

import React from "react";
import ActionMenu from "@entities/ui/ActionMenu";
import GrantSelect from "@entities/selectors/GrantSelect";
import { Modal } from "@entities/ui/Modal";
import { EnrollmentMigrateDialog } from "@entities/dialogs/enrollment/EnrollmentMigrateDialog";
import { useGrants } from "@hooks/useGrants";
import { usePaymentsDeleteRows, usePaymentsSpend } from "@hooks/usePayments";
import { useTasksDelete, useTasksUpdateStatus } from "@hooks/useTasks";
import {
  useCustomerEnrollments,
  useEnrollCustomer,
  useEnrollmentsAdminDelete,
  useEnrollmentsDelete,
  useEnrollmentsPatch,
} from "@hooks/useEnrollments";
import { toast } from "@lib/toast";
import { fmtDateOrDash } from "@lib/formatters";
import { formatEnrollmentLabel } from "@lib/enrollmentLabels";
import { addYears, parseISO10, toISODate } from "@lib/date";
import { RowStateBadge } from "@entities/ui/rowState";
import { toApiError } from "@client/api";
import type { Enrollment } from "@client/enrollments";
import type { EnrollmentsPatchReq } from "@types";

type ComplianceKey =
  | "caseworthyEntryComplete"
  | "hmisEntryComplete"
  | "caseworthyExitComplete"
  | "hmisExitComplete";

function isoToday(): string {
  return toISODate(new Date());
}

function defaultEnrollmentEndDate(startDate?: string | null): string {
  const base = parseISO10(String(startDate || "").trim()) ?? new Date();
  return toISODate(addYears(base, 1));
}

function toOpenClosed(row: Enrollment): "open" | "closed" {
  const status = String(row.status || "").toLowerCase();
  if (status === "closed" || status === "deleted") return "closed";
  if (typeof row.active === "boolean") return row.active ? "open" : "closed";
  return "open";
}

function isInactiveEnrollment(row: Enrollment): boolean {
  return toOpenClosed(row) === "closed";
}

function complianceFlag(row: Enrollment, key: ComplianceKey): boolean {
  const c = row.compliance as Record<string, unknown> | null | undefined;
  return Boolean(c?.[key]);
}

function badgeClasses(done: boolean): string {
  return done
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50";
}

export function EnrollmentsTab({ customerId }: { customerId: string }) {
  const { data: enrollments = [], isLoading, refetch } = useCustomerEnrollments(customerId);
  const { data: grants = [] } = useGrants({ limit: 500 });
  const grantStatusById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const g of grants) {
      const id = String(g.id || "").trim();
      if (!id) continue;
      map.set(id, String(g.status || "").toLowerCase());
    }
    return map;
  }, [grants]);

  const enroll = useEnrollCustomer();
  const patch = useEnrollmentsPatch();
  const softDelete = useEnrollmentsDelete();
  const adminDelete = useEnrollmentsAdminDelete();
  const paymentsSpend = usePaymentsSpend();
  const paymentsDeleteRows = usePaymentsDeleteRows();
  const tasksUpdateStatus = useTasksUpdateStatus();
  const tasksDelete = useTasksDelete();

  const [grantId, setGrantId] = React.useState<string | null>(null);
  const [startDate, setStartDate] = React.useState<string>(isoToday());
  const [endDate, setEndDate] = React.useState<string>(defaultEnrollmentEndDate(isoToday()));
  const [endDateTouched, setEndDateTouched] = React.useState<boolean>(false);
  const [generateTaskSchedule, setGenerateTaskSchedule] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const [editing, setEditing] = React.useState<Enrollment | null>(null);
  const [editStartDate, setEditStartDate] = React.useState("");
  const [editEndDate, setEditEndDate] = React.useState("");

  const [migrateTarget, setMigrateTarget] = React.useState<Enrollment | null>(null);
  const [closeTarget, setCloseTarget] = React.useState<Enrollment | null>(null);
  const [closeDate, setCloseDate] = React.useState<string>(isoToday());
  const [closeTaskMode, setCloseTaskMode] = React.useState<"complete" | "delete">("complete");
  const [closePaymentMode, setClosePaymentMode] = React.useState<"spendUnpaid" | "deleteUnpaid">("deleteUnpaid");

  const ALLOW_MIGRATION_FOR_CLOSED_ROWS = true;

  const busy =
    enroll.isPending ||
    patch.isPending ||
    softDelete.isPending ||
    adminDelete.isPending ||
    paymentsSpend.isPending ||
    paymentsDeleteRows.isPending ||
    tasksUpdateStatus.isPending ||
    tasksDelete.isPending;

  const today = React.useMemo(() => isoToday(), []);

  const closeTargetPayments = React.useMemo(() => {
    const payments = Array.isArray((closeTarget as any)?.payments) ? ((closeTarget as any).payments as any[]) : [];
    return payments;
  }, [closeTarget]);
  const closeTargetTasks = React.useMemo(() => {
    const tasks = Array.isArray((closeTarget as any)?.taskSchedule) ? ((closeTarget as any).taskSchedule as any[]) : [];
    return tasks;
  }, [closeTarget]);
  const closeLastPaymentDate = React.useMemo(() => {
    let maxDue = "";
    for (const p of closeTargetPayments) {
      if ((p as any)?.void === true) continue;
      const due = String((p as any)?.dueDate || (p as any)?.date || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) continue;
      if (!maxDue || due > maxDue) maxDue = due;
    }
    return maxDue || null;
  }, [closeTargetPayments]);
  const closeFutureUnpaidPayments = React.useMemo(
    () =>
      closeTargetPayments.filter((p: any) => {
        const due = String(p?.dueDate || p?.date || "").slice(0, 10);
        // Use closeDate as the cutoff so retroactive closes capture items since the close date.
        const cutoff = closeDate || today;
        return /^\d{4}-\d{2}-\d{2}$/.test(due) && due > cutoff && !p?.paid && !p?.void;
      }),
    [closeTargetPayments, closeDate, today],
  );
  const closeFutureTasks = React.useMemo(
    () =>
      closeTargetTasks.filter((t: any) => {
        const due = String(t?.dueDate || "").slice(0, 10);
        // Use closeDate as the cutoff so retroactive closes capture items since the close date.
        const cutoff = closeDate || today;
        return /^\d{4}-\d{2}-\d{2}$/.test(due) && due > cutoff;
      }),
    [closeTargetTasks, closeDate, today],
  );

  React.useEffect(() => {
    if (!closeTarget) return;
    setCloseTaskMode("complete");
    setClosePaymentMode("deleteUnpaid");
    const suggested = String(closeTarget.endDate || "").slice(0, 10) || today;
    setCloseDate(suggested);
  }, [closeTarget, today]);

  const [search, setSearch] = React.useState("");

  const visible = React.useMemo(
    () => enrollments.filter((e) => String(e.status || "").toLowerCase() !== "deleted"),
    [enrollments],
  );
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return visible;
    return visible.filter((e) => {
      const label = formatEnrollmentLabel(e as unknown as Record<string, unknown>).toLowerCase();
      const grantId = String(e.grantId || "").toLowerCase();
      const status = String(e.status || "").toLowerCase();
      return label.includes(q) || grantId.includes(q) || status.includes(q);
    });
  }, [visible, search]);
  const activeRows = React.useMemo(
    () => filtered.filter((e) => !isInactiveEnrollment(e)),
    [filtered],
  );
  const inactiveRows = React.useMemo(
    () => filtered.filter((e) => isInactiveEnrollment(e)),
    [filtered],
  );

  const onCreate = async () => {
    const gid = String(grantId || "").trim();
    if (!gid) return;
    setError(null);
    try {
      await enroll.mutateAsync({
        customerId,
        grantId: gid,
        extra: {
          status: "active",
          active: true,
          generateTaskSchedule,
          ...(startDate ? { startDate } : {}),
          ...(endDate ? { endDate } : {}),
        },
      });
      setGrantId(null);
      setStartDate(isoToday());
      setEndDate(defaultEnrollmentEndDate(isoToday()));
      setEndDateTouched(false);
      setGenerateTaskSchedule(true);
      toast("Enrollment created.", { type: "success" });
    } catch (e: unknown) {
      const msg = toApiError(e).error || "Failed to create enrollment.";
      setError(msg);
      toast(msg, { type: "error" });
    }
  };

  const patchEnrollment = async (
    id: string,
    patchData: Record<string, unknown>,
    unset?: string[],
  ) => {
    const body: EnrollmentsPatchReq = {
      id,
      patch: patchData,
      ...(Array.isArray(unset) && unset.length ? { unset } : {}),
    };
    await patch.mutateAsync(body);
  };

  const toggleCompliance = async (row: Enrollment, key: ComplianceKey) => {
    setError(null);
    try {
      const next = !complianceFlag(row, key);
      const currentCompliance = (row.compliance || {}) as Record<string, unknown>;
      await patchEnrollment(row.id, {
        compliance: {
          ...currentCompliance,
          [key]: next,
        },
      });
    } catch (e: unknown) {
      const msg = toApiError(e).error || "Failed to update compliance.";
      setError(msg);
      toast(msg, { type: "error" });
    }
  };

  const confirmCloseEnrollment = async () => {
    if (!closeTarget) return;
    setError(null);
    try {
      if (closeLastPaymentDate && closeDate && closeDate < closeLastPaymentDate) {
        throw new Error(`Close date must be on or after last payment date (${closeLastPaymentDate}).`);
      }

      const futureTaskRows = closeFutureTasks.slice().sort((a: any, b: any) =>
        String(a?.dueDate || "").localeCompare(String(b?.dueDate || "")),
      );
      if (closeTaskMode === "delete") {
        for (const t of futureTaskRows) {
          const taskId = String(t?.id || "").trim();
          if (!taskId) continue;
          await tasksDelete.mutateAsync({ enrollmentId: closeTarget.id, taskId } as any);
        }
      } else {
        for (const t of futureTaskRows) {
          const taskId = String(t?.id || "").trim();
          if (!taskId) continue;
          const status = String(t?.status || "").toLowerCase();
          if (t?.completed || status === "done" || status === "verified") continue;
          await tasksUpdateStatus.mutateAsync({ enrollmentId: closeTarget.id, taskId, action: "complete" } as any);
        }
      }

      const futureUnpaid = closeFutureUnpaidPayments
        .map((p: any) => ({ id: String(p?.id || "").trim(), dueDate: String(p?.dueDate || p?.date || "") }))
        .filter((p) => p.id)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      if (closePaymentMode === "spendUnpaid") {
        for (const p of futureUnpaid) {
          await paymentsSpend.mutateAsync({ body: { enrollmentId: closeTarget.id, paymentId: p.id } as any });
        }
      } else if (futureUnpaid.length) {
        await paymentsDeleteRows.mutateAsync({
          enrollmentId: closeTarget.id,
          paymentIds: futureUnpaid.map((p) => p.id),
          preservePaid: true,
          updateBudgets: false,
          removeSpends: true,
          reverseLedger: false,
        } as any);
      }

      await patchEnrollment(closeTarget.id, {
        status: "closed",
        active: false,
        endDate: closeDate || closeTarget.endDate || isoToday(),
      });
      toast("Enrollment closed.", { type: "success" });
      setCloseTarget(null);
    } catch (e: unknown) {
      const msg = toApiError(e).error || "Failed to close enrollment.";
      setError(msg);
      toast(msg, { type: "error" });
    }
  };

  const onSoftDelete = async (row: Enrollment) => {
    if (!window.confirm("Soft delete this enrollment?")) return;
    setError(null);
    try {
      await softDelete.mutateAsync(row.id);
      toast("Enrollment soft deleted.", { type: "success" });
    } catch (e: unknown) {
      const msg = toApiError(e).error || "Failed to delete enrollment.";
      setError(msg);
      toast(msg, { type: "error" });
    }
  };

  const onAdminDelete = async (row: Enrollment) => {
    if (!window.confirm("Admin delete this enrollment permanently?")) return;
    setError(null);
    try {
      await adminDelete.mutateAsync(row.id);
      toast("Enrollment admin deleted.", { type: "success" });
    } catch (e: unknown) {
      const msg = toApiError(e).error || "Failed admin delete.";
      setError(msg);
      toast(msg, { type: "error" });
    }
  };

  const openEdit = (row: Enrollment) => {
    setEditing(row);
    setEditStartDate(row.startDate ? toISODate(String(row.startDate)) : "");
    setEditEndDate(row.endDate ? toISODate(String(row.endDate)) : "");
  };

  const saveEdit = async () => {
    if (!editing) return;
    setError(null);
    try {
      await patchEnrollment(editing.id, {
        startDate: editStartDate || null,
        endDate: editEndDate || null,
      });
      setEditing(null);
      toast("Enrollment dates updated.", { type: "success" });
    } catch (e: unknown) {
      const msg = toApiError(e).error || "Failed to update dates.";
      setError(msg);
      toast(msg, { type: "error" });
    }
  };

  const reopenEnrollment = async (row: Enrollment) => {
    setError(null);
    try {
      await patchEnrollment(
        row.id,
        {
          status: "active",
          active: true,
        },
        ["endDate"],
      );
      toast("Enrollment reopened.", { type: "success" });
    } catch (e: unknown) {
      const msg = toApiError(e).error || "Failed to reopen enrollment.";
      setError(msg);
      toast(msg, { type: "error" });
    }
  };

  const renderComplianceButtons = (row: Enrollment) => {
    if (isInactiveEnrollment(row)) {
      const hmis = complianceFlag(row, "hmisExitComplete");
      const cw = complianceFlag(row, "caseworthyExitComplete");
      return (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={["rounded-full border px-2 py-1 text-xs font-medium", badgeClasses(cw)].join(" ")}
            onClick={() => void toggleCompliance(row, "caseworthyExitComplete")}
            disabled={busy}
          >
            CW Exit {cw ? "Done" : "Pending"}
          </button>
          <button
            type="button"
            className={["rounded-full border px-2 py-1 text-xs font-medium", badgeClasses(hmis)].join(" ")}
            onClick={() => void toggleCompliance(row, "hmisExitComplete")}
            disabled={busy}
          >
            HMIS Exit {hmis ? "Done" : "Pending"}
          </button>
        </div>
      );
    }

    const hmis = complianceFlag(row, "hmisEntryComplete");
    const cw = complianceFlag(row, "caseworthyEntryComplete");
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={["rounded-full border px-2 py-1 text-xs font-medium", badgeClasses(cw)].join(" ")}
          onClick={() => void toggleCompliance(row, "caseworthyEntryComplete")}
          disabled={busy}
        >
          CW Entry {cw ? "Done" : "Pending"}
        </button>
        <button
          type="button"
          className={["rounded-full border px-2 py-1 text-xs font-medium", badgeClasses(hmis)].join(" ")}
          onClick={() => void toggleCompliance(row, "hmisEntryComplete")}
          disabled={busy}
        >
          HMIS Entry {hmis ? "Done" : "Pending"}
        </button>
      </div>
    );
  };

  const renderActions = (row: Enrollment) => {
    const grantStatus = grantStatusById.get(String(row.grantId || "")) || "";
    const grantClosed = grantStatus === "closed" || grantStatus === "deleted";
    const rowOpen = !isInactiveEnrollment(row);
    const canEditDates = true;
    const canMigrate = (!grantClosed && rowOpen) || ALLOW_MIGRATION_FOR_CLOSED_ROWS;

    if (rowOpen) {
      return (
        <ActionMenu
          disabled={busy}
          items={[
            ...(canEditDates
              ? [{ key: "edit", label: "Edit Dates", onSelect: () => openEdit(row) }]
              : []),
            { key: "close", label: "Close", onSelect: () => setCloseTarget(row) },
            ...(canMigrate
              ? [{ key: "migrate", label: "Migrate", onSelect: () => setMigrateTarget(row) }]
              : []),
          ]}
        />
      );
    }
    return (
      <ActionMenu
        disabled={busy}
        items={[
          ...(canEditDates
            ? [{ key: "edit", label: "Edit Dates", onSelect: () => openEdit(row) }]
            : []),
          { key: "reopen", label: "Reopen", onSelect: () => void reopenEnrollment(row) },
          ...(canMigrate
            ? [{ key: "migrate", label: "Migrate", onSelect: () => setMigrateTarget(row) }]
            : []),
          { key: "delete", label: "Archive", onSelect: () => onSoftDelete(row), danger: true },
          { key: "admin-delete", label: "⚠️ Admin Delete (Permanent)", onSelect: () => onAdminDelete(row), danger: true },
        ]}
      />
    );
  };

  const renderTable = (rows: Enrollment[], title: string) => (
    <div className="rounded-xl border border-slate-200">
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">
        {title}
      </div>
      {rows.length === 0 ? (
        <div className="px-3 py-4 text-sm text-slate-600">No enrollments.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-white text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">Grant</th>
                <th className="px-3 py-2 text-left">State</th>
                <th className="px-3 py-2 text-left">Start</th>
                <th className="px-3 py-2 text-left">End</th>
                <th className="px-3 py-2 text-left">Compliance Tasks</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{formatEnrollmentLabel(row as unknown as Record<string, unknown>)}</td>
                  <td className="px-3 py-2">
                    <RowStateBadge
                      state={isInactiveEnrollment(row) ? "inactive" : "active"}
                      label={toOpenClosed(row)}
                    />
                  </td>
                  <td className="px-3 py-2">{fmtDateOrDash(row.startDate)}</td>
                  <td className="px-3 py-2">{fmtDateOrDash(row.endDate)}</td>
                  <td className="px-3 py-2">{renderComplianceButtons(row)}</td>
                  <td className="px-3 py-2 text-right">{renderActions(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 p-3">
        <div className="mb-2 text-sm font-medium">Enroll Customer</div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_170px_170px_auto] md:items-end">
          <label className="field">
            <span className="label">Grant / Program</span>
            <GrantSelect
              value={grantId}
              onChange={setGrantId}
              includeUnassigned
              placeholderLabel="-- Select grant or program --"
              disabled={busy}
              className="w-full"
              filters={{ active: true, limit: 500 }}
            />
          </label>
          <label className="field">
            <span className="label">Start Date (optional)</span>
            <input
              className="input"
              type="date"
              value={startDate}
              onChange={(e) => {
                const nextStartDate = e.currentTarget.value;
                setStartDate(nextStartDate);
                if (!endDateTouched) {
                  setEndDate(defaultEnrollmentEndDate(nextStartDate));
                }
              }}
              disabled={busy}
            />
          </label>
          <label className="field">
            <span className="label">End Date</span>
            <input
              className="input"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.currentTarget.value);
                setEndDateTouched(true);
              }}
              disabled={busy}
            />
          </label>
          <button className="btn btn-sm" onClick={() => void onCreate()} disabled={!grantId || busy}>
            {enroll.isPending ? "Creating..." : "Enroll"}
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            id="generateTaskSchedule"
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={generateTaskSchedule}
            onChange={(e) => setGenerateTaskSchedule(e.currentTarget.checked)}
            disabled={busy}
          />
          <label htmlFor="generateTaskSchedule" className="text-xs text-slate-600 cursor-pointer select-none">
            Generate task schedule from grant definitions
          </label>
          {!generateTaskSchedule && (
            <span className="text-xs text-amber-600 font-medium">(no tasks will be created)</span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-slate-400">
          Default start date is today. Default end date is one year from the selected start date.
        </div>
        {error ? <div className="mt-2 text-sm text-red-700">{error}</div> : null}
      </div>

      {!isLoading && visible.length > 3 && (
        <div className="flex items-center gap-2">
          <input
            className="input flex-1"
            type="search"
            placeholder="Search enrollments by grant, status…"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
          />
          {search && (
            <button
              type="button"
              className="btn btn-xs btn-ghost border border-slate-300"
              onClick={() => setSearch("")}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-slate-600">Loading enrollments...</div>
      ) : filtered.length === 0 && search ? (
        <div className="rounded-xl border border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
          No enrollments match &ldquo;{search}&rdquo;
        </div>
      ) : (
        <>
          {renderTable(activeRows, "Active Enrollments")}
          {renderTable(inactiveRows, "Inactive Enrollments")}
        </>
      )}

      <Modal
        isOpen={!!closeTarget}
        title={closeTarget ? `Close Enrollment — ${formatEnrollmentLabel(closeTarget as any)}` : "Close Enrollment"}
        onClose={() => setCloseTarget(null)}
        widthClass="max-w-2xl"
        footer={
          <div className="flex justify-end gap-2">
            <button className="btn-secondary btn-sm" onClick={() => setCloseTarget(null)} disabled={busy}>
              Cancel
            </button>
            <button
              className="btn btn-sm"
              onClick={() => void confirmCloseEnrollment()}
              disabled={busy || !closeTarget || (!!closeLastPaymentDate && !!closeDate && closeDate < closeLastPaymentDate)}
            >
              {busy ? "Closing..." : "Close Enrollment"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <label className="field">
            <span className="label">Close Date</span>
            <input className="input" type="date" value={closeDate} onChange={(e) => setCloseDate(e.currentTarget.value)} />
          </label>

          <div className="rounded border border-slate-200 p-3">
            <div className="mb-2 text-sm font-medium">Future tasks (after today)</div>
            <div className="mb-2 text-xs text-slate-600">Found: {closeFutureTasks.length}</div>
            <select
              className="input"
              value={closeTaskMode}
              onChange={(e) => setCloseTaskMode(e.currentTarget.value as "complete" | "delete")}
              disabled={busy}
            >
              <option value="complete">Close completed (mark open future tasks done)</option>
              <option value="delete">Close delete (remove future tasks)</option>
            </select>
          </div>

          <div className="rounded border border-slate-200 p-3">
            <div className="mb-2 text-sm font-medium">Future payments (after today)</div>
            <div className="mb-2 text-xs text-slate-600">Future unpaid projections: {closeFutureUnpaidPayments.length}</div>
            <select
              className="input"
              value={closePaymentMode}
              onChange={(e) => setClosePaymentMode(e.currentTarget.value as "spendUnpaid" | "deleteUnpaid")}
              disabled={busy}
            >
              <option value="spendUnpaid">Close projection paid (run spend)</option>
              <option value="deleteUnpaid">Close projections unpaid (delete future projections)</option>
            </select>
          </div>

          <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <div>Last payment date on enrollment: {closeLastPaymentDate || "None"}</div>
            <div>Closing is blocked if close date is before the last payment date.</div>
            {closeLastPaymentDate && closeDate && closeDate < closeLastPaymentDate ? (
              <div className="mt-1 text-red-700">
                Close date {closeDate} is before last payment date {closeLastPaymentDate}.
              </div>
            ) : null}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!editing}
        title="Edit Enrollment Dates"
        onClose={() => setEditing(null)}
        widthClass="max-w-lg"
        footer={
          <div className="flex justify-end gap-2">
            <button className="btn-secondary btn-sm" onClick={() => setEditing(null)} disabled={busy}>
              Cancel
            </button>
            <button className="btn btn-sm" onClick={() => void saveEdit()} disabled={busy}>
              {patch.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <label className="field">
            <span className="label">Start Date</span>
            <input
              className="input"
              type="date"
              value={editStartDate}
              onChange={(e) => setEditStartDate(e.currentTarget.value)}
            />
          </label>
          <label className="field">
            <span className="label">End Date</span>
            <input
              className="input"
              type="date"
              value={editEndDate}
              onChange={(e) => setEditEndDate(e.currentTarget.value)}
            />
          </label>
        </div>
      </Modal>

      <EnrollmentMigrateDialog
        open={!!migrateTarget}
        enrollment={migrateTarget}
        grants={grants.map((g) => ({
          id: String(g.id || ""),
          name: g.name ? String(g.name) : undefined,
          code: g.code ? String(g.code) : undefined,
          status: g.status ? String(g.status) : undefined,
          budget: {
            lineItems: Array.isArray(g?.budget?.lineItems)
              ? g.budget.lineItems
                  .map((li) => ({
                    id: String(li?.id || ""),
                    ...(li?.name ? { name: String(li.name) } : {}),
                    ...(li?.label ? { label: String(li.label) } : {}),
                  }))
                  .filter((li) => li.id)
              : [],
          },
        }))}
        onClose={() => setMigrateTarget(null)}
        onDone={() => {
          // Hook invalidation already runs; refetch immediately for instant table update.
          void refetch();
        }}
      />
    </div>
  );
}

export default EnrollmentsTab;
