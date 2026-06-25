# Maintainer Handoff

This document is the short operational map for the next maintainer or AI agent.

For historical V1 to V2 migration context, read `docs/MIGRATION_HISTORY.md`. The old migration archive was intentionally removed from the working tree because it contained generated harvests, transformed data, record IDs, and one-off scripts from the completed migration.

## What The App Does

Households DB v2 is an internal operations system for housing/grant case work. It manages:

- Customers and household records
- Grants, line items, allocations, and budgets
- Customer enrollments and projected payment schedules
- Payments, ledger entries, credit card spend, and reconciliation
- Inbox/task workflows and case manager workload views
- Assessments and acuity
- Jotform submission ingestion and spend extraction
- Google Drive customer folder tooling
- Reporting, admin pages, dev tools, tours, and internal game overlays

For Budget Digest behavior, budget-display org config, and the planned line-item /
split-goal digest manager work, see `docs/BUDGET_DIGEST_WORKFLOW.md`.

## Runtime Stack

- Web: Next.js 15, React 19, TypeScript, Firebase client SDK, React Query
- Backend: Firebase Cloud Functions, TypeScript, Firebase Admin SDK
- Database: Firestore with checked-in rules and indexes
- Shared contracts: `@hdb/contracts` built from `contracts/src`
- Hosting/deploy: Firebase App Hosting and Firebase Functions

## Important Entry Points

- `web/src/app/(protected)/page.tsx` - protected app landing/dashboard area
- `web/src/features/tools/toolsDefs.tsx` - tool/report registration surface
- `web/src/features/admin/org-config/orgConfigToolDefs.tsx` - Org Config tools, including Display Configuration (`/admin/org-config/display-config`)
- `web/src/client/api.ts` - HTTP client plumbing
- `web/src/hooks/queryKeys.ts` - React Query key definitions
- `functions/src/index.ts` - exported Cloud Functions
- `functions/src/core/http.ts` - secure HTTP handler wrapper
- `functions/src/core/rbac.ts` and `functions/src/core/roles.ts` - authorization model
- `functions/src/core/env.ts` - Firebase params/secrets
- `contracts/src/endpointMap.ts` - endpoint map shared with clients
- `firestore.rules` - Firestore access control

## Google OAuth Credential Boundary

Keep automated email credentials separate from Drive/Calendar integration credentials.

- `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` are for Gmail sender functions in `functions/src/features/inbox/`.
- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and optional `GOOGLE_OAUTH_REFRESH_TOKEN` are for Google Drive/Calendar integrations in `functions/src/features/google/`, `functions/src/features/gdrive/`, and `functions/src/features/calendar/`.
- The shared Google OAuth account, when configured through `GOOGLE_OAUTH_REFRESH_TOKEN`, is read-only by product policy. Posting calendar events, creating folders, uploads, renames, moves, and Sheets writes should use permanent per-user OAuth or an explicit temporary user token.

If Google sign-in shows `redirect_uri_mismatch`, check both sides: the Google Cloud Console authorized redirect URI must match `GOOGLE_OAUTH_REDIRECT_URI`, and the deployed functions must be using the Drive/Calendar OAuth client, not the mailer client. Never commit downloaded OAuth client files such as `client_secret_*.json`.

## Feature Pattern

Most backend features follow this pattern:

- `functions/src/features/<feature>/schemas.ts` - backend schema definitions
- `functions/src/features/<feature>/service.ts` - business logic
- `functions/src/features/<feature>/http.ts` - HTTP endpoints
- `functions/src/features/<feature>/triggers.ts` - Firestore/event triggers when needed
- `functions/src/features/<feature>/index.ts` - feature exports

Frontend feature work usually touches:

- `web/src/client/<feature>.ts`
- `web/src/hooks/use<Feature>.ts`
- `web/src/features/<feature>/...`
- `web/src/entities/...` for shared UI
- `contracts/src/<feature>.ts` when request/response/data shape changes

## Common Workflows

Read `docs/ARCHITECTURE_SPINE.md` for the canonical route, hook, client, contract, backend, auth, cache, and UI rules. Read `docs/CONTRACTS_WORKFLOW.md` before changing shared schemas or endpoint payloads.

### Add Or Change An API

1. Update the contract in `contracts/src/`.
2. Run `npm run contracts:update`.
3. Update backend service and HTTP handler in `functions/src/features/<feature>/`.
4. Update frontend client and hook.
5. Build contracts, functions, and web.

### Diagnose A Bug

1. Identify the visible page/tool or backend endpoint.
2. Read `graphify-out/GRAPH_REPORT.md` for related communities and central files.
3. Trace from UI component to hook, client, contract, backend HTTP handler, service, and Firestore rules.
4. Add or run the smallest test/build that exercises the change.

### Data Repair Or Extraction

Use existing scripts first. Many scripts are dry-run by default:

- `scripts/close-past-payments.mjs`
- `scripts/close-past-credit-card-payments.mjs`
- `scripts/jotform-pull-shape.mjs`
- `scripts/initialize.mjs`
- `scripts/file-diet.mjs`
- `scripts/type-diet.mjs`

Never commit extracted customer, grant, ledger, payment, auth, Jotform, or Drive data.

### Deploy

Prefer package scripts:

- `npm run deploy:hosting`
- `npm run deploy:hosting:all`
- `npm run deploy:functions`
- `npm run deploy:functions:missing`
- `npm run deploy:functions-hosting`

`deploy:hosting` and `deploy:functions-hosting` deploy web hosting only (`hosting:web`). Use the `:all`/`--hosting-all` paths only when every configured hosting target should deploy.

Use reset deploy scripts only after reading their flags and understanding the function deletion behavior.

## Graphify

`graphify-out/GRAPH_REPORT.md` is the fastest map of the codebase. Use it before broad file searches. The checked-in graph artifacts are navigation aids, not source of truth. Source files, contracts, Firestore rules, Firebase config, and package scripts remain authoritative.

Regenerate graph outputs after meaningful refactors. When regenerating, exclude private/generated data directories such as `.git`, `node_modules`, `.emulator-data`, `.firebase`, `artifacts`, `archive/migration/artifacts`, `scripts/out`, `scripts/prompts`, and local env/credential files.
