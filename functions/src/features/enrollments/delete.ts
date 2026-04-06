// functions/src/features/enrollments/delete.ts
import {
  db,
  FieldValue,
  secureHandler,
  requireOrg,
  isAdmin,
  isDev,
  canAccessDoc,
  normId as norm,
  toDateOnly,
  computeBudgetTotals,
} from "../../core";
import { writeLedgerEntry } from "../ledger/service";
import { closeEnrollmentInboxItems } from "../inbox/utils";
import { EnrollmentsDeleteBody } from "./schemas";
import { summarize } from "../tasks/utils";

/**
 * Core deleter used by both user and admin endpoints.
 * Each item: { id, voidPaid?: boolean, hard?: boolean }
 *
 * IMPORTANT (two-phase hard delete):
 * - When hardEffective=true, this function will:
 *   1) run budget/ledger adjustments transactionally
 *   2) tombstone the enrollment (deleted/status/active/endDate)
 *   3) set hardDeletePending=true
 * - It will NOT delete the spends subcollection or the enrollment doc.
 *   That must happen AFTERWARD (BulkWriter) to avoid orphaned subcollections.
 */
export async function deleteEnrollmentsCore(
  items: Array<{ id: string; voidPaid?: boolean; hard?: boolean }>,
  caller: any
) {
  const results: Array<{ id: string; ok?: true; error?: string }> = [];

  const callerOrgId = requireOrg(caller);

  // Dedupe spends across embedded + subcollection to avoid double budget adjustments
  function dedupeSpends(all: any[]) {
    const seen = new Set<string>();
    const out: any[] = [];
    for (const s of all || []) {
      const spendId = String(s?.id || "").trim();
      const paymentId = String(s?.paymentId || "").trim();
      const lineItemId = String(s?.lineItemId ?? "");
      const amt = String(s?.amount ?? "");
      const due = String(s?.dueDate ?? s?.date ?? "");
      const key =
        spendId ||
        (paymentId ? `pay:${paymentId}` : "") ||
        `f:${lineItemId}|${amt}|${due}|${String(s?._source || "")}|${String(s?._index ?? "")}`;

      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
    return out;
  }

  function deleteFutureTasksAfterEndDate(schedule: any[], endDateISO: string) {
    if (!Array.isArray(schedule)) return { changed: false, next: schedule };
    const next = schedule.filter((t: any) => {
      const due = String(t?.dueDate || "").slice(0, 10);
      return !due || due <= endDateISO;
    });
    return { changed: next.length !== schedule.length, next };
  }

  // run each enrollment in its own transaction (avoids cross-grant contention)
  for (const { id, voidPaid = false, hard = false } of items) {
    const enrollmentId = String(id || "").trim();

    try {
      await db.runTransaction(async (tx) => {
        if (!enrollmentId) throw new Error("missing_enrollment_id");

        const eRef = db.collection("customerEnrollments").doc(enrollmentId);
        const eSnap = await tx.get(eRef);
        if (!eSnap.exists) throw new Error("enrollment_not_found");

        // IMPORTANT: spread order must NOT allow doc data to override the Firestore id
        const enr: any = { ...(eSnap.data() || {}), id: eSnap.id };

        // Access gate
        if (!canAccessDoc(caller, enr)) {
          const e: any = new Error("forbidden");
          e.code = 403;
          throw e;
        }

        const grantId = String(enr.grantId || "").trim();
        if (!grantId) throw new Error("enrollment_missing_grantId");

        const gRef = db.collection("grants").doc(grantId);
        const gSnap = await tx.get(gRef);
        if (!gSnap.exists) throw new Error("grant_not_found");

        const grant: any = gSnap.data() || {};

        // Cross-org grant protection unless dev
        if (!isDev(caller) && norm(grant.orgId) && norm(grant.orgId) !== callerOrgId) {
          const e: any = new Error("forbidden_cross_org_grant");
          e.code = 403;
          throw e;
        }

        // Hard delete is allowed only for admin/dev (even if requested)
        const hardEffective = hard && (isAdmin(caller) || isDev(caller));

        // Extra cross-org guard on the enrollment doc itself (only relevant for hard delete)
        if (hardEffective) {
          if (!isDev(caller) && norm(enr.orgId) && norm(enr.orgId) !== callerOrgId) {
            const e: any = new Error("forbidden_cross_org_delete");
            e.code = 403;
            throw e;
          }
        }

        const itemsArr: any[] = Array.isArray(grant?.budget?.lineItems)
          ? grant.budget.lineItems.slice()
          : [];

        const byId: Record<string, any> = Object.fromEntries(
          itemsArr.map((i: any) => [String(i.id), i])
        );

        // ---- 1) Embedded payments → void unpaid (projected--)
        const payments = Array.isArray(enr.payments) ? enr.payments : [];
        const unpaidPays = payments.filter((p: any) => !p?.paid);

        for (const p of unpaidPays) {
          const k = String(p?.lineItemId || "");
          const amt = Math.abs(Number(p?.amount || 0));
          const li = byId[k];
          if (li) li.projected = Math.max(0, Number(li.projected || 0) - amt);
        }

        // Only build the patched payments array if we are NOT hard deleting
        const nextPayments = !hardEffective
          ? payments.map((p: any) =>
              p?.paid
                ? p
                : {
                    ...p,
                    void: true,
                    note: Array.from(
                      new Set([
                        ...((Array.isArray(p.note)
                          ? p.note
                          : p.note
                          ? [p.note]
                          : []) as string[]),
                        "VOID",
                      ])
                    ).slice(0, 10),
                  }
            )
          : undefined;

        // ---- 2) Spends subcollection & embedded spends (read-only for hardEffective)
        const subcolSnap = await tx.get(eRef.collection("spends"));
        const subSpends = subcolSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
          _source: "subcol" as const,
        }));

        const embeddedSpends = Array.isArray(enr.spends)
          ? (enr.spends as any[]).map((s, i) => ({
              ...s,
              _source: "embedded" as const,
              _index: i,
            }))
          : [];

        const allSpendsRaw = [...subSpends, ...embeddedSpends];
        const allSpends = dedupeSpends(allSpendsRaw);

        const isPaidSpend = (s: any) =>
          s?.paid === true || String(s?.status || "").toLowerCase() === "paid";

        const isUnpaidSpend = (s: any) =>
          s?.paid === false || String(s?.status || "").toLowerCase() === "unpaid";

        // 2a) unpaid spends → projected--
        const unpaidSpends = allSpends.filter(isUnpaidSpend);

        for (const s of unpaidSpends) {
          const k = String(s?.lineItemId ?? enr.lineItemId ?? "");
          const amt = Math.abs(Number(s?.amount || 0));
          const li = byId[k];
          if (li) li.projected = Math.max(0, Number(li.projected || 0) - amt);

          // Only mutate subcollection spend docs if NOT hard deleting
          if (!hardEffective && s._source === "subcol") {
            tx.set(
              eRef.collection("spends").doc(String(s.id)),
              { status: "voided", voidedAt: FieldValue.serverTimestamp() },
              { merge: true }
            );
          }
        }

        // 2b) paid spends → optionally create ledger reversal (spent--)
        if (voidPaid) {
          const paidSpends = allSpends.filter(isPaidSpend);

          for (const s of paidSpends) {
            const k = String(s?.lineItemId ?? enr.lineItemId ?? "");
            const amt = Math.abs(Number(s?.amount || 0));
            const li = byId[k];
            if (li) li.spent = Math.max(0, Number(li.spent || 0) - amt);

            // IMPORTANT: embedded spends may not have an id; create a stable baseId
            const spendId = String((s as any).id ?? "").trim();
            const baseId =
              spendId ||
              (s._source === "embedded" ? `embedded_${String((s as any)._index)}` : "") ||
              String((s as any).paymentId ?? "").trim() ||
              "unknown";

            const revId = `rev_${grantId}_${eRef.id}_${baseId}`;

            // Mirror reversal into canonical /ledger
            writeLedgerEntry(tx as any, {
              id: revId,
              source: "enrollment",
              orgId: grant.orgId ?? null,

              amount: -amt,
              grantId,
              lineItemId: k || null,
              enrollmentId: eRef.id,
              customerId: enr.customerId || null,
              paymentId: (s as any).paymentId || null,

              dueDate: (s as any).dueDate || (s as any).date || null,
              origin: {
                app: "hdb",
                baseId,
                sourcePath:
                  s._source === "subcol"
                    ? `customerEnrollments/${eRef.id}/spends/${String((s as any).id)}`
                    : `customerEnrollments/${eRef.id}#embeddedSpends[${String((s as any)._index)}]`,
                idempotencyKey: null,
              },

              note: "Auto-reversal on enrollment delete",
            });

            // Legacy grant-level ledgerEvents (optional)
            const ledRef = gRef.collection("ledgerEvents").doc();
            tx.set(
              ledRef,
              {
                id: ledRef.id,
                type: "reversal",
                grantId,
                enrollmentId: eRef.id,
                lineItemId: k || null,
                amount: -amt,
                reversalOf: (s as any)?.id ?? null,
                note: "Auto-reversal on enrollment delete",
                ts: FieldValue.serverTimestamp(),
              },
              { merge: true }
            );

            // Only mutate subcollection spend docs if NOT hard deleting
            if (!hardEffective && s._source === "subcol") {
              tx.set(
                eRef.collection("spends").doc(String((s as any).id)),
                {
                  reversed: true,
                  reversalOf: (s as any).id ?? null,
                  reversedAt: FieldValue.serverTimestamp(),
                },
                { merge: true }
              );
            }
          }
        }

        // Patch embedded spends only when soft deleting (doc persists)
        // NOTE: Firestore does not reliably support FieldValue.serverTimestamp() inside arrays.
        // Use a real scalar timestamp instead.
        const nowIso = new Date().toISOString();

        const nextEmbeddedSpends =
          !hardEffective && embeddedSpends.length > 0
            ? (enr.spends || []).map((s: any, i: number) => {
                const hitUnpaid = unpaidSpends.find(
                  (u) => u._source === "embedded" && u._index === i
                );

                const hitPaid = voidPaid
                  ? allSpends.find(
                      (p) => p._source === "embedded" && p._index === i && isPaidSpend(p)
                    )
                  : null;

                if (hitUnpaid) {
                  return { ...s, status: "voided", voidedAt: nowIso };
                }
                if (hitPaid) {
                  return {
                    ...s,
                    reversed: true,
                    reversalOf: s.id ?? null,
                    reversedAt: nowIso,
                  };
                }
                return s;
              })
            : undefined;

        // ---- 3) recompute grant totals (canonical, totals-only)
        const totals = computeBudgetTotals(itemsArr);

        tx.update(gRef, {
          "budget.lineItems": itemsArr,
          "budget.totals": totals,
          "budget.total": FieldValue.delete(),
          "budget.spent": FieldValue.delete(),
          "budget.projected": FieldValue.delete(),
          "budget.balance": FieldValue.delete(),
          "budget.projectedBalance": FieldValue.delete(),
          "budget.updatedAt": FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        // ---- 4) delete flow
        if (hardEffective) {
          // Two-phase hard delete: tombstone + mark pending.
          // Actual purge of subcollections + doc delete happens outside the transaction.
          const patch: any = {
            deleted: true,
            status: "deleted",
            active: false,
            hardDeletePending: true,
            updatedAt: FieldValue.serverTimestamp(),
            deletedAt: FieldValue.serverTimestamp(),
          };

          const effectiveEndDate = String(enr?.endDate || "").slice(0, 10) || toDateOnly(new Date());
          if (!enr?.endDate) patch.endDate = effectiveEndDate;
          const taskCut = deleteFutureTasksAfterEndDate(
            Array.isArray(enr.taskSchedule) ? enr.taskSchedule : [],
            effectiveEndDate,
          );
          if (taskCut.changed) {
            patch.taskSchedule = taskCut.next;
            patch.taskStats = summarize(taskCut.next);
          }

          tx.set(eRef, patch, { merge: true });
        } else {
          // Soft delete
          const patch: any = {
            deleted: true,
            status: "deleted",
            active: false,
            updatedAt: FieldValue.serverTimestamp(),
            deletedAt: FieldValue.serverTimestamp(),
          };

          if (unpaidPays.length || nextPayments !== undefined) patch.payments = nextPayments;
          if (nextEmbeddedSpends) patch.spends = nextEmbeddedSpends;
          const effectiveEndDate = String(enr?.endDate || "").slice(0, 10) || toDateOnly(new Date());
          if (!enr?.endDate) patch.endDate = effectiveEndDate;
          const taskCut = deleteFutureTasksAfterEndDate(
            Array.isArray(enr.taskSchedule) ? enr.taskSchedule : [],
            effectiveEndDate,
          );
          if (taskCut.changed) {
            patch.taskSchedule = taskCut.next;
            patch.taskStats = summarize(taskCut.next);
          }

          tx.set(eRef, patch, { merge: true });
        }
      });

      // Directly close inbox items — the Firestore trigger bails early on hard deletes
      // and runs asynchronously. This ensures items are closed by the time we respond.
      await closeEnrollmentInboxItems(enrollmentId).catch(() => {});
      results.push({ id: enrollmentId, ok: true });
    } catch (e: any) {
      results.push({ id: enrollmentId || String(id || ""), error: String(e?.message || e) });
    }
  }

  const ok = results.every((r) => r.ok);
  return { ok, results };
}

