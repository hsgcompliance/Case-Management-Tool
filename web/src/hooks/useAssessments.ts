"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Assessments from "@client/assessments";
import { qk } from "./queryKeys";
import { RQ_DEFAULTS, RQ_DETAIL } from "./base";
import type { ReqOf, RespOf } from "@types";
import { useInvalidateMutation } from "./optimistic";

// Intentional: template/submission screens are edited/live-reviewed often.
const ASSESSMENTS_TEMPLATE_STALE_MS = 30_000;
const ASSESSMENTS_SUBMISSIONS_STALE_MS = 10_000;

export function useAssessmentTemplates(
  filters: ReqOf<"assessmentTemplatesList"> = { includeLocked: true },
  opts?: { enabled?: boolean; staleTime?: number }
) {
  return useQuery({
    ...RQ_DEFAULTS,
    enabled: opts?.enabled ?? true,
    queryKey: qk.assessments.templates(filters || {}),
    queryFn: async () => {
      const resp = await Assessments.templates.list(filters);
      return Array.isArray((resp as RespOf<"assessmentTemplatesList">)?.items)
        ? (resp as RespOf<"assessmentTemplatesList">).items
        : [];
    },
    staleTime: opts?.staleTime ?? ASSESSMENTS_TEMPLATE_STALE_MS,
  });
}

export function useAssessmentTemplate(
  templateId?: string,
  opts?: { enabled?: boolean; staleTime?: number }
) {
  const enabled = (opts?.enabled ?? true) && !!templateId;
  return useQuery({
    ...RQ_DETAIL,
    enabled,
    queryKey: qk.assessments.template(String(templateId || "__none__")),
    queryFn: async () => {
      const resp = await Assessments.templates.get(String(templateId));
      return (resp as RespOf<"assessmentTemplatesGet">)?.template ?? null;
    },
    staleTime: opts?.staleTime ?? ASSESSMENTS_TEMPLATE_STALE_MS,
  });
}

export function useAssessmentTemplatesUpsert() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.assessments.root],
    mutationFn: (body: ReqOf<"assessmentTemplatesUpsert">) => Assessments.templates.upsert(body),
  });
}

export function useAssessmentTemplateDelete() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.assessments.root],
    mutationFn: (body: ReqOf<"assessmentTemplatesDelete">) => Assessments.templates.delete(body),
  });
}

export function useAssessmentSubmit() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.assessments.root],
    mutationFn: (body: ReqOf<"assessmentSubmit">) => Assessments.submissions.submit(body),
  });
}

export function useAssessmentSubmissions(
  filters: ReqOf<"assessmentSubmissionsList">,
  opts?: { enabled?: boolean; staleTime?: number }
) {
  const enabled = (opts?.enabled ?? true) && !!filters;
  return useQuery({
    ...RQ_DEFAULTS,
    enabled,
    queryKey: qk.assessments.submissions(filters || {}),
    queryFn: async () => {
      const resp = await Assessments.submissions.list(filters);
      return Array.isArray((resp as RespOf<"assessmentSubmissionsList">)?.items)
        ? (resp as RespOf<"assessmentSubmissionsList">).items
        : [];
    },
    staleTime: opts?.staleTime ?? ASSESSMENTS_SUBMISSIONS_STALE_MS,
  });
}

export function useAssessmentTemplateRecalc() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.assessments.root],
    mutationFn: (body: ReqOf<"assessmentTemplateRecalc">) => Assessments.admin.recalcTemplate(body),
  });
}

export function useAssessmentTemplateVersions(
  templateId?: string,
  opts?: { enabled?: boolean; status?: "draft" | "published" | "deprecated" }
) {
  const enabled = (opts?.enabled ?? true) && !!templateId;
  return useQuery({
    ...RQ_DEFAULTS,
    enabled,
    queryKey: qk.assessments.versions(String(templateId || "__none__")),
    queryFn: async () => {
      const resp = await Assessments.templates.listVersions(String(templateId), opts?.status);
      return Array.isArray(resp?.items) ? resp.items : [];
    },
    staleTime: ASSESSMENTS_TEMPLATE_STALE_MS,
  });
}

export function useAssessmentPushAnswer() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.assessments.submissions()],
    mutationFn: (body: Parameters<typeof Assessments.submissions.pushAnswer>[0]) =>
      Assessments.submissions.pushAnswer(body),
  });
}

export function useAssessmentOpenReassessment() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.assessments.submissions()],
    mutationFn: (body: Parameters<typeof Assessments.submissions.openReassessment>[0]) =>
      Assessments.submissions.openReassessment(body),
  });
}
