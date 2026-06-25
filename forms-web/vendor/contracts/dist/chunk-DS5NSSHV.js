import {
  __export
} from "./chunk-MLKGABMK.js";

// src/budgetPipeline.ts
var budgetPipeline_exports = {};
__export(budgetPipeline_exports, {
  BudgetPipeline: () => BudgetPipeline,
  BudgetPipelineDeleteBody: () => BudgetPipelineDeleteBody,
  BudgetPipelineListQuery: () => BudgetPipelineListQuery,
  BudgetPipelinePreviewBody: () => BudgetPipelinePreviewBody,
  BudgetPipelineUpsertBody: () => BudgetPipelineUpsertBody,
  PipelineCondition: () => PipelineCondition,
  PipelineConditionGroup: () => PipelineConditionGroup,
  PipelineFormSchema: () => PipelineFormSchema,
  PipelineOperator: () => PipelineOperator,
  PipelineRuleNode: () => PipelineRuleNode,
  PipelineStatus: () => PipelineStatus
});
import { z } from "zod";
var PipelineOperator = z.enum([
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "starts_with",
  "in",
  "not_in",
  "gte",
  "lte",
  "gt",
  "lt",
  "is_true",
  "is_false",
  "before",
  "after",
  "is_empty",
  "is_not_empty"
]);
var PipelineStatus = z.enum(["draft", "active", "inactive"]);
var PipelineCondition = z.object({
  id: z.string(),
  field: z.string(),
  // paymentQueue field key, or "raw:{fieldId}" for rawAnswers
  operator: PipelineOperator,
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).default("")
});
var PipelineConditionGroup = z.object({
  id: z.string(),
  label: z.string().optional(),
  logic: z.enum(["AND", "OR"]),
  kind: z.enum(["include", "exclude"]),
  conditions: z.array(PipelineCondition)
});
var PipelineRuleNode = z.lazy(
  () => z.discriminatedUnion("type", [
    z.object({
      id: z.string(),
      type: z.literal("condition"),
      condition: PipelineCondition
    }),
    z.object({
      id: z.string(),
      type: z.literal("group"),
      logic: z.enum(["AND", "OR"]),
      children: z.array(PipelineRuleNode)
    })
  ])
);
var PipelineFormSchema = z.object({
  enabled: z.boolean().optional().default(true),
  sourceFormId: z.string(),
  sourceFormTitle: z.string(),
  includeGroups: z.array(PipelineConditionGroup).optional().default([]),
  excludeGroups: z.array(PipelineConditionGroup).optional().default([]),
  includeTree: PipelineRuleNode.nullable().optional(),
  excludeTree: PipelineRuleNode.nullable().optional()
});
var BudgetPipeline = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  status: PipelineStatus,
  grantId: z.string().nullable(),
  lineItemId: z.string().nullable(),
  sourceFormId: z.string().nullable(),
  sourceFormTitle: z.string().nullable(),
  formSchemas: z.record(z.string(), PipelineFormSchema).optional(),
  includeGroups: z.array(PipelineConditionGroup),
  excludeGroups: z.array(PipelineConditionGroup),
  includeTree: PipelineRuleNode.nullable().optional(),
  excludeTree: PipelineRuleNode.nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
  updatedBy: z.string()
});
var BudgetPipelineUpsertBody = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  status: PipelineStatus.optional(),
  grantId: z.string().nullable().optional(),
  lineItemId: z.string().nullable().optional(),
  sourceFormId: z.string().nullable().optional(),
  sourceFormTitle: z.string().nullable().optional(),
  formSchemas: z.record(z.string(), PipelineFormSchema).optional(),
  includeGroups: z.array(PipelineConditionGroup).optional().default([]),
  excludeGroups: z.array(PipelineConditionGroup).optional().default([]),
  includeTree: PipelineRuleNode.nullable().optional(),
  excludeTree: PipelineRuleNode.nullable().optional()
});
var BudgetPipelineListQuery = z.object({
  grantId: z.string().optional(),
  status: PipelineStatus.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50)
});
var BudgetPipelineDeleteBody = z.object({
  id: z.string().min(1)
});
var BudgetPipelinePreviewBody = z.object({
  grantId: z.string().nullable().optional(),
  lineItemId: z.string().nullable().optional(),
  sourceFormId: z.string().nullable().optional(),
  includeGroups: z.array(PipelineConditionGroup),
  excludeGroups: z.array(PipelineConditionGroup),
  includeTree: PipelineRuleNode.nullable().optional(),
  excludeTree: PipelineRuleNode.nullable().optional(),
  pipelineId: z.string().optional(),
  month: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(5e3).default(100)
});

export {
  PipelineOperator,
  PipelineStatus,
  PipelineCondition,
  PipelineConditionGroup,
  PipelineRuleNode,
  PipelineFormSchema,
  BudgetPipeline,
  BudgetPipelineUpsertBody,
  BudgetPipelineListQuery,
  BudgetPipelineDeleteBody,
  BudgetPipelinePreviewBody,
  budgetPipeline_exports
};
