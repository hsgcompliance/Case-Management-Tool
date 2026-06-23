# Agent Onboarding

You are working in Households DB v2, a Firebase/Next.js operations app for customer, grant, enrollment, payment, Jotform, Google Drive, task, inbox, assessment, and reporting workflows.

> **Sync note:** This file is the canonical agent instruction source. If you update it, also update the relevant entries in the `.claude/` project memory (`~/.claude/projects/.../memory/`). The memory captures *why* and *context*; this file captures *what to do*.

> **Local machine shortcut:** If you are operating on `AzureAD+GriffinSeyfried@HRDCL-Energy009` (MINGW64 / Windows dev workstation), the graph is already built, the environment is already configured, and the full first-reads orientation below is optional - the live files are authoritative. You can skip straight to the relevant feature files identified via `graphify-out/GRAPH_REPORT.md`.

## First Reads

Before answering architecture questions or making non-trivial edits:

1. Read `README.md`.
2. Read `graphify-out/GRAPH_REPORT.md` and use it to identify the relevant feature community and high-centrality files. See `docs/PRIVACY_AND_REPO_HYGIENE.md` before regenerating graph outputs.
3. Read `docs/MAINTAINER_HANDOFF.md`.
4. Read `docs/ARCHITECTURE_SPINE.md` before changing routing, hooks, clients, backend feature modules, auth, cache, or UI primitives.
5. Read `docs/CONTRACTS_WORKFLOW.md` before changing API payloads, shared schemas, or endpoint response shapes.
6. Read `docs/DOC_REVIEW.md` to understand which docs are reviewed and which `.local-only.md` files are background context.
7. For data, deploy, auth, GCS/Google Drive, or archive questions, read `docs/PRIVACY_AND_REPO_HYGIENE.md` first.

If a user request is vague, ask which mode they want:

- bug fix
- feature enhancement
- new feature build
- data extraction or repair
- app/backend overview
- deployment or Firebase/GCS/Google Drive support

Then ask for the smallest missing detail needed to proceed: the visible symptom, affected page/tool, expected behavior, relevant customer/grant/form ID, or target environment.

## Architecture Short Map

- Frontend routes and pages: `web/src/app/`
- Frontend feature UI: `web/src/features/`
- Shared frontend components: `web/src/entities/`
- Frontend API clients: `web/src/client/`
- React Query hooks: `web/src/hooks/`
- Backend entrypoint: `functions/src/index.ts`
- Backend core HTTP/auth/RBAC/env helpers: `functions/src/core/`
- Backend feature modules: `functions/src/features/`
- Shared schemas/contracts: `contracts/src/`
- Firebase rules/indexes/config: `firestore.rules`, `firestore.indexes.json`, `firebase.json`, `apphosting.yaml`

## Deploy System

All deploy scripts live in `scripts/` and are wired to `npm run` aliases. They push to GitHub by default (auto-commit + push); add `--no-push` / use the `:no-push` npm alias to skip.

### Deploy philosophy
- **During a session:** prefer minimal, targeted deploys — push fast and test quickly. Deploy only what changed.
- **Near a milestone or with large changes:** use smaller, intentional commits before deploying so the git history stays legible.

### Deploy targets

| Target | npm script | What it does |
|---|---|---|
| **functions** | `npm run deploy:functions` | All functions, chunked (safe — won't delete unrecognized deployed fns) |
| **functions** (missing only) | `npm run deploy:functions:missing` | Diff-based — deploys only fns not yet in Firebase. Fastest for new additions. |
| **web** | `npm run deploy:hosting` | Next.js hosting only |
| **functions + web** | `npm run deploy:functions-hosting` | Functions (all) + hosting in one pass |
| **git only** | *(manual)* `git add -A && git commit -m "..." && git push` | Commit + push with no Firebase deploy |
| **graph** | *(see below)* | Incremental graph rebuild — run after code edits |
| **ALL** | `npm run contracts:update && npm run deploy:functions-hosting` | Contracts → functions → hosting → git push |

### Graph deploy (after code changes)
```powershell
python -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"
```
Then commit `graphify-out/GRAPH_REPORT.md` and `graphify-out/graph.json` if meaningfully changed. Before committing graph outputs, scan for local paths, credentials, or dump content (see Knowledge Graph section below).

### Selective / recovery deploys
```powershell
# Deploy only functions matching a pattern (fast for targeted changes)
npm run deploy:functions -- --match='^(grants|customers)'

# Resume a failed chunked deploy from a specific function
npm run deploy:functions -- --start-at=<functionName> --no-build

# Nuclear reset (only if function state is corrupted)
npm run deploy:reset-functions-hosting
```

### Windows: clear the Next build cache before a web build/deploy
On Windows the `next build` step intermittently fails with
`EPERM: operation not permitted, rename '...\.next\cache\webpack\...\N.pack_' -> '...N.pack'`
(a stale webpack cache-pack lock). It compiles fine, then dies during "Generating
static pages". Before building or deploying web hosting, clear the cache and use a
long timeout:
```powershell
Remove-Item -Recurse -Force web\.next\cache -ErrorAction SilentlyContinue
npm run deploy:hosting        # or build:web
```
A clean re-run succeeds; the error is a flaky file lock, not a code failure.

### Contracts (when schema changes)
```powershell
npm run contracts:update   # build + vendor into functions/ and web/
```
Always run this before deploying functions if `contracts/src/` changed.

### Data / Payments scripts — all dry-run by default
| Script | Purpose |
|---|---|
| `close-past-payments.mjs` | Mark past-due enrollment payment rows closed |
| `close-past-credit-card-payments.mjs` | Audit/close past CC `paymentQueue` items |
| `jotform-pull-shape.mjs` | Fetch Jotform form schema from API |

Add `--apply --yes` to any of the above to commit changes. See `scripts/README.md` for full flag reference.

## Knowledge Graph

This repo has a generated code graph at `graphify-out/`. The checked-in graph artifacts are intentional repo navigation aids for future agents.

**Quick reference:**
- God nodes (high-centrality files) are listed in `graphify-out/GRAPH_REPORT.md` - read it before broad edits.
- After code changes, run the incremental update (no LLM needed):
  ```powershell
  python -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"
  ```
- Before committing regenerated `graphify-out/graph.json`, `graphify-out/graph.html`, `graphify-out/GRAPH_REPORT.md`, or `graphify-out/manifest.json`, scan them for local-only, archive, generated dump, credential, or absolute machine paths.

## Change Rules

- Keep contracts, backend schemas, and frontend clients aligned.
- For endpoint shape changes, update `contracts/src/*`, run `npm run contracts:update`, then update backend and frontend consumers.
- Prefer existing feature service functions and hooks over new parallel flows.
- Data scripts must be dry-run by default unless there is a strong existing pattern that says otherwise.
- Do not commit real `.env` files, service account keys, tokens, emulator data, production exports, harvested migration data, or local agent settings.
- Treat `.local-only.md` files as non-authoritative local notes. Extract durable, sanitized guidance into reviewed docs before relying on them for repo decisions.
- Do not deploy with raw Firebase commands unless the safe scripts cannot do the job and the reason is documented.

## Verification

Use the narrowest useful verification:

```powershell
npm run build:contracts
npm run build:functions
npm run build:web
npm -w web run test:unit
```

If verification cannot run, report exactly what failed and what risk remains.
