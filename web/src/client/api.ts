// web/src/client/api.ts
// Firebase Functions (Gen2, us-central1) client — Next.js-ready
// - Sends: Authorization, X-Firebase-AppCheck, X-Correlation-Id
// - GET caching with TTL; inflight coalescing
// - Idempotency-Key passthrough for retryable writes
// - Toast on error using server's { ok:false, error } contract
//
// ---------------------- IMPORTANT CONCEPT: strict vs loose ----------------------
//
// This client supports two "classes" of endpoints:
//
// 1) STRICT endpoints
//    - Present in EndpointMap (web/src/client/endpointmap.ts)
//    - Fully typed request + response
//    - If you change EndpointMap, TypeScript forces you to update the registry
//
// 2) LOOSE endpoints
//    - Exist at runtime, but are NOT in EndpointMap yet
//    - Treated as "unknown request" and "Ok<any> | Err" response
//    - This avoids fake confidence while contracts are still WIP
//
// Promotion path (loose -> strict):
//   a) Add the endpoint to EndpointMap (req/resp types)
//   b) Move its entry from endpointsLoose -> endpointsStrict
//   c) TypeScript will enforce consistency
//
// Why do this?
//   - Prevent drift between “what the backend does” and “what the frontend thinks it does”.
//   - Keep WIP endpoints usable without poisoning the type system.
// -----------------------------------------------------------------------------

import { auth, appCheck } from '@lib/firebase';
import { getToken as getAppCheckTokenMod, type AppCheckTokenResult } from 'firebase/app-check';
import { toast } from '@lib/toast';
import { noUndefined } from '@lib/safeData';
import { pending } from '@lib/pending';
import { stableStringify } from '@lib/stable';
import { shouldUseEmulators } from '@lib/runtimeEnv';
import { resolveFunctionsBase } from '@lib/functionsBase';
import { toMillisAny } from '@lib/date';
// Intentional exception: base API layer binds directly to contracts EndpointMap.
import type {
  Ok,
  Err,
  ApiResp,
  PaginatedResp,
  EndpointMap,
  EndpointName as ContractEndpointName,
  ReqOf,
  RespOf,
} from "@hdb/contracts";

export type {
  Ok,
  Err,
  ApiResp,
  PaginatedResp,
  EndpointMap,
  EndpointName as ContractEndpointName,
  ReqOf,
  RespOf,
} from "@hdb/contracts";
// ---------------- Types used across the client ----------------

type PendingKind = 'none' | 'api' | 'heavy' | 'route';
type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'OPTIONS';
type EndpointDef = { method: HttpMethod; path: string };

type LooseResp = Ok<any> | Err;

/**
 * Run options:
 * - For GET endpoints we use "query" (serialized to URL params)
 * - For non-GET endpoints we use "body" (JSON body)
 *
 * NOTE: We do not enforce GET-vs-body at the type level here because:
 * - The same endpoint can be called via call() which accepts both,
 * - And loose endpoints are intentionally permissive.
 * If you want the stricter GET/POST separation later, we can add it for strict endpoints only.
 */
export type RunOpts<TReq = unknown> = {
  query?: TReq;
  body?: TReq;
  headers?: Record<string, string>;
  validate?: (data: any) => void;
  idempotencyKey?: string;
  timeoutOverrideMs?: number;
  retriesOverride?: number;
  backoffOverrideMs?: number;
  noPending?: boolean;
  pendingKind?: PendingKind;
};

// ---------------- Endpoint Registry ----------------
//
// endpointsStrict: fully contracted, must exactly match EndpointMap keys.
// endpointsLoose: runtime endpoints that are not yet in EndpointMap.

type StrictRegistry = Record<ContractEndpointName, EndpointDef>;

