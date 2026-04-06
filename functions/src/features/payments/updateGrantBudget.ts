// functions/src/features/payments/updateGrantBudget.ts
/**
 * Recompute a grant's projected/spent in one shot.
 * POST /paymentsUpdateGrantBudget
 * Body: { grantId, effectiveFrom?, activeOnly?, source?, dryRun? }
 *
 * Thin alias to recalcGrantProjected to avoid drift.
 */
import type { Request, Response } from "express";
import { secureHandler, toDateOnly  } from "../../core";
import { recalcProjectedForGrant } from "./recalcGrantProjected";
import {
  PaymentsUpdateGrantBudgetBody,
  type TPaymentsUpdateGrantBudgetBody,
} from "./schemas";

/** POST /paymentsUpdateGrantBudget */
export async function paymentsUpdateGrantBudgetHandler(
  req: Request,
  res: Response
) {
  const parsed = PaymentsUpdateGrantBudgetBody.safeParse(req.body ?? {});
  if (!parsed.success)
    return res.status(400).json({ ok: false, error: parsed.error.message });

  const { grantId, effectiveFrom, activeOnly, source, dryRun } =
    parsed.data as TPaymentsUpdateGrantBudgetBody;
  const effectiveFromISO = toDateOnly(effectiveFrom || new Date());

  try {
    const user: any = (req as any)?.user || null;
    const out = await recalcProjectedForGrant(
      grantId,
      { effectiveFromISO, activeOnly, source },
      user,
      !!dryRun
    );
    return res.status(200).json({
      ok: true,
      grantId,
      totals: out.totals,
      dryRun: !!dryRun,
      effectiveFromISO,
      activeOnly,
      source,
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: err?.message || "Failed to update grant budget",
    });
  }
}

export const paymentsUpdateGrantBudget = secureHandler(
  async (req, res): Promise<void> => {
    await paymentsUpdateGrantBudgetHandler(req as any, res as any);
  },
  { auth: "user", methods: ["POST", "OPTIONS"] }
);
