# Payments Function Catalog

This is the backend/source-of-truth catalog for payment endpoints in this repo.

## Contract Source
- Request/response schemas: `contracts/src/payments.ts`
- Endpoint req/resp aliases: `contracts/src/endpointMap.ts`
- Runtime schema re-export used by functions: `functions/src/features/payments/schemas.ts`

## Endpoints

### `paymentsGenerateProjections`
- Handler: `functions/src/features/payments/generateProjections.ts`
- Contract req: `TPaymentsGenerateProjectionsBody`
- Contract resp: `Ok<{ items: TPayment[] }>`
- Request shape:
  - `startDate: ISO10`
  - `months: number` (int, > 0)
  - `monthlyAmount: number` (> 0)
  - `deposit?: number` (>= 0)
- Response shape:
  - `ok: true`
  - `items: TPayment[]` (generated schedule rows; not persisted)
- Use when:
  - You need a schedule preview/template from start date + monthly amount.
- Do not use when:
  - You need to persist enrollment payments (use `paymentsUpsertProjections`).

### `paymentsUpsertProjections`
- Handler: `functions/src/features/payments/upsertProjections.ts`
- Contract req: `TPaymentsUpsertProjectionsBody`
- Contract resp: `Ok<{ id: string; payments: TPayment[] }>`
- Request shape:
  - `enrollmentId: string`
  - `payments: TPaymentProjectionInput[]` (accepts `dueDate` or legacy `date`)
- Response shape:
  - `ok: true`
  - `id: enrollmentId`
  - `payments: TPayment[]` (persisted canonical schedule)
- Behavior:
  - Deterministic projection upsert.
  - Updates grant budget projected totals in transaction.
- Use when:
  - Saving/replacing an enrollment payment schedule.

### `paymentsRecalculateFuture`
- Handler: `functions/src/features/payments/recalcFuture.ts`
- Contract req: `TPaymentsRecalculateFutureReq` (union)
- Contract resp: `Ok<TPaymentsRecalculateFutureResp>`
- Request shape (single):
  - `enrollmentId`, `newMonthlyAmount`, optional `projectionIds`, `lineItemId`, `effectiveFrom`, `dryRun`
- Request shape (grant bulk):
  - `grantId`, `newMonthlyAmount`, optional `lineItemId`, `effectiveFrom`, `dryRun`
- Response shape:
  - `mode: "single" | "grant"` with per-mode details.
- Use when:
  - Repricing future unpaid monthly rows due to rent change.

### `paymentsRecalcGrantProjected`
- Handler: `functions/src/features/payments/recalcGrantProjected.ts`
- Contract req: `TPaymentsRecalcGrantProjectedBody`
- Contract resp: `Ok<TPaymentsRecalcGrantProjectedResp>`
- Defaults:
  - `activeOnly: true`
  - `source: 1` (ledger-authoritative spent)
- Request shape:
  - `grantId: string`
  - `effectiveFrom?: ISO10` (metadata only)
  - `activeOnly?: boolean`
  - `source?: 1 | 2`
  - `dryRun?: boolean`
- Response shape:
  - `totals`, `warnings`, `dryRun`, `effectiveFromISO`, `activeOnly`, `source`
- Use when:
  - You need authoritative projected/spent recompute for a grant.

### `paymentsUpdateGrantBudget`
- Handler: `functions/src/features/payments/updateGrantBudget.ts`
- Contract req: `TPaymentsUpdateGrantBudgetBody` (alias of recalc grant projected body)
- Contract resp: `Ok<Record<string, unknown>>`
- Behavior:
  - Thin alias to `recalcProjectedForGrant`.
- Use when:
  - Legacy callers still target this route name.
  - Prefer `paymentsRecalcGrantProjected` for explicitness in new code.

### `paymentsSpend`
- Handler: `functions/src/features/payments/spend.ts`
- Contract req: `TPaymentsSpendBody`
- Contract resp: `Ok<{}>`
- Defaults:
  - `reverse: false`
- Request shape:
  - `enrollmentId`, `paymentId`
  - optional `note`, `reverse`, `vendor`, `comment`
- Behavior:
  - Marks payment paid/unpaid.
  - Writes enrollment spend mirror + authoritative ledger entry.
  - Rebalances grant budget spent/projected.
