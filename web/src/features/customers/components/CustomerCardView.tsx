"use client";

import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, usePathname } from "next/navigation";
import type { TCustomerEntity } from "@types";
import { type CaseManagerOption } from "@entities/selectors/CaseManagerSelect";
import { PageBulkActionsBar } from "@entities/Page";
import { CardGrid, Modal } from "@entities/ui";
import { CustomerFilterBar } from "./CustomerFilterBar";
import {
  getStaleCustomerEnrollmentIds,
  preloadCustomerEnrollments,
  type EnrollmentStatusBucket,
} from "@hooks/useEnrollments";
import { toast } from "@lib/toast";
import { CustomerCard } from "./CustomerCard";
import {
  resolveCustomerViewFeatureFlags,
  type CustomerViewFeatureFlags,
} from "./customerViewFlags";
import CustomerBulkWorkspaceModal, { type CustomerBulkTool } from "../CustomerBulkWorkspaceModal";

type CustomerRow = TCustomerEntity & { id: string };
type ActiveMode = "all" | "active" | "inactive";
type DeletedMode = "exclude" | "include" | "only";
type ScopeMode = "all" | "my" | "primary" | "secondary";
type PopulationFilter = "all" | "Youth" | "Individual" | "Family" | "unknown";
type TierFilter = "all" | "1" | "2" | "3";
type CustomerSortMode =
  | "alphabetical"
  | "first-added"
  | "last-added"
  | "first-updated"
  | "last-updated"
  | "tier-asc"
  | "tier-desc";

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
  tierFilter: TierFilter;
  sortMode: CustomerSortMode;
  grantFilter: string;
  enrollmentStatuses: EnrollmentStatusBucket[];
  caseManagerOptions: CaseManagerOption[];
  onActiveModeChange: (mode: ActiveMode) => void;
  onDeletedModeChange: (mode: DeletedMode) => void;
  onScopeModeChange: (mode: ScopeMode) => void;
  onCmFilterChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onPopulationFilterChange: (value: PopulationFilter) => void;
  onTierFilterChange: (value: TierFilter) => void;
  onSortModeChange: (value: CustomerSortMode) => void;
  onGrantFilterChange: (value: string) => void;
  onEnrollmentStatusesChange: (value: EnrollmentStatusBucket[]) => void;
  onResetFilters: () => void;
  /** Called when Enter is pressed in search — triggers full-pool search */
  onSearchEnter?: () => void;
  onCustomerOpen?: (customerId: string, options?: { tab?: "tasks" }) => void;
  featureFlags?: Partial<CustomerViewFeatureFlags>;
  hiddenCustomerIds?: ReadonlySet<string>;
  onHideCustomer?: (customerId: string) => void;
  onShowAllCustomers?: () => void;
};

