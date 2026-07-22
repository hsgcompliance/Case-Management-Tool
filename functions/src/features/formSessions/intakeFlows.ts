import { z } from "zod";
import { secureHandler, db, FieldValue, isoNow, normId, orgIdFromClaims, requireOrg } from "../../core";
import { FORM_WORKFLOW_TASK_RULES, intakeActionUrl } from "./workflowTaskRules";

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

function savedDoc(args: { orgId: string; ownerUid: string; session: z.infer<typeof Session>; progress: z.infer<typeof Progress>; transferredByUid?: string | null }) {
  const now = isoNow();
  return {
    orgId: args.orgId,
    ownerUid: args.ownerUid,
    customerId: args.session.customerId,
    session: { ...args.session, updatedAtISO: now },
    progress: args.progress,
    transferredByUid: args.transferredByUid || null,
    updatedAt: FieldValue.serverTimestamp(),
    updatedAtISO: now,
  };
}

function intakeTaskId(customerId: string): string {
  return `forms-intake|${customerId}`.replace(/\//g, "_");
}

async function upsertIntakeTask(args: {
  orgId: string;
  ownerUid: string;
  session: z.infer<typeof Session>;
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
    note: complete
      ? "The Forms intake workflow is complete."
      : `${args.session.doneCount} of ${args.session.totalSteps} intake steps complete.`,
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
  const snap = await db.collection("formsIntakeFlows").where("ownerUid", "==", uid).limit(200).get();
  const items = snap.docs
    .map((doc): Record<string, unknown> => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter((item) => normId(item.orgId) === orgId)
    .sort((a, b) => String(b.updatedAtISO || "").localeCompare(String(a.updatedAtISO || "")));
  res.status(200).json({ ok: true, items });
}, { auth: "user", appCheck: false, methods: ["GET", "OPTIONS"] });

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
  ]);
  res.status(200).json({ ok: true, id: ref.id });
}, { auth: "user", appCheck: false, methods: ["POST", "OPTIONS"] });

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
  const source = db.collection("formsIntakeFlows").doc(flowId(uid, body.session.customerId));
  const target = db.collection("formsIntakeFlows").doc(flowId(body.targetUid, body.session.customerId));
  await db.runTransaction(async (tx) => {
    tx.set(target, {
      ...savedDoc({ orgId, ownerUid: body.targetUid, session: body.session, progress: body.progress, transferredByUid: uid }),
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.delete(source);
  });
  await upsertIntakeTask({ orgId, ownerUid: body.targetUid, session: body.session });
  res.status(200).json({ ok: true, id: target.id });
}, { auth: "user", appCheck: false, methods: ["POST", "OPTIONS"] });
