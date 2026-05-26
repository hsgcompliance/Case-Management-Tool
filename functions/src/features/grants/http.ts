// functions/src/features/grants/http.ts
import {
  secureHandler,
  db,
  FieldPath,
  FieldValue,
  Timestamp,
  orgIdFromClaims,
  hasLevel,
  requireOrg,
  toDate,
  toUtcIso,
  normId,
  normStr,
  sanitizeFlatObject,
  newBulkWriter,
  fromBudgetCents,
  toBudgetCents,
  z,
  type AuthedRequest,
  type Claims,
} from "../../core";

import {
  GrantsListQuery,
  GrantsGetQuery,
  GrantsActivityQuery,
  GrantUpsertBody,
  GrantPatchBody,
  GrantsDeleteBody,
  GrantsAdminDeleteBody,
} from "./schemas";

import {
  upsertGrants,
  patchGrants,
  softDeleteGrants,
  hardDeleteGrants,
} from "./service";

/** Pull explicit orgId for dev/superdev scenarios (supports arrays + query param). */
function explicitOrgFromReq(req: AuthedRequest, src: unknown): string {
  const fromQuery = normId(req?.query?.orgId);
  const fromBody = Array.isArray(src)
    ? normId((src[0] as { orgId?: unknown } | undefined)?.orgId)
    : normId((src as { orgId?: unknown } | null | undefined)?.orgId);
  return fromBody || fromQuery;
}

/** Resolve target org for org-scoped ops. */
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

function assertGrantOrgAccess(
  caller: Claims,
  targetOrg: string,
  grant: { orgId?: unknown } | null | undefined,
) {
  const gOrg = normId(grant?.orgId);
  if (!gOrg) return; // legacy/unscoped grants allowed during migration
  if (gOrg !== normId(targetOrg)) {
    // devs may inspect/write cross-org only when targetOrg was explicit
    if (hasLevel(caller, "dev")) return;
    const e = new Error("forbidden_org") as Error & { code: number };
    e.code = 403;
    throw e;
  }
}

/** POST /grantsUpsert — admin; single or array */
export const grantsUpsert = secureHandler(
  async (req, res) => {
    const parsed = GrantUpsertBody.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ ok: false, error: "invalid_body", issues: parsed.error.issues });
      return;
    }
    const body = parsed.data;
    const caller = req.user!;
    const targetOrg = getTargetOrg(req, req.body);
    const out = await upsertGrants(body, caller, targetOrg);
    res.status(201).json({ ok: true, ...out });
  },
  { auth: "admin", methods: ["POST", "OPTIONS"] },
);

/** PATCH /grantsPatch — verified org users (service enforces org invariants) */
export const grantsPatch = secureHandler(
  async (req, res) => {
    const parsed = GrantPatchBody.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ ok: false, error: "invalid_body", issues: parsed.error.issues });
      return;
    }
    const body = parsed.data;
    const caller = req.user!;
    const targetOrg = getTargetOrg(req, req.body);
    const out = await patchGrants(body, caller, targetOrg);
    res.status(200).json({ ok: true, ...out });
  },
  { auth: "user", methods: ["PATCH", "OPTIONS"] },
);

/** POST /grantsDelete — admin; id or ids[] (soft) */
export const grantsDelete = secureHandler(
  async (req, res) => {
    const parsed = GrantsDeleteBody.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ ok: false, error: "invalid_body", issues: parsed.error.issues });
      return;
    }
    const ids = parsed.data;

    const caller = req.user!;
    const targetOrg = getTargetOrg(req, req.body);

    const out = await softDeleteGrants(ids, caller, targetOrg);
    res.status(200).json({ ok: true, ids: out.ids, deleted: true });
  },
  { auth: "admin", methods: ["POST", "OPTIONS"] },
);

/** POST /grantsAdminDelete — admin; id or ids[] (hard) */
export const grantsAdminDelete = secureHandler(
  async (req, res) => {
    const parsed = GrantsAdminDeleteBody.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ ok: false, error: "invalid_body", issues: parsed.error.issues });
      return;
    }
    const ids = parsed.data;

    const caller = req.user!;
    const targetOrg = getTargetOrg(req, req.body);

    const out = await hardDeleteGrants(ids, caller, targetOrg);
    res.status(200).json({ ok: true, ...out });
  },
  { auth: "admin", methods: ["POST", "OPTIONS"] },
);

