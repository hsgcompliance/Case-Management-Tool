export type BudgetCycle = {
  id: string;
  label?: string;
  startDate: string;
  endDate: string;
  amount: number;
  spent: number;
  projected: number;
};

export type ActiveCycleBudget = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  amount: number;
  spent: number;
  projected: number;
  available: number;
};

export type BudgetAvailabilityState = {
  lowFunds: boolean;
  unavailable: boolean;
  remainingPercent: number | null;
};

const cents = (value: unknown) => Math.round(Number(value || 0) * 100);

export function isDateInBudgetCycle(date: string, cycle: Pick<BudgetCycle, "startDate" | "endDate">) {
  const startDate = normalizeBudgetCycleDate(cycle.startDate);
  const endDate = normalizeBudgetCycleDate(cycle.endDate);
  return !!date && !!startDate && !!endDate && date >= startDate && date <= endDate;
}

/** Normalize date-only values without constructing a Date, which avoids timezone drift. */
export function normalizeBudgetCycleDate(value: unknown): string {
  const iso = String(value ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [year, month, day] = iso.split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return "";
  return iso;
}

/** Aggregate active goals so a grant-level card can represent all of its split line items. */
export function resolveActiveCycleBudget(cycles: BudgetCycle[], today: string): ActiveCycleBudget | null {
  const active = cycles.filter((cycle) => isDateInBudgetCycle(today, cycle));
  if (!active.length) return null;

  const amountCents = active.reduce((sum, cycle) => sum + cents(cycle.amount), 0);
  const spentCents = active.reduce((sum, cycle) => sum + cents(cycle.spent), 0);
  const projectedCents = active.reduce((sum, cycle) => sum + cents(cycle.projected), 0);

  return {
    id: active.length === 1 ? active[0].id : active.map((cycle) => cycle.id).join("+"),
    label: active.length === 1 ? active[0].label || "Current cycle" : "Current cycles",
    startDate: active.reduce((latest, cycle) => cycle.startDate > latest ? cycle.startDate : latest, active[0].startDate),
    endDate: active.reduce((earliest, cycle) => cycle.endDate < earliest ? cycle.endDate : earliest, active[0].endDate),
    amount: amountCents / 100,
    spent: spentCents / 100,
    projected: projectedCents / 100,
    available: (amountCents - spentCents - projectedCents) / 100,
  };
}

export function getBudgetAvailabilityState(input: {
  total: number;
  remaining: number;
  available: number;
}): BudgetAvailabilityState {
  const totalCents = cents(input.total);
  const remainingCents = cents(input.remaining);
  const availableCents = cents(input.available);
  const unavailable = remainingCents <= 0 && availableCents <= 0;
  const remainingPercent = totalCents > 0 ? availableCents / totalCents : null;
  return {
    unavailable,
    lowFunds: !unavailable && remainingPercent !== null && remainingPercent > 0 && remainingPercent <= 0.05,
    remainingPercent,
  };
}

export function findNextBudgetCycleStart(cycles: BudgetCycle[], activeEndDate: string): string | null {
  const end = normalizeBudgetCycleDate(activeEndDate);
  if (!end) return null;
  const starts = cycles
    .map((cycle) => normalizeBudgetCycleDate(cycle.startDate))
    .filter((start) => !!start && start > end)
    .sort();
  return starts[0] ?? null;
}
