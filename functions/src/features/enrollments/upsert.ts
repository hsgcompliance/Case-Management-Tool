// functions/src/features/enrollments/upsert.ts
import {
  db,
  FieldValue,
  secureHandler,
  requireOrg,
  teamIdsFromClaims,
  isDev,
} from "../../core";
import { randomUUID as uuid } from "node:crypto";
import { EnrollmentsUpsertBody, toArray } from "./schemas";
import { deriveEnrollmentNames } from "./derive";

const norm = (v: unknown) => String(v || "").trim();
const isReservedRouteId = (raw: unknown) => {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return false;
  if (s === "new") return true;
  if (s.startsWith("(") && s.endsWith(")new")) return true;
  return false;
};

export const enrollmentsUpsert = secureHandler(async (req, res) => {
  const rows = toArray(EnrollmentsUpsertBody.parse(req.body));
  if (!rows.length) {
    res.status(400).json({ok: false, error: "empty"});
    return;
  }

  const user = (req as any).user || {};
  const orgId = requireOrg(user);
  const teams = teamIdsFromClaims(user);

  const batch = db.batch();
  const ids: string[] = [];

  for (const raw0 of rows) {
    if (raw0.id && isReservedRouteId(raw0.id)) {
      res.status(400).json({ ok: false, error: "invalid_reserved_id" });
      return;
    }
    if (isReservedRouteId((raw0 as any).customerId) || isReservedRouteId((raw0 as any).grantId)) {
      res.status(400).json({ ok: false, error: "invalid_reserved_reference_id" });
      return;
    }

    const id = raw0.id || uuid();
    const status = raw0.status ?? "active";
    const active = raw0.active ?? (status === "active");

    const rowOrgId = norm(raw0.orgId) || orgId;
    if (!isDev(user) && rowOrgId !== orgId) {
      res.status(403).json({ ok:false, error:"forbidden_cross_org_upsert" });
      return;
    }

    const teamIds = Array.from(new Set([rowOrgId, ...(raw0.teamIds||[]), ...teams])).slice(0,10);

    const data: any = {
      ...raw0,
      id,
      orgId: rowOrgId,
      teamIds,

      status,
      active,
      deleted: raw0.deleted ?? false,

      updatedAt: FieldValue.serverTimestamp(),
    };
    Object.assign(data, await deriveEnrollmentNames({
      grantId: data.grantId,
      customerId: data.customerId,
      startDate: data.startDate,
    }));

    delete data.createdAt; // createdAt only via trigger

    const ref = db.collection("customerEnrollments").doc(id);
    batch.set(ref, data, {merge: true});
    ids.push(id);
  }

  await batch.commit();
  res.status(201).json({ok: true, ids});
}, {auth: "user", methods: ["POST", "OPTIONS"]});