- Use when:
  - Booking or reversing an actual payment spend.

### `paymentsUpdateCompliance`
- Handler: `functions/src/features/payments/updateCompliance.ts`
- Contract req: `TPaymentsUpdateComplianceBody`
- Contract resp: `Ok<{ id: string } & Partial<TEnrollmentEntity>>`
- Request shape:
  - `enrollmentId`, `paymentId`, `patch` (`PaymentCompliancePatch`)
- Behavior:
  - Partial patch of `payment.compliance` on one payment row.
- Use when:
  - HMIS/caseworthy/status compliance fields change.

### `paymentsBulkCopySchedule`
- Handler: `functions/src/features/payments/bulkCopySchedule.ts`
- Contract req: `TPaymentsBulkCopyScheduleBody`
- Contract resp: `Ok<{ results: { enrollmentId; ok; count?; error? }[] }>`
- Defaults:
  - `mode: "replace"`
  - `anchorByStartDate: true`
- Request shape:
  - `sourceEnrollmentId`, `targetEnrollmentIds[]`
  - optional `mode`, `includeTypes`, `anchorByStartDate`
- Use when:
  - Copying one enrollment schedule template to many enrollments.

### `paymentsAdjustProjections`
- Handler: `functions/src/features/payments/adjust.ts`
- Contract req: `TPaymentsAdjustProjectionsBody`
- Contract resp: `Ok<{ enrollmentId?: string; payments?: TPayment[] } & Record<string, unknown>> | Err`
- Defaults:
  - `replaceUnpaid: true`
- Request shape:
  - `enrollmentId`, `payments[]`, optional `replaceUnpaid`
- Behavior:
  - Merge/replace style projection adjustment path.
- Use when:
  - You specifically need adjust semantics (legacy compatibility).
- Preferred alternative:
  - `paymentsGenerateProjections` + `paymentsUpsertProjections` for new schedule builder flows.

### `paymentsAdjustSpend`
- Handler: `functions/src/features/payments/adjust.ts`
- Contract req: `TPaymentsAdjustSpendBody`
- Contract resp: `Ok<Record<string, unknown>> | Err`
- Request shape:
  - `enrollmentId`, `spendId`, `patch`, optional `reason`
- Behavior:
  - Reverses original ledger row and writes corrected ledger row.
  - Updates enrollment spend mirror in place.
- Use when:
  - Correcting historical spend records (amount/LI/date/snapshot fields).

## Usage Guidance (UI)
- Schedule builder/create flows:
  - Prefer `paymentsGenerateProjections` for draft rows.
  - Persist with `paymentsUpsertProjections`.
- Reprice flows:
  - Use `paymentsRecalculateFuture`.
- Grant-wide budget correction:
  - Use `paymentsRecalcGrantProjected` (default `activeOnly=true`, `source=1`).
- Paid/unpaid toggles:
  - Use `paymentsSpend` with explicit `reverse` intent.
- Compliance updates:
  - Use `paymentsUpdateCompliance` patch route.
- Bulk enrollment schedule copy:
  - Use `paymentsBulkCopySchedule` with explicit `mode` and `anchorByStartDate`.
- Avoid using `paymentsAdjustProjections` as a catch-all for standard schedule generation/upsert paths.

## Internal/Non-HTTP Functions

### `recalcProjectedForGrant`
- File: `functions/src/features/payments/recalcGrantProjected.ts`
- Purpose:
  - Core recompute engine used by HTTP recalc/update routes and internal callers.

### `recalcGrantProjectedForGrant`
- File: `functions/src/features/payments/recalcGrantProjected.ts`
- Purpose:
  - Convenience wrapper used by bulk `paymentsRecalculateFuture` to run authoritative grant recalc after enrollment updates.

### `reconcileGrantBudgets` (scheduler/job)
- File: `functions/src/features/payments/reconcileGrantBudgets.ts`
- Purpose:
  - Periodic reconciliation for grants marked with drift flags (`budget.needsRecalc` path).

### Triggers
- File: `functions/src/features/payments/triggers.ts`
- Functions:
  - `onEnrollmentPaymentsChange`
  - `onLedgerWrite`
- Purpose:
  - Reactive budget/payment integrity updates based on enrollment payment/ledger writes.
