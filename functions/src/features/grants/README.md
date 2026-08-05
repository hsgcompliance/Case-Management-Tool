# Grants (and Programs) - Backend Feature

This feature owns the **`grants`** collection and its HTTP surface area. It intentionally supports two closely-related concepts:

- **Grant**: has a budget; tracks spending/projections against line items.
- **Program**: a "budgetless grant"; same scheduling/metadata surface, but **budget is always `null`**.

The backend enforces these invariants. The frontend may *suggest* shape, but it does not get to decide truth.

---

## Canonical model

### Collection
- `grants/{grantId}`

### Server-authoritative fields
These are **never** accepted from clients (they are ignored/overwritten server-side):

- `orgId`
- `createdAt`, `updatedAt`
- `deletedAt`
- `_tags`
- `active`, `deleted`
- any key starting with `_`

### Kind vs budget mode (program vs grant)

The canonical switch is:

- `kind: "grant" | "program"`
- `budgetMode: "budgeted" | "none"` (compat alias; still stored/returned)

**Coherence rule (server enforced):**
- If `kind === "program"` **OR** `budgetMode === "none"`  
  -> server writes `{ kind:"program", budgetMode:"none", budget:null }`
- Otherwise  
  -> server writes `{ kind:"grant", budgetMode:"budgeted" }` and allows `budget`

### Status mirrors

- `status: "active" | "draft" | "closed" | "deleted"`
- `active` is derived from `status === "active"`
- `deleted` is derived from `status === "deleted"`

Clients may PATCH `status`, but not the derived mirrors directly.

---

## Budget shape (grants only)

Budget exists only when `kind:"grant"` / `budgetMode:"budgeted"`.

### `budget`
- `budget.total`: number (cap). If omitted/invalid, server derives from `sum(lineItems[].amount)`.
- `budget.lineItems[]` (each line item):
  - `id` (server fills if missing)
  - `label`
  - `amount`
  - `projected` (eligible transactions inside the inclusive grant period)
  - `spent` (eligible transactions inside the inclusive grant period)
  - `projectedInWindow` / `spentInWindow` (compatibility mirrors of the
    canonical eligible totals)
- `budget.totals` is server-derived for determinism:
  - `total, projected, spent, balance, projectedBalance`
  - `remaining` is a compat alias of `balance`
  - window totals (optional): `projectedInWindow, spentInWindow, windowBalance, windowProjectedBalance`

**Important:** Budget updates are treated as "special" in patching (see Patch semantics).

### Canonical transaction eligibility

All grant-budget writers and previews use
`@hdb/contracts/grantBudgetEligibility`. A transaction is assigned when it
names the grant; it contributes to totals only when it also names an existing
line item, is not void or a posted queue shadow, and its resolved transaction
date is within the grant's inclusive `startDate` / `endDate`.

Transaction-date precedence is `transactionDate`, `dueDate`, `date`,
`paymentDate`, `serviceDate`, `postedAt`, `createdAt`, `ts`, `updatedAtISO`,
then `updatedAt`. An explicit `YYYY-MM-DD` prefix keeps its calendar day and is
not shifted by a viewer or server timezone.

`splitGoals` define spending-cycle allocation, not grant-period eligibility. A
row may therefore count in grant totals while remaining outside every spending
cycle. Pipeline matching dates and display configuration do not override the
grant period. The shared contract recognizes an override only when it contains
an approval flag, approver, approval timestamp, and reason; no unreviewed row
flag is trusted.

Assigned but ineligible rows remain in `grantsActivity`. Each normalized row
includes `budgetEligibility` with the exclusion reason and suggested workflow,
so callers can show it for review without adding it to eligible totals.

---

## Org scoping and access

Every operation resolves a **target org**:

1. If caller has `orgId` in claims -> **that is the target org**
2. If caller is `dev` and provides explicit `orgId` (query/body) -> **that org is target**
3. Otherwise -> request fails with `missing_org` / `forbidden`

**Non-dev callers cannot operate cross-org.**  
Dev callers may, but only when an explicit target org is provided.

Legacy grants missing `orgId` are tolerated for read paths in migration windows, but **writes will migrate** by setting `orgId` to the resolved target org.

---

## HTTP endpoints

All handlers are wrapped by `core/secureHandler`.

### Upsert
- `POST /grantsUpsert` (auth: `admin`)
  - Body: `Grant | Grant[]`
  - Semantics: merge-write (does not delete unspecified fields)

### Patch
- `PATCH /grantsPatch` (auth: `user`)
  - Body: `{ id, patch, unset? } | Array<{ id, patch, unset? }>`
  - Supports `unset[]` dot-path deletes (see below)

### Soft delete
- `POST /grantsDelete` (auth: `admin`)
  - Body: `id | ids[]`
  - Writes: `status:"deleted"`, `active:false`, `deleted:true`, stamps `deletedAt`
  - Cascades terminal status to non-terminal enrollments.
  - Voids pending enrollment projections for every enrollment reference,
    including enrollments that were already closed/deleted before a retry.
  - Does not delete or reassign ledger, invoice, credit-card, or Jotform source
    records.

