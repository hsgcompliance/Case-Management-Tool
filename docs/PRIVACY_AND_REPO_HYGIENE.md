# Privacy And Repo Hygiene

This repo can safely contain source code, Firebase config, public client Firebase identifiers, rules, indexes, contracts, deploy scripts, generated code maps, and reviewed documentation.

Do not commit:

- `.env`, `.env.local`, or any real environment file
- service account JSON, OAuth credentials, refresh tokens, private keys, certificates, or pem/key files
- downloaded Google OAuth client files such as `client_secret_*.json`
- emulator imports/exports in `.emulator-data/`
- Firebase local cache in `.firebase/`
- production or migration harvests containing customer, grant, ledger, payment, Jotform, auth, or Drive data
- `archive/migration/artifacts/`
- script output in `scripts/out/`
- prompt scratchpads in `scripts/prompts/`
- local agent/editor settings such as `.claude/settings.local.json`
- test run artifacts like `web/test-results/`
- logs and debug output
- `.local-only.md` notes unless they have been reviewed, renamed, and explicitly unignored
- completed migration harvests, transformed outputs, field maps, and migration one-off scripts

## Local-Only Docs

Docs ending in `.local-only.md` are intentionally ignored. They may contain stale audits, private identifiers, specific form metadata, local process notes, or old implementation plans. Agents can read them as background context when working locally, but they are not authoritative and should not be pushed as-is.

To promote a local-only doc:

1. Review it for private IDs, customer/user/payment data, stale paths, credentials, and obsolete instructions.
2. Extract only durable guidance into a normal reviewed doc.
3. Rename the promoted file without `.local-only`.
4. Add an explicit `!docs/<name>.md` exception in `.gitignore`.
5. Update `docs/DOC_REVIEW.md`.

## Archive Folder

Treat `archive/` as high-risk by default. It may contain old migration tooling and historical notes. The current `.gitignore` excludes migration scripts, libs, and artifacts in the archive because they may reference old data shapes, local paths, or harvested data.

The completed V1 to V2 migration archive was removed from the working tree. Durable context was extracted to `docs/MIGRATION_HISTORY.md`.

Only commit archive material after reviewing it for:

- customer or user personally identifying information
- grant/payment/ledger records
- Jotform submission payloads
- Google Drive file or folder IDs that should not be public
- service account, OAuth, or API credentials
- Google OAuth client JSON downloads, including files named `client_secret_*.json`
- local machine paths that are not useful to future maintainers

## Graphify Outputs

`graphify-out/GRAPH_REPORT.md` is useful for future agents. `graphify-out/cache/` is ignored and should stay ignored. If regenerating `graphify-out/graph.json`, `graphify-out/graph.html`, or `manifest.json`, ensure the graph input excludes private/generated directories before committing.

## Before Pushing

Run:

```powershell
git status --short
git ls-files --others --ignored --exclude-standard
rg -n "(BEGIN .*KEY|PRIVATE KEY|client_secret|refresh_token|service_account|JOTFORM_API_KEY|GMAIL_CLIENT_SECRET|GOOGLE_OAUTH_CLIENT_SECRET|OAUTH_CLIENT_SECRET|SHEETS_BRIDGE_SHARED_SECRET)" -g "!node_modules" -g "!.git"
```

Public Firebase web config values beginning with `NEXT_PUBLIC_` are not secret by themselves. Real server-side secrets belong in Firebase secrets/params or environment-specific secret stores, never in source control.

Google OAuth credential boundary: `GMAIL_*` secrets are for the automated Gmail sender only. Drive and Calendar integrations use `GOOGLE_OAUTH_*` secrets. Do not reuse, copy, or document the secret values in repo docs; store them only in Secret Manager or a local credential manager.
