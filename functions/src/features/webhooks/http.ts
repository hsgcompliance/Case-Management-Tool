// functions/src/features/webhooks/http.ts
import * as logger from "firebase-functions/logger";
import { secureHandler, orgIdFromClaims, hasLevel, normStr, JOTFORM_API_KEY_SECRET } from "../../core";
import {
  parseRequestFields,
  storeJotformWebhookEvent,
  listWebhookEvents,
  listWebhookEventDetails,
  upsertFormRegistry,
  listFormsRegistry,
  updateFormRegistry,
  getFormSchema,
} from "./service";

const ALLOWED_KINDS = new Set(["general", "payment", "intake"]);
const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB hard cap on inbound webhook bodies

/**
 * POST /jotformWebhook?token=... — public Jotform webhook receiver.
 * No Firebase auth (Jotform can't authenticate); optional shared-secret token
 * from JOTFORM_WEBHOOK_TOKEN. App Check disabled.
 */
export const jotformWebhook_http = secureHandler(
  async (req, res) => {
    const expected = String(process.env.JOTFORM_WEBHOOK_TOKEN || "").trim();
    if (expected) {
      const got = String((req.query?.token ?? "") || "").trim();
      if (got !== expected) {
        res.status(403).json({ ok: false, error: "forbidden" });
        return;
      }
    }

    // Hard size cap — the receiver is public; don't let it ingest huge bodies.
    const rawLen = (req as unknown as { rawBody?: Buffer }).rawBody?.length ?? 0;
    if (rawLen > MAX_BODY_BYTES) {
      res.status(413).json({ ok: false, error: "payload_too_large" });
      return;
    }

    const rawKind = String((req.query?.kind ?? "") || "").trim().toLowerCase();
    const kind = ALLOWED_KINDS.has(rawKind) ? rawKind : "general";
    const orgId = normStr(req.query?.orgId);
    if (!orgId) {
      logger.warn("jotform_webhook_missing_org", { kind });
    }

    let fields: Record<string, string> = {};
    try {
      fields = await parseRequestFields(req);
    } catch (e) {
      logger.warn("jotform_webhook_parse_failed", { message: (e as Error)?.message });
    }

    const out = await storeJotformWebhookEvent(fields, {
      ip: (req.ip as string) || null,
      contentType: String(req.headers["content-type"] || "") || null,
      kind,
      orgId,
    });

    // Auto-register the form under its category (payment/intake) if not already.
    try {
      await upsertFormRegistry(out.formId, kind);
    } catch (e) {
      logger.warn("forms_registry_upsert_failed", { formId: out.formId, message: (e as Error)?.message });
    }

    logger.info("jotform_webhook_received", { id: out.id, formId: out.formId, submissionId: out.submissionId, kind });
    res.status(200).json({ ok: true, id: out.id });
  },
  { auth: "public", appCheck: false, methods: ["POST", "OPTIONS"], secrets: [JOTFORM_API_KEY_SECRET] }
);

/**
 * GET /formsWebhookConfig — authed staff. Returns the webhook destination URLs
 * (with the shared-secret token) so they can be copied into Jotform. Authed so the
 * token is never baked into the public SPA bundle.
 */
export const formsWebhookConfig_http = secureHandler(
  async (req, res) => {
    const caller = req.user!;
    const orgId = orgIdFromClaims(caller);
    if (!orgId) {
      res.status(400).json({ ok: false, error: "missing_org" });
      return;
    }
    const token = String(process.env.JOTFORM_WEBHOOK_TOKEN || "").trim();
    const project = String(process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "housing-db-v2");
    const base = `https://us-central1-${project}.cloudfunctions.net/jotformWebhook`;
    const destination = (kind?: "payment" | "intake") => {
      const params = new URLSearchParams();
      if (token) params.set("token", token);
      params.set("orgId", orgId);
      if (kind) params.set("kind", kind);
      return `${base}?${params.toString()}`;
    };
    const destinations = [
      { label: "All forms (general)", kind: "general", url: destination() },
      { label: "Payment forms (CC / invoice)", kind: "payment", url: destination("payment") },
      { label: "Intake forms", kind: "intake", url: destination("intake") },
    ];
    res.status(200).json({ ok: true, destinations, hasToken: !!token });
  },
  { auth: "user", requireOrg: true, methods: ["GET", "OPTIONS"] }
);

