import React from "react";
import MonthlyDigestDialog from "@entities/dialogs/MonthlyDigestDialog";
import RefreshButton from "@entities/ui/RefreshButton";
import type { TaskReassignTarget } from "@entities/selectors/TaskReassignSelect";
import {
  appendInboxReassignNote,
  formatInboxActionError,
  inboxIdOf,
  parseGenericInboxId,
  parseTaskRef,
  readInboxNote,
  sourceKind,
  useInboxTaskRegistry,
} from "@entities/tasks/inboxTaskRegistry";
import { useInboxWorkloadList } from "@hooks/useInbox";
import { isInboxClosed } from "@hooks/useInboxDetail";
import { qk } from "@hooks/queryKeys";
import { useQueryClient } from "@tanstack/react-query";
import {
  useTaskOtherAssign,
  useTaskOtherUpdate,
  useTasksAssign,
  useTasksUpdateFields,
} from "@hooks/useTasks";
import { useMe, useUsers, type CompositeUser } from "@hooks/useUsers";
import { useAdminEnrollmentsData } from "@entities/Page/dashboardStyle/hooks/useAdminEnrollmentsData";
import { fmtCurrencyUSD, fmtDateOrDash } from "@lib/formatters";
import {
  buildCaseManagerReport,
  effectiveEnrollmentAllocation,
  emptyCaseManagerReportStats,
  reportCustomerIsActive,
  reportEnrollmentIsActive,
} from "@features/casemanagers/components/caseManagerReportModel";
import { hasRole, isAdminLike, isCaseManagerLike, normalizeRole } from "@lib/roles";
import { reassignDebugLog } from "@lib/reassignDebug";
import { toast } from "@lib/toast";
import { Pagination, usePagination } from "@entities/ui/dashboardStyle/Pagination";
import { SmartExportButton } from "@entities/ui/dashboardStyle/SmartExportButton";
import { ToolCard } from "@entities/ui/dashboardStyle/ToolCard";
import { ToolTable } from "@entities/ui/dashboardStyle/ToolTable";
import { useDashboardToolModal } from "@entities/Page/dashboardStyle/hooks/useDashboardToolModal";
import type { DashboardToolDefinition, NavCrumb } from "@entities/Page/dashboardStyle/types";
import { monthKeyNow } from "../utils";

export type CaseManagerLoadFilterState = {
  month: string;
  showLegacyCols: boolean;
};

export type CaseManagerLoadSelection = {
  caseManagerId: string;
} | null;

type CaseManagerLoadTopbarProps = {
  value: CaseManagerLoadFilterState;
  onChange: (next: CaseManagerLoadFilterState) => void;
  selection: CaseManagerLoadSelection;
  nav: {
    stack: NavCrumb<CaseManagerLoadSelection>[];
    push: (c: NavCrumb<CaseManagerLoadSelection>) => void;
    pop: () => void;
    reset: () => void;
    setStack: (s: NavCrumb<CaseManagerLoadSelection>[]) => void;
  };
};

type CaseManagerLoadRow = {
  caseManagerId: string;
  caseManagerName: string;
  customers: number;
  enrollments: number;
  newCustomers: number;
  changedCustomers: number;
  totalAllocation: number;
  tier1: number;
  tier2: number;
  tier3: number;
  untiered: number;
  openTasks: number;
  completedTasks: number;
  totalTasks: number;
};

type InboxRow = {
  id?: string;
  utid?: string;
  dueDate?: string;
  title?: string;
  source?: string;
  sourcePath?: string;
  assignedToGroup?: string | null;
  assignedToUid?: string | null;
  customerId?: string | null;
  clientId?: string | null;
  status?: string;
  note?: string | null;
  notes?: string | null;
  subtitle?: string | null;
};

export const CaseManagerLoadTopbar: DashboardToolDefinition<
  CaseManagerLoadFilterState,
  CaseManagerLoadSelection
>["ToolTopbar"] = ({ value, onChange }: CaseManagerLoadTopbarProps) => (
  <>
    <input
      type="month"
      className="input input-sm w-36"
      value={value.month}
      onChange={(e) => onChange({ ...value, month: e.currentTarget.value || value.month })}
    />
    <label className="inline-flex items-center gap-1 text-xs text-slate-700">
      <input
        type="checkbox"
        checked={value.showLegacyCols}
        onChange={(e) => onChange({ ...value, showLegacyCols: e.currentTarget.checked })}
      />
      Show task totals
    </label>
  </>
);

