export type BudgetCycle = {
  id: string;
  startDate: string;
  endDate: string;
  amount: number;
  spent: number;
  projected: number;
};

export type ActiveCycleBudget = {
  startDate: string;
  endDate: string;
  amount: number;
  spent: number;
  projected: number;
  available: number;
};

const cents = (value: unknown) => Math.round(Number(value || 0) * 100);

export function isDateInBudgetCycle(date: string, cycle: Pick<BudgetCycle, "startDate" | "endDate">) {
  return !!date && !!cycle.startDate && !!cycle.endDate && date >= cycle.startDate && date <= cycle.endDate;
}

/** Aggregate active goals so a grant-level card can represent all of its split line items. */
export function resolveActiveCycleBudget(cycles: BudgetCycle[], today: string): ActiveCycleBudget | null {
  const active = cycles.filter((cycle) => isDateInBudgetCycle(today, cycle));
  if (!active.length) return null;

  const amountCents = active.reduce((sum, cycle) => sum + cents(cycle.amount), 0);
  const spentCents = active.reduce((sum, cycle) => sum + cents(cycle.spent), 0);
  const projectedCents = active.reduce((sum, cycle) => sum + cents(cycle.projected), 0);

  return {
    startDate: active.reduce((latest, cycle) => cycle.startDate > latest ? cycle.startDate : latest, active[0].startDate),
    endDate: active.reduce((earliest, cycle) => cycle.endDate < earliest ? cycle.endDate : earliest, active[0].endDate),
    amount: amountCents / 100,
    spent: spentCents / 100,
    projected: projectedCents / 100,
    available: (amountCents - spentCents - projectedCents) / 100,
  };
}
