// functions/src/features/formSessions/service.ts
// -----------------------------------------------------------------------------
// Form session lifecycle: create (authed staff) → resolve (token) → complete (token).
// Tokens are random; only sha256(token) is persisted. The raw token lives in the
// render URL and in QR codes only.
// -----------------------------------------------------------------------------
import crypto from "node:crypto";
import { randomUUID as uuid } from "node:crypto";
import * as logger from "firebase-functions/logger";
import {
  db,
  FieldValue,
  isoNow,
  normId,
  toMonthKey,
  toBudgetCents,
  orgIdFromClaims,
  requireOrg,
  isDev,
  FORMS_APP_BASE_URL,
  type Claims,
} from "../../core";
import {
  getWorkflowConfig,
  type TFormWorkflowId,
  type TFormSessionCreateBody,
  type TFormSessionResolved,
  type TFormPrefillSnapshot,
  type TFormWorkflowConfig,
} from "@hdb/contracts";
import { summarizeCreditCards } from "../creditCards/service";

const COLLECTION = "formSessions";
const DEFAULT_TTL_MINUTES = 120;

/**
 * Backend-owned default Jotform form ids per workflow (not in shared contract).
 * Source of truth: artifacts/jotform-shapes/jotforms-inventory.csv —
 *   251590902397160 = "Credit Card Checkout"               (point-of-sale checkout)
 *   251878265158166 = "Credit Card Purchase Documentation" (post-purchase / spend-capture pipeline)
 *   251658579638173 = "Credit Card Return"
 *   252674777246167 = "Invoice Requests"                   (invoice pipeline)
 * The checkout workflow renders the Checkout form — NOT the documentation form
 * that the spending pipeline ingests.
 */
const WORKFLOW_FORM_IDS: Partial<Record<TFormWorkflowId, string>> = {
  "credit-card-checkout": "251590902397160",
  "invoice-request": "252674777246167",
};

/* ───────────────────────── helpers ───────────────────────── */

function genToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function assertTargetOrgAllowed(caller: Claims, targetOrg: string) {
  const callerOrg = orgIdFromClaims(caller);
  const t = normId(targetOrg);
  if (callerOrg && normId(callerOrg) !== t && !isDev(caller)) {
    const e = new Error("forbidden_cross_org") as Error & { code: number };
    e.code = 403;
    throw e;
  }
  if (!callerOrg && !isDev(caller)) requireOrg(caller);
}

function formsBaseUrl(): string {
  const fromEnv =
    FORMS_APP_BASE_URL && typeof FORMS_APP_BASE_URL.value === "function"
      ? String(FORMS_APP_BASE_URL.value() || "")
      : "";
  const raw = (fromEnv || process.env.FORMS_APP_BASE_URL || "https://housing-db-forms.web.app").trim();
  return raw.replace(/\/+$/, "");
}

function renderPath(workflowId: TFormWorkflowId, token: string): string {
  switch (workflowId) {
    case "credit-card-checkout":
      return `/checkout/${token}`;
    case "credit-card-status":
      return `/status/${token}`;
    case "customer-prefill":
      return `/customer-prefill/${token}`;
    case "invoice-request":
      return `/invoice/${token}`;
    default:
      return `/render/${workflowId}/${token}`;
  }
}

function resolveFormId(workflowId: TFormWorkflowId, config: TFormWorkflowConfig): string | null {
  return (config.jotformFormId || WORKFLOW_FORM_IDS[workflowId] || "").trim() || null;
}

async function getDocInOrg(collection: string, id: string, orgId: string) {
  if (!id) return null;
  const snap = await db.collection(collection).doc(id).get();
  if (!snap.exists) return null;
  const data = { id: snap.id, ...(snap.data() || {}) } as Record<string, unknown>;
  const docOrg = normId(data.orgId);
  if (docOrg && docOrg !== normId(orgId)) return null;
  return data;
}

