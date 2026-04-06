// functions/src/features/enrollments/bulkEnroll.ts
 import {
   db,
   FieldValue,
   secureHandler,
   requireOrg,
   teamIdsFromClaims,
   isAdmin,
   isDev,
   stripReservedFields,
   sanitizeNestedObject,
   canAccessDoc,
 } from "../../core";

import { EnrollmentsBulkEnrollBody } from "./schemas";
import type { TEnrollmentsBulkEnrollBody } from "./schemas";
import { deriveEnrollmentNames } from "./derive";

export const enrollmentsBulkEnroll = secureHandler(async (req, res) => {
  const parsed = EnrollmentsBulkEnrollBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: "invalid_body", issues: parsed.error.issues });
    return;
  }

  const body: TEnrollmentsBulkEnrollBody = parsed.data;

  const grantId = body.grantId;
  const customerIds = body.customerIds;

  const skipIfExists = body.skipIfExists;     // now boolean default true
  const existsMode = body.existsMode;         // now "nonDeleted" | "activeOnly" with default

  const extra = stripReservedFields(sanitizeNestedObject(body.extra));
  const perCustomerExtra = body.perCustomerExtra;

  if (!grantId || !customerIds.length) {
    res.status(400).json({ ok: false, error: "missing_grant_or_customers" });
    return;
  }

  const user = (req as any).user || {};
  const orgId = requireOrg(user);
  const teamIds = teamIdsFromClaims(user);

  // load grant once + check access
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

  const results: any[] = [];

  for (const rawCustomerId of customerIds) {
    const customerId = String(rawCustomerId).trim();
    if (!customerId) continue;

    try {
      // check customer access
      const cSnap = await db.collection("customers").doc(customerId).get();
      if (!cSnap.exists) throw new Error("customer_not_found");
      const cust = cSnap.data() || {};
      if (!canAccessDoc(user, cust)) throw new Error("forbidden_customer");

      if (skipIfExists) {
        let q = db.collection("customerEnrollments")
          .where("orgId", "==", orgId)
          .where("grantId", "==", String(grantId))
          .where("customerId", "==", String(customerId))
          .limit(1);

        if (existsMode === "nonDeleted") {
          q = q.orderBy("status").where("status", "!=", "deleted");
        } else {
          q = q.where("active", "==", true);
        }

        const snap = await q.get();
        if (!snap.empty) {
          results.push({customerId, existed: true, enrollmentId: snap.docs[0].id});
          continue;
        }
      }

      const ref = db.collection("customerEnrollments").doc();
      const now = FieldValue.serverTimestamp();
      const merged = {
        ...extra,
        ...stripReservedFields(sanitizeNestedObject(perCustomerExtra?.[customerId] || {})),
      };
      const derived = await deriveEnrollmentNames({
        grantId: String(grantId),
        customerId: String(customerId),
        startDate: (merged as any)?.startDate,
        grantDoc: grant,
        customerDoc: cust,
      });

      await ref.set({
        id: ref.id,
        orgId,
        teamIds,

        grantId: String(grantId),
        customerId: String(customerId),

        active: true,
        status: "active",
        deleted: false,

        createdAt: now,
        updatedAt: now,
        by: { uid: user.uid || null, email: user.email || null },

        ...merged,
        ...derived,
      });

      results.push({customerId, enrollmentId: ref.id});
    } catch (e:any) {
      results.push({customerId, error: String(e?.message || e)});
    }
  }

  res.status(200).json({ok: true, results});
}, {auth: "user", requireOrg: true, methods: ["POST", "OPTIONS"]});
