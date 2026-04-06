// functions/src/features/enrollments/checkOverlaps.ts
import { db, secureHandler, requireOrg, toDate} from "../../core";

const openEnd = new Date("9999-12-31");

function overlaps(aS: Date, aE: Date | null, bS: Date, bE: Date | null) {
  const aEnd = aE ?? openEnd;
  const bEnd = bE ?? openEnd;
  return aS.getTime() <= bEnd.getTime() && bS.getTime() <= aEnd.getTime();
}

/**
 * POST/GET /enrollmentsCheckOverlaps
 * Org-scoped for now.
 */
export const enrollmentsCheckOverlaps = secureHandler(async (req, res) => {
  const src: any = (req.method === "GET" ? req.query : req.body) ?? {};
  const clientId = String(src.clientId ?? src.customerId ?? src.client_id ?? "");
  const grantIds: string[] = Array.isArray(src.grantIds)
    ? src.grantIds.map(String)
    : src.grantIds
    ? String(src.grantIds)
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean)
    : [];

  const wStart = toDate(src.window?.start);
  const wEnd = toDate(src.window?.end);

  const user = (req as any).user || {};
  const orgId = requireOrg(user);

  let q: FirebaseFirestore.Query = db
    .collection("customerEnrollments")
    .where("orgId", "==", orgId);

  if (clientId) q = q.where("customerId", "==", clientId);
  if (grantIds.length === 1) q = q.where("grantId", "==", grantIds[0]);

  const snap = await q.limit(1000).get();
  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

  const pool =
    grantIds.length === 2
      ? rows.filter((r) => grantIds.includes(String(r.grantId)))
      : rows;

  const mat = pool
    .map((r) => ({
      id: r.id,
      grantId: r.grantId,
      startDate: r.startDate,
      endDate: r.endDate,
      _s: toDate(r.startDate),
      _e: toDate(r.endDate),
    }))
    .filter((r) => r._s);

  const out: Array<any> = [];

  if (grantIds.length === 2) {
    const [A, B] = grantIds;
    const aList = mat.filter((m) => String(m.grantId) === A);
    const bList = mat.filter((m) => String(m.grantId) === B);
    for (const a of aList) for (const b of bList) {
      if (overlaps(a._s!, a._e, b._s!, b._e)) {
        if (wStart && a._e && a._e < wStart) continue;
        if (wEnd && b._s && b._s > wEnd) continue;
        out.push({
          a: { id: a.id, grantId: a.grantId, startDate: a.startDate, endDate: a.endDate },
          b: { id: b.id, grantId: b.grantId, startDate: b.startDate, endDate: b.endDate },
        });
      }
    }
  } else {
    for (let i = 0; i < mat.length; i++) {
      for (let j = i + 1; j < mat.length; j++) {
        const a = mat[i], b = mat[j];
        if (overlaps(a._s!, a._e, b._s!, b._e)) {
          if (wStart && a._e && a._e < wStart) continue;
          if (wEnd && b._s && b._s > wEnd) continue;
          out.push({
            a: { id: a.id, grantId: a.grantId, startDate: a.startDate, endDate: a.endDate },
            b: { id: b.id, grantId: b.grantId, startDate: b.startDate, endDate: b.endDate },
          });
        }
      }
    }
  }

  res.status(200).json({ ok: true, overlaps: out, count: out.length });
}, { auth: "user", requireOrg: true, methods: ["POST", "GET", "OPTIONS"] });
