// functions/src/features/inbox/triggers.ts
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { db, RUNTIME, isoNow, normTok, toDateOnly, toMonthKey, uniqNorm, normId } from "../../core";
import type { InboxItem } from "./schemas";
import { resolveCustomerCmFields } from "./customerLookup";
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

function resolvePaymentSubtype(note: unknown): "rent" | "utility" {
  const tags = Array.isArray(note)
    ? (note as unknown[]).map((t) => String(t ?? "").toLowerCase())
    : note != null
    ? [String(note).toLowerCase()]
    : [];
  return tags.some(
    (t) => t === "utility" || t === "sub:utility" || t.startsWith("utility:") || t.startsWith("sub:utility"),
  )
    ? "utility"
    : "rent";
}

function resolvePaymentType(type: string, note: unknown): string {
  if (type === "deposit") return "deposit";
  if (type === "prorated") return "prorated";
  if (type === "service") return "service";
  return resolvePaymentSubtype(note);
}

function paymentTypeTitleLabel(type: string, note: unknown): string {
  const resolved = resolvePaymentType(type, note);
  if (resolved === "rent")     return "Rent Assistance";
  if (resolved === "utility")  return "Utility Assistance";
  if (resolved === "deposit")  return "Deposit Assistance";
  if (resolved === "prorated") return "Prorated Rent Assistance";
  if (resolved === "service")  return "Support Service";
  return "Payment";
}

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
    // Always resolve the customer doc when we have a clientId — needed for
    // secondaryCmUid (customer-level field, not present on the enrollment)
    // even when the enrollment already carries a usable customerName.
    const customerFields = clientId ? await resolveCustomerCmFields(String(clientId)) : null;
    const secondaryCmUid = customerFields?.secondaryCmUid || null;
    const customerName =
      cleanText(after.customerName) || cleanText(after.clientName) || customerFields?.customerName || null;
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
        secondaryCmUid,
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
      qs.forEach((doc) => batch.set(doc.ref, { cmUid, secondaryCmUid, orgId, teamIds }, { merge: true }));
      await batch.commit();
    }

    // -------- taskSchedule (rent-cert reminders) --------
    // onEnrollmentBuildTasks (generic grant-defined tasks) is disabled, so the only
    // current producer of taskSchedule entries is the rent-cert cadence
    // (syncContinuumRentCertReminders) plus manual overrides — safe to project all
    // of them into userTasks so they surface in the task-due notifications.
    const prevTasks: any[] = Array.isArray(before.taskSchedule) ? before.taskSchedule : [];
    const nextTasks: any[] = Array.isArray(after.taskSchedule) ? after.taskSchedule : [];

    const prevById = new Map(prevTasks.map((t) => [String(t?.id), t]));
    const nextById = new Map(nextTasks.map((t) => [String(t?.id), t]));

    for (const [id] of prevById) if (!nextById.has(id)) await deleteInbox(UTID.task(eid, id));

    for (const t of nextTasks) {
      const taskId = String(t?.id || "");
      if (!taskId) continue;
      const due = iso10(t?.dueDate) || (t?.dueDate ? String(t.dueDate) : null);
      const dueMonth = t?.dueMonth ? String(t.dueMonth) : ym(due);
      await upsertInbox({
        utid: UTID.task(eid, taskId),
        source: "task",
        status: t?.completed === true ? "done" : "open",
        enrollmentId: eid,
        clientId,
        grantId,
        sourcePath: `customerEnrollments/${eid}#taskSchedule:${taskId}`,
        dueDate: due,
        dueMonth,
        createdAtISO: null,
        assignedToUid: t?.assignedToUid || null,
        assignedToGroup: t?.assignedToGroup || null,
        cmUid,
        secondaryCmUid,
        orgId,
        teamIds,
        notify: t?.notify !== false,
        title: cleanText(t?.title) || cleanText(t?.type) || "Task",
        subtitle: cleanText(t?.notes) || (customerName || (clientId ? `Customer ${clientId}` : null)),
        labels: ["rentCert"],
        completedAtISO: t?.completedAt || null,
        customerName,
        grantName,
        caseManagerName,
        enrollmentName,
      });
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
      const resolvedType = resolvePaymentType(type, p?.note);
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
        secondaryCmUid,
        orgId,
        teamIds,
        notify: typeof p?.notify === "boolean" ? !!p.notify : true,
        title: `${paymentTypeTitleLabel(type, p?.note)} • ${customerName || clientId || "Customer"}`,
        subtitle: [grantName || grantId ? `Grant: ${grantName || grantId}` : null, paymentLineItemLabel ? `Line Item: ${paymentLineItemLabel}` : null]
          .filter(Boolean)
          .join(" | ") || null,
        labels: [resolvedType],
        completedAtISO: p?.paidAt || null,
        customerName,
        grantName,
        caseManagerName,
        enrollmentName,
        paymentId: pid,
        paymentType: resolvedType,
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
          secondaryCmUid,
          orgId,
          teamIds,
          notify: false,
          title: `Payment Compliance • ${customerName || clientId || "Customer"}`,
          subtitle: [grantName || grantId ? `Grant: ${grantName || grantId}` : null, paymentLineItemLabel ? `Line Item: ${paymentLineItemLabel}` : null]
            .filter(Boolean)
            .join(" | ") || null,
          labels: ["compliance", resolvedType],
          completedAtISO: null,
          customerName,
          grantName,
          caseManagerName,
          enrollmentName,
          paymentId: pid,
          paymentType: resolvedType,
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
          secondaryCmUid,
          orgId,
          teamIds,
          notify: false,
          title: `Payment Compliance • ${customerName || clientId || "Customer"}`,
          subtitle: [grantName || grantId ? `Grant: ${grantName || grantId}` : null, paymentLineItemLabel ? `Line Item: ${paymentLineItemLabel}` : null]
            .filter(Boolean)
            .join(" | ") || null,
          labels: ["compliance", resolvedType],
          completedAtISO: isoNow(),
          customerName,
          grantName,
          caseManagerName,
          enrollmentName,
          paymentId: pid,
          paymentType: resolvedType,
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
