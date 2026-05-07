import {
  secureHandler,
  db,
  FieldPath,
  Timestamp,
  orgIdFromClaims,
  hasLevel,
  requireOrg,
  toDate,
  normId,
  normStr,
  sanitizeFlatObject,
  type AuthedRequest,
  type Claims,
} from "../../core";
import {
  CreditCardsListQuery,
  CreditCardsGetQuery,
  CreditCardsSummaryQuery,
  CreditCardUpsertBody,
  CreditCardPatchBody,
  CreditCardsDeleteBody,
  CreditCardsAdminDeleteBody,
} from "./schemas";
import {
  upsertCreditCards,
  patchCreditCards,
  softDeleteCreditCards,
  hardDeleteCreditCards,
  summarizeCreditCards,
  isCardActive,
} from "./service";

function explicitOrgFromReq(req: AuthedRequest, src: unknown): string {
  const fromQuery = normId(req?.query?.orgId);
  const fromBody = Array.isArray(src)
    ? normId((src[0] as { orgId?: unknown } | undefined)?.orgId)
    : normId((src as { orgId?: unknown } | null | undefined)?.orgId);
  return fromBody || fromQuery;
}

function getTargetOrg(req: AuthedRequest, src: unknown): string {
  const caller = req.user || {};
  const callerOrg = orgIdFromClaims(caller);
  if (callerOrg) return callerOrg;
  if (hasLevel(caller, "dev")) {
    const explicit = explicitOrgFromReq(req, src);
    if (explicit) return explicit;
  }
  return requireOrg(caller);
}

function assertCreditCardOrgAccess(
  caller: Claims,
  targetOrg: string,
  card: { orgId?: unknown } | null | undefined
) {
  const cardOrg = normId(card?.orgId);
  if (!cardOrg) return;
  if (cardOrg !== normId(targetOrg)) {
    if (hasLevel(caller, "dev")) return;
    const e = new Error("forbidden_org") as Error & { code: number };
    e.code = 403;
    throw e;
  }
}

export const creditCardsUpsert = secureHandler(
  async (req, res) => {
    const body = CreditCardUpsertBody.parse(req.body);
    const caller = req.user!;
    const targetOrg = getTargetOrg(req, req.body);
    const out = await upsertCreditCards(body, caller, targetOrg);
    res.status(201).json({ ok: true, ...out });
  },
  { auth: "admin", methods: ["POST", "OPTIONS"] }
);

export const creditCardsPatch = secureHandler(
  async (req, res) => {
    const body = CreditCardPatchBody.parse(req.body);
    const caller = req.user!;
    const targetOrg = getTargetOrg(req, req.body);
    const out = await patchCreditCards(body, caller, targetOrg);
    res.status(200).json({ ok: true, ...out });
  },
  { auth: "user", methods: ["PATCH", "OPTIONS"] }
);

export const creditCardsDelete = secureHandler(
  async (req, res) => {
    const ids = CreditCardsDeleteBody.parse(req.body);
    const caller = req.user!;
    const targetOrg = getTargetOrg(req, req.body);
    const out = await softDeleteCreditCards(ids, caller, targetOrg);
    res.status(200).json({ ok: true, ids: out.ids, deleted: true });
  },
  { auth: "admin", methods: ["POST", "OPTIONS"] }
);

export const creditCardsAdminDelete = secureHandler(
  async (req, res) => {
    const ids = CreditCardsAdminDeleteBody.parse(req.body);
    const caller = req.user!;
    const targetOrg = getTargetOrg(req, req.body);
    const out = await hardDeleteCreditCards(ids, caller, targetOrg);
    res.status(200).json({ ok: true, ...out });
  },
  { auth: "admin", methods: ["POST", "OPTIONS"] }
);

