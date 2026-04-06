"use client";

import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { TCustomerEntity } from "@types";
import type { TPayment, ReqOf } from "@types";
import EnrollmentsAPI, { type Enrollment } from "@client/enrollments";
import TasksAPI from "@client/tasks";
import PaymentsAPI from "@client/payments";
import CaseManagerSelect, { type CaseManagerOption } from "@entities/selectors/CaseManagerSelect";
import GrantSelect from "@entities/selectors/GrantSelect";
import { useGrants } from "@hooks/useGrants";
import { PageBulkActionsBar, PageFilterBar } from "@entities/Page";
import { CardGrid, Modal } from "@entities/ui";
import { FilterToggleGroup } from "@entities/ui";
import { useHardDeleteCustomers, usePatchCustomers, useSoftDeleteCustomers } from "@hooks/useCustomers";
import {
  CUSTOMER_ENROLLMENTS_LIMIT,
  getStaleCustomerEnrollmentIds,
  preloadCustomerEnrollments,
  useEnrollmentsBulkEnroll,
} from "@hooks/useEnrollments";
import { qk } from "@hooks/queryKeys";
import { toast } from "@lib/toast";
import { CustomerCard } from "./CustomerCard";

// ─── Enrollment grant filter dropdown ───────────────────────────────────────

function EnrollmentGrantFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: grants = [] } = useGrants({ active: true, limit: 500 });
  const sorted = React.useMemo(
    () => [...grants].sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id))),
    [grants],
  );
  return (
    <div className="min-w-[200px] space-y-1">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
        Enrollment
      </div>
      <select
        className="select w-full text-sm"
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
      >
        <option value="all">All (no filter)</option>
        {sorted.map((g) => (
          <option key={String(g.id)} value={String(g.id)}>
            {String(g.name || g.id || "")}
          </option>
        ))}
      </select>
    </div>
  );
}

type CustomerRow = TCustomerEntity & { id: string };
type ActiveMode = "all" | "active" | "inactive";
type DeletedMode = "exclude" | "include" | "only";
type ScopeMode = "all" | "my" | "primary" | "secondary";
type PopulationFilter = "all" | "Youth" | "Individual" | "Family" | "unknown";
type CustomerSortMode =
  | "alphabetical"
  | "first-added"
  | "last-added"
  | "first-updated"
  | "last-updated"
  | "highest-acuity"
  | "lowest-acuity";

type CustomerCardViewProps = {
  myUid: string;
  isAdminUser: boolean;
  rows: TCustomerEntity[];
  totalRows: number;
  isLoading: boolean;
  isError: boolean;
  activeMode: ActiveMode;
  deletedMode: DeletedMode;
  scopeMode: ScopeMode;
  cmFilter: string;
  search: string;
  populationFilter: PopulationFilter;
  sortMode: CustomerSortMode;
  grantFilter: string;
  caseManagerOptions: CaseManagerOption[];
  onActiveModeChange: (mode: ActiveMode) => void;
  onDeletedModeChange: (mode: DeletedMode) => void;
  onScopeModeChange: (mode: ScopeMode) => void;
  onCmFilterChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onPopulationFilterChange: (value: PopulationFilter) => void;
  onSortModeChange: (value: CustomerSortMode) => void;
  onGrantFilterChange: (value: string) => void;
  onResetFilters: () => void;
  /** Called when Enter is pressed in search — triggers full-pool search */
  onSearchEnter?: () => void;
};

type FilterOption<T extends string> = { value: T; label: string };

type BulkActionKind =
  | "enroll"
  | "mark-status"
  | "soft-delete"
  | "hard-delete"
  | "complete-tasks"
  | "complete-payments";

const ENROLLMENT_PRELOAD_BATCH_SIZE = 8;
const ENROLLMENT_DOC_ESTIMATE_PER_CUSTOMER = 4;
const ENROLLMENT_ESTIMATED_COST_PER_DOC = 0.001;
const ENROLLMENT_REFRESH_CONFIRM_THRESHOLD = 25;

function toTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isNonDeletedActiveEnrollment(enrollment: Enrollment): boolean {
  const status = String(enrollment?.status || "").trim().toLowerCase();
  if (enrollment?.deleted === true || status === "deleted") return false;
  if (enrollment?.active === true || status === "active") return true;
  return false;
}

function isOpenTask(row: Record<string, unknown>): boolean {
  return String(row?.status || "open").trim().toLowerCase() === "open";
}

