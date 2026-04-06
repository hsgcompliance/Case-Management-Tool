// functions/src/features/enrollments/triggers.ts
import {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentDeleted,
} from "firebase-functions/v2/firestore";
import {db, FieldValue} from "../../core/admin";
import {
  changedTopLevelKeys,
  debugTriggerEvent,
  debugWrite,
  selfWriteMetadataOnly,
  topLevelMetadataOnly,
} from "../../core/triggerDebug";
import { syncCustomerAssistanceLength } from "../customers/assistanceLength";

const FN_ENROLLMENT_CREATE_DEFAULTS = "onEnrollmentCreateDefaults";
const FN_ENROLLMENT_NORMALIZE = "onEnrollmentNormalize";
const FN_ENROLLMENT_DELETE = "onEnrollmentDelete";
const metricsRef = db.collection("metrics").doc("enrollments");
const grantsCol = db.collection("grants");

function enrollmentStatus(e: any): string {
  return String(e?.status || (e?.active ? "active" : "closed")).toLowerCase();
}

function enrollmentState(e: any): { status: string; active: boolean; deleted: boolean } {
  const status = enrollmentStatus(e);
  const deleted = e?.deleted === true || status === "deleted";
  const active = !deleted && (e?.active === true || status === "active");
  return { status, active, deleted };
}

function activeInactiveForGrant(e: any): { active: number; inactive: number } {
  const st = enrollmentState(e);
  if (st.deleted) return { active: 0, inactive: 0 };
  return st.active ? { active: 1, inactive: 0 } : { active: 0, inactive: 1 };
}

