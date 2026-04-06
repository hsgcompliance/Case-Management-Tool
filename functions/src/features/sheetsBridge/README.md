# Sheets Bridge

Backend scaffold for optional Google Sheets-based operational views.

Current endpoints:

- `sheetsBridgeManifest`
  - Returns the supported interfaces (`grants`, `grantLineItems`, `paymentQueue`)
  - Includes sheet names, primary keys, and editable column metadata

- `sheetsBridgePull`
  - Pulls row-shaped data for one interface
  - Intended for Apps Script to hydrate tabs in a spreadsheet UI

- `sheetsBridgePush`
  - Accepts typed mutation batches from Apps Script
  - Supports:
    - `grant.patch`
    - `grant.lineItem.upsert`
    - `grant.lineItem.delete`
    - `paymentQueue.patch`
    - `paymentQueue.post`
    - `paymentQueue.reopen`

Auth model:

- Uses a shared secret via `x-hdb-sheets-secret` or `Authorization: Bearer <secret>`
- Secret name: `SHEETS_BRIDGE_SHARED_SECRET`
- This avoids Firebase user auth/App Check requirements for Apps Script server-side calls

Suggested Apps Script flow:

1. Call `sheetsBridgeManifest` once to build tab configs.
2. Call `sheetsBridgePull` per tab to populate rows.
3. Track edited rows locally in the spreadsheet.
4. Convert edits into `sheetsBridgePush.operations[]`.
5. Use `dryRun: true` first, then send live changes.