function errMsg(e: unknown, fallback: string): string {
  return formatInboxActionError(e, fallback);
}

function displayUserName(u: CompositeUser | null | undefined): string {
  if (!u) return "";
  const name = String(u.displayName || "").trim();
  if (name) return name;
  const email = String(u.email || "").trim();
  if (email) return email;
  return String(u.uid || "");
}

function ownerKeyFromInbox(row: InboxRow): string {
  const uid = String(row.assignedToUid || "").trim();
  if (uid) return uid;
  const group = String(row.assignedToGroup || "").trim().toLowerCase();
  if (group) return `queue:${group}`;
  return "queue:unassigned";
}

function ownerLabel(ownerKey: string, fallback = ""): string {
  if (!ownerKey.startsWith("queue:")) return fallback || ownerKey;
  const queue = ownerKey.slice("queue:".length);
  if (queue === "compliance") return "Compliance Queue";
  if (queue === "admin") return "Admin Queue";
  if (queue === "casemanager") return "Case Manager Queue";
  if (!queue || queue === "unassigned") return "Unassigned Queue";
  return `${queue.charAt(0).toUpperCase()}${queue.slice(1)} Queue`;
}

type CaseManagerLoadToolProps = {
  mode?: "legacy" | "dashboard";
  month?: string;
  onMonthChange?: (next: string) => void;
  showLegacyCols?: boolean;
  onShowLegacyColsChange?: (next: boolean) => void;
  selection?: CaseManagerLoadSelection;
  onSelectionChange?: (next: CaseManagerLoadSelection, row?: CaseManagerLoadRow) => void;
};

