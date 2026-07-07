// web/src/features/customers/components/CustomersNewStateView.tsx
"use client";

import React from "react";
import type { TCustomerEntity } from "@types";
import type { EnrollmentStatusBucket } from "@hooks/useEnrollments";
import type { CaseManagerOption } from "@entities/selectors/CaseManagerSelect";
import { CustomerCardView } from "./CustomerCardView";
import type { CustomerViewFeatureFlags } from "./customerViewFlags";

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

type CustomersNewStateViewProps = {
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
  onSearchEnter?: () => void;
  onCustomerOpen?: (customerId: string, options?: { tab?: "tasks" }) => void;
  featureFlags?: Partial<CustomerViewFeatureFlags>;
  hiddenCustomerIds?: ReadonlySet<string>;
  onHideCustomer?: (customerId: string) => void;
  onShowAllCustomers?: () => void;
};

export function CustomersNewStateView({
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
  hiddenCustomerIds,
  onHideCustomer,
  onShowAllCustomers,
}: CustomersNewStateViewProps) {
  return (
    <>
      <CustomerCardView
        myUid={myUid}
        isAdminUser={isAdminUser}
        rows={rows}
        totalRows={totalRows}
        isLoading={isLoading}
        isError={isError}
        activeMode={activeMode}
        deletedMode={deletedMode}
        scopeMode={scopeMode}
        cmFilter={cmFilter}
        search={search}
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
        onCustomerOpen={onCustomerOpen}
        featureFlags={featureFlags}
        hiddenCustomerIds={hiddenCustomerIds}
        onHideCustomer={onHideCustomer}
        onShowAllCustomers={onShowAllCustomers}
      />
    </>
  );
}

export default CustomersNewStateView;
