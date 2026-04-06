// web/src/features/customers/components/CustomersNewStateView.tsx
"use client";

import React from "react";
import type { TCustomerEntity } from "@types";
import type { CaseManagerOption } from "@entities/selectors/CaseManagerSelect";
import { CustomerCardView } from "./CustomerCardView";

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
  onSearchEnter?: () => void;
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
        sortMode={sortMode}
        grantFilter={grantFilter}
        caseManagerOptions={caseManagerOptions}
        onActiveModeChange={onActiveModeChange}
        onDeletedModeChange={onDeletedModeChange}
        onScopeModeChange={onScopeModeChange}
        onCmFilterChange={onCmFilterChange}
        onSearchChange={onSearchChange}
        onPopulationFilterChange={onPopulationFilterChange}
        onSortModeChange={onSortModeChange}
        onGrantFilterChange={onGrantFilterChange}
        onResetFilters={onResetFilters}
        onSearchEnter={onSearchEnter}
      />
    </>
  );
}

export default CustomersNewStateView;
