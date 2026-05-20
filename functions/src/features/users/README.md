# Users Feature

Auth is the source of truth for identity. This feature manages Firebase Auth users, custom claims, active/disabled state, and `userExtras/{uid}` metadata.

## Files

| File | Purpose |
|---|---|
| `schemas.ts` | User request and extras validation |
| `service.ts` | Auth create/invite, claims, active state, listing, and extras patch logic |
| `http.ts` | Secure HTTP handlers |
| `identity.ts` | Identity trigger helpers |
| `triggers.ts` | Auth/user metric triggers |
| `metrics.ts`, `caseloadMetrics.ts`, `paymentMetrics.ts`, `taskMetrics.ts`, `acuityMetrics.ts`, `workloadMetrics.ts` | User and case manager metrics helpers |
| `dev.ts` | Emulator/dev-only user helpers |

## Data Model

Firebase Auth owns:

- email
- display name
- phone/photo fields
- disabled state
- custom claims for roles, org, teams, caps, and admin/dev ladder behavior

Firestore stores only app-specific extension data:

```ts
userExtras/{uid}: {
  notes?: string | null;
  settings?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
  metrics?: Record<string, unknown> | null;
  taskMode?: "viewer" | "workflow";
  taskModeSetAt?: unknown;
  taskModeSetBy?: "self" | "admin" | "system";
  updatedAt?: unknown;
  createdAt?: unknown;
}
```

API responses merge Auth plus `userExtras/{uid}` into a user composite.

## Endpoints

| Name | Auth | Method | Purpose |
|---|---|---|---|
| `usersCreate` | admin | POST | Create Auth user, set claims, seed extras |
| `usersInvite` | admin | POST | Get or create by email, set claims |
| `usersSetRole` | admin | POST | Update role claims with self-admin guard |
| `usersSetActive` | admin | POST | Map active state to Auth disabled state and return composite |
| `usersList` | user | GET/POST | Paged Auth list plus extras fan-out |
| `usersMe` | user | GET | Current user composite |
| `usersMeUpdate` | user | POST | Patch current user's extras/settings |

## Metrics

The feature maintains `metrics/users` and daily rollups at `metrics/users_daily/{YYYY-MM-DD}`. Counts are updated by identity triggers and service writes where active/role state changes.

## Design Notes

- Do not duplicate Auth user documents into Firestore.
- Add user preferences and app-only metadata to `userExtras/{uid}`.
- Keep role and org/team behavior claim-driven.
- Use backend services for active/role changes so Auth, claims, extras, and metrics stay coherent.
