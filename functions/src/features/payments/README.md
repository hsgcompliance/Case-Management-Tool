# Payments Function Catalog

This is the backend/source-of-truth catalog for payment endpoints in this repo.

## Contract Source
- Request/response schemas: `contracts/src/payments.ts`
- Endpoint req/resp aliases: `contracts/src/endpointMap.ts`
- Runtime schema re-export used by functions: `functions/src/features/payments/schemas.ts`

## Payment Queue And Ledger Invariants

The invoicing tool combines three charge groups with separate display subtypes
and workflow status:

- Charge group/filter: `Enrollment`, `Invoice`, or `Credit Card`.
- Enrollment display subtype: `Arrears`, `Deposit`, `Prorated`, or `Rent`.
- Workflow status remains independent: projected/paid plus compliance states such
  as Needs HMIS, Needs CW, Posted, and Data Entry Complete.
- Closed/deleted grants are historical and are excluded from the operational
  invoicing table and reconciliation warnings.
- `paymentQueueList` enforces that exclusion on refreshed server results. A
  missing/hard-deleted grant reference intentionally remains visible so an
  orphan cannot be concealed as ordinary historical data. The web cache still
  uses the shared payment-queue root invalidation and cannot reintroduce a
  known closed/deleted grant row after refetch.

The global `ledger` collection remains authoritative for posted spend. Pending
enrollment or payment-queue rows remain authoritative for projections.

### Queue posting and retry safety

- Credit-card and invoice queue rows use deterministic ledger document IDs:
  `pqledger_<paymentQueueId>`.
- The ledger entry also stores the queue transaction identity at
  `origin.paymentQueueId` and `origin.sourcePath`.
- `paymentQueuePostToLedger` verifies that a linked ledger document exists before
  treating a queue row as posted.
- If a ledger row exists but the queue row is open or has lost its link, the
  normal row-level Post action repairs `queueStatus` and `ledgerEntryId` without
  creating another spend.
- If a queue row says it is posted but its ledger document is missing, the same
  Post action recreates the missing deterministic ledger row and relinks it.
- Posting validates caller organization, grant ownership, line-item existence,
  and line-item locks before creating new spend.
- Manual invoice/credit-card overrides first create the deterministic ledger row,
  then call the normal post endpoint. If the second call fails, the UI reports
  that the ledger entry was saved and instructs the user to retry the row-level
  Post action.

Do not create a second manual ledger entry to repair an open queue row. Retry the
row-level Post action so the existing transaction identity is reused.

### Reversals

- Every new compensating entry must set `reversalOf` to the original ledger ID.
- Manual reversal entries also include a `reversalOf:<ledgerId>` label for
  search/backward-compatible reconciliation.
- Do not represent a reversal only in free-text notes. Reconciliation pairing
  relies on the explicit ID.

### Payment deletion

- Paid payment deletion is one packaged operation: write the compensating ledger
  reversal, remove enrollment spend mirrors, and recalculate the grant budget.
- The backend rejects paid deletion when budget reversal is not requested.
- "Delete all unpaid payments" preserves paid history.
- Spend mirror cleanup is automatic; the UI no longer exposes independent
  combinations that could orphan an authoritative ledger row.
- After deletion, the backend runs the canonical grant recompute from ledger and
  remaining projections before returning.

### Budget previews and recomputation

- Moving a pending queue item to the ledger is previewed as `spent +amount` and
  `projected -amount`; projected remaining therefore does not double-count the
  transaction.
- Standalone manual ledger entries preview only the spent/balance change.
- Manual ledger creation, queue post/reopen, and payment deletion synchronously
  request canonical grant budget recomputation. Firestore triggers remain an
  idempotent safety net rather than the only path.
- The shared grant-budget eligibility contract separates assignment from
  inclusion. Assigned rows outside the inclusive grant dates, without a valid
  line item, with no transaction date, or outside another eligibility rule stay
  reviewable but do not change projected, spent, balance, or projected balance.
- Pending `paymentQueue` rows are projected spend. Posted queue rows are shadows
  of their linked authoritative ledger entries and are never counted a second
  time.
- Credit-card and invoice queue rows mirror their extracted business transaction
  date (`createdAt`) into `dueDate` so inclusive Invoicing range queries can use
  one indexed field. Re-extraction preserves any existing operator-set due date.
- Voiding an enrollment projection through `paymentQueueVoid` atomically marks
  the matching embedded enrollment payment `void: true`. Customer schedules
  retain that row for history but exclude it from active totals and edits.
- Primary totals and legacy `*InWindow` fields now represent the same canonical
  eligible period. Keep the aliases for compatibility; do not restore all-time
  values to the primary fields.

### Live invoice and credit-card adjustments

- Invoicing's `Adjust Transaction` action edits the existing payment-queue row;
  it does not create a replacement ledger entry or void the source row.
- For a posted transaction, `paymentQueuePatch` updates the queue row and linked
  authoritative ledger entry atomically. Date changes write `dueDate`, `date`,
  and the derived `month` to the ledger.
- Grant and line item may both be blank. A validated grant-only assignment is
  also allowed for review, but remains outside eligible totals until a valid
  line item is selected. Posting a pending transaction remains strict.
- Locally adjusted date, month, amount, and assignment fields are recorded in
  `localModifiedFields`; Jotform reconciliation preserves them.

## Operator Recovery Playbook

For an invoice or credit-card row that appears open even though a ledger entry
was created:

1. Open the row and confirm its grant and line item.
2. Use the row-level `Post Invoice` or `Post Credit Card` action.
3. The backend locates the deterministic or legacy ledger row by
   `origin.paymentQueueId`, relinks the queue row, and recalculates the grant.
4. If the action reports multiple ledger entries for one queue ID, stop. Review
   the duplicate pair before reversing anything; the backend intentionally will
   not choose between duplicates.

For a partial `Mark Past Payments Complete` result, the success/failure toast
reports how many payments completed and identifies failed due dates. Successful
payments stay posted; failed payments remain unpaid and can be retried.

## 2026-07 Payment/Invoice Handoff

Implemented in commit `8e89317` (`fix(payments): harden ledger posting and reversals`).

Primary-workstation verification completed on 2026-07-31:

- Contracts update and Forms production build passed.
- Strict Functions TypeScript passed with `--noEmit --incremental false`.
- 32 focused payment, presentation, reconciliation, hardening, and prior-enrollment
  tests passed.
- The full Next.js production build completed successfully.
- The root package-lock integrity for `functions/vendor/contracts.tgz` was refreshed;
  otherwise npm could reuse a stale same-version contracts tarball and hide the new
  `paymentQueueId` request field from Functions TypeScript.

After deployment, smoke-test one invoice post, one credit-card post, one repair
retry, one reversal pair, and one paid-payment deletion.

Remaining follow-up:

- Row-level posting performs orphan/link repair. Bulk designate/post already uses
  deterministic IDs, but it does not perform the legacy `origin.paymentQueueId`
  repair lookup. Use the row-level Post action for known unsynced transactions;
  extend bulk repair separately if operators need mass recovery.
- Zod defaults in several older endpoint contracts are inferred as required
  output properties in frontend request types. Runtime parsing is safe, and the
  touched payment callers now pass the fields explicitly, but a future contract
  cleanup should distinguish `z.input` request types from parsed output types.

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
