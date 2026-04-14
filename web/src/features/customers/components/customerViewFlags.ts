export type CustomerViewFeatureFlags = {
  showEnrollmentRefreshAction: boolean;
  showBulkActions: boolean;
  showGridColumnToggle: boolean;
  searchPlaceholder: string;
  loadingMessage: string;
  errorMessage: string;
  emptyStateDefaultMessage: string;
  emptyStateSearchMessage: string;
};

export const DEFAULT_CUSTOMER_VIEW_FEATURE_FLAGS: CustomerViewFeatureFlags = {
  showEnrollmentRefreshAction: true,
  showBulkActions: true,
  showGridColumnToggle: true,
  searchPlaceholder: "Search by name, CW ID, HMIS ID — Enter to search all",
  loadingMessage: "Loading customers...",
  errorMessage: "Error loading customers.",
  emptyStateDefaultMessage: "No customers found.",
  emptyStateSearchMessage: "No customers match your search.",
};

export function resolveCustomerViewFeatureFlags(
  patch?: Partial<CustomerViewFeatureFlags>,
): CustomerViewFeatureFlags {
  return {
    ...DEFAULT_CUSTOMER_VIEW_FEATURE_FLAGS,
    ...patch,
  };
}
