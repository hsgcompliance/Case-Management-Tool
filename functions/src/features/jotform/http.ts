// functions/src/features/jotform/http.ts
import {
  secureHandler,
  orgIdFromClaims,
  hasLevel,
  requireOrg,
  normId,
  normStr,
  sanitizeFlatObject,
  JOTFORM_API_KEY_SECRET,
} from "../../core";

import {
  JotformSubmissionsListQuery,
  JotformSubmissionsGetQuery,
  JotformSubmissionsUpsertBody,
  JotformSubmissionsPatchBody,
  JotformSubmissionsDeleteBody,
  JotformSubmissionsAdminDeleteBody,
  JotformSyncBody,
  JotformFormsListQuery,
  JotformLinkSubmissionBody,
  JotformSyncSelectionBody,
  JotformDigestUpsertBody,
  JotformDigestGetQuery,
  JotformDigestListQuery,
} from "./schemas";

import {
  upsertJotformSubmissions,
  patchJotformSubmissions,
  softDeleteJotformSubmissions,
  hardDeleteJotformSubmissions,
  listJotformSubmissions,
  getJotformSubmission,
  syncJotformSubmissions,
  listJotformForms,
  linkJotformSubmission,
  syncJotformSelection,
  upsertJotformDigestMap,
  getJotformDigestMap,
  listJotformDigestMaps,
  fetchJotformApiSubmissionsList,
  fetchJotformApiSubmissionGet,
} from "./service";

/** Pull explicit orgId for dev/superdev scenarios (supports arrays + query param). */
function explicitOrgFromReq(req: any, src: any): string {
  const fromQuery = normId(req?.query?.orgId);
  const fromBody = Array.isArray(src) ? normId(src?.[0]?.orgId) : normId(src?.orgId);
  return fromBody || fromQuery;
}

/** Resolve target org for org-scoped ops. */
function getTargetOrg(req: any, src: any): string {
  const caller = req.user || {};
  const callerOrg = orgIdFromClaims(caller);
  if (callerOrg) return callerOrg;

  if (hasLevel(caller, "dev")) {
    const explicit = explicitOrgFromReq(req, src);
    if (explicit) return explicit;
  }

  return requireOrg(caller);
}

function assertSubmissionOrgAccess(caller: any, targetOrg: string, submission: any) {
  const sOrg = normId(submission?.orgId);
  if (!sOrg) return; // legacy/unscoped allowed during migration
  if (sOrg !== normId(targetOrg)) {
    if (hasLevel(caller, "dev")) return;
    const e: any = new Error("forbidden_org");
    e.code = 403;
    throw e;
  }
}

/** POST /jotformSubmissionsUpsert — admin; single or array */
export const jotformSubmissionsUpsert = secureHandler(
  async (req, res) => {
    const body = JotformSubmissionsUpsertBody.parse(req.body);
    const caller = req.user!;
    const targetOrg = getTargetOrg(req, req.body);
    const out = await upsertJotformSubmissions(body, caller, targetOrg);
    res.status(201).json({ ok: true, ...out });
  },
  { auth: "admin", methods: ["POST", "OPTIONS"] }
);

/** PATCH /jotformSubmissionsPatch — verified org users (service enforces org invariants) */
export const jotformSubmissionsPatch = secureHandler(
  async (req, res) => {
    const body = JotformSubmissionsPatchBody.parse(req.body);
    const caller = req.user!;
    const targetOrg = getTargetOrg(req, req.body);
    const out = await patchJotformSubmissions(body, caller, targetOrg);
    res.status(200).json({ ok: true, ...out });
  },
  { auth: "user", methods: ["PATCH", "OPTIONS"] }
);

/** POST /jotformSubmissionsDelete — admin; id or ids[] (soft) */
export const jotformSubmissionsDelete = secureHandler(
  async (req, res) => {
    const ids = JotformSubmissionsDeleteBody.parse(req.body);

    const caller = req.user!;
    const targetOrg = getTargetOrg(req, req.body);

    const out = await softDeleteJotformSubmissions(ids, caller, targetOrg);
    res.status(200).json({ ok: true, ids: out.ids, deleted: true });
  },
  { auth: "admin", methods: ["POST", "OPTIONS"] }
);