export const endpointsStrict = {
  // USERS
  usersCreate:        { method: 'POST', path: 'usersCreate' },
  usersInvite:        { method: 'POST', path: 'usersInvite' },
  usersSetRole:       { method: 'POST', path: 'usersSetRole' },
  usersSetActive:     { method: 'POST', path: 'usersSetActive' },
  usersUpdateProfile: { method: 'POST', path: 'usersUpdateProfile' },
  usersResendInvite:  { method: 'POST', path: 'usersResendInvite' },
  usersRevokeSessions:{ method: 'POST', path: 'usersRevokeSessions' },
  usersList:          { method: 'GET',  path: 'usersList' },
  devOrgsList:        { method: 'GET',  path: 'devOrgsList' },
  devOrgsUpsert:      { method: 'POST', path: 'devOrgsUpsert' },
  devOrgsPatchTeams:  { method: 'POST', path: 'devOrgsPatchTeams' },
  usersMe:            { method: 'GET',  path: 'usersMe' },
  usersMeUpdate:      { method: 'POST', path: 'usersMeUpdate' },
  devGrantAdmin:      { method: 'POST', path: 'devGrantAdmin' },

  // ENROLLMENTS
  enrollmentsUpsert:  { method: 'POST',  path: 'enrollmentsUpsert' },
  enrollmentsPatch:   { method: 'PATCH', path: 'enrollmentsPatch' },
  enrollmentsList:    { method: 'GET',   path: 'enrollmentsList' },
  enrollmentGetById:  { method: 'GET',   path: 'enrollmentGetById' },
  enrollmentsDelete:  { method: 'POST',  path: 'enrollmentsDelete' },
  enrollmentsAdminDelete: { method: 'POST', path: 'enrollmentsAdminDelete' },
  enrollmentsEnrollCustomer: { method: 'POST', path: 'enrollmentsEnrollCustomer' },
  enrollmentsBulkEnroll: { method: 'POST', path: 'enrollmentsBulkEnroll' },
  enrollmentsCheckOverlaps: { method: 'POST', path: 'enrollmentsCheckOverlaps' },
  enrollmentsCheckDual: { method: 'POST', path: 'enrollmentsCheckDual' },
  enrollmentsBackfillNames: { method: 'POST', path: 'enrollmentsBackfillNames' },
  enrollmentsMigrate: { method: 'POST', path: 'enrollmentsMigrate' },
  enrollmentsUndoMigration: { method: 'POST', path: 'enrollmentsUndoMigration' },
  enrollmentsAdminReverseLedgerEntry: { method: 'POST', path: 'enrollmentsAdminReverseLedgerEntry' },

  // GRANTS
  grantsUpsert:       { method: 'POST',  path: 'grantsUpsert' },
  grantsPatch:        { method: 'PATCH', path: 'grantsPatch' },
  grantsDelete:       { method: 'POST',  path: 'grantsDelete' },
  grantsAdminDelete:  { method: 'POST',  path: 'grantsAdminDelete' },
  grantsList:         { method: 'GET',   path: 'grantsList' },
  grantsActivity:     { method: 'GET',   path: 'grantsActivity' },
  grantsStructure:    { method: 'GET',   path: 'grantsStructure' },
  grantsGet:          { method: 'GET',   path: 'grantsGet' },

  // JOTFORM
  jotformSubmissionsUpsert: { method: 'POST', path: 'jotformSubmissionsUpsert' },
  jotformSubmissionsPatch: { method: 'PATCH', path: 'jotformSubmissionsPatch' },
  jotformSubmissionsDelete: { method: 'POST', path: 'jotformSubmissionsDelete' },
  jotformSubmissionsAdminDelete: { method: 'POST', path: 'jotformSubmissionsAdminDelete' },
  jotformSubmissionsList: { method: 'GET', path: 'jotformSubmissionsList' },
  jotformSubmissionsGet: { method: 'GET', path: 'jotformSubmissionsGet' },
  jotformSubmissionsStructure: { method: 'GET', path: 'jotformSubmissionsStructure' },
  jotformFormsList: { method: 'GET', path: 'jotformFormsList' },
  jotformLinkSubmission: { method: 'POST', path: 'jotformLinkSubmission' },
  jotformSyncSelection: { method: 'POST', path: 'jotformSyncSelection' },
  jotformDigestUpsert: { method: 'POST', path: 'jotformDigestUpsert' },
  jotformDigestGet: { method: 'GET', path: 'jotformDigestGet' },
  jotformDigestList: { method: 'GET', path: 'jotformDigestList' },
  jotformSyncSubmissions: { method: 'POST', path: 'jotformSyncSubmissions' },
  jotformApiSubmissionsList: { method: 'GET', path: 'jotformApiSubmissionsList' },
  jotformApiSubmissionGet: { method: 'GET', path: 'jotformApiSubmissionGet' },

  // PAYMENTS
  paymentsGenerateProjections:   { method: 'POST', path: 'paymentsGenerateProjections' },
  paymentsUpsertProjections:     { method: 'POST', path: 'paymentsUpsertProjections' },
  paymentsBulkCopySchedule:      { method: 'POST', path: 'paymentsBulkCopySchedule' },
  paymentsSpend:                 { method: 'POST', path: 'paymentsSpend' },
  paymentsUpdateCompliance:      { method: 'POST', path: 'paymentsUpdateCompliance' },
  paymentsDeleteRows:            { method: 'POST', path: 'paymentsDeleteRows' },
  paymentsUpdateGrantBudget:     { method: 'POST', path: 'paymentsUpdateGrantBudget' },
  paymentsRecalcGrantProjected:  { method: 'POST', path: 'paymentsRecalcGrantProjected' },
  paymentsRecalculateFuture:     { method: 'POST', path: 'paymentsRecalculateFuture' },
  paymentsAdjustProjections:     { method: 'POST', path: 'paymentsAdjustProjections' },
  paymentsAdjustSpend:           { method: 'POST', path: 'paymentsAdjustSpend' },

  // TASKS
  tasksGenerateScheduleWrite:    { method: 'POST', path: 'tasksGenerateScheduleWrite' },
  tasksAssign:                   { method: 'POST', path: 'tasksAssign' },
  tasksUpdateFields:             { method: 'POST', path: 'tasksUpdateFields' },
  tasksUpdateStatus:             { method: 'POST', path: 'tasksUpdateStatus' },
  tasksDelete:                   { method: 'POST', path: 'tasksDelete' },
  tasksAdminRegenerateForGrant:  { method: 'POST', path: 'tasksAdminRegenerateForGrant' },

  tasksBulkStatus:               { method: 'POST', path: 'tasksBulkStatus' },
  tasksList:                     { method: 'POST', path: 'tasksList' },
  tasksReschedule:               { method: 'POST', path: 'tasksReschedule' },
  tasksUpsertManual:             { method: 'POST', path: 'tasksUpsertManual' },

  tasksOtherCreate:              { method: 'POST', path: 'tasksOtherCreate' },
  tasksOtherUpdate:              { method: 'POST', path: 'tasksOtherUpdate' },
  tasksOtherAssign:              { method: 'POST', path: 'tasksOtherAssign' },
  tasksOtherStatus:              { method: 'POST', path: 'tasksOtherStatus' },
  tasksOtherListMy:              { method: 'GET',  path: 'tasksOtherListMy' },


  // INBOX
  inboxListMy:                   { method: 'GET',  path: 'inboxListMy' },
  inboxMetricsMy:                { method: 'GET',  path: 'inboxMetricsMy' },
  inboxWorkloadList:             { method: 'GET',  path: 'inboxWorkloadList' },
  inboxSendInvite:               { method: 'POST', path: 'inboxSendInvite' },
  inboxSendMonthlySummary:       { method: 'POST', path: 'inboxSendMonthlySummary' },
  inboxDigestPreview:            { method: 'GET',  path: 'inboxDigestPreview' },
  inboxSendDigestNow:            { method: 'POST', path: 'inboxSendDigestNow' },
  inboxScheduleDigest:           { method: 'POST', path: 'inboxScheduleDigest' },

  // INTEGRATIONS — Drive
  gdriveList:                    { method: 'GET',  path: 'gdriveList' },
  gdriveCustomerFolderIndex:     { method: 'GET',  path: 'gdriveCustomerFolderIndex' },
  gdriveCreateFolder:            { method: 'POST', path: 'gdriveCreateFolder' },
  gdriveUpload:                  { method: 'POST', path: 'gdriveUpload' },
  gdriveBuildCustomerFolder:     { method: 'POST', path: 'gdriveBuildCustomerFolder' },
  gdriveConfigGet:               { method: 'GET',  path: 'gdriveConfigGet' },
  gdriveConfigPatch:             { method: 'POST', path: 'gdriveConfigPatch' },

  // CUSTOMERS
  customersUpsert:               { method: 'POST',  path: 'customersUpsert' },
  customersPatch:                { method: 'PATCH', path: 'customersPatch' },
  customersDelete:               { method: 'POST',  path: 'customersDelete' },
  customersAdminDelete:          { method: 'POST',  path: 'customersAdminDelete' },
  customersGet:                  { method: 'GET',   path: 'customersGet' },
  customersList:                 { method: 'GET',   path: 'customersList' },
  customersBackfillNames:        { method: 'POST',  path: 'customersBackfillNames' },
  customersBackfillCaseManagerNames: { method: 'POST', path: 'customersBackfillCaseManagerNames' },
  customersBackfillAssistanceLength: { method: 'POST', path: 'customersBackfillAssistanceLength' },

  // CREDIT CARDS
  creditCardsUpsert:             { method: 'POST',  path: 'creditCardsUpsert' },
  creditCardsPatch:              { method: 'PATCH', path: 'creditCardsPatch' },
  creditCardsDelete:             { method: 'POST',  path: 'creditCardsDelete' },
  creditCardsAdminDelete:        { method: 'POST',  path: 'creditCardsAdminDelete' },
  creditCardsList:               { method: 'GET',   path: 'creditCardsList' },
  creditCardsGet:                { method: 'GET',   path: 'creditCardsGet' },
  creditCardsStructure:          { method: 'GET',   path: 'creditCardsStructure' },
  creditCardsSummary:            { method: 'GET',   path: 'creditCardsSummary' },

  // LEDGER
  ledgerList:                    { method: 'GET',    path: 'ledgerList' },
  ledgerCreate:                  { method: 'POST',   path: 'ledgerCreate' },
  ledgerClassify:                { method: 'POST',   path: 'ledgerClassify' },
  ledgerAutoAssign:              { method: 'POST',   path: 'ledgerAutoAssign' },
  ledgerGetById:                 { method: 'GET',    path: 'ledgerGetById' },
  ledgerBalance:                 { method: 'GET',    path: 'ledgerBalance' },
  ledgerDelete:                  { method: 'DELETE', path: 'ledgerDelete' },

  // ASSESSMENTS (templates + submissions)
  assessmentTemplatesUpsert:     { method: 'POST', path: 'assessmentTemplatesUpsert' },
  assessmentTemplatesGet:        { method: 'GET',  path: 'assessmentTemplatesGet' },
  assessmentTemplatesList:       { method: 'POST', path: 'assessmentTemplatesList' },
  assessmentTemplatesDelete:     { method: 'POST', path: 'assessmentTemplatesDelete' },

  assessmentSubmit:              { method: 'POST', path: 'assessmentSubmit' },
  assessmentSubmissionGet:       { method: 'GET',  path: 'assessmentSubmissionGet' },
  assessmentSubmissionsList:     { method: 'POST', path: 'assessmentSubmissionsList' },
  assessmentPushAnswer:          { method: 'POST', path: 'assessmentPushAnswer' },
  assessmentOpenReassessment:    { method: 'POST', path: 'assessmentOpenReassessment' },
  assessmentTemplateVersionsList: { method: 'GET', path: 'assessmentTemplateVersionsList' },
  assessmentTemplateRecalc:      { method: 'POST', path: 'assessmentTemplateRecalc' },

  // TOURS
  toursUpsert:                   { method: 'POST',  path: 'toursUpsert' },
  toursPatch:                    { method: 'PATCH', path: 'toursPatch' },
  toursDelete:                   { method: 'POST',  path: 'toursDelete' },
  toursAdminDelete:              { method: 'POST',  path: 'toursAdminDelete' },
  toursList:                     { method: 'GET',   path: 'toursList' },
  toursGet:                      { method: 'GET',   path: 'toursGet' },
  toursStructure:                { method: 'GET',   path: 'toursStructure' },

  // OTHER
  createSession:                 { method: 'POST', path: 'createSession' },
  health:                        { method: 'GET',  path: 'health' },
} as const satisfies StrictRegistry;

