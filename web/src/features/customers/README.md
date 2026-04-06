# Customers Feature Structure

This folder is organized by feature surface:

- `CustomersPage.tsx`
  - List/search/filter page for customers.
- `CustomersModal.tsx`
  - Main detail modal with tabs.
- `CustomerWorkspaceModal.tsx`
  - Full-page split workspace variant.

- `tabs/`
  - One file per modal tab.
  - Tabs should stay thin and compose feature panels/components.
  - Current tabs:
    - `DetailsTab.tsx`
    - `EnrollmentsTab.tsx`
    - `CaseManagementTab.tsx`
    - `TasksTab.tsx`
    - `PaymentsTab.tsx`
    - `CustomerFilesTab.tsx`
    - `AcuityTab.tsx`

- `components/`
  - Reusable customer-specific UI blocks used by tabs.
  - Current components:
    - `CustomerAcuityPanel.tsx`
    - `CustomerCaseManagementPanel.tsx`
    - `CustomerFilesPanel.tsx`
    - `CustomerPaymentsTable.tsx`
    - `paymentScheduleUtils.ts` (pure helpers used by payment schedule flows)

## Naming conventions

- Use `Customer*` prefix for customer-specific UI components.
- Keep generic dialogs in `web/src/entities/dialogs`.
- Keep status labels by domain:
  - Customers: `active` / `inactive`
  - Enrollments and grants (UI labels): `open` / `closed`