/** GET/POST /grantsList — org-scoped; cursor by updatedAt desc */
export const grantsList = secureHandler(
  async (req, res) => {
    const rawSrc = (req.method === "GET" ? req.query : req.body) || {};
    const sanitized = sanitizeFlatObject(rawSrc as Record<string, unknown>);

    // Be tolerant of oversized client limits; clamp before schema parse.
    if (sanitized.limit != null) {
      const n = Number(sanitized.limit);
      if (Number.isFinite(n)) {
        sanitized.limit = Math.max(1, Math.min(500, n));
      }
    }

    const parsed = GrantsListQuery.safeParse(sanitized);
    if (!parsed.success) {
      res
        .status(400)
        .json({ ok: false, error: "invalid_query", issues: parsed.error.issues });
      return;
    }
    const src = parsed.data;

    const {
      status,
      active,
      kind,
      limit = "200",
      cursorUpdatedAt,
      cursorId,
    } = src;

    const caller = req.user!;
    const targetOrg = getTargetOrg(req, src);
    const lim = Math.max(1, Math.min(500, Number(limit) || 200));

    let q: FirebaseFirestore.Query = db
      .collection("grants")
      .where("orgId", "==", targetOrg);

    const statusStr = typeof status === "string" ? normStr(status) : undefined;
    if (statusStr) q = q.where("status", "==", statusStr);

    if (active === "true" || active === true) q = q.where("active", "==", true);
    if (active === "false" || active === false)
      q = q.where("active", "==", false);

    const kindStr = typeof kind === "string" ? normStr(kind) : undefined;
    if (kindStr === "grant" || kindStr === "program") {
      q = q.where("kind", "==", kindStr);
    }

    q = q
      .orderBy("updatedAt", "desc")
      .orderBy(FieldPath.documentId(), "desc")
      .limit(lim);

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
      const ts = parseCursorTs(cursorUpdatedAt);
      q = q.startAfter(ts, String(cursorId));
    }

    const snap = await q.get();
    let docs = snap.docs;

    const requestedActive =
      active === "true" || active === true
        ? true
        : active === "false" || active === false
          ? false
          : null;

    const updatedAtMillis = (value: unknown): number => {
      const maybe = value as { toMillis?: () => number } | null | undefined;
      if (typeof maybe?.toMillis === "function") {
        const ms = maybe.toMillis();
        if (Number.isFinite(ms)) return ms;
      }
      const d = toDate(value as string | number | Date);
      return d ? d.getTime() : 0;
    };

    const matchesFallbackFilters = (g: Record<string, unknown>) => {
      const docStatus = normStr(g.status);
      const docDeleted = g.deleted === true || docStatus === "deleted";

      if (statusStr && docStatus !== statusStr) return false;

      if (requestedActive !== null) {
        const docActive =
          g.active === true ||
          (g.active !== false && !docDeleted && (!docStatus || docStatus === "active"));
        if (requestedActive && !docActive) return false;
        if (!requestedActive && docActive) return false;
      }

      if (kindStr === "program") return normStr(g.kind) === "program";
      if (kindStr === "grant") return normStr(g.kind) !== "program";

      return true;
    };

    // Migration fallback: older grant docs can be missing `updatedAt` and/or
    // `active`, and Firestore excludes such docs from orderBy/where results.
    // Merge in org-scoped legacy docs and filter/sort in memory so budget tools
    // do not collapse to zero while the collection is being normalized.
    if (docs.length < lim) {
      const legacySnap = await db
        .collection("grants")
        .where("orgId", "==", targetOrg)
        .limit(1000)
        .get();
      const byId = new Map(docs.map((d) => [d.id, d]));
      for (const d of legacySnap.docs) {
        if (byId.has(d.id)) continue;
        if (!matchesFallbackFilters(d.data() || {})) continue;
        byId.set(d.id, d);
      }
      docs = Array.from(byId.values())
        .sort((a, b) => {
          const aMs = updatedAtMillis(a.get("updatedAt"));
          const bMs = updatedAtMillis(b.get("updatedAt"));
          if (aMs !== bMs) return bMs - aMs;
          return String(b.id).localeCompare(String(a.id));
        })
        .slice(0, lim);
    }

    const items = docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));

    // Defensive: assert org access (legacy/unscoped tolerated elsewhere)
    items.forEach((g) =>
      assertGrantOrgAccess(caller, targetOrg, g as Record<string, unknown>),
    );

    const last = docs.length ? docs[docs.length - 1] : null;
    const lastUpdated = (last?.get("updatedAt") ?? null) as
      | FirebaseFirestore.Timestamp
      | null
      | undefined;

    const next = last
      ? {
          cursorUpdatedAt: lastUpdated ?? Timestamp.fromMillis(0),
          cursorId: last.id,
        }
      : null;

    res.status(200).json({ ok: true, items, next, orgId: targetOrg });
  },
  { auth: "viewer", methods: ["GET", "POST", "OPTIONS"] },
);

/** GET/POST /grantsGet?id=... — org-scoped */
export const grantsGet = secureHandler(
  async (req, res) => {
    const rawSrc = (req.method === "GET" ? req.query : req.body) || {};
    const parsed = GrantsGetQuery.safeParse(
      sanitizeFlatObject(rawSrc as Record<string, unknown>),
    );
    if (!parsed.success) {
      res
        .status(400)
        .json({ ok: false, error: "invalid_query", issues: parsed.error.issues });
      return;
    }
    const src = parsed.data;
    const caller = req.user!;
    const targetOrg = getTargetOrg(req, src);

    const id = normStr(src?.id);
    if (!id) {
      res.status(400).json({ ok: false, error: "missing_id" });
      return;
    }

    const snap = await db.collection("grants").doc(id).get();
    if (!snap.exists) {
      res.status(404).json({ ok: false, error: "not_found" });
      return;
    }

    const grant = snap.data() || {};
    assertGrantOrgAccess(caller, targetOrg, grant);

    res.status(200).json({ ok: true, grant: { id: snap.id, ...grant } });
  },
  { auth: "viewer", methods: ["GET", "POST", "OPTIONS"] },
);

