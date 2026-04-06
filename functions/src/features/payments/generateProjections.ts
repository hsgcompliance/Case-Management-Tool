// functions/src/features/payments/generateProjections.ts
import type { Request, Response } from "express";
import { secureHandler } from "../../core/http";
import { generateMonthlyProjections } from "./utils";
import { PaymentsGenerateProjectionsBody } from "./schemas";

/** POST /paymentsGenerateProjections */
export async function paymentsGenerateProjectionsHandler(req: Request, res: Response) {
  const parsed = PaymentsGenerateProjectionsBody.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.message });

  const body = parsed.data;

  const items = generateMonthlyProjections({
    startDate: body.startDate,
    months: body.months,
    monthlyAmount: body.monthlyAmount,
    deposit: body.deposit,
  });

  return res.status(200).json({ ok: true, items });
}

export const paymentsGenerateProjections = secureHandler(
  async (req, res): Promise<void> => {
    await paymentsGenerateProjectionsHandler(req as any, res as any);
  },
  { auth: "user", methods: ["POST", "OPTIONS"] }
);
