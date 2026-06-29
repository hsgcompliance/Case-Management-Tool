// functions/src/features/formSessions/http.ts
import {
  secureHandler,
  orgIdFromClaims,
  hasLevel,
  requireOrg,
  normId,
  normStr,
} from "../../core";
import {
  FormSessionCreateBody,
  FormSessionResolveBody,
  FormSessionCompleteBody,
} from "./schemas";
import { createFormSession, resolveFormSession, completeFormSession, listFormSessions, listCustomersForForms, getCustomerDetailForForms } from "./service";
import { summarizeCreditCards } from "../creditCards/service";

/** Resolve target org for org-scoped ops (mirrors jotform/http getTargetOrg). */
function getTargetOrg(req: any, src: any): string {
  const caller = req.user || {};
  const callerOrg = orgIdFromClaims(caller);
  if (callerOrg) return callerOrg;
  if (hasLevel(caller, "dev")) {
    const explicit = normId(src?.orgId) || normId(req?.query?.orgId);
    if (explicit) return explicit;
  }
  return requireOrg(caller);
}

/** POST /createFormSession — authed staff mint a tokenized session + render URL. */
export const createFormSession_http = secureHandler(
  async (req, res) => {
    const body = FormSessionCreateBody.parse(req.body);
    const caller = req.user!;
    const targetOrg = getTargetOrg(req, req.body);
    const out = await createFormSession(body, caller, targetOrg);
    res.status(201).json({ ok: true, ...out });
  },
  { auth: "user", methods: ["POST", "OPTIONS"] }
);

/**
 * GET /listFormSessions — authed staff (form-submission access). Org-scoped.
 * App Check disabled so the lightweight Forms surface need not register App Check;
 * still requires a valid Firebase ID token + org claim.
 */
export const listFormSessions_http = secureHandler(
  async (req, res) => {
    const caller = req.user!;
    const targetOrg = getTargetOrg(req, req.query);
    const src = (req.query || {}) as Record<string, unknown>;
    const items = await listFormSessions(targetOrg, {
      limit: Number(src.limit) || 50,
      workflowId: normStr(src.workflowId) || null,
      status: normStr(src.status) || null,
    });
    void caller;
    res.status(200).json({ ok: true, items, count: items.length });
  },
  { auth: "user", appCheck: false, methods: ["GET", "OPTIONS"] }
);

/** GET /formsCustomerSearch — authed staff; org-scoped customer list for the search bar. */
export const formsCustomerSearch_http = secureHandler(
  async (req, res) => {
    const caller = req.user!;
    const targetOrg = getTargetOrg(req, req.query);
    void caller;
    const query = (req.query as Record<string, unknown>) || {};
    const items = await listCustomersForForms(targetOrg, Number(query.limit) || 5000);
    res.status(200).json({ ok: true, items, count: items.length });
  },
  { auth: "user", appCheck: false, methods: ["GET", "OPTIONS"] }
);

/**
 * GET /formsCustomerDetail?id= — authed staff; full(er) customer doc view + the
 * normalized household object for the forms-app header. Org-scoped (the service
 * rejects cross-org reads).
 */
export const formsCustomerDetail_http = secureHandler(
  async (req, res) => {
    const caller = req.user!;
    const targetOrg = getTargetOrg(req, req.query);
    void caller;
    const q = (req.query || {}) as Record<string, unknown>;
    const id = normId(q.id) || normStr(q.id);
    const detail = await getCustomerDetailForForms(targetOrg, String(id || ""));
    if (!detail) {
      res.status(404).json({ ok: false, error: "not_found" });
      return;
    }
    res.status(200).json({ ok: true, detail });
  },
  { auth: "user", appCheck: false, methods: ["GET", "OPTIONS"] }
);

/** GET /formsCreditCardsSummary — authed staff; org credit-card spend cards (reuses budget summary). */
export const formsCreditCardsSummary_http = secureHandler(
  async (req, res) => {
    const caller = req.user!;
    const targetOrg = getTargetOrg(req, req.query);
    void caller;
    const q = (req.query || {}) as Record<string, unknown>;
    const out = await summarizeCreditCards(targetOrg, {
      month: normStr(q.month) || null,
      active: q.active != null ? String(q.active) : "true",
    });
    res.status(200).json({ ok: true, ...out });
  },
  { auth: "user", appCheck: false, methods: ["GET", "OPTIONS"] }
);

/**
 * GET/POST /resolveFormSession — public, token-gated.
 * No Firebase auth (QR / direct link). App Check disabled so a cold QR scan works.
 */
export const resolveFormSession_http = secureHandler(
  async (req, res) => {
    const src = (req.method === "GET" ? req.query : req.body) || {};
    const { token } = FormSessionResolveBody.parse({ token: normStr((src as any).token) });
    const session = await resolveFormSession(token);
    res.status(200).json({ ok: true, session });
  },
  { auth: "public", appCheck: false, methods: ["GET", "POST", "OPTIONS"] }
);

/** POST /completeFormSession — public, token-gated; links the submission back. */
export const completeFormSession_http = secureHandler(
  async (req, res) => {
    const body = FormSessionCompleteBody.parse(req.body);
    const out = await completeFormSession({
      token: body.token,
      jotformSubmissionId: body.jotformSubmissionId ?? null,
      submission: (body.submission as Record<string, unknown> | null) ?? null,
    });
    res.status(200).json({ ok: true, ...out });
  },
  { auth: "public", appCheck: false, methods: ["POST", "OPTIONS"] }
);