/** GET /grantsStructure — skeleton for create forms */
export const grantsStructure = secureHandler(
  async (_req, res) => {
    const structure = {
      name: "",
      status: "draft",
      kind: "grant", // canonical default
      budgetMode: "budgeted",

      duration: "1 Year",
      startDate: "",
      endDate: "",

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

      taskTypes: [],
      tasks: {}, // MUST be record, not array
      meta: {},
    };
    res.status(200).json({ ok: true, structure });
  },
  { auth: "viewer", methods: ["GET", "OPTIONS"] },
);

/** GET/POST /grantsActivity?grantId=...&limit=... — org-scoped */
export const grantsActivity = secureHandler(
  async (req, res) => {
    const rawSrc = (req.method === "GET" ? req.query : req.body) || {};
    const parsed = GrantsActivityQuery.safeParse(
      sanitizeFlatObject(rawSrc as Record<string, unknown>),
    );
    if (!parsed.success) {
      res
        .status(400)
        .json({ ok: false, error: "invalid_query", issues: parsed.error.issues });
      return;
    }
    const src = parsed.data;
    const caller = req.user!;
    const targetOrg = getTargetOrg(req, src);

    const grantId = normId(src?.grantId);
    const limit = Math.max(
      1,
      Math.min(1000, parseInt(String(src?.limit ?? "200"), 10) || 200),
    );
    const cursorOffset = Math.max(0, parseInt(String(src?.cursor ?? "0"), 10) || 0);
    const includeProjected =
      src?.includeProjected === undefined
        ? true
        : !["false", "0", "no", "n"].includes(String(src.includeProjected).trim().toLowerCase());
    if (!grantId) {
      res.status(400).json({ ok: false, error: "missing_grantId" });
      return;
    }

    // verify grant org access up front
    const gSnap = await db.collection("grants").doc(grantId).get();
    if (!gSnap.exists) {
      res.status(404).json({ ok: false, error: "grant_not_found" });
      return;
    }
    const gData = gSnap.data() || {};
    assertGrantOrgAccess(caller, targetOrg, gData);

    const grantOrg = normId(gData.orgId);
    const rowOrgAllowed = (row: Record<string, unknown>) => {
      const rowOrg = normId(row.orgId);
      return !rowOrg || !grantOrg || rowOrg === grantOrg || hasLevel(caller, "dev");
    };
    const isoFrom = (...values: unknown[]) => {
      for (const value of values) {
        const iso = toUtcIso(value as string | number | Date);
        if (iso) return iso;
      }
      return new Date().toISOString();
    };
    const amountDollars = (row: Record<string, unknown>) => {
      const cents = Number(row.amountCents);
      if (Number.isFinite(cents)) return cents / 100;
      const amount = Number(row.amount);
      return Number.isFinite(amount) ? amount : 0;
    };
    const clean = (row: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));
    const activity: Array<Record<string, unknown>> = [];
    const ledgerKeys = new Set<string>();
    const legacyKeys = new Set<string>();

    const ledgerSnap = await db
      .collection("ledger")
      .where("grantId", "==", grantId)
      .get();

    for (const doc of ledgerSnap.docs) {
      const row = { id: doc.id, ...(doc.data() || {}) } as Record<string, unknown>;
      if (!rowOrgAllowed(row)) continue;
      const amount = amountDollars(row);
      const origin = (row.origin && typeof row.origin === "object" ? row.origin : {}) as Record<string, unknown>;
      const enrollmentId = String(row.enrollmentId || "").trim();
      const paymentId = String(origin.baseId || row.paymentId || "").trim();
      const ts = isoFrom(row.postedAt, row.dueDate, row.createdAt, doc.updateTime);
      const sourcePath = String(origin.sourcePath || "").trim();
      if (sourcePath) ledgerKeys.add(`path:${sourcePath}`);
      if (enrollmentId || paymentId) {
        ledgerKeys.add(`match:${enrollmentId}:${paymentId}:${Math.round(amount * 100)}`);
      }

      activity.push(clean({
        id: `ledger:${doc.id}`,
        kind: amount < 0 || row.reversalOf || origin.reversalOf ? "reversal" : "spend",
        sourceType: "ledger",
        grantId,
        enrollmentId,
        paymentId: paymentId || null,
        lineItemId: row.lineItemId ?? null,
        amount,
        note: row.note ?? row.comment ?? row.description ?? null,
        ts,
        by: row.postedBy ?? row.by ?? origin.postedBy ?? null,
        reversalOf: row.reversalOf ?? origin.reversalOf ?? null,
        queueStatus: null,
        customerId: row.customerId ?? null,
        customerNameAtSpend: row.customerNameAtSpend ?? null,
        grantNameAtSpend: row.grantNameAtSpend ?? null,
        lineItemLabelAtSpend: row.lineItemLabelAtSpend ?? null,
        paymentLabelAtSpend: row.paymentLabelAtSpend ?? null,
        ledgerEntry: row,
      }));
    }

    if (includeProjected) {
      const queueSnap = await db
        .collection("paymentQueue")
        .where("grantId", "==", grantId)
        .where("queueStatus", "==", "pending")
        .get();

      for (const doc of queueSnap.docs) {
        const row = { id: doc.id, ...(doc.data() || {}) } as Record<string, unknown>;
        if (!rowOrgAllowed(row)) continue;
        const source = String(row.source || "").toLowerCase();
        if (!["projection", "invoice", "credit-card"].includes(source)) continue;
        const amount = Number(row.amount || 0);
        if (!Number.isFinite(amount) || amount === 0) continue;
        activity.push(clean({
          id: `queue:${doc.id}`,
          kind: "projection",
          sourceType: "paymentQueue",
          grantId,
          enrollmentId: String(row.enrollmentId || ""),
          paymentId: row.paymentId ?? row.submissionId ?? null,
          lineItemId: row.lineItemId ?? null,
          amount,
          note: row.note ?? row.notes ?? row.purpose ?? row.descriptor ?? null,
          ts: isoFrom(row.dueDate, row.createdAt, row.postedAt, doc.updateTime),
          by: row.postedBy ?? row.reopenedBy ?? null,
          reversalOf: null,
          queueStatus: row.queueStatus ?? null,
          customerId: row.customerId ?? null,
          customerName: row.customer ?? null,
          paymentQueueItem: row,
        }));
      }
    }

    try {
      const cg = db
        .collectionGroup("spends")
        .where("grantId", "==", grantId);
      const snap = await cg.get();
      for (const d of snap.docs) {
        const s = d.data() as Record<string, unknown>;
        const amount = Number(s.amount || 0);
        const enrollmentId = String(s.enrollmentId || d.ref.parent.parent?.id || "").trim();
        const paymentId = String(s.paymentId || "").trim();
        const sourcePath = d.ref.path;
        const matchKey = `match:${enrollmentId}:${paymentId}:${Math.round(amount * 100)}`;
        if (ledgerKeys.has(`path:${sourcePath}`) || ledgerKeys.has(matchKey)) continue;
        legacyKeys.add(matchKey);
        activity.push(clean({
          id: `legacy:${s.id || d.id}`,
          kind: amount < 0 ? "reversal" : "spend",
          sourceType: "legacySpend",
          grantId,
          enrollmentId,
          paymentId: s.paymentId ?? null,
          lineItemId: s.lineItemId ?? null,
          amount,
          note: s.note ?? null,
          ts: isoFrom(s.ts, d.updateTime),
          by: s.by ?? null,
          reversalOf: s.reversalOf ?? null,
        }));
      }
    } catch {
      // Legacy supplement is best effort only; ledger remains authoritative.
    }

    const enrollmentSnap = await db
      .collection("customerEnrollments")
      .where("grantId", "==", grantId)
      .get();
    for (const doc of enrollmentSnap.docs) {
      const enrollment = doc.data() || {};
      const spends = Array.isArray(enrollment.spends) ? enrollment.spends : [];
      for (let i = 0; i < spends.length; i++) {
        const spend = (spends[i] || {}) as Record<string, unknown>;
        const amount = Number(spend.amount || 0);
        const paymentId = String(spend.paymentId || "").trim();
        const matchKey = `match:${doc.id}:${paymentId}:${Math.round(amount * 100)}`;
        if (ledgerKeys.has(matchKey) || legacyKeys.has(matchKey)) continue;
        legacyKeys.add(matchKey);
        activity.push(clean({
          id: `legacy-array:${spend.id || `act_${doc.id}_${paymentId || "nopay"}_${i}`}`,
          kind: amount < 0 ? "reversal" : "spend",
          sourceType: "legacySpend",
          grantId,
          enrollmentId: doc.id,
          paymentId: spend.paymentId ?? null,
          lineItemId: spend.lineItemId ?? null,
          amount,
          note: spend.note ?? null,
          ts: isoFrom(spend.ts, doc.updateTime),
          by: spend.by ?? null,
          reversalOf: spend.reversalOf ?? null,
        }));
      }
    }

    activity.sort((a, b) => {
      const dateCmp = String(b.ts || "").localeCompare(String(a.ts || ""));
      if (dateCmp) return dateCmp;
      return String(b.id || "").localeCompare(String(a.id || ""));
    });

    const page = activity.slice(cursorOffset, cursorOffset + limit);
    const nextOffset = cursorOffset + page.length;
    const counts = {
      total: activity.length,
      ledger: activity.filter((row) => row.sourceType === "ledger").length,
      projected: activity.filter((row) => row.sourceType === "paymentQueue").length,
      legacy: activity.filter((row) => row.sourceType === "legacySpend").length,
    };
    res.status(200).json({
      ok: true,
      items: page,
      next: nextOffset < activity.length ? { cursor: String(nextOffset) } : null,
      counts,
    });
  },
  { auth: "viewer", methods: ["GET", "POST", "OPTIONS"] },
);

