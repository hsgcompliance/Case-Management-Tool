// functions/src/core/index.ts
// Central export hub for core backend utilities.
// New feature code should prefer importing from "./core" via this file,
// not from deep individual paths, unless you are inside core itself.

/* -------- Admin / Firestore -------- */

export { default as admin } from "./admin";
export {
  db,
  authAdmin,
  FieldValue,
  Timestamp,
  FieldPath,
  type DocId,
} from "./admin";

/* -------- Env / runtime -------- */

export {
  RUNTIME,
  ALLOWED_ORIGINS,
  ENFORCE_APP_CHECK,
  WEB_BASE_URL,
  GMAIL_SENDER,
  MAIL_FROM_NAME,
  GOOGLE_API_SCOPES,
  GOOGLE_DRIVE_AUTH_MODE,
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REFRESH_TOKEN,
  DRIVE_SANDBOX_FOLDER_ID,
  JOTFORM_API_KEY,
  JOTFORM_API_KEY_SECRET,
  SHEETS_BRIDGE_SHARED_SECRET,
  OAUTH_CLIENT_ID,
  OAUTH_CLIENT_SECRET,
  OAUTH_REFRESH_TOKEN,
} from "./env";

/* -------- HTTP / auth wiring -------- */

export { secureHandler, tryDecodeBearer } from "./http";
export { verifyUserFromRequest, requireUser } from "./auth";

/* -------- RBAC / roles / caps -------- */

export type { Claims, RoleLevel } from "./rbac";
export {
  // role ladder
  topRoleFromClaims,
  roleTagsFromClaims,
  rolesFromClaims,
  isAdmin,
  isDev,
  isOrgDev,
  isSuperDev,
  isUnverified,
  isVerified,
  isBlockedRole,
  // levels
  hasLevel,
  requireLevel,
  // caps
  capsFromClaims,
  requireCaps,
  // verification
  requireVerified,
} from "./rbac";

/* -------- Org / teams / access -------- */

export {
  orgIdFromClaims,
  teamIdsFromClaims,
  requireOrg,
  requireTeams,
  hasTeamAccess,
  requireTeamAccess,
} from "./org";

/* -------- Request context (Express + Claims) -------- */

export type { AuthContext, AuthedRequest } from "./requestContext";
export {
  buildAuthContext,
  attachAuthContext,
  getAuthContext,
  requireAuthContext,
  requireUid,
  getOrgId,
  requireOrgId,
  getTeamIds,
  canAccessDoc,
  assertOrgAccess,
  assertOrgAccessMaybe,
} from "./requestContext";

/* -------- Dates / time -------- */

export type { DateInput } from "./dates";
export {
  toDate,
  toUtcIso,
  toUtcMillis,
  toDateOnly,
  toMonthKey,
  addMonthsUtc,
  isWithinDateWindow,
  cursorFromTimestamp,
  cursorToTimestamp,
  fromUtcToLocal,
} from "./dates";

/* -------- Normalization helpers -------- */

export type { AnyScalar } from "./norm";
export { toStr, normStr, normId, normTok, uniqNorm } from "./norm";

/* -------- Security / sanitization -------- */

export {
  DEFAULTS as SECURITY_DEFAULTS,
  flagAdverseFields,
  truncateLongStrings,
  removeUndefinedDeep,
  sanitizeFlatObject,
  sanitizeNestedObject,
  stripReservedFields,
} from "./security";

/* -------- Transactions / idempotency -------- */

export { makeIdempoKey, withTxn, ensureIdempotent } from "./tx";

/* -------- Budget helpers -------- */

export { computeBudgetTotals } from "./budgetTotals";

/* -------- Misc utils --------  */

export { isoNow, deepMerge, addSubfield } from "./utils";
export { newBulkWriter } from "./bulkWriter"

/* -------- Zod re-export -------- */

export { z } from "./z";

/* -------- Legacy / deprecated helpers (namespaced) -------- */

// Legacy role helpers – do NOT use for new code.
// Access as: core.legacyRoles.isAdminLegacy(...) etc.
export * as legacyRoles from "./roles";

// Legacy tag builders – only used in old triggers.
// Access as: core.legacyTags.buildGrantTags(...)
export * as legacyTags from "./tags";
