import { z } from "./core.js";
/** How a credit-card/invoice transaction received its grant + budget assignment. */
export declare const BudgetAssignmentSource: z.ZodEnum<{
    pipeline: "pipeline";
    user: "user";
}>;
export type TBudgetAssignmentSource = z.infer<typeof BudgetAssignmentSource>;
export declare function inferBudgetAssignmentSource(input: {
    source?: unknown;
    grantId?: unknown;
    lineItemId?: unknown;
    pipelineId?: unknown;
    budgetAssignmentSource?: unknown;
}): TBudgetAssignmentSource | null;
