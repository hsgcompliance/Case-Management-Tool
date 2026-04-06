// functions/src/features/assessments/http.ts
import { secureHandler } from "../../core";
import { AssessmentSchema } from "./schemas";
import {
  upsertTemplatesService,
  getTemplateService,
  listTemplatesService,
  deleteTemplateService,
  listVersionsService,
  submitAssessmentService,
  getSubmissionService,
  listSubmissionsService,
  pushAnswerService,
  openReassessmentService,
  recalcTemplateService,
} from "./services";

export const assessmentTemplatesUpsert = secureHandler(
  async (req, res) => {
    const out = await upsertTemplatesService((req as any).user, req.body);
    res.status(200).json({ ...out, ok: true });
  },
  { auth: "user", methods: ["POST", "OPTIONS"], requireOrg: true, requireTeams: true }
);

export const assessmentTemplatesGet = secureHandler(
  async (req, res) => {
    const templateId =
      (req.query?.templateId as string) || req.body?.templateId || req.body?.id;
    const out = await getTemplateService((req as any).user, { templateId });
    res.json({ template: out, ok: true });
  },
  { auth: "user", methods: ["GET", "POST", "OPTIONS"], requireOrg: true, requireTeams: true }
);

export const assessmentTemplatesList = secureHandler(
  async (req, res) => {
    const out = await listTemplatesService((req as any).user, req.body || {});
    res.json({ items: out, ok: true });
  },
  { auth: "user", methods: ["GET", "POST", "OPTIONS"], requireOrg: true, requireTeams: true }
);

export const assessmentTemplatesDelete = secureHandler(
  async (req, res) => {
    const out = await deleteTemplateService((req as any).user, req.body);
    res.json({ ...out, ok: true });
  },
  { auth: "user", methods: ["POST", "OPTIONS"], requireOrg: true, requireTeams: true }
);

/** List all published versions for a template (newest first). */
export const assessmentTemplateVersionsList = secureHandler(
  async (req, res) => {
    const templateId =
      (req.query?.templateId as string) || req.body?.templateId || req.body?.id;
    const status = (req.query?.status as string) || req.body?.status || undefined;
    const out = await listVersionsService((req as any).user, { templateId, status });
    res.json({ items: out, ok: true });
  },
  { auth: "user", methods: ["GET", "POST", "OPTIONS"], requireOrg: true, requireTeams: true }
);

export const assessmentSubmit = secureHandler(
  async (req, res) => {
    const out = await submitAssessmentService((req as any).user, req.body);
    res.json({ ...out, ok: true });
  },
  { auth: "user", methods: ["POST", "OPTIONS"], requireOrg: true, requireTeams: true }
);

export const assessmentSubmissionGet = secureHandler(
  async (req, res) => {
    const submissionId =
      (req.query?.submissionId as string) || req.body?.submissionId || req.body?.id;
    const out = await getSubmissionService((req as any).user, { submissionId });
    res.json({ submission: out, ok: true });
  },
  { auth: "user", methods: ["GET", "POST", "OPTIONS"], requireOrg: true, requireTeams: true }
);

export const assessmentSubmissionsList = secureHandler(
  async (req, res) => {
    const out = await listSubmissionsService((req as any).user, req.body || {});
    res.json({ items: out, ok: true });
  },
  { auth: "user", methods: ["GET", "POST", "OPTIONS"], requireOrg: true, requireTeams: true }
);

/**
 * Push partial answers into an existing open submission.
 * Merges by qId — later push for same question overwrites prior.
 * Use from: queue review, client detail, task completion, any inline surface.
 */
export const assessmentPushAnswer = secureHandler(
  async (req, res) => {
    const out = await pushAnswerService((req as any).user, req.body);
    res.json({ ...out, ok: true });
  },
  { auth: "user", methods: ["POST", "OPTIONS"], requireOrg: true, requireTeams: true }
);

/**
 * Open a new reassessment run superseding the prior one.
 * Prior submission is atomically marked superseded.
 * Provide either priorSubmissionId or customerId/enrollmentId + kind.
 */
export const assessmentOpenReassessment = secureHandler(
  async (req, res) => {
    const out = await openReassessmentService((req as any).user, req.body);
    res.json({ ...out, ok: true });
  },
  { auth: "user", methods: ["POST", "OPTIONS"], requireOrg: true, requireTeams: true }
);

export const assessmentTemplateRecalc = secureHandler(
  async (req, res) => {
    const out = await recalcTemplateService((req as any).user, req.body);
    res.json({ ...out, ok: true });
  },
  { auth: "admin", methods: ["POST", "OPTIONS"], requireOrg: true, requireTeams: true }
);