/* ───────────────────────── prefill ─────────────────────────
 * Build the non-sensitive render snapshot. Defensive: any missing piece is just
 * omitted. Never throws on missing context — a partial card still renders.
 */
async function buildPrefill(args: {
  workflowId: TFormWorkflowId;
  orgId: string;
  customerId: string | null;
  grantId: string | null;
  paymentQueueId: string | null;
  creditCardId: string | null;
}): Promise<{ prefill: TFormPrefillSnapshot; resolved: { customerId: string | null; grantId: string | null; creditCardId: string | null } }> {
  const { workflowId, orgId } = args;
  const prefill: TFormPrefillSnapshot = {};

  let customerId = args.customerId;
  let grantId = args.grantId;
  let creditCardId = args.creditCardId;
  let month = toMonthKey(new Date());

  // 1. Payment queue item drives amount / month / vendor / linkage.
  if (args.paymentQueueId) {
    const q = await getDocInOrg("paymentQueue", args.paymentQueueId, orgId);
    if (q) {
      const amount = Number(q.amount || 0);
      if (Number.isFinite(amount) && amount !== 0) prefill.amountCents = toBudgetCents(Math.abs(amount));
      const m = String(q.month || "").slice(0, 7);
      if (m) {
        prefill.paymentMonth = m;
        month = m;
      }
      const vendor = String(q.merchant || "").trim();
      if (vendor) prefill.vendor = vendor;
      const status = String(q.queueStatus || "").trim();
      if (status) prefill.checkoutStatus = status;
      customerId = customerId || (normId(q.customerId) || null);
      grantId = grantId || (normId(q.grantId) || null);
      creditCardId = creditCardId || (normId(q.creditCardId) || null);
    }
  }

  // 2. Customer → name + denormalized case manager name.
  if (customerId) {
    const c = await getDocInOrg("customers", customerId, orgId);
    if (c) {
      const name = [c.firstName, c.lastName].map((x) => String(x || "").trim()).filter(Boolean).join(" ");
      if (name) prefill.customerName = name;
      const cm = String(c.caseManagerName || "").trim();
      if (cm) prefill.caseManagerName = cm;
    } else {
      customerId = null;
    }
  }

  // 3. Grant → name.
  if (grantId) {
    const g = await getDocInOrg("grants", grantId, orgId);
    if (g) {
      prefill.grantId = grantId;
      const name = String(g.name || "").trim();
      if (name) prefill.grantName = name;
    } else {
      grantId = null;
    }
  }

  // 4. Credit-card monthly spend (real data, or graceful null).
  if (workflowId === "credit-card-checkout") {
    if (creditCardId) {
      prefill.cardId = creditCardId;
      try {
        const summary = await summarizeCreditCards(orgId, { id: creditCardId, month });
        const card = (summary.items || []).find((it) => String(it.id) === String(creditCardId));
        if (card) {
          prefill.cardName = card.name;
          prefill.currentMonthCardSpendCents = card.spentCents;
          prefill.monthlyLimitCents = card.monthlyLimitCents || null;
        } else {
          prefill.currentMonthCardSpendCents = null;
          prefill.monthlyLimitCents = null;
        }
      } catch (e) {
        // Monthly spend is best-effort. Show "unavailable", never fail create.
        logger.warn("formSession_cc_spend_unavailable", { creditCardId, message: (e as Error)?.message });
        prefill.currentMonthCardSpendCents = null;
        prefill.monthlyLimitCents = null;
      }
    } else {
      // No card linked yet → spend total not applicable.
      prefill.currentMonthCardSpendCents = null;
      prefill.monthlyLimitCents = null;
    }
  }

  return { prefill, resolved: { customerId, grantId, creditCardId } };
}

/* ───────────────────────── create ───────────────────────── */

