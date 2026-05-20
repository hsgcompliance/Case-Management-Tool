# Doc Review

This directory uses two classes of docs:

- Reviewed docs are intended to be committed and used as maintainer/agent source of truth.
- `.local-only.md` docs are ignored background notes. They may be useful locally, but they are not reviewed for GitHub and should not be pushed as-is.

## Reviewed Docs

- `README.md` - root onboarding and repo shape.
- `AGENTS.md` - coding-agent first reads, request triage, and change rules.
- `NODE_UPGRADE.md` - package and Node upgrade changelog.
- `docs/MAINTAINER_HANDOFF.md` - app map, workflows, deploy notes, and graphify guidance.
- `docs/ARCHITECTURE_SPINE.md` - canonical frontend/backend architecture rules.
- `docs/CONTRACTS_WORKFLOW.md` - shared schema and endpoint alignment process.
- `docs/PRIVACY_AND_REPO_HYGIENE.md` - privacy, secret, archive, and local-only rules.
- `docs/PRODUCT_BACKLOG_NOTES.md` - sanitized product backlog context extracted from old prompts.
- `docs/MIGRATION_HISTORY.md` - sanitized historical context from the completed V1 to V2 migration.
- `scripts/README.md` - script catalog and safe usage notes.

## Reviewed Feature Docs

- `functions/src/features/assessments/README.md`
- `functions/src/features/grants/README.md`
- `functions/src/features/inbox/README.md`
- `functions/src/features/payments/README.md`
- `functions/src/features/sheetsBridge/README.md`
- `functions/src/features/tasks/README.md`
- `functions/src/features/users/README.md`
- `web/src/features/customers/README.md`
- `web/src/features/secret-games/GAMES.md`

## Local-Only Docs

These are intentionally ignored and suffixed as local-only:

- `docs/detail-card-data-matrix.local-only.md`
- `docs/entities-index.local-only.md`
- `docs/GRAPH_SYSTEM.local-only.md`
- `docs/jotform-credit-card-budget-tracking.local-only.md`
- `docs/jotform-spend-grant-mapping-tool.local-only.md`
- `docs/metric-platform-proposal.local-only.md`
- `docs/metric-systems-audit.local-only.md`
- `docs/tasks-flow-audit.local-only.md`
- `docs/transaction-shape-reference.local-only.md`
- `docs/secret-games/*.local-only.md`

Use local-only docs as background only. If one contains durable guidance, extract the durable part into a reviewed doc instead of committing the original file.

## Promotion Checklist

Before promoting any local-only doc:

1. Remove private identifiers, customer/user/payment data, credentials, tokens, local-only paths, and stale implementation assumptions.
2. Verify referenced file paths still exist.
3. Prefer a concise maintained summary over a large historical audit.
4. Add the promoted filename to `.gitignore` as an explicit unignore.
5. Add it to the Reviewed Docs list above.