function isCompletablePayment(payment: TPayment | null | undefined): payment is TPayment & { id: string } {
  const id = String(payment?.id || "").trim();
  return !!id && payment?.paid !== true && payment?.void !== true && Number(payment?.amount || 0) > 0;
}

function isActiveCustomerRow(customer: TCustomerEntity | null | undefined): boolean {
  if (typeof customer?.active === "boolean") return customer.active;
  return String(customer?.status || "active").trim().toLowerCase() === "active";
}

function chunkArray<T>(rows: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

export function CustomerCardView({
  myUid,
  isAdminUser,
  rows,
  totalRows,
  isLoading,
  isError,
  activeMode,
  deletedMode,
  scopeMode,
  cmFilter,
  search,
  populationFilter,
  sortMode,
  grantFilter,
  caseManagerOptions,
  onActiveModeChange,
  onDeletedModeChange,
  onScopeModeChange,
  onCmFilterChange,
  onSearchChange,
  onPopulationFilterChange,
  onSortModeChange,
  onGrantFilterChange,
  onResetFilters,
  onSearchEnter,
}: CustomerCardViewProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const patchCustomers = usePatchCustomers();
  const softDeleteCustomers = useSoftDeleteCustomers();
  const hardDeleteCustomers = useHardDeleteCustomers();
  const bulkEnroll = useEnrollmentsBulkEnroll();
  const displayRows = rows as CustomerRow[];
  const orderedIds = React.useMemo(
    () => displayRows.map((customer) => String(customer.id || "")).filter(Boolean),
    [displayRows],
  );
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = React.useState<string | null>(null);
  const [bulkGrantId, setBulkGrantId] = React.useState<string | null>(null);
  const [busyAction, setBusyAction] = React.useState<BulkActionKind | null>(null);
  const [isRefreshingEnrollments, setIsRefreshingEnrollments] = React.useState(false);
  const [showEnrollmentRefreshDialog, setShowEnrollmentRefreshDialog] = React.useState(false);
  const [pendingEnrollmentRefreshIds, setPendingEnrollmentRefreshIds] = React.useState<string[]>([]);
  const [gridCols, setGridCols] = React.useState<1 | 2 | 3>(2);
  const todayIso = React.useMemo(() => toTodayIso(), []);
  const customerIdsInScope = React.useMemo(
    () => Array.from(new Set(displayRows.map((customer) => String(customer.id || "").trim()).filter(Boolean))),
    [displayRows],
  );
  const estimatedEnrollmentDocs = pendingEnrollmentRefreshIds.length * ENROLLMENT_DOC_ESTIMATE_PER_CUSTOMER;
  const estimatedEnrollmentCost = estimatedEnrollmentDocs * ENROLLMENT_ESTIMATED_COST_PER_DOC;

  const scopeOptions: Array<FilterOption<ScopeMode>> = React.useMemo(
    () => [
      { value: "all", label: "All" },
      { value: "primary", label: "Primary" },
      { value: "secondary", label: "Secondary" },
    ],
    [],
  );

  const statusOptions: Array<FilterOption<ActiveMode>> = React.useMemo(
    () => [
      { value: "all", label: "All" },
      { value: "active", label: "Active" },
      { value: "inactive", label: "Inactive" },
    ],
    [],
  );

  const deletedOptions: Array<FilterOption<DeletedMode>> = React.useMemo(
    () => [
      { value: "exclude", label: "Exclude" },
      { value: "include", label: "Include" },
      { value: "only", label: "Only" },
    ],
    [],
  );

  const populationOptions: Array<FilterOption<PopulationFilter>> = React.useMemo(
    () => [
      { value: "all", label: "All" },
      { value: "Youth", label: "Youth" },
      { value: "Individual", label: "Individual" },
      { value: "Family", label: "Family" },
      { value: "unknown", label: "Unknown" },
    ],
    [],
  );

  const sortOptions: Array<FilterOption<CustomerSortMode>> = React.useMemo(
    () => [
      { value: "alphabetical", label: "A-Z" },
      { value: "first-added", label: "First Added" },
      { value: "last-added", label: "Last Added" },
      { value: "first-updated", label: "First Updated" },
      { value: "last-updated", label: "Last Updated" },
      { value: "highest-acuity", label: "Highest Acuity" },
      { value: "lowest-acuity", label: "Lowest Acuity" },
    ],
    [],
  );

  React.useEffect(() => {
    const visible = new Set(orderedIds);
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (visible.has(id)) next.add(id);
      }
      return next.size === prev.size ? prev : next;
    });
    setLastSelectedId((prev) => (prev && visible.has(prev) ? prev : null));
  }, [orderedIds]);

  const selectedRows = React.useMemo(
    () => displayRows.filter((customer) => selectedIds.has(String(customer.id || ""))),
    [displayRows, selectedIds],
  );
  const bulkStatusTargetActive = React.useMemo(
    () => selectedRows.length > 0 && selectedRows.every((customer) => !isActiveCustomerRow(customer)),
    [selectedRows],
  );
  const bulkStatusActionLabel = bulkStatusTargetActive ? "Mark Active" : "Mark Inactive";

  const applySelectionGesture = React.useCallback(
    (
      customerId: string,
      modifiers?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean },
      source: "card" | "checkbox" = "card",
    ) => {
      const isRange = !!modifiers?.shiftKey;
      const isToggle = source === "checkbox" || !!modifiers?.ctrlKey || !!modifiers?.metaKey;

      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (isRange) {
          const anchorId = lastSelectedId && orderedIds.includes(lastSelectedId) ? lastSelectedId : customerId;
          const anchorIndex = orderedIds.indexOf(anchorId);
          const targetIndex = orderedIds.indexOf(customerId);
          if (anchorIndex >= 0 && targetIndex >= 0) {
            const [start, end] = anchorIndex < targetIndex
              ? [anchorIndex, targetIndex]
              : [targetIndex, anchorIndex];
            for (const id of orderedIds.slice(start, end + 1)) next.add(id);
            return next;
          }
        }

        if (isToggle) {
          if (next.has(customerId)) next.delete(customerId);
          else next.add(customerId);
          return next;
        }

        return new Set([customerId]);
      });

      setLastSelectedId(customerId);
    },
    [lastSelectedId, orderedIds],
  );

  const handleCardOpen = React.useCallback(
    (id: string, options?: { tab?: string }) =>
      router.push(options?.tab ? `/customers/${id}?tab=${options.tab}` : `/customers/${id}`),
    [router],
  );

  const handleCardSelectGesture = React.useCallback(
    (
      customerId: string,
      gesture: { source: "card" | "checkbox"; shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean },
    ) => {
      applySelectionGesture(
        customerId,
        { shiftKey: !!gesture.shiftKey, ctrlKey: !!gesture.ctrlKey, metaKey: !!gesture.metaKey },
        gesture.source,
      );
    },
    [applySelectionGesture],
  );

  const clearSelection = React.useCallback(() => {
    setSelectedIds(new Set());
    setLastSelectedId(null);
  }, []);

  const invalidateBulkCaches = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.customers.root }),
      queryClient.invalidateQueries({ queryKey: qk.enrollments.root }),
      queryClient.invalidateQueries({ queryKey: qk.tasks.root }),
      queryClient.invalidateQueries({ queryKey: qk.payments.root }),
      queryClient.invalidateQueries({ queryKey: qk.paymentQueue.root }),
      queryClient.invalidateQueries({ queryKey: qk.ledger.root }),
      queryClient.invalidateQueries({ queryKey: qk.inbox.root }),
      queryClient.invalidateQueries({ queryKey: qk.grants.root }),
      queryClient.invalidateQueries({ queryKey: qk.metrics.system() }),
      queryClient.invalidateQueries({ queryKey: qk.users.me() }),
    ]);
  }, [queryClient]);

  const loadActiveEnrollmentsForCustomers = React.useCallback(async (customerIds: string[]) => {
    const pages = await Promise.all(
      customerIds.map((customerId) =>
        EnrollmentsAPI.list({ customerId, active: "true", limit: CUSTOMER_ENROLLMENTS_LIMIT }),
      ),
    );

    const seen = new Set<string>();
    const enrollments: Enrollment[] = [];
    for (const page of pages) {
      for (const row of page || []) {
        const id = String(row?.id || "").trim();
        if (!id || seen.has(id) || !isNonDeletedActiveEnrollment(row)) continue;
        seen.add(id);
        enrollments.push(row);
      }
    }
    return enrollments;
  }, []);

  const runBulkAction = React.useCallback(
    async (action: BulkActionKind, work: () => Promise<void>) => {
      setBusyAction(action);
      try {
        await work();
      } finally {
        setBusyAction((current) => (current === action ? null : current));
      }
    },
    [],
  );

  const handleBulkEnroll = React.useCallback(async () => {
    const customerIds = selectedRows.map((customer) => String(customer.id || "")).filter(Boolean);
    if (!customerIds.length) {
      toast("Select at least one customer.", { type: "error" });
      return;
    }
    if (!bulkGrantId) {
      toast("Select a grant or program first.", { type: "error" });
      return;
    }

    await runBulkAction("enroll", async () => {
      const resp = await bulkEnroll.mutateAsync({
        grantId: bulkGrantId,
        customerIds,
        extra: { startDate: todayIso },
      });

      const results = Array.isArray((resp as { results?: unknown[] })?.results)
        ? ((resp as { results?: Array<Record<string, unknown>> }).results || [])
        : [];

      const created = results.filter((row) => row?.enrollmentId && row?.existed !== true).length;
      const existed = results.filter((row) => row?.existed === true).length;
      const failed = results.filter((row) => !!row?.error).length;

      toast(
        `Enrollments: ${created} created${existed ? `, ${existed} already existed` : ""}${failed ? `, ${failed} failed` : ""}.`,
        { type: failed ? "warn" : "success" },
      );
      clearSelection();
    });
  }, [bulkEnroll, bulkGrantId, clearSelection, runBulkAction, selectedRows, todayIso]);

  const handleBulkUpdateStatus = React.useCallback(async () => {
    const customerIds = selectedRows.map((customer) => String(customer.id || "")).filter(Boolean);
    if (!customerIds.length) {
      toast("Select at least one customer.", { type: "error" });
      return;
    }

    await runBulkAction("mark-status", async () => {
      const nextActive = bulkStatusTargetActive;
      await patchCustomers.mutateAsync(
        customerIds.map((id) => ({
          id,
          patch: { active: nextActive, status: nextActive ? "active" : "inactive" },
        })),
      );
      toast(`Marked ${customerIds.length} customer${customerIds.length === 1 ? "" : "s"} ${nextActive ? "active" : "inactive"}.`, {
        type: "success",
      });
      clearSelection();
    });
  }, [bulkStatusTargetActive, clearSelection, patchCustomers, runBulkAction, selectedRows]);

  const handleBulkSoftDelete = React.useCallback(async () => {
    const customerIds = selectedRows.map((customer) => String(customer.id || "")).filter(Boolean);
    if (!customerIds.length) {
      toast("Select at least one customer.", { type: "error" });
      return;
    }
    if (!window.confirm(`Soft delete ${customerIds.length} selected customer${customerIds.length === 1 ? "" : "s"}?`)) {
      return;
    }

    await runBulkAction("soft-delete", async () => {
      await softDeleteCustomers.mutateAsync(customerIds);
      toast(`Soft deleted ${customerIds.length} customer${customerIds.length === 1 ? "" : "s"}.`, {
        type: "success",
      });
      clearSelection();
    });
  }, [clearSelection, runBulkAction, selectedRows, softDeleteCustomers]);

  const handleBulkHardDelete = React.useCallback(async () => {
    const customerIds = selectedRows.map((customer) => String(customer.id || "")).filter(Boolean);
    if (!customerIds.length || !isAdminUser) {
      toast("Select at least one customer.", { type: "error" });
      return;
    }
    if (!window.confirm(`Hard delete ${customerIds.length} selected customer${customerIds.length === 1 ? "" : "s"} permanently?`)) {
      return;
    }

    await runBulkAction("hard-delete", async () => {
      await hardDeleteCustomers.mutateAsync(customerIds);
      toast(`Hard deleted ${customerIds.length} customer${customerIds.length === 1 ? "" : "s"}.`, {
        type: "success",
      });
      clearSelection();
    });
  }, [clearSelection, hardDeleteCustomers, isAdminUser, runBulkAction, selectedRows]);

  const handleBulkCompleteTasks = React.useCallback(async () => {
    const customerIds = selectedRows.map((customer) => String(customer.id || "")).filter(Boolean);
    if (!customerIds.length) {
      toast("Select at least one customer.", { type: "error" });
      return;
    }

    await runBulkAction("complete-tasks", async () => {
      const enrollments = await loadActiveEnrollmentsForCustomers(customerIds);
      if (!enrollments.length) {
        toast("No active enrollments found for the selected customers.", { type: "warn" });
        return;
      }

      const taskRows: Array<Record<string, unknown>> = [];
      for (const group of chunkArray(
        enrollments.map((enrollment) => String(enrollment.id || "")).filter(Boolean),
        100,
      )) {
        const resp = await TasksAPI.list({
          enrollmentIds: group,
          status: "open",
          limit: 1000,
        } as ReqOf<"tasksList">);
        if (resp && typeof resp === "object" && Array.isArray((resp as { items?: unknown[] }).items)) {
          taskRows.push(...(((resp as { items?: Array<Record<string, unknown>> }).items) || []));
        }
      }

      const grouped = new Map<string, Array<{ taskId: string; action: "complete" }>>();
      for (const row of taskRows) {
        if (!isOpenTask(row)) continue;
        const enrollmentId = String(row?.enrollmentId || "").trim();
        const taskId = String(row?.taskId || "").trim();
        if (!enrollmentId || !taskId) continue;
        const changes = grouped.get(enrollmentId) || [];
        changes.push({ taskId, action: "complete" });
        grouped.set(enrollmentId, changes);
      }

      let updatedTasks = 0;
      for (const [enrollmentId, changes] of grouped.entries()) {
        for (const batch of chunkArray(changes, 500)) {
          await TasksAPI.bulkStatus({ enrollmentId, changes: batch });
          updatedTasks += batch.length;
        }
      }

      if (!updatedTasks) {
        toast("No open tasks found for the selected customers.", { type: "warn" });
        return;
      }

      await invalidateBulkCaches();
      toast(`Completed ${updatedTasks} task${updatedTasks === 1 ? "" : "s"}.`, { type: "success" });
      clearSelection();
    });
  }, [clearSelection, invalidateBulkCaches, loadActiveEnrollmentsForCustomers, runBulkAction, selectedRows]);

  const handleBulkCompletePayments = React.useCallback(async () => {
    const customerIds = selectedRows.map((customer) => String(customer.id || "")).filter(Boolean);
    if (!customerIds.length) {
      toast("Select at least one customer.", { type: "error" });
      return;
    }

    await runBulkAction("complete-payments", async () => {
      const enrollments = await loadActiveEnrollmentsForCustomers(customerIds);
      if (!enrollments.length) {
        toast("No active enrollments found for the selected customers.", { type: "warn" });
        return;
      }

      let completed = 0;
      let failed = 0;
      for (const enrollment of enrollments) {
        const enrollmentId = String(enrollment?.id || "").trim();
        const payments = Array.isArray(enrollment?.payments) ? enrollment.payments : [];
        for (const payment of payments) {
          if (!isCompletablePayment(payment)) continue;
          try {
            await PaymentsAPI.spend({ enrollmentId, paymentId: String(payment.id) } as ReqOf<"paymentsSpend">);
            completed += 1;
          } catch {
            failed += 1;
          }
        }
      }

      if (!completed && !failed) {
        toast("No unpaid payments found for the selected customers.", { type: "warn" });
        return;
      }

      await invalidateBulkCaches();
      toast(
        `Payments marked complete: ${completed}${failed ? `, ${failed} failed` : ""}.`,
        { type: failed ? "warn" : "success" },
      );
      if (completed > 0) clearSelection();
    });
  }, [clearSelection, invalidateBulkCaches, loadActiveEnrollmentsForCustomers, runBulkAction, selectedRows]);

  const runEnrollmentRefresh = React.useCallback(async (customerIds: string[]) => {
    if (!customerIds.length) {
      toast("No customers in the current filter scope.", { type: "warn" });
      return;
    }

    setIsRefreshingEnrollments(true);
    try {
      const result = await preloadCustomerEnrollments(queryClient, customerIds, {
        batchSize: ENROLLMENT_PRELOAD_BATCH_SIZE,
      });

      if (!result.fetchedCount) {
        toast(
          `Enrollments are already current for ${result.requestedCount} customer${result.requestedCount === 1 ? "" : "s"}.`,
          { type: "success" },
        );
        return;
      }

      if (!result.loadedCount && result.failedCount) {
        toast("Failed to refresh enrollment cache.", { type: "error" });
        return;
      }

      toast(
        `Enrollment cache refreshed for ${result.loadedCount} customer${result.loadedCount === 1 ? "" : "s"}${result.skippedCount ? `, ${result.skippedCount} already fresh` : ""}${result.failedCount ? `, ${result.failedCount} failed` : ""}.`,
        { type: result.failedCount ? "warn" : "success" },
      );
    } finally {
      setIsRefreshingEnrollments(false);
      setPendingEnrollmentRefreshIds([]);
    }
  }, [queryClient]);

  const handleEnrollmentRefresh = React.useCallback(() => {
    if (!customerIdsInScope.length) {
      toast("No customers in the current filter scope.", { type: "warn" });
      return;
    }
    const staleCustomerIds = getStaleCustomerEnrollmentIds(queryClient, customerIdsInScope);
    if (!staleCustomerIds.length) {
      toast(
        `Enrollments are already current for ${customerIdsInScope.length} customer${customerIdsInScope.length === 1 ? "" : "s"}.`,
        { type: "success" },
      );
      return;
    }
    if (staleCustomerIds.length > ENROLLMENT_REFRESH_CONFIRM_THRESHOLD) {
      setPendingEnrollmentRefreshIds(staleCustomerIds);
      setShowEnrollmentRefreshDialog(true);
      return;
    }
    void runEnrollmentRefresh(staleCustomerIds);
  }, [customerIdsInScope, queryClient, runEnrollmentRefresh]);

  const confirmEnrollmentRefresh = React.useCallback(() => {
    setShowEnrollmentRefreshDialog(false);
    void runEnrollmentRefresh(pendingEnrollmentRefreshIds);
  }, [pendingEnrollmentRefreshIds, runEnrollmentRefresh]);

  const bulkStatusText = React.useMemo(() => {
    if (!busyAction) return `${selectedRows.length} visible customer${selectedRows.length === 1 ? "" : "s"} in scope.`;
    if (busyAction === "enroll") return "Creating enrollments with today's start date.";
    if (busyAction === "mark-status") {
      return bulkStatusTargetActive
        ? "Marking selected customers active."
        : "Marking selected customers inactive.";
    }
    if (busyAction === "soft-delete") return "Soft deleting selected customers.";
    if (busyAction === "hard-delete") return "Hard deleting selected customers permanently.";
    if (busyAction === "complete-tasks") return "Completing open tasks across selected customers.";
    if (busyAction === "complete-payments") return "Marking unpaid payments complete across selected customers.";
    return null;
  }, [bulkStatusTargetActive, busyAction, selectedRows.length]);

  return (
    <div className="space-y-4">
      <PageFilterBar
        search={search}
        onSearchChange={onSearchChange}
        onSearchEnter={onSearchEnter}
        searchPlaceholder="Search by name, CW ID, HMIS ID — Enter to search all"
        resultLabel={isLoading ? "Loading..." : `${displayRows.length} / ${totalRows} Customers`}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-sm rounded-lg border border-sky-300 bg-sky-50 text-sky-900 hover:border-sky-400 hover:bg-sky-100"
              onClick={handleEnrollmentRefresh}
              disabled={isRefreshingEnrollments || isLoading || displayRows.length === 0}
              title="This system pre loads enrollments only for the clients of the user, click to load all enrollments."
            >
              {isRefreshingEnrollments ? "Refreshing Enrollments..." : "Refresh Enrollments"}
            </button>
            <button type="button" className="btn btn-ghost btn-sm rounded-lg" onClick={onResetFilters}>
              Clear
            </button>
          </div>
        }
      >
        <div className="flex flex-wrap gap-4">
          <FilterToggleGroup
            label="Status"
            value={activeMode}
            options={statusOptions}
            onChange={onActiveModeChange}
          />
          {isAdminUser ? (
            <FilterToggleGroup
              label="Deleted"
              value={deletedMode}
              options={deletedOptions}
              onChange={onDeletedModeChange}
            />
          ) : null}
          <FilterToggleGroup
            label="Population"
            value={populationFilter}
            options={populationOptions}
            onChange={onPopulationFilterChange}
          />
          <FilterToggleGroup
            label="Scope"
            value={scopeMode}
            options={scopeOptions.filter((option) => !!myUid || option.value !== "my")}
            onChange={onScopeModeChange}
          />
          <div className="min-w-[200px] space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Case Manager
            </div>
            <CaseManagerSelect
              value={cmFilter === "all" ? null : cmFilter}
              onChange={(uid) => onCmFilterChange(uid || "all")}
              options={caseManagerOptions}
              includeAll
              allLabel="All"
            />
          </div>
          <EnrollmentGrantFilter value={grantFilter} onChange={onGrantFilterChange} />
          <FilterToggleGroup
            label="Sort"
            value={sortMode}
            options={sortOptions}
            onChange={onSortModeChange}
          />
        </div>
      </PageFilterBar>

      {selectedRows.length > 0 ? (
        <PageBulkActionsBar
          selectedCount={selectedRows.length}
          noun="customer"
          statusText={bulkStatusText}
          onClear={busyAction ? undefined : clearSelection}
        >
          <div className="min-w-[240px]">
            <GrantSelect
              value={bulkGrantId}
              onChange={setBulkGrantId}
              placeholderLabel="Select grant for bulk enroll"
              includeUnassigned
              disabled={!!busyAction}
            />
          </div>
          <button
            type="button"
            className="btn btn-sm rounded-lg"
            onClick={() => void handleBulkEnroll()}
            disabled={!!busyAction || !bulkGrantId}
          >
            Enroll
          </button>
          <button
            type="button"
            className="btn btn-sm rounded-lg"
            onClick={() => void handleBulkUpdateStatus()}
            disabled={!!busyAction}
          >
            {bulkStatusActionLabel}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-error rounded-lg"
            onClick={() => void handleBulkSoftDelete()}
            disabled={!!busyAction}
          >
            Soft Delete
          </button>
          {isAdminUser ? (
            <button
              type="button"
              className="btn btn-sm btn-error rounded-lg"
              onClick={() => void handleBulkHardDelete()}
              disabled={!!busyAction}
            >
              Hard Delete
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-sm rounded-lg"
            onClick={() => void handleBulkCompleteTasks()}
            disabled={!!busyAction}
          >
            Mark Tasks Complete
          </button>
          <button
            type="button"
            className="btn btn-sm rounded-lg"
            onClick={() => void handleBulkCompletePayments()}
            disabled={!!busyAction}
          >
            Mark Payments Complete
          </button>
        </PageBulkActionsBar>
      ) : null}

      <div className="flex items-center justify-end gap-1">
        {([1, 2, 3] as const).map((n) => (
          <button
            key={n}
            type="button"
            title={`${n} column${n > 1 ? "s" : ""}`}
            onClick={() => setGridCols(n)}
            className={[
              "flex h-7 w-7 items-center justify-center rounded-md border text-xs font-semibold transition",
              gridCols === n
                ? "border-slate-700 bg-slate-900 text-white dark:border-slate-400 dark:bg-slate-100 dark:text-slate-900"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
            ].join(" ")}
          >
            {n}
          </button>
        ))}
      </div>

      <CardGrid
        isLoading={isLoading}
        isError={isError}
        isEmpty={displayRows.length === 0}
        loadingMessage="Loading customers..."
        errorMessage="Error loading customers."
        cols={gridCols}
        emptyState={
          <div className="py-12 text-center text-sm text-slate-400">
            {search.trim() ? "No customers match your search." : "No customers found."}
          </div>
        }
      >
        {displayRows.map((customer) => (
          <CustomerCard
            key={customer.id}
            customer={customer}
            viewerUid={myUid}
            selected={selectedIds.has(String(customer.id || ""))}
            selectionMode={selectedRows.length > 0}
            onSelectGesture={handleCardSelectGesture}
            onOpen={handleCardOpen}
          />
        ))}
      </CardGrid>

      <Modal
        isOpen={showEnrollmentRefreshDialog}
        title="Refresh Enrollment Cache"
        onClose={() => {
          setShowEnrollmentRefreshDialog(false);
          setPendingEnrollmentRefreshIds([]);
        }}
        widthClass="max-w-lg"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm rounded-lg"
              onClick={() => {
                setShowEnrollmentRefreshDialog(false);
                setPendingEnrollmentRefreshIds([]);
              }}
              disabled={isRefreshingEnrollments}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-sm rounded-lg"
              onClick={confirmEnrollmentRefresh}
              disabled={isRefreshingEnrollments}
            >
              OK
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
          <p>
            This request pulls an estimated {estimatedEnrollmentDocs} documents for {pendingEnrollmentRefreshIds.length} customer
            {pendingEnrollmentRefreshIds.length === 1 ? "" : "s"}.
          </p>
          <p>
            This costs us about ${estimatedEnrollmentCost.toFixed(3)}. It is fine to do this.
          </p>
        </div>
      </Modal>
    </div>
  );
}

export default CustomerCardView;
