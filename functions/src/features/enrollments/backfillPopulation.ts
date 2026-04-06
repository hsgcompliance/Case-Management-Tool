import {
  db,
  FieldValue,
  secureHandler,
  requireOrg,
  isDev,
  newBulkWriter,
} from "../../core";

const VALID_POPULATIONS = ["Youth", "Individual", "Family"] as const;
type Population = (typeof VALID_POPULATIONS)[number] | null;

function normalizePopulation(v: unknown): Population {
  return VALID_POPULATIONS.includes(v as any) ? (v as Population) : null;
}

type Opts = { limit?: number; allOrgs?: boolean; dryRun?: boolean };

async function backfillEnrollmentPopulation(caller: Record<string, unknown>, opts?: Opts) {
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

  const customerCache = new Map<string, Population>();

  for (const doc of snap.docs) {
    scanned++;
    const prev = (doc.data() || {}) as Record<string, unknown>;
    const customerId = String(prev.customerId || "").trim();
    if (!customerId) continue;

    if (!customerCache.has(customerId)) {
      const cSnap = await db.collection("customers").doc(customerId).get();
      const pop = cSnap.exists ? normalizePopulation(cSnap.data()?.population) : null;
      customerCache.set(customerId, pop);
    }

    const nextPop = customerCache.get(customerId) ?? null;
    const curPop = normalizePopulation(prev.population);

    if (curPop === nextPop) continue;

    updated++;
    ids.push(doc.id);

    if (writer) {
      writer.set(
        doc.ref,
        { population: nextPop, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
    }
  }

  if (writer) await writer.close();
  return {
    scanned,
    updated,
    ids,
    dryRun,
    scopedToOrg: allowAll ? null : orgId,
    resolvedCustomers: customerCache.size,
  };
}

/** POST /enrollmentsBackfillPopulation - admin/dev utility */
export const enrollmentsBackfillPopulation = secureHandler(
  async (req, res) => {
    const body = (req.body && typeof req.body === "object" ? req.body : {}) as {
      limit?: unknown;
      allOrgs?: unknown;
      dryRun?: unknown;
    };
    const user = ((req as any).user ?? {}) as Record<string, unknown>;
    const out = await backfillEnrollmentPopulation(user, {
      limit: Number(body.limit ?? 1000),
      allOrgs: body.allOrgs === true || String(body.allOrgs || "").toLowerCase() === "true",
      dryRun: body.dryRun === undefined ? false : (body.dryRun === true || String(body.dryRun || "").toLowerCase() === "true"),
    });
    res.status(200).json({ ok: true, ...out });
  },
  { auth: "admin", requireOrg: true, methods: ["POST", "OPTIONS"] },
);
