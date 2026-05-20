# Architecture Spine

This is the canonical system shape. When code drifts from this spine, fix the drift before adding new behavior.

## Layering

Frontend flow:

`Route Page -> Feature Component -> Hook -> Client Wrapper -> Transport -> Backend`

Rules:

- Route pages are thin adapters. They read params and render feature components.
- Components and dialogs do not call endpoints.
- Hooks do not invent URLs or call transport directly.
- Client wrappers are the only frontend layer that speaks endpoint language.
- React Query is the only domain cache.

## Frontend Source Of Truth

- Query keys live in `web/src/hooks/queryKeys.ts`.
- Query defaults live in `web/src/hooks/base.ts`.
- Prefetch helpers live in `web/src/hooks/prefetch.ts`.
- Stable key shaping lives in `web/src/lib/stable.ts`.
- Transport lives in `web/src/client/api.ts`.
- Feature client wrappers live in `web/src/client/*.ts`.
- Feature hooks live in `web/src/hooks/use*.ts`.

No ad hoc query keys, shadow stores, custom entity caches, or feature-level transport clones.

## Frontend Routing And Auth

- Public routes live under `web/src/app/(public)/*`.
- Protected routes live under `web/src/app/(protected)/*`.
- `app/(protected)/layout.tsx` owns protected auth gates.
- `app/(protected)/admin/layout.tsx` owns admin gates.
- `app/auth/AuthProvider.tsx` is the canonical auth/profile source.
- `app/providers.tsx` owns the single QueryClient and global retry rules.
- `app/shell.tsx`, `Topbar`, and `GlobalPending` own global chrome and page framing.

Parallel-route modals are the preferred list/detail overlay pattern.

## UI Primitives

Reuse shared UI before adding feature-specific clones:

- Page/layout primitives: `web/src/entities/Page/`
- Dashboard/list primitives: `web/src/entities/Page/dashboardStyle/`, `web/src/entities/ui/dashboardStyle/`
- Selectors: `web/src/entities/selectors/`
- Dialogs: `web/src/entities/dialogs/`
- Forms: `web/src/entities/ui/forms/`
- Toasts: `web/src/lib/toast.ts`
- Date formatting/parsing: `web/src/lib/date.ts`
- Role helpers: `web/src/lib/roles.ts`

Dialogs should render UI, validate local input, and emit typed payloads via `onConfirm`. They should not call endpoints.

## Backend Feature Shape

Backend flow:

`HTTP Handler -> Service -> Core Helpers / Firestore`

Feature modules usually live under `functions/src/features/<feature>/`:

- `schemas.ts` - re-export or define feature schemas according to the current contracts workflow.
- `service.ts` - business logic.
- `http.ts` - HTTPS handlers using `secureHandler`.
- `triggers.ts` - Firestore/background triggers when needed.
- `index.ts` - feature exports.

Core utilities live in `functions/src/core/` and are exported through `functions/src/core/index.ts`. Feature code imports core through the barrel, not deep paths.

## Backend Invariants

- Do not rename top-level Firestore collections or change their semantics casually.
- Domain docs are org-scoped through `orgId` and often team-scoped through `teamIds`.
- HTTPS handlers reading/writing org-scoped docs must enforce org/team access.
- Use core helpers for auth, RBAC, org/team checks, dates, normalization, sanitization, transactions, and idempotency.
- Do not overwrite reserved lifecycle/security fields from raw user input.
- Preserve null-vs-missing semantics where queries depend on them.

Common fixed collections include `customers`, `grants`, `customerEnrollments`, `userExtras`, `jobs`, `idempotency`, `ledger`, `userTasks`, `acuityRubrics`, `tours`, and `metrics/*`.

## Data Safety

User-provided payloads must be sanitized before Firestore writes. Protect at least:

- `orgId`, `teamId`, `teamIds`
- `createdAt`, `updatedAt`, `deletedAt`
- `createdBy`, `updatedBy`, `by`
- `status`, `deleted`, `active`
- leaf-specific identity and audit fields

When in doubt, use the existing sanitize/strip helpers and keep behavior additive.
