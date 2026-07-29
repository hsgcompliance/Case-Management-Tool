import {
  z
} from "./chunk-AXFMCCQR.js";
import {
  __export
} from "./chunk-MLKGABMK.js";

// src/budgetAssignment.ts
var budgetAssignment_exports = {};
__export(budgetAssignment_exports, {
  BudgetAssignmentSource: () => BudgetAssignmentSource,
  inferBudgetAssignmentSource: () => inferBudgetAssignmentSource
});
var BudgetAssignmentSource = z.enum(["pipeline", "user"]);
function inferBudgetAssignmentSource(input) {
  const explicit = String(input.budgetAssignmentSource || "").trim();
  if (explicit === "pipeline" || explicit === "user") return explicit;
  const transactionSource = String(input.source || "").trim().toLowerCase();
  if (transactionSource !== "credit-card" && transactionSource !== "invoice") return null;
  const grantId = String(input.grantId || "").trim();
  const lineItemId = String(input.lineItemId || "").trim();
  if (!grantId || !lineItemId) return null;
  return String(input.pipelineId || "").trim() ? "pipeline" : "user";
}

export {
  BudgetAssignmentSource,
  inferBudgetAssignmentSource,
  budgetAssignment_exports
};
