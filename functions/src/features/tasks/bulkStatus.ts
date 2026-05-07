// functions/src/features/tasks/bulkStatus.ts
import { db, FieldValue, secureHandler } from "../../core";
import { tasks as C } from "@hdb/contracts";
import { summarize, assertOrgAccess, requireUid } from "./utils";



/**
 * POST /tasksBulkStatus — apply status actions to many tasks in one transaction.
 *
 * @deprecated Task completion/status workflow is no longer a core product
 * surface. Keep for old screens and historical data only.
 */
export const tasksBulkStatus = secureHandler(async (req, res) => {
  const { enrollmentId, changes } = C.TasksBulkStatusBody.parse(req.body || {});
    const user: any = (req as any)?.user || {};
    const uid = requireUid(user); // block anon writes
    const nowIso = new Date().toISOString();

    await db.runTransaction(async (trx) => {
      const ref = db
        .collection("customerEnrollments")
        .doc(enrollmentId);
      const snap = await trx.get(ref);
      if (!snap.exists)
        throw new Error("Enrollment not found");
      const e: any = snap.data() || {};

      assertOrgAccess(user, e);

      const sched: any[] = Array.isArray(e?.taskSchedule)
        ? [...e.taskSchedule]
        : [];

      for (const c of changes) {
        const idx = sched.findIndex(
          (s) => String(s?.id) === c.taskId
        );
        if (idx < 0) continue;
        const t = { ...sched[idx] };

        const isHardLocked =
          t.status === "verified" || t.verified;
        if (isHardLocked && c.action !== "verify") {
          continue; // respect hard-lock
        }

        const isSeqBlocked =
          t.multiParentId &&
          t.multiMode === "sequential" &&
          c.action === "complete" &&
          (() => {
            const stepIndex = Number(
              (t as any).multiStepIndex || 0
            );
            if (stepIndex <= 1) return false;
            const parentId = String(t.multiParentId);
            return sched.some(
              (s: any) =>
                s &&
                s.multiParentId === parentId &&
                Number(
                  (s as any).multiStepIndex || 0
                ) < stepIndex &&
                !s.completed
            );
          })();

        if (isSeqBlocked) {
          continue;
        }

        if (c.action === "complete") {
          if (!t.completed) {
            t.completed = true;
            t.completedAt = nowIso;
            (t as any).completedBy = uid;
            if (c.notes)
              t.notes =
                (t.notes || "") +
                (t.notes ? "\n" : "") +
                c.notes;
          }
        } else if (c.action === "reopen") {
          if (t.completed) {
            t.completed = false;
            delete (t as any).completedAt;
            delete (t as any).completedBy;
            (t as any).reopenedAt = nowIso;
            (t as any).reopenedBy = uid;
            if (c.reason)
              (t as any).reopenReason = c.reason;
          }
        } else if (c.action === "verify") {
          (t as any).status = "verified";
          (t as any).verified = true;
          (t as any).verifiedAt = nowIso;
          (t as any).verifiedBy = uid;
        }

        sched[idx] = t;
      }

      trx.update(ref, {
        taskSchedule: sched,
        taskStats: summarize(sched),
        updatedAt: FieldValue.serverTimestamp(),
      });

      trx.set(
        ref.collection("audit").doc(),
        {
          type: "task_status_bulk",
          count: changes.length,
          byUid: uid,
          at: nowIso,
          orgId: e.orgId || null,
        }
      );
    });

    res.status(200).json({ ok: true });
  }, { auth: "user", methods: ["POST", "OPTIONS"] });
