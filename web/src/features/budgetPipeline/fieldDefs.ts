// web/src/features/budgetPipeline/fieldDefs.ts
import type { TPipelineOperator } from "@types";

export type PipelineFieldType = "text" | "select" | "boolean" | "number" | "date";
export type PipelineLogicType =
  | "dropdown"
  | "single_select"
  | "multi_select"
  | "date"
  | "text"
  | "number"
  | "email"
  | "phone"
  | "file"
  | "unknown";

export type PipelineFieldDef = {
  key: string;
  label: string;
  type: PipelineFieldType;
  rawType?: string;
  logicType?: PipelineLogicType;
  typeLabel?: string;
  options?: string[];
  sampleValues?: string[];
  rawFieldId?: string;
};

export const NORMALIZED_FIELDS: PipelineFieldDef[] = [
  { key: "merchant",        label: "Merchant",        type: "text",   sampleValues: ["Amazon", "Walmart"] },
  { key: "expenseType",     label: "Expense Type",    type: "text",   sampleValues: ["Supplies", "Food"] },
  { key: "program",         label: "Program",         type: "text" },
  { key: "billedTo",        label: "Billed To",       type: "text" },
  { key: "project",         label: "Project",         type: "text" },
  { key: "purchasePath",    label: "Purchase Path",   type: "select", options: ["customer", "program", ""] },
  { key: "card",            label: "Card",            type: "text" },
  { key: "cardBucket",      label: "Card Bucket",     type: "select", options: ["Youth", "Housing", "MAD", ""] },
  { key: "purpose",         label: "Purpose",         type: "text" },
  { key: "paymentMethod",   label: "Payment Method",  type: "text" },
  { key: "serviceType",     label: "Service Type",    type: "text" },
  { key: "otherService",    label: "Other Service",   type: "text" },
  { key: "serviceScope",    label: "Service Scope",   type: "text" },
  { key: "wex",             label: "WEX",             type: "text" },
  { key: "descriptor",      label: "Descriptor",      type: "text" },
  { key: "customer",        label: "Customer",        type: "text" },
  { key: "customerKey",     label: "Customer Key",    type: "text" },
  { key: "amount",          label: "Amount ($)",      type: "number" },
  { key: "month",           label: "Month",           type: "date",   sampleValues: ["2025-01"] },
  { key: "source",          label: "Source",          type: "select", options: ["credit-card", "invoice", "projection", "unknown"] },
  { key: "formTitle",       label: "Form Title",      type: "text" },
  { key: "isFlex",          label: "Is Flex",         type: "boolean" },
  { key: "submissionIsFlex",label: "Submission Flex", type: "boolean" },
];

export const FIELD_BY_KEY = new Map<string, PipelineFieldDef>(
  NORMALIZED_FIELDS.map((f) => [f.key, f]),
);

export type OperatorDef = { value: TPipelineOperator; label: string };

export const OPERATORS_BY_TYPE: Record<PipelineFieldType, OperatorDef[]> = {
  text: [
    { value: "contains",      label: "contains" },
    { value: "not_contains",  label: "doesn't contain" },
    { value: "equals",        label: "equals" },
    { value: "not_equals",    label: "not equals" },
    { value: "starts_with",   label: "starts with" },
    { value: "is_empty",      label: "is empty" },
    { value: "is_not_empty",  label: "is not empty" },
  ],
  select: [
    { value: "equals",        label: "is" },
    { value: "not_equals",    label: "is not" },
    { value: "in",            label: "is any of" },
    { value: "not_in",        label: "is none of" },
    { value: "is_empty",      label: "is empty" },
    { value: "is_not_empty",  label: "is not empty" },
  ],
  boolean: [
    { value: "is_true",  label: "is true" },
    { value: "is_false", label: "is false" },
  ],
  number: [
    { value: "gte",        label: "≥" },
    { value: "lte",        label: "≤" },
    { value: "equals",     label: "=" },
    { value: "not_equals", label: "≠" },
    { value: "gt",         label: ">" },
    { value: "lt",         label: "<" },
  ],
  date: [
    { value: "equals", label: "is" },
    { value: "after",  label: "after" },
    { value: "before", label: "before" },
  ],
};

export const NO_VALUE_OPERATORS = new Set<TPipelineOperator>([
  "is_empty", "is_not_empty", "is_true", "is_false",
]);

export function defaultOperatorForField(key: string): TPipelineOperator {
  const def = FIELD_BY_KEY.get(key);
  const type = def?.type ?? "text";
  return OPERATORS_BY_TYPE[type][0].value;
}
