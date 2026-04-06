// functions/src/index.ts
// -----------------------------------------------------------------------------
// Firebase Functions v2 — single export surface
// Organized by domain: Diagnostics → Users → Inbox → Google Drive → Grants/Enrollments/Payments/Tasks → Customers/Acuity
// Note: keep paths extension-less for NodeNext/TS resolution.
// -----------------------------------------------------------------------------

// ── Diagnostics / Health  ──
export * from "./features/health/health";
// export * from "./features/status";

// ── Users (HTTP + Auth triggers) ──
export {createSession} from "./features/auth/createSession";
export * from "./features/users/http";
export { devOrgsList, devOrgsUpsert, devOrgsPatchTeams } from "./features/users/http";
export * from "./features/users/triggers";

//barrel exports
export * from "./features/inbox";
export * from "./features/gdrive";
export * from "./features/grants";
export * from "./features/enrollments";
export * from "./features/payments";
export * from "./features/ledger";
export * from "./features/tasks";
export * from "./features/customers";
export * from "./features/creditCards";
export * from "./features/assessments";
export * from "./features/jotform";
export * from "./features/paymentQueue";
export * from "./features/sheetsBridge";
export * from "./features/metrics";
export * from "./features/users";
export * from "./features/tours";
export * from "./features/orgs";
