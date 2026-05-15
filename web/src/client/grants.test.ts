import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiGet } = vi.hoisted(() => ({
  apiGet: vi.fn(),
}));

vi.mock("./api", () => ({
  default: {
    get: apiGet,
    callIdem: vi.fn(),
  },
}));

vi.mock("@lib/idem", () => ({
  idemKey: vi.fn(() => "idem"),
}));

describe("Grants.activity", () => {
  beforeEach(() => {
    apiGet.mockReset();
  });

  it("fetches every activity page until next cursor is exhausted", async () => {
    const { Grants } = await import("./grants");
    apiGet
      .mockResolvedValueOnce({
        ok: true,
        items: [{ id: "ledger:1" }],
        next: { cursor: "1" },
      })
      .mockResolvedValueOnce({
        ok: true,
        items: [{ id: "queue:2" }],
        next: null,
      });

    const rows = await Grants.activity({ grantId: "grant-1", limit: 1000 } as any);

    expect(rows.map((row) => row.id)).toEqual(["ledger:1", "queue:2"]);
    expect(apiGet).toHaveBeenNthCalledWith(1, "grantsActivity", { grantId: "grant-1", limit: 1000 });
    expect(apiGet).toHaveBeenNthCalledWith(2, "grantsActivity", { grantId: "grant-1", limit: 1000, cursor: "1" });
  });

  it("stops at the configured max item count", async () => {
    const { Grants } = await import("./grants");
    apiGet.mockResolvedValueOnce({
      ok: true,
      items: [{ id: "ledger:1" }],
      next: { cursor: "1" },
    });

    const rows = await Grants.activity({ grantId: "grant-1", limit: 1000 } as any, { maxItems: 1 });

    expect(rows.map((row) => row.id)).toEqual(["ledger:1"]);
    expect(apiGet).toHaveBeenCalledTimes(1);
  });
});
