"use client";

import React from "react";
import { DateInput } from "@entities/ui/DateInput";
import ActionMenu from "@entities/ui/ActionMenu";
import GrantSelect from "@entities/selectors/GrantSelect";
import { Modal } from "@entities/ui/Modal";
import { EnrollmentMigrateDialog } from "@entities/dialogs/enrollment/EnrollmentMigrateDialog";
import { EnrollmentCleanupDialog } from "@entities/dialogs/enrollment/EnrollmentCleanupDialog";
import { useGrants } from "@hooks/useGrants";
import { usePaymentsDeleteRows, usePaymentsSpend } from "@hooks/usePayments";
import { useTasksDelete, useTasksUpdateStatus } from "@hooks/useTasks";
import {
  useCustomerEnrollments,
  useEnrollCustomer,
  useEnrollmentActionsApply,
  useEnrollmentsAdminDelete,
  useEnrollmentsDelete,
  useEnrollmentsPatch,
  useEnrollmentsUndoMigration,
  useEnrollmentsVoidProjections,
} from "@hooks/useEnrollments";
import { toast } from "@lib/toast";
import { fmtDateOrDash } from "@lib/formatters";
import { formatEnrollmentLabel } from "@lib/enrollmentLabels";
import { addDays, addMonthsISO, parseISO10, toISODate } from "@lib/date";
import { RowStateBadge } from "@entities/ui/rowState";
import { toApiError } from "@client/api";
import type { Enrollment } from "@client/enrollments";
import type { EnrollmentsPatchReq } from "@types";
import {
  enrollmentControlActionBody,
  enrollmentControlDone,
  enrollmentControlPatch,
  enrollmentControlStatusLabel,
  enrollmentControlsForGrant,
  type EnrollmentControlDescriptor,
} from "@features/enrollments/enrollmentControls";
import { defaultGrantDriveTemplateKeys, grantDriveTemplates } from "@features/grants/driveTemplates";
import { useGDriveCopyGrantTemplates } from "@hooks/useGDrive";

function isoToday(): string {
  return toISODate(new Date());
}

function defaultEnrollmentEndDateForGrant(
  startDate?: string | null,
  grantEndDate?: string | null,
  authorizationMonths?: number | null,
): string {
  const start = String(startDate || "").slice(0, 10);
  const months = Number(authorizationMonths);
  if (start && Number.isFinite(months) && months > 0) {
    const nextStart = addMonthsISO(start, Math.floor(months));
    const parsed = parseISO10(nextStart);
    const end = parsed ? toISODate(addDays(parsed, -1)) : "";
    return capEnrollmentEndDate(end, grantEndDate);
  }
  return String(grantEndDate || "").slice(0, 10);
}

