// functions/src/features/assessments/services.ts
import type { Claims } from "../../core";
import {
  db,
  FieldValue,
  requireOrgId,
  getTeamIds,
  canAccessDoc,
  isAdmin,
  isoNow,
  z,
  newBulkWriter,
} from "../../core";
import { normTok } from "../../core/norm";
import { z as Zod } from "zod";

function toArray<T>(x: T | T[] | null | undefined): T[] {
  return Array.isArray(x) ? x : x == null ? [] : [x];
}

import {
  AssessmentTemplate,
  AssessmentSchema,
  RubricDef,
  RubricQuestion,
  RubricOption,
  AssessmentAnswer,
  AssessmentComputed,
  AssessmentSubmission,

  AssessmentTemplateUpsertBody,
  GetTemplateBody,
  ListTemplatesBody,
  DeleteTemplateBody,

  SubmitAssessmentBody,
  GetSubmissionBody,
  ListSubmissionsBody,
  RecalcTemplateBody,

  PushAnswerBody,
  OpenReassessmentBody,
  ListVersionsBody,
} from "./schemas";

type Template = Zod.infer<typeof AssessmentTemplate>;
type Submission = Zod.infer<typeof AssessmentSubmission>;

function httpErr(message: string, code: number, meta?: Record<string, unknown>): never {
  const e: any = new Error(message);
  e.code = code;
  if (meta) e.meta = meta;
  throw e;
}
const forbidden = (msg = "forbidden", meta?: any) => httpErr(msg, 403, meta);
const notFound = (msg = "not_found", meta?: any) => httpErr(msg, 404, meta);

/**
 * Built-in default acuity template — returned when templateId === "default".
 * Mirrors web/src/entities/assessments/defaultAcuityTemplate.ts.
 * Allows the frontend to submit acuity assessments without requiring a
 * custom org template to be created first.
 */
const BUILTIN_DEFAULT_ACUITY_TEMPLATE = {
  id: "default",
  title: "Default Acuity Assessment",
  kind: "acuity",
  scope: "customer",
  version: 1,
  currentVersionId: null,
  grantId: null,
  templateStatus: "active",
  schema: {
    type: "rubric",
    rubric: {
      title: "Default Acuity Assessment",
      version: "v1",
      questions: [
        {
          id: "housing",
          label: "Housing Situation",
          options: [
            { value: "No support needed to maintain permanent housing",            points: 0   },
            { value: "Housed; needs support to maintain permanent housing",        points: 0.4 },
            { value: "Couch surfing; temporarily housed; at risk of homelessness", points: 0.6 },
            { value: "Warming Center or other emergency shelter",                  points: 0.6 },
            { value: "Transitional Housing",                                       points: 0.6 },
            { value: "Unsheltered (place not meant for habitation)",               points: 0.8 },
          ],
        },
        {
          id: "household",
          label: "Household Type",
          options: [
            { value: "Individual",                                                 points: 0   },
            { value: "Youth",                                                      points: 0.4 },
            { value: "Family or Youth HoH; Family with 4 or fewer members",       points: 0.6 },
            { value: "Family or Youth HoH; Family with 5 or more members",        points: 0.8 },
            { value: "Youth HoH; Family with 5 or more members",                  points: 1.0 },
          ],
        },
        {
          id: "lep",
          label: "Limited English Proficiency (LEP)?",
          options: [
            { value: "No",  points: 0   },
            { value: "LEP", points: 0.6 },
          ],
        },
        {
          id: "crisis",
          label: "Likelihood of Need for Crisis Intervention from CM",
          options: [
            { value: "Rare crisis experiences; client has outside support other than CM",                                      points: 0   },
            { value: "Occasional crisis experiences; client has some support other than CM",                                    points: 0.8 },
            { value: "Frequent crisis experiences; needs support from CM and has some external provider support",               points: 1.6 },
            { value: "Frequent severe crisis experiences; CM is primary support",                                               points: 2.0 },
          ],
        },
        {
          id: "independence",
          label: "Ability to manage tasks/needs independently",
          options: [
            { value: "Task/needs support from CM usually not required",              points: 0   },
            { value: "Task/needs support from CM often requested",                   points: 1.2 },
            { value: "Client struggles to independently accomplish many tasks/needs", points: 1.6 },
            { value: "No ability to independently manage tasks/needs",               points: 2.0 },
          ],
        },
      ],
      levels: [
        { min: 0,   max: 2,   label: "Minimal Acuity"  },
        { min: 3,   max: 3.5, label: "Moderate Acuity" },
        { min: 3.6, max: 4.5, label: "High Acuity"     },
        { min: 4.6, max: 10,  label: "Intense Acuity"  },
      ],
    },
  },
} as const;

const ASSESSMENT_KINDS = {
  ACUITY: "acuity",
  WAITLIST_PRIORITY: "waitlistpriority",
  PRIORITY: "priority",
  CUSTOM: "custom",
} as const;

const EDIT_POLICIES = {
  ADMIN_ONLY: "adminonly",
  OWNER_OR_ADMIN: "owneroradmin",
  TEAM: "team",
  ORG: "org",
} as const;

/* ============================================================
   contextId — stable stack key, deterministic, no lookup needed
   customer-scoped:   "{customerId}_{kind}"
   enrollment-scoped: "{enrollmentId}_{kind}"
============================================================ */

function deriveContextId(
  scope: string,
  customerId: string | null,
  enrollmentId: string | null,
  kind: string
): string {
  const k = normTok(kind) || "custom";
  if (scope === "customer" && customerId) return `${customerId}_${k}`;
  if (enrollmentId) return `${enrollmentId}_${k}`;
  if (customerId) return `${customerId}_${k}`;
  return k;
}

/* ============================================================
   Output entry builder
   Builds the flexible object stored under assessmentOutputs.{kind}
   on customer / enrollment docs. Template-defined extras from
   computed.meta are spread in after the base fields.
============================================================ */

