### `functions/src/features/users/README.md`

# Users (Feature)

Auth is the source of truth. We avoid duplicating Auth user fields in Firestore. Org-specific data lives in `userExtras/{uid}` (metrics, settings, notes). Endpoints mutate Auth (claims, disabled) and patch extras.

---

## Contents

| File         | Purpose                                                         | Key exports                                                                                                      |
| ------------ | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `schemas.ts` | Zod validation for user requests and extras                     | `CreateUserBody`, `InviteUserBody`, `SetRoleBody`, `SetActiveBody`, `UserExtras`                                 |
| `service.ts` | Business logic (Auth create/invite, claims, list, extras patch) | `createUserService`, `inviteUserService`, `setUserRoleService`, `listUsersService`, `updateMeExtrasService`, ... |
| `http.ts`    | Secure HTTP handlers for the above                              | `usersCreate`, `usersInvite`, `usersSetRole`, `usersSetActive`, `usersList`, `usersMe`, `usersMeUpdate`          |
| `test.mjs`   | Emulator test script (creates admin, exercises endpoints)       | CLI: `node src/features/users/test.mjs [--admin]`                                                                |

---

## Data model

**Auth (SoT)**: email, displayName, phone, photoURL, `customClaims.roles` (`"admin" | "casemanager" | "compliance"`), and `customClaims.admin` boolean.
**Firestore**: `userExtras/{uid}` — only org-specific fields:

```ts
{
  notes?: string | null
  settings?: Record<string, unknown> | null   // flexible user settings blob
  meta?: Record<string, unknown> | null
  metrics?: {
    caseloadActive?: number | null
    acuityScoreSum?: number | null
    acuityScoreCount?: number | null
    acuityScoreAvg?: number | null
    lastAcuityUpdatedAt?: Timestamp | string | null
  } | null
  updatedAt?: Timestamp
  createdAt?: Timestamp
}
```

**Composite** object returned by APIs merges Auth + `userExtras/{uid}` into:

```ts
{
  uid, email, displayName, photoURL, phone, disabled, active,
  roles: string[], admin: boolean,
  createdAt, lastLogin,
  extras: {...from userExtras}
}
```

---

## Endpoints

| Name             | Auth  | Method   | Body schema               | Notes                                                                                        |
| ---------------- | ----- | -------- | ------------------------- | --------------------------------------------------                                           |
| `usersCreate`    | admin | POST     | `CreateUserBody`          | Creates Auth user, sets claims, seeds `userExtras`                                           |
| `usersInvite`    | admin | POST     | `InviteUserBody`          | Get-or-create by email, sets claims                                                          |
| `usersSetRole`   | admin | POST     | `SetRoleBody`             | Self-guard: cannot remove your own `admin`                                                   |
| `usersSetActive` | admin | POST     | `SetActiveBody`           | Maps active → auth.disabled = !active and returns full composite (includes `active`)         |
| `usersList`      | user  | GET/POST | `ListUsersBody`           | Paged Auth list + fan-out `userExtras`                                                       |
| `usersMe`        | user  | GET      | —                         | Composite of current user                                                                    |
| `usersMeUpdate`  | user  | POST     | `{ updates: UserExtras }` | Patches `userExtras/{uid}`                                                                   |

*Bulk*: services already have bulk helpers (create/invite/roles/active). Add HTTP endpoints later if needed.

---

## Roles

Canonical persisted roles: `"admin" | "casemanager" | "compliance"`.
Inputs like `"case_manager"` are normalized to `"casemanager"`.

---

## Design notes

* **No duplication** of Auth user documents in Firestore.
* **Extras** carries metrics and settings; safe to expand without migrations.
* **Metrics** (CM acuity/caseload) can be updated by customer triggers; for backfills, add a one-shot recompute job similar to acuity’s job.

---
### Metrics
We maintain `metrics/users` with `{ total, active, inactive }` and a daily rollup at `metrics/users_daily/{YYYY-MM-DD}`. Counts are:
- Incremented via Identity triggers on **create/delete**
- Adjusted in services when **active** toggles
- (Optional) `role_counts` is updated when roles change

---

## Testing

```
node src/features/users/test.mjs
```

The script signs up an admin (via emulator), grants claims (via helper), hits all endpoints, and prints composite objects you can use to hydrate the client cache.

---

### `functions/src/features/customers/README.md` (updated)

# Customers (Feature)

