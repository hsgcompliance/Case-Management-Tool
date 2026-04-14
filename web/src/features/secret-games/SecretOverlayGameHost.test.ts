import { describe, expect, it } from "vitest";
import { createOverlayMountContext } from "./SecretOverlayGameHost";

describe("SecretOverlayGameHost helpers", () => {
  it("builds overlay mount context from viewport size", () => {
    expect(
      createOverlayMountContext({
        availableWidth: 1280,
        availableHeight: 720,
      }),
    ).toEqual({
      routeKind: "overlay-host",
      availableWidth: 1280,
      availableHeight: 720,
      featureFlags: {},
    });
  });
});
