// functions/src/features/enrollments/enroll.ts
 import {
   db,
   FieldValue,
   secureHandler,
   stripReservedFields,
   sanitizeNestedObject,
   requireOrg,
   teamIdsFromClaims,
   isAdmin,
   isDev,
   canAccessDoc,
 } from "../../core";
  import { randomUUID as uuid } from "node:crypto";
  import { EnrollmentsEnrollCustomerBody } from "./schemas";
  import type { TEnrollmentsEnrollCustomerBody } from "./schemas";
  import { deriveEnrollmentNames } from "./derive";

const isReservedRouteId = (raw: unknown) => {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return false;
  if (s === "new") return true;
  if (s.startsWith("(") && s.endsWith(")new")) return true;
  return false;
};

export const enrollmentsEnrollCustomer = secureHandler(async (req, res) => {
  const parsed = EnrollmentsEnrollCustomerBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: "invalid_body", issues: parsed.error.issues });
    return;
  }

  const body: TEnrollmentsEnrollCustomerBody = parsed.data;

  const grantId = body.grantId;
  const customerId = body.customerId;

  const extra = stripReservedFields(sanitizeNestedObject(body.extra));

  if (!grantId || !customerId) {
    res.status(400).json({ ok: false, error: "missing_grant_or_customerId" });
    return;
  }
  if (isReservedRouteId(grantId) || isReservedRouteId(customerId)) {
    res.status(400).json({ ok: false, error: "invalid_reserved_reference_id" });
    return;
  }


  const user = (req as any).user || {};
  const orgId = requireOrg(user);
  const teamIds = Array.from(new Set([orgId, ...teamIdsFromClaims(user)])).slice(0, 10);

  // Check grant access
  const gSnap = await db.collection("grants").doc(grantId).get();
  if (!gSnap.exists) {
    res.status(404).json({ ok: false, error: "grant_not_found" });
    return;
  }
  const grant = gSnap.data() || {};
  if (!canAccessDoc(user, grant) && !(isAdmin(user) || isDev(user))) {
    res.status(403).json({ ok: false, error: "forbidden_grant" });
    return;
  }

  // Check customer access
  const cSnap = await db.collection("customers").doc(customerId).get();
  if (!cSnap.exists) {
    res.status(404).json({ ok: false, error: "customer_not_found" });
    return;
  }
  const cust = cSnap.data() || {};
  if (!canAccessDoc(user, cust)) {
    res.status(403).json({ ok: false, error: "forbidden_customer" });
    return;
  }

  const id = uuid();
  const now = FieldValue.serverTimestamp();
  const derived = await deriveEnrollmentNames({
    grantId,
    customerId,
    startDate: (extra as any)?.startDate,
    grantDoc: grant,
    customerDoc: cust,
  });

  await db.collection("customerEnrollments").doc(id).set({
    id,
    orgId,
    teamIds,

    grantId,
    customerId,

    active: true,
    status: "active",
    deleted: false,

    createdAt: now,
    updatedAt: now,
    by: { uid: user.uid || null, email: user.email || null },

    ...extra,
    ...derived,
  });

  res.status(201).json({ ok: true, id });
}, {
  auth: "user",
  requireOrg: true,
  methods: ["POST", "OPTIONS"]
});
