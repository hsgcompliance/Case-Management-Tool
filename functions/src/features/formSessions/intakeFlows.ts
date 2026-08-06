import { z } from "zod";
import { secureHandler, db, FieldValue, isoNow, normId, orgIdFromClaims, requireOrg, isAdmin, roleTagsFromClaims } from "../../core";
import { FORM_WORKFLOW_TASK_RULES, intakeActionUrl } from "./workflowTaskRules";

/** One hop in a flow's hand-off history (who passed it on / was claimed from). */
type TransferHop = { uid: string; name: string | null; atISO: string; claimed?: boolean };

/** Compliance tag or admin+ may see and claim other staff's unfinished intakes. */
function canSeeOrgFlows(caller: Record<string, unknown>): boolean {
  return isAdmin(caller) || roleTagsFromClaims(caller).includes("compliance");
}

const Progress = z.object({
  done: z.record(z.string(), z.boolean()).default({}),
  checks: z.record(z.string(), z.array(z.number().int().nonnegative()).max(100)).default({}),
  tssVariant: z.enum(["payer", "nonpayer"]).optional(),
  intakeTypes: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
}).strip();

const Session = z.object({
  customerId: z.string().trim().min(1).max(200),
  customerName: z.string().trim().max(200).nullish(),
  cwId: z.string().trim().max(80).nullish(),
  dob: z.string().trim().max(40).nullish(),
  caseManagerName: z.string().trim().max(200).nullish(),
  intakeType: z.string().trim().max(80).nullish(),
  intakeTypes: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
  doneCount: z.number().int().nonnegative(),
  totalSteps: z.number().int().positive().max(100),
  startedAtISO: z.string().trim().max(50).optional(),
  updatedAtISO: z.string().trim().max(50).optional(),
}).strip();

const SaveBody = z.object({ session: Session, progress: Progress });
const TransferBody = SaveBody.extend({ targetUid: z.string().trim().min(1).max(200) });
const DeleteBody = z.object({ customerId: z.string().trim().min(1).max(200) });
const EligibilityConfirmBody = z.object({
  customerId: z.string().trim().min(1).max(200),
  submissionId: z.string().trim().min(1).max(100),
});

function orgFor(caller: Record<string, unknown>): string {
  return normId(orgIdFromClaims(caller) || requireOrg(caller));
}