/** POST /jotformSubmissionsAdminDelete — admin; id or ids[] (hard) */
export const jotformSubmissionsAdminDelete = secureHandler(
  async (req, res) => {
    const ids = JotformSubmissionsAdminDeleteBody.parse(req.body);

    const caller = req.user!;
    const targetOrg = getTargetOrg(req, req.body);

    const out = await hardDeleteJotformSubmissions(ids, caller, targetOrg);
    res.status(200).json({ ok: true, ...out });
  },
  { auth: "admin", methods: ["POST", "OPTIONS"] }
);

/** GET/POST /jotformSubmissionsList — org-scoped; cursor by updatedAt desc */
export const jotformSubmissionsList = secureHandler(
  async (req, res) => {
    const rawSrc = (req.method === "GET" ? req.query : req.body) || {};
    const src = JotformSubmissionsListQuery.parse(sanitizeFlatObject(rawSrc as any));

    const caller = req.user!;
    const targetOrg = getTargetOrg(req, src);

    const { items, next } = await listJotformSubmissions(src, caller, targetOrg);

    items.forEach((s) => assertSubmissionOrgAccess(caller, targetOrg, s));

    res.status(200).json({ ok: true, items, next, orgId: targetOrg });
  },
  { auth: "user", methods: ["GET", "POST", "OPTIONS"] }
);

/** GET/POST /jotformSubmissionsGet?id=... — org-scoped */
export const jotformSubmissionsGet = secureHandler(
  async (req, res) => {
    const rawSrc = (req.method === "GET" ? req.query : req.body) || {};
    const src = JotformSubmissionsGetQuery.parse(sanitizeFlatObject(rawSrc as any));

    const caller = req.user!;
    const targetOrg = getTargetOrg(req, src);

    const id = normStr(src?.id);
    if (!id) {
      res.status(400).json({ ok: false, error: "missing_id" });
      return;
    }

    const submission = await getJotformSubmission(id);
    if (!submission) {
      res.status(404).json({ ok: false, error: "not_found" });
      return;
    }

    assertSubmissionOrgAccess(caller, targetOrg, submission);

    res.status(200).json({ ok: true, submission });
  },
  { auth: "user", methods: ["GET", "POST", "OPTIONS"] }
);

/** GET /jotformSubmissionsStructure — skeleton for create forms */
export const jotformSubmissionsStructure = secureHandler(
  async (_req, res) => {
    const structure = {
      formId: "",
      formTitle: "",
      submissionId: "",
      formAlias: "",

      status: "active",
      source: "manual",

      grantId: null,
      programId: null,
      customerId: null,
      enrollmentId: null,
      cwId: null,
      hmisId: null,
      fieldMap: {},

      ip: null,
      statusRaw: null,
      submissionUrl: null,
      editUrl: null,
      pdfUrl: null,

      answers: {},
      raw: null,

      calc: {
        amount: 0,
        currency: "USD",
        amounts: [],
        lineItems: [],
      },

      budget: {
        total: 0,
        totals: {
          projected: 0,
          spent: 0,
          balance: 0,
          projectedBalance: 0,
          remaining: 0,
        },
        lineItems: [],
      },

      meta: {},
    };
    res.status(200).json({ ok: true, structure });
  },
  { auth: "user", methods: ["GET", "OPTIONS"] }
);

/** GET/POST /jotformFormsList — direct forms list from Jotform API */
export const jotformFormsList = secureHandler(
  async (req, res) => {
    const rawSrc = (req.method === "GET" ? req.query : req.body) || {};
    const src = JotformFormsListQuery.parse(sanitizeFlatObject(rawSrc as any));
    const out = await listJotformForms(src);
    res.status(200).json({ ok: true, ...out });
  },
  { auth: "user", methods: ["GET", "POST", "OPTIONS"], secrets: [JOTFORM_API_KEY_SECRET] }
);

/** POST /jotformLinkSubmission — attach grant/customer/enrollment + field mapping */
export const jotformLinkSubmission = secureHandler(
  async (req, res) => {
    const body = JotformLinkSubmissionBody.parse(req.body);
    const caller = req.user!;
    const targetOrg = getTargetOrg(req, body);
    const out = await linkJotformSubmission(body, caller, targetOrg);
    res.status(200).json({ ok: true, ...out });
  },
  { auth: "user", methods: ["POST", "OPTIONS"] }
);

