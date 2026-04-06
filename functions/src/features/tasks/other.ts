// functions/src/features/tasks/other.ts
import { secureHandler, db, FieldValue } from "../../core";
import { tasks as C } from "@hdb/contracts";
import { assertOrgAccess, getOrgIdFromClaims, requireUid } from "./utils";

/**
 * OtherTasks collection routes.
 * Contract policy: parse all req bodies via contracts schemas.
 *
 * OtherTasks are standalone tasks not tied to enrollments.
 */

/** collection */
const COL = "otherTasks";

async function resolveOtherTaskDoc(id: string) {
  const raw = String(id || "").trim();
  if (!raw) return null;

  const candidates = Array.from(
    new Set(
      [
        raw,
        raw.startsWith("other|") ? raw.split("|")[1] : null,
        raw.startsWith("other_") ? raw.slice("other_".length) : null,
      ].filter((x): x is string => !!x)
    )
  );

  for (const cid of candidates) {
    const primaryRef = db.collection(COL).doc(cid);
    const primarySnap = await primaryRef.get();
    if (primarySnap.exists) {
      return {kind: "other" as const, ref: primaryRef, snap: primarySnap, doc: (primarySnap.data() || {}) as any};
    }
  }

  const inboxIds = Array.from(
    new Set(
      candidates.flatMap((cid) =>
        cid.startsWith("other|") ? [cid] : [cid, `other|${cid}`]
      )
    )
  );
  for (const iid of inboxIds) {
    const inboxRef = db.collection("userTasks").doc(iid);
    const inboxSnap = await inboxRef.get();
    if (inboxSnap.exists) {
      return {kind: "inbox" as const, ref: inboxRef, snap: inboxSnap, doc: (inboxSnap.data() || {}) as any};
    }
  }

  for (const cid of candidates) {
    const bySourceId = await db.collection("userTasks").where("sourceId", "==", cid).limit(1).get();
    const first = bySourceId.docs[0];
    if (first) {
      return {kind: "inbox" as const, ref: first.ref, snap: first, doc: (first.data() || {}) as any};
    }
    const bySourcePath = await db.collection("userTasks").where("sourcePath", "==", `otherTasks/${cid}`).limit(1).get();
    const second = bySourcePath.docs[0];
    if (second) {
      return {kind: "inbox" as const, ref: second.ref, snap: second, doc: (second.data() || {}) as any};
    }
  }

  return null;
}

/** POST /tasksOtherCreate */
export const createOtherTask = secureHandler(
  async (req, res) => {
    const user: any = (req as any)?.user || {};
    const uid = requireUid(user);
    const orgId = getOrgIdFromClaims(user);

    const body = C.TasksOtherCreateBody.parse(req.body || {});
    const nowIso = new Date().toISOString();

    const assignedToGroup = body.assign?.group ?? null;
    const explicitUids =
      Array.isArray(body.assign?.uids) && body.assign.uids.length
        ? body.assign.uids.filter((x): x is string => !!String(x || "").trim())
        : [];
    // Group queues should not remain user-assigned unless explicit uids were provided.
    const assignedToUids = explicitUids.length ? explicitUids : assignedToGroup ? [] : [uid];

    // Normalize due fields
    const dueDate = body.dueDate || null;
    const dueMonth =
      typeof dueDate === "string" && dueDate.length >= 7 ? dueDate.slice(0, 7) : null;

    const ref = db.collection(COL).doc();
    await ref.set({
      id: ref.id,
      kind: "other",
      orgId: orgId || null,

      title: body.title,
      notes: body.notes || "",
      dueDate,
      dueMonth,
      notify: body.notify !== false,

      status: "open",
      completed: false,
      completedAt: null,

      ownerUid: uid,
      assignedToUids,
      assignedToGroup,

      createdAt: FieldValue.serverTimestamp(),
      createdAtISO: nowIso,
      updatedAt: FieldValue.serverTimestamp(),
      updatedAtISO: nowIso,
      updatedBy: uid,
    });

    res.status(201).json({ ok: true, id: ref.id });
  },
  { auth: "user", methods: ["POST", "OPTIONS"] }
);

