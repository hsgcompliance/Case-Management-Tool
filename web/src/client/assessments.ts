// web/src/client/assessments.ts
import api from './api';

import type {
  ReqOf,
  RespOf,
} from '@types';

// Modern assessments client (templates + submissions)
export const Assessments = {
  templates: {
    upsert: (body: ReqOf<"assessmentTemplatesUpsert">, idemKey?: string) =>
      api.call('assessmentTemplatesUpsert', { body, idempotencyKey: idemKey }) as Promise<RespOf<"assessmentTemplatesUpsert">>,

    get: (templateId: string) =>
      api.get('assessmentTemplatesGet', { templateId }) as Promise<RespOf<"assessmentTemplatesGet">>,

    list: (body: ReqOf<"assessmentTemplatesList"> = { includeLocked: true }) =>
      api.post('assessmentTemplatesList', body) as Promise<RespOf<"assessmentTemplatesList">>,

    delete: (body: ReqOf<"assessmentTemplatesDelete">) =>
      api.post('assessmentTemplatesDelete', { templateId: body.templateId, force: body.force ?? false }) as Promise<RespOf<"assessmentTemplatesDelete">>,

    listVersions: (templateId: string, status?: "draft" | "published" | "deprecated") =>
      api.get('assessmentTemplateVersionsList', { templateId, ...(status ? { status } : {}) }) as Promise<{ items: unknown[]; ok: boolean }>,
  },

  submissions: {
    submit: (body: ReqOf<"assessmentSubmit">, idemKey?: string) =>
      api.call('assessmentSubmit', { body, idempotencyKey: idemKey }) as Promise<RespOf<"assessmentSubmit">>,

    get: (submissionId: string) =>
      api.get('assessmentSubmissionGet', { submissionId }) as Promise<RespOf<"assessmentSubmissionGet">>,

    list: (body: ReqOf<"assessmentSubmissionsList"> = { limit: 50 }) =>
      api.post('assessmentSubmissionsList', {
        ...body,
        ...(Number(body?.limit ?? 0) > 500 ? { limit: 500 } : {}),
      }) as Promise<RespOf<"assessmentSubmissionsList">>,

    pushAnswer: (body: { submissionId: string; answers: { qId: string; answer: string | number }[]; sourceSurface?: string; periodKey?: string | null }) =>
      api.post('assessmentPushAnswer', body) as Promise<{ ok: boolean; submissionId: string }>,

    openReassessment: (body: { priorSubmissionId?: string | null; customerId?: string | null; enrollmentId?: string | null; kind?: string | null; prefillAnswers?: boolean; openedReason?: "manual" | "reassessment" | "scheduled" }) =>
      api.post('assessmentOpenReassessment', body) as Promise<{ ok: boolean; submissionId: string }>,
  },

  admin: {
    recalcTemplate: (body: ReqOf<"assessmentTemplateRecalc">) =>
      api.post('assessmentTemplateRecalc', body) as Promise<RespOf<"assessmentTemplateRecalc">>,
  },
};

export default Assessments;