/**
 * GET/POST /grantsAdminPreview — admin; returns impact counts for the three
 * admin operations without making any changes.  Used to populate the Admin tab
 * impact estimates before the user confirms a destructive action.
 */
export const grantsAdminPreview = secureHandler(
  async (req, res) => {
    const rawSrc = (req.method === "GET" ? req.query : req.body) || {};
    const parsed = z.object({ grantId: z.string().min(1) }).safeParse(rawSrc);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: "invalid_body", issues: parsed.error.issues });
      return;
    }
    const { grantId } = parsed.data;
    const caller = req.user!;
    const targetOrg = getTargetOrg(req, rawSrc);

    const gSnap = await db.collection("grants").doc(grantId).get();
    if (!gSnap.exists) { res.status(404).json({ ok: false, error: "grant_not_found" }); return; }
    const gData = gSnap.data() || {};
    assertGrantOrgAccess(caller, targetOrg, gData);
    const grantOrg = normId(gData.orgId) || normId(targetOrg);

    const [ledgerSnap, queueSnap, enrollSnap] = await Promise.all([
      db.collection("ledger").where("grantId", "==", grantId).get(),
      db.collection("paymentQueue").where("grantId", "==", grantId).get(),
      db.collection("customerEnrollments").where("grantId", "==", grantId).get(),
    ]);

    // ── Ledger breakdown ────────────────────────────────────────────────────
    let enrollLedgerCount = 0; let enrollLedgerAmount = 0;
    let ccLedgerCount = 0;     let ccLedgerAmount = 0;
    for (const d of ledgerSnap.docs) {
      const row = d.data() as Record<string, unknown>;
      if (!_docBelongsToGrant(row, grantId, grantOrg)) continue;
      const source = normStr(row.source) || "";
      const amount = Number(row.amountCents != null ? Number(row.amountCents) / 100 : row.amount ?? 0);
      if (!Number.isFinite(amount)) continue;
      if (_CC_SOURCES.has(source)) { ccLedgerCount++; ccLedgerAmount += amount; }
      else if (normStr(row.enrollmentId)) { enrollLedgerCount++; enrollLedgerAmount += amount; }
    }

    // ── Queue breakdown ─────────────────────────────────────────────────────
    let projCount = 0; let projAmount = 0;
    let ccQueueCount = 0; let ccQueueAmount = 0;
    for (const d of queueSnap.docs) {
      const row = d.data() as Record<string, unknown>;
      if (!_docBelongsToGrant(row, grantId, grantOrg)) continue;
      const source = normStr(row.source) || "";
      const amount = Number(row.amount ?? 0);
      if (!Number.isFinite(amount)) continue;
      if (source === "projection") { projCount++; projAmount += amount; }
      else if (_CC_SOURCES.has(source)) { ccQueueCount++; ccQueueAmount += amount; }
    }

    // ── Enrollment breakdown ────────────────────────────────────────────────
    let activeEnrollments = 0; let inactiveEnrollments = 0; let deletedEnrollments = 0;
    let spendMirrorCount = 0; let spendMirrorAmount = 0;
    for (const d of enrollSnap.docs) {
      const row = d.data() as Record<string, unknown>;
      if (!_docBelongsToGrant(row, grantId, grantOrg)) continue;
      if (row.deleted === true || row.status === "deleted") deletedEnrollments++;
      else if (row.active === true) activeEnrollments++;
      else inactiveEnrollments++;

      const embeddedSpends = Array.isArray(row.spends) ? row.spends : [];
      for (const spend of embeddedSpends) {
        const amount = Number((spend as Record<string, unknown>)?.amount ?? 0);
        if (Number.isFinite(amount)) spendMirrorAmount += amount;
        spendMirrorCount++;
      }

      const subSpendSnap = await d.ref.collection("spends").get();
      spendMirrorCount += subSpendSnap.size;
      for (const spendDoc of subSpendSnap.docs) {
        const amount = Number((spendDoc.data() as Record<string, unknown>)?.amount ?? 0);
        if (Number.isFinite(amount)) spendMirrorAmount += amount;
      }
    }

    const budget = (gData.budget || {}) as Record<string, unknown>;
    const totals = (budget.totals || {}) as Record<string, unknown>;

    res.status(200).json({
      ok: true,
      ledger: {
        enrollmentSpends: { count: enrollLedgerCount, amount: enrollLedgerAmount },
        ccInvoice: { count: ccLedgerCount, amount: ccLedgerAmount },
      },
      paymentQueue: {
        projections: { count: projCount, amount: projAmount },
        ccInvoice: { count: ccQueueCount, amount: ccQueueAmount },
      },
      spendMirrors: { count: spendMirrorCount, amount: spendMirrorAmount },
      enrollments: {
        active: activeEnrollments,
        inactive: inactiveEnrollments,
        deleted: deletedEnrollments,
        total: activeEnrollments + inactiveEnrollments + deletedEnrollments,
      },
      currentBudget: {
        total: Number(budget.total ?? 0),
        spent: Number(totals.spent ?? 0),
        projected: Number(totals.projected ?? 0),
        balance: Number(totals.balance ?? 0),
        projectedBalance: Number(totals.projectedBalance ?? 0),
      },
    });
  },
  { auth: "admin", methods: ["GET", "POST", "OPTIONS"] },
);