function capEnrollmentEndDate(endDate: string, grantEndDate?: string | null): string {
  const grantEnd = String(grantEndDate || "").slice(0, 10);
  if (!grantEnd || !endDate) return endDate;
  return endDate > grantEnd ? grantEnd : endDate;
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

function badgeClasses(done: boolean): string {
  return done
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50";
}

type MigrationLineage = {
  migratedTo?: { enrollmentId?: string; grantId?: string; cutover?: string; migrationId?: string } | null;
  migratedFrom?: { enrollmentId?: string; grantId?: string; cutover?: string; migrationId?: string } | null;
};

function rowMigrationLineage(row: Enrollment): MigrationLineage {
  return row as unknown as MigrationLineage;
}

/** Migration id recorded on either side of a migration (source has migratedTo, destination has migratedFrom). */
function rowMigrationId(row: Enrollment): string {
  const lineage = rowMigrationLineage(row);
  return String(lineage.migratedTo?.migrationId || lineage.migratedFrom?.migrationId || "").trim();
}

type UndoMigrationCandidate = { migrationId: string; label: string };

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
  const grantEndDateById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const g of grants) {
      const id = String(g.id || "").trim();
      if (!id) continue;
      const end = String(g.endDate || "").slice(0, 10);
      if (end) map.set(id, end);
    }
    return map;
  }, [grants]);
  const grantById = React.useMemo(() => {
    const map = new Map<string, any>();
    for (const g of grants) {
      const id = String(g.id || "").trim();
      if (id) map.set(id, g);
    }
    return map;
  }, [grants]);

  const enroll = useEnrollCustomer();
  const patch = useEnrollmentsPatch();
  const applyAction = useEnrollmentActionsApply();
  const softDelete = useEnrollmentsDelete();
  const adminDelete = useEnrollmentsAdminDelete();
  const undoMigration = useEnrollmentsUndoMigration();
  const voidProjections = useEnrollmentsVoidProjections();
  const copyGrantTemplates = useGDriveCopyGrantTemplates();
  const paymentsSpend = usePaymentsSpend();
  const paymentsDeleteRows = usePaymentsDeleteRows();
  const tasksUpdateStatus = useTasksUpdateStatus();
  const tasksDelete = useTasksDelete();

  const [grantId, setGrantId] = React.useState<string | null>(null);
  const [startDate, setStartDate] = React.useState<string>(isoToday());
  const [endDate, setEndDate] = React.useState<string>("");
  const [endDateTouched, setEndDateTouched] = React.useState<boolean>(false);
  const [generateTaskSchedule, setGenerateTaskSchedule] = React.useState<boolean>(true);
  const [copyTemplates, setCopyTemplates] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const [editing, setEditing] = React.useState<Enrollment | null>(null);
  const [editStartDate, setEditStartDate] = React.useState("");
  const [editEndDate, setEditEndDate] = React.useState("");

  const [migrateTarget, setMigrateTarget] = React.useState<Enrollment | null>(null);
  const [undoCandidate, setUndoCandidate] = React.useState<UndoMigrationCandidate | null>(null);
  const [lastMigration, setLastMigration] = React.useState<UndoMigrationCandidate | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Enrollment | null>(null);
  const [isAdminDelete, setIsAdminDelete] = React.useState(false);
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
    undoMigration.isPending ||
    voidProjections.isPending ||
    paymentsSpend.isPending ||
    paymentsDeleteRows.isPending ||
    tasksUpdateStatus.isPending ||
    tasksDelete.isPending ||
    applyAction.isPending ||
    copyGrantTemplates.isPending;

  const today = React.useMemo(() => isoToday(), []);
  const selectedGrantEndDate = grantId ? grantEndDateById.get(String(grantId)) || "" : "";
  const selectedGrant = grantId ? grantById.get(String(grantId)) : null;
  const selectedAuthorizationMonths = Number((selectedGrant as any)?.enrollmentDefaults?.authorizationMonths);
  const selectedDriveTemplates = React.useMemo(
    () => grantDriveTemplates(selectedGrant as Record<string, unknown> | null),
    [selectedGrant],
  );
  const selectedDefaultTemplateKeys = React.useMemo(
    () => defaultGrantDriveTemplateKeys(selectedGrant as Record<string, unknown> | null),
    [selectedGrant],
  );

  React.useEffect(() => {
    if (endDateTouched) {
      if (!selectedGrantEndDate) return;
      setEndDate((current) => capEnrollmentEndDate(current, selectedGrantEndDate));
      return;
    }
    setEndDate(defaultEnrollmentEndDateForGrant(
      startDate,
      selectedGrantEndDate,
      selectedAuthorizationMonths,
    ));
  }, [endDateTouched, selectedAuthorizationMonths, selectedGrantEndDate, startDate]);

  React.useEffect(() => {
    setCopyTemplates(selectedDriveTemplates.length > 0);
  }, [grantId, selectedDriveTemplates.length]);

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
      const created = await enroll.mutateAsync({
        customerId,
        grantId: gid,
        extra: {
          status: "active",
          active: true,
          generateTaskSchedule,
          ...(startDate ? { startDate } : {}),
          ...(endDate || endDateTouched
            ? { endDate: endDate ? capEnrollmentEndDate(endDate, selectedGrantEndDate) : null }
            : {}),
        },
      });
      const enrollmentId = String((created as any)?.id || "").trim();
      const templateKeysToCopy = selectedDefaultTemplateKeys.length
        ? selectedDefaultTemplateKeys
        : selectedDriveTemplates.map((template) => template.key);
      if (copyTemplates && templateKeysToCopy.length > 0) {
        try {
          await copyGrantTemplates.mutateAsync({
            customerId,
            grantId: gid,
            enrollmentId: enrollmentId || undefined,
            startDate,
            templateKeys: templateKeysToCopy,
          });
          toast("Grant templates copied.", { type: "success" });
        } catch (copyError: unknown) {
          toast(toApiError(copyError).error || "Enrollment created, but templates were not copied.", { type: "warning" });
        }
      }
      setGrantId(null);
      setStartDate(isoToday());
      setEndDate(defaultEnrollmentEndDateForGrant(isoToday()));
      setEndDateTouched(false);
      setGenerateTaskSchedule(true);
      setCopyTemplates(true);
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

  const toggleEnrollmentControl = async (row: Enrollment, descriptor: EnrollmentControlDescriptor) => {
    setError(null);
    try {
      const next = !enrollmentControlDone(row, descriptor);
      const patchData = enrollmentControlPatch(row, descriptor, next);
      if (patchData) {
        await patchEnrollment(row.id, patchData);
      } else {
        const actionBody = enrollmentControlActionBody(row.id, descriptor, next);
        if (!actionBody) return;
        await applyAction.mutateAsync(actionBody as any);
      }
    } catch (e: unknown) {
      const msg = toApiError(e).error || "Failed to update enrollment control.";
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

      // Void paymentQueue projections. Non-fatal — enrollment is already closed.
      await voidProjections.mutateAsync(closeTarget.id).catch(() => {});

      toast("Enrollment closed.", { type: "success" });
      setCloseTarget(null);
    } catch (e: unknown) {
      const msg = toApiError(e).error || "Failed to close enrollment.";
      setError(msg);
      toast(msg, { type: "error" });
    }
  };

  const onSoftDelete = (row: Enrollment) => {
    setDeleteTarget(row);
    setIsAdminDelete(false);
  };

  const onAdminDelete = (row: Enrollment) => {
    setDeleteTarget(row);
    setIsAdminDelete(true);
  };

  const confirmDelete = async ({ voidPaid, unlinkSpends }: { voidPaid: boolean; unlinkSpends: boolean }) => {
    if (!deleteTarget) return;
    setError(null);
    const id = deleteTarget.id;
    setDeleteTarget(null);
    try {
      if (isAdminDelete) {
        await adminDelete.mutateAsync({ id, voidPaid, unlinkSpends });
      } else {
        await softDelete.mutateAsync({ id, voidPaid, unlinkSpends });
      }
      toast(`Enrollment ${isAdminDelete ? "permanently deleted" : "deleted"}.`, { type: "success" });
    } catch (e: unknown) {
      const msg = toApiError(e).error || "Failed to delete enrollment.";
      setError(msg);
      toast(msg, { type: "error" });
    }
  };

  const openEdit = (row: Enrollment) => {
    setEditing(row);
    setEditStartDate(row.startDate ? toISODate(String(row.startDate)) : "");
    setEditEndDate(capEnrollmentEndDate(row.endDate ? toISODate(String(row.endDate)) : "", grantEndDateById.get(String(row.grantId || "")) || ""));
  };

  const saveEdit = async () => {
    if (!editing) return;
    setError(null);
    try {
      await patchEnrollment(editing.id, {
        startDate: editStartDate || null,
        endDate: capEnrollmentEndDate(editEndDate, grantEndDateById.get(String(editing.grantId || "")) || "") || null,
      });
      setEditing(null);
      toast("Enrollment dates updated.", { type: "success" });
    } catch (e: unknown) {
      const msg = toApiError(e).error || "Failed to update dates.";
      setError(msg);
      toast(msg, { type: "error" });
    }
  };

  const confirmUndoMigration = async () => {
    if (!undoCandidate) return;
    setError(null);
    try {
      await undoMigration.mutateAsync({ migrationId: undoCandidate.migrationId });
      toast("Migration undone.", { type: "success" });
      setUndoCandidate(null);
      setLastMigration(null);
      void refetch();
    } catch (e: unknown) {
      const msg = toApiError(e).error || "Failed to undo migration.";
      setError(msg);
      toast(msg, { type: "error" });
    }
  };

  const openUndoMigration = (row: Enrollment) => {
    const migrationId = rowMigrationId(row);
    if (!migrationId) return;
    setUndoCandidate({
      migrationId,
      label: formatEnrollmentLabel(row as unknown as Record<string, unknown>),
    });
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
    const grant = grantById.get(String(row.grantId || "")) || {};
    const controls = enrollmentControlsForGrant(grant as Record<string, unknown>, isInactiveEnrollment(row));

    if (!controls.length) {
      return <span className="text-xs text-slate-400">None</span>;
    }

    return (
      <div className="flex flex-wrap gap-2">
        {controls.map((descriptor) => {
          const done = enrollmentControlDone(row, descriptor);
          return (
            <button
              key={`${descriptor.kind}_${descriptor.key}`}
              type="button"
              className={["rounded-full border px-2 py-1 text-xs font-medium", badgeClasses(done)].join(" ")}
              onClick={() => void toggleEnrollmentControl(row, descriptor)}
              disabled={busy}
            >
              {descriptor.control.label} {enrollmentControlStatusLabel(done, descriptor)}
            </button>
          );
        })}
      </div>
    );
  };

  const renderActions = (row: Enrollment) => {
    const grantStatus = grantStatusById.get(String(row.grantId || "")) || "";
    const grantClosed = grantStatus === "closed" || grantStatus === "deleted";
    const rowOpen = !isInactiveEnrollment(row);
    const canEditDates = true;
    const canMigrate = (!grantClosed && rowOpen) || ALLOW_MIGRATION_FOR_CLOSED_ROWS;

    const undoItems = rowMigrationId(row)
      ? [{ key: "undo-migration", label: "Undo Migration", onSelect: () => openUndoMigration(row), danger: true }]
      : [];

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
            ...undoItems,
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
          ...undoItems,
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
                    <div className="flex flex-col items-start gap-1">
                      <RowStateBadge
                        state={isInactiveEnrollment(row) ? "inactive" : "active"}
                        label={toOpenClosed(row)}
                      />
                      {rowMigrationLineage(row).migratedTo ? (
                        <span
                          className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700"
                          title={`Migrated out on ${rowMigrationLineage(row).migratedTo?.cutover || "?"}`}
                        >
                          Migrated out
                        </span>
                      ) : null}
                      {rowMigrationLineage(row).migratedFrom ? (
                        <span
                          className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700"
                          title={`Migrated in on ${rowMigrationLineage(row).migratedFrom?.cutover || "?"}`}
                        >
                          Migrated in
                        </span>
                      ) : null}
                    </div>
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
              onChange={(next) => {
                setGrantId(next);
                setEndDateTouched(false);
              }}
              includeUnassigned
              placeholderLabel="-- Select grant or program --"
              disabled={busy}
              className="w-full"
              filters={{ active: true, limit: 500 }}
            />
          </label>
          <div className="field">
            <span className="label">Start Date (optional)</span>
            <DateInput
              value={startDate}
              onChange={setStartDate}
              disabled={busy}
            />
          </div>
          <div className="field">
            <span className="label">End Date (optional)</span>
            <DateInput
              value={endDate}
              max={selectedGrantEndDate || undefined}
              onChange={(value) => {
                setEndDateTouched(true);
                setEndDate(capEnrollmentEndDate(value, selectedGrantEndDate));
              }}
              disabled={busy}
            />
          </div>
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
        {selectedDriveTemplates.length > 0 ? (
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={copyTemplates}
              onChange={(e) => setCopyTemplates(e.currentTarget.checked)}
              disabled={busy}
            />
            <span>
              Copy {selectedDefaultTemplateKeys.length || selectedDriveTemplates.length} grant template
              {(selectedDefaultTemplateKeys.length || selectedDriveTemplates.length) === 1 ? "" : "s"} into the customer folder
            </span>
          </label>
        ) : null}
        <div className="mt-0.5 text-xs text-slate-400">
          Default start date is today. End date is optional — leave blank for open-ended enrollments. If the grant has an end date, the enrollment cannot extend past it.
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

      {lastMigration ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900">
          <span>
            Migrated <span className="font-medium">{lastMigration.label}</span>. If something looks wrong you can undo it.
          </span>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              className="btn btn-xs"
              onClick={() => setUndoCandidate(lastMigration)}
              disabled={busy}
            >
              Undo
            </button>
            <button
              type="button"
              className="btn btn-xs btn-ghost border border-violet-200"
              onClick={() => setLastMigration(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="text-sm text-slate-600">Loading enrollments...</div>
      ) : filtered.length === 0 && search ? (
        <div className="rounded-xl border border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
          No enrollments match &ldquo;{search}&rdquo;
        </div>
      ) : (
        <>
          {renderTable(activeRows, `Active Enrollments (${activeRows.length})`)}
          {inactiveRows.length > 0
            ? renderTable(inactiveRows, `Inactive Enrollments (${inactiveRows.length})`)
            : null}
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
          <div className="field">
            <span className="label">Close Date</span>
            <DateInput value={closeDate} onChange={setCloseDate} />
          </div>

          <div className="rounded border border-slate-200 p-3">
            <div className="mb-2 text-sm font-medium">Future tasks (after close date)</div>
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
            <div className="mb-2 text-sm font-medium">Future payments (after close date)</div>
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

          {closeFutureUnpaidPayments.length > 0 && (
            <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <span className="font-medium">{closeFutureUnpaidPayments.length} pending payment queue projection{closeFutureUnpaidPayments.length !== 1 ? "s" : ""}</span>
              {" "}will be voided when this enrollment is closed.
            </div>
          )}

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
          <div className="field">
            <span className="label">Start Date</span>
            <DateInput
              value={editStartDate}
              onChange={setEditStartDate}
            />
          </div>
          <div className="field">
            <span className="label">End Date</span>
            <DateInput
              value={editEndDate}
              max={editing ? grantEndDateById.get(String(editing.grantId || "")) || undefined : undefined}
              onChange={(value) => setEditEndDate(capEnrollmentEndDate(value, editing ? grantEndDateById.get(String(editing.grantId || "")) || "" : ""))}
            />
          </div>
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
          endDate: g.endDate ? String(g.endDate).slice(0, 10) : null,
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
        onDone={(result) => {
          const migrationId = String(result?.migrationId || "").trim();
          if (migrationId) {
            setLastMigration({
              migrationId,
              label: migrateTarget
                ? formatEnrollmentLabel(migrateTarget as unknown as Record<string, unknown>)
                : "enrollment",
            });
          }
          // Hook invalidation already runs; refetch immediately for instant table update.
          void refetch();
        }}
      />

      <Modal
        isOpen={!!undoCandidate}
        title={undoCandidate ? `Undo Migration — ${undoCandidate.label}` : "Undo Migration"}
        onClose={() => setUndoCandidate(null)}
        widthClass="max-w-lg"
        footer={
          <div className="flex justify-end gap-2">
            <button className="btn-secondary btn-sm" onClick={() => setUndoCandidate(null)} disabled={busy}>
              Cancel
            </button>
            <button className="btn btn-sm" onClick={() => void confirmUndoMigration()} disabled={busy || !undoCandidate}>
              {undoMigration.isPending ? "Undoing..." : "Undo Migration"}
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-amber-800">
            This reverses the entire migration, not just this enrollment.
          </div>
          <div className="text-slate-700">Undoing the migration will:</div>
          <ul className="list-disc space-y-1 pl-5 text-slate-700">
            <li>Restore the source enrollment exactly as it was before the migration (payments, tasks, status).</li>
            <li>Delete the destination enrollment created by the migration.</li>
            <li>Restore both grant budgets to their pre-migration state.</li>
            <li>Write compensating ledger entries so financial history nets to zero.</li>
          </ul>
          <div className="text-xs text-slate-500">
            Changes made to either enrollment after the migration will be lost. This action is idempotent — running it twice has no additional effect.
          </div>
        </div>
      </Modal>

      <EnrollmentCleanupDialog
        open={!!deleteTarget}
        enrollmentLabel={deleteTarget ? formatEnrollmentLabel(deleteTarget as any) : ""}
        isAdminDelete={isAdminDelete}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={(opts) => void confirmDelete(opts)}
      />
    </div>
  );
}

export default EnrollmentsTab;
