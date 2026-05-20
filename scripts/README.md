# scripts/

Node.js automation scripts for HDB v2. All scripts are ESM (`.mjs`) and run with `node scripts/<name>.mjs` from the repo root unless noted.

**Before writing a new script or doing a manual Firestore/deploy operation, check if one already exists here.**

## Deploy

### `deploy-functions-safe.mjs`
Chunked all-functions deploy. Avoids accidentally deleting extra deployed functions by deploying in batches.
```sh
node scripts/deploy-functions-safe.mjs housing-db-v2 [--list-only] [--no-push] [--start-at=<fn>] [--match='^(grants|customers)'] [--hosting]
```
- `--list-only` — preview chunks without deploying
- `--start-at=<fn>` — resume after a failed chunk
- `--match=<regex>` — deploy only matching functions
- `--hosting` — also deploy hosting after functions
- `--no-push` — skip GitHub push

### `deploy-hosting-safe.mjs`
Deploy Firebase Hosting only (skips functions).
```sh
node scripts/deploy-hosting-safe.mjs [--no-push]
```

### `deploy-missing-functions-and-hosting.mjs`
Diff-based deploy: compares local functions against currently deployed ones and deploys only those missing.
```sh
node scripts/deploy-missing-functions-and-hosting.mjs housing-db-v2 [--list-only] [--hosting] [--no-push]
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
