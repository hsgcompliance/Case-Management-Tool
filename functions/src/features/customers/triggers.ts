// functions/src/features/customers/triggers.ts
import {
  db,
  FieldValue,
  RUNTIME,
} from "../../core";
import {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentDeleted,
} from "firebase-functions/v2/firestore";
import {
  changedTopLevelKeys,
  debugTriggerEvent,
  debugWrite,
  selfWriteMetadataOnly,
  topLevelMetadataOnly,
} from "../../core/triggerDebug";

const FN_CUSTOMER_CREATE = "onCustomerCreate";
const FN_CUSTOMER_UPDATE = "onCustomerUpdate";
const FN_CUSTOMER_DELETE = "onCustomerDelete";
const metricsRef = db.collection("metrics").doc("customers");

const normArr = (a?: string[]) => (Array.isArray(a) ? [...a].sort() : []);
const eqArr = (a?: string[], b?: string[]) => {
  const A = normArr(a);
  const B = normArr(b);
  return A.length === B.length && A.every((v, i) => v === B[i]);
};

function contactCaseManagerIds(c: any): string[] {
  const otherIds = Array.isArray(c?.otherContacts)
    ? c.otherContacts
        .map((entry: unknown) => String((entry as { uid?: unknown })?.uid || "").trim())
        .filter(Boolean)
    : [];
  const ids = [
    String(c?.caseManagerId || "").trim(),
    String(c?.secondaryCaseManagerId || "").trim(),
    ...otherIds,
  ].filter(Boolean);
  return Array.from(new Set(ids)).sort();
}

function buildCustomerTags(c: any) {
  const t = new Set<string>();
  if (c.active) t.add("active");
  if (c.status) t.add(`status:${String(c.status).toLowerCase()}`);
  for (const uid of contactCaseManagerIds(c)) t.add(`cm:${uid}`);
  if (c.population) t.add(`pop:${String(c.population).toLowerCase()}`);
  return Array.from(t).sort();
}

function statusOf(c: any): string {
  return String(c?.status || (c?.active ? "active" : "inactive")).toLowerCase();
}

function isActive(c: any): boolean {
  return c?.active === true || statusOf(c) === "active";
}

function populationBucket(v: unknown): "youth" | "individuals" | "families" | null {
  const s = String(v || "").trim().toLowerCase();
  if (s === "youth") return "youth";
  if (s === "individual" || s === "individuals") return "individuals";
  if (s === "family" || s === "families") return "families";
  return null;
}

function isActiveEnrollment(row: any): boolean {
  const status = String(row?.status || "").trim().toLowerCase();
  if (row?.deleted === true || status === "deleted") return false;
  if (row?.active === false || status === "closed") return false;
  return true;
}

async function syncCustomerCaseManagerToEnrollments(
  customerId: string,
  before: any,
  after: any
) {
  const nextCmId = String(after?.caseManagerId || "").trim();
  const prevCmId = String(before?.caseManagerId || "").trim();
  const nextCmName = String(after?.caseManagerName || "").trim() || null;
  const prevCmName = String(before?.caseManagerName || "").trim() || null;

  if (!customerId || !nextCmId) return;
  if (nextCmId === prevCmId && nextCmName === prevCmName) return;

  const [clientSnap, customerSnap] = await Promise.all([
    db.collection("customerEnrollments").where("clientId", "==", customerId).get(),
    db.collection("customerEnrollments").where("customerId", "==", customerId).get(),
  ]);

  const seen = new Set<string>();
  const batch = db.batch();
  let writes = 0;

  for (const snap of [clientSnap, customerSnap]) {
    snap.forEach((doc) => {
      if (seen.has(doc.ref.path)) return;
      seen.add(doc.ref.path);

      const row = doc.data() || {};
      if (!isActiveEnrollment(row)) return;

      const enrollmentCmId = String((row as any)?.caseManagerId || "").trim();
      const inheritedPrev = !!prevCmId && enrollmentCmId === prevCmId;
      if (enrollmentCmId && !inheritedPrev) return;

      const enrollmentCmName = String((row as any)?.caseManagerName || "").trim() || null;
      const patch: Record<string, unknown> = {};

      if (enrollmentCmId !== nextCmId) patch.caseManagerId = nextCmId;
      if (
        nextCmName &&
        enrollmentCmName !== nextCmName &&
        (!enrollmentCmId || inheritedPrev || enrollmentCmId === nextCmId)
      ) {
        patch.caseManagerName = nextCmName;
      }

      if (!Object.keys(patch).length) return;
      patch.updatedAt = FieldValue.serverTimestamp();
      patch.system = {
        lastWriter: FN_CUSTOMER_UPDATE,
        lastWriteAt: FieldValue.serverTimestamp(),
      };
      debugWrite({ fn: FN_CUSTOMER_UPDATE, path: doc.ref.path, write: patch });
      batch.set(doc.ref, patch, { merge: true });
      writes += 1;
    });
  }

  if (writes) {
    await batch.commit();
  }
}

/**
 * Triggers are **non-metric only**:
 *  - set createdAt on create
 *  - maintain _tags for UX search
 */

