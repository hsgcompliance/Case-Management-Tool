export type SplitMode = "none" | "fixed" | "monthly" | "quarterly" | "custom";

export type SplitGoal = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  amount: number;
  spent: number;
  projected: number;
  balance: number;
  projectedBalance: number;
};

export function moneyCents(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function moneyFromCents(value: number) {
  return value / 100;
}

function monthEnd(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).toISOString().slice(0, 10);
}

export function generateSplitGoals(mode: SplitMode, amount: number, startDate: string, endDate: string): SplitGoal[] {
  if (mode !== "monthly" && mode !== "quarterly") return [];
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  if (!startDate || !endDate || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const step = mode === "monthly" ? 1 : 3;
  const periods: Array<{ startDate: string; endDate: string }> = [];
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const finalCursor = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  while (cursor <= finalCursor && periods.length < 240) {
    const periodStart = cursor.toISOString().slice(0, 10) < startDate ? startDate : cursor.toISOString().slice(0, 10);
    const rawEnd = monthEnd(cursor.getUTCFullYear(), cursor.getUTCMonth() + step - 1);
    const periodEnd = rawEnd > endDate ? endDate : rawEnd;
    periods.push({ startDate: periodStart, endDate: periodEnd });
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + step, 1));
  }

  const totalCents = moneyCents(amount);
  const base = periods.length ? Math.trunc(totalCents / periods.length) : 0;
  let remainder = totalCents - base * periods.length;

  return periods.map((period, index) => {
    const extra = remainder > 0 ? 1 : remainder < 0 ? -1 : 0;
    remainder -= extra;
    const goalAmount = moneyFromCents(base + extra);
    return {
      id: `${mode}_${period.startDate}_${period.endDate}`,
      label: mode === "monthly" ? period.startDate.slice(0, 7) : `Q${index + 1}`,
      ...period,
      amount: goalAmount,
      spent: 0,
      projected: 0,
      balance: goalAmount,
      projectedBalance: goalAmount,
    };
  });
}
