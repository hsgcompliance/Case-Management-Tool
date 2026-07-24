// functions/src/features/renderForms/http.ts
import { secureHandler, orgIdFromClaims, hasLevel, requireOrg, normId, normStr, JOTFORM_API_KEY_SECRET } from "../../core";
import { createRenderSession, resolveRenderSession, submitRenderSession, parseSubmit } from "./service";

function getTargetOrg(req: any): string {
  const caller = req.user || {};
  const callerOrg = orgIdFromClaims(caller);
  if (callerOrg) return callerOrg;
  if (hasLevel(caller, "dev")) {
    const explicit = normId(req?.body?.orgId) || normId(req?.query?.orgId);
    if (explicit) return explicit;
  }
  return requireOrg(caller);
}

/** POST /renderFormCreate — authed staff mint a token link for a customer to fill a form. */
export const renderFormCreate_http = secureHandler(
  async (req, res) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const out = await createRenderSession({
      formId: normStr(body.formId),
      customerId: normStr(body.customerId) || null,
      caller: req.user!,
      orgId: getTargetOrg(req),
    });
    res.status(201).json({ ok: true, ...out });
  },
  { auth: "user", methods: ["POST", "OPTIONS"] }
);

/** GET/POST /renderFormResolve — public, token-gated. Returns the form's field schema + state. */
export const renderFormResolve_http = secureHandler(
  async (req, res) => {
    const src = (req.method === "GET" ? req.query : req.body) || {};
    const token = normStr((src as Record<string, unknown>).token);
    const out = await resolveRenderSession(token);
    res.status(200).json({ ok: true, ...out });
  },
  { auth: "public", appCheck: false, methods: ["GET", "POST", "OPTIONS"] }
);

/** POST /renderFormSubmit — public, token-gated, multipart. One submission only. */
export const renderFormSubmit_http = secureHandler(
  async (req, res) => {
    const parsed = await parseSubmit(req);
    const token = normStr(parsed.values.token);
    if (!token) {
      res.status(400).json({ ok: false, error: "missing_token" });
      return;
    }
    const out = await submitRenderSession(token, parsed);
    res.status(200).json({ ok: true, ...out });
  },
  { auth: "public", appCheck: false, methods: ["POST", "OPTIONS"], secrets: [JOTFORM_API_KEY_SECRET] }
);
