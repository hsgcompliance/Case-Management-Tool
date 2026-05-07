// functions/src/features/inbox/triggers.ts
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { db, RUNTIME, isoNow, normTok, toDateOnly, toMonthKey, uniqNorm, normId } from "../../core";
import type { InboxItem } from "./schemas";
import {
  changedTopLevelKeys,
  debugTriggerEvent,
  debugWrite,
  selfWriteMetadataOnly,
  topLevelMetadataOnly,
} from "../../core/triggerDebug";

const FN_ENROLLMENT_INBOX_INDEXER = "onEnrollmentInboxIndexer";
const INDEX_KEYS = new Set([
  "active",
  "caseManagerId",
  "caseManagerName",
  "clientId",
  "clientName",
  "customerName",
  "grantId",
  "grantName",
  "name",
  "orgId",
  "payments",
  "startDate",
  "status",
  "taskSchedule",
  "teamIds",
]);

const iso10 = (d: unknown) => {
  const s = toDateOnly(d as any);
  return s ? s : null;
};

const ym = (input?: string | null) => {
  const s = input ? toMonthKey(input) : "";
  return s ? s : null;
};

const cleanText = (v: unknown): string | null => {
  const s = String(v || "").trim();
  return s || null;
};

const _normGroup = (g: any) => {
  const k = normTok(g);
  if (!k) return null;

  if (k === "admin") return "admin" as const;
  if (k === "compliance") return "compliance" as const;

  if (k === "cm" || k === "casemgr" || k === "caseworker" || k === "casemanager") {
    return "casemanager" as const;
  }

  return null;
};

const UTID = {
  task: (enrollmentId: string, taskId: string) => `task|${enrollmentId}|${taskId}`,
  pay: (enrollmentId: string, paymentKey: string) => `pay|${enrollmentId}|${paymentKey}`,
  comp: (enrollmentId: string, paymentKey: string) => `comp|${enrollmentId}|${paymentKey}`,
  cmNeed: (enrollmentId: string) => `enrollment|${enrollmentId}|assignCM`,
};

async function upsertInbox(it: InboxItem) {
  const g = _normGroup((it as any).assignedToGroup);
  const ref = db.collection("userTasks").doc(it.utid);
  const write = {
    ...it,
    assignedToGroup: g,
    updatedAtISO: isoNow(),
    createdAtISO: it.createdAtISO || isoNow(),
    system: {
      lastWriter: FN_ENROLLMENT_INBOX_INDEXER,
      lastWriteAt: isoNow(),
    },
  };
  debugWrite({ fn: FN_ENROLLMENT_INBOX_INDEXER, path: ref.path, write });
  await ref.set(write, { merge: true });
}

async function deleteInbox(utid: string) {
  await db
    .collection("userTasks")
    .doc(utid)
    .delete()
    .catch(() => {});
}

/**
 * Projection trigger from customerEnrollments/{id}
 * - Direct tasks → only index if CM is assigned (assignedToUid present)
 * - Payments → default group 'compliance'
 * - Admin task when enrollment has no CM
 */
