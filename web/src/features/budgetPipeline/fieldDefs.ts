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
  description?: string;
  options?: string[];
  sampleValues?: string[];
  rawFieldId?: string;
};

export const NORMALIZED_FIELDS: PipelineFieldDef[] = [
  {
    key: "wideGrantText",
    label: "Any Grant Field (Wide)",
    type: "text",
    description: "Wide match across program, billed-to, project, descriptor/service, expense type, card, merchant, customer, purpose, notes, and live transaction fields.",
  },
  { key: "merchant", label: "Merchant", type: "text", sampleValues: ["Amazon", "Walmart"], description: "Normalized vendor/merchant value on the split payment object." },
  { key: "expenseType", label: "Expense Type", type: "text", sampleValues: ["Supplies", "Food"], description: "High-level expense category after extraction." },
  { key: "program", label: "Program", type: "text", description: "Legacy normalized program field. Prefer live transaction fields when available." },
  { key: "billedTo", label: "Billed To", type: "text", description: "Legacy invoice billed-to value. Prefer the live Bill To transaction field." },
  { key: "project", label: "Project", type: "text", description: "Legacy invoice project value. Prefer the live Project transaction field." },
  { key: "purchasePath", label: "Purchase Path", type: "select", options: ["customer", "program", ""], description: "Whether the split payment object is customer-facing or program-facing." },
  { key: "card", label: "Card", type: "text", description: "Credit card selected on the checkout/return form." },
  { key: "cardBucket", label: "Card Bucket", type: "select", options: ["Youth", "Housing", "MAD", ""], description: "Derived card family for broad card routing." },
  { key: "purpose", label: "Purpose", type: "text", description: "Normalized purpose/detail text. Live transaction Purpose is also available on card schemas." },
  { key: "paymentMethod", label: "Payment Method", type: "text", description: "Invoice payment method standard field." },
  { key: "serviceType", label: "Service Type", type: "text", description: "Standard service type field where the form provides one." },
  { key: "otherService", label: "Other Service", type: "text", description: "Free-text service detail from invoice/card extraction." },
  { key: "serviceScope", label: "Service Scope", type: "text", description: "Derived service scope used by older pipeline rules." },
  { key: "wex", label: "WEX", type: "text", description: "WEX/non-WEX style classification when present." },
  { key: "descriptor", label: "Descriptor", type: "text", description: "Derived searchable descriptor for broad text routing." },
  { key: "customer", label: "Customer", type: "text", description: "Normalized customer name on the split payment object." },
  { key: "customerKey", label: "Customer Key", type: "text", description: "Stable customer identifier when extraction can resolve one." },
  { key: "amount", label: "Amount ($)", type: "number", description: "Dollar amount on the split payment object." },
  { key: "month", label: "Month", type: "date", sampleValues: ["2025-01"], description: "Queue month used for reporting/allocation windows." },
  { key: "source", label: "Source", type: "select", options: ["credit-card", "invoice", "projection", "unknown"], description: "Payment object source after extraction." },
  { key: "formTitle", label: "Form Title", type: "text", description: "Original Jotform title on the queue item." },
  { key: "isFlex", label: "Is Flex", type: "boolean", description: "Derived flex-funds flag." },
  { key: "submissionIsFlex", label: "Submission Flex", type: "boolean", description: "Submission-level flex flag before transaction splitting." },
];

export const FIELD_BY_KEY = new Map<string, PipelineFieldDef>(
  NORMALIZED_FIELDS.map((f) => [f.key, f]),
);

export type OperatorDef = { value: TPipelineOperator; label: string };

export const OPERATORS_BY_TYPE: Record<PipelineFieldType, OperatorDef[]> = {
  text: [
    { value: "contains", label: "contains" },
    { value: "not_contains", label: "doesn't contain" },
    { value: "equals", label: "equals" },
    { value: "not_equals", label: "not equals" },
    { value: "starts_with", label: "starts with" },
    { value: "is_empty", label: "is empty" },
    { value: "is_not_empty", label: "is not empty" },
  ],
  select: [
    { value: "equals", label: "is" },
    { value: "not_equals", label: "is not" },
    { value: "in", label: "is any of" },
    { value: "not_in", label: "is none of" },
    { value: "is_empty", label: "is empty" },
    { value: "is_not_empty", label: "is not empty" },
  ],
  boolean: [
    { value: "is_true", label: "is true" },
    { value: "is_false", label: "is false" },
  ],
  number: [
    { value: "gte", label: "≥" },
    { value: "lte", label: "≤" },
    { value: "equals", label: "=" },
    { value: "not_equals", label: "≠" },
    { value: "gt", label: ">" },
    { value: "lt", label: "<" },
  ],
  date: [
    { value: "equals", label: "is" },
    { value: "after", label: "after" },
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
