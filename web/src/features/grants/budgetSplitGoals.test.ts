import { describe, expect, it } from "vitest";
import { generateSplitGoals, moneyCents } from "./budgetSplitGoals";

describe("generateSplitGoals", () => {
  it("evenly generates monthly split goals and preserves total cents", () => {
    const goals = generateSplitGoals("monthly", 12000, "2026-01-01", "2026-12-31");

    expect(goals).toHaveLength(12);
    expect(goals[0]).toMatchObject({
      id: "monthly_2026-01-01_2026-01-31",
      label: "2026-01",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      amount: 1000,
      balance: 1000,
      projectedBalance: 1000,
    });
    expect(goals.at(-1)).toMatchObject({
      id: "monthly_2026-12-01_2026-12-31",
      label: "2026-12",
      amount: 1000,
    });
    expect(goals.reduce((sum, goal) => sum + moneyCents(goal.amount), 0)).toBe(1200000);
  });

  it("generates quarterly split goals clipped to the configured date window", () => {
    const goals = generateSplitGoals("quarterly", 12000, "2026-01-15", "2026-08-20");

    expect(goals).toHaveLength(3);
    expect(goals.map((goal) => [goal.label, goal.startDate, goal.endDate, goal.amount])).toEqual([
      ["Q1", "2026-01-15", "2026-03-31", 4000],
      ["Q2", "2026-04-01", "2026-06-30", 4000],
      ["Q3", "2026-07-01", "2026-08-20", 4000],
    ]);
    expect(goals.reduce((sum, goal) => sum + moneyCents(goal.amount), 0)).toBe(1200000);
  });

  it("allocates remainder cents without changing the parent line item total", () => {
    const goals = generateSplitGoals("monthly", 100, "2026-01-01", "2026-03-31");

    expect(goals.map((goal) => moneyCents(goal.amount))).toEqual([3334, 3333, 3333]);
    expect(goals.reduce((sum, goal) => sum + moneyCents(goal.amount), 0)).toBe(10000);
  });

  it("returns no generated rows for unsupported modes or invalid windows", () => {
    expect(generateSplitGoals("fixed", 1000, "2026-01-01", "2026-12-31")).toEqual([]);
    expect(generateSplitGoals("monthly", 1000, "2026-12-31", "2026-01-01")).toEqual([]);
  });
});
