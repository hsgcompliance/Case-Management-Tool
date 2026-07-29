import { z } from "./core";

/** How a credit-card/invoice transaction received its grant + budget assignment. */
export const BudgetAssignmentSource = z.enum(["pipeline", "user"]);
export type TBudgetAssignmentSource = z.infer<typeof BudgetAssignmentSource>;

export function inferBudgetAssignmentSource(input: {
  source?: unknown;
  grantId?: unknown;
  lineItemId?: unknown;
  pipelineId?: unknown;
  budgetAssignmentSource?: unknown;
}): TBudgetAssignmentSource | null {
  const explicit = String(input.budgetAssignmentSource || "").trim();
  if (explicit === "pipeline" || explicit === "user") return explicit;

  const transactionSource = String(input.source || "").trim().toLowerCase();
  if (transactionSource !== "credit-card" && transactionSource !== "invoice") return null;

  const grantId = String(input.grantId || "").trim();
  const lineItemId = String(input.lineItemId || "").trim();
  if (!grantId || !lineItemId) return null;
  return String(input.pipelineId || "").trim() ? "pipeline" : "user";
}
