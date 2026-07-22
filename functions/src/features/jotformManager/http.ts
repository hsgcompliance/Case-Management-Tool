// functions/src/features/jotformManager/http.ts
import { secureHandler, normStr, orgIdFromClaims, JOTFORM_API_KEY_SECRET } from "../../core";
import { listForms, listSubmissions, cloneSubmission, linkSubmissionToCustomer, listSubmissionLinks } from "./service";

const JF_SECRETS = [JOTFORM_API_KEY_SECRET];

/** GET /jfFormsList — authed staff; all Jotform forms (for the form picker). */
export const jfFormsList_http = secureHandler(
  async (req, res) => {
    void req.user;
    const rawMaxAge = String((req.query as Record<string, unknown>)?.maxAgeDays || "").trim().toLowerCase();
    const maxAgeDays = rawMaxAge === "all" ? null : Number(rawMaxAge) || 30;
    const items = await listForms(maxAgeDays);
    res.status(200).json({ ok: true, items, count: items.length });
  },
  { auth: "user", appCheck: false, methods: ["GET", "OPTIONS"], secrets: JF_SECRETS }
);

/** GET /jfSubmissionsList?formId= — authed staff; all submissions for a form. */
export const jfSubmissionsList_http = secureHandler(
  async (req, res) => {
    void req.user;
    const formId = normStr((req.query as Record<string, unknown>)?.formId);
    const content = await listSubmissions(formId);
    res.status(200).json({ ok: true, content, count: content.length });
  },
  { auth: "user", appCheck: false, methods: ["GET", "OPTIONS"], timeoutSeconds: 120, secrets: JF_SECRETS }
);

/** POST /jfCloneSubmission — authed staff; clone a submission → editable new one. */
export const jfCloneSubmission_http = secureHandler(
  async (req, res) => {
    void req.user;
    const body = (req.body || {}) as Record<string, unknown>;
    const out = await cloneSubmission(normStr(body.formId), normStr(body.submissionId));
    res.status(200).json({ ok: true, ...out });
  },
  { auth: "user", appCheck: false, methods: ["POST", "OPTIONS"], secrets: JF_SECRETS }
);

/**
 * POST /customerLinkSubmission — authed staff; link a Jotform submission to a
 * customer. Canonical store is customers.meta.linkedSubmissions[] (read by the web
 * customer modal); a derived reverse index is also written. appCheck:false for forms-web.
 */
export const customerLinkSubmission_http = secureHandler(
  async (req, res) => {
    const caller = req.user!;
    const body = (req.body || {}) as Record<string, unknown>;
    await linkSubmissionToCustomer({
      orgId: orgIdFromClaims(caller),
      formId: normStr(body.formId),
      formName: normStr(body.formName),
      submissionId: normStr(body.submissionId),
      customerId: normStr(body.customerId),
      customerName: normStr(body.customerName),
      cwId: normStr(body.cwId) || null,
      alias: normStr(body.alias) || null,
      byUid: (caller as { uid?: string })?.uid || null,
    });
    res.status(200).json({ ok: true });
  },
  { auth: "user", appCheck: false, methods: ["POST", "OPTIONS"] }
);

/** GET /submissionLinksGet?formId= — authed staff; existing submission→customer links. */
export const submissionLinksGet_http = secureHandler(
  async (req, res) => {
    const caller = req.user!;
    const formId = normStr((req.query as Record<string, unknown>)?.formId);
    const links = await listSubmissionLinks(orgIdFromClaims(caller), formId);
    res.status(200).json({ ok: true, links });
  },
  { auth: "user", appCheck: false, methods: ["GET", "OPTIONS"] }
);