// ─── Shared helpers for admin budget ops ─────────────────────────────────────

/** Sources that indicate a CC or invoice payment — never touch these in enrollment-clear ops. */
const _CC_SOURCES = new Set(["credit-card", "invoice"]);

/**
 * Per-doc guard: returns true only if the doc genuinely belongs to the
 * target grant AND the target org. This is a second line of defence after
 * the Firestore query predicate — it prevents acting on docs that somehow
 * slipped through (e.g. index lag, cross-shard reads during a rollout, or
 * a future refactor that changes the query).
 */
function _docBelongsToGrant(
  data: Record<string, unknown>,
  grantId: string,
  grantOrg: string,
): boolean {
  if (normStr(data.grantId) !== grantId) return false;
  const docOrg = normStr(data.orgId);
  // Tolerate legacy unscoped docs (no orgId) only if grant org is also unscoped.
  if (docOrg && grantOrg && docOrg !== grantOrg) return false;
  return true;
}

function _grantKind(data: Record<string, unknown>): "grant" | "program" {
  return normStr(data.kind) === "program" ? "program" : "grant";
}

function _rejectProgramBudgetAction(
  res: { status: (code: number) => { json: (body: Record<string, unknown>) => void } },
  action: string,
): boolean {
  res.status(400).json({
    ok: false,
    error: "program_has_no_budget",
    message: `Programs do not use grant budget workflows. ${action} is only available for funding-source grants.`,
  });
  return true;
}