// LOOSE endpoints: NOT in EndpointMap yet.
export const endpointsLoose = {
  // ENROLLMENTS (deployed aliases / utilities not promoted into contracts yet)
  adminReverseLedgerEntry:   { method: 'POST', path: 'adminReverseLedgerEntry' },
  enrollmentsBackfillPopulation: { method: 'POST', path: 'enrollmentsBackfillPopulation' },
  undoEnrollmentMigration:   { method: 'POST', path: 'undoEnrollmentMigration' },

  // ENROLLMENTS (legacy alias; canonical strict key is enrollmentsMigrate)
  migrateEnrollment:         { method: 'POST',  path: 'migrateEnrollment' },

  // CUSTOMERS (legacy alias; canonical strict key is customersGet)
  customerGet:                   { method: 'GET',  path: 'customerGet' },

  // ORGS
  orgGet:                       { method: 'GET',  path: 'orgGet' },
  orgConfigGet:                 { method: 'GET',  path: 'orgConfigGet' },
  orgConfigPatch:               { method: 'POST', path: 'orgConfigPatch' },
  orgCreate:                    { method: 'POST', path: 'orgCreate' },
  orgDelete:                    { method: 'POST', path: 'orgDelete' },

  // DIGEST SUBSCRIPTIONS + PREVIEW
  inboxDigestSubsGet:           { method: 'GET',  path: 'inboxDigestSubsGet' },
  inboxDigestSubUpdate:         { method: 'POST', path: 'inboxDigestSubUpdate' },
  inboxDigestHtmlPreview:       { method: 'GET',  path: 'inboxDigestHtmlPreview' },

  // PAYMENT QUEUE (runtime endpoints not promoted into contracts yet)
  paymentQueueList:             { method: 'GET',   path: 'paymentQueueList' },
  paymentQueueGet:              { method: 'GET',   path: 'paymentQueueGet' },
  paymentQueuePatch:            { method: 'PATCH', path: 'paymentQueuePatch' },
  paymentQueuePostToLedger:     { method: 'POST',  path: 'paymentQueuePostToLedger' },
  paymentQueueReopen:           { method: 'POST',  path: 'paymentQueueReopen' },
  paymentQueueVoid:             { method: 'POST',  path: 'paymentQueueVoid' },
  paymentQueueRecomputeGrantAllocations: { method: 'POST', path: 'paymentQueueRecomputeGrantAllocations' },

  // DRIVE (runtime admin tooling)
  gdriveCustomerFolderSync:     { method: 'POST',  path: 'gdriveCustomerFolderSync' },

} as const satisfies Record<string, EndpointDef>;

