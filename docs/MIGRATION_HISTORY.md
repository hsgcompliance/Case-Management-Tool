# Migration History

This is the sanitized historical summary of the completed Households Database V1 to Households DB v2 migration. The old `archive/migration/` tree was intentionally removed because it contained generated harvests, transformed data, record IDs, local paths, and one-off migration scripts that should not be pushed or treated as current tooling.

## Status

The migration is complete. Do not rebuild or rerun the old migration pipeline as part of normal maintenance.

Current source-of-truth lives in the V2 app:

- Firestore collections and rules in this repo
- shared schemas in `contracts/src/`
- backend services in `functions/src/features/`
- frontend clients/hooks/features in `web/src/`

## What Was Migrated

The migration moved core V1 operational data into the V2 model:

- grants
- customers
- customer enrollments
- ledger/payment-related history
- users and user metadata
- assessment/acuity-related records where applicable

V2-native operational projections were derived after direct import rather than treated as primary migration sources. Examples included payment queue rows, user task/reminder projections, grant budget rollups, ledger enrichment fields, missing display names, default populations, and compliance/stage fix-ups.

## Useful Lessons

- `contracts/` became the schema source of truth for V2.
- Migration safety depended on a staged flow: harvest, transform, validate, emulator load, checks, reconcile, then production application.
- Direct imported collections and derived V2 collections were kept separate to avoid turning emulator state into source-of-truth.
- Relationship integrity checks were important for customer, enrollment, grant, ledger, and user joins.
- Some V1 records were intentionally skipped or transformed when they were test data, orphaned, or not meaningful in the V2 model.
- V2 reads should prefer V2-native services, rollups, and contracts instead of any old V1 shape assumptions.

## What Not To Keep

Do not reintroduce the old archive into Git:

- harvested V1 snapshots
- transformed JSON outputs
- source ID maps
- validation error artifacts
- apply summaries
- migration one-off scripts
- local migration docs with record IDs or local paths

If a future question needs migration context, use this summary and then inspect current V2 source code. If old data artifacts are ever needed for legal or operational reasons, retrieve them from a private backup location, not from this repo.

## Future Maintainer Guidance

When investigating old data behavior:

1. Start with current contracts in `contracts/src/`.
2. Trace current services in `functions/src/features/`.
3. Check Firestore rules and indexes.
4. Treat any V1 terminology as historical unless it still appears in current contracts or persisted V2 docs.
5. Prefer writing a focused current-state audit over resurrecting old migration scripts.