function flowId(uid: string, customerId: string): string {
  return `${uid}__${customerId}`.replace(/\//g, "_");
}

async function assertCustomerInOrg(customerId: string, orgId: string) {
  const snap = await db.collection("customers").doc(customerId).get();
  if (!snap.exists || normId((snap.data() || {}).orgId) !== orgId) {
    const err = new Error("customer_not_found") as Error & { code?: number };
    err.code = 404;
    throw err;
  }
}

async function assertActiveUserInOrg(targetUid: string, orgId: string) {
  const { listUsersService } = await import("../users/service.js");
  const { users } = await listUsersService({ limit: 1000, status: "active" }, { orgId });
  if (!users.some((user) => user.uid === targetUid)) {
    const err = new Error("target_user_not_found") as Error & { code?: number };
    err.code = 404;
    throw err;
  }
}

function savedDoc(args: { orgId: string; ownerUid: string; session: z.infer<typeof Session>; progress: z.infer<typeof Progress>; transferredByUid?: string | null; transferredByName?: string | null }) {
  const now = isoNow();
  // A plain save intentionally clears the "sent by" marker (once the recipient
  // works the intake it's theirs); the durable custody record is transferChain,
  // which saves never write, so merge:true always preserves it.
  return {
    orgId: args.orgId,
    ownerUid: args.ownerUid,
    customerId: args.session.customerId,
    session: { ...args.session, updatedAtISO: now },
    progress: args.progress,
    transferredByUid: args.transferredByUid || null,
    transferredByName: args.transferredByName || null,
    updatedAt: FieldValue.serverTimestamp(),
    updatedAtISO: now,
  };
}

/**
 * Best-effort task hygiene, run on every flow save/transfer:
 *  - the referral-submit reminder ("Complete intake from referral — …") closes
 *    as soon as a real intake flow exists for its owner;
 *  - when the intake completes, every open intake-stage userTask for the
 *    customer (eligibility review, handoff follow-ups) closes with it.
 */
async function closeSupersededTasks(args: { orgId: string; ownerUid: string; customerId: string; complete: boolean }) {
  const now = isoNow();
  try {
    const reminders = await db.collection("otherTasks")
      .where("assignedToUids", "array-contains", args.ownerUid)
      .where("status", "==", "open")
      .limit(50)
      .get();
    const toClose = reminders.docs.filter((doc) => {
      const data = doc.data() || {};
      if (normId(data.orgId) !== args.orgId) return false;
      if (!String(data.title || "").startsWith("Complete intake from referral")) return false;
      const taskCustomerId = String(data.customerId || "");
      return !taskCustomerId || taskCustomerId === args.customerId;
    });
    await Promise.all(toClose.map((doc) => doc.ref.set({
      status: "done", completed: true, completedAt: now,
      updatedAt: FieldValue.serverTimestamp(), updatedAtISO: now, updatedBy: "formsIntakeFlowSave",
    }, { merge: true })));

    if (args.complete) {
      const open = await db.collection("userTasks")
        .where("clientId", "==", args.customerId)
        .where("workItemKind", "==", "intake")
        .where("status", "==", "open")
        .limit(50)
        .get();
      await Promise.all(open.docs
        .filter((doc) => normId((doc.data() || {}).orgId) === args.orgId)
        .map((doc) => doc.ref.set({
          status: "done", completedAtISO: now, updatedAtISO: now,
          system: { lastWriter: "formsIntakeComplete", lastWriteAt: now },
        }, { merge: true })));
    }
  } catch {
    // Task cleanup must never fail the save/transfer itself.
  }
}

function intakeTaskId(customerId: string): string {
  return `forms-intake|${customerId}`.replace(/\//g, "_");
}

async function upsertIntakeTask(args: {
  orgId: string;
  ownerUid: string;
  session: z.infer<typeof Session>;
  transferredByName?: string | null;
}) {
  const rule = FORM_WORKFLOW_TASK_RULES.intakeIncomplete;
  if (!rule.enabled) return;
  const complete = args.session.doneCount >= args.session.totalSteps;
  const now = isoNow();
  const ref = db.collection("userTasks").doc(intakeTaskId(args.session.customerId));
  const existing = await ref.get();
  await ref.set({
    utid: intakeTaskId(args.session.customerId),
    source: "formsIntake",
    sourcePath: `formsIntakeFlows/${flowId(args.ownerUid, args.session.customerId)}`,
    sourceId: args.session.customerId,
    orgId: args.orgId,
    teamIds: [args.orgId],
    clientId: args.session.customerId,
    customerName: args.session.customerName || null,
    assignedToUid: args.ownerUid,
    assignedToGroup: "casemanager",
    status: complete ? "done" : "open",
    completedAtISO: complete ? now : null,
    dueDate: null,
    dueMonth: null,
    notify: true,
    workItemKind: "intake",
    workflowRef: {
      type: "intake",
      instanceId: args.session.customerId,
      stage: complete ? "intake_complete" : "intake_in_progress",
      customerId: args.session.customerId,
      enrollmentId: null,
      formId: null,
    },
    title: rule.title,
    note: (complete
      ? "The Forms intake workflow is complete."
      : `${args.session.doneCount} of ${args.session.totalSteps} intake steps complete.`)
      + (args.transferredByName ? ` Sent to you by ${args.transferredByName}.` : ""),
    labels: ["forms", "intake", "workflow"],
    actionUrl: intakeActionUrl(args.session.customerId),
    actionLabel: complete ? "Review intake workflow" : "Continue intake workflow",
    ...(existing.exists ? {} : { createdAtISO: now }),
    updatedAtISO: now,
    system: { lastWriter: "formsIntakeFlowSave", lastWriteAt: now },
  }, { merge: true });
}

export const formsIntakeFlowsList_http = secureHandler(async (req, res) => {
  const caller = req.user! as Record<string, unknown>;
  const uid = String(caller.uid || "");
  const orgId = orgFor(caller);
  // scope=org (compliance/admin only): every unfinished intake in the org, so
  // compliance can pick up ("claim") stalled referral→intake flows. Explicit
  // 403 (not silent fallback) so the frontend can hide the claim section.
  const orgScope = String((req.query || {}).scope || "") === "org";
  if (orgScope && !canSeeOrgFlows(caller)) {
    res.status(403).json({ ok: false, error: "compliance_or_admin_only" });
    return;
  }
  const snap = orgScope
    ? await db.collection("formsIntakeFlows").where("orgId", "==", orgId).limit(200).get()
    : await db.collection("formsIntakeFlows").where("ownerUid", "==", uid).limit(200).get();
  const items = snap.docs
    .map((doc): Record<string, unknown> => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter((item) => normId(item.orgId) === orgId)
    .sort((a, b) => String(b.updatedAtISO || "").localeCompare(String(a.updatedAtISO || "")));
  res.status(200).json({ ok: true, items });
}, { auth: "user", methods: ["GET", "OPTIONS"] });

/**
 * POST /formsIntakeFlowClaim — compliance/admin takes ownership of another
 * staff member's saved intake flow (the reverse of a transfer: initiated by
 * the recipient). The hop is appended to transferChain with claimed: true.
 */
export const formsIntakeFlowClaim_http = secureHandler(async (req, res) => {
  const body = z.object({
    customerId: z.string().trim().min(1).max(200),
    ownerUid: z.string().trim().min(1).max(200),
  }).parse(req.body || {});
  const caller = req.user! as Record<string, unknown>;
  const uid = String(caller.uid || "");
  const orgId = orgFor(caller);
  if (!canSeeOrgFlows(caller)) {
    res.status(403).json({ ok: false, error: "compliance_or_admin_only" });
    return;
  }
  if (body.ownerUid === uid) {
    res.status(400).json({ ok: false, error: "already_assigned_to_user" });
    return;
  }
  const { listUsersService } = await import("../users/service.js");
  const { users } = await listUsersService({ limit: 1000, status: "active" }, { orgId });
  const prevOwner = users.find((user) => user.uid === body.ownerUid);
  const source = db.collection("formsIntakeFlows").doc(flowId(body.ownerUid, body.customerId));
  const target = db.collection("formsIntakeFlows").doc(flowId(uid, body.customerId));
  const session = await db.runTransaction(async (tx) => {
    const sourceSnap = await tx.get(source);
    const flow = sourceSnap.data();
    if (!sourceSnap.exists || !flow || normId(flow.orgId) !== orgId) {
      const err = new Error("intake_flow_not_found") as Error & { code?: number };
      err.code = 404;
      throw err;
    }
    const priorChain = (flow.transferChain || []) as TransferHop[];
    const hop: TransferHop = {
      uid: body.ownerUid,
      name: String(prevOwner?.displayName || prevOwner?.email || "") || null,
      atISO: isoNow(),
      claimed: true,
    };
    tx.set(target, {
      ...flow,
      ownerUid: uid,
      transferredByUid: body.ownerUid,
      transferredByName: hop.name,
      transferChain: [...priorChain, hop].slice(-20),
      updatedAt: FieldValue.serverTimestamp(),
      updatedAtISO: isoNow(),
    }, { merge: true });
    tx.delete(source);
    return flow.session as z.infer<typeof Session>;
  });
  await upsertIntakeTask({ orgId, ownerUid: uid, session, transferredByName: null });
  res.status(200).json({ ok: true, id: target.id });
}, { auth: "user", methods: ["POST", "OPTIONS"] });

export const formsIntakeFlowSave_http = secureHandler(async (req, res) => {
  const body = SaveBody.parse(req.body || {});
  const caller = req.user! as Record<string, unknown>;
  const uid = String(caller.uid || "");
  const orgId = orgFor(caller);
  await assertCustomerInOrg(body.session.customerId, orgId);
  const ref = db.collection("formsIntakeFlows").doc(flowId(uid, body.session.customerId));
  await Promise.all([
    ref.set({ ...savedDoc({ orgId, ownerUid: uid, session: body.session, progress: body.progress }), createdAt: FieldValue.serverTimestamp() }, { merge: true }),
    upsertIntakeTask({ orgId, ownerUid: uid, session: body.session }),
    closeSupersededTasks({ orgId, ownerUid: uid, customerId: body.session.customerId, complete: body.session.doneCount >= body.session.totalSteps }),
  ]);
  res.status(200).json({ ok: true, id: ref.id });
}, { auth: "user", methods: ["POST", "OPTIONS"] });

export const formsIntakeFlowTransfer_http = secureHandler(async (req, res) => {
  const body = TransferBody.parse(req.body || {});
  const caller = req.user! as Record<string, unknown>;
  const uid = String(caller.uid || "");
  const orgId = orgFor(caller);
  if (body.targetUid === uid) {
    res.status(400).json({ ok: false, error: "already_assigned_to_user" });
    return;
  }
  await Promise.all([
    assertCustomerInOrg(body.session.customerId, orgId),
    assertActiveUserInOrg(body.targetUid, orgId),
  ]);
  const transferredByName = String(caller.name || caller.email || "") || null;
  const source = db.collection("formsIntakeFlows").doc(flowId(uid, body.session.customerId));
  const target = db.collection("formsIntakeFlows").doc(flowId(body.targetUid, body.session.customerId));
  await db.runTransaction(async (tx) => {
    const [sourceSnap, targetSnap] = await Promise.all([tx.get(source), tx.get(target)]);
    const priorChain = ((sourceSnap.data() || targetSnap.data() || {}).transferChain || []) as TransferHop[];
    const transferChain: TransferHop[] = [...priorChain, { uid, name: transferredByName, atISO: isoNow() }].slice(-20);
    tx.set(target, {
      ...savedDoc({ orgId, ownerUid: body.targetUid, session: body.session, progress: body.progress, transferredByUid: uid, transferredByName }),
      transferChain,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.delete(source);
  });
  await Promise.all([
    upsertIntakeTask({ orgId, ownerUid: body.targetUid, session: body.session, transferredByName }),
    closeSupersededTasks({ orgId, ownerUid: uid, customerId: body.session.customerId, complete: false }),
  ]);
  res.status(200).json({ ok: true, id: target.id });
}, { auth: "user", methods: ["POST", "OPTIONS"] });

export const formsIntakeFlowDelete_http = secureHandler(async (req, res) => {
  const body = DeleteBody.parse(req.body || {});
  const caller = req.user! as Record<string, unknown>;
  const uid = String(caller.uid || "");
  const orgId = orgFor(caller);
  const flowRef = db.collection("formsIntakeFlows").doc(flowId(uid, body.customerId));
  const taskRef = db.collection("userTasks").doc(intakeTaskId(body.customerId));

  const deleted = await db.runTransaction(async (tx) => {
    const [flowSnap, taskSnap] = await Promise.all([tx.get(flowRef), tx.get(taskRef)]);
    if (!flowSnap.exists) return false;
    const flow = flowSnap.data() || {};
    if (normId(flow.orgId) !== orgId || String(flow.ownerUid || "") !== uid) {
      const err = new Error("intake_flow_not_found") as Error & { code?: number };
      err.code = 404;
      throw err;
    }
    tx.delete(flowRef);
    const task = taskSnap.data() || {};
    if (
      taskSnap.exists &&
      normId(task.orgId) === orgId &&
      String(task.source || "") === "formsIntake" &&
      String(task.assignedToUid || "") === uid
    ) {
      tx.delete(taskRef);
    }
    return true;
  });

  res.status(200).json({ ok: true, deleted });
}, { auth: "user", methods: ["POST", "OPTIONS"] });

/**
 * Manual backstop for the step-13 (Eligibility Determination) compliance
 * hand-off: the CM clicks "Continue intake / Send to compliance" after
 * submitting, which force-writes the same userTasks doc the async webhook
 * sync would eventually produce (same doc id, so whichever writes first is
 * harmless — the other just re-confirms the same task).
 */
export const intakeEligibilityConfirm_http = secureHandler(async (req, res) => {
  const body = EligibilityConfirmBody.parse(req.body || {});
  const caller = req.user! as Record<string, unknown>;
  const orgId = orgFor(caller);
  await assertCustomerInOrg(body.customerId, orgId);

  const customerSnap = await db.collection("customers").doc(body.customerId).get();
  const customerData = (customerSnap.data() || {}) as Record<string, unknown>;
  const customerName = String(customerData.name || "") || null;
  const cmUid = String(customerData.caseManagerId || "") || null;
  const secondaryCmUid = String(customerData.secondaryCaseManagerId || "") || null;

  const rule = FORM_WORKFLOW_TASK_RULES.eligibilityReview;
  const utid = `jotform|${body.submissionId}`;
  const ref = db.collection("userTasks").doc(utid);
  const existing = await ref.get();
  const isNew = !existing.exists;
  const now = isoNow();

  await ref.set({
    utid,
    source: "jotform",
    ...(isNew ? { status: "open" } : {}),
    orgId,
    teamIds: [orgId],
    enrollmentId: null,
    clientId: body.customerId,
    grantId: null,
    sourcePath: `jotformSubmissions/${body.submissionId}`,
    sourceId: body.submissionId,
    dueDate: null,
    dueMonth: null,
    assignedToUid: null,
    assignedToGroup: "compliance",
    cmUid,
    secondaryCmUid,
    notify: true,
    workItemKind: "intake",
    workflowRef: {
      type: "intake",
      instanceId: body.customerId,
      stage: "eligibility_follow_up",
      customerId: body.customerId,
      enrollmentId: null,
      formId: rule.formId,
    },
    title: `${rule.title} - ${customerName || body.customerId}`,
    subtitle: null,
    labels: ["jotform", "intake-step-13", "compliance-handoff"],
    ...(isNew ? { completedAtISO: null, createdAtISO: now } : {}),
    customerName,
    updatedAtISO: now,
    system: { lastWriter: "intakeEligibilityConfirm", lastWriteAt: now },
  }, { merge: true });

  res.status(200).json({ ok: true, id: ref.id });
}, { auth: "user", methods: ["POST", "OPTIONS"] });
