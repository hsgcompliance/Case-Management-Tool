import { describe, expect, it } from "vitest";
import { formatUserOptionLabel, isUserOptionVisible } from "./userOptionState";

describe("user option state", () => {
  it("labels inactive users", () => {
    expect(formatUserOptionLabel({ uid: "old", label: "Former Staff", active: false }))
      .toBe("Former Staff — Inactive");
  });

  it("keeps a selected inactive user visible without offering other inactive users", () => {
    const inactive = { uid: "old", label: "Former Staff", active: false };
    expect(isUserOptionVisible(inactive, true, "old")).toBe(true);
    expect(isUserOptionVisible(inactive, true, "someone-else")).toBe(false);
    expect(isUserOptionVisible(inactive, false, null)).toBe(true);
  });
});