/** POST /tasksOtherUpdate */
export const updateOtherTask = secureHandler(
  async (req, res) => {
    const user: any = (req as any)?.user || {};
    const uid = requireUid(user);

    const { id, patch } = C.TasksOtherUpdateBody.parse(req.body || {});
    const resolved = await resolveOtherTaskDoc(id);
    if (!resolved) {
      res.status(404).json({ ok: false, error: "not_found" });
      return;
    }
    const {kind, ref, doc} = resolved;
    assertOrgAccess(user, doc);

    const nowIso = new Date().toISOString();

    // dueMonth must be derived safely (patch.dueDate may be undefined or empty).
    const nextDueDate =
      Object.prototype.hasOwnProperty.call(patch, "dueDate") ? (patch.dueDate || null) : undefined;

    const update: Record<string, unknown> = kind === "other" ? {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      ...(nextDueDate !== undefined ? { dueDate: nextDueDate } : {}),
      ...(nextDueDate !== undefined
        ? {
            dueMonth:
              typeof nextDueDate === "string" && nextDueDate.length >= 7
                ? nextDueDate.slice(0, 7)
                : null,
          }
        : {}),
      ...(patch.notify !== undefined ? { notify: !!patch.notify } : {}),
      updatedAt: FieldValue.serverTimestamp(),
      updatedAtISO: nowIso,
      updatedBy: uid,
    } : {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.notes !== undefined ? { note: patch.notes, notes: patch.notes } : {}),
      ...(nextDueDate !== undefined ? { dueDate: nextDueDate } : {}),
      ...(nextDueDate !== undefined
        ? {
            dueMonth:
              typeof nextDueDate === "string" && nextDueDate.length >= 7
                ? nextDueDate.slice(0, 7)
                : null,
          }
        : {}),
      ...(patch.notify !== undefined ? { notify: !!patch.notify } : {}),
      updatedAtISO: nowIso,
      updatedBy: uid,
    };

    await ref.set(update, { merge: true });

    res.json({ ok: true, id });
  },
  { auth: "user", methods: ["POST", "OPTIONS"] }
);

/** POST /tasksOtherAssign */
export const assignOtherTask = secureHandler(
  async (req, res) => {
    const user: any = (req as any)?.user || {};
    const uid = requireUid(user);

    const { id, assign } = C.TasksOtherAssignBody.parse(req.body || {});
    const resolved = await resolveOtherTaskDoc(id);
    if (!resolved) {
      res.status(404).json({ ok: false, error: "not_found" });
      return;
    }
    const {kind, ref, doc} = resolved;
    assertOrgAccess(user, doc);

    const nowIso = new Date().toISOString();

    if (kind === "other") {
      const explicitUids =
        Array.isArray(assign.uids) && assign.uids.length
          ? assign.uids.filter((x): x is string => !!String(x || "").trim())
          : [];
      const nextGroup = assign.group ?? null;
      const nextUids = explicitUids.length ? explicitUids : nextGroup ? [] : [uid];
      await ref.set(
        {
          assignedToUids: nextUids,
          assignedToGroup: nextGroup,
          updatedAt: FieldValue.serverTimestamp(),
          updatedAtISO: nowIso,
          updatedBy: uid,
        },
        { merge: true }
      );
    } else {
      const firstUid = Array.isArray(assign.uids) && assign.uids.length ? String(assign.uids[0] || "") : "";
      await ref.set(
        {
          assignedToUid: firstUid || null,
          assignedToGroup: assign.group ?? (firstUid ? "casemanager" : null),
          updatedAtISO: nowIso,
          updatedBy: uid,
        },
        { merge: true }
      );
    }

    res.json({ ok: true, id });
  },
  { auth: "user", methods: ["POST", "OPTIONS"] }
);