const ENROLLMENT_PRELOAD_BATCH_SIZE = 8;
const ENROLLMENT_DOC_ESTIMATE_PER_CUSTOMER = 4;
const ENROLLMENT_ESTIMATED_COST_PER_DOC = 0.001;
const ENROLLMENT_REFRESH_CONFIRM_THRESHOLD = 25;
const EMPTY_HIDDEN_CUSTOMER_IDS: ReadonlySet<string> = new Set();

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
  tierFilter,
  sortMode,
  grantFilter,
  enrollmentStatuses,
  caseManagerOptions,
  onActiveModeChange,
  onDeletedModeChange,
  onScopeModeChange,
  onCmFilterChange,
  onSearchChange,
  onPopulationFilterChange,
  onTierFilterChange,
  onSortModeChange,
  onGrantFilterChange,
  onEnrollmentStatusesChange,
  onResetFilters,
  onSearchEnter,
  onCustomerOpen,
  featureFlags,
  hiddenCustomerIds = EMPTY_HIDDEN_CUSTOMER_IDS,
  onHideCustomer,
  onShowAllCustomers,
}: CustomerCardViewProps) {
  const viewFlags = React.useMemo(() => resolveCustomerViewFeatureFlags(featureFlags), [featureFlags]);
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const displayRows = React.useMemo(
    () => (rows as CustomerRow[]).filter((customer) => !hiddenCustomerIds.has(String(customer.id || ""))),
    [hiddenCustomerIds, rows],
  );
  const orderedIds = React.useMemo(
    () => displayRows.map((customer) => String(customer.id || "")).filter(Boolean),
    [displayRows],
  );
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [selectedCustomers, setSelectedCustomers] = React.useState<Record<string, CustomerRow>>({});
  const [lastSelectedId, setLastSelectedId] = React.useState<string | null>(null);
  const [bulkWorkspaceTool, setBulkWorkspaceTool] = React.useState<CustomerBulkTool | null>(null);
  const [isRefreshingEnrollments, setIsRefreshingEnrollments] = React.useState(false);
  const [showEnrollmentRefreshDialog, setShowEnrollmentRefreshDialog] = React.useState(false);
  const [pendingEnrollmentRefreshIds, setPendingEnrollmentRefreshIds] = React.useState<string[]>([]);
  const [gridCols, setGridCols] = React.useState<1 | 2 | 3>(3);
  const [pendingCardId, setPendingCardId] = React.useState<string | null>(null);

  // Clear loading state once the route actually changes (modal opened or closed)
  React.useEffect(() => {
    setPendingCardId(null);
  }, [pathname]);
  const customerIdsInScope = React.useMemo(
    () => Array.from(new Set(displayRows.map((customer) => String(customer.id || "").trim()).filter(Boolean))),
    [displayRows],
  );
  const estimatedEnrollmentDocs = pendingEnrollmentRefreshIds.length * ENROLLMENT_DOC_ESTIMATE_PER_CUSTOMER;
  const estimatedEnrollmentCost = estimatedEnrollmentDocs * ENROLLMENT_ESTIMATED_COST_PER_DOC;

  React.useEffect(() => {
    const visible = new Set(orderedIds);
    setLastSelectedId((prev) => (prev && visible.has(prev) ? prev : null));
  }, [orderedIds]);

  React.useEffect(() => {
    setSelectedCustomers((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const customer of displayRows) {
        const id = String(customer.id || "");
        if (!id || !selectedIds.has(id)) continue;
        next[id] = customer;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [displayRows, selectedIds]);

  const selectedRows = React.useMemo(
    () =>
      Array.from(selectedIds)
        .map((id) => selectedCustomers[id] || displayRows.find((customer) => String(customer.id || "") === id))
        .filter((customer): customer is CustomerRow => !!customer),
    [displayRows, selectedCustomers, selectedIds],
  );

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

      setSelectedCustomers((prev) => {
        const row = displayRows.find((customer) => String(customer.id || "") === customerId);
        if (!row) return prev;
        const next = { ...prev };
        const currentlySelected = selectedIds.has(customerId);
        if ((source === "checkbox" || modifiers?.ctrlKey || modifiers?.metaKey) && currentlySelected && !modifiers?.shiftKey) {
          delete next[customerId];
          return next;
        }
        next[customerId] = row;
        return next;
      });

      setLastSelectedId(customerId);
    },
    [displayRows, lastSelectedId, orderedIds, selectedIds],
  );

  const handleCardOpen = React.useCallback(
    (id: string, options?: { tab?: string }) => {
      if (onCustomerOpen) {
        onCustomerOpen(id, options as { tab?: "tasks" } | undefined);
        return;
      }
      setPendingCardId(id);
      router.push(options?.tab ? `/customers/${id}?tab=${options.tab}` : `/customers/${id}`);
    },
    [onCustomerOpen, router],
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
    setSelectedCustomers({});
    setLastSelectedId(null);
  }, []);

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
    if (!selectedIds.size) return null;
    return "Selection persists while you search or change filters. Open a workspace to apply bulk actions.";
  }, [selectedIds.size]);

  const bulkButtonClass =
    "inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50";

  const openBulkWorkspace = React.useCallback((tool: CustomerBulkTool) => {
    if (!selectedIds.size) {
      toast("Select at least one customer.", { type: "error" });
      return;
    }
    setBulkWorkspaceTool(tool);
  }, [selectedIds.size]);

  return (
    <div className="space-y-4">
      <CustomerFilterBar
        myUid={myUid}
        isAdminUser={isAdminUser}
        search={search}
        searchPlaceholder={viewFlags.searchPlaceholder}
        resultLabel={isLoading ? "Loading..." : `${displayRows.length} / ${totalRows} Customers`}
        activeMode={activeMode}
        deletedMode={deletedMode}
        scopeMode={scopeMode}
        cmFilter={cmFilter}
        populationFilter={populationFilter}
        tierFilter={tierFilter}
        sortMode={sortMode}
        grantFilter={grantFilter}
        enrollmentStatuses={enrollmentStatuses}
        caseManagerOptions={caseManagerOptions}
        onActiveModeChange={onActiveModeChange}
        onDeletedModeChange={onDeletedModeChange}
        onScopeModeChange={onScopeModeChange}
        onCmFilterChange={onCmFilterChange}
        onSearchChange={onSearchChange}
        onPopulationFilterChange={onPopulationFilterChange}
        onTierFilterChange={onTierFilterChange}
        onSortModeChange={onSortModeChange}
        onGrantFilterChange={onGrantFilterChange}
        onEnrollmentStatusesChange={onEnrollmentStatusesChange}
        onResetFilters={onResetFilters}
        onSearchEnter={onSearchEnter}
        refreshEnrollments={
          viewFlags.showEnrollmentRefreshAction
            ? {
                onClick: handleEnrollmentRefresh,
                isRefreshing: isRefreshingEnrollments,
                disabled: isRefreshingEnrollments || isLoading || displayRows.length === 0,
              }
            : null
        }
      />

      {viewFlags.showBulkActions && selectedRows.length > 0 ? (
        <PageBulkActionsBar
          selectedCount={selectedIds.size}
          noun="customer"
          statusText={bulkStatusText}
          onClear={clearSelection}
        >
          <button
            type="button"
            className={bulkButtonClass}
            onClick={() => openBulkWorkspace("enroll")}
          >
            Bulk Enroll
          </button>
          <button
            type="button"
            className={bulkButtonClass}
            onClick={() => openBulkWorkspace("payments")}
          >
            Bulk Payments
          </button>
          <button
            type="button"
            className={bulkButtonClass}
            onClick={() => openBulkWorkspace("case-managers")}
          >
            Assign Case Team
          </button>
          <button
            type="button"
            className={bulkButtonClass}
            onClick={() => openBulkWorkspace("archive")}
          >
            Archive
          </button>
          <button
            type="button"
            className={bulkButtonClass}
            onClick={() => openBulkWorkspace("delete")}
          >
            Delete
          </button>
          {isAdminUser ? (
            <button
              type="button"
              className={bulkButtonClass}
              onClick={() => openBulkWorkspace("hard-delete")}
            >
              Hard Delete
            </button>
          ) : null}
          <button
            type="button"
            className={bulkButtonClass}
            onClick={() => openBulkWorkspace("complete-past-tasks")}
          >
            Complete Past Tasks
          </button>
          <button
            type="button"
            className={bulkButtonClass}
            onClick={() => openBulkWorkspace("mark-projections-paid")}
          >
            Mark Projections Paid
          </button>
          <button
            type="button"
            className={bulkButtonClass}
            onClick={() => openBulkWorkspace("refresh-enrollments")}
          >
            Refresh Enrollments
          </button>
          <button
            type="button"
            className={bulkButtonClass}
            onClick={() => openBulkWorkspace("reverse-payments")}
          >
            Reverse Payments
          </button>
        </PageBulkActionsBar>
      ) : null}

      {viewFlags.showGridColumnToggle ? (
        <div className="flex items-center justify-end gap-1">
          {hiddenCustomerIds.size > 0 && onShowAllCustomers ? (
            <button
              type="button"
              className="mr-2 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              onClick={onShowAllCustomers}
            >
              Show All ({hiddenCustomerIds.size})
            </button>
          ) : null}
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
      ) : null}

      <CardGrid
        isLoading={isLoading}
        isError={isError}
        isEmpty={displayRows.length === 0}
        loadingMessage={viewFlags.loadingMessage}
        errorMessage={viewFlags.errorMessage}
        cols={gridCols}
        emptyState={
          <div className="py-12 text-center text-sm text-slate-400">
            {search.trim() ? viewFlags.emptyStateSearchMessage : viewFlags.emptyStateDefaultMessage}
          </div>
        }
      >
        {displayRows.map((customer) => (
          <CustomerCard
            key={customer.id}
            customer={customer}
            viewerUid={myUid}
            selectedCmUid={cmFilter !== "all" ? cmFilter : undefined}
            selected={selectedIds.has(String(customer.id || ""))}
            selectionMode={selectedIds.size > 0}
            onSelectGesture={handleCardSelectGesture}
            onOpen={handleCardOpen}
            onHide={onHideCustomer}
            loading={pendingCardId === String(customer.id || "")}
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

      <CustomerBulkWorkspaceModal
        isOpen={!!bulkWorkspaceTool}
        tool={bulkWorkspaceTool}
        customers={selectedRows}
        isAdminUser={isAdminUser}
        caseManagerOptions={caseManagerOptions}
        onClose={() => setBulkWorkspaceTool(null)}
        onClearSelection={clearSelection}
      />
    </div>
  );
}

export default CustomerCardView;
