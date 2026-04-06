// functions/src/features/enrollments/getById.ts
import { db, secureHandler, canAccessDoc, requireOrg, type AuthedRequest } from "../../core";
import { EnrollmentGetByIdQuery } from "./schemas";

export const enrollmentGetById = secureHandler(async (req, res) => {
  const user = ((req as AuthedRequest).user ?? {}) as Record<string, unknown>;
  requireOrg(user);

  const src: unknown = (req.method === "GET" ? req.query : req.body) ?? {};
  let id = "";
  try {
    const parsed = EnrollmentGetByIdQuery.parse(src);
    id = String(parsed.id || "");
  } catch {
    res.status(400).json({ ok: false, error: "missing_id" });
    return;
  }

  const snap = await db.collection("customerEnrollments").doc(id).get();
  if (!snap.exists) {
    res.status(404).json({ok: false, error: "not_found"});
    return;
  }

  const data = snap.data() || {};
  if (!canAccessDoc(user, data)) {
    res.status(403).json({ ok: false, error: "forbidden" });
    return;
  }

  res.status(200).json({
    ok: true,
    enrollment: { ...(data || {}), id: snap.id },
  });
}, {auth: "user", requireOrg: true, methods: ["GET", "OPTIONS"]});