export async function createFormSession(body: TFormSessionCreateBody, caller: Claims, targetOrg: string) {
  assertTargetOrgAllowed(caller, targetOrg);
  const orgId = normId(targetOrg);

  const config = getWorkflowConfig(body.workflowId);
  if (!config) {
    const e = new Error("unknown_workflow") as Error & { code: number };
    e.code = 400;
    throw e;
  }

  // Validate required context.
  const ctxIn = {
    customerId: normId(body.customerId) || null,
    userId: normId(body.userId) || null,
    caseManagerId: normId(body.caseManagerId) || null,
    grantId: normId(body.grantId) || null,
    paymentQueueId: normId(body.paymentQueueId) || null,
    ledgerItemId: normId(body.ledgerItemId) || null,
    creditCardId: normId(body.creditCardId) || null,
  };
  for (const key of config.requiredContext) {
    if (!(ctxIn as Record<string, string | null>)[key]) {
      const e = new Error(`missing_required_context:${key}`) as Error & { code: number };
      e.code = 400;
      throw e;
    }
  }

  const { prefill, resolved } = await buildPrefill({
    workflowId: body.workflowId,
    orgId,
    customerId: ctxIn.customerId,
    grantId: ctxIn.grantId,
    paymentQueueId: ctxIn.paymentQueueId,
    creditCardId: ctxIn.creditCardId,
  });

  const token = genToken();
  const id = uuid();
  const ttl = Math.max(1, Number(body.ttlMinutes || DEFAULT_TTL_MINUTES));
  const expiresAt = new Date(Date.now() + ttl * 60_000).toISOString();
  const jotformFormId = resolveFormId(body.workflowId, config);

  const doc = {
    id,
    orgId,
    workflowId: body.workflowId,
    status: "created" as const,
    source: body.source || "main_app",

    customerId: resolved.customerId,
    userId: ctxIn.userId || (caller as { uid?: string })?.uid || null,
    caseManagerId: ctxIn.caseManagerId,
    grantId: resolved.grantId,
    paymentQueueId: ctxIn.paymentQueueId,
    ledgerItemId: ctxIn.ledgerItemId,
    creditCardId: resolved.creditCardId,

    jotformFormId,
    jotformSubmissionId: null,

    tokenHash: hashToken(token),
    expiresAt,

    prefillSnapshot: prefill,
    submissionSnapshot: null,

    createdByUid: (caller as { uid?: string })?.uid || null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await db.collection(COLLECTION).doc(id).set(doc);

  const renderUrl = `${formsBaseUrl()}${renderPath(body.workflowId, token)}`;
  return { formSessionId: id, renderUrl, expiresAt };
}

/* ───────────────────────── resolve ───────────────────────── */

async function findByToken(token: string) {
  const tokenHash = hashToken(token);
  const snap = await db.collection(COLLECTION).where("tokenHash", "==", tokenHash).limit(1).get();
  const hit = snap.docs[0];
  if (!hit) return null;
  return { ref: hit.ref, data: { id: hit.id, ...(hit.data() || {}) } as Record<string, unknown> };
}

function isExpired(expiresAt: unknown): boolean {
  const ms = Date.parse(String(expiresAt || ""));
  return Number.isFinite(ms) ? ms < Date.now() : false;
}

export async function resolveFormSession(token: string): Promise<TFormSessionResolved> {
  const found = await findByToken(token);
  if (!found) {
    const e = new Error("session_not_found") as Error & { code: number };
    e.code = 404;
    throw e;
  }
  const { ref, data } = found;
  const workflowId = data.workflowId as TFormWorkflowId;
  const config = getWorkflowConfig(workflowId);
  const expired = isExpired(data.expiresAt) || data.status === "expired";

  // Best-effort status advance (created → opened) without clobbering later states.
  if (!expired && data.status === "created") {
    try {
      await ref.set({ status: "opened", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      data.status = "opened";
    } catch {
      /* non-fatal */
    }
  }
  if (expired && data.status !== "expired" && data.status !== "completed") {
    try {
      await ref.set({ status: "expired", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    } catch {
      /* non-fatal */
    }
  }

  return {
    formSessionId: String(data.id),
    workflowId,
    status: expired ? "expired" : (data.status as TFormSessionResolved["status"]),
    renderMode: config.mode,
    jotformFormId: (data.jotformFormId as string | null) ?? resolveFormId(workflowId, config),
    config,
    prefill: (data.prefillSnapshot as TFormPrefillSnapshot | null) ?? null,
    context: {
      customerId: (normId(data.customerId) || null) as string | null,
      grantId: (normId(data.grantId) || null) as string | null,
      paymentQueueId: (normId(data.paymentQueueId) || null) as string | null,
      creditCardId: (normId(data.creditCardId) || null) as string | null,
    },
    jotformSubmissionId: (data.jotformSubmissionId as string | null) ?? null,
    expiresAt: String(data.expiresAt || ""),
    expired,
  };
}

/* ───────────────────────── complete / link ─────────────────────────
 * Best-effort: link the resulting Jotform submission to the session's context if
 * the submission doc has already synced into Firestore. The session always
 * records the submission id + snapshot so the existing jotform pipeline can pick
 * it up later even if it hasn't synced yet.
 */
async function linkSubmissionToContext(
  orgId: string,
  jotformSubmissionId: string,
  ctx: { customerId: string | null; grantId: string | null; creditCardId: string | null }
): Promise<boolean> {
  const id = String(jotformSubmissionId || "").trim();
  if (!id) return false;

  // jotformSubmissions doc id is the submission id; fall back to a query.
  let ref = db.collection("jotformSubmissions").doc(id);
  let snap = await ref.get();
  if (!snap.exists) {
    const q = await db
      .collection("jotformSubmissions")
      .where("orgId", "==", orgId)
      .where("submissionId", "==", id)
      .limit(1)
      .get();
    const hit = q.docs[0];
    if (!hit) return false;
    ref = hit.ref;
    snap = hit;
  }
  const docOrg = normId((snap.data() || {}).orgId);
  if (docOrg && docOrg !== orgId) return false;

  const patch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (ctx.customerId) patch.customerId = ctx.customerId;
  if (ctx.grantId) patch.grantId = ctx.grantId;
  if (ctx.creditCardId) patch.creditCardId = ctx.creditCardId;
  await ref.set(patch, { merge: true });
  return true;
}

export async function completeFormSession(args: {
  token: string;
  jotformSubmissionId?: string | null;
  submission?: Record<string, unknown> | null;
}) {
  const found = await findByToken(args.token);
  if (!found) {
    const e = new Error("session_not_found") as Error & { code: number };
    e.code = 404;
    throw e;
  }
  const { ref, data } = found;
  if (data.status === "revoked") {
    const e = new Error("session_revoked") as Error & { code: number };
    e.code = 410;
    throw e;
  }
  if (isExpired(data.expiresAt)) {
    const e = new Error("session_expired") as Error & { code: number };
    e.code = 410;
    throw e;
  }

  const orgId = normId(data.orgId);
  const workflowId = data.workflowId as TFormWorkflowId;
  const config = getWorkflowConfig(workflowId);
  const submissionId = String(args.jotformSubmissionId || "").trim() || null;

  const submissionSnapshot = {
    jotformFormId: (data.jotformFormId as string | null) ?? null,
    jotformSubmissionId: submissionId,
    submittedAt: isoNow(),
    ...(args.submission && typeof args.submission === "object" ? { payload: args.submission } : {}),
  };

  let linked = false;
  const ctx = {
    customerId: (normId(data.customerId) || null) as string | null,
    grantId: (normId(data.grantId) || null) as string | null,
    creditCardId: (normId(data.creditCardId) || null) as string | null,
  };

  if (config.afterSubmit.linkJotformSubmission && submissionId) {
    try {
      linked = await linkSubmissionToContext(orgId, submissionId, ctx);
    } catch (e) {
      logger.warn("formSession_link_failed", { submissionId, message: (e as Error)?.message });
    }
  }

  // Lightweight, additive checkout annotation on the queue item (never touches
  // the queueStatus lifecycle — posting to ledger stays in the spending tools).
  if (config.afterSubmit.updatePaymentQueueStatus && data.paymentQueueId) {
    try {
      await db
        .collection("paymentQueue")
        .doc(String(data.paymentQueueId))
        .set(
          {
            formCheckout: {
              formSessionId: String(data.id),
              status: "submitted",
              jotformSubmissionId: submissionId,
              at: isoNow(),
            },
            updatedAtISO: isoNow(),
          },
          { merge: true }
        );
    } catch (e) {
      logger.warn("formSession_queue_annotate_failed", { id: data.paymentQueueId, message: (e as Error)?.message });
    }
  }

  await ref.set(
    {
      status: "completed",
      jotformSubmissionId: submissionId,
      submissionSnapshot,
      submittedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { formSessionId: String(data.id), status: "completed" as const, linked };
}

/* ───────────────────────── staff customer search ─────────────────────────
 * Lightweight org-scoped customer list for the forms app's search bar. Returns a
 * capped set; the frontend filters client-side (snappy, one fetch).
 */
export type FormsCustomerItem = {
  id: string;
  name: string;
  caseManagerName: string | null;
  cwId: string | null;
  dob: string | null;
};

/**
 * Minimal customer index for the forms app — name + id + CWID + CM + DOB only (NOT
 * the full customer doc). DOB powers the customer-details header on the intake / all
 * forms pages. The client caches this list once and filters client-side.
 */
export async function listCustomersForForms(orgId: string, limit = 5000): Promise<FormsCustomerItem[]> {
  const org = normId(orgId);
  if (!org) return [];
  const cap = Math.max(1, Math.min(10000, Number(limit || 5000)));
  const snap = await db.collection("customers").where("orgId", "==", org).limit(cap).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() || {}) } as Record<string, unknown>))
    .map((r) => {
      const name = [r.firstName, r.lastName].map((x) => String(x || "").trim()).filter(Boolean).join(" ");
      return {
        id: String(r.id),
        name: name || String(r.id),
        caseManagerName: String(r.caseManagerName || "").trim() || null,
        cwId: String(r.cwId || "").trim() || null,
        dob: String(r.dob || "").trim() || null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/* ───────────────────────── customer detail + household ─────────────────────────
 * Full(er) customer view for the forms-app header — sourced from the customer doc
 * (not the minimal search index). Also assembles a first-pass NORMALIZED HOUSEHOLD
 * object: the canonical fields we can assert today (head of household, CWID, DOB,
 * CM, population, status) plus the customer's linked Jotform submissions organized
 * by form. True multi-member family linking + per-form field normalization are the
 * fine-tuning steps layered on top of this shape.
 */
const sTrim = (v: unknown): string => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());

export type FormsLinkedSubmission = {
  formId: string;
  formName: string | null;
  submissionId: string;
  alias: string | null;
  cwId: string | null;
  linkedAt: string | null;
  linkedBy: string | null;
};

export type FormsHouseholdField = { key: string; label: string; value: string };
export type FormsHouseholdFormGroup = { formId: string; formName: string; count: number; latestLinkedAt: string | null };
export type FormsHouseholdMember = { name: string; cwId: string | null; dob: string | null; relation: string };

export type FormsHouseholdObject = {
  headOfHousehold: string;
  cwId: string | null;
  memberCount: number;
  members: FormsHouseholdMember[];
  /** The normalized household object — labeled key/value rows the UI renders as-is. */
  normalized: FormsHouseholdField[];
  /** Form inputs organized by source form (one row per linked Jotform). */
  forms: FormsHouseholdFormGroup[];
  formCount: number;
};

export type FormsCustomerDetail = {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  cwId: string | null;
  dob: string | null;
  caseManagerName: string | null;
  secondaryCaseManagerName: string | null;
  population: string | null;
  status: string | null;
  acuityScore: number | null;
  otherContacts: Array<{ name: string | null; role: string | null }>;
  linkedSubmissions: FormsLinkedSubmission[];
  household: FormsHouseholdObject;
  /** Customer Drive folder (read order: customerDrive → meta.driveFolderId → meta.driveFolders[0]). */
  driveFolderUrl: string | null;
  tssPayerStatus: string | null;
};

export async function getCustomerDetailForForms(orgId: string, customerId: string): Promise<FormsCustomerDetail | null> {
  const org = normId(orgId);
  const id = normId(customerId);
  if (!org || !id) return null;

  const snap = await db.collection("customers").doc(id).get();
  if (!snap.exists) return null;
  const r = (snap.data() || {}) as Record<string, any>;
  if (normId(r.orgId) !== org) return null; // org isolation — never leak cross-org

  const firstName = sTrim(r.firstName);
  const lastName = sTrim(r.lastName);
  const name = [firstName, lastName].filter(Boolean).join(" ") || sTrim(r.fullName) || sTrim(r.name) || id;
  const cwId = sTrim(r.cwId);
  const dob = sTrim(r.dob);
  const caseManagerName = sTrim(r.caseManagerName);
  const secondaryCaseManagerName = sTrim(r.secondaryCaseManagerName);
  const population = sTrim(r.population);
  const status = sTrim(r.status);
  const acuityScore = Number.isFinite(Number(r.acuityScore)) ? Number(r.acuityScore) : null;

  const otherContacts = Array.isArray(r.otherContacts)
    ? r.otherContacts.slice(0, 5).map((c: any) => ({ name: sTrim(c?.name) || null, role: sTrim(c?.role) || null }))
    : [];

  const rawLinks = Array.isArray(r?.meta?.linkedSubmissions) ? r.meta.linkedSubmissions : [];
  const linkedSubmissions: FormsLinkedSubmission[] = rawLinks
    .map((l: any) => ({
      formId: sTrim(l?.formId),
      formName: sTrim(l?.formName) || null,
      submissionId: sTrim(l?.submissionId),
      alias: sTrim(l?.alias) || null,
      cwId: sTrim(l?.cwId) || null,
      linkedAt: sTrim(l?.linkedAt) || null,
      linkedBy: sTrim(l?.linkedBy) || null,
    }))
    .filter((l: FormsLinkedSubmission) => l.submissionId);

  // Organize form inputs: group linked submissions by source form.
  const byForm = new Map<string, FormsHouseholdFormGroup>();
  for (const l of linkedSubmissions) {
    const key = l.formId || l.formName || l.submissionId;
    const g = byForm.get(key) || {
      formId: l.formId,
      formName: l.formName || (l.formId ? `Form ${l.formId}` : "Form"),
      count: 0,
      latestLinkedAt: null as string | null,
    };
    g.count += 1;
    if (l.linkedAt && (!g.latestLinkedAt || l.linkedAt > g.latestLinkedAt)) g.latestLinkedAt = l.linkedAt;
    byForm.set(key, g);
  }
  const forms = [...byForm.values()].sort((a, b) => (b.latestLinkedAt || "").localeCompare(a.latestLinkedAt || ""));

  // Normalized household object — the fields we can canonically assert today.
  const normalized: FormsHouseholdField[] = [
    { key: "headOfHousehold", label: "Head of household", value: name },
    { key: "cwId", label: "CWID", value: cwId },
    { key: "dob", label: "Date of birth", value: dob },
    { key: "caseManager", label: "Case manager", value: caseManagerName },
    { key: "secondaryCaseManager", label: "Secondary case manager", value: secondaryCaseManagerName },
    { key: "population", label: "Population", value: population },
    { key: "status", label: "Status", value: status },
    { key: "linkedForms", label: "Linked submissions", value: String(linkedSubmissions.length) },
  ].filter((f) => f.value !== "");

  const household: FormsHouseholdObject = {
    headOfHousehold: name,
    cwId: cwId || null,
    memberCount: 1, // head only until family linking exists; grows in fine-tuning
    members: [{ name, cwId: cwId || null, dob: dob || null, relation: "Head of household" }],
    normalized,
    forms,
    formCount: linkedSubmissions.length,
  };

  return {
    id,
    name,
    firstName: firstName || null,
    lastName: lastName || null,
    cwId: cwId || null,
    dob: dob || null,
    caseManagerName: caseManagerName || null,
    secondaryCaseManagerName: secondaryCaseManagerName || null,
    population: population || null,
    status: status || null,
    acuityScore,
    otherContacts,
    linkedSubmissions,
    household,
    driveFolderUrl: (() => {
      const folderId =
        sTrim(r?.customerDrive?.folderId) ||
        sTrim(r?.meta?.driveFolderId) ||
        sTrim(r?.meta?.driveFolders?.[0]?.id);
      return sTrim(r?.customerDrive?.folderUrl) || (folderId ? `https://drive.google.com/drive/folders/${folderId}` : null);
    })(),
    tssPayerStatus: sTrim(r?.tssPayerStatus) || null,
  };
}

/* ───────────────────────── staff list ─────────────────────────
 * Authed staff view of the form sessions in their org (form-submission access).
 * Org-scoped equality query (no composite index needed); recency sort in memory.
 */
export type FormSessionListItem = {
  id: string;
  workflowId: string;
  status: string;
  source: string;
  customerName: string | null;
  grantName: string | null;
  amountCents: number | null;
  paymentMonth: string | null;
  vendor: string | null;
  jotformFormId: string | null;
  jotformSubmissionId: string | null;
  customerId: string | null;
  grantId: string | null;
  paymentQueueId: string | null;
  createdAt: string | null;
  submittedAt: string | null;
  expiresAt: string | null;
};

function tsToIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  const maybe = value as { toDate?: () => Date };
  if (typeof maybe.toDate === "function") {
    try { return maybe.toDate().toISOString(); } catch { return null; }
  }
  return null;
}

export async function listFormSessions(
  orgId: string,
  opts: { limit?: number; workflowId?: string | null; status?: string | null } = {}
): Promise<FormSessionListItem[]> {
  const org = normId(orgId);
  if (!org) return [];
  const limit = Math.max(1, Math.min(200, Number(opts.limit || 50)));
  const scanCap = 400;

  const snap = await db.collection(COLLECTION).where("orgId", "==", org).limit(scanCap).get();
  let rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) } as Record<string, unknown>));

  const wf = normId(opts.workflowId);
  if (wf) rows = rows.filter((r) => normId(r.workflowId) === wf);
  const st = normId(opts.status);
  if (st) rows = rows.filter((r) => normId(r.status) === st);

  rows.sort((a, b) => {
    const at = Date.parse(tsToIso(a.createdAt) || "") || 0;
    const bt = Date.parse(tsToIso(b.createdAt) || "") || 0;
    return bt - at;
  });

  return rows.slice(0, limit).map((r) => {
    const prefill = (r.prefillSnapshot as TFormPrefillSnapshot | null) || {};
    return {
      id: String(r.id),
      workflowId: String(r.workflowId || ""),
      status: String(r.status || ""),
      source: String(r.source || ""),
      customerName: (prefill.customerName as string | null) ?? null,
      grantName: (prefill.grantName as string | null) ?? null,
      amountCents: typeof prefill.amountCents === "number" ? prefill.amountCents : null,
      paymentMonth: (prefill.paymentMonth as string | null) ?? null,
      vendor: (prefill.vendor as string | null) ?? null,
      jotformFormId: (r.jotformFormId as string | null) ?? null,
      jotformSubmissionId: (r.jotformSubmissionId as string | null) ?? null,
      customerId: (normId(r.customerId) || null) as string | null,
      grantId: (normId(r.grantId) || null) as string | null,
      paymentQueueId: (normId(r.paymentQueueId) || null) as string | null,
      createdAt: tsToIso(r.createdAt),
      submittedAt: tsToIso(r.submittedAt),
      expiresAt: tsToIso(r.expiresAt),
    };
  });
}