// Merge for runtime usage (same behavior as before: one endpoints object).
export const endpoints = { ...endpointsStrict, ...endpointsLoose } as const;

// ---------------- Compile-time safety rails ----------------
//
// 1) No overlapping keys between strict and loose (prevents silent runtime overrides)
type _Overlap = Extract<keyof typeof endpointsStrict, keyof typeof endpointsLoose>;
type _NoOverlap = _Overlap extends never ? true : never;
const _noOverlap: _NoOverlap = true;

// 2) Strict endpoints must be EXACTLY the EndpointMap keys (no extras)
type _StrictExtras = Exclude<keyof typeof endpointsStrict, keyof EndpointMap>;
type _StrictExact = _StrictExtras extends never ? true : never;
const _strictExact: _StrictExact = true;
type _StrictMissing = Exclude<keyof EndpointMap, keyof typeof endpointsStrict>;
type _StrictComplete = _StrictMissing extends never ? true : never;
const _strictComplete: _StrictComplete = true;

// ---------------- Public endpoint name types ----------------
/**
 * StrictEndpointName:
 * - what your app SHOULD prefer
 * - fully typed (req/resp)
 */
export type StrictEndpointName = ContractEndpointName;

/**
 * LooseEndpointName:
 * - usable, but intentionally untrusted typing
 * - promote to strict once EndpointMap is updated
 */
export type LooseEndpointName = keyof typeof endpointsLoose
export type EndpointName = StrictEndpointName | LooseEndpointName;

/**
 * Some write endpoints are "heavy" (they may trigger overlays/spinners).
 * This is purely UI/UX; does not affect network logic.
 */
export const HEAVY_WRITE_ENDPOINTS = new Set<EndpointName>([
  'migrateEnrollment',
  'enrollmentsMigrate',
  'tasksGenerateScheduleWrite',
  'enrollmentsBulkEnroll',
  'paymentsRecalculateFuture',
  'paymentsBulkCopySchedule',
  'paymentsAdjustSpend',
  'paymentsDeleteRows',
  'paymentsAdjustProjections',
  'assessmentTemplateRecalc',
  'jotformSyncSelection',
  'jotformSyncSubmissions',
]);

// ---------------- API surface (readable overloads) ----------------

export interface Api {
  get<N extends StrictEndpointName>(name: N, query?: ReqOf<N>): Promise<RespOf<N>>;
  post<N extends StrictEndpointName>(name: N, body?: ReqOf<N>): Promise<RespOf<N>>;
  call<N extends StrictEndpointName>(name: N, opts?: RunOpts<ReqOf<N>>): Promise<RespOf<N>>;
  getWith<N extends StrictEndpointName>(name: N, q?: ReqOf<N>, headers?: Record<string, string>): Promise<RespOf<N>>;
  postWith<N extends StrictEndpointName>(name: N, b?: ReqOf<N>, headers?: Record<string, string>): Promise<RespOf<N>>;
  callWith<N extends StrictEndpointName>(name: N, opts: RunOpts<ReqOf<N>>): Promise<RespOf<N>>;
  callIdem<N extends StrictEndpointName>(name: N, body: ReqOf<N>, key?: string): Promise<RespOf<N>>;