export function CaseManagerLoadTool(props: CaseManagerLoadToolProps = {}) {
  const mode = props.mode || "legacy";
  const qc = useQueryClient();
  const taskRegistry = useInboxTaskRegistry();
  const { openTaskReassign } = useDashboardToolModal();
  const { data: me } = useMe();
  // Keep these query keys aligned with CaseManagersPage so navigation reuses cache.
  const usersQ = useUsers({ status: "all", limit: 500 });
  const [monthState, setMonthState] = React.useState(monthKeyNow());
  const [selectedUidState, setSelectedUidState] = React.useState<string>("");
  const [showLegacyColsState, setShowLegacyColsState] = React.useState(false);
  const [digestOpen, setDigestOpen] = React.useState(false);

  const canAdminMutate = isAdminLike(me);
  const canOverseeLoads =
    canAdminMutate ||
    hasRole((me as any)?.roles, "compliance") ||
    hasRole((me as any)?.roles, "supervisor") ||
    normalizeRole((me as any)?.topRole || (me as any)?.role) === "supervisor";
  const myUid = String(me?.uid || "");
  const month = props.month ?? monthState;
  const showLegacyCols = props.showLegacyCols ?? showLegacyColsState;
  const selectedUid =
    props.selection !== undefined
      ? String(props.selection?.caseManagerId || "")
      : selectedUidState;
  const scopedAssigneeUid =
    mode === "dashboard" && selectedUid && !selectedUid.startsWith("queue:")
      ? selectedUid
      : canOverseeLoads
        ? ""
        : myUid;
  const workloadFilters = React.useMemo(
    () => ({
      month,
      ...(scopedAssigneeUid ? { assigneeUid: scopedAssigneeUid } : {}),
      includeUnassigned: true,
      limit: 5000,
    }),
    [month, scopedAssigneeUid]
  );

  const setMonth = React.useCallback(
    (next: string) => {
      if (props.onMonthChange) props.onMonthChange(next);
      else setMonthState(next);
    },
    [props.onMonthChange]
  );

  const setShowLegacyCols = React.useCallback(
    (next: boolean) => {
      if (props.onShowLegacyColsChange) props.onShowLegacyColsChange(next);
      else setShowLegacyColsState(next);
    },
    [props.onShowLegacyColsChange]
  );

  const workloadQ = useInboxWorkloadList(workloadFilters, {
    enabled: !!month && (canOverseeLoads || !!myUid),
    staleTime: 20_000,
  });

  const caseloadData = useAdminEnrollmentsData();

  const caseManagerReport = React.useMemo(
    () => buildCaseManagerReport({
      caseManagerIds: (usersQ.data || [])
        .filter((user) => isCaseManagerLike(user))
        .map((user) => String(user.uid || "")),
      customers: caseloadData.customers as Array<Record<string, unknown>>,
      enrollments: caseloadData.enrollments as Array<Record<string, unknown>>,
      month,
    }),
    [usersQ.data, caseloadData.customers, caseloadData.enrollments, month]
  );

  const workloadItems = React.useMemo<InboxRow[]>(
    () => (workloadQ.data || []) as InboxRow[],
    [workloadQ.data]
  );

  const updateFields = useTasksUpdateFields();
  const reassignTask = useTasksAssign();
  const reassignOther = useTaskOtherAssign();
  const updateOther = useTaskOtherUpdate();

  const userByUid = React.useMemo(() => {
    const m = new Map<string, CompositeUser>();
    for (const u of usersQ.data || []) {
      if (isCaseManagerLike(u)) m.set(String(u.uid || ""), u);
    }
    return m;
  }, [usersQ.data]);

  const { customerNameById } = caseloadData;

  const tasksByUid = React.useMemo(() => {
    const m = new Map<string, InboxRow[]>();
    for (const row of workloadItems) {
      // When viewing a specific CM's scope, unassigned queue items belong to that CM
      const uid = String(row.assignedToUid || "").trim();
      const ownerKey = (!uid && scopedAssigneeUid) ? scopedAssigneeUid : ownerKeyFromInbox(row);
      const arr = m.get(ownerKey) || [];
      arr.push(row);
      m.set(ownerKey, arr);
    }
    return m;
  }, [workloadItems, scopedAssigneeUid]);

  const rows = React.useMemo<CaseManagerLoadRow[]>(() => {
    const uids = new Set<string>();
    for (const uid of userByUid.keys()) uids.add(uid);
    for (const uid of caseManagerReport.statsByUid.keys()) if (uid && uid !== "unassigned") uids.add(uid);

    const out: CaseManagerLoadRow[] = [];
    for (const uid of uids) {
      const user = userByUid.get(uid);
      const stats = caseManagerReport.statsByUid.get(uid) || emptyCaseManagerReportStats();
      const tasks = tasksByUid.get(uid) || [];
      let open = 0;
      let completed = 0;
      for (const t of tasks) {
        if (isInboxClosed(t.status)) completed += 1;
        else open += 1;
      }
      out.push({
        caseManagerId: uid,
        caseManagerName:
          displayUserName(user) ||
          ownerLabel(uid, uid),
        customers: stats.activeCaseload,
        enrollments: stats.activeEnrollments,
        newCustomers: stats.newCustomersThisMonth,
        changedCustomers: stats.changedCustomersThisMonth,
        totalAllocation: stats.totalAllocation,
        tier1: stats.tier1,
        tier2: stats.tier2,
        tier3: stats.tier3,
        untiered: stats.untiered,
        openTasks: open,
        completedTasks: completed,
        totalTasks: tasks.length,
      });
    }

    out.sort((a, b) => {
      if (b.customers !== a.customers) return b.customers - a.customers;
      return a.caseManagerName.localeCompare(b.caseManagerName);
    });
    return out;
  }, [userByUid, caseManagerReport.statsByUid, tasksByUid]);

  const setSelectedUid = React.useCallback(
    (nextUid: string, row?: CaseManagerLoadRow) => {
      if (props.selection === undefined) setSelectedUidState(nextUid);
      props.onSelectionChange?.(nextUid ? { caseManagerId: nextUid } : null, row);
    },
    [props.selection, props.onSelectionChange]
  );

  React.useEffect(() => {
    if (mode !== "legacy") return;
    if (props.selection !== undefined) return;
    if (!selectedUid && rows.length) setSelectedUid(rows[0].caseManagerId, rows[0]);
  }, [mode, props.selection, rows, selectedUid, setSelectedUid]);

  const showDetailOnly = mode === "dashboard" && !!selectedUid;

  const pagination = usePagination(rows, 50);
  const selectedRow = rows.find((r) => r.caseManagerId === selectedUid) || null;
  const canSendDigest = canAdminMutate && !!selectedUid && !selectedUid.startsWith("queue:");

  const selectedTasks = React.useMemo(() => {
    const list = selectedUid ? tasksByUid.get(selectedUid) || [] : [];
    return [...list].sort((a, b) => {
      const aOpen = !isInboxClosed(a.status);
      const bOpen = !isInboxClosed(b.status);
      if (aOpen !== bOpen) return aOpen ? -1 : 1;
      return String(a.dueDate || "9999-99-99").localeCompare(String(b.dueDate || "9999-99-99"));
    });
  }, [selectedUid, tasksByUid]);

  const selectedCustomers = React.useMemo(() => {
    const taskCounts = new Map<string, number>();
    for (const task of selectedTasks) {
      if (isInboxClosed(task.status)) continue;
      const customerId = String(task.customerId || task.clientId || "").trim();
      if (customerId) taskCounts.set(customerId, (taskCounts.get(customerId) || 0) + 1);
    }
    return (caseManagerReport.customersByUid.get(selectedUid) || [])
      .filter(reportCustomerIsActive)
      .map((customer) => {
        const customerId = String(customer.id || "");
        const enrollments = caseManagerReport.enrollmentsByCustomerId.get(customerId) || [];
        return {
          id: customerId,
          name: customerNameById.get(customerId) || String(customer.name || customerId || "-"),
          tier: Number(customer.tier),
          enrollments: enrollments.filter(reportEnrollmentIsActive).length,
          allocation: enrollments
            .filter(reportEnrollmentIsActive)
            .reduce((sum, enrollment) => sum + effectiveEnrollmentAllocation(enrollment), 0),
          openTasks: taskCounts.get(customerId) || 0,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [caseManagerReport.customersByUid, caseManagerReport.enrollmentsByCustomerId, customerNameById, selectedTasks, selectedUid]);

  const onCompleteOrReopen = React.useCallback(
    async (row: InboxRow, action: "complete" | "reopen") => {
      try {
        const actions = taskRegistry.resolve(row);
        const fn = action === "complete" ? actions.complete : actions.reopen;
        if (!fn) {
          toast(actions.blockedStatusReason || "This item must be resolved through its source workflow.", { type: "error" });
          return;
        }
        await fn();
      } catch (e: unknown) {
        toast(errMsg(e, "Failed to update task status."), { type: "error" });
      }
    },
    [taskRegistry]
  );

  const onReassignTo = React.useCallback(
    async (row: InboxRow, target: TaskReassignTarget, note: string) => {
      try {
        reassignDebugLog("CaseManagerLoadTool", "onReassignTo:start", {
          inboxId: inboxIdOf(row),
          source: row.source,
          assignedToUid: row.assignedToUid,
          target,
          noteLength: String(note || "").trim().length,
        });
        const existingNote = readInboxNote(row);
        const mergedNote = appendInboxReassignNote(existingNote, note);

        const taskRef = parseTaskRef(row);
        if (taskRef) {
          const priorUid = String(row.assignedToUid || "").trim();
          if (target.kind === "compliance" || target.kind === "admin") {
            await reassignTask.mutateAsync({
              enrollmentId: taskRef.enrollmentId,
              taskId: taskRef.taskId,
              assign: { group: target.kind, uid: null },
            });
            reassignDebugLog("CaseManagerLoadTool", "task:assigned-group", {
              taskRef,
              targetGroup: target.kind,
            });
          } else {
            const uid = String(target.cmUid || "").trim();
            if (!uid) return;
            await reassignTask.mutateAsync({
              enrollmentId: taskRef.enrollmentId,
              taskId: taskRef.taskId,
              assign: { group: null, uid },
            });
            reassignDebugLog("CaseManagerLoadTool", "task:assigned-cm", {
              taskRef,
              targetUid: uid,
            });
          }
          const nextUid = target.kind === "cm" ? String(target.cmUid || "").trim() : "";
          if (!nextUid || (priorUid && nextUid !== priorUid)) {
            const movedKey = inboxIdOf(row);
            const matches = qc.getQueriesData({ queryKey: qk.inbox.root });
            let touchedQueries = 0;
            for (const [key, data] of matches) {
              if (!Array.isArray(key) || key.length < 2) continue;
              if (String(key[0] || "") !== "inbox" || String(key[1] || "") !== "workload") continue;
              if (!Array.isArray(data)) continue;
              touchedQueries += 1;
              qc.setQueryData(
                key,
                (data as InboxRow[]).filter((x) => inboxIdOf(x) !== movedKey)
              );
            }
            reassignDebugLog("CaseManagerLoadTool", "cache:removed-moved-row", {
              movedKey,
              touchedQueries,
              nextUid,
              priorUid,
            });
            void qc.invalidateQueries({ queryKey: qk.inbox.workload(workloadFilters), exact: true });
            reassignDebugLog("CaseManagerLoadTool", "cache:invalidate-workload", {
              workloadFilters,
            });
          }

          if (mergedNote !== existingNote) {
            await updateFields.mutateAsync({
              enrollmentId: taskRef.enrollmentId,
              taskId: taskRef.taskId,
              patch: { notes: mergedNote },
            });
            reassignDebugLog("CaseManagerLoadTool", "task:note-updated", {
              taskRef,
              noteLength: mergedNote.length,
            });
          }
          return;
        }

        const otherId = parseGenericInboxId(row);
        if (otherId) {
          if (target.kind === "compliance" || target.kind === "admin") {
            await reassignOther.mutateAsync({
              id: otherId,
              assign: { group: target.kind, uids: null },
            });
            reassignDebugLog("CaseManagerLoadTool", "other:assigned-group", {
              otherId,
              targetGroup: target.kind,
            });
          } else {
            const uid = String(target.cmUid || "").trim();
            if (!uid) return;
            await reassignOther.mutateAsync({
              id: otherId,
              assign: { group: null, uids: [uid] },
            });
            reassignDebugLog("CaseManagerLoadTool", "other:assigned-cm", {
              otherId,
              targetUid: uid,
            });
          }

          if (mergedNote !== existingNote) {
            await updateOther.mutateAsync({ id: otherId, patch: { notes: mergedNote } });
            reassignDebugLog("CaseManagerLoadTool", "other:note-updated", {
              otherId,
              noteLength: mergedNote.length,
            });
          }
          return;
        }

        toast("Could not resolve reassign route for this item.", { type: "error" });
        reassignDebugLog("CaseManagerLoadTool", "onReassignTo:unsupported", {
          inboxId: inboxIdOf(row),
          source: row.source,
        });
      } catch (e: unknown) {
        reassignDebugLog("CaseManagerLoadTool", "onReassignTo:error", {
          inboxId: inboxIdOf(row),
          target,
          error: errMsg(e, "Failed to reassign task."),
          raw: e,
        });
        toast(errMsg(e, "Failed to reassign task."), { type: "error" });
      }
    },
    [qc, reassignOther, reassignTask, updateFields, updateOther, workloadFilters]
  );

  const onEditNotes = React.useCallback(
    async (row: InboxRow) => {
      const existing = readInboxNote(row);
      const next = window.prompt("Edit task note", existing);
      if (next === null) return;
      try {
        const actions = taskRegistry.resolve(row);
        if (actions.saveNote) {
          await actions.saveNote(String(next || "").trim());
          return;
        }

        toast("Could not resolve task edit route for this item.", { type: "error" });
      } catch (e: unknown) {
        toast(errMsg(e, "Failed to update task note."), { type: "error" });
      }
    },
    [taskRegistry]
  );

  return (
    <ToolCard
      title="Case Manager Statistics"
      actions={
        <>
          <RefreshButton queryKeys={[qk.inbox.workload(workloadFilters)]} label="Refresh" />
          <SmartExportButton
            allRows={rows}
            activeRows={rows}
            filenameBase={`case-loads-${month}`}
            columns={[
              { key: "caseManagerName", label: "Case Manager", value: (r: CaseManagerLoadRow) => r.caseManagerName },
              { key: "customers", label: "Active Caseload", value: (r: CaseManagerLoadRow) => r.customers },
              { key: "newCustomers", label: "New Customers", value: (r: CaseManagerLoadRow) => r.newCustomers },
              { key: "changedCustomers", label: "Customers Changed", value: (r: CaseManagerLoadRow) => r.changedCustomers },
              { key: "totalAllocation", label: "Customer Allocation", value: (r: CaseManagerLoadRow) => r.totalAllocation },
              { key: "tier1", label: "Tier 1", value: (r: CaseManagerLoadRow) => r.tier1 },
              { key: "tier2", label: "Tier 2", value: (r: CaseManagerLoadRow) => r.tier2 },
              { key: "tier3", label: "Tier 3", value: (r: CaseManagerLoadRow) => r.tier3 },
              { key: "untiered", label: "Untiered", value: (r: CaseManagerLoadRow) => r.untiered },
              { key: "openTasks", label: "Open Tasks", value: (r: CaseManagerLoadRow) => r.openTasks },
              { key: "completedTasks", label: "Completed Tasks", value: (r: CaseManagerLoadRow) => r.completedTasks },
              { key: "totalTasks", label: "Total Tasks", value: (r: CaseManagerLoadRow) => r.totalTasks },
              { key: "enrollments", label: "Enrollments", value: (r: CaseManagerLoadRow) => r.enrollments },
            ]}
          />
        </>
      }
    >
      {caseloadData.sharedDataError ? (
        <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          Customer or enrollment data could not be loaded. Task counts may still appear.
        </div>
      ) : caseloadData.isTruncated.customers || caseloadData.isTruncated.enrollments ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Caseload totals may be incomplete because the organization exceeds the report display limit.
        </div>
      ) : null}
      {!showDetailOnly ? (
        <ToolTable
          headers={[
            "Staff",
            <span key="customers" className="block text-right">Active Caseload</span>,
            <span key="new" className="block text-right">New This Month</span>,
            <span key="allocation" className="block text-right">Allocation</span>,
            <span key="open" className="block text-right">Open Tasks</span>,
            <span key="tiers" className="block text-right">Tiers 1 / 2 / 3 / None</span>,
            ...(showLegacyCols ? [
              <span key="completed" className="block text-right">Completed Tasks</span>,
              <span key="total" className="block text-right">Total Tasks</span>,
            ] : []),
          ]}
          rows={
            (workloadQ.isLoading || caseloadData.sharedDataLoading) ? (
              <tr>
                <td colSpan={showLegacyCols ? 8 : 6}>Loading case manager report...</td>
              </tr>
            ) : pagination.pageRows.length ? (
              pagination.pageRows.map((r) => {
                const active = selectedUid === r.caseManagerId;
                return (
                  <tr
                    key={r.caseManagerId}
                    className={`cursor-pointer ${active ? "bg-slate-50" : ""}`}
                    onClick={() => setSelectedUid(r.caseManagerId, r)}
                  >
                    <td>{r.caseManagerName}</td>
                    <td className="text-right font-semibold">{r.customers}</td>
                    <td className="text-right" title={`${r.changedCustomers} customers changed in ${month}`}>{r.newCustomers}</td>
                    <td className="text-right font-medium">{fmtCurrencyUSD(r.totalAllocation)}</td>
                    <td className="text-right font-semibold">{r.openTasks}</td>
                    <td className="text-right">{r.tier1} / {r.tier2} / {r.tier3} / {r.untiered}</td>
                    {showLegacyCols ? <td className="text-right">{r.completedTasks}</td> : null}
                    {showLegacyCols ? <td className="text-right">{r.totalTasks}</td> : null}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={showLegacyCols ? 8 : 6}>No case manager rows found for this month.</td>
              </tr>
            )
          }
        />
      ) : null}
      {!showDetailOnly ? (
        <Pagination page={pagination.page} pageCount={pagination.pageCount} setPage={pagination.setPage} />
      ) : null}

      {selectedRow ? (
        <section className="rounded border border-slate-200 p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{selectedRow.caseManagerName} - {month} caseload</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{selectedTasks.length} tasks</span>
              {canSendDigest ? (
                <button
                  className="btn btn-secondary btn-xs"
                  onClick={() => setDigestOpen(true)}
                >
                  Send Monthly Digest
                </button>
              ) : null}
              {mode === "dashboard" ? (
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => setSelectedUid("", undefined)}
                >
                  Back to list
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="card-section rounded border border-slate-200">
              <div className="text-xs text-slate-500">Active Caseload</div>
              <div className="text-xl font-semibold">{selectedRow.customers}</div>
              <div className="text-xs text-slate-500">{selectedRow.enrollments} active enrollments</div>
            </div>
            <div className="card-section rounded border border-slate-200">
              <div className="text-xs text-slate-500">New on Load</div>
              <div className="text-xl font-semibold">{selectedRow.newCustomers}</div>
              <div className="text-xs text-slate-500">{selectedRow.changedCustomers} customers changed</div>
            </div>
            <div className="card-section rounded border border-slate-200">
              <div className="text-xs text-slate-500">Customer Allocation</div>
              <div className="text-xl font-semibold">{fmtCurrencyUSD(selectedRow.totalAllocation)}</div>
            </div>
            <div className="card-section rounded border border-slate-200">
              <div className="text-xs text-slate-500">Open Tasks</div>
              <div className="text-xl font-semibold">{selectedRow.openTasks}</div>
              <div className="text-xs text-slate-500">Secondary workload signal</div>
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Customers</h4>
            <ToolTable
              headers={["Customer", "Tier", <span key="allocation" className="block text-right">Allocation</span>, <span key="enrollments" className="block text-right">Enrollments</span>, <span key="tasks" className="block text-right">Open Tasks</span>]}
              rows={selectedCustomers.length ? selectedCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td>{customer.name}</td>
                  <td>{customer.tier >= 1 && customer.tier <= 3 ? `Tier ${customer.tier}` : "Untiered"}</td>
                  <td className="text-right font-medium">{fmtCurrencyUSD(customer.allocation)}</td>
                  <td className="text-right">{customer.enrollments}</td>
                  <td className="text-right">{customer.openTasks}</td>
                </tr>
              )) : (
                <tr><td colSpan={5}>No active customers on this load.</td></tr>
              )}
            />
          </div>

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Tasks / reminders</h4>
            <ToolTable
              headers={["Due", "Title", "Customer", "Source", "Status", "Actions"]}
            rows={
              selectedTasks.length ? (
                selectedTasks.map((task) => {
                  const rowActions = taskRegistry.resolve(task);
                  const closed = isInboxClosed(task.status);
                  const canMutate = sourceKind(task) !== "unsupported";
                  const canToggleStatus = closed ? !!rowActions.reopen : !!rowActions.complete;
                  const busy =
                    taskRegistry.pending.updateStatus ||
                    taskRegistry.pending.otherStatus ||
                    reassignTask.isPending ||
                    reassignOther.isPending ||
                    updateFields.isPending ||
                    updateOther.isPending;
                  const customerId = String(task.customerId || task.clientId || "");
                  return (
                    <tr key={inboxIdOf(task)}>
                      <td>{fmtDateOrDash(task.dueDate)}</td>
                      <td>{String(task.title || "-")}</td>
                      <td>{customerId ? customerNameById.get(customerId) || (task as any).customerName || customerId : (task as any).customerName || "-"}</td>
                      <td>{String(task.source || "-")}</td>
                      <td className="capitalize">{closed ? "completed" : "open"}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          {canAdminMutate ? (
                            <>
                              <button
                                className="btn btn-ghost btn-xs"
                                disabled={!canToggleStatus || busy}
                                onClick={() => void onCompleteOrReopen(task, closed ? "reopen" : "complete")}
                              >
                                {closed ? "Reopen" : "Complete"}
                              </button>
                              <button
                                className="btn btn-ghost btn-xs"
                                disabled={!canMutate || busy}
                                onClick={() =>
                                  openTaskReassign({
                                    title: "Reassign Task",
                                    onSubmit: (payload) => onReassignTo(task, payload.target, payload.note),
                                  })
                                }
                              >
                                Reassign
                              </button>
                              <button
                                className="btn btn-ghost btn-xs"
                                disabled={!canMutate || busy}
                                onClick={() => void onEditNotes(task)}
                              >
                                Edit
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-slate-500">Admin only</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6}>No tasks for selected staff in {month}.</td>
                </tr>
              )
            }
            />
          </div>
        </section>
      ) : null}
      {selectedRow && canSendDigest ? (
        <MonthlyDigestDialog
          open={digestOpen}
          month={month}
          cmUid={selectedUid}
          cmName={selectedRow.caseManagerName}
          onClose={() => setDigestOpen(false)}
        />
      ) : null}
    </ToolCard>
  );
}