/** GET /formSchema?formId= — authed staff; normalized field list for a form (render-engine foundation). */
export const formSchema_http = secureHandler(
  async (req, res) => {
    const caller = req.user!;
    void caller;
    const formId = normStr((req.query as Record<string, unknown>)?.formId);
    const fields = await getFormSchema(formId);
    res.status(200).json({ ok: true, formId, fields, count: fields.length });
  },
  { auth: "user", methods: ["GET", "OPTIONS"], secrets: [JOTFORM_API_KEY_SECRET] }
);

/** GET /formsAuthInfo — authed; tells the UI whether the caller is an admin. */
export const formsAuthInfo_http = secureHandler(
  async (req, res) => {
    const caller = req.user!;
    res.status(200).json({ ok: true, isAdmin: hasLevel(caller, "admin") });
  },
  { auth: "user", methods: ["GET", "OPTIONS"] }
);

/** POST /formsRegistryUpdate — admin only. Title / category / customer-sendable overrides. */
export const formsRegistryUpdate_http = secureHandler(
  async (req, res) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const formId = normStr(body.formId);
    await updateFormRegistry(formId, {
      title: typeof body.title === "string" ? body.title : undefined,
      category: typeof body.category === "string" ? body.category : undefined,
      categories: Array.isArray(body.categories) ? (body.categories as unknown[]).map(String) : undefined,
      customerSendable: typeof body.customerSendable === "boolean" ? body.customerSendable : undefined,
      notifyOnSubmit: typeof body.notifyOnSubmit === "boolean" ? body.notifyOnSubmit : undefined,
      followUpIntake: typeof body.followUpIntake === "boolean" ? body.followUpIntake : undefined,
      buildHousehold: typeof body.buildHousehold === "boolean" ? body.buildHousehold : undefined,
      showCreditCards: typeof body.showCreditCards === "boolean" ? body.showCreditCards : undefined,
    });
    res.status(200).json({ ok: true, formId });
  },
  { auth: "admin", methods: ["POST", "OPTIONS"] }
);

/** GET /listFormsRegistry — authed staff. Forms auto-discovered from webhook traffic. */
export const listFormsRegistry_http = secureHandler(
  async (req, res) => {
    const caller = req.user!;
    void caller;
    const items = await listFormsRegistry();
    res.status(200).json({ ok: true, items, count: items.length });
  },
  { auth: "user", methods: ["GET", "OPTIONS"] }
);

/**
 * GET /listWebhookEventDetails?formIds=a,b,c&limit= — authed staff. Flattened
 * label/value fields per event for the forms-app Webhooks sidebar (structured
 * household extraction + copy-pastable raw view).
 */
export const listWebhookEventDetails_http = secureHandler(
  async (req, res) => {
    const caller = req.user!;
    const q = (req.query || {}) as Record<string, unknown>;
    const formIds = String(q.formIds || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50);
    const items = await listWebhookEventDetails({
      formIds,
      limit: Number(q.limit) || 50,
      callerOrg: orgIdFromClaims(caller),
      sinceISO: typeof q.since === "string" ? q.since : null,
      afterISO: typeof q.after === "string" ? q.after : null,
    });
    res.status(200).json({ ok: true, items, count: items.length });
  },
  {
    auth: "user",
    requireOrg: true,
    methods: ["GET", "OPTIONS"],
    memory: "512MiB",
  }
);

/** GET /listWebhookEvents — authed staff view of recent webhook captures. */
export const listWebhookEvents_http = secureHandler(
  async (req, res) => {
    const caller = req.user!;
    const items = await listWebhookEvents({
      limit: Number(req.query?.limit) || 50,
      callerOrg: orgIdFromClaims(caller),
    });
    res.status(200).json({ ok: true, items, count: items.length });
  },
  { auth: "user", methods: ["GET", "OPTIONS"] }
);