  // Loose is explicit and quarantined
  get<N extends LooseEndpointName>(name: N, query?: unknown): Promise<LooseResp>;
  post<N extends LooseEndpointName>(name: N, body?: unknown): Promise<LooseResp>;
  call<N extends LooseEndpointName>(name: N, opts?: RunOpts<unknown>): Promise<LooseResp>;
  getWith<N extends LooseEndpointName>(name: N, q?: unknown, headers?: Record<string, string>): Promise<LooseResp>;
  postWith<N extends LooseEndpointName>(name: N, b?: unknown, headers?: Record<string, string>): Promise<LooseResp>;
  callWith<N extends LooseEndpointName>(name: N, opts: RunOpts<unknown>): Promise<LooseResp>;
  callIdem<N extends LooseEndpointName>(name: N, body: unknown, key?: string): Promise<LooseResp>;

  bustCache(name: EndpointName, query?: Record<string, unknown>): boolean;
  resetAuthToken(): void;
}

// ---------------- Base URL (Next-first, Emulator fallback) ----------------

const REGION  = process.env.NEXT_PUBLIC_FUNCTIONS_REGION ?? 'us-central1';
const PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'housing-db-v2';
const USE_EMULATORS = shouldUseEmulators();

const RAW_BASE = resolveFunctionsBase();

const BASE = RAW_BASE.replace(/\/+$/, '');
const REAUTH_STORAGE_KEY = '__hdb_reauth_in_progress__';

function toUrl(base: string, path: string) {
  const normalizedPath = String(path).replace(/^\/+/, '');
  const b = String(base || '').trim();

  // absolute base? use as-is
  if (/^https?:\/\//i.test(b)) {
    return new URL(`${b.replace(/\/+$/, '')}/${normalizedPath}`);
  }

  // relative base (e.g. "/__api") -> resolve against current origin
  const basePath = b ? (b.startsWith('/') ? b : `/${b}`) : '';
  const href = `${basePath.replace(/\/+$/, '')}/${normalizedPath}`;
  const origin =
    (typeof window !== 'undefined' && window.location?.origin)
      ? window.location.origin
      : 'http://localhost'; // harmless fallback for SSR
  return new URL(href, origin);
}

// ---------------- Factory ----------------

type CreateApiOptions = {
  base?: string;
  getIdToken?: () => Promise<string | null>;
  getAppCheckToken?: () => Promise<AppCheckTokenResult | null>;
  timeoutMs?: number;
  retries?: number;
  backoffMs?: number;
  getCacheTtlMs?: (name: string, method: HttpMethod) => number;
  onError?: (e: any) => void;
  isHeavy?: (name: EndpointName) => boolean;
};

function extractBackendErrorMessage(input: unknown): string | null {
  const seen = new Set<unknown>();

  const walk = (v: unknown): string | null => {
    if (v == null) return null;
    if (typeof v === "string") {
      const s = v.trim();
      return s || null;
    }
    if (typeof v === "number" || typeof v === "boolean") {
      return String(v);
    }
    if (typeof v !== "object") return null;
    if (seen.has(v)) return null;
    seen.add(v);

    if (Array.isArray(v)) {
      const msgs = v.map(walk).filter(Boolean) as string[];
      return msgs.length ? msgs.join(" | ") : null;
    }

    const o = v as Record<string, unknown>;
    const directKeys = ["error", "message", "msg", "detail", "reason", "description"] as const;
    for (const k of directKeys) {
      const msg = walk(o[k]);
      if (msg) return msg;
    }

    // common wrapper shapes
    for (const k of ["response", "data", "body", "meta", "cause", "details"]) {
      const msg = walk(o[k]);
      if (msg) return msg;
    }

    return null;
  };

  return walk(input);
}

function isFirestoreTimestampLike(value: unknown): value is {
  toMillis?: () => number;
  seconds?: number;
  _seconds?: number;
  nanoseconds?: number;
  _nanoseconds?: number;
} {
  if (!value || typeof value !== "object") return false;
  const maybe = value as Record<string, unknown>;
  return (
    typeof maybe.toMillis === "function" ||
    maybe.seconds !== undefined ||
    maybe._seconds !== undefined
  );
}

function serializeQueryParamValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "true" : "false";

  if (isFirestoreTimestampLike(value)) {
    const ms = toMillisAny(value);
    if (Number.isFinite(ms)) return String(ms);
  }

  return String(value);
}

