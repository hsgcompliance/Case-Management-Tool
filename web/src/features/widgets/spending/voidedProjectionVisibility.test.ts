import { describe, expect, it } from "vitest";
import { isVoidedProjection, shouldShowVoidedProjection } from "./voidedProjectionVisibility";

describe("invoicing voided projection visibility", () => {
  it("identifies only voided projection queue rows", () => {
    expect(isVoidedProjection("projection", "void")).toBe(true);
    expect(isVoidedProjection("projection", "pending", true)).toBe(true);
    expect(isVoidedProjection("invoice", "void")).toBe(false);
  });

  it("hides voided projections by default and permits explicit review", () => {
    expect(shouldShowVoidedProjection(true, false)).toBe(false);
    expect(shouldShowVoidedProjection(true, true)).toBe(true);
    expect(shouldShowVoidedProjection(false, false)).toBe(true);
  });
});
