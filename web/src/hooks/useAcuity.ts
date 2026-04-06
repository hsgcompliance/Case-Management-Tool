// src/hooks/useAcuity.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Assessments } from '@client/assessments';
import { qk } from './queryKeys';
import { RQ_DEFAULTS, RQ_DETAIL } from './base';
import { useInvalidateMutation } from './optimistic';

export function useRubricsList(opts?: { enabled?: boolean; staleTime?: number }) {
  const enabled = opts?.enabled ?? true;
  return useQuery<any[]>({
    ...RQ_DEFAULTS,
    enabled,
    queryKey: qk.acuity.rubrics(),
    queryFn: async () => {
      const r = await Assessments.templates.list({
        kind: 'acuity',
        scope: 'customer',
        includeLocked: true,
      });
      return (r as any)?.items ?? [];
    },
    staleTime: opts?.staleTime ?? RQ_DEFAULTS.staleTime,
  });
}

export function useRubric(rubricId?: string, opts?: { enabled?: boolean; staleTime?: number }) {
  const enabled = (opts?.enabled ?? true) && !!rubricId;
  return useQuery<any>({
    ...RQ_DETAIL,
    enabled,
    queryKey: rubricId ? qk.acuity.rubric(rubricId) : qk.acuity.rubricNoop(),
    queryFn: async () => {
      const r = await Assessments.templates.get(rubricId!);
      return (r as any)?.template ?? null;
    },
    staleTime: opts?.staleTime ?? RQ_DETAIL.staleTime,
  });
}

export function useRubricSet() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.acuity.rubrics()],
    mutationFn: (body: any) => Assessments.templates.upsert(body),
    onSuccess: (_r, body) => {
      const id = (body as any)?.rubricId || (body as any)?.id;
      if (id) qc.invalidateQueries({ queryKey: qk.acuity.rubric(id) });
    },
  });
}

export function useRubricDelete() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.acuity.rubrics()],
    mutationFn: (body: any) => {
      const templateId = String((body as any)?.rubricId || (body as any)?.templateId || '');
      return Assessments.templates.delete({ templateId, force: (body as any)?.force });
    },
    onSuccess: (_r, body) => {
      const id = (body as any)?.rubricId;
      if (id) qc.invalidateQueries({ queryKey: qk.acuity.rubric(id) });
    },
  });
}

export function useRubricRecalc() {
  return useMutation({
    mutationFn: (body: any) => {
      const templateId = String((body as any)?.rubricId || (body as any)?.templateId || '');
      const activeOnly = (body as any)?.activeOnly;
      return Assessments.admin.recalcTemplate({ templateId, activeOnly });
    },
  });
}

export function useAcuitySubmitAnswers() {
  return useMutation({
    mutationFn: (body: any) => {
      const templateId = String((body as any)?.rubricId || (body as any)?.templateId || '');
      const customerId = (body as any)?.customerId;
      const answers = (body as any)?.answers;
      return Assessments.submissions.submit({ templateId, customerId, answers });
    },
  });
}
