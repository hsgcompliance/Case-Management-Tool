import { describe, expect, it } from "vitest";
import { parsePinnedBudgetGroupKeys, sortPinnedBudgetGroups } from "./budgetGroupPinModel";

describe("budget group pins", () => {
  it("parses and deduplicates keys from user extras", () => {
    expect(parsePinnedBudgetGroupKeys({ grantPrefs: { pinnedBudgetGroupKeys: ["b", "a", "b", ""] } })).toEqual(["b", "a"]);
  });

  it("sorts pinned groups first while preserving relative order", () => {
    const groups = [{ key: "a" }, { key: "b" }, { key: "c" }, { key: "d" }];
    expect(sortPinnedBudgetGroups(groups, ["c", "b"]).map((group) => group.key)).toEqual(["b", "c", "a", "d"]);
  });
});