export function createApi({
  base = BASE,
  getIdToken = async () => (auth.currentUser ? auth.currentUser.getIdToken() : null),
  getAppCheckToken = async () => (appCheck ? getAppCheckTokenMod(appCheck) : null),
  timeoutMs = 15000,
  retries = 2,
  backoffMs = 300,
  getCacheTtlMs,
  onError = (e: any) => {
    const s = e?.meta?.status;
    const fn = String(e?.meta?.name || "").trim();
    const msg = extractBackendErrorMessage(e?.meta?.response) || extractBackendErrorMessage(e);
    const label = fn ? `[${fn}] ` : "";
    if (s === 401) toast(`${label}${msg || 'Session expired. Please sign in.'}`, { type: 'error' });
    else if (s) toast(`${label}${msg || `Request failed (HTTP ${s}).`}`, { type: 'error' });
    else toast(`${label}${msg || 'Request failed. Try again.'}`, { type: 'error' });
    console.warn('[api]', e);
  },
  isHeavy = (name: EndpointName) => HEAVY_WRITE_ENDPOINTS.has(name),
}: CreateApiOptions = {}): Api {
  const genCorr = () =>
    (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));

  // ---- Token cache (collapses concurrent fetches) ----
  const tokenCache: { value: string | null; expires: number; inflight: Promise<string | null> | null } = {
    value: null, expires: 0, inflight: null,
  };

  function resetAuthToken() {
    tokenCache.value = null;
    tokenCache.expires = 0;
  }

  function normalizeErrorCode(v: unknown): string {
    return String(v ?? '').trim().toLowerCase();
  }

  function isAuthFailureStatus(status: number) {
    return status === 401 || status === 403;
  }

  function isAuthFailure(respStatus: number, responseData: any): boolean {
    if (!isAuthFailureStatus(respStatus)) return false;
    const code = normalizeErrorCode(
      responseData?.error ??
      responseData?.code ??
      responseData?.message
    );
    if (!code) return respStatus === 401;
    return (
      code.includes('unauthenticated') ||
      code.includes('token_revoked') ||
      code.includes('id-token-expired') ||
      code.includes('appcheck_failed') ||
      code.includes('auth')
    );
  }

  async function forceFreshAuthTokens() {
    resetAuthToken();
    try { await auth.currentUser?.getIdToken(true); } catch {}
    if (appCheck) {
      try {
        const { getToken } = await import('firebase/app-check');
        await getToken(appCheck, /* forceRefresh */ true);
      } catch {
        /* best effort */
      }
    }
  }

  async function requireFullLogin(reason: string) {
    resetAuthToken();
    if (typeof window === 'undefined') return;
    if (window.sessionStorage.getItem(REAUTH_STORAGE_KEY) === '1') return;
    window.sessionStorage.setItem(REAUTH_STORAGE_KEY, '1');

    try {
      const { signOut } = await import('firebase/auth');
      await signOut(auth);
    } catch {
      /* fallback is redirect */
    }

    const next = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
    const why = encodeURIComponent(reason || 'session_expired');
    window.location.assign(`/login?next=${next}&reason=${why}`);
  }

  function clearReauthMarker() {
    if (typeof window === 'undefined') return;
    try { window.sessionStorage.removeItem(REAUTH_STORAGE_KEY); } catch {}
  }

  async function getCachedToken(): Promise<string | null> {
    if (tokenCache.inflight) return tokenCache.inflight;
    const now = Date.now();
    if (tokenCache.value && tokenCache.expires > now) return tokenCache.value;

    tokenCache.inflight = (async () => {
      const tok = await getIdToken();
      tokenCache.value = tok ?? null;
      tokenCache.expires = now + 50 * 60 * 1000; // ~50m
      return tok;
    })().finally(() => { tokenCache.inflight = null; });

    return tokenCache.inflight;
  }

  // ---- Simple GET cache ----
  const cache = new Map<string, { exp: number; data: any }>();
  const cacheKey = (name: string, query: any) => `${name}:${stableStringify(query || {})}`;

  const defaultCacheTtlMs = (name: string, method: HttpMethod) => {
    if (method !== 'GET') return 0;
    if (name === 'tasksOtherListMy') return 0;
    if (['enrollmentGetById'].includes(name)) return 60_000;
    if (['enrollmentsList', 'usersList', 'customersList'].includes(name)) return 600_000;
    if (['grantsList', 'grantsStructure'].includes(name)) return 300_000;
    return 10_000;
  };

  const cacheTtl = (name: string, method: HttpMethod) =>
    (getCacheTtlMs ? getCacheTtlMs(name, method) : defaultCacheTtlMs(name, method));

  // ---- Inflight coalescing ----
  const inflight = new Map<string, Promise<any>>();
  let __loggedOnce = false;

  async function buildHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Correlation-Id': genCorr(),
    };

    const idTok = await getCachedToken();
    if (idTok) headers.Authorization = `Bearer ${String(idTok).trim()}`;

    if (getAppCheckToken) {
      try {
        const appTok = await getAppCheckToken();
        const tokenStr = typeof appTok === 'string' ? appTok : (appTok as any)?.token;
        if (tokenStr) headers['X-Firebase-AppCheck'] = String(tokenStr).trim();
      } catch {
        /* best effort */
      }
    }

    if (!__loggedOnce && typeof window !== 'undefined') {
      __loggedOnce = true;
      console.info('[HDB] Functions base:', base);
      console.info('[HDB] Auth header present:', !!headers.Authorization, 'uid:', auth.currentUser?.uid || '(none)');
      console.info('[HDB] AppCheck header present:', !!headers['X-Firebase-AppCheck']);
    }

    return headers;
  }

  // --- run() overloads (typing only) ---
  function run<N extends StrictEndpointName>(name: N, opts?: RunOpts<ReqOf<N>>): Promise<RespOf<N>>;
  function run<N extends LooseEndpointName>(name: N, opts?: RunOpts<unknown>): Promise<LooseResp>;

  // --- implementation (single runtime body) ---
  async function run(name: EndpointName, opts: RunOpts<any> = {}): Promise<any> {
    const def = endpoints[name];
    if (!def) throw new Error(`Unknown endpoint: ${name}`);

    const method = def.method as HttpMethod;
    const { path } = def;

    const {
      query,
      body,
      validate,
      headers: extraHeaders,
      idempotencyKey,
      timeoutOverrideMs,
      retriesOverride,
      backoffOverrideMs,
      noPending,
      pendingKind,
    } = opts;

    // GET cache
    const ttl = cacheTtl(name, method);
    const ck = method === 'GET' ? cacheKey(name, query) : null;
    if (ck && ttl > 0) {
      const cached = cache.get(ck);
      if (cached && cached.exp > Date.now()) return cached.data;
    }

    const url = toUrl(base, path);

    // Query serialization. Some POST/PATCH endpoints use query params for
    // resource ids and the JSON body for the mutation payload.
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v == null) continue;
        if (Array.isArray(v)) {
          for (const item of v) url.searchParams.append(k, serializeQueryParamValue(item));
        } else {
          url.searchParams.set(k, serializeQueryParamValue(v));
        }
      }
    }

    const hdrs = await buildHeaders();
    if (idempotencyKey) hdrs['Idempotency-Key'] = idempotencyKey;

    const init: RequestInit = { method, headers: { ...hdrs, ...(extraHeaders || {}) } };

    if (method !== 'GET') {
      (init.headers as any)['Content-Type'] = 'application/json';
      const bodyClean = body === undefined ? {} : noUndefined(body);
      init.body = JSON.stringify(bodyClean);
    }

    // Decide pending kind (UI only)
    let kind: PendingKind = 'none';
    if (pendingKind && pendingKind !== 'none') {
      kind = pendingKind;
    } else if (method !== 'GET' && isHeavy(name)) {
      kind = 'heavy';
    }

    const effTimeout = timeoutOverrideMs ?? timeoutMs;
    const effRetries = retriesOverride ?? retries;
    const effBackoff = backoffOverrideMs ?? backoffMs;

    let attempt = 0;
    let retriedAuth = false;
    const startedAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());

    const stopPending =
      (!noPending && kind !== 'none')
        ? pending.start(kind === 'heavy' ? 'heavy' : 'api', {
            delayMs: kind === 'heavy' ? 150 : 250,
          })
        : () => {};

    try {
      const inflightKey =
        `${name}:${method}:${path}` +
        `:q=${stableStringify(query || {})}` +
        `:b=${stableStringify(body || {})}` +
        `:idem=${String((init.headers as any)['Idempotency-Key'] || '')}`;

      const existing = inflight.get(inflightKey);
      if (existing) return await existing;

      const work = (async (): Promise<any> => {
        const exec = async (): Promise<any> => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), effTimeout);

          try {
            const resp = await fetch(url.toString(), { ...init, signal: controller.signal });

            // 204 -> return empty object for stable shapes
            if (resp.status === 204) return {};

            const ct = resp.headers.get('content-type') || '';
            let data: any;

            if (ct.includes('application/json')) {
              try { data = await resp.json(); } catch { data = {}; }
            } else {
              data = await resp.text();
            }

            if (!resp.ok) {
              const retryableStatus = resp.status === 429 || (resp.status >= 500 && resp.status < 600);
              const canRetry =
                (attempt < effRetries) &&
                retryableStatus &&
                (method === 'GET' || !!idempotencyKey);

              const authFailure = isAuthFailure(resp.status, data);

              if (!retriedAuth && authFailure) {
                retriedAuth = true;
                await forceFreshAuthTokens();
                return exec();
              }

              if (retriedAuth && authFailure) {
                await requireFullLogin(normalizeErrorCode(data?.error || data?.message || 'session_expired'));
              }

              if (canRetry) {
                attempt++;
                await new Promise(r => setTimeout(r, Math.round(effBackoff * 2 ** (attempt - 1) * (0.5 + Math.random()))));
                return exec();
              }

              let errData = data;
              if (ct.includes('application/json') && typeof data !== 'object') {
                try { errData = JSON.parse(String(data || '{}')); } catch {}
              }

              if (data && typeof data === "object" && data.ok === false) {
                const err: any = new Error(data.error || "Request failed");
                err.meta = {
                  name,
                  status: resp.status,
                  durationMs: Math.round(((typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt)),
                  request: { query, body },
                  response: data,
                };
                throw err;
              }

              const extractedMsg = extractBackendErrorMessage(errData) || `HTTP ${resp.status}`;
              const err: any = new Error(extractedMsg);
              err.meta = {
                name,
                status: resp.status,
                durationMs: Math.round(((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt)),
                request: { query, body },
                response: errData,
              };
              throw err;
            }

            if (data && typeof data === "object" && (data as any).ok === false) {
              const err: any = new Error((data as any).error || "Request failed");
              err.meta = {
                name,
                status: resp.status,
                durationMs: Math.round(((typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt)),
                request: { query, body },
                response: data,
              };
              throw err;
            }

            clearReauthMarker();
            if (validate) validate(data);
            if (ck && ttl > 0) cache.set(ck, { exp: Date.now() + ttl, data });
            return data;
          } catch (e: any) {
            const timedOut = e?.name === 'AbortError' || e?.message === 'timeout';
            const canRetry = timedOut && attempt < effRetries && (method === 'GET' || !!idempotencyKey);

            if (canRetry) {
              attempt++;
              await new Promise(r => setTimeout(r, Math.round(effBackoff * 2 ** (attempt - 1) * (0.5 + Math.random()))));
              return exec();
            }

            if (!e.meta) {
              e.meta = {
                name,
                status: -1,
                durationMs: Math.round(((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt)),
                request: { query, body },
                response: { error: e?.message || 'request_failed' },
              };
            }

            throw e;
          } finally {
            clearTimeout(timer);
          }
        };


        return await exec();
      })();

      inflight.set(inflightKey, work);
      try {
        return await work;
      } finally {
        inflight.delete(inflightKey);
      }
    } catch (err: any) {
      onError(err);
      throw err;
    } finally {
      stopPending();
    }
  }

  // Wrapper overloads: readable, and callers get strict typing automatically.
  function get<N extends StrictEndpointName>(name: N, query?: EndpointMap[N]['req']): Promise<EndpointMap[N]['resp']>;
  function get<N extends LooseEndpointName>(name: N, query?: unknown): Promise<LooseResp>;
  function get(name: any, query?: any) {
    return run(name, { query });
  }

  function post<N extends StrictEndpointName>(name: N, body?: EndpointMap[N]['req']): Promise<EndpointMap[N]['resp']>;
  function post<N extends LooseEndpointName>(name: N, body?: unknown): Promise<LooseResp>;
  function post(name: any, body?: any) {
    return run(name, { body });
  }

  function call<N extends StrictEndpointName>(name: N, opts?: RunOpts<EndpointMap[N]['req']>): Promise<EndpointMap[N]['resp']>;
  function call<N extends LooseEndpointName>(name: N, opts?: RunOpts<unknown>): Promise<LooseResp>;
  function call(name: any, opts: RunOpts<any> = {}) {
    return run(name, opts);
  }

  function getWith<N extends StrictEndpointName>(name: N, q?: EndpointMap[N]['req'], headers?: Record<string, string>): Promise<EndpointMap[N]['resp']>;
  function getWith<N extends LooseEndpointName>(name: N, q?: unknown, headers?: Record<string, string>): Promise<LooseResp>;
  function getWith(name: any, q?: any, headers?: Record<string, string>) {
    return run(name, { query: q, headers });
  }

  function postWith<N extends StrictEndpointName>(name: N, b?: EndpointMap[N]['req'], headers?: Record<string, string>): Promise<EndpointMap[N]['resp']>;
  function postWith<N extends LooseEndpointName>(name: N, b?: unknown, headers?: Record<string, string>): Promise<LooseResp>;
  function postWith(name: any, b?: any, headers?: Record<string, string>) {
    return run(name, { body: b, headers });
  }

  function callWith<N extends StrictEndpointName>(name: N, opts: RunOpts<EndpointMap[N]['req']>): Promise<EndpointMap[N]['resp']>;
  function callWith<N extends LooseEndpointName>(name: N, opts: RunOpts<unknown>): Promise<LooseResp>;
  function callWith(name: any, opts: RunOpts<any>) {
    return run(name, opts);
  }

  function callIdem<N extends StrictEndpointName>(name: N, body: EndpointMap[N]['req'], key?: string): Promise<EndpointMap[N]['resp']>;
  function callIdem<N extends LooseEndpointName>(name: N, body: unknown, key?: string): Promise<LooseResp>;
  function callIdem(name: any, body: any, key?: string) {
    return run(name, {
      body,
      idempotencyKey: key || (crypto as any)?.randomUUID?.() || String(Date.now()),
    });
  }

  return {
    get,
    post,
    call,
    getWith,
    postWith,
    callWith,
    callIdem,
    bustCache: (name, query = {}) => cache.delete(cacheKey(name, query)),
    resetAuthToken,
  };
}

