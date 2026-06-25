// functions/src/features/customers/triggers.ts
import {
  db,
  FieldValue,
  RUNTIME,
  isoNow,
  newBulkWriter,
} from "../../core";
import { syncEnrollmentProjectionQueueItems } from "../paymentQueue/service";
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

function displayCustomerName(c: any): string | null {
  const name = String(c?.name || c?.fullName || "").trim();
  if (name) return name;
  const parts = [c?.firstName, c?.lastName].map((v) => String(v || "").trim()).filter(Boolean);
  return parts.join(" ").trim() || null;
}

function sourceIsEnrollmentOwned(row: any): boolean {
  const source = String(row?.source || "").trim().toLowerCase();
  if (source === "enrollment" || source === "projection") return true;
  const originSource = String(row?.origin?.paymentQueueSource || "").trim().toLowerCase();
  return originSource === "projection";
}

function patchIfChanged(
  patch: Record<string, unknown>,
  row: Record<string, unknown>,
  field: string,
  next: string | null,
) {
  const prev = String(row[field] || "").trim() || null;
  if (prev !== next) patch[field] = next;
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

async function syncCustomerSnapshotsToOperationalRecords(
  customerId: string,
  before: any,
  after: any
) {
  if (!customerId) return;

  const nextName = displayCustomerName(after);
  const prevName = displayCustomerName(before);
  const nextCmId = String(after?.caseManagerId || "").trim() || null;
  const prevCmId = String(before?.caseManagerId || "").trim() || null;
  const nextCmName = String(after?.caseManagerName || "").trim() || null;
  const prevCmName = String(before?.caseManagerName || "").trim() || null;

  const nameChanged = nextName !== prevName;
  const cmChanged = nextCmId !== prevCmId || nextCmName !== prevCmName;
  if (!nameChanged && !cmChanged) return;

  const [queueSnap, ledgerSnap, spendSnap] = await Promise.all([
    db.collection("paymentQueue").where("customerId", "==", customerId).get(),
    db.collection("ledger").where("customerId", "==", customerId).get(),
    db.collectionGroup("spends").where("customerId", "==", customerId).get(),
  ]);

  const writer = newBulkWriter(2);
  let queueWrites = 0;
  let ledgerWrites = 0;
  let spendWrites = 0;

  queueSnap.forEach((doc) => {
    const row = doc.data() || {};
    if (!sourceIsEnrollmentOwned(row)) return;
    const patch: Record<string, unknown> = {};
    if (nameChanged) patchIfChanged(patch, row, "customer", nextName);
    if (cmChanged) {
      patchIfChanged(patch, row, "caseManagerId", nextCmId);
      patchIfChanged(patch, row, "caseManagerName", nextCmName);
    }
    if (!Object.keys(patch).length) return;
    const now = isoNow();
    patch.updatedAtISO = now;
    patch.system = {
      ...((row.system && typeof row.system === "object") ? row.system : {}),
      lastWriter: FN_CUSTOMER_UPDATE,
      lastWriteAt: now,
    };
    writer.set(doc.ref, patch, { merge: true });
    queueWrites += 1;
  });

  ledgerSnap.forEach((doc) => {
    const row = doc.data() || {};
    if (!sourceIsEnrollmentOwned(row)) return;
    const patch: Record<string, unknown> = {};
    if (nameChanged) patchIfChanged(patch, row, "customerNameAtSpend", nextName);
    if (cmChanged) patchIfChanged(patch, row, "caseManagerId", nextCmId);
    if (!Object.keys(patch).length) return;
    const now = isoNow();
    patch.updatedAt = FieldValue.serverTimestamp();
    patch.system = {
      ...((row.system && typeof row.system === "object") ? row.system : {}),
      lastWriter: FN_CUSTOMER_UPDATE,
      lastWriteAt: now,
    };
    writer.set(doc.ref, patch, { merge: true });
    ledgerWrites += 1;
  });

  spendSnap.forEach((doc) => {
    const row = doc.data() || {};
    if (!sourceIsEnrollmentOwned(row)) return;
    const patch: Record<string, unknown> = {};
    if (nameChanged) patchIfChanged(patch, row, "customerNameAtSpend", nextName);
    if (cmChanged) patchIfChanged(patch, row, "caseManagerId", nextCmId);
    if (!Object.keys(patch).length) return;
    patch.updatedAt = FieldValue.serverTimestamp();
    writer.set(doc.ref, patch, { merge: true });
    spendWrites += 1;
  });

  if (queueWrites || ledgerWrites || spendWrites) {
    await writer.close();
    console.info("[customerCascade] synced operational snapshots", {
      customerId,
      queueWrites,
      ledgerWrites,
      spendWrites,
      nameChanged,
      cmChanged,
    });
  } else {
    await writer.close();
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

    if (
      changedKeys.includes("caseManagerId") ||
      changedKeys.includes("caseManagerName") ||
      changedKeys.includes("firstName") ||
      changedKeys.includes("lastName") ||
      changedKeys.includes("fullName") ||
      changedKeys.includes("name")
    ) {
      await syncCustomerSnapshotsToOperationalRecords(String(e.params.id || ""), before, after);
    }

    // Customer became inactive → close all active enrollments + void their projections.
    if (wasActive && !isNowActive) {
      await cascadeCustomerInactiveToEnrollments(String(e.params.id || ""));
    }
  }
);

async function cascadeCustomerInactiveToEnrollments(customerId: string) {
  if (!customerId) return;

  // --- READ FIRST ---
  let snap: FirebaseFirestore.QuerySnapshot;
  try {
    snap = await db
      .collection("customerEnrollments")
      .where("customerId", "==", customerId)
      .where("active", "==", true)
      .get();
  } catch (e: any) {
    console.error(`[cascadeCustomerInactive] read failed for customer ${customerId}:`, e?.message || e);
    return;
  }

  if (snap.empty) return;

  const now = isoNow();
  const batch = db.batch();
  const enrollmentIds: Array<{ id: string; orgId: string | null; grantId: string | null; customerId: string }> = [];

  for (const doc of snap.docs) {
    const data = doc.data() as any;
    // Skip enrollments already closed/deleted
    const status = String(data?.status || "").toLowerCase();
    if (status === "closed" || status === "deleted") continue;

    batch.set(
      doc.ref,
      {
        status: "closed",
        active: false,
        closedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        system: { lastWriter: FN_CUSTOMER_UPDATE, lastWriteAt: FieldValue.serverTimestamp() },
      },
      { merge: true }
    );

    enrollmentIds.push({
      id: doc.id,
      orgId: data?.orgId ?? null,
      grantId: data?.grantId ?? null,
      customerId: data?.customerId ?? customerId,
    });
  }

  try {
    await batch.commit();
  } catch (e: any) {
    console.error(`[cascadeCustomerInactive] batch close failed for customer ${customerId}:`, e?.message || e);
    return;
  }

  // Void paymentQueue projections for each closed enrollment.
  // Errors here are non-fatal — the enrollments are already closed.
  await Promise.allSettled(
    enrollmentIds.map(({ id, orgId, grantId, customerId: cid }) =>
      syncEnrollmentProjectionQueueItems({
        orgId,
        enrollmentId: id,
        grantId,
        customerId: cid,
        payments: [],
      }).catch((e: any) =>
        console.error(`[cascadeCustomerInactive] voidProjections failed for enrollment ${id}:`, e?.message || e)
      )
    )
  );
}

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
