import { describe, expect, it } from "vitest";
import {
  findNextBudgetCycleStart,
  getBudgetAvailabilityState,
  resolveActiveCycleBudget,
  type BudgetCycle,
} from "./budgetCardModel";

const cycles: BudgetCycle[] = [
  { id: "before", startDate: "2026-04-01", endDate: "2026-06-30", amount: 1000, spent: 900, projected: 50 },
  { id: "active", startDate: "2026-07-01", endDate: "2026-09-30", amount: 11816, spent: 1200, projected: 300 },
  { id: "after", startDate: "2026-10-01", endDate: "2026-12-31", amount: 2000, spent: 0, projected: 800 },
];

describe("resolveActiveCycleBudget", () => {
  it("uses the cycle containing today and excludes spent/projected amounts outside it", () => {
    expect(resolveActiveCycleBudget(cycles, "2026-07-08")).toEqual({
      id: "active",
      label: "Current cycle",
      startDate: "2026-07-01",
      endDate: "2026-09-30",
      amount: 11816,
      spent: 1200,
      projected: 300,
      available: 10316,
    });
  });

  it("rejects a malformed persisted cycle year", () => {
    expect(resolveActiveCycleBudget([
      { id: "bad", startDate: "2026-07-01", endDate: "0002-09-30", amount: 11816, spent: 0, projected: 0 },
    ], "2026-07-08")).toBeNull();
  });

  it("returns null when no split cycle contains today", () => {
    expect(resolveActiveCycleBudget(cycles, "2027-01-01")).toBeNull();
  });

  it("aggregates active cycles across grant line items using cent-safe arithmetic", () => {
    expect(resolveActiveCycleBudget([
      ...cycles,
      { id: "active-2", startDate: "2026-07-01", endDate: "2026-09-30", amount: 100.1, spent: 10.05, projected: 20.05 },
    ], "2026-07-08")).toMatchObject({ amount: 11916.1, spent: 1210.05, projected: 320.05, available: 10386 });
  });
});

describe("getBudgetAvailabilityState", () => {
  it("marks a full budget with 5% available as low funds", () => {
    expect(getBudgetAvailabilityState({ total: 10000, remaining: 500, available: 500 })).toMatchObject({
      lowFunds: true,
      unavailable: false,
    });
  });

  it("marks a full budget with no remaining or available funds as unavailable", () => {
    expect(getBudgetAvailabilityState({ total: 10000, remaining: 0, available: 0 })).toMatchObject({
      lowFunds: false,
      unavailable: true,
    });
  });

  it("uses the supplied active-cycle values independently of the grant total", () => {
    expect(getBudgetAvailabilityState({ total: 11816, remaining: 0, available: 0 })).toMatchObject({
      unavailable: true,
    });
    expect(getBudgetAvailabilityState({ total: 11816, remaining: 500, available: 500 })).toMatchObject({
      lowFunds: true,
    });
  });
});

describe("findNextBudgetCycleStart", () => {
  it("returns the next release date after the active cycle", () => {
    expect(findNextBudgetCycleStart(cycles, "2026-09-30")).toBe("2026-10-01");
  });

  it("omits a release date after the final cycle", () => {
    expect(findNextBudgetCycleStart(cycles, "2026-12-31")).toBeNull();
  });
});