/**
 * Recomputes budget totals from live ledger + pending paymentQueue data and
 * writes them back to the grant document.  Both callers (clearPayments and
 * reconcileBudget) use this so the math is identical.
 *
 * Every doc is validated against grantId + grantOrg before being counted.
 */
async function recomputeAndWriteBudget(
  grantId: string,
  grantOrg: string,
  grantData: Record<string, unknown>,
): Promise<{
  updatedLineItems: Record<string, unknown>[];
  newTotals: Record<string, number>;
  counts: { ledger: number; paymentQueue: number };
}> {
  if (_grantKind(grantData) === "program") {
    throw new Error("program_has_no_budget");
  }

  const [ledgerSnap, queueSnap] = await Promise.all([
    db.collection("ledger").where("grantId", "==", grantId).get(),
    db.collection("paymentQueue")
      .where("grantId", "==", grantId)
      .where("queueStatus", "==", "pending")
      .get(),
  ]);

  const spentByLineCents: Record<string, number> = {};
  let ledgerCounted = 0;
  for (const d of ledgerSnap.docs) {
    const row = d.data() as Record<string, unknown>;
    if (!_docBelongsToGrant(row, grantId, grantOrg)) continue;
    const lineId = normStr(row.lineItemId) || "__none__";
    const amountCents = row.amountCents != null
      ? Math.round(Number(row.amountCents) || 0)
      : toBudgetCents(row.amount);
    if (amountCents) {
      spentByLineCents[lineId] = (spentByLineCents[lineId] ?? 0) + amountCents;
      ledgerCounted++;
    }
  }

  const projectedByLineCents: Record<string, number> = {};
  let queueCounted = 0;
  for (const d of queueSnap.docs) {
    const row = d.data() as Record<string, unknown>;
    if (!_docBelongsToGrant(row, grantId, grantOrg)) continue;
    const source = normStr(row.source) || "";
    if (!["projection", "invoice", "credit-card"].includes(source)) continue;
    const lineId = normStr(row.lineItemId) || "__none__";
    const amountCents = toBudgetCents(row.amount);
    if (amountCents) {
      projectedByLineCents[lineId] = (projectedByLineCents[lineId] ?? 0) + amountCents;
      queueCounted++;
    }
  }

  const budget = (grantData.budget || {}) as Record<string, unknown>;
  const total = Number(budget.total ?? 0);
  const lineItems = (Array.isArray(budget.lineItems) ? budget.lineItems : []) as Record<string, unknown>[];

  const updatedLineItems = lineItems.map((li) => {
    const liId = String(li.id || "");
    const spent = fromBudgetCents(spentByLineCents[liId] ?? 0);
    const projected = fromBudgetCents(projectedByLineCents[liId] ?? 0);
    return { ...li, spent, projected, spentInWindow: spent, projectedInWindow: projected };
  });

  const totalCents = toBudgetCents(total);
  const totalSpentCents =
    updatedLineItems.reduce((a, li) => a + toBudgetCents(li.spent), 0) +
    (spentByLineCents["__none__"] ?? 0);
  const totalProjectedCents =
    updatedLineItems.reduce((a, li) => a + toBudgetCents(li.projected), 0) +
    (projectedByLineCents["__none__"] ?? 0);
  const totalSpent = fromBudgetCents(totalSpentCents);
  const totalProjected = fromBudgetCents(totalProjectedCents);

  const newTotals = {
    total,
    spent: totalSpent,
    projected: totalProjected,
    projectedSpend: fromBudgetCents(totalSpentCents + totalProjectedCents),
    balance: fromBudgetCents(totalCents - totalSpentCents),
    projectedBalance: fromBudgetCents(totalCents - totalSpentCents - totalProjectedCents),
    remaining: fromBudgetCents(totalCents - totalSpentCents),
    spentInWindow: totalSpent,
    projectedInWindow: totalProjected,
    windowBalance: fromBudgetCents(totalCents - totalSpentCents),
    windowProjectedBalance: fromBudgetCents(totalCents - totalSpentCents - totalProjectedCents),
  };

  await db.collection("grants").doc(grantId).update({
    "budget.totals": { ...((budget.totals || {}) as Record<string, unknown>), ...newTotals },
    "budget.lineItems": updatedLineItems,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { updatedLineItems, newTotals, counts: { ledger: ledgerCounted, paymentQueue: queueCounted } };
}

// ─── Admin handlers ───────────────────────────────────────────────────────────

/**
 * POST /grantsAdminClearPayments
 *
 * Deletes ONLY enrollment-sourced ledger entries (has enrollmentId, source not
 * CC/invoice), enrollment spend mirror docs/arrays, and ONLY enrollment
 * projection queue items (source === "projection") for the given grant.
 * CC and invoice ledger/queue entries are never touched.
 *
 * Every candidate doc is checked against the verified grantId AND orgId before
 * deletion — the Firestore query predicate is not the only gate.
 *
 * Budget totals are recomputed from what actually remains after deletion, so
 * they accurately reflect any CC/invoice amounts that were preserved.
 */
export const grantsAdminClearPayments = secureHandler(
  async (req, res) => {
    const parsed = z
      .object({ grantId: z.string().min(1), confirm: z.literal("DELETE") })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: "invalid_body", issues: parsed.error.issues });
      return;
    }
    const { grantId } = parsed.data;
    const caller = req.user!;
    const targetOrg = getTargetOrg(req, req.body);

    const gSnap = await db.collection("grants").doc(grantId).get();
    if (!gSnap.exists) { res.status(404).json({ ok: false, error: "grant_not_found" }); return; }
    const gData = gSnap.data() || {};
    assertGrantOrgAccess(caller, targetOrg, gData);
    if (_grantKind(gData) === "program") {
      _rejectProgramBudgetAction(res, "Clearing enrollment payments");
      return;
    }
    const grantOrg = normId(gData.orgId) || normId(targetOrg);

    const [ledgerSnap, queueSnap] = await Promise.all([
      db.collection("ledger").where("grantId", "==", grantId).get(),
      db.collection("paymentQueue").where("grantId", "==", grantId).get(),
    ]);

    let ledgerSkipped = 0;
    let queueSkipped = 0;
    let spendMirrorsDeleted = 0;
    const bw = newBulkWriter();

    for (const d of ledgerSnap.docs) {
      const row = d.data() as Record<string, unknown>;
      // Hard guard: must genuinely belong to this grant + org
      if (!_docBelongsToGrant(row, grantId, grantOrg)) { ledgerSkipped++; continue; }
      // Skip CC and invoice ledger entries — only delete enrollment spends
      const source = normStr(row.source) || "";
      if (_CC_SOURCES.has(source)) { ledgerSkipped++; continue; }
      // Must be linked to an enrollment; bare grant-level ledger entries are not enrollment spends
      if (!normStr(row.enrollmentId)) { ledgerSkipped++; continue; }
      bw.delete(d.ref);
    }

    for (const d of queueSnap.docs) {
      const row = d.data() as Record<string, unknown>;
      // Hard guard: must genuinely belong to this grant + org
      if (!_docBelongsToGrant(row, grantId, grantOrg)) { queueSkipped++; continue; }
      // Only delete enrollment projections — leave CC/invoice queue items alone
      const source = normStr(row.source) || "";
      if (source !== "projection") { queueSkipped++; continue; }
      bw.delete(d.ref);
    }

    const enrollSnap = await db
      .collection("customerEnrollments")
      .where("grantId", "==", grantId)
      .get();

    for (const d of enrollSnap.docs) {
      const row = d.data() as Record<string, unknown>;
      if (!_docBelongsToGrant(row, grantId, grantOrg)) continue;

      const spendSnap = await d.ref.collection("spends").get();
      for (const spendDoc of spendSnap.docs) {
        bw.delete(spendDoc.ref);
        spendMirrorsDeleted++;
      }

      const embeddedSpends = Array.isArray(row.spends) ? row.spends : [];
      if (embeddedSpends.length > 0) {
        bw.update(d.ref, {
          spends: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        spendMirrorsDeleted += embeddedSpends.length;
      }
    }

    await bw.close();

    // Recompute budget from what actually remains — never blindly zero
    const { newTotals, counts } = await recomputeAndWriteBudget(grantId, grantOrg, gData);

    res.status(200).json({
      ok: true,
      deleted: {
        ledger: ledgerSnap.size - ledgerSkipped,
        paymentQueue: queueSnap.size - queueSkipped,
        spendMirrors: spendMirrorsDeleted,
      },
      skipped: { ledger: ledgerSkipped, paymentQueue: queueSkipped },
      totals: newTotals,
      counts,
    });
  },
  { auth: "admin", methods: ["POST", "OPTIONS"] },
);

/**
 * POST /grantsAdminClearEnrollments
 *
 * Soft-deletes all customerEnrollments for the grant and removes their pending
 * projection queue items.  Every doc is verified against grantId + orgId before
 * being written; mismatched docs are counted and skipped.
 */
export const grantsAdminClearEnrollments = secureHandler(
  async (req, res) => {
    const parsed = z
      .object({
        grantId: z.string().min(1),
        confirm: z.literal("DELETE"),
        statuses: z
          .array(z.enum(["active", "inactive", "deleted"]))
          .min(1)
          .default(["active", "inactive"]),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: "invalid_body", issues: parsed.error.issues });
      return;
    }
    const { grantId, statuses } = parsed.data;
    const caller = req.user!;
    const targetOrg = getTargetOrg(req, req.body);

    const gSnap = await db.collection("grants").doc(grantId).get();
    if (!gSnap.exists) { res.status(404).json({ ok: false, error: "grant_not_found" }); return; }
    const gData = gSnap.data() || {};
    assertGrantOrgAccess(caller, targetOrg, gData);
    const grantOrg = normId(gData.orgId) || normId(targetOrg);

    const enrollSnap = await db
      .collection("customerEnrollments")
      .where("grantId", "==", grantId)
      .get();

    const bw = newBulkWriter();
    const validEnrollIds: string[] = [];
    let enrollSkipped = 0;
    let spendMirrorsDeleted = 0;

    for (const d of enrollSnap.docs) {
      const row = d.data() as Record<string, unknown>;
      // Hard guard: must genuinely belong to this grant + org
      if (!_docBelongsToGrant(row, grantId, grantOrg)) { enrollSkipped++; continue; }

      // Status filter — only process docs matching the requested statuses
      const isDeleted = row.deleted === true || row.status === "deleted";
      const isActive  = !isDeleted && row.active === true;
      const docStatus = isDeleted ? "deleted" : isActive ? "active" : "inactive";
      if (!(statuses as string[]).includes(docStatus)) continue;

      const spendSnap = await d.ref.collection("spends").get();
      for (const spendDoc of spendSnap.docs) {
        bw.delete(spendDoc.ref);
        spendMirrorsDeleted++;
      }
      spendMirrorsDeleted += Array.isArray(row.spends) ? row.spends.length : 0;

      bw.delete(d.ref);
      validEnrollIds.push(d.id);
    }

    // Remove only projection-sourced queue items for the verified enrollment IDs
    let queueDeleted = 0;
    for (let i = 0; i < validEnrollIds.length; i += 30) {
      const batch = validEnrollIds.slice(i, i + 30);
      const qSnap = await db
        .collection("paymentQueue")
        .where("enrollmentId", "in", batch)
        .where("grantId", "==", grantId)
        .where("queueStatus", "==", "pending")
        .get();
      for (const d of qSnap.docs) {
        const row = d.data() as Record<string, unknown>;
        // Hard guard + only enrollment projections (not CC/invoice queue items)
        if (!_docBelongsToGrant(row, grantId, grantOrg)) continue;
        const source = normStr(row.source) || "";
        if (source !== "projection") continue;
        bw.delete(d.ref);
        queueDeleted++;
      }
    }

    await bw.close();

    res.status(200).json({
      ok: true,
      cleared: { enrollments: validEnrollIds.length, paymentQueue: queueDeleted, spendMirrors: spendMirrorsDeleted },
      skipped: { enrollments: enrollSkipped },
    });
  },
  { auth: "admin", methods: ["POST", "OPTIONS"] },
);

/**
 * POST /grantsAdminReconcileBudget
 *
 * Recomputes budget totals by counting actual ledger + pending paymentQueue
 * entries.  Every doc is validated against grantId + orgId before being counted.
 */
export const grantsAdminReconcileBudget = secureHandler(
  async (req, res) => {
    const parsed = z.object({ grantId: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: "invalid_body", issues: parsed.error.issues });
      return;
    }
    const { grantId } = parsed.data;
    const caller = req.user!;
    const targetOrg = getTargetOrg(req, req.body);

    const gSnap = await db.collection("grants").doc(grantId).get();
    if (!gSnap.exists) { res.status(404).json({ ok: false, error: "grant_not_found" }); return; }
    const gData = gSnap.data() || {};
    assertGrantOrgAccess(caller, targetOrg, gData);
    if (_grantKind(gData) === "program") {
      _rejectProgramBudgetAction(res, "Reconciling budget totals");
      return;
    }
    const grantOrg = normId(gData.orgId) || normId(targetOrg);

    const { newTotals, counts } = await recomputeAndWriteBudget(grantId, grantOrg, gData);

    res.status(200).json({ ok: true, totals: newTotals, counts });
  },
  { auth: "admin", methods: ["POST", "OPTIONS"] },
);
