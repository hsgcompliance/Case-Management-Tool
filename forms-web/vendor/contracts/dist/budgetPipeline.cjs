"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

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
module.exports = __toCommonJS(budgetPipeline_exports);
var import_zod = require("zod");
var PipelineOperator = import_zod.z.enum([
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
var PipelineStatus = import_zod.z.enum(["draft", "active", "inactive"]);
var PipelineCondition = import_zod.z.object({
  id: import_zod.z.string(),
  field: import_zod.z.string(),
  // paymentQueue field key, or "raw:{fieldId}" for rawAnswers
  operator: PipelineOperator,
  value: import_zod.z.union([import_zod.z.string(), import_zod.z.number(), import_zod.z.boolean(), import_zod.z.array(import_zod.z.string())]).default("")
});
var PipelineConditionGroup = import_zod.z.object({
  id: import_zod.z.string(),
  label: import_zod.z.string().optional(),
  logic: import_zod.z.enum(["AND", "OR"]),
  kind: import_zod.z.enum(["include", "exclude"]),
  conditions: import_zod.z.array(PipelineCondition)
});
var PipelineRuleNode = import_zod.z.lazy(
  () => import_zod.z.discriminatedUnion("type", [
    import_zod.z.object({
      id: import_zod.z.string(),
      type: import_zod.z.literal("condition"),
      condition: PipelineCondition
    }),
    import_zod.z.object({
      id: import_zod.z.string(),
      type: import_zod.z.literal("group"),
      logic: import_zod.z.enum(["AND", "OR"]),
      children: import_zod.z.array(PipelineRuleNode)
    })
  ])
);
var PipelineFormSchema = import_zod.z.object({
  enabled: import_zod.z.boolean().optional().default(true),
  sourceFormId: import_zod.z.string(),
  sourceFormTitle: import_zod.z.string(),
  includeGroups: import_zod.z.array(PipelineConditionGroup).optional().default([]),
  excludeGroups: import_zod.z.array(PipelineConditionGroup).optional().default([]),
  includeTree: PipelineRuleNode.nullable().optional(),
  excludeTree: PipelineRuleNode.nullable().optional()
});
var BudgetPipeline = import_zod.z.object({
  id: import_zod.z.string(),
  orgId: import_zod.z.string(),
  name: import_zod.z.string(),
  status: PipelineStatus,
  grantId: import_zod.z.string().nullable(),
  lineItemId: import_zod.z.string().nullable(),
  sourceFormId: import_zod.z.string().nullable(),
  sourceFormTitle: import_zod.z.string().nullable(),
  formSchemas: import_zod.z.record(import_zod.z.string(), PipelineFormSchema).optional(),
  includeGroups: import_zod.z.array(PipelineConditionGroup),
  excludeGroups: import_zod.z.array(PipelineConditionGroup),
  includeTree: PipelineRuleNode.nullable().optional(),
  excludeTree: PipelineRuleNode.nullable().optional(),
  createdAt: import_zod.z.string(),
  updatedAt: import_zod.z.string(),
  createdBy: import_zod.z.string(),
  updatedBy: import_zod.z.string()
});
var BudgetPipelineUpsertBody = import_zod.z.object({
  id: import_zod.z.string().optional(),
  name: import_zod.z.string().min(1),
  status: PipelineStatus.optional(),
  grantId: import_zod.z.string().nullable().optional(),
  lineItemId: import_zod.z.string().nullable().optional(),
  sourceFormId: import_zod.z.string().nullable().optional(),
  sourceFormTitle: import_zod.z.string().nullable().optional(),
  formSchemas: import_zod.z.record(import_zod.z.string(), PipelineFormSchema).optional(),
  includeGroups: import_zod.z.array(PipelineConditionGroup).optional().default([]),
  excludeGroups: import_zod.z.array(PipelineConditionGroup).optional().default([]),
  includeTree: PipelineRuleNode.nullable().optional(),
  excludeTree: PipelineRuleNode.nullable().optional()
});
var BudgetPipelineListQuery = import_zod.z.object({
  grantId: import_zod.z.string().optional(),
  status: PipelineStatus.optional(),
  limit: import_zod.z.coerce.number().int().min(1).max(200).default(50)
});
var BudgetPipelineDeleteBody = import_zod.z.object({
  id: import_zod.z.string().min(1)
});
var BudgetPipelinePreviewBody = import_zod.z.object({
  grantId: import_zod.z.string().nullable().optional(),
  lineItemId: import_zod.z.string().nullable().optional(),
  sourceFormId: import_zod.z.string().nullable().optional(),
  includeGroups: import_zod.z.array(PipelineConditionGroup),
  excludeGroups: import_zod.z.array(PipelineConditionGroup),
  includeTree: PipelineRuleNode.nullable().optional(),
  excludeTree: PipelineRuleNode.nullable().optional(),
  pipelineId: import_zod.z.string().optional(),
  month: import_zod.z.string().optional(),
  limit: import_zod.z.coerce.number().int().min(1).max(5e3).default(100)
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BudgetPipeline,
  BudgetPipelineDeleteBody,
  BudgetPipelineListQuery,
  BudgetPipelinePreviewBody,
  BudgetPipelineUpsertBody,
  PipelineCondition,
  PipelineConditionGroup,
  PipelineFormSchema,
  PipelineOperator,
  PipelineRuleNode,
  PipelineStatus
});
