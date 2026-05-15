// functions/src/features/budgetPipeline/schemas.ts
import {z} from '../../core/z';

export const PipelineOperator = z.enum([
  'equals', 'not_equals',
  'contains', 'not_contains', 'starts_with',
  'in', 'not_in',
  'gte', 'lte', 'gt', 'lt',
  'is_true', 'is_false',
  'before', 'after',
  'is_empty', 'is_not_empty',
]);
export type TPipelineOperator = z.infer<typeof PipelineOperator>;

export const PipelineStatus = z.enum(['draft', 'active', 'inactive']);
export type TPipelineStatus = z.infer<typeof PipelineStatus>;

export const PipelineCondition = z.object({
  id: z.string(),
  field: z.string(),
  operator: PipelineOperator,
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).default(''),
});
export type TPipelineCondition = z.infer<typeof PipelineCondition>;

export const PipelineConditionGroup = z.object({
  id: z.string(),
  label: z.string().optional(),
  logic: z.enum(['AND', 'OR']),
  kind: z.enum(['include', 'exclude']),
  conditions: z.array(PipelineCondition),
});
export type TPipelineConditionGroup = z.infer<typeof PipelineConditionGroup>;

export const BudgetPipeline = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  status: PipelineStatus,
  grantId: z.string().nullable(),
  lineItemId: z.string().nullable(),
  sourceFormId: z.string().nullable(),
  sourceFormTitle: z.string().nullable(),
  includeGroups: z.array(PipelineConditionGroup),
  excludeGroups: z.array(PipelineConditionGroup),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
  updatedBy: z.string(),
});
export type TBudgetPipeline = z.infer<typeof BudgetPipeline>;

export const BudgetPipelineUpsertBody = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  status: PipelineStatus.optional(),
  grantId: z.string().nullable().optional(),
  lineItemId: z.string().nullable().optional(),
  sourceFormId: z.string().nullable().optional(),
  sourceFormTitle: z.string().nullable().optional(),
  includeGroups: z.array(PipelineConditionGroup).optional().default([]),
  excludeGroups: z.array(PipelineConditionGroup).optional().default([]),
});
export type TBudgetPipelineUpsertBody = z.infer<typeof BudgetPipelineUpsertBody>;

export const BudgetPipelineListQuery = z.object({
  orgId: z.string().optional(),
  grantId: z.string().optional(),
  status: PipelineStatus.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type TBudgetPipelineListQuery = z.infer<typeof BudgetPipelineListQuery>;

export const BudgetPipelineDeleteBody = z.object({
  id: z.string().min(1),
});
export type TBudgetPipelineDeleteBody = z.infer<typeof BudgetPipelineDeleteBody>;

export const BudgetPipelinePreviewBody = z.object({
  orgId: z.string().optional(),
  grantId: z.string().nullable().optional(),
  lineItemId: z.string().nullable().optional(),
  sourceFormId: z.string().nullable().optional(),
  includeGroups: z.array(PipelineConditionGroup),
  excludeGroups: z.array(PipelineConditionGroup),
  pipelineId: z.string().optional(),
  month: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
export type TBudgetPipelinePreviewBody = z.infer<typeof BudgetPipelinePreviewBody>;
