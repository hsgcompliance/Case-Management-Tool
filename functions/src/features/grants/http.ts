// functions/src/features/grants/http.ts
import {
  secureHandler,
  db,
  FieldPath,
  Timestamp,
  orgIdFromClaims,
  hasLevel,
  requireOrg,
  toDate,
  toUtcIso,
  normId,
  normStr,
  sanitizeFlatObject,
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
    const body = GrantUpsertBody.parse(req.body);
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
    const body = GrantPatchBody.parse(req.body);
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
    const ids = GrantsDeleteBody.parse(req.body);

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
    const ids = GrantsAdminDeleteBody.parse(req.body);

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
  { auth: "user", methods: ["GET", "POST", "OPTIONS"] },
);

/** GET/POST /grantsGet?id=... — org-scoped */
export const grantsGet = secureHandler(
  async (req, res) => {
    const rawSrc = (req.method === "GET" ? req.query : req.body) || {};
    const src = GrantsGetQuery.parse(
      sanitizeFlatObject(rawSrc as Record<string, unknown>),
    );
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
  { auth: "user", methods: ["GET", "POST", "OPTIONS"] },
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
  { auth: "user", methods: ["GET", "OPTIONS"] },
);

/** GET/POST /grantsActivity?grantId=...&limit=... — org-scoped */
export const grantsActivity = secureHandler(
  async (req, res) => {
    const rawSrc = (req.method === "GET" ? req.query : req.body) || {};
    const src = GrantsActivityQuery.parse(
      sanitizeFlatObject(rawSrc as Record<string, unknown>),
    );
    const caller = req.user!;
    const targetOrg = getTargetOrg(req, src);

    const grantId = normId(src?.grantId);
    const limit = Math.max(
      1,
      Math.min(1000, parseInt(String(src?.limit ?? "200"), 10) || 200),
    );
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

    // Try collectionGroup('spends') first
    try {
      const cg = db
        .collectionGroup("spends")
        .where("grantId", "==", grantId)
        .orderBy("ts", "desc")
        .limit(limit);

      const snap = await cg.get();
      if (!snap.empty) {
        const items = snap.docs.map((d) => {
          const s = d.data() as Record<string, unknown>;
          const amt = Number(s.amount || 0);

          const tsIso = (() => {
            const primary = toUtcIso(s.ts as string | number | Date);
            if (primary) return primary;
            const fallback = toUtcIso(
              (d.updateTime ?? new Date()) as unknown as string | number | Date,
            );
            return fallback || new Date().toISOString();
          })();

          return {
            id: s.id || d.id,
            kind: amt < 0 ? "reversal" : "spend",
            grantId: s.grantId || grantId,
            enrollmentId: s.enrollmentId || d.ref.parent.parent?.id || "",
            paymentId: s.paymentId ?? null,
            lineItemId: s.lineItemId ?? null,
            amount: amt,
            note: s.note ?? null,
            ts: tsIso,
            by: s.by ?? null,
            reversalOf: s.reversalOf ?? null,
          };
        });
        res.status(200).json({ ok: true, items });
        return;
      }
    } catch {
      /* ignore; fallback below */
    }

    // Fallback: walk customerEnrollments.spends[]
    const enr = await db
      .collection("customerEnrollments")
      .where("grantId", "==", grantId)
      .get();

    const tmp: Array<Record<string, unknown>> = [];
    for (const doc of enr.docs) {
      const e = doc.data() || {};
      const arr = Array.isArray(e.spends) ? e.spends : [];
      for (let i = 0; i < arr.length; i++) {
        const s = arr[i] || {};
        const amt = Number(s.amount || 0);

        const tsIso = (() => {
          const primary = toUtcIso(
            (s as { ts?: unknown }).ts as string | number | Date,
          );
          if (primary) return primary;
          const fallback = toUtcIso(
            (doc.updateTime ?? new Date()) as unknown as string | number | Date,
          );
          return fallback || new Date().toISOString();
        })();

        tmp.push({
          id:
            s.id ||
            `act_${doc.id}_${s.paymentId ?? "nopay"}_${i}_${Math.abs(Math.round(amt * 100))}`,
          kind: amt < 0 ? "reversal" : "spend",
          grantId,
          enrollmentId: doc.id,
          paymentId: s.paymentId ?? null,
          lineItemId: s.lineItemId ?? null,
          amount: amt,
          note: s.note ?? null,
          ts: tsIso,
          by: s.by ?? null,
          reversalOf: s.reversalOf ?? null,
        });
      }
    }
    tmp.sort((a, b) =>
      String((a as { ts?: unknown }).ts ?? "") <
      String((b as { ts?: unknown }).ts ?? "")
        ? 1
        : String((a as { ts?: unknown }).ts ?? "") >
            String((b as { ts?: unknown }).ts ?? "")
          ? -1
          : 0,
    );
    res.status(200).json({ ok: true, items: tmp.slice(0, limit) });
  },
  { auth: "user", methods: ["GET", "POST", "OPTIONS"] },
);
