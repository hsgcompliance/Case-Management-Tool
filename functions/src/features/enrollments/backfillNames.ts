import {
  db,
  FieldValue,
  secureHandler,
  requireOrg,
  isDev,
  newBulkWriter,
} from "../../core";
import { deriveEnrollmentNames } from "./derive";

type Opts = { limit?: number; allOrgs?: boolean; dryRun?: boolean };

async function backfillEnrollmentNames(caller: Record<string, unknown>, opts?: Opts) {
  const orgId = requireOrg(caller as any);
  const allowAll = !!opts?.allOrgs && isDev(caller as any);
  const limit = Math.max(1, Math.min(5000, Number(opts?.limit ?? 1000)));
  const dryRun = opts?.dryRun !== false;

  let q: FirebaseFirestore.Query = db.collection("customerEnrollments");
  if (!allowAll) q = q.where("orgId", "==", orgId);
  q = q.limit(limit);

  const snap = await q.get();
  const writer = dryRun ? null : newBulkWriter(2);
  let scanned = 0;
  let updated = 0;
  const ids: string[] = [];

  const grantCache = new Map<string, Record<string, unknown> | null>();
  const customerCache = new Map<string, Record<string, unknown> | null>();

  for (const doc of snap.docs) {
    scanned++;
    const prev = (doc.data() || {}) as Record<string, unknown>;
    const grantId = String(prev.grantId || "").trim();
    const customerId = String(prev.customerId || "").trim();

    let grantDoc: Record<string, unknown> | null = null;
    if (grantId) {
      if (!grantCache.has(grantId)) {
        const g = await db.collection("grants").doc(grantId).get();
        grantCache.set(grantId, g.exists ? ((g.data() || {}) as Record<string, unknown>) : null);
      }
      grantDoc = grantCache.get(grantId) ?? null;
    }

    let customerDoc: Record<string, unknown> | null = null;
    if (customerId) {
      if (!customerCache.has(customerId)) {
        const c = await db.collection("customers").doc(customerId).get();
        customerCache.set(customerId, c.exists ? ((c.data() || {}) as Record<string, unknown>) : null);
      }
      customerDoc = customerCache.get(customerId) ?? null;
    }

    const derived = await deriveEnrollmentNames({
      grantId,
      customerId,
      startDate: prev.startDate,
      grantDoc,
      customerDoc,
    });

    const nextGrantName = String(derived.grantName || "").trim() || null;
    const nextCustomerName = String(derived.customerName || "").trim() || null;
    const nextClientName = String(derived.clientName || "").trim() || null;
    const nextName = String(derived.name || "").trim() || null;

    const curGrantName = String(prev.grantName || "").trim() || null;
    const curCustomerName = String(prev.customerName || "").trim() || null;
    const curClientName = String(prev.clientName || "").trim() || null;
    const curName = String(prev.name || "").trim() || null;

    const changed =
      curGrantName !== nextGrantName ||
      curCustomerName !== nextCustomerName ||
      curClientName !== nextClientName ||
      curName !== nextName;

    if (!changed) continue;

    updated++;
    ids.push(doc.id);

    if (writer) {
      writer.set(
        doc.ref,
        {
          grantName: nextGrantName,
          customerName: nextCustomerName,
          clientName: nextClientName,
          name: nextName,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
  }

  if (writer) await writer.close();
  return { scanned, updated, ids, dryRun, scopedToOrg: allowAll ? null : orgId, resolvedGrants: grantCache.size, resolvedCustomers: customerCache.size };
}

/** POST /enrollmentsBackfillNames - admin/dev utility */
export const enrollmentsBackfillNames = secureHandler(
  async (req, res) => {
    const body = (req.body && typeof req.body === "object" ? req.body : {}) as {
      limit?: unknown;
      allOrgs?: unknown;
      dryRun?: unknown;
    };
    const user = ((req as any).user ?? {}) as Record<string, unknown>;
    const out = await backfillEnrollmentNames(user, {
      limit: Number(body.limit ?? 1000),
      allOrgs: body.allOrgs === true || String(body.allOrgs || "").toLowerCase() === "true",
      dryRun: body.dryRun === undefined ? false : (body.dryRun === true || String(body.dryRun || "").toLowerCase() === "true"),
    });
    res.status(200).json({ ok: true, ...out });
  },
  { auth: "admin", requireOrg: true, methods: ["POST", "OPTIONS"] },
);

