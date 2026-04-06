// functions/src/features/tasks/list.ts
import { db, secureHandler } from "../../core";
import { tasks as C } from "@hdb/contracts";
import { assertOrgAccess, requireUid } from "./utils";

function normalizeStatus(t: any): "open" | "done" | "verified" {
  if (t?.status === "verified" || t?.verified) return "verified";
  return t?.completed ? "done" : "open";
}

function normalizeListQuery(src: any): Record<string, unknown> {
  const q: any = { ...(src || {}) };

  // enrollmentIds can arrive as: "a,b", "a", or ["a","b"] depending on client / express
  const toIds = (v: any): string[] | undefined => {
    if (!v) return undefined;
    if (Array.isArray(v)) return v.map(String).filter(Boolean);
    const s = String(v);
    if (!s) return undefined;
    return s.includes(",")
      ? s.split(",").map((x) => x.trim()).filter(Boolean)
      : [s];
  };

  if (q.enrollmentIds !== undefined) q.enrollmentIds = toIds(q.enrollmentIds);
  if (q.enrollmentId !== undefined) q.enrollmentId = String(q.enrollmentId);
  if (q.dueMonth !== undefined) q.dueMonth = String(q.dueMonth);
  if (q.status !== undefined) q.status = String(q.status);
  if (q.bucket !== undefined) q.bucket = String(q.bucket);
  if (q.assigneeUid !== undefined) q.assigneeUid = String(q.assigneeUid);
  if (q.assigneeGroup !== undefined) q.assigneeGroup = String(q.assigneeGroup);

  if (q.limit !== undefined && typeof q.limit === "string") {
    const n = Number.parseInt(q.limit, 10);
    if (!Number.isNaN(n)) q.limit = n;
  }

  if (q.notify !== undefined && typeof q.notify === "string") {
    const s = q.notify.toLowerCase();
    if (s === "true") q.notify = true;
    if (s === "false") q.notify = false;
  }

  return q;
}

/** GET|POST /tasksList — flattened read directly from embedded schedule */
export const tasksList = secureHandler( async (req, res) => {
    const user: any = (req as any)?.user || {};
    requireUid(user); // stricter: no anon reads for enrollment tasks

    const raw = req.method === "GET" ? req.query : req.body;
    const parsed = C.TasksListQuery.safeParse(normalizeListQuery(raw));
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: parsed.error.message });
      return;
    }
    const q = parsed.data;
    const targetIds =
      q.enrollmentIds && q.enrollmentIds.length
        ? q.enrollmentIds
        : q.enrollmentId
        ? [q.enrollmentId]
        : [];

    if (!targetIds.length) {
      res.status(400).json({ ok: false, error: "Missing enrollmentId(s)" });
      return;
    }

    const snaps = await Promise.all(
      targetIds.map((id) =>
        db.collection("customerEnrollments").doc(id).get()
      )
    );

    const items: any[] = [];
    const customerNameById = new Map<string, string | null>();
    const resolveCustomerName = async (customerId: string): Promise<string | null> => {
      const id = String(customerId || "").trim();
      if (!id) return null;
      if (customerNameById.has(id)) return customerNameById.get(id) ?? null;
      const snap = await db.collection("customers").doc(id).get().catch(() => null);
      const doc = snap?.exists ? (snap.data() || {}) : {};
      const name =
        String((doc as any)?.name || "").trim() ||
        `${String((doc as any)?.firstName || "").trim()} ${String((doc as any)?.lastName || "").trim()}`.trim() ||
        null;
      customerNameById.set(id, name);
      return name;
    };
    for (const s of snaps) {
      if (!s.exists) continue;
      const e: any = { id: s.id, ...(s.data() || {}) };

      assertOrgAccess(user, e);

      const schedule: any[] = Array.isArray(e.taskSchedule)
        ? e.taskSchedule
        : [];
      for (const t of schedule) {
        const resolvedCustomerId = String(e.customerId ?? e.clientId ?? "").trim();
        const fallbackCustomerName =
          !t?.customerName && !e.customerName && !e.clientName && resolvedCustomerId
            ? await resolveCustomerName(resolvedCustomerId)
            : null;
        const rec = {
          id: `${s.id}__${String(t?.id || "")}`,
          taskId: String(t?.id || ""),
          enrollmentId: s.id,
          customerId: e.customerId ?? e.clientId ?? null,
          grantId: e.grantId ?? null,
          customerName: t?.customerName ?? e.customerName ?? e.clientName ?? fallbackCustomerName ?? null,
          caseManagerName: t?.caseManagerName ?? e.caseManagerName ?? null,
          grantName: t?.grantName ?? e.grantName ?? null,
          enrollmentName: t?.enrollmentName ?? e.name ?? null,

          title: String(t?.type || "Task"),
          note: t?.notes ?? "",
          description: t?.description ?? null,
          bucket: t?.bucket ?? null,
          defId: t?.defId ?? null,
          managed: !!t?.managed,

          // multiparty metadata (for UI grouping)
          multiParentId: t?.multiParentId ?? null,
          multiStepIndex:
            typeof t?.multiStepIndex === "number"
              ? t.multiStepIndex
              : null,
          multiStepCount:
            typeof t?.multiStepCount === "number"
              ? t.multiStepCount
              : null,
          multiMode: t?.multiMode ?? null,

          dueDate: String(t?.dueDate || ""),
          dueMonth: String(t?.dueDate || "").slice(0, 7) || null,
          status: normalizeStatus(t),
          notify: t?.notify !== false,

          assignedToUid: t?.assignedToUid ?? null,
          assignedToGroup: t?.assignedToGroup ?? null,
          assignedAt: t?.assignedAt ?? null,
        };

        if (q.dueMonth && rec.dueMonth !== q.dueMonth) continue;
        if (q.status && rec.status !== q.status) continue;
        if (q.bucket && rec.bucket !== q.bucket) continue;
        if (q.assigneeUid) {
          const assigneeMatch = rec.assignedToUid === q.assigneeUid;
          const cmQueueMatch = !rec.assignedToUid && String(rec.assignedToGroup || "").toLowerCase() === "casemanager";
          if (!assigneeMatch && !cmQueueMatch) continue;
        }
        if (
          q.assigneeGroup &&
          rec.assignedToGroup !== q.assigneeGroup
        )
          continue;
        if (q.notify !== undefined && rec.notify !== q.notify) continue;

        items.push(rec);
        if (items.length >= q.limit) break;
      }
      if (items.length >= q.limit) break;
    }

    items.sort((a, b) => {
      const rank = (x: any) =>
        x.status === "open" ? 0 : x.status === "done" ? 1 : 2;
      const ra = rank(a),
        rb = rank(b);
      if (ra !== rb) return ra - rb;
      if (ra === 0)
        return String(a.dueDate).localeCompare(String(b.dueDate));
      return String(b.dueDate).localeCompare(String(a.dueDate));
    });

    res.status(200).json({ ok: true, items });
  },
  { auth: "user", methods: ["GET", "POST", "OPTIONS"] }
);