export const onEnrollmentInboxIndexer = onDocumentWritten(
  { region: RUNTIME.region, document: "customerEnrollments/{id}" },
  async (event) => {
    const before = (event.data?.before?.data() as any) || {};
    const after = (event.data?.after?.data() as any) || {};
    const changedKeys = changedTopLevelKeys(before, after);
    debugTriggerEvent({
      fn: FN_ENROLLMENT_INBOX_INDEXER,
      event,
      beforeRefPath: event.data?.before?.ref?.path || null,
      afterRefPath: event.data?.after?.ref?.path || null,
      changedKeys,
    });
    if (!event.data?.after?.exists) return;
    if (selfWriteMetadataOnly(FN_ENROLLMENT_INBOX_INDEXER, after, changedKeys)) return;
    if (topLevelMetadataOnly(changedKeys)) return;
    if (!changedKeys.some((k) => INDEX_KEYS.has(k))) return;

    const eid = String(event.params.id);

    // -------- Enrollment closure: close all open inbox items for this enrollment --------
    const enrollmentClosed =
      (after.status === "closed" || after.active === false) &&
      (before.status !== "closed" || before.active !== false);
    if (enrollmentClosed) {
      const openSnap = await db
        .collection("userTasks")
        .where("enrollmentId", "==", eid)
        .where("status", "==", "open")
        .get();
      if (!openSnap.empty) {
        const closeBatch = db.batch();
        openSnap.forEach((doc) =>
          closeBatch.set(
            doc.ref,
            { status: "done", completedAtISO: isoNow(), updatedAtISO: isoNow() },
            { merge: true }
          )
        );
        await closeBatch.commit();
      }
      // Return after closure — do not continue to upsert/delete individual items,
      // which could re-open tasks that were just closed.
      return;
    }

    const clientId = after.clientId || after.customerId || before.clientId || before.customerId || null;
    const grantId = after.grantId || before.grantId || null;
    const cmUid = after.caseManagerId || before.caseManagerId || null;
    let customerName = cleanText(after.customerName) || cleanText(after.clientName) || null;
    if (!customerName && clientId) {
      const customerSnap = await db.collection("customers").doc(String(clientId)).get().catch(() => null);
      const customerDoc = customerSnap?.exists ? (customerSnap.data() || {}) : {};
      customerName =
        cleanText((customerDoc as any).name) ||
        [cleanText((customerDoc as any).firstName), cleanText((customerDoc as any).lastName)]
          .filter(Boolean)
          .join(" ")
          .trim() ||
        null;
    }
    const grantName = cleanText(after.grantName) || null;
    const caseManagerName = cleanText(after.caseManagerName) || null;
    // Build a human-readable enrollment name. Fall back to "Grant · start date" when the
    // enrollment document has no explicit name field.
    const rawStartDate = iso10(after.startDate) || null;
    const enrollmentName =
      cleanText(after.name) ||
      (grantName && rawStartDate ? `${grantName} · ${rawStartDate}` : null) ||
      cleanText(grantName) ||
      null;

    const orgId = String(after.orgId || before.orgId || "") || null;
    const teamIds = uniqNorm(
      [
        ...(Array.isArray(after.teamIds) ? after.teamIds : Array.isArray(before.teamIds) ? before.teamIds : []),
        orgId,
      ],
      normId
    );

    // -------- Admin task: Enrollment with no CM --------
    const hasCM = !!(after.caseManagerId || null);
    if (!hasCM && after.active !== false && after.status !== "closed") {
      const due = iso10(after.startDate) || iso10(new Date());
      await upsertInbox({
        utid: UTID.cmNeed(eid),
        source: "adminEnrollment",
        status: "open",
        enrollmentId: eid,
        clientId,
        grantId,
        sourcePath: `customerEnrollments/${eid}#caseManagerId`,
        dueDate: due,
        dueMonth: ym(due),
        createdAtISO: isoNow(),
        assignedToUid: null,
        assignedToGroup: "admin",
        cmUid,
        orgId,
        teamIds,
        notify: false,
        title: "Assign Case Manager",
        subtitle: customerName || (clientId ? `Customer ${clientId}` : null),
        labels: ["admin", "routing"],
        completedAtISO: null,
        customerName,
        grantName,
        caseManagerName,
        enrollmentName,
      });
    } else {
      await deleteInbox(UTID.cmNeed(eid));
    }

    // Keep existing inbox rows aligned to current CM when CM changes
    if ((before.caseManagerId || null) !== (after.caseManagerId || null)) {
      const qs = await db.collection("userTasks").where("enrollmentId", "==", eid).get();
      const batch = db.batch();
      qs.forEach((doc) => batch.set(doc.ref, { cmUid, orgId, teamIds }, { merge: true }));
      await batch.commit();
    }

    // -------- Deprecated taskSchedule projection --------
    // Keep this compatibility path so existing embedded taskSchedule notes still
    // surface in digest emails and customer/workload flags. The old completion
    // lifecycle should not be extended; new reminder/notification work should
    // write lightweight note/reminder rows instead of relying on status changes.
    const prevTasks: any[] = Array.isArray(before.taskSchedule) ? before.taskSchedule : [];
    const nextTasks: any[] = Array.isArray(after.taskSchedule) ? after.taskSchedule : [];

    const prevById = new Map(prevTasks.map((t) => [String(t?.id), t]));
    const nextById = new Map(nextTasks.map((t) => [String(t?.id), t]));

    for (const [id] of prevById) if (!nextById.has(id)) await deleteInbox(UTID.task(eid, id));

    for (const [id, t] of nextById) {
      const assignedToUid = t?.assignedToUid || null;
      const assignedToGroup =
        _normGroup(t?.assignedToGroup) ||
        (assignedToUid ? ("casemanager" as const) : null);
      // Skip only if task is truly unassigned. Also clean up any prior inbox row.
      if (!assignedToUid && !assignedToGroup) {
        await deleteInbox(UTID.task(eid, id));
        continue;
      }

      const due = iso10(t?.dueDate);
      const multiMode = t?.multiMode || null;
      const multiParentId = t?.multiParentId || null;
      const multiStepIndexNum = Number.isFinite(Number(t?.multiStepIndex)) ? Number(t.multiStepIndex) : null;
      // Find the nearest (highest-indexed) incomplete step before the current one.
      // Using filter+sort rather than find() avoids returning a stale step when
      // earlier steps are already done but a middle step is still open.
      const prevBlockingStep =
        multiParentId && multiMode === "sequential" && multiStepIndexNum != null && multiStepIndexNum > 1
          ? (nextTasks
              .filter(
                (s: any) =>
                  s &&
                  String(s?.multiParentId || "") === String(multiParentId) &&
                  Number(s?.multiStepIndex || 0) < multiStepIndexNum &&
                  !s?.completed,
              )
              .sort(
                (a: any, b: any) =>
                  Number(b?.multiStepIndex || 0) - Number(a?.multiStepIndex || 0),
              )[0] || null)
          : null;
      const item: InboxItem = {
        utid: UTID.task(eid, id),
        source: "task",
        status: t?.completed ? "done" : "open",
        enrollmentId: eid,
        clientId,
        grantId,
        sourcePath: `customerEnrollments/${eid}#taskSchedule:${id}`,
        dueDate: due,
        dueMonth: ym(due),
        createdAtISO: t?.createdAt || null,
        assignedToUid,
        assignedToGroup,
        cmUid,
        orgId,
        teamIds,
        notify: typeof t?.notify === "boolean" ? !!t.notify : true,
        title: `${String(t?.type || "Task")} • ${customerName || clientId || "Customer"}`,
        subtitle: [caseManagerName || cmUid ? `CM: ${caseManagerName || cmUid}` : null, grantName || grantId ? `Grant: ${grantName || grantId}` : null]
          .filter(Boolean)
          .join(" | ") || null,
        note: t?.notes || null,
        labels: uniqNorm([
          ...(Array.isArray(t?.labels) ? t.labels : []),
          ...(t?.managed ? ["managed"] : []),
          t?.bucket || null,
        ]),
        completedAtISO: t?.completedAt || null,
        // passthrough task metadata (Inbox schema allows extras); used by detail cards
        taskId: id,
        bucket: t?.bucket || null,
        managed: t?.managed === true,
        defId: t?.defId || null,
        notes: t?.notes || null,
        verified: t?.verified === true,
        verifiedAt: t?.verifiedAt || null,
        verifiedBy: t?.verifiedBy || null,
        rawTaskStatus: t?.status || null,
        multiParentId,
        multiStepIndex: multiStepIndexNum,
        multiStepCount: Number.isFinite(Number(t?.multiStepCount)) ? Number(t.multiStepCount) : null,
        multiMode,
        workflowBlocked: !!prevBlockingStep,
        waitingOnTaskId: prevBlockingStep ? String(prevBlockingStep.id || "") : null,
        waitingOnGroup: prevBlockingStep ? _normGroup(prevBlockingStep.assignedToGroup) : null,
        waitingOnUid: prevBlockingStep ? String(prevBlockingStep.assignedToUid || "") || null : null,
        customerName,
        grantName,
        caseManagerName,
        enrollmentName,
        taskType: t?.type || "Task",
        taskDescription: cleanText(t?.description) || cleanText(t?.notes) || null,
      };
      await upsertInbox(item);
    }

    // -------- PAYMENTS (actions & compliance) --------
    const prevPays: any[] = Array.isArray(before.payments) ? before.payments : [];
    const nextPays: any[] = Array.isArray(after.payments) ? after.payments : [];

    const keyOf = (p: any) =>
      String(
        p?.id ||
          `${p?.type || "monthly"}|${iso10(p?.dueDate) || ""}|${p?.lineItemId || ""}|${Math.round(
            Number(p?.amount || 0) * 100
          )}`
      );

    const prevP = new Map(prevPays.map((p) => [keyOf(p), p]));
    const nextP = new Map(nextPays.map((p) => [keyOf(p), p]));

    for (const [k, p] of prevP) {
      if (!nextP.has(k)) {
        const pid = String(p?.id || k);
        await deleteInbox(UTID.pay(eid, pid));
        await deleteInbox(UTID.comp(eid, pid));
      }
    }

    for (const [k, p] of nextP) {
      const pid = String(p?.id || k);
      const type = String(p?.type || "monthly").toLowerCase();
      const due = iso10(p?.dueDate);
      const dueMonth = ym(due);
      const paymentAmount = Number.isFinite(Number(p?.amount)) ? Number(p.amount) : null;
      const paymentLineItemId = cleanText(p?.lineItemId);
      const paymentLineItemLabel =
        cleanText(p?.lineItemLabel) ||
        cleanText(p?.lineItemName) ||
        cleanText(p?.lineItemTitle) ||
        paymentLineItemId;

      await upsertInbox({
        utid: UTID.pay(eid, pid),
        source: "payment",
        status: p?.paid ? "done" : "open",
        enrollmentId: eid,
        clientId,
        grantId,
        sourcePath: `customerEnrollments/${eid}#payments:${pid}`,
        dueDate: due,
        dueMonth,
        createdAtISO: null,
        assignedToUid: null,
        assignedToGroup: "compliance",
        cmUid,
        orgId,
        teamIds,
        notify: typeof p?.notify === "boolean" ? !!p.notify : true,
        title: `${type === "deposit" ? "Deposit Payment" : type === "prorated" ? "Prorated Payment" : type === "service" ? "Service Payment" : "Monthly Payment"} • ${customerName || clientId || "Customer"}`,
        subtitle: [grantName || grantId ? `Grant: ${grantName || grantId}` : null, paymentLineItemLabel ? `Line Item: ${paymentLineItemLabel}` : null]
          .filter(Boolean)
          .join(" | ") || null,
        labels: [type],
        completedAtISO: p?.paidAt || null,
        customerName,
        grantName,
        caseManagerName,
        enrollmentName,
        paymentId: pid,
        paymentType: type,
        paymentAmount,
        paymentLineItemId,
        paymentLineItemLabel,
      });

      const comp = p?.compliance || null;
      const approved = !!comp && String(comp.status || "").toLowerCase() === "approved";
      if (comp && !approved) {
        await upsertInbox({
          utid: UTID.comp(eid, pid),
          source: "paymentCompliance",
          status: "open",
          enrollmentId: eid,
          clientId,
          grantId,
          sourcePath: `customerEnrollments/${eid}#payments:${pid}#compliance`,
          dueDate: due,
          dueMonth,
          createdAtISO: null,
          assignedToUid: null,
          assignedToGroup: "compliance",
          cmUid,
          orgId,
          teamIds,
          notify: false,
          title: `Payment Compliance • ${customerName || clientId || "Customer"}`,
          subtitle: [grantName || grantId ? `Grant: ${grantName || grantId}` : null, paymentLineItemLabel ? `Line Item: ${paymentLineItemLabel}` : null]
            .filter(Boolean)
            .join(" | ") || null,
          labels: ["compliance", type],
          completedAtISO: null,
          customerName,
          grantName,
          caseManagerName,
          enrollmentName,
          paymentId: pid,
          paymentType: type,
          paymentAmount,
          paymentLineItemId,
          paymentLineItemLabel,
          paymentComplianceStatus: cleanText(comp?.status) || "pending",
          hmisComplete: comp?.hmisComplete === true,
          caseworthyComplete: comp?.caseworthyComplete === true,
        });
      } else if (approved) {
        // Close with audit trail instead of hard-delete so history is preserved
        // and the operation is idempotent on repeated trigger fires.
        await upsertInbox({
          utid: UTID.comp(eid, pid),
          source: "paymentCompliance",
          status: "done",
          enrollmentId: eid,
          clientId,
          grantId,
          sourcePath: `customerEnrollments/${eid}#payments:${pid}#compliance`,
          dueDate: due,
          dueMonth,
          createdAtISO: null,
          assignedToUid: null,
          assignedToGroup: "compliance",
          cmUid,
          orgId,
          teamIds,
          notify: false,
          title: `Payment Compliance • ${customerName || clientId || "Customer"}`,
          subtitle: [grantName || grantId ? `Grant: ${grantName || grantId}` : null, paymentLineItemLabel ? `Line Item: ${paymentLineItemLabel}` : null]
            .filter(Boolean)
            .join(" | ") || null,
          labels: ["compliance", type],
          completedAtISO: isoNow(),
          customerName,
          grantName,
          caseManagerName,
          enrollmentName,
          paymentId: pid,
          paymentType: type,
          paymentAmount,
          paymentLineItemId,
          paymentLineItemLabel,
          paymentComplianceStatus: "approved",
          hmisComplete: comp?.hmisComplete === true,
          caseworthyComplete: comp?.caseworthyComplete === true,
        });
      } else {
        // No compliance object at all → clean up any stale inbox row
        await deleteInbox(UTID.comp(eid, pid));
      }
    }
  }
);
