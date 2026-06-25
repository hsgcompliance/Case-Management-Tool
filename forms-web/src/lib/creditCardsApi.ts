import { getAuthed } from "./authedApi";

export type CreditCardSummaryItem = {
  id: string;
  name: string;
  status: string;
  month: string;
  monthlyLimitCents: number;
  spentCents: number;
  remainingCents: number;
  usagePct: number;
  entryCount: number;
  lastMonthSpentCents: number;
  last4: string | null;
};

export async function getCreditCardsSummary(month?: string): Promise<{ items: CreditCardSummaryItem[]; month: string }> {
  const out = await getAuthed<{ ok: true; items: CreditCardSummaryItem[]; month: string }>(
    "formsCreditCardsSummary",
    month ? { month } : {}
  );
  return { items: out.items ?? [], month: out.month };
}