/**
 * Soft-delete by default; supports voidPaid and hard delete.
 * NOTE: With two-phase hard delete, "hard" here will tombstone + set hardDeletePending,
 * but will NOT purge subcollections or delete the doc. Use enrollmentsAdminDelete for that.
 */
export const enrollmentsDelete = secureHandler(
  async (req, res) => {
    const user = (req as any).user || {};
    let parsed: any;
    try {
      parsed = EnrollmentsDeleteBody.parse(req.body);
    } catch {
      res.status(400).json({ ok: false, error: "invalid_request" });
      return;
    }

    let ids: string[] = [];
    let voidPaid = false;
    let hardRequested = false;

    if (typeof parsed === "string") ids = [parsed];
    else if (Array.isArray(parsed)) ids = parsed;
    else {
      ids = parsed.id ? [parsed.id] : Array.isArray(parsed.ids) ? parsed.ids : [];
      voidPaid = parsed.voidPaid === true;
      hardRequested = parsed.hard === true;
    }

    ids = Array.from(new Set(ids.map((s) => String(s).trim()).filter(Boolean)));
    if (!ids.length) {
      res.status(400).json({ ok: false, error: "missing_enrollment_id_or_ids" });
      return;
    }

    const hardEffective = hardRequested && (isAdmin(user) || isDev(user));

    const out = await deleteEnrollmentsCore(
      ids.map((id) => ({ id, voidPaid, hard: hardEffective })),
      user
    );

    res.status(200).json({ ...out, deleted: true });
  },
  { auth: "user", requireOrg: true, methods: ["POST", "OPTIONS"] }
);
