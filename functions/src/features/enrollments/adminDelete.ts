// functions/src/features/enrollments/adminDelete.ts
import { secureHandler, db, newBulkWriter } from "../../core";
import { deleteEnrollmentsCore } from "./delete";
import { EnrollmentsAdminDeleteBody } from "./schemas";

/**
 * Admin delete endpoint with SAFE defaults.
 *
 * Why this exists:
 * - Firestore does NOT cascade-delete subcollections when you delete a parent doc.
 * - If you hard delete customerEnrollments/{id}, any customerEnrollments/{id}/spends/*
 *   docs will remain and become "orphaned" (still readable by path, but parent is gone).
 *
 * Policy:
 * - "safe" mode => soft delete (keeps enrollment tombstone; no orphan risk; best for audit).
 * - "hard" mode => hard delete the enrollment doc *and* optionally purge subcollections.
 *
 * We keep ledger intact:
 * - deleteEnrollmentsCore already writes reversal entries to /ledger when voidPaid=true.
 * - Purging subcollection spends does NOT touch /ledger.
 *
 * IMPORTANT:
 * - If spends subcollection contains data that is NOT already represented in /ledger,
 *   purging can lose that detail. If you are not 100% sure ledger is canonical for spends,
 *   prefer mode:"safe" or block hard deletes entirely.
 *
 * Request body accepts:
 * - "id" | ["id1","id2"]
 * - { id } | { ids }
 * - { id|ids, voidPaid?: boolean, mode?: "safe"|"hard", purgeSpends?: boolean }
 *
 * Defaults:
 * - mode defaults to "safe"
 * - purgeSpends defaults to false (must be explicit)
 */
export const enrollmentsAdminDelete = secureHandler(
  async (req, res) => {
   let parsed: any;
    try {
      parsed = EnrollmentsAdminDeleteBody.parse(req.body);
    } catch {
      res.status(400).json({ ok: false, error: "invalid_request" });
      return;
    }

    let ids: string[] = [];
    let voidPaid = false;
    let mode: "safe" | "hard" = "safe";
    let purgeSpends = false;

    if (typeof parsed === "string") ids = [parsed];
    else if (Array.isArray(parsed)) ids = parsed;
    else {
      ids = parsed.id ? [parsed.id] : Array.isArray(parsed.ids) ? parsed.ids : [];
      voidPaid = parsed.voidPaid === true;
      mode = String(parsed.mode || "").toLowerCase() === "hard" ? "hard" : "safe";
      purgeSpends = parsed.purgeSpends === true || parsed.purgeSubcollections === true;
    }

    ids = Array.from(new Set(ids.map((s) => String(s).trim()).filter(Boolean)));
    if (!ids.length) {
      res.status(400).json({ ok: false, error: "missing_id_or_ids" });
      return;
    }

    /**
     * Hard delete safety guard:
     * - If caller requests hard delete but does NOT opt into purge,
     *   then we refuse if ANY enrollment has spends in the spends subcollection.
     *
     * Why:
     * - Parent deletes do not remove subcollections (orphan risk).
     * - Also acts as a "pause button" if spends aren’t fully canonical in /ledger yet.
     *
     * Cost:
     * - Cheap preflight: limit(1) per enrollment.
     */
    if (mode === "hard" && !purgeSpends) {
      const checks = await Promise.all(
        ids.map(async (id) => {
          const snap = await db
            .collection("customerEnrollments")
            .doc(id)
            .collection("spends")
            .limit(1)
            .get();
          return { id, hasSpends: !snap.empty };
        })
      );

      const blocked = checks.filter((c) => c.hasSpends).map((c) => c.id);
      if (blocked.length) {
        res.status(409).json({
          ok: false,
          error: "hard_delete_has_spends",
          meta: {
            ids: blocked,
            hint: "Use mode:'safe' OR pass purgeSpends:true to hard-delete + purge subcollection spends.",
          },
        });
        return;
      }
    }

    // Perform delete (soft in safe mode, hard in hard mode).
    const out = await deleteEnrollmentsCore(
      ids.map((id) => ({ id, voidPaid, hard: mode === "hard" })),
      (req as any).user
    );

    /**
     * Purge spends subcollection AFTER hard delete to prevent orphaned docs.
     *
     * Notes:
     * - We do it after core delete because:
     *   - core handles budget math + optional ledger reversals transactionally.
     *   - Firestore transactions have operation limits; purging a large subcollection
     *     inside the same transaction is a footgun.
     *
     * - BulkWriter is used for safer throughput + retries.
     * - We only purge for ids that succeeded (result.ok).
     */
    let purgedSpendsCount = 0;
    const purgeErrors: Array<{ id: string; error: string }> = [];

    if (mode === "hard" && purgeSpends) {
      const okIds = out.results.filter((r) => r.ok).map((r) => r.id);

      const writer = newBulkWriter(2);
      try {
        for (const id of okIds) {
          try {
            const spendsSnap = await db
              .collection("customerEnrollments")
              .doc(id)
              .collection("spends")
              .get();

            for (const d of spendsSnap.docs) {
              writer.delete(d.ref);
              purgedSpendsCount++;
            }
          } catch (e: any) {
            purgeErrors.push({ id, error: String(e?.message || e) });
          }
        }
      } finally {
        await writer.close();
      }
    }

    // Response keeps existing shape, but we add optional metadata.
    res.status(200).json({
      ...out,
      deleted: true,
      mode,
      purged: mode === "hard" && purgeSpends ? { spends: purgedSpendsCount } : undefined,
      purgeErrors: purgeErrors.length ? purgeErrors : undefined,
    });
  },
  { auth: "admin", requireOrg: true, methods: ["POST", "OPTIONS"] }
);
