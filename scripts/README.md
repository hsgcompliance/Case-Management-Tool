# scripts/

Node.js automation scripts for HDB v2. All scripts are ESM (`.mjs`) and run with `node scripts/<name>.mjs` from the repo root unless noted.

**Before writing a new script or doing a manual Firestore/deploy operation, check if one already exists here.**

## Deploy

### `deploy-functions-safe.mjs`
Chunked all-functions deploy. Avoids accidentally deleting extra deployed functions by deploying in batches. Checks out the selected function names before deploy so another agent can deploy disjoint functions in parallel but cannot deploy the same function at the same time.
```sh
node scripts/deploy-functions-safe.mjs housing-db-v2 [--list-only] [--no-push] [--start-at=<fn>] [--match='^(grants|customers)'] [--hosting] [--hosting-all]
```
- `--list-only` — preview chunks without deploying
- `--start-at=<fn>` — resume after a failed chunk
- `--match=<regex>` — deploy only matching functions
- `--hosting` - also deploy web hosting (`hosting:web`) after functions
- `--hosting-all` - also deploy every configured Firebase Hosting target after functions
- `--no-push` - skip GitHub push

### `deploy-hosting-safe.mjs`
Deploy Firebase Hosting targets with target-aware checkouts. This defaults to `hosting:web,functions:firebase-frameworks-housing-db-v2:ssrhousingdbv2` for the web app so Firebase deploys the generated Next SSR function without discovering the unrelated default functions codebase. Pass `--target=mobile` or `--target=forms` for static targets, and `--build` to run that target's build first. Pass `--all` only when every configured Firebase Hosting target should deploy. Child deploy commands have a 90-minute timeout by default; override with `HDB_DEPLOY_COMMAND_TIMEOUT_MS`.
```sh
node scripts/deploy-hosting-safe.mjs [--no-push] [--all] [--target=web|mobile|forms] [--build]
```

### `deploy-status.mjs`
Show active deploy/build checkouts in `.deploy-checkouts/`.
```sh
node scripts/deploy-status.mjs
```

Deploy and contracts scripts wait for conflicting checkouts by default. Conflict keys include `functions:<name>`, `functions:all`, `hosting:<target>`, `hosting:all`, and `build:contracts`.

Full function deploys (`deploy:functions`, `deploy:functions-hosting`, and `deploy:all`) are opportunistic: they skip functions that are already checked out and deploy the unchecked-out functions. If their follow-up hosting target is checked out, they skip that hosting deploy. Targeted deploys such as `--match=...`, `--start-at=...`, and direct hosting deploys still wait for their requested target.

### `deploy-missing-functions-and-hosting.mjs`
Diff-based deploy: compares local functions against currently deployed ones and deploys only those missing.
```sh
node scripts/deploy-missing-functions-and-hosting.mjs housing-db-v2 [--list-only] [--hosting] [--hosting-all] [--no-push]
```

### `reset-and-redeploy.mjs`
Nuclear option: deletes all Firebase functions, then redeploys from scratch. Use when function state is corrupted.
```sh
node scripts/reset-and-redeploy.mjs housing-db-v2 [--hosting] [--delete-hosting-ssr] [--hosting-only]
```

## Contracts

### `pack-contracts.mjs`
Builds the `contracts/` package and vendors the output into `functions/vendor/contracts` and `web/vendor/contracts`.
```sh
node scripts/pack-contracts.mjs
```
This script checks out `build:contracts` so concurrent builds/deploys wait while shared generated contract outputs are being rewritten.

### `update-contracts.mjs`
Rebuilds contracts with update semantics (preserves existing vendor structure, re-copies dist).
```sh
node scripts/update-contracts.mjs
```

### `set-functions-contracts-dep.mjs`
Pins `@hdb/contracts` to `file:vendor/contracts` in `functions/package.json`. Run after changing the contracts dep resolution strategy.
```sh
node scripts/set-functions-contracts-dep.mjs
```

## Data / Payments

### `close-past-payments.mjs`
Mark past-due enrollment payment rows closed. **Dry-run by default** — add `--apply --yes` to commit changes.
```sh
node scripts/close-past-payments.mjs [--apply --yes --project=housing-db-v2]
  [--before=2026-05-07]   # only payments with dueDate before this date
  [--orgId=HRDC_IX]       # filter to one org
  [--grantId=abc123]      # filter to one grant
  [--limit=50]            # stop after N enrollment docs scanned
  [--skip-paid]           # don't alter already-paid rows
  [--no-inbox]            # skip closing userTasks mirrors
```

### `close-past-credit-card-payments.mjs`
Audit and optionally close past CC `paymentQueue` items (source=credit-card, status not yet posted). **Dry-run by default.**
```sh
node scripts/close-past-credit-card-payments.mjs [--apply --yes --bypass-ledger]
```

### `jotform-pull-shape.mjs`
Fetches Jotform form shape/schema from the Jotform API. Requires `JOTFORM_API_KEY` env var.
```sh
node scripts/jotform-pull-shape.mjs --formId=<id>
```

## Tooling

### `fileTree.mjs`
Generates a file tree of the repo to `scripts/out/file-tree.json` and `scripts/out/file-tree.txt`.
```sh
node scripts/fileTree.mjs
```

### `dump-functions.mjs`
Dumps all TypeScript source files under `functions/src/` into a single `functions_dump.txt` in the repo root. Used for full-context LLM passes.
```sh
node scripts/dump-functions.mjs
```

## lib/

Internal helpers used by the scripts above:
- `lib/githubPush.mjs` — shared git push helper (auto-commit + push, used by deploy scripts)
- `lib/config.mjs` — loads `scripts/env.config` (gitignored)
- `lib/http.mjs` — minimal fetch wrapper