export const creditCardsList = secureHandler(
  async (req, res) => {
    const rawSrc = (req.method === "GET" ? req.query : req.body) || {};
    const sanitized = sanitizeFlatObject(rawSrc as Record<string, unknown>);
    if (sanitized.limit != null) {
      const n = Number(sanitized.limit);
      if (Number.isFinite(n)) sanitized.limit = Math.max(1, Math.min(500, n));
    }
    const parsed = CreditCardsListQuery.safeParse(sanitized);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: "invalid_query", issues: parsed.error.issues });
      return;
    }

    const src = parsed.data;
    const { status, active, limit = "200", cursorUpdatedAt, cursorId } = src;
    const caller = req.user!;
    const targetOrg = getTargetOrg(req, src);
    const lim = Math.max(1, Math.min(500, Number(limit) || 200));

    let q: FirebaseFirestore.Query = db
      .collection("creditCards")
      .where("orgId", "==", targetOrg);

    const statusStr = typeof status === "string" ? normStr(status) : undefined;
    if (statusStr) q = q.where("status", "==", statusStr);

    const activeFilter =
      active === "true" || active === true
        ? true
        : active === "false" || active === false
        ? false
        : undefined;
    const fetchLimit = activeFilter === undefined ? lim : 500;

    q = q.orderBy("updatedAt", "desc").orderBy(FieldPath.documentId(), "desc").limit(fetchLimit);

    const parseCursorTs = (v: unknown): FirebaseFirestore.Timestamp => {
      if (typeof v === "string" || typeof v === "number") {
        // Handle numeric strings as epoch millis
        const num = typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v;
        const d = toDate(num as string | number | Date);
        if (d) return Timestamp.fromDate(d);
      }
      const ts =
        (v as
          | {
              seconds?: unknown;
              _seconds?: unknown;
              nanoseconds?: unknown;
              _nanoseconds?: unknown;
            }
          | null
          | undefined) ?? {};
      const sec = Number(ts.seconds ?? ts._seconds ?? 0) || 0;
      const ns = Number(ts.nanoseconds ?? ts._nanoseconds ?? 0) || 0;
      return new Timestamp(sec, ns);
    };

    if (cursorUpdatedAt && cursorId) {
      q = q.startAfter(parseCursorTs(cursorUpdatedAt), String(cursorId));
    }

    const snap = await q.get();
    const docs = snap.docs;
    const items = docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter((card) => activeFilter === undefined || isCardActive(card as Record<string, unknown>) === activeFilter)
      .slice(0, lim);
    items.forEach((card) => assertCreditCardOrgAccess(caller, targetOrg, card as Record<string, unknown>));

    const last = docs.length ? docs[docs.length - 1] : null;
    const lastUpdated = (last?.get("updatedAt") ?? null) as FirebaseFirestore.Timestamp | null | undefined;
    const next = last
      ? {
          cursorUpdatedAt: lastUpdated ?? Timestamp.fromMillis(0),
          cursorId: last.id,
        }
      : null;

    res.status(200).json({ ok: true, items, next, orgId: targetOrg });
  },
  { auth: "user", methods: ["GET", "POST", "OPTIONS"] }
);

export const creditCardsGet = secureHandler(
  async (req, res) => {
    const rawSrc = (req.method === "GET" ? req.query : req.body) || {};
    const src = CreditCardsGetQuery.parse(sanitizeFlatObject(rawSrc as Record<string, unknown>));
    const caller = req.user!;
    const targetOrg = getTargetOrg(req, src);
    const id = normStr(src?.id);
    if (!id) {
      res.status(400).json({ ok: false, error: "missing_id" });
      return;
    }

    const snap = await db.collection("creditCards").doc(id).get();
    if (!snap.exists) {
      res.status(404).json({ ok: false, error: "not_found" });
      return;
    }

    const card = snap.data() || {};
    assertCreditCardOrgAccess(caller, targetOrg, card);
    res.status(200).json({ ok: true, card: { id: snap.id, ...card } });
  },
  { auth: "user", methods: ["GET", "POST", "OPTIONS"] }
);

export const creditCardsStructure = secureHandler(
  async (_req, res) => {
    const structure = {
      kind: "credit_card",
      name: "",
      code: "",
      status: "draft",
      issuer: "",
      network: "",
      last4: "",
      cycleType: "calendar_month",
      statementCloseDay: null,
      monthlyLimitCents: 0,
      limitOverrides: [],
      matching: {
        aliases: [],
        cardAnswerValues: [],
        formIds: {
          creditCard: null,
          invoice: null,
        },
      },
      notes: "",
      meta: {},
    };
    res.status(200).json({ ok: true, structure });
  },
  { auth: "user", methods: ["GET", "OPTIONS"] }
);

export const creditCardsSummary = secureHandler(
  async (req, res) => {
    const rawSrc = (req.method === "GET" ? req.query : req.body) || {};
    const src = CreditCardsSummaryQuery.parse(sanitizeFlatObject(rawSrc as Record<string, unknown>));
    const targetOrg = getTargetOrg(req, src);
    const active =
      src.active === 1 || src.active === "1"
        ? true
        : src.active === 0 || src.active === "0"
        ? false
        : src.active == null
        ? null
        : src.active;
    const out = await summarizeCreditCards(targetOrg, {
      id: src.id ? String(src.id) : null,
      month: src.month ? String(src.month) : null,
      active,
    });
    res.status(200).json({ ok: true, ...out });
  },
  { auth: "user", methods: ["GET", "POST", "OPTIONS"] }
);
