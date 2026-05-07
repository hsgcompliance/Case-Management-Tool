// functions/src/features/tasks/upsertManual.ts
import { db, FieldValue, secureHandler } from "../../core";
import { tasks as C } from "@hdb/contracts";
import { slug, summarize, assertOrgAccess, requireUid, resolveCaseManagerUid } from "./utils";

const Body = C.TasksUpsertManualBody;

/** POST /tasksUpsertManual — create/update a lightweight reminder note inside taskSchedule. */
export const tasksUpsertManual = secureHandler(async (req, res) => {
  const { enrollmentId, task } = Body.parse(req.body || {});
  const user: any = (req as any)?.user || {};
  const uid = requireUid(user);
  const nowIso = new Date().toISOString();

  await db.runTransaction(async (trx) => {
    const ref = db.collection("customerEnrollments").doc(enrollmentId);
    const snap = await trx.get(ref);
    if (!snap.exists) throw new Error("Enrollment not found");
    const e: any = snap.data() || {};

    assertOrgAccess(user, e);

    const sched: any[] = Array.isArray(e.taskSchedule) ? [...e.taskSchedule] : [];
    const dueDate = String(task.dueDate || "");
    const id = task.id || `task_manual_${slug(task.title)}_${dueDate || nowIso.slice(0, 10)}`;

    const existingIdx = sched.findIndex((t)=> String(t?.id)===id);
    const base = existingIdx >= 0 ? { ...sched[existingIdx] } : {};

    const customerRefId = String(e.customerId || e.clientId || "").trim();
    const customerSnap =
      customerRefId
        ? await trx.get(db.collection("customers").doc(customerRefId))
        : null;
    const customerDoc = customerSnap?.exists ? (customerSnap.data() || {}) : {};

    const cmUid = resolveCaseManagerUid(e) || resolveCaseManagerUid(customerDoc);
    const customerName =
      String(e.customerName || e.clientName || "").trim() ||
      String((customerDoc as any).name || "").trim() ||
      `${String((customerDoc as any).firstName || "").trim()} ${String((customerDoc as any).lastName || "").trim()}`.trim() ||
      null;
    const grantName = String(e.grantName || "").trim() || null;
    const caseManagerName =
      String(e.caseManagerName || "").trim() ||
      String((customerDoc as any).caseManagerName || "").trim() ||
      null;
    const enrollmentName = String(e.name || "").trim() || null;
    const next = {
      ...base,
      id,
      type: task.title,
      notes: task.notes ?? (base.notes || ""),
      description: String((base as any)?.description || "").trim() || null,
      dueDate,
      dueMonth: dueDate ? dueDate.slice(0,7) : null,
      notify: task.notify !== false,
      bucket: task.bucket || "task",
      customerName: (base as any)?.customerName ?? customerName,
      grantName: (base as any)?.grantName ?? grantName,
      caseManagerName: (base as any)?.caseManagerName ?? caseManagerName,
      enrollmentName: (base as any)?.enrollmentName ?? enrollmentName,

      managed: false,
      defId: null,

      assignedToGroup: base.assignedToGroup ?? "casemanager",
      assignedToUid: base.assignedToUid ?? cmUid ?? null,
      assignedAt: base.assignedAt ?? (cmUid ? nowIso : null),
      assignedBy: base.assignedBy ?? (cmUid ? "system" : uid),

      completed: base.completed ?? false,
      completedAt: base.completedAt ?? null,

      updatedAt: nowIso,
      updatedBy: uid,
    };

    if (existingIdx >= 0) sched[existingIdx] = next; else sched.push(next);
    sched.sort((a:any,b:any)=> String(a.dueDate).localeCompare(String(b.dueDate)));

    trx.update(ref, {
      taskSchedule: sched,
      taskStats: summarize(sched),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  res.status(200).json({ ok:true });
}, { auth:"user", methods:["POST","OPTIONS"] });