async function applyGrantEnrollmentDeltas(
  deltas: Record<string, { active: number; inactive: number }>
) {
  const entries = Object.entries(deltas).filter(
    ([gid, d]) => !!gid && (d.active !== 0 || d.inactive !== 0)
  );
  if (!entries.length) return;

  const writes = entries.map(async ([grantId, d]) => {
    const ref = grantsCol.doc(grantId);
    await ref.set(
      {
        metrics: {
          enrollmentCounts: {
            active: FieldValue.increment(d.active),
            inactive: FieldValue.increment(d.inactive),
          },
          updatedAt: FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );
  });
  await Promise.all(writes);
}

function enrollmentCustomerId(row: any): string {
  return String(row?.customerId || row?.clientId || "").trim();
}

export const onEnrollmentCreateDefaults = onDocumentCreated(
  {region: "us-central1", document: "customerEnrollments/{id}"},
  async (event) => {
    const id = String(event.params.id);
    const snap = event.data;
    if (!snap) return;
    const e: any = snap.data();
    const changedKeys = changedTopLevelKeys(null, e);
    debugTriggerEvent({
      fn: FN_ENROLLMENT_CREATE_DEFAULTS,
      event: event as any,
      beforeRefPath: null,
      afterRefPath: snap.ref?.path || null,
      changedKeys,
    });

    const patch: any = {};
    if (!e?.createdAt) patch.createdAt = FieldValue.serverTimestamp();
    const status = e?.status;
    if (status == null) patch.status = "active";
    if (e?.active == null) patch.active = (status ?? "active") === "active";
    if (e?.deleted == null && (status ?? "active") !== "deleted") patch.deleted = false;

    if (Object.keys(patch).length) {
      patch.system = { lastWriter: FN_ENROLLMENT_CREATE_DEFAULTS, lastWriteAt: FieldValue.serverTimestamp() };
      debugWrite({
        fn: FN_ENROLLMENT_CREATE_DEFAULTS,
        path: db.collection("customerEnrollments").doc(id).path,
        write: patch,
      });
      await db.collection("customerEnrollments").doc(id).set(patch, {merge: true});
    }

    const st = enrollmentState({ ...e, ...patch });
    await metricsRef.set(
      {
        total: FieldValue.increment(1),
        active: FieldValue.increment(st.active ? 1 : 0),
        inactive: FieldValue.increment(!st.active && !st.deleted ? 1 : 0),
        deleted: FieldValue.increment(st.deleted ? 1 : 0),
        [`status.${st.status}`]: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const grantId = String(e?.grantId || "").trim();
    if (grantId) {
      const c = activeInactiveForGrant({ ...e, ...patch });
      await applyGrantEnrollmentDeltas({
        [grantId]: { active: c.active, inactive: c.inactive },
      });
    }

    const customerId = enrollmentCustomerId({ ...e, ...patch });
    if (customerId) {
      await syncCustomerAssistanceLength(customerId);
    }
  }
);

export const onEnrollmentNormalize = onDocumentUpdated(
  {region: "us-central1", document: "customerEnrollments/{id}"},
  async (event) => {
    const id = String(event.params.id);
    const before: any = event.data?.before?.data() || {};
    const after: any = event.data?.after?.data() || {};
    const changedKeys = changedTopLevelKeys(before, after);
    debugTriggerEvent({
      fn: FN_ENROLLMENT_NORMALIZE,
      event: event as any,
      beforeRefPath: event.data?.before?.ref?.path || null,
      afterRefPath: event.data?.after?.ref?.path || null,
      changedKeys,
    });
    if (selfWriteMetadataOnly(FN_ENROLLMENT_NORMALIZE, after, changedKeys, ["active", "deleted"])) return;
    if (topLevelMetadataOnly(changedKeys)) return;

    const patch: any = {};
    let changed = false;

    if (before.status !== after.status) {
      const active = after.status === "active";
      if (after.active !== active) {
        patch.active = active; changed = true;
      }
      if (after.status === "deleted" && after.deleted !== true) {
        patch.deleted = true; changed = true;
      }
      if ((after.status === "active" || after.status === "closed") && after.deleted === true) {
        patch.deleted = false; changed = true;
      }
    }

    const prev = enrollmentState(before);
    const next = enrollmentState({ ...after, ...patch });

    const metricWrite: any = { updatedAt: FieldValue.serverTimestamp() };
    let deltaActive = 0;
    let deltaInactive = 0;
    let deltaDeleted = 0;
    if (prev.status !== next.status) {
      metricWrite[`status.${prev.status}`] = FieldValue.increment(-1);
      metricWrite[`status.${next.status}`] = FieldValue.increment(1);
    }
    if (prev.active !== next.active) {
      deltaActive += next.active ? 1 : -1;
      deltaInactive += next.active ? -1 : 1;
    }
    if (prev.deleted !== next.deleted) {
      deltaDeleted += next.deleted ? 1 : -1;
      if (next.deleted) {
        deltaInactive += -1;
      } else if (!next.active) {
        deltaInactive += 1;
      }
    }
    if (deltaActive) metricWrite.active = FieldValue.increment(deltaActive);
    if (deltaInactive) metricWrite.inactive = FieldValue.increment(deltaInactive);
    if (deltaDeleted) metricWrite.deleted = FieldValue.increment(deltaDeleted);

    if (changed) {
      patch.updatedAt = FieldValue.serverTimestamp();
      patch.system = {
        lastWriter: FN_ENROLLMENT_NORMALIZE,
        lastWriteAt: FieldValue.serverTimestamp(),
      };
      debugWrite({
        fn: FN_ENROLLMENT_NORMALIZE,
        path: db.collection("customerEnrollments").doc(id).path,
        write: patch,
      });
      await db.collection("customerEnrollments").doc(id).set(patch, {merge: true});
    }

    if (Object.keys(metricWrite).length > 1) {
      await metricsRef.set(metricWrite, { merge: true });
    }

    const prevGrantId = String(before?.grantId || "").trim();
    const nextGrantId = String(after?.grantId || "").trim();
    const prevC = activeInactiveForGrant(before);
    const nextC = activeInactiveForGrant({ ...after, ...patch });
    const grantDeltas: Record<string, { active: number; inactive: number }> = {};

    if (prevGrantId && prevGrantId === nextGrantId) {
      const da = nextC.active - prevC.active;
      const di = nextC.inactive - prevC.inactive;
      if (da || di) grantDeltas[prevGrantId] = { active: da, inactive: di };
    } else {
      if (prevGrantId) {
        grantDeltas[prevGrantId] = {
          active: (grantDeltas[prevGrantId]?.active || 0) - prevC.active,
          inactive: (grantDeltas[prevGrantId]?.inactive || 0) - prevC.inactive,
        };
      }
      if (nextGrantId) {
        grantDeltas[nextGrantId] = {
          active: (grantDeltas[nextGrantId]?.active || 0) + nextC.active,
          inactive: (grantDeltas[nextGrantId]?.inactive || 0) + nextC.inactive,
        };
      }
    }

    await applyGrantEnrollmentDeltas(grantDeltas);

    const assistanceRelevantChange = changedKeys.some((key) =>
      ["payments", "customerId", "clientId", "active", "deleted", "status"].includes(key)
    );
    if (assistanceRelevantChange) {
      const prevCustomerId = enrollmentCustomerId(before);
      const nextCustomerId = enrollmentCustomerId({ ...after, ...patch });
      if (prevCustomerId && prevCustomerId !== nextCustomerId) {
        await syncCustomerAssistanceLength(prevCustomerId);
      }
      if (nextCustomerId) {
        await syncCustomerAssistanceLength(nextCustomerId);
      }
    }
  }
);

export const onEnrollmentDelete = onDocumentDeleted(
  { region: "us-central1", document: "customerEnrollments/{id}" },
  async (event) => {
    const before: any = event.data?.data() || {};
    const st = enrollmentState(before);
    await metricsRef.set(
      {
        total: FieldValue.increment(-1),
        active: FieldValue.increment(st.active ? -1 : 0),
        inactive: FieldValue.increment(!st.active && !st.deleted ? -1 : 0),
        deleted: FieldValue.increment(st.deleted ? -1 : 0),
        [`status.${st.status}`]: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    const grantId = String(before?.grantId || "").trim();
    if (grantId) {
      const c = activeInactiveForGrant(before);
      await applyGrantEnrollmentDeltas({
        [grantId]: { active: -c.active, inactive: -c.inactive },
      });
    }
    const customerId = enrollmentCustomerId(before);
    if (customerId) {
      await syncCustomerAssistanceLength(customerId);
    }
    debugTriggerEvent({
      fn: FN_ENROLLMENT_DELETE,
      event: event as any,
      beforeRefPath: event.data?.ref?.path || null,
      afterRefPath: null,
      changedKeys: changedTopLevelKeys(before, null),
    });
  }
);
