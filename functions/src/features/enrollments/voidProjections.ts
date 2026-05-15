// functions/src/features/enrollments/voidProjections.ts
import { db, secureHandler, requireOrg, canAccessDoc } from "../../core";
import { syncEnrollmentProjectionQueueItems } from "../paymentQueue/service";

function toIds(body: unknown): string[] {
  if (typeof body === "string") return [body];
  if (Array.isArray(body)) return body.map(String).filter(Boolean);
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (typeof b.id === "string" && b.id) return [b.id];
    if (Array.isArray(b.ids)) return b.ids.map(String).filter(Boolean);
  }
  return [];
}

/**
 * POST /enrollmentsVoidProjections { id } | { ids } | id | [id, ...]
 *
 * Voids all pending paymentQueue projection items for the given enrollment(s).
 * Used when closing an enrollment to ensure stale projections are cleaned up.
 *
 * Errors are per-enrollment and non-fatal — the response always reports which
 * enrollments succeeded and which failed so the caller can surface any issues.
 */
export const enrollmentsVoidProjections = secureHandler(
  async (req, res) => {
    const user = (req as any).user || {};
    requireOrg(user);

    const ids = Array.from(new Set(toIds(req.body)));
    if (!ids.length) {
      res.status(400).json({ ok: false, error: "missing_id_or_ids" });
      return;
    }

    // --- READ ALL ENROLLMENTS FIRST ---
    const snaps = await Promise.all(
      ids.map((id) =>
        db.collection("customerEnrollments").doc(id).get().catch(() => null)
      )
    );

    const results: Array<{ id: string; ok?: true; skipped?: true; error?: string }> = [];

    // --- VOID PROJECTIONS (reads are done, now write-only) ---
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const snap = snaps[i];

      if (!snap || !snap.exists) {
        results.push({ id, error: "enrollment_not_found" });
        continue;
      }

      const data = snap.data() as any;

      if (!canAccessDoc(user, data)) {
        results.push({ id, error: "forbidden" });
        continue;
      }

      try {
        await syncEnrollmentProjectionQueueItems({
          orgId: data?.orgId ?? null,
          enrollmentId: id,
          grantId: data?.grantId ?? null,
          customerId: data?.customerId ?? null,
          payments: [], // empty → all pending projections get deleted
        });
        results.push({ id, ok: true });
      } catch (e: any) {
        results.push({ id, error: String(e?.message || e) });
      }
    }

    const ok = results.every((r) => r.ok || r.skipped);
    res.status(200).json({ ok, results });
  },
  { auth: "user", requireOrg: true, methods: ["POST", "OPTIONS"] }
);
