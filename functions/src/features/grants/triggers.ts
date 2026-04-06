// functions/src/features/grants/triggers.ts
import {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentDeleted,
  type FirestoreEvent,
  type QueryDocumentSnapshot,
  type Change,
} from "firebase-functions/v2/firestore";
import { db, FieldValue, RUNTIME, normId, isoNow } from "../../core";
import {
  changedTopLevelKeys,
  debugTriggerEvent,
  debugWrite,
  selfWriteMetadataOnly,
  topLevelMetadataOnly,
} from "../../core/triggerDebug";

const FN_GRANT_CREATE = "onGrantCreate";
const FN_GRANT_UPDATE = "onGrantUpdate";
const FN_GRANT_DELETE = "onGrantDelete";

const metricsRef = db.collection("metrics").doc("grants");

const norm = (a?: string[]) => (Array.isArray(a) ? [...a].sort() : []);
const eqArr = (a?: string[], b?: string[]) => {
  const A = norm(a);
  const B = norm(b);
  return A.length === B.length && A.every((v, i) => v === B[i]);
};

function buildGrantTags(g: Record<string, unknown>) {
  const t = new Set<string>();

  if (g.active) t.add("active");
  if (g.status) t.add(`status:${String(g.status).toLowerCase()}`);

  const kind = String(g.kind || "").toLowerCase();
  if (kind === "grant" || kind === "program") t.add(`kind:${kind}`);

  const org = normId(g.orgId);
  if (org) t.add(`org:${org}`);

  return Array.from(t).sort();
}

function kindOf(g: Record<string, unknown>): "grant" | "program" {
  return String(g?.kind || "").toLowerCase() === "program" ? "program" : "grant";
}