CRUD endpoints and triggers for managing customer documents (formerly “clients”).
All business logic stays here; shared building blocks live in `core/`.

---

## Contents

| File          | Purpose                                                            | Key exports                                                                       |
| ------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `schemas.ts`  | Zod validation for customers; shared across HTTP + service layers. | `Customer`, `CustomerUpsertBody`, `CustomerPatchBody`, `toArray()`                |
| `service.ts`  | Core logic to upsert, patch, and delete customers in Firestore.    | `upsertCustomers`, `patchCustomers`, `softDeleteCustomers`, `hardDeleteCustomers` |
| `http.ts`     | Secure HTTP handlers for the above, using `secureHandler`.         | `customersUpsert`, `customersPatch`, `customersDelete`, `customersAdminDelete`    |
| `triggers.ts` | Firestore triggers for metrics and population counts.              | `onCustomerCreate`, `onCustomerUpdate`, `onCustomerDelete`                        |
| `test.mjs`    | Emulator test script (single + admin variants).                    | CLI: `node src/features/customers/test.mjs [--admin]`                             |

---

## Collection Structure

```
customers/
  {id}:
    firstName: string | null
    lastName: string | null
    name: string | null
    populations: "Youth" | "Individual" | "Family" | null
    status: "active" | "inactive" | "closed" | "deleted"
    active: boolean
    caseManagerId: string | null
    caseManagerName: string | null
    acuityScore: number | null
    acuity: { [key: string]: unknown } | null   // includes rubric scoring when used
    meta: { [key: string]: unknown } | null
    _tags?: string[]             // denorm tags maintained by triggers
    createdAt: Timestamp
    updatedAt: Timestamp
```

---

## Endpoints

All endpoints use `secureHandler` (CORS + ID token + optional App Check).
Function names map directly to callable paths (e.g., emulator: `/{project}/{region}/{name}`).

| Name                   | Auth  | Method | Body (shape)                             | Behavior                                        |
| ---------------------- | ----- | ------ | ---------------------------------------- | ----------------------------------------------- |
| `customersUpsert`      | user  | POST   | `Customer` or `Customer[]`               | Full upsert; bulk supported                     |
| `customersPatch`       | user  | PATCH  | `{id, patch}` or `[{id, patch}]`         | Partial update; bulk supported                  |
| `customersDelete`      | user  | POST   | `{ ids: string[] }` or `"id"` / `["id"]` | Soft delete: `status="deleted"`, `active=false` |
| `customersAdminDelete` | admin | POST   | `{ ids: string[] }` or `"id"` / `["id"]` | Hard delete                                     |

**Consistency helpers** (in services):

* `status` and `active` are mirrored both ways (change one → the other is derived).
* If `firstName/lastName` change and `name` not provided in patch, `name` is recomputed.

---

## Triggers & Metrics

`triggers.ts` updates `metrics/customers`:

* `total`, `active`, `inactive`
* Active population buckets:

  * `active_population.youth`
  * `active_population.individuals`
  * `active_population.families`
* Maintains `_tags` on each doc (`active`, `status:*`, `cm:*`, `pop:*`).

> Future: if you want case manager rollups (caseload counts, acuity aggregates), add small increments here tied to `active`, `caseManagerId`, and `acuity.score` deltas.

---

## Quick Examples

**Upsert (bulk)**

```http
POST /customersUpsert
[
  { "firstName": "Jane", "lastName": "Doe", "populations": "Youth" },
  { "firstName": "Sam",  "lastName": "Smith", "status": "inactive" }
]
```

**Patch (single)**

```http
PATCH /customersPatch
{
  "id": "abc123",
  "patch": { "status": "closed", "updatedBy": "system" }
}
```

**Soft delete**

```http
POST /customersDelete
{ "ids": ["abc123","def456"] }
```

---

## Design Notes

* **Reads**: go direct from the web app to Firestore (rules enforce access).
* **Writes**: use these Functions; they’re bulk-friendly for efficient edits.
* **Populations**: `"Youth" | "Individual" | "Family" | null` (exact strings).
* **Logging**: minimal; errors only by default.
* **Extensible**: `meta` and `acuity` are open-ended for new capabilities.

---

## Test scripts

```
node src/features/customers/test.mjs
node src/features/customers/test.mjs --admin
```

They create records against the emulator and print IDs you can use to inspect Firestore and metrics in the Emulator UI.