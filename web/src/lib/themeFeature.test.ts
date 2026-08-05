import { describe, expect, it } from "vitest";
import { isDarkModeFeatureEnabled } from "./themeFeature";

describe("dark-mode feature gate", () => {
  it("defaults to disabled", () => {
    expect(isDarkModeFeatureEnabled(undefined)).toBe(false);
    expect(isDarkModeFeatureEnabled("")).toBe(false);
    expect(isDarkModeFeatureEnabled("false")).toBe(false);
  });

  it.each(["1", "true", "TRUE", "yes", "on"])("accepts %s as enabled", (value) => {
    expect(isDarkModeFeatureEnabled(value)).toBe(true);
  });
});
