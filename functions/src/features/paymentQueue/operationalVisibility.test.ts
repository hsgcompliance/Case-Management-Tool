import { describe, expect, it } from "vitest";
import { isOperationalQueueGrantVisible, type OperationalGrantState } from "./operationalVisibility";

function states(rows: Array<[string, OperationalGrantState]>) {
  return new Map<string, OperationalGrantState>(rows);
}

describe("operational payment queue grant visibility", () => {
  it("filters known soft-deleted and closed grants", () => {
    const map = states([
      ["deleted", { exists: true, status: "deleted", deleted: true }],
      ["closed", { exists: true, status: "closed", deleted: false }],
    ]);
    expect(isOperationalQueueGrantVisible("deleted", map)).toBe(false);
    expect(isOperationalQueueGrantVisible("closed", map)).toBe(false);
  });

  it("keeps missing hard-deleted references visible for integrity review", () => {
    const map = states([["missing", { exists: false }]]);
    expect(isOperationalQueueGrantVisible("missing", map)).toBe(true);
    expect(isOperationalQueueGrantVisible("unknown-orphan", map)).toBe(true);
  });

  it("preserves unassigned and currently reassigned active transactions", () => {
    const map = states([
      ["former-test", { exists: true, status: "deleted", deleted: true }],
      ["current-production", { exists: true, status: "active", deleted: false }],
    ]);
    expect(isOperationalQueueGrantVisible(null, map)).toBe(true);
    expect(isOperationalQueueGrantVisible("current-production", map)).toBe(true);
  });
});
