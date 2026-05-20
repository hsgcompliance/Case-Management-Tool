# Households DB v2

Households DB v2 is a Firebase-backed case management and grant operations app. It tracks customers, enrollments, grants, payment schedules, credit card spend, inbox/tasks, assessments, Google Drive folder workflows, Jotform ingestion, reporting widgets, and internal admin/dev tooling.

This repo is intended to be maintainable by a future developer or an AI coding agent after cloning from GitHub. Start with:

1. `AGENTS.md` for agent behavior and first reads.
2. `scripts/README.md` for the script catalog.
3. `graphify-out/GRAPH_REPORT.md` for the generated codebase map.
4. `docs/MAINTAINER_HANDOFF.md` for app architecture, deploy notes, and common workflows.
5. `docs/ARCHITECTURE_SPINE.md` and `docs/CONTRACTS_WORKFLOW.md` before changing core patterns or API shapes.
6. `docs/DOC_REVIEW.md` to distinguish reviewed repo docs from `.local-only.md` background notes.
7. `docs/PRIVACY_AND_REPO_HYGIENE.md` before adding data exports, archive material, or local config.

## Repo Shape

- `web/` - Next.js app, React 19, Firebase client, feature UI, hooks, and route structure.
- `functions/` - Firebase Cloud Functions backend, feature services, HTTP handlers, triggers, auth, RBAC, and integrations.
- `contracts/` - Shared Zod schemas, endpoint contracts, and types vendored into `web/` and `functions/`.
- `scripts/` - deploy helpers, contract packaging, dry-run data maintenance scripts, and repo tooling.
- `graphify-out/` - generated knowledge graph outputs for AI navigation.
- `docs/` - reviewed maintainer-facing docs. Files ending in `.local-only.md` are ignored background notes and should not be treated as repo-ready source of truth.
- `archive/` - historical/migration material. Treat as private unless a file is explicitly reviewed and documented as safe.

## Local Setup

Use Node 22. Then install from the repo root:

```powershell
npm install
```

Common commands:

```powershell
npm run build:contracts
npm run build:functions
npm run build:web
npm run emulators
npm -w web run dev
```

The web dev server uses port `5173`. Local environment examples live in `web/.env.local.example`. Do not commit real `.env` files or service account credentials.

## Deploy

Deploy through the safe scripts in `package.json`, not raw ad hoc Firebase commands:

```powershell
npm run deploy:hosting
npm run deploy:functions
npm run deploy:functions-hosting
```

For high-risk backend deploys, read `scripts/README.md` and the deploy script options first. Some scripts intentionally support dry runs or `--no-push`.

## Before Changing Code

Run this orientation loop:

1. Read `AGENTS.md`.
2. Read `graphify-out/GRAPH_REPORT.md` and find the relevant community or high-centrality files.
3. Read the feature README if one exists, for example under `functions/src/features/*/README.md` or `web/src/features/*/README.md`.
4. Check contracts in `contracts/src/` before changing request or response shapes.
5. Prefer existing scripts and service helpers over creating new one-off tools.

## Data Safety

This system handles household, grant, payment, Jotform, Drive, and user data. Keep production data exports, emulator snapshots, migration harvests, credentials, tokens, local agent settings, and generated debug output out of GitHub. See `docs/PRIVACY_AND_REPO_HYGIENE.md`.