// Singleton
export const api: Api = createApi({
  getIdToken: async () => (auth.currentUser ? auth.currentUser.getIdToken() : null),
  getAppCheckToken: async () => {
    if (!appCheck) return null;
    for (let i = 0; i < 4; i++) {
      try {
        const t = await getAppCheckTokenMod(appCheck);
        if (t?.token) return t;
      } catch {}
      await new Promise(r => setTimeout(r, 150 * (i + 1)));
    }
    return null;
  },
  getCacheTtlMs: () => 0,
  onError: (e: any) => {
    const s = e?.meta?.status;
    const fn = String(e?.meta?.name || "").trim();
    const msg = extractBackendErrorMessage(e?.meta?.response) || extractBackendErrorMessage(e);
    const label = fn ? `[${fn}] ` : "";
    if (s === 401) toast(`${label}${msg || 'Session expired. Please sign in.'}`, { type: 'error' });
    else if (s) toast(`${label}${msg || `Request failed (HTTP ${s}).`}`, { type: 'error' });
    else toast(`${label}${msg || 'Request failed. Try again.'}`, { type: 'error' });
    console.warn('[api]', e);
  },
});

export default api;

// -----------------------------------------------------------------------------
// Pagination helpers
// -----------------------------------------------------------------------------
//
// These helpers are intentionally "loose" because they are generic across many endpoints.
// If you want strict typing for a specific endpoint, call api.get(...) directly and
// use the exact EndpointMap response type.
// -----------------------------------------------------------------------------

