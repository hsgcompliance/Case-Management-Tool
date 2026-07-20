import { describe, expect, it } from "vitest";
import { lineItemDisplayConfig, splitGoalsForDigest } from "./digestBudget";

describe("budget digest line-item configuration", () => {
  it("requires explicit opt-in while retaining explicit legacy true", () => {
    expect(lineItemDisplayConfig({}, { display: {} }).appearInDigest).toBe(false);
    expect(lineItemDisplayConfig({}, { display: { appearInDigest: true } }).appearInDigest).toBe(true);
    expect(lineItemDisplayConfig({}, { display: { appearInDigest: true, displayOnDigest: false } }).appearInDigest).toBe(false);
  });

  it("inherits a detailed grant display level when the line item has no override", () => {
    const grant = {budget: {digestDisplay: {mainDisplayLevel: "lineItem"}}};
    expect(lineItemDisplayConfig(grant, {display: {}}).appearInDigest).toBe(true);
    expect(lineItemDisplayConfig(grant, {display: {displayOnDigest: false}}).appearInDigest).toBe(false);
  });

  it("selects only the cycle intersecting the digest month", () => {
    const item = { display: { displayOnDigest: true, digestDisplayMode: "both" }, splitGoals: [
      { id: "jan", startDate: "2026-01-01", endDate: "2026-01-31" },
      { id: "feb", startDate: "2026-02-01", endDate: "2026-02-28" },
    ] };
    expect(splitGoalsForDigest(item, "2026-02").map((goal) => goal.id)).toEqual(["feb"]);
  });
});
