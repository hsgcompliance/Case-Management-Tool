// functions/src/features/enrollments/list.ts
import { db, Timestamp, secureHandler, requireOrg, type AuthedRequest } from "../../core";
import { EnrollmentsListQuery } from "./schemas";

export const enrollmentsList = secureHandler(async (req, res) => {
  const src0: unknown = (req.method === "GET" ? req.query : req.body) ?? {};
  const src0Obj =
    src0 && typeof src0 === "object" ? (src0 as Record<string, unknown>) : {};
  // keep backward compat: clientId -> customerId
  const src1 =
    src0Obj.customerId == null && src0Obj.clientId != null
      ? { ...src0Obj, customerId: src0Obj.clientId }
      : src0Obj;

  let src: Record<string, unknown>;
  try {
    src = EnrollmentsListQuery.parse(src1) as Record<string, unknown>;
  } catch {
    res.status(400).json({ ok: false, error: "invalid_query" });
    return;
  }

  const { grantId, customerId, status, startAfter } = src;
  const limit = src.limit ?? "200";

  const activeIn = src.active;
  const activeParsed =
    activeIn === true || activeIn === "true" || activeIn === "1"
      ? true
      : activeIn === false || activeIn === "false" || activeIn === "0"
      ? false
      : undefined;

  const user = ((req as AuthedRequest).user ?? {}) as Record<string, unknown>;
  const orgId = requireOrg(user);

  let q: FirebaseFirestore.Query = db
    .collection("customerEnrollments")
    .where("orgId","==",orgId)
    .orderBy("updatedAt", "desc")
    .orderBy("__name__", "desc");

  if (grantId) q = q.where("grantId", "==", String(grantId));
  if (customerId) q = q.where("customerId", "==", String(customerId));
  if (status) q = q.where("status", "==", String(status));
  if (activeParsed === true) q = q.where("active", "==", true);
  if (activeParsed === false) q = q.where("active", "==", false);

  const cursorUpdatedAt = src.cursorUpdatedAt ?? src.cursor_ts;
  const cursorId = src.cursorId ?? src.cursor_id;
  if (cursorUpdatedAt && cursorId) {
    const parseTs = (v: unknown) => {
      if (v instanceof Timestamp) return v;
      if (
        typeof v === "object" &&
        v !== null &&
        "seconds" in v &&
        "nanoseconds" in v
      ) {
        const raw = v as { seconds: unknown; nanoseconds: unknown };
        return new Timestamp(Number(raw.seconds), Number(raw.nanoseconds));
      }
      const n = Number(v);
      if (!Number.isNaN(n)) {
        return Timestamp.fromMillis(n);
      }
      return Timestamp.fromDate(new Date(String(v)));
    };
    q = q.startAfter(parseTs(cursorUpdatedAt), String(cursorId));
  } else if (startAfter) {
    const cursor = await db.collection("customerEnrollments").doc(String(startAfter)).get();
    if (cursor.exists) q = q.startAfter(cursor);
  }

  const lim = Math.max(1, Math.min(500, Number(limit) || 200));
  q = q.limit(lim);

  const snap = await q.get();
  const items = snap.docs.map((d) => ({ ...(d.data() || {}), id: d.id }));
  const next = snap.size === lim ? snap.docs[snap.size-1].id : null;

  res.status(200).json({ok: true, items, next});
}, {auth: "user", requireOrg: true, methods: ["GET", "POST", "OPTIONS"]});