export const onGrantCreate = onDocumentCreated(
  { region: RUNTIME.region, document: "grants/{id}" },
  async (
    event: FirestoreEvent<QueryDocumentSnapshot | undefined, { id: string }>,
  ) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data() || {};
    const changedKeys = changedTopLevelKeys(null, data as any);
    debugTriggerEvent({
      fn: FN_GRANT_CREATE,
      event: event as any,
      beforeRefPath: null,
      afterRefPath: snap.ref?.path || null,
      changedKeys,
    });

    const createWrite = { createdAt: FieldValue.serverTimestamp() };
    debugWrite({ fn: FN_GRANT_CREATE, path: `grants/${event.params.id}`, write: createWrite });
    await db.doc(`grants/${event.params.id}`).set(createWrite, { merge: true });

    const tags = buildGrantTags(data);
    if (!eqArr(tags, data._tags as string[])) {
      const write = { _tags: tags };
      debugWrite({ fn: FN_GRANT_CREATE, path: `grants/${event.params.id}`, write });
      await db.doc(`grants/${event.params.id}`).set(write, { merge: true });
    }

    const status = String(data.status || "draft").toLowerCase();
    const kind = kindOf(data);
    const active = !!data.active;

    // Create grant compliance task when a grant is created as active
    if (active || status === "active") {
      const grantId = event.params.id;
      const grantName = String(data.name || data.grantName || grantId).trim() || grantId;
      const utid = `grantcomp|${grantId}`;
      await db.collection("userTasks").doc(utid).set({
        utid,
        source: "grantCompliance",
        status: "open",
        grantId,
        grantName,
        title: `Grant Entry • ${grantName}`,
        subtitle: "Complete HMIS Entry and CW Entry",
        assignedToGroup: "compliance",
        hmisComplete: false,
        caseworthyComplete: false,
        createdAtISO: isoNow(),
        updatedAtISO: isoNow(),
      }, { merge: true });
    }

    await metricsRef.set(
      {
        total: FieldValue.increment(1),
        [`status.${status}`]: FieldValue.increment(1),
        [`kind.${kind}`]: FieldValue.increment(1),
        ...(active
          ? { active: FieldValue.increment(1) }
          : { inactive: FieldValue.increment(1) }),
        ...(kind === "grant"
          ? active
            ? { activeGrants: FieldValue.increment(1) }
            : { inactiveGrants: FieldValue.increment(1) }
          : active
          ? { activePrograms: FieldValue.increment(1) }
          : { inactivePrograms: FieldValue.increment(1) }),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  },
);

export const onGrantUpdate = onDocumentUpdated(
  { region: RUNTIME.region, document: "grants/{id}" },
  async (
    event: FirestoreEvent<
      Change<QueryDocumentSnapshot> | undefined,
      { id: string }
    >,
  ) => {
    const before = event.data?.before?.data() || {};
    const after = event.data?.after?.data() || {};
    if (!event.data) return;
    const changedKeys = changedTopLevelKeys(before as any, after as any);
    debugTriggerEvent({
      fn: FN_GRANT_UPDATE,
      event: event as any,
      beforeRefPath: event.data?.before?.ref?.path || null,
      afterRefPath: event.data?.after?.ref?.path || null,
      changedKeys,
    });
    if (selfWriteMetadataOnly(FN_GRANT_UPDATE, after, changedKeys)) return;
    if (topLevelMetadataOnly(changedKeys)) return;

    const newTags = buildGrantTags(after);
    if (!eqArr(newTags, (after._tags as string[]) || [])) {
      const write = { _tags: newTags };
      debugWrite({ fn: FN_GRANT_UPDATE, path: `grants/${event.params.id}`, write });
      await db.doc(`grants/${event.params.id}`).set(write, { merge: true });
    }

    const prevStatus = String(before.status || "draft").toLowerCase();
    const nextStatus = String(after.status || "draft").toLowerCase();
    const wasActive = !!before.active;
    const isActive = !!after.active;
    const prevKind = kindOf(before as any);
    const nextKind = kindOf(after as any);

    const updateDoc: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (prevStatus !== nextStatus) {
      updateDoc[`status.${prevStatus}`] = FieldValue.increment(-1);
      updateDoc[`status.${nextStatus}`] = FieldValue.increment(+1);
    }
    if (wasActive !== isActive) {
      updateDoc.active = FieldValue.increment(isActive ? +1 : -1);
      updateDoc.inactive = FieldValue.increment(isActive ? -1 : +1);
    }
    if (prevKind !== nextKind) {
      updateDoc[`kind.${prevKind}`] = FieldValue.increment(-1);
      updateDoc[`kind.${nextKind}`] = FieldValue.increment(1);
    }

    const adjustKindActive = (k: "grant" | "program", act: boolean, delta: number) => {
      if (k === "grant") {
        updateDoc[act ? "activeGrants" : "inactiveGrants"] = FieldValue.increment(delta);
      } else {
        updateDoc[act ? "activePrograms" : "inactivePrograms"] = FieldValue.increment(delta);
      }
    };
    if (prevKind !== nextKind || wasActive !== isActive) {
      adjustKindActive(prevKind, wasActive, -1);
      adjustKindActive(nextKind, isActive, +1);
    }

    if (Object.keys(updateDoc).length > 1) {
      debugWrite({ fn: FN_GRANT_UPDATE, path: "metrics/grants", write: updateDoc });
      await metricsRef.set(updateDoc, { merge: true });
    }

    // Grant compliance task: create when grant becomes active, close when inactive/closed.
    const statusChanged = prevStatus !== nextStatus || wasActive !== isActive;
    if (statusChanged) {
      const grantId = event.params.id;
      const grantName = String(after.name || after.grantName || grantId).trim() || grantId;
      const utid = `grantcomp|${grantId}`;
      const taskRef = db.collection("userTasks").doc(utid);

      if (isActive || nextStatus === "active") {
        // Upsert open compliance task (idempotent — won't overwrite if already done)
        const existing = await taskRef.get();
        const alreadyDone = existing.exists && String((existing.data() as any)?.status || "").toLowerCase() === "done";
        if (!alreadyDone) {
          await taskRef.set({
            utid,
            source: "grantCompliance",
            status: "open",
            grantId,
            grantName,
            title: `Grant Entry • ${grantName}`,
            subtitle: "Complete HMIS Entry and CW Entry",
            assignedToGroup: "compliance",
            hmisComplete: false,
            caseworthyComplete: false,
            createdAtISO: isoNow(),
            updatedAtISO: isoNow(),
          }, { merge: true });
        }
      } else if (!isActive || nextStatus === "closed" || nextStatus === "inactive") {
        // Close the compliance task
        await taskRef.set({
          status: "done",
          completedAtISO: isoNow(),
          updatedAtISO: isoNow(),
        }, { merge: true });
      }
    }
  },
);

export const onGrantDelete = onDocumentDeleted(
  { region: RUNTIME.region, document: "grants/{id}" },
  async (
    event: FirestoreEvent<QueryDocumentSnapshot | undefined, { id: string }>,
  ) => {
    const snap = event.data;
    const data = snap?.data() || {};
    debugTriggerEvent({
      fn: FN_GRANT_DELETE,
      event: event as any,
      beforeRefPath: snap?.ref?.path || null,
      afterRefPath: null,
      changedKeys: changedTopLevelKeys(data as any, null),
    });
    const status = String(data.status || "draft").toLowerCase();
    const kind = kindOf(data as any);
    const active = !!data.active;

    await metricsRef.set(
      {
        total: FieldValue.increment(-1),
        [`status.${status}`]: FieldValue.increment(-1),
        [`kind.${kind}`]: FieldValue.increment(-1),
        ...(active
          ? { active: FieldValue.increment(-1) }
          : { inactive: FieldValue.increment(-1) }),
        ...(kind === "grant"
          ? active
            ? { activeGrants: FieldValue.increment(-1) }
            : { inactiveGrants: FieldValue.increment(-1) }
          : active
          ? { activePrograms: FieldValue.increment(-1) }
          : { inactivePrograms: FieldValue.increment(-1) }),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  },
);
