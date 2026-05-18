# Node / Package Upgrade Changelog

Node baseline: **v24.15.0** (already installed locally)  
Started: 2026-05-18

---

## Milestones

| # | Status | Goal | Deploy-ready? |
|---|--------|------|---------------|
| M1 | ✅ Done (2026-05-18) | Safe minor/patch updates across all workspaces | ✅ Yes |
| M2 | ✅ Done (2026-05-18) | firebase-admin 12→13 + firebase-functions 6→7 in `functions/` | ✅ Yes |
| M3 | ⏳ Next | TypeScript 5→6 migration | ✅ Yes |
| M4 | 🔒 Blocked by M3 | Next.js 15→16 upgrade | ✅ Yes |
| M5 | 🔒 Blocked by M3 | ESLint 8→10 flat config (functions/) | ✅ Yes |

---

## M1 — Safe Minor/Patch Updates

**Goal**: Update all packages with no expected breaking changes. Deploy-ready after this step.

**Do NOT touch**: TypeScript 6, Next 16, ESLint 10, react-grid-layout 2.x, vitest 4.x (major versions — reserved for later milestones).

**Do NOT touch**: `functions/engines.node` — Firebase Cloud Functions does not yet support Node 24 runtime.

### Packages updated

| Package | Workspace | From | To | Notes |
|---------|-----------|------|----|-------|
| `zod` | contracts, functions, web | 4.3.5 | 4.4.3 | Minor |
| `firebase` (web SDK) | web | 12.7.0 | 12.13.0 | Minor |
| `firebase-admin` | root | 13.7.0 | 13.10.0 | Minor (root only — functions/ is M2) |
| `firebase-functions` | root | 7.1.0 | 7.2.5 | Minor (root only — functions/ is M2) |
| `@tanstack/react-query` | web | 5.90.16 | 5.100.10 | Minor |
| `tailwindcss` | web | 4.1.18 | 4.3.0 | Minor |
| `@tailwindcss/postcss` | web | 4.1.18 | 4.3.0 | Minor |
| `react-router-dom` | web | 7.12.0 | 7.15.1 | Minor |
| `next` | web | 15.5.12 | 15.5.18 | Patch only |
| `@types/node` | functions | 24.10.7 | 24.12.4 | Patch (stay on 24.x, not 25.x) |
| `@types/node` | web | 20.19.28 | 20.19.41 | Patch (stay on 20.x) |
| `@types/react` | web | 19.2.8 | 19.2.14 | Patch |
| `type-fest` | web | 5.4.0 | 5.6.0 | Minor |
| `react-rnd` | web | 10.5.2 | 10.5.3 | Patch |
| `@eslint/eslintrc` | web | 3.3.3 | 3.3.5 | Patch |
| `autoprefixer` | web | 10.4.23 | 10.5.0 | Minor |
| `firebase-functions-test` | functions | 3.4.1 | 3.5.0 | Minor |

### Deprecations found & fixed

_None found in M1 scope — all packages are minor/patch with no breaking changes._

### Build verification

- [x] `npm run build:contracts` — clean
- [x] `npm run build:functions` — clean
- [x] `npm run build:web` — clean (Next.js needed reinstall after Windows ENOTEMPTY during initial install; fixed by `rm -rf node_modules/next && npm install -w web`)

---

## M2 — Firebase Admin 12→13 + Functions 6→7 (functions/ workspace)

**Goal**: Align `functions/` firebase packages with root. Fixes protobufjs CVEs. Deploy-ready after.

**Status**: ✅ Done (2026-05-18)

### What changed

**functions/ packages**:
- `firebase-admin`: 12.7.0 → 13.10.0
- `firebase-functions`: 6.6.0 → 7.2.5

**Root packages** (were already on v13/v7 but bumped to latest):
- `firebase-admin`: 13.7.0 → 13.10.0
- `firebase-functions`: 7.1.0 → 7.2.5

### Deprecations found & fixed

| File | Old | New | Reason |
|------|-----|-----|--------|
| `features/jotform/triggers.ts` | `import { logger } from "firebase-functions"` | `import * as logger from "firebase-functions/logger"` | Bare root import is soft-deprecated; subpath is canonical |
| `features/paymentQueue/triggers.ts` | same | same | same |
| `features/budgetPipeline/triggers.ts` | same | same | same |

### Verified safe (no changes needed)

- `admin.appCheck().verifyToken()` in `core/http.ts` — namespace API still present in v13
- `import * as functions from "firebase-functions/v1"` in `users/triggers.ts` — v1 subpath still exported in v7 (auth.user().onCreate/onDelete have no v2 equivalent)
- `admin.firestore()`, `admin.auth()`, `admin.initializeApp()` in `core/admin.ts` — namespace API intact in v13

### CVE status

- Before: 22 vulnerabilities (9 low, 4 moderate, 8 high, 1 critical)
- After: 11 vulnerabilities (9 low, 2 moderate)
- Critical/high eliminated: protobufjs and uuid CVEs resolved by upgrading firebase-admin/functions
- Remaining 11 (low/moderate): postcss via Next.js — npm resolves these by installing `next@9.x` (wrong package, false positive); leave as-is

### Build verification

- [x] `npm run build:contracts` — clean
- [x] `npm run build:functions` — clean

---

## M3 — TypeScript 5→6 (future)

**Status**: 🔒 Blocked by M2

**Hold until M1+M2 are stable and deployed.**

### Known breaking changes in TS 6
- `--moduleResolution: node` removed → must use `bundler` or `nodenext`
- Legacy `--module: commonjs` + `--moduleResolution: node` combo no longer valid
- Stricter type narrowing (some `as` casts may need updating)
- `--importsNotUsedAsValues` removed (replaced by `verbatimModuleSyntax`)
- `--preserveValueImports` removed

### Files to update
- `functions/tsconfig.json`
- `web/tsconfig.json`
- `contracts/tsconfig.json` + `tsconfig.build.json`

---

## M4 — Next.js 15→16 (future)

**Status**: 🔒 Blocked by M2

**Hold until M1+M2 are stable and deployed.**

### Known breaking changes in Next 16
- TBD — research at time of upgrade

---

## M5 — ESLint 8→10 Flat Config in functions/ (future)

**Status**: 🔒 Blocked by M2

**Hold until M1+M2 are stable and deployed.**

### Known breaking changes
- `.eslintrc.*` config format removed — must migrate to `eslint.config.js` (flat config)
- `eslint-config-google` may not support flat config yet — may need replacement

---

## Node 24 Specific Notes

- **`engines.node` in functions/**: stays at `"22"` until Firebase Cloud Functions officially supports Node 24 runtime
- **Local dev**: Node 24.15.0 is fine for local builds/emulators
- **ESM/CJS**: `contracts/` uses dual ESM+CJS output via `tsup` — correct approach, no changes needed
- **protobufjs CVEs**: fixed by M2 (upgrading firebase-admin in functions/)
- **`@types/node`**: functions stays on `24.x`, web stays on `20.x` (matches Next.js peer requirements)