export const onCustomerCreate = onDocumentCreated(
  { region: RUNTIME.region, document: "customers/{id}" },
  async (e) => {
    const ref = db.doc(`customers/${e.params.id}`);
    const data = e.data?.data();
    if (!data) return;
    const changedKeys = changedTopLevelKeys(null, data as any);
    debugTriggerEvent({
      fn: FN_CUSTOMER_CREATE,
      event: e as any,
      beforeRefPath: null,
      afterRefPath: e.data?.ref?.path || null,
      changedKeys,
    });

    if (!data.createdAt) {
      const write = { createdAt: FieldValue.serverTimestamp() };
      debugWrite({ fn: FN_CUSTOMER_CREATE, path: ref.path, write });
      await ref.set(write, { merge: true });
    }

    const tags = buildCustomerTags(data);
    const contactIds = contactCaseManagerIds(data);
    if (!eqArr(tags, data._tags as string[]) || !eqArr(contactIds, data.contactCaseManagerIds as string[])) {
      const write = { _tags: tags, contactCaseManagerIds: contactIds };
      debugWrite({ fn: FN_CUSTOMER_CREATE, path: ref.path, write });
      await ref.set(write, { merge: true });
    }

    const st = statusOf(data);
    const active = isActive(data);
    const pop = active ? populationBucket(data.population) : null;
    const metricWrite: Record<string, unknown> = {
      total: FieldValue.increment(1),
      active: FieldValue.increment(active ? 1 : 0),
      inactive: FieldValue.increment(active ? 0 : 1),
      [`status.${st}`]: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (pop) metricWrite[`active_population.${pop}`] = FieldValue.increment(1);
    await metricsRef.set(metricWrite, { merge: true });
  }
);

export const onCustomerUpdate = onDocumentUpdated(
  { region: RUNTIME.region, document: "customers/{id}" },
  async (e) => {
    const ref = db.doc(`customers/${e.params.id}`);
    const before = e.data?.before?.data() || null;
    const after = e.data?.after?.data();
    if (!after) return;
    const changedKeys = changedTopLevelKeys(before as any, after as any);
    debugTriggerEvent({
      fn: FN_CUSTOMER_UPDATE,
      event: e as any,
      beforeRefPath: e.data?.before?.ref?.path || null,
      afterRefPath: e.data?.after?.ref?.path || null,
      changedKeys,
    });
    if (selfWriteMetadataOnly(FN_CUSTOMER_UPDATE, after, changedKeys)) return;
    if (topLevelMetadataOnly(changedKeys)) return;

    // Backfill createdAt if older docs exist
    if (!after.createdAt) {
      const write = { createdAt: FieldValue.serverTimestamp() };
      debugWrite({ fn: FN_CUSTOMER_UPDATE, path: ref.path, write });
      await ref.set(write, { merge: true });
    }

    const tags = buildCustomerTags(after);
    const contactIds = contactCaseManagerIds(after);
    if (!eqArr(tags, after._tags as string[]) || !eqArr(contactIds, after.contactCaseManagerIds as string[])) {
      const write = { _tags: tags, contactCaseManagerIds: contactIds };
      debugWrite({ fn: FN_CUSTOMER_UPDATE, path: ref.path, write });
      await ref.set(write, { merge: true });
    }

    const prevStatus = statusOf(before);
    const nextStatus = statusOf(after);
    const wasActive = isActive(before);
    const isNowActive = isActive(after);
    const prevPop = wasActive ? populationBucket((before as any)?.population) : null;
    const nextPop = isNowActive ? populationBucket(after.population) : null;

    const metricWrite: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (prevStatus !== nextStatus) {
      metricWrite[`status.${prevStatus}`] = FieldValue.increment(-1);
      metricWrite[`status.${nextStatus}`] = FieldValue.increment(1);
    }

    if (wasActive !== isNowActive) {
      metricWrite.active = FieldValue.increment(isNowActive ? 1 : -1);
      metricWrite.inactive = FieldValue.increment(isNowActive ? -1 : 1);
    }

    if (prevPop !== nextPop) {
      if (prevPop) metricWrite[`active_population.${prevPop}`] = FieldValue.increment(-1);
      if (nextPop) metricWrite[`active_population.${nextPop}`] = FieldValue.increment(1);
    }

    if (Object.keys(metricWrite).length > 1) {
      await metricsRef.set(metricWrite, { merge: true });
    }

    if (changedKeys.includes("caseManagerId") || changedKeys.includes("caseManagerName")) {
      await syncCustomerCaseManagerToEnrollments(String(e.params.id || ""), before, after);
    }
  }
);

export const onCustomerDelete = onDocumentDeleted(
  {
    region: RUNTIME.region,
    document: "customers/{customerId}",
  },
  async (_event) => {
    debugTriggerEvent({
      fn: FN_CUSTOMER_DELETE,
      event: _event as any,
      beforeRefPath: _event.data?.ref?.path || null,
      afterRefPath: null,
      changedKeys: _event.data?.exists ? changedTopLevelKeys(_event.data.data() as any, null) : [],
    });
    const before = _event.data?.data() || {};
    const st = statusOf(before);
    const active = isActive(before);
    const pop = active ? populationBucket(before.population) : null;

    const metricWrite: Record<string, unknown> = {
      total: FieldValue.increment(-1),
      active: FieldValue.increment(active ? -1 : 0),
      inactive: FieldValue.increment(active ? 0 : -1),
      [`status.${st}`]: FieldValue.increment(-1),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (pop) metricWrite[`active_population.${pop}`] = FieldValue.increment(-1);
    await metricsRef.set(metricWrite, { merge: true });
  }
);