function buildOutputEntry(
  tmpl: Template,
  computed: Zod.infer<typeof AssessmentComputed> | null | undefined,
  submissionId: string,
  contextId: string,
  orgId: string,
  customerId: string | null,
  enrollmentId: string | null,
  grantId: string | null,
  uid: string | null,
  templateVersionId: string | null
): Record<string, unknown> {
  return {
    // display
    assessmentName: (tmpl as any).title || (tmpl as any).kind || "Assessment",
    metric: (tmpl as any).outputLabel || normTok((tmpl as any).kind) || "score",
    score: computed?.score ?? null,
    level: computed?.level ?? null,
    // template-defined extras — anything in computed.meta spreads here
    ...(computed?.meta ?? {}),
    // provenance — all linkage fields always present for sort/filter without joins
    contextId,
    submissionId,
    templateId: (tmpl as any).id ?? "",
    templateVersion: Number((tmpl as any).version || 1),
    templateVersionId: templateVersionId ?? null,
    orgId,
    customerId: customerId ?? null,
    enrollmentId: enrollmentId ?? null,
    grantId: grantId ?? null,
    scoredAt: isoNow(),
    scoredBy: uid ?? "system",
  };
}

/* ============================================================
   Access checks
============================================================ */

function assertOrgScopedDoc(ctx: Claims, doc: any, notFoundMsg = "not_found") {
  const orgId = requireOrgId(ctx);
  const dOrg = String(doc?.orgId || "") || null;
  if (!dOrg) forbidden("unscoped_doc_refuse_access");
  if (dOrg !== orgId) notFound(notFoundMsg);
}

function canEditTemplate(ctx: Claims, tmpl: any): boolean {
  if (isAdmin(ctx)) return true;
  if (tmpl?.locked === true) return false;
  const policy = normTok(tmpl?.editPolicy);
  if (policy === EDIT_POLICIES.ADMIN_ONLY) return false;
  if (policy === EDIT_POLICIES.OWNER_OR_ADMIN) {
    const uid = String((ctx as any)?.uid || "");
    const owner = String(tmpl?.ownerUid || "");
    return !!uid && !!owner && uid === owner;
  }
  return canAccessDoc(ctx, tmpl as any);
}

/* ============================================================
   Scoring
============================================================ */

function buildQuestionMap(rubric: Zod.infer<typeof RubricDef>) {
  const map = new Map<string, Zod.infer<typeof RubricQuestion>>();
  for (const q of rubric.questions) map.set(q.id, q);
  return map;
}

function scoreRubric(
  rubric: Zod.infer<typeof RubricDef>,
  answers: Zod.infer<typeof AssessmentAnswer>[]
) {
  const qmap = buildQuestionMap(rubric);
  let total = 0;

  for (const a of answers || []) {
    const q = qmap.get(String(a.qId || ""));
    if (!q) continue;
    const opt = (q.options as Zod.infer<typeof RubricOption>[]).find(
      (o) => String(o.value) === String((a as any).answer)
    );
    if (opt) total += Number(opt.points || 0);
  }

  const rounded = Math.round(total * 100) / 100;
  const level =
    (rubric.levels || []).find((l) => {
      const min = Number(l.min ?? 0);
      const max = Number.isFinite(Number(l.max)) ? Number(l.max) : Number.POSITIVE_INFINITY;
      return rounded >= min && rounded <= max;
    })?.label || "Unscored";

  return { score: rounded, level };
}

function computeFromTemplate(
  tmpl: Template,
  answers: Zod.infer<typeof AssessmentAnswer>[]
) {
  const schema = AssessmentSchema.parse((tmpl as any).schema);

  if (schema.type === "rubric") {
    const { score, level } = scoreRubric(schema.rubric, answers);
    return {
      score,
      level,
      meta: { rubricVersion: schema.rubric.version || "v1" },
    } satisfies Zod.infer<typeof AssessmentComputed>;
  }

  return { score: null, level: "Unscored" } satisfies Zod.infer<typeof AssessmentComputed>;
}

function isPriorityKind(kind: any): boolean {
  const k = normTok(kind);
  return (
    k === ASSESSMENT_KINDS.WAITLIST_PRIORITY ||
    k === ASSESSMENT_KINDS.PRIORITY ||
    k.includes("priority")
  );
}

/* ============================================================
   Templates
============================================================ */