/** POST /jotformSyncSelection — sync all forms or selected forms/aliases */
export const jotformSyncSelection = secureHandler(
  async (req, res) => {
    const parsed = JotformSyncSelectionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: "invalid_sync_selection_request",
        code: 400,
        meta: {
          stage: "validation",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      });
      return;
    }
    const body = parsed.data;
    const caller = req.user!;
    const targetOrg = getTargetOrg(req, body);
    const out = await syncJotformSelection(body, caller, targetOrg);
    res.status(200).json({ ok: true, ...out });
  },
  { auth: "admin", methods: ["POST", "OPTIONS"], secrets: [JOTFORM_API_KEY_SECRET] }
);

/** POST /jotformDigestUpsert — upsert digest config for a form */
export const jotformDigestUpsert = secureHandler(
  async (req, res) => {
    const body = JotformDigestUpsertBody.parse(req.body);
    const caller = req.user!;
    const targetOrg = getTargetOrg(req, body);
    const out = await upsertJotformDigestMap(body, caller, targetOrg);
    res.status(200).json({ ok: true, ...out });
  },
  { auth: "user", methods: ["POST", "OPTIONS"] }
);

/** GET/POST /jotformDigestGet?formId=...|formAlias=... */
export const jotformDigestGet = secureHandler(
  async (req, res) => {
    const rawSrc = (req.method === "GET" ? req.query : req.body) || {};
    const src = JotformDigestGetQuery.parse(sanitizeFlatObject(rawSrc as any));
    const caller = req.user!;
    const targetOrg = getTargetOrg(req, src);
    const out = await getJotformDigestMap(src, caller, targetOrg);
    res.status(200).json({ ok: true, ...out });
  },
  { auth: "user", methods: ["GET", "POST", "OPTIONS"] }
);

/** GET/POST /jotformDigestList — list digest configs for org */
export const jotformDigestList = secureHandler(
  async (req, res) => {
    const rawSrc = (req.method === "GET" ? req.query : req.body) || {};
    const src = JotformDigestListQuery.parse(sanitizeFlatObject(rawSrc as any));
    const caller = req.user!;
    const targetOrg = getTargetOrg(req, src);
    const out = await listJotformDigestMaps(src, caller, targetOrg);
    res.status(200).json({ ok: true, ...out });
  },
  { auth: "user", methods: ["GET", "POST", "OPTIONS"] }
);

/** GET /jotformApiSubmissionsList?formId=...&limit=...&offset=... — live from Jotform API, no Firestore write */
export const jotformApiSubmissionsList = secureHandler(
  async (req, res) => {
    const src = (req.method === "GET" ? req.query : req.body) || {};
    const formId = normStr(src?.formId);
    if (!formId) {
      res.status(400).json({ ok: false, error: "missing_formId" });
      return;
    }
    const out = await fetchJotformApiSubmissionsList(formId, {
      limit: src?.limit ? Number(src.limit) : undefined,
      offset: src?.offset ? Number(src.offset) : undefined,
      status: normStr(src?.status) || undefined,
      since: normStr(src?.since) || undefined,
    });
    res.status(200).json({ ok: true, ...out });
  },
  { auth: "user", methods: ["GET", "POST", "OPTIONS"], secrets: [JOTFORM_API_KEY_SECRET] }
);

/** GET /jotformApiSubmissionGet?id=... — live single submission from Jotform API */
export const jotformApiSubmissionGet = secureHandler(
  async (req, res) => {
    const src = (req.method === "GET" ? req.query : req.body) || {};
    const id = normStr(src?.id);
    if (!id) {
      res.status(400).json({ ok: false, error: "missing_id" });
      return;
    }
    const submission = await fetchJotformApiSubmissionGet(id);
    if (!submission) {
      res.status(404).json({ ok: false, error: "not_found" });
      return;
    }
    res.status(200).json({ ok: true, submission });
  },
  { auth: "user", methods: ["GET", "POST", "OPTIONS"], secrets: [JOTFORM_API_KEY_SECRET] }
);

/** POST /jotformSyncSubmissions — admin; pulls from Jotform API */
export const jotformSyncSubmissions = secureHandler(
  async (req, res) => {
    const body = JotformSyncBody.parse(req.body);
    const caller = req.user!;
    const targetOrg = getTargetOrg(req, req.body);

    const out = await syncJotformSubmissions(body, caller, targetOrg);
    res.status(200).json({ ok: true, ...out });
  },
  { auth: "admin", methods: ["POST", "OPTIONS"], secrets: [JOTFORM_API_KEY_SECRET] }
);