export async function listPage<N extends EndpointName, T = unknown>(
  name: N,
  { limit = 50, cursor, ...filters }: { limit?: number; cursor?: any } & Record<string, unknown> = {}
): Promise<{ items?: T[]; next?: any } | T[]> {
  const def = (endpoints as any)[name] as { method?: string } | undefined;
  const payload = { limit, cursor, ...filters } as any;
  // Avoid silently calling GET for POST-based list endpoints.
  if (def?.method === 'GET') return api.get(name as any, payload);
  return api.post(name as any, payload);
}

export async function listAll<N extends EndpointName, T = unknown>(
  name: N,
  params: Record<string, unknown> = {},
  hardCap = 2000
): Promise<T[]> {
  const out: T[] = [];
  let cursor: any | undefined;
  let fetched = 0;

  for (;;) {
    const page = await listPage<N, T>(name, { ...params, cursor });
    const items: T[] = Array.isArray(page) ? page : (page?.items ?? []);
    out.push(...items);
    fetched += items.length;

    if (Array.isArray(page)) break;
    cursor = (page as any)?.next;
    if (!cursor || fetched >= hardCap) break;
  }

  return out;
}

export function toApiError(e: any, fallback = 'Request failed') {
  const msg =
    extractBackendErrorMessage(e?.meta?.response) ||
    extractBackendErrorMessage(e) ||
    e?.message ||
    fallback;
  return { error: String(msg) };
}
