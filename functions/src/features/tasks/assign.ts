// functions/src/features/tasks/assign.ts
import { db, FieldValue } from "../../core";
import { tasks as C } from "@hdb/contracts";
import type { Request, Response } from "express";
import { summarize, normalizeRolesFromClaims, assertOrgAccess, requireUid } from "./utils";

/**
 * Assign a task to a group or user.
 * Rules:
 *  - Case Manager can set group='compliance' OR assign to themselves only.
 *  - Compliance/Admin can assign group or any uid.
 *  - Groups allowed: 'casemanager' | 'compliance' | 'admin'
 */
export async function assignTaskHandler(req: Request, res: Response): Promise<void> {
  const parsed = C.TasksAssignBody.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: parsed.error.message });
    return;
  }

  const { enrollmentId, taskId, assign } = parsed.data;

  const requester: any = (req as any).user || {};
  const uid = requireUid(requester); // block anon writes
  const roles = normalizeRolesFromClaims(requester);

  const isAdmin = roles.includes("admin");
  const isCompliance = roles.includes("compliance");
  const isCM = roles.includes("case_manager") || roles.includes("casemanager");

  const wantGroup = assign.group ?? null;
  const wantUid = assign.uid ?? null;

  if (isCM && !isAdmin && !isCompliance) {
    const self = requester.uid;
    const ok =
      (wantGroup === "compliance" && !wantUid) ||
      (wantUid && wantUid === self && !wantGroup);
    if (!ok) {
      res.status(403).json({ ok: false, error: "Insufficient permissions" });
      return;
    }
  }

  const nowIso = new Date().toISOString();

  await db.runTransaction(async (trx) => {
    const ref = db.collection("customerEnrollments").doc(enrollmentId);
    const snap = await trx.get(ref);
    if (!snap.exists) throw new Error("Enrollment not found");
    const e: any = snap.data() || {};

    assertOrgAccess(requester, e);

    const sched: any[] = Array.isArray(e.taskSchedule) ? [...e.taskSchedule] : [];
    const idx = sched.findIndex((t) => String(t?.id) === String(taskId));
    if (idx < 0) throw new Error("Task not found");

    const t = { ...sched[idx] };

    if (wantGroup === "casemanager" && !wantUid) {
      t.assignedToUid = e.caseManagerId || null;
      t.assignedToGroup = "casemanager";
    } else {
      t.assignedToUid = wantUid ?? null;
      t.assignedToGroup = wantGroup ?? (wantUid ? "casemanager" : null);
    }
    t.assignedAt = nowIso;
    t.assignedBy = uid;
    sched[idx] = t;

    trx.update(ref, {
      taskSchedule: sched,
      taskStats: summarize(sched),
      updatedAt: FieldValue.serverTimestamp(),
    });

    trx.set(ref.collection("audit").doc(), {
      type: "task_assignment",
      taskId,
      assign: { group: t.assignedToGroup || null, uid: t.assignedToUid || null },
      byUid: uid,
      at: nowIso,
      orgId: e.orgId || null,
    });
  });

  res.status(200).json({ ok: true });
}