/** POST /tasksOtherStatus */
export const updateOtherTaskStatus = secureHandler(
  async (req, res) => {
    const user: any = (req as any)?.user || {};
    const uid = requireUid(user);

    const { id, action } = C.TasksOtherStatusBody.parse(req.body || {});
    const resolved = await resolveOtherTaskDoc(id);
    if (!resolved) {
      res.status(404).json({ ok: false, error: "not_found" });
      return;
    }
    const {kind, ref, doc} = resolved;
    assertOrgAccess(user, doc);

    const nowIso = new Date().toISOString();

    if (kind === "other") {
      if (action === "complete") {
        await ref.set(
          {
            status: "done",
            completed: true,
            completedAt: nowIso,
            updatedAt: FieldValue.serverTimestamp(),
            updatedAtISO: nowIso,
            updatedBy: uid,
          },
          { merge: true }
        );
      } else {
        await ref.set(
          {
            status: "open",
            completed: false,
            completedAt: null,
            updatedAt: FieldValue.serverTimestamp(),
            updatedAtISO: nowIso,
            updatedBy: uid,
          },
          { merge: true }
        );
      }
    } else if (action === "complete") {
      await ref.set(
        {
          status: "done",
          completedAtISO: nowIso,
          updatedAtISO: nowIso,
          updatedBy: uid,
        },
        { merge: true }
      );
    } else {
      await ref.set(
        {
          status: "open",
          completedAtISO: null,
          updatedAtISO: nowIso,
          updatedBy: uid,
        },
        { merge: true }
      );
    }

    res.json({ ok: true, id });
  },
  { auth: "user", methods: ["POST", "OPTIONS"] }
);

/** GET /tasksOtherListMy?month=YYYY-MM&includeGroup=true */
export const listMyOtherTasks = secureHandler(
  async (req, res) => {
    const user: any = (req as any)?.user || {};
    const uid = requireUid(user);
    const orgId = getOrgIdFromClaims(user);

    // Parse query via contracts (supports includeGroup as "true"/"false")
    const parsed = C.TasksOtherListMyQuery.safeParse(req.query || {});
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: parsed.error.message });
      return;
    }

    const month = String(parsed.data.month || "").slice(0, 7);
    const includeGroup = String(parsed.data.includeGroup || "true") !== "false";

    let q: FirebaseFirestore.Query = db
      .collection(COL)
      .where("status", "==", "open")
      .where("notify", "==", true);

    if (orgId) q = q.where("orgId", "==", orgId);
    // Apply month filter at the Firestore level (dueMonth is stored on the doc)
    // to avoid fetching all open tasks and filtering in memory.
    if (month) q = q.where("dueMonth", "==", month);

    // My tasks
    const snapMine = await q.where("assignedToUids", "array-contains", uid).get();
    let items: any[] = snapMine.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));

    // Group tasks (if enabled). Note: this can be heavy; keep as-is per "minimal touch".
    if (includeGroup && orgId) {
      const groups: Array<"admin" | "compliance" | "casemanager"> = [
        "admin",
        "compliance",
        "casemanager",
      ];

      const more = await Promise.all(
        groups.map(async (g) => {
          const s = await q.where("assignedToGroup", "==", g).get();
          return s.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        })
      );

      for (const arr of more) items.push(...arr);
    }

    // Month filter is now applied upstream in the Firestore query (dueMonth field)

    // De-dupe by doc id, then sort by dueDate (nulls last)
    const seen = new Set<string>();
    const out = items
      .filter((x: any) => {
        const k = String(x?.id || "");
        if (!k) return false;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a: any, b: any) =>
        String(a?.dueDate || "9999-99-99").localeCompare(String(b?.dueDate || "9999-99-99"))
      );

    res.json({ ok: true, items: out });
  },
  { auth: "user", methods: ["GET", "OPTIONS"] }
);