export async function upsertTemplatesService(ctx: Claims, input: unknown) {
  const orgId = requireOrgId(ctx);
  const teamIds = getTeamIds(ctx);
  const uid = String((ctx as any)?.uid || "") || null;

  const parsed = AssessmentTemplateUpsertBody.parse(input);
  const items = toArray(parsed);
  const outIds: string[] = [];

  for (const raw of items) {
    const clean = AssessmentTemplate.parse(raw);
    const requestedId = String((clean as any).id || "").trim();

    const ref = requestedId
      ? db.collection("assessmentTemplates").doc(requestedId)
      : db.collection("assessmentTemplates").doc();

    const prior = await ref.get();

    let nextVersion: number;

    if (prior.exists) {
      const priorData = prior.data() || {};
      assertOrgScopedDoc(ctx, priorData, "template_not_found");
      if (!canEditTemplate(ctx, priorData))
        forbidden("template_edit_forbidden", { templateId: ref.id });

      const priorVersion = Number((priorData as any).version || 1) || 1;
      const incomingVersion = Number((clean as any).version || 0) || 0;
      nextVersion = incomingVersion > priorVersion ? incomingVersion : priorVersion + 1;

      await ref.set(
        {
          ...clean,
          id: ref.id,
          orgId,
          teamIds,
          ownerUid: String((priorData as any).ownerUid || "") || uid,
          version: nextVersion,
          currentVersionId: `v${nextVersion}`,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } else {
      nextVersion = Number((clean as any).version || 1) || 1;

      await ref.set(
        {
          ...clean,
          id: ref.id,
          orgId,
          teamIds,
          ownerUid: (clean as any).ownerUid || uid,
          version: nextVersion,
          currentVersionId: `v${nextVersion}`,
          templateStatus: "active",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    // Write immutable version snapshot to subcollection
    const versionRef = ref.collection("versions").doc(`v${nextVersion}`);
    await versionRef.set(
      {
        id: `v${nextVersion}`,
        templateId: ref.id,
        orgId,
        versionNumber: nextVersion,
        status: "published",
        schema: (clean as any).schema,
        title: (clean as any).title || "",
        kind: normTok((clean as any).kind) || "custom",
        publishedAt: isoNow(),
        publishedByUid: uid ?? null,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    outIds.push(ref.id);
  }

  return { ids: outIds };
}

export async function getTemplateService(ctx: Claims, input: unknown) {
  const { templateId } = GetTemplateBody.parse(input || {});

  // Built-in default template — no Firestore doc required
  if (templateId === "default") {
    return { ...BUILTIN_DEFAULT_ACUITY_TEMPLATE };
  }

  const snap = await db.collection("assessmentTemplates").doc(templateId).get();
  if (!snap.exists) notFound("template_not_found");

  const data = snap.data() || {};
  assertOrgScopedDoc(ctx, data, "template_not_found");
  if (!canAccessDoc(ctx, data as any)) forbidden("forbidden");

  return { id: snap.id, ...(data as any) };
}

export async function listTemplatesService(ctx: Claims, input: unknown) {
  const orgId = requireOrgId(ctx);
  const q = ListTemplatesBody.parse(input || {});

  const snap = await db.collection("assessmentTemplates").where("orgId", "==", orgId).get();

  const items = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((t) => canAccessDoc(ctx, t as any))
    .filter((t) => (q.grantId ? String((t as any).grantId || "") === String(q.grantId) : true))
    .filter((t) => (q.kind ? normTok((t as any).kind) === normTok(q.kind) : true))
    .filter((t) => (q.scope ? String((t as any).scope || "") === String(q.scope) : true))
    .filter((t) => (q.includeLocked ? true : (t as any).locked !== true));

  items.sort((a: any, b: any) => {
    const am = (a.updatedAt as any)?.toMillis ? (a.updatedAt as any).toMillis() : 0;
    const bm = (b.updatedAt as any)?.toMillis ? (b.updatedAt as any).toMillis() : 0;
    return bm - am;
  });

  return items.map((t: any) => ({
    id: t.id,
    title: t.title || t.id,
    kind: t.kind || null,
    scope: t.scope || null,
    version: t.version || 1,
    currentVersionId: t.currentVersionId || null,
    locked: !!t.locked,
    grantId: t.grantId || null,
    updatedAt: t.updatedAt || null,
  }));
}

export async function deleteTemplateService(ctx: Claims, input: unknown) {
  const { templateId, force } = DeleteTemplateBody.parse(input);

  const ref = db.collection("assessmentTemplates").doc(templateId);
  const snap = await ref.get();
  if (!snap.exists) notFound("template_not_found");

  const data = snap.data() || {};
  assertOrgScopedDoc(ctx, data, "template_not_found");

  if ((data as any).locked === true && !isAdmin(ctx) && !force)
    forbidden("template_locked_refuse_delete");
  if (!canEditTemplate(ctx, data) && !force) forbidden("template_delete_forbidden");

  await ref.delete();
  return { deleted: true };
}

export async function listVersionsService(ctx: Claims, input: unknown) {
  const { templateId, status: statusFilter } = ListVersionsBody.parse(input || {});

  const tmplSnap = await db.collection("assessmentTemplates").doc(templateId).get();
  if (!tmplSnap.exists) notFound("template_not_found");

  const tmplData = tmplSnap.data() || {};
  assertOrgScopedDoc(ctx, tmplData, "template_not_found");
  if (!canAccessDoc(ctx, tmplData as any)) forbidden("forbidden");

  let q: FirebaseFirestore.Query = db
    .collection("assessmentTemplates")
    .doc(templateId)
    .collection("versions");

  if (statusFilter) q = q.where("status", "==", statusFilter);

  const snap = await q.get();
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .sort((a: any, b: any) => Number(b.versionNumber || 0) - Number(a.versionNumber || 0));
}

/* ============================================================
   Submissions
============================================================ */

async function assertCustomerAccess(ctx: Claims, customerId: string) {
  const orgId = requireOrgId(ctx);
  const ref = db.collection("customers").doc(customerId);
  const snap = await ref.get();
  if (!snap.exists) notFound("customer_not_found");
  const data = snap.data() || {};
  const dOrg = String((data as any).orgId || "") || null;
  if (dOrg && dOrg !== orgId) forbidden("forbidden");
  if (!canAccessDoc(ctx, data as any)) forbidden("forbidden");
  return { ref, data };
}

async function assertEnrollmentAccess(ctx: Claims, enrollmentId: string) {
  const orgId = requireOrgId(ctx);
  const ref = db.collection("customerEnrollments").doc(enrollmentId);
  const snap = await ref.get();
  if (!snap.exists) notFound("enrollment_not_found");
  const data = snap.data() || {};
  const dOrg = String((data as any).orgId || "") || null;
  if (dOrg && dOrg !== orgId) forbidden("forbidden");
  if (!canAccessDoc(ctx, data as any)) forbidden("forbidden");
  return { ref, data };
}

export async function submitAssessmentService(ctx: Claims, input: unknown) {
  const orgId = requireOrgId(ctx);
  const teamIds = getTeamIds(ctx);
  const uid = String((ctx as any)?.uid || "") || null;

  const parsed = SubmitAssessmentBody.parse(input);
  const submissions = toArray(parsed);

  if (submissions.length === 1) {
    return await submitSingleAssessment(ctx, orgId, teamIds, uid, submissions[0]);
  } else {
    return await submitBatchAssessments(ctx, orgId, teamIds, uid, submissions);
  }
}

export async function getSubmissionService(ctx: Claims, input: unknown) {
  const { submissionId } = GetSubmissionBody.parse(input || {});
  const snap = await db.collection("assessmentSubmissions").doc(submissionId).get();
  if (!snap.exists) notFound("submission_not_found");
  const data = snap.data() || {};
  assertOrgScopedDoc(ctx, data, "submission_not_found");
  if (!canAccessDoc(ctx, data as any)) forbidden("forbidden");
  return { id: snap.id, ...(data as any) };
}

export async function listSubmissionsService(ctx: Claims, input: unknown) {
  const orgId = requireOrgId(ctx);
  const { customerId, enrollmentId, templateId, contextId, status, limit } =
    ListSubmissionsBody.parse(input || {});

  if (!customerId && !enrollmentId && !contextId)
    forbidden("need_customerId_or_enrollmentId_or_contextId");

  const col = db.collection("assessmentSubmissions");
  let q: FirebaseFirestore.Query;

  if (contextId) {
    // History stack query — all submissions in this entity+kind context
    q = col
      .where("orgId", "==", orgId)
      .where("contextId", "==", String(contextId))
      .limit(limit);
  } else if (enrollmentId) {
    q = col.where("enrollmentId", "==", String(enrollmentId)).limit(limit);
  } else {
    q = col.where("customerId", "==", String(customerId)).limit(limit);
  }

  const snap = await q.get();

  let items = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((d) => String((d as any).orgId || "") === orgId)
    .filter((d) => canAccessDoc(ctx, d as any))
    .filter((d) => (templateId ? String((d as any).templateId || "") === String(templateId) : true))
    .filter((d) => (status ? String((d as any).status || "scored") === String(status) : true));

  items.sort((a: any, b: any) => {
    const am = (a.updatedAt as any)?.toMillis ? (a.updatedAt as any).toMillis() : 0;
    const bm = (b.updatedAt as any)?.toMillis ? (b.updatedAt as any).toMillis() : 0;
    return bm - am;
  });

  return items;
}

/* ============================================================
   Push partial answers into an existing open submission
============================================================ */

export async function pushAnswerService(ctx: Claims, input: unknown) {
  const { submissionId, answers, sourceSurface, periodKey } = PushAnswerBody.parse(input);
  const uid = String((ctx as any)?.uid || "") || null;

  const subRef = db.collection("assessmentSubmissions").doc(submissionId);
  const subSnap = await subRef.get();
  if (!subSnap.exists) notFound("submission_not_found");

  const subData = subSnap.data() || {};
  assertOrgScopedDoc(ctx, subData, "submission_not_found");
  if (!canAccessDoc(ctx, subData as any)) forbidden("forbidden");

  const status = String((subData as any).status || "scored");
  if (status === "superseded" || status === "voided") {
    httpErr("submission_closed_cannot_push", 400);
  }

  const templateId = String((subData as any).templateId || "");
  const tmpl = (await getTemplateService(ctx, { templateId })) as any as Template;

  // Merge: overwrite matching qIds, append new ones
  const existing: any[] = Array.isArray((subData as any).answers) ? (subData as any).answers : [];
  const incomingMap = new Map(answers.map((a) => [String(a.qId), a]));
  const merged = existing.map((a: any) => incomingMap.get(String(a.qId)) ?? a);
  for (const a of answers) {
    if (!existing.some((e: any) => String(e.qId) === String(a.qId))) merged.push(a);
  }

  const computed = computeFromTemplate(tmpl, merged);

  const scopeTok = String((subData as any).scope || "enrollment");
  const kindTok = normTok(String((subData as any).kind || "custom"));
  const customerId = String((subData as any).customerId || "") || null;
  const enrollmentId = String((subData as any).enrollmentId || "") || null;
  const grantId = String((subData as any).grantId || "") || null;
  const orgId = String((subData as any).orgId || "");
  const templateVersion = Number((subData as any).templateVersion || 1);
  const templateVersionId = String((subData as any).templateVersionId || "") || null;
  const contextId = String((subData as any).contextId || "")
    || deriveContextId(scopeTok, customerId, enrollmentId, kindTok);

  const batch = db.batch();

  batch.set(
    subRef,
    {
      answers: merged,
      computed,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid,
      lastPushSurface: sourceSurface || "inlineUI",
      lastPushAt: isoNow(),
      ...(periodKey ? { periodKey } : {}),
    },
    { merge: true }
  );

  addSnapshotUpdatesToBatch(
    batch,
    scopeTok,
    kindTok,
    templateId,
    templateVersion,
    subRef.id,
    computed,
    customerId,
    enrollmentId,
    grantId,
    orgId,
    uid,
    templateVersionId,
    tmpl,
    contextId
  );

  await batch.commit();

  return { submissionId, computed, answersCount: merged.length };
}

/* ============================================================
   Open a reassessment — new submission superseding the prior one
============================================================ */

export async function openReassessmentService(ctx: Claims, input: unknown) {
  const parsed = OpenReassessmentBody.parse(input);
  const orgId = requireOrgId(ctx);
  const teamIds = getTeamIds(ctx);
  const uid = String((ctx as any)?.uid || "") || null;

  let priorData: any = null;
  let priorRef: FirebaseFirestore.DocumentReference | null = null;

  if (parsed.priorSubmissionId) {
    const snap = await db
      .collection("assessmentSubmissions")
      .doc(parsed.priorSubmissionId)
      .get();
    if (!snap.exists) notFound("prior_submission_not_found");
    priorData = snap.data() || {};
    priorRef = snap.ref;
    assertOrgScopedDoc(ctx, priorData, "prior_submission_not_found");
    if (!canAccessDoc(ctx, priorData as any)) forbidden("forbidden");
  } else {
    // Lookup by entity + kind
    const kindTok = normTok(parsed.kind || "");
    if (!kindTok) httpErr("missing_kind", 400);

    let contextId: string;
    if (parsed.customerId) {
      await assertCustomerAccess(ctx, parsed.customerId);
      contextId = `${parsed.customerId}_${kindTok}`;
    } else if (parsed.enrollmentId) {
      await assertEnrollmentAccess(ctx, parsed.enrollmentId);
      contextId = `${parsed.enrollmentId}_${kindTok}`;
    } else {
      return forbidden("missing_priorSubmissionId_or_customerId_or_enrollmentId");
    }

    // Find most recent non-superseded submission for this context
    const q = await db
      .collection("assessmentSubmissions")
      .where("orgId", "==", orgId)
      .where("contextId", "==", contextId)
      .orderBy("createdAt", "desc")
      .limit(10)
      .get();

    const active = q.docs.find((d) => {
      const s = String(d.data()?.status || "scored");
      return s !== "superseded" && s !== "voided";
    });

    if (!active) notFound("no_active_submission_for_context");
    priorData = active!.data() || {};
    priorRef = active!.ref;
  }

  // Load current template (new run always uses latest template version)
  const templateId = String((priorData as any).templateId || "");
  const tmpl = (await getTemplateService(ctx, { templateId })) as any as Template;

  const scopeTok = String((priorData as any).scope || "enrollment");
  const kindTok = normTok(String((priorData as any).kind || "custom"));
  const customerId = String((priorData as any).customerId || "") || null;
  const enrollmentId = String((priorData as any).enrollmentId || "") || null;
  const grantId = String((priorData as any).grantId || "") || null;
  const contextId = String((priorData as any).contextId || "")
    || deriveContextId(scopeTok, customerId, enrollmentId, kindTok);
  const templateVersion = Number((tmpl as any).version || 1);
  const currentVersionId = String((tmpl as any).currentVersionId || "") || null;

  // Pre-fill answers from prior run if requested
  const answers = parsed.prefillAnswers
    ? Array.isArray((priorData as any).answers)
      ? (priorData as any).answers
      : []
    : [];

  const computed = answers.length > 0 ? computeFromTemplate(tmpl, answers) : null;
  const nowIso = isoNow();

  const newRef = db.collection("assessmentSubmissions").doc();

  const payload: any = {
    id: newRef.id,
    orgId,
    teamIds,
    templateId,
    templateVersion,
    templateVersionId: currentVersionId,
    kind: kindTok,
    scope: scopeTok,
    customerId,
    enrollmentId: scopeTok === "enrollment" ? enrollmentId : null,
    grantId,
    contextId,
    answers,
    computed: computed ?? null,
    computedBy: "server",
    byUid: uid,
    status: answers.length > 0 ? "scored" : "active",
    openedReason: parsed.openedReason || "reassessment",
    supersedes: priorRef!.id,
    supersededByRunId: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  const batch = db.batch();

  batch.set(newRef, payload, { merge: true });

  // Supersede prior atomically
  batch.set(
    priorRef!,
    {
      status: "superseded",
      supersededByRunId: newRef.id,
      supersededAt: nowIso,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // Update entity output if we have computed values from pre-fill
  if (computed) {
    addSnapshotUpdatesToBatch(
      batch,
      scopeTok,
      kindTok,
      templateId,
      templateVersion,
      newRef.id,
      computed,
      customerId,
      enrollmentId,
      grantId,
      orgId,
      uid,
      currentVersionId,
      tmpl,
      contextId
    );
  }

  await batch.commit();

  // Bridge: mark assessment task done if linked (same as submit flow)
  if (scopeTok === "enrollment" && enrollmentId && computed) {
    await markAssessmentTaskDoneIfLinked(enrollmentId, kindTok);
  }

  return {
    submissionId: newRef.id,
    priorSubmissionId: priorRef!.id,
    contextId,
    kind: kindTok,
    status: payload.status,
  };
}

/* ============================================================
   Admin recompute
============================================================ */

export async function recalcTemplateService(ctx: Claims, input: unknown) {
  const { templateId, activeOnly } = RecalcTemplateBody.parse(input || {});
  const tmpl = (await getTemplateService(ctx, { templateId })) as any as Template;
  const orgId = requireOrgId(ctx);
  const uid = String((ctx as any)?.uid || "") || null;

  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  let updated = 0;

  for (;;) {
    let q: FirebaseFirestore.Query = db
      .collection("assessmentSubmissions")
      .where("templateId", "==", templateId)
      .orderBy("__name__")
      .limit(500);

    if (cursor) q = q.startAfter(cursor);

    const page = await q.get();
    if (page.empty) break;

    const submissions = page.docs.map((doc) => {
      const data = doc.data() || {};
      const scopeTok = normTok((data as any)?.scope) || "enrollment";
      const kindTok = normTok((data as any)?.kind) || "custom";
      const customerIdRaw = String((data as any)?.customerId ?? "").trim();
      const enrollmentIdRaw = String((data as any)?.enrollmentId ?? "").trim();
      const grantIdRaw = String((data as any)?.grantId ?? "").trim();
      const templateVersionId = String((data as any)?.templateVersionId ?? "").trim() || null;
      const contextId =
        String((data as any)?.contextId ?? "").trim() ||
        deriveContextId(scopeTok, customerIdRaw || null, enrollmentIdRaw || null, kindTok);

      return {
        doc,
        data,
        scopeTok,
        kindTok,
        customerId: customerIdRaw || null,
        enrollmentId: enrollmentIdRaw || null,
        grantId: grantIdRaw || null,
        templateVersionId,
        contextId,
      };
    });

    const snapshotContext = await batchCheckActiveStatus(
      submissions.map((s) => ({
        scope: s.scopeTok,
        customerId: s.customerId,
        enrollmentId: s.enrollmentId,
      })),
      templateId
    );

    const bulkWriter = newBulkWriter(2, { initial: 200, max: 500 });
    let writes = 0;

    try {
      for (const {
        doc,
        data,
        scopeTok,
        kindTok,
        customerId,
        enrollmentId,
        grantId,
        templateVersionId,
        contextId,
      } of submissions) {
        if (activeOnly) {
          if (scopeTok === "customer" && customerId) {
            const info = snapshotContext.customers.get(customerId);
            if (!info?.active) continue;
          }
          if (scopeTok === "enrollment" && enrollmentId) {
            const info = snapshotContext.enrollments.get(enrollmentId);
            if (!info?.active) continue;
          }
        }

        const answers = Array.isArray((data as any).answers) ? (data as any).answers : [];
        const computed = computeFromTemplate(tmpl, answers);
        const tmplVersion = Number((tmpl as any).version || 1) || 1;
        const currentVersionId = String((tmpl as any).currentVersionId || "") || null;

        // Update the submission doc itself
        bulkWriter.set(
          doc.ref,
          {
            computed,
            templateVersion: tmplVersion,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        const outputEntry = buildOutputEntry(
          tmpl,
          computed,
          doc.id,
          contextId,
          orgId,
          customerId,
          enrollmentId,
          grantId,
          uid,
          templateVersionId ?? currentVersionId
        );

        // Update customer doc
        if (scopeTok === "customer" && customerId) {
          const info = snapshotContext.customers.get(customerId);
          if (info?.acuitySubmissionId === doc.id) {
            const patch: any = {
              [`assessmentOutputs.${kindTok}`]: outputEntry,
              updatedAt: FieldValue.serverTimestamp(),
            };
            if (kindTok === ASSESSMENT_KINDS.ACUITY) {
              patch.acuityScore = computed?.score ?? null;
              patch.acuity = {
                templateId,
                templateVersion: tmplVersion,
                submissionId: doc.id,
                score: computed?.score ?? null,
                level: computed?.level ?? null,
                computedAt: FieldValue.serverTimestamp(),
              };
            }
            bulkWriter.set(db.collection("customers").doc(customerId), patch, { merge: true });
          }
        }

        // Update enrollment doc
        if (scopeTok === "enrollment" && enrollmentId) {
          const info = snapshotContext.enrollments.get(enrollmentId);
          const isLatest = info?.latestAssessmentId === doc.id;
          const isPriority = isPriorityKind(kindTok) && info?.priorityAssessmentId === doc.id;

          if (isLatest || isPriority) {
            const patch: any = {
              [`assessmentOutputs.${kindTok}`]: outputEntry,
              latestAssessments: {
                [templateId]: {
                  at: FieldValue.serverTimestamp(),
                  assessmentId: doc.id,
                  templateVersion: tmplVersion,
                  computed: computed || null,
                },
              },
              updatedAt: FieldValue.serverTimestamp(),
            };
            if (isPriority) {
              patch.priorityScore = computed?.score ?? null;
              patch.priorityLevel = computed?.level ?? null;
              patch.priorityAt = FieldValue.serverTimestamp();
              patch.priorityTemplateId = templateId;
              patch.priorityTemplateVersion = tmplVersion;
              patch.priorityAssessmentId = doc.id;
            }
            bulkWriter.set(
              db.collection("customerEnrollments").doc(enrollmentId),
              patch,
              { merge: true }
            );
          }
        }

        writes++;
      }
    } finally {
      await bulkWriter.close();
    }

    updated += writes;
    cursor = page.docs[page.docs.length - 1];
  }

  return { updated };
}

/* ============================================================
   Batch helpers (unchanged from original)
============================================================ */

async function batchGetDocuments(
  collection: string,
  docIds: string[]
): Promise<Map<string, FirebaseFirestore.DocumentData>> {
  if (docIds.length === 0) return new Map();

  const batches: string[][] = [];
  for (let i = 0; i < docIds.length; i += 10) batches.push(docIds.slice(i, i + 10));

  const results = new Map<string, FirebaseFirestore.DocumentData>();
  for (const batch of batches) {
    const refs = batch.map((id) => db.collection(collection).doc(id));
    const docs = await db.getAll(...refs);
    for (const doc of docs) {
      if (doc.exists) results.set(doc.id, doc.data() || {});
    }
  }
  return results;
}

function isCustomerActiveDoc(data: any): boolean {
  const status = String(data?.status ?? "").toLowerCase();
  if (status === "deleted") return false;
  if (data?.deleted === true) return false;
  if (data?.enrolled === false) return false;
  if (data?.active === false) return false;
  if (status) return status === "active";
  return true;
}

function isEnrollmentActiveDoc(data: any): boolean {
  const status = String(data?.status ?? "").toLowerCase();
  if (status === "deleted") return false;
  if (data?.deleted === true) return false;
  if (data?.active === false) return false;
  if (status) return status === "active";
  return true;
}

type CustomerSnapshotInfo = { active: boolean; acuitySubmissionId?: string | null };
type EnrollmentSnapshotInfo = {
  active: boolean;
  priorityAssessmentId?: string | null;
  latestAssessmentId?: string | null;
};

async function batchCheckActiveStatus(
  submissions: Array<{ scope: string; customerId: string | null; enrollmentId: string | null }>,
  templateId: string
): Promise<{
  customers: Map<string, CustomerSnapshotInfo>;
  enrollments: Map<string, EnrollmentSnapshotInfo>;
}> {
  const customerIds = new Set<string>();
  const enrollmentIds = new Set<string>();

  for (const s of submissions) {
    if (s.scope === "customer" && s.customerId) customerIds.add(s.customerId);
    else if (s.scope === "enrollment" && s.enrollmentId) enrollmentIds.add(s.enrollmentId);
  }

  const [customerDocs, enrollmentDocs] = await Promise.all([
    batchGetDocuments("customers", Array.from(customerIds)),
    batchGetDocuments("customerEnrollments", Array.from(enrollmentIds)),
  ]);

  const customers = new Map<string, CustomerSnapshotInfo>();
  const enrollments = new Map<string, EnrollmentSnapshotInfo>();

  for (const [id, data] of customerDocs) {
    customers.set(id, {
      active: isCustomerActiveDoc(data),
      acuitySubmissionId: (data as any)?.acuity?.submissionId ?? null,
    });
  }

  for (const [id, data] of enrollmentDocs) {
    const latest = (data as any)?.latestAssessments?.[templateId];
    enrollments.set(id, {
      active: isEnrollmentActiveDoc(data),
      priorityAssessmentId: (data as any)?.priorityAssessmentId ?? null,
      latestAssessmentId: latest?.assessmentId ?? null,
    });
  }

  return { customers, enrollments };
}

/* ============================================================
   Submission helpers
============================================================ */

async function submitSingleAssessment(
  ctx: Claims,
  orgId: string,
  teamIds: string[],
  uid: string | null,
  submissionData: any
) {
  const { templateId, customerId, enrollmentId, answers } = submissionData;

  const tmpl = (await getTemplateService(ctx, { templateId })) as any as Template;

  const scopeTok = normTok((tmpl as any).scope) || "enrollment";
  const kindTok = normTok((tmpl as any).kind) || "custom";
  const templateVersion = Number((tmpl as any).version || 1) || 1;
  const currentVersionId = String((tmpl as any).currentVersionId || "") || null;

  let resolvedCustomerId: string | null = customerId ? String(customerId) : null;
  let resolvedEnrollmentId: string | null = enrollmentId ? String(enrollmentId) : null;
  let resolvedGrantId: string | null = String((tmpl as any).grantId || "") || null;

  if (scopeTok === "customer") {
    const custId = resolvedCustomerId || forbidden("missing_customerId");
    await assertCustomerAccess(ctx, custId);
  } else {
    const enrId = resolvedEnrollmentId || forbidden("missing_enrollmentId");
    const { data: enrollment } = await assertEnrollmentAccess(ctx, enrId);

    const eCust = String((enrollment as any).customerId || "");
    const eGrant = String((enrollment as any).grantId || "");

    if (!resolvedCustomerId) resolvedCustomerId = eCust || null;
    if (resolvedCustomerId && eCust && resolvedCustomerId !== eCust) {
      forbidden("customer_enrollment_mismatch", {
        customerId: resolvedCustomerId,
        enrollmentCustomerId: eCust,
      });
    }
    if (!resolvedGrantId) resolvedGrantId = eGrant || null;
  }

  const computed = computeFromTemplate(tmpl, answers);
  const contextId = deriveContextId(scopeTok, resolvedCustomerId, resolvedEnrollmentId, kindTok);
  const subRef = db.collection("assessmentSubmissions").doc();

  const payload: any = {
    id: subRef.id,
    orgId,
    teamIds,
    templateId,
    templateVersion,
    templateVersionId: currentVersionId,
    kind: kindTok,
    scope: scopeTok,
    customerId: resolvedCustomerId,
    enrollmentId: scopeTok === "enrollment" ? resolvedEnrollmentId : null,
    grantId: resolvedGrantId,
    contextId,
    answers,
    computed,
    computedBy: "server",
    byUid: uid,
    status: "scored",
    openedReason: (submissionData as any).openedReason || "manual",
    supersedes: null,
    supersededByRunId: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  const batch = db.batch();
  batch.set(subRef, payload, { merge: true });
  addSnapshotUpdatesToBatch(
    batch,
    scopeTok,
    kindTok,
    templateId,
    templateVersion,
    subRef.id,
    computed,
    resolvedCustomerId,
    resolvedEnrollmentId,
    resolvedGrantId,
    orgId,
    uid,
    currentVersionId,
    tmpl,
    contextId
  );
  await batch.commit();

  if (scopeTok === "enrollment" && resolvedEnrollmentId) {
    await markAssessmentTaskDoneIfLinked(resolvedEnrollmentId, kindTok);
  }

  return {
    submissionId: subRef.id,
    templateId,
    templateVersion,
    kind: kindTok,
    scope: scopeTok,
    customerId: resolvedCustomerId,
    enrollmentId: resolvedEnrollmentId,
    grantId: resolvedGrantId,
    contextId,
    computed,
  };
}

async function submitBatchAssessments(
  ctx: Claims,
  orgId: string,
  teamIds: string[],
  uid: string | null,
  submissions: any[]
) {
  const templateIds = Array.from(
    new Set(submissions.map((s) => String(s?.templateId || "").trim()).filter(Boolean))
  );

  const templates = new Map<string, Template>();
  for (const templateId of templateIds) {
    const tmpl = (await getTemplateService(ctx, { templateId })) as any as Template;
    templates.set(templateId, tmpl);
  }

  const checkedCustomers = new Set<string>();
  const enrollmentCache = new Map<string, any>();

  const getEnrollmentCached = async (enrollmentId: string) => {
    const existing = enrollmentCache.get(enrollmentId);
    if (existing) return existing;
    const { data } = await assertEnrollmentAccess(ctx, enrollmentId);
    enrollmentCache.set(enrollmentId, data);
    return data;
  };

  const ops: Array<{
    subRef: FirebaseFirestore.DocumentReference;
    payload: any;
    scopeTok: string;
    kindTok: string;
    templateId: string;
    templateVersion: number;
    currentVersionId: string | null;
    resolvedCustomerId: string | null;
    resolvedEnrollmentId: string | null;
    resolvedGrantId: string | null;
    contextId: string;
    computed: any;
    tmpl: Template;
  }> = [];

  const results: any[] = [];

  for (const s of submissions) {
    const templateId = String(s?.templateId || "").trim();
    if (!templateId) forbidden("missing_templateId");

    const tmpl = templates.get(templateId);
    if (!tmpl) notFound("template_not_found", { templateId });

    const scopeTok = normTok((tmpl as any).scope) || "enrollment";
    const kindTok = normTok((tmpl as any).kind) || "custom";
    const templateVersion = Number((tmpl as any).version || 1) || 1;
    const currentVersionId = String((tmpl as any).currentVersionId || "") || null;

    let resolvedCustomerId: string | null = s?.customerId ? String(s.customerId) : null;
    let resolvedEnrollmentId: string | null = s?.enrollmentId ? String(s.enrollmentId) : null;
    let resolvedGrantId: string | null = String((tmpl as any).grantId || "") || null;

    if (scopeTok === "customer") {
      const custId = resolvedCustomerId || forbidden("missing_customerId");
      if (!checkedCustomers.has(custId)) {
        await assertCustomerAccess(ctx, custId);
        checkedCustomers.add(custId);
      }
    } else {
      const enrId = resolvedEnrollmentId || forbidden("missing_enrollmentId");
      const enrollment = await getEnrollmentCached(enrId);
      const eCust = String((enrollment as any)?.customerId || "") || null;
      const eGrant = String((enrollment as any)?.grantId || "") || null;
      if (!resolvedCustomerId) resolvedCustomerId = eCust;
      if (resolvedCustomerId && eCust && resolvedCustomerId !== eCust) {
        forbidden("customer_enrollment_mismatch", {
          customerId: resolvedCustomerId,
          enrollmentCustomerId: eCust,
        });
      }
      if (!resolvedGrantId) resolvedGrantId = eGrant;
    }

    const answers = Array.isArray(s?.answers) ? s.answers : [];
    const computed = computeFromTemplate(tmpl as any, answers);
    const contextId = deriveContextId(scopeTok, resolvedCustomerId, resolvedEnrollmentId, kindTok);
    const subRef = db.collection("assessmentSubmissions").doc();

    const payload: any = {
      id: subRef.id,
      orgId,
      teamIds,
      templateId,
      templateVersion,
      templateVersionId: currentVersionId,
      kind: kindTok,
      scope: scopeTok,
      customerId: resolvedCustomerId,
      enrollmentId: scopeTok === "enrollment" ? resolvedEnrollmentId : null,
      grantId: resolvedGrantId,
      contextId,
      answers,
      computed,
      computedBy: "server",
      byUid: uid,
      status: "scored",
      openedReason: "manual",
      supersedes: null,
      supersededByRunId: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    ops.push({
      subRef,
      payload,
      scopeTok,
      kindTok,
      templateId,
      templateVersion,
      currentVersionId,
      resolvedCustomerId,
      resolvedEnrollmentId,
      resolvedGrantId,
      contextId,
      computed,
      tmpl: tmpl as Template,
    });

    results.push({
      submissionId: subRef.id,
      templateId,
      templateVersion,
      kind: kindTok,
      scope: scopeTok,
      customerId: resolvedCustomerId,
      enrollmentId: resolvedEnrollmentId,
      grantId: resolvedGrantId,
      contextId,
      computed,
    });
  }

  const CONCURRENCY = 10;
  for (let i = 0; i < ops.length; i += CONCURRENCY) {
    const slice = ops.slice(i, i + CONCURRENCY);

    await Promise.all(
      slice.map(async (op) => {
        const batch = db.batch();
        batch.set(op.subRef, op.payload, { merge: true });
        addSnapshotUpdatesToBatch(
          batch,
          op.scopeTok,
          op.kindTok,
          op.templateId,
          op.templateVersion,
          op.subRef.id,
          op.computed,
          op.resolvedCustomerId,
          op.resolvedEnrollmentId,
          op.resolvedGrantId,
          orgId,
          uid,
          op.currentVersionId,
          op.tmpl,
          op.contextId
        );
        await batch.commit();

        if (op.scopeTok === "enrollment" && op.resolvedEnrollmentId) {
          await markAssessmentTaskDoneIfLinked(op.resolvedEnrollmentId, op.kindTok);
        }
      })
    );
  }

  return { submissions: results };
}

/**
 * After an assessment is submitted for an enrollment, find the first open task
 * in taskSchedule whose bucket matches the assessment kind and mark it done.
 */
async function markAssessmentTaskDoneIfLinked(
  enrollmentId: string,
  kindTok: string
): Promise<void> {
  if (!enrollmentId || !kindTok || kindTok === "custom") return;

  const enrollRef = db.collection("customerEnrollments").doc(enrollmentId);
  const enrollSnap = await enrollRef.get();
  if (!enrollSnap.exists) return;

  const enrollData = enrollSnap.data() || {};
  const taskSchedule: any[] = Array.isArray((enrollData as any).taskSchedule)
    ? (enrollData as any).taskSchedule
    : [];

  const idx = taskSchedule.findIndex(
    (t: any) => !t?.completed && normTok(t?.bucket || "") === kindTok
  );
  if (idx === -1) return;

  const nowIso = isoNow();
  const updated = taskSchedule.map((t: any, i: number) =>
    i === idx ? { ...t, completed: true, completedAt: nowIso } : t
  );

  await enrollRef.set(
    { taskSchedule: updated, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
}

/**
 * Write assessmentOutputs.{kind} on the customer/enrollment doc
 * plus flat alias fields (acuityScore, priorityScore) for indexing.
 * Also writes backward-compat fields (acuity.*, latestAssessments.*).
 */
function addSnapshotUpdatesToBatch(
  batch: FirebaseFirestore.WriteBatch,
  scope: string,
  kind: string,
  templateId: string,
  templateVersion: number,
  submissionId: string,
  computed: any,
  customerId: string | null,
  enrollmentId: string | null,
  grantId: string | null,
  orgId: string,
  uid: string | null,
  templateVersionId: string | null,
  tmpl: Template,
  contextId: string
) {
  const scopeTok = normTok(scope) || "enrollment";
  const kindTok = normTok(kind) || "custom";
  const tmplVersion = Number(templateVersion || 1);

  const outputEntry = buildOutputEntry(
    tmpl,
    computed,
    submissionId,
    contextId,
    orgId,
    customerId,
    enrollmentId,
    grantId,
    uid,
    templateVersionId
  );

  if (scopeTok === "customer" && customerId) {
    const patch: any = {
      [`assessmentOutputs.${kindTok}`]: outputEntry,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (kindTok === ASSESSMENT_KINDS.ACUITY) {
      // Flat aliases kept for index queries + backward compat
      patch.acuityScore = computed?.score ?? null;
      patch.acuity = {
        templateId,
        templateVersion: tmplVersion,
        submissionId,
        score: computed?.score ?? null,
        level: computed?.level ?? null,
        computedAt: FieldValue.serverTimestamp(),
      };
    }

    batch.set(db.collection("customers").doc(customerId), patch, { merge: true });
  }

  if (scopeTok === "enrollment" && enrollmentId) {
    const patch: any = {
      [`assessmentOutputs.${kindTok}`]: outputEntry,
      latestAssessments: {
        [templateId]: {
          at: FieldValue.serverTimestamp(),
          assessmentId: submissionId,
          templateVersion: tmplVersion,
          computed: computed || null,
        },
      },
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (isPriorityKind(kindTok)) {
      // Flat aliases kept for index queries + backward compat
      patch.priorityScore = computed?.score ?? null;
      patch.priorityLevel = computed?.level ?? null;
      patch.priorityAt = FieldValue.serverTimestamp();
      patch.priorityTemplateId = templateId;
      patch.priorityTemplateVersion = tmplVersion;
      patch.priorityAssessmentId = submissionId;
    }

    batch.set(db.collection("customerEnrollments").doc(enrollmentId), patch, { merge: true });
  }
}