### Hard delete
- `POST /grantsAdminDelete` (auth: `admin`)
  - Body: `id | ids[]`.
  - Refuses with `grant_has_financial_records` while the grant has ledger rows,
    payment-queue rows, enrollment payment schedules, embedded spends, or spend
    subcollection mirrors.
  - The operator must first reassign legitimate transactions or use the owning
    payment/test-cleanup workflow. Hard delete is not a financial cascade.
  - If enrollment deletion fails, the grant document is retained and the
    request fails with `grant_enrollment_delete_failed`.

### Reviewed test-data cleanup

`scripts/cleanup-test-grant-data.mjs` is dry-run by default and accepts an
ID-only reviewed manifest. It rejects relationship drift, non-projection queue
sources, unexpected Jotform/pipeline/allocation/audit records, and unreviewed
grant markers. The Project 4 cleanup soft-deletes grants/enrollments, voids
pending projections, retains posted queue shadows and enrollment spend mirrors,
and creates explicit compensating ledger reversals. It never deletes customer
or Jotform source records.

### Get
- `GET /grantsGet?id=...` (auth: `user`)
- `POST /grantsGet` with `{ id }` (auth: `user`)

### List
- `GET /grantsList` (auth: `user`)
- `POST /grantsList` (auth: `user`)
  - Filters (best-effort):
    - `status`
    - `active`
    - `limit` (1..500)
    - cursor: `cursorUpdatedAt`, `cursorId`
  - Ordering: `updatedAt desc, documentId desc`
  - Cursor: `startAfter(updatedAt, id)`

### Structure
- `GET /grantsStructure` (auth: `user`)
  - Returns an empty, **correctly-shaped** skeleton for form initialization.
  - **Note:** `tasks` is a legacy/reminder metadata record, not an array.

### Activity
- `GET /grantsActivity?grantId=...&limit=...` (auth: `user`)
- `POST /grantsActivity` with `{ grantId, limit? }` (auth: `user`)
  - Attempts `collectionGroup("spends")` first; falls back to reading `customerEnrollments.spends[]`.
  - Returns normalized activity items with best-effort timestamps.

---

## Patch semantics (important)

### General patching
`PATCH /grantsPatch` uses **merge semantics**:
- Only fields present in `patch` are applied.
- Unspecified fields are not removed.

### Field removal: `unset[]`
To remove fields, provide `unset: string[]` with dot-paths:

- Example: `unset: ["meta.foo", "tasks.someKey"]`

Server applies `FieldValue.delete()` for each path.

### Budget patching
If `patch` includes `budget`, the server processes that row **transactionally** to ensure deterministic merging and total derivation:

- Merges prior + patch budget objects
- Re-normalizes line items (ids if missing)
- Re-derives `budget.total` (when absent/invalid) and `budget.totals`
- Applies `unset[]` within the same transaction if provided

### Program coercion
If a patch implies `program` (`kind:"program"` or `budgetMode:"none"`), server forces:
- `budget: null`
- coherent `kind/budgetMode`

---

## Triggers / derived metadata

This feature maintains lightweight derived metadata:

- `_tags`: derived from:
  - `active`
  - `status:*`
  - `kind:*`
  - `org:*`
- `metrics/grants`: counters
  - `total`
  - `active` / `inactive`
  - `status.<status>`

These are intentionally "best-effort" counters, not a ledger.

---

## Contracts

This feature consumes canonical schemas from:

- `@hdb/contracts/grants`

The backend re-exports those schemas in:

- `functions/src/features/grants/schemas.ts`

If the contract changes, regenerate contracts and update callers; do not fork shape in the feature.

---

## Quick examples

### Create a grant (budgeted)
```json
{
  "name": "TLP 2026",
  "status": "active",
  "kind": "grant",
  "budgetMode": "budgeted",
  "budget": {
    "total": 100000,
    "lineItems": [
      { "label": "Rent", "amount": 80000 },
      { "label": "Deposits", "amount": 20000 }
    ]
  },
  "tasks": {},
  "meta": { "fundingSource": "HUD" }
}
````

### Convert a grant into a program (budgetless)

```json
{
  "id": "GRANT_ID",
  "patch": { "kind": "program" }
}
```

Server will persist `budget:null` and set `budgetMode:"none"` automatically.

### Remove a meta field

```json
{
  "id": "GRANT_ID",
  "patch": {},
  "unset": ["meta.fundingSource"]
}
```

---

## Non-negotiables

* **Org scoping is enforced server-side.** Clients do not set `orgId`.
* **Programs never carry budgets.** If the client tries, the server clears it.
* **`unset[]` is the only supported deletion mechanism on PATCH.**
* **`tasks` is a legacy/reminder metadata record**, not an array. Any code treating it as an array is wrong.
* **Do not build new grant behavior around generic task completion.** Prefer reminders, notes, flags, and digest visibility.

```
