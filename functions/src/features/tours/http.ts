// BEGIN FILE: functions/src/features/tours/http.ts
import { secureHandler, db, isoNow, sanitizeNestedObject, stripReservedFields } from "../../core";
import { TourFlow, ToursUpsertBody, ToursPatchBody, ToursDeleteBody, ToursListQuery, ToursGetQuery } from "./schemas";
import type { ToursDeleteBodyT } from "./schemas";

const COL = "tours";
const toArr = <T,>(x: T | T[]) => (Array.isArray(x) ? x : [x]);

// Helper to normalize ToursDeleteBody parsed result to string[]
// normalize type
const normalizeDeleteBody = (parsed: ToursDeleteBodyT): string[] => {
  if (typeof parsed === "string") return [parsed];
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    if ("id" in parsed) return [parsed.id];
    if ("ids" in parsed) return parsed.ids;
  }
  return [];
};

/** POST /toursUpsert — admin; single or array */
export const toursUpsert = secureHandler(
  async (req, res) => {
    const parsed = ToursUpsertBody.parse(req.body);
    const items = toArr(parsed);

    const batch = db.batch();
    const now = isoNow();

    for (const it of items) {
      batch.set(
        db.collection(COL).doc(it.id),
        { ...it, updatedAt: now },
        { merge: true }
      );
    }

    await batch.commit();
    res.status(201).json({ ok: true, ids: items.map((i) => i.id), count: items.length });
  },
  { auth: "admin", methods: ["POST", "OPTIONS"] }
);

/** PATCH /toursPatch — admin; single or array */
export const toursPatch = secureHandler(
  async (req, res) => {
    const parsed = ToursPatchBody.parse(req.body);
    const items = toArr(parsed);

    const batch = db.batch();
    const now = isoNow();

    for (const it of items) {
      const cleaned = stripReservedFields(sanitizeNestedObject(it.data));
      batch.set(db.collection(COL).doc(it.id), { ...cleaned, updatedAt: now }, { merge: true });
    }

    await batch.commit();
    res.status(200).json({ ok: true, ids: items.map((i) => i.id), count: items.length });
  },
  { auth: "admin", methods: ["PATCH", "OPTIONS"] }
);

/** POST /toursDelete — admin; id or ids[] (soft) */
export const toursDelete = secureHandler(
  async (req, res) => {
    const parsed = ToursDeleteBody.parse(req.body?.ids ?? req.body?.id ?? req.body);
    const arr = normalizeDeleteBody(parsed);

    const batch = db.batch();
    const now = isoNow();

    for (const id of arr) {
      batch.set(db.collection(COL).doc(id), { deleted: true, active: false, updatedAt: now }, { merge: true });
    }

    await batch.commit();
    res.status(200).json({ ok: true, ids: arr, deleted: true });
  },
  { auth: "admin", methods: ["POST", "OPTIONS"] }
);

/** POST /toursAdminDelete — admin; id or ids[] (hard) */
export const toursAdminDelete = secureHandler(
  async (req, res) => {
    const parsed = ToursDeleteBody.parse(req.body?.ids ?? req.body?.id ?? req.body);
    const arr = normalizeDeleteBody(parsed);

    const batch = db.batch();
    for (const id of arr) batch.delete(db.collection(COL).doc(id));

    await batch.commit();
    res.status(200).json({ ok: true, ids: arr, hardDeleted: true });
  },
  { auth: "admin", methods: ["POST", "OPTIONS"] }
);

/** GET/POST /toursList — user/admin; filterable */
export const toursList = secureHandler(
  async (req, res) => {
    const qIn = ToursListQuery.parse((req.method === "GET" ? req.query : req.body) || {});
    const lim = Math.max(1, Math.min(500, Number(qIn.limit) || 200));

    let q: FirebaseFirestore.Query = db.collection(COL).orderBy("id");

    if (qIn.active === true) q = q.where("active", "==", true);
    if (qIn.active === false) q = q.where("active", "==", false);
    if (qIn.deleted === true) q = q.where("deleted", "==", true);
    if (qIn.deleted === false) q = q.where("deleted", "==", false);
    if (qIn.version !== undefined && String(qIn.version).length) q = q.where("version", "==", Number(qIn.version));

    if (qIn.startAfter) {
      const cursor = await db.collection(COL).doc(String(qIn.startAfter)).get();
      if (cursor.exists) q = q.startAfter(cursor);
    }

    q = q.limit(lim);
    const snap = await q.get();

    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
    const next = snap.docs.length === lim ? snap.docs[snap.docs.length - 1].id : null;

    res.status(200).json({ ok: true, items, next });
  },
  { auth: "user", methods: ["GET", "POST", "OPTIONS"] }
);

/** GET/POST /toursGet?id=... — user/admin */
export const toursGet = secureHandler(
  async (req, res) => {
    const { id } = ToursGetQuery.parse({ id: (req.query?.id || req.body?.id) ?? "" });

    if (!id) {
      res.status(400).json({ ok: false, error: "missing_id" });
      return;
    }

    const snap = await db.collection(COL).doc(String(id)).get();
    if (!snap.exists) {
      res.status(404).json({ ok: false, error: "not_found" });
      return;
    }

    res.status(200).json({ ok: true, tour: { id: snap.id, ...(snap.data() || {}) } });
  },
  { auth: "user", methods: ["GET", "POST", "OPTIONS"] }
);

/** GET /toursStructure — user/admin (UI skeleton for create forms) */
export const toursStructure = secureHandler(
  async (_req, res) => {
    const structure = {
      id: "",
      name: "",
      version: 2,
      active: true,
      deleted: false,
      steps: [
        {
          id: "s01",
          route: "/dashboard",
          selector: '[data-tour="the-dashboard-page"]',
          title: "Step title",
          body: "Explain what the user can do here.",
          placement: "auto",
          padding: 8,
          offsetX: 0,
          offsetY: 0,
          requireClick: false,
          nextOn: "button",
        },
      ],
      meta: {},
    };

    // sanity check without forcing required fields beyond skeleton intent
    TourFlow.partial().parse(structure);

    res.status(200).json({ ok: true, structure });
  },
  { auth: "user", methods: ["GET", "OPTIONS"] }
);
// END FILE
