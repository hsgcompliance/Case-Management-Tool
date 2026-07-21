import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));

vi.mock("./api", () => ({
  default: {
    get: apiGet,
    call: vi.fn(),
    callIdem: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("@lib/idem", () => ({ idemKey: vi.fn(() => "idem") }));

describe("Enrollments pagination", () => {
  beforeEach(() => apiGet.mockReset());

  it("uses stable timestamp and id cursors for requests larger than one server page", async () => {
    const { Enrollments } = await import("./enrollments");
    const firstPage = Array.from({ length: 500 }, (_, index) => ({ id: `first-${index}` }));
    const secondPage = Array.from({ length: 500 }, (_, index) => ({ id: `second-${index}` }));
    apiGet
      .mockResolvedValueOnce({ items: firstPage, next: "1", nextCursor: { cursorUpdatedAt: 100, cursorId: "1" } })
      .mockResolvedValueOnce({ items: secondPage, next: "2", nextCursor: { cursorUpdatedAt: 90, cursorId: "2" } })
      .mockResolvedValueOnce({ items: [{ id: "last" }], next: null, nextCursor: null });

    const rows = await Enrollments.list({ active: true, limit: 1_200 });

    expect(rows).toHaveLength(1_001);
    expect(rows.at(-1)?.id).toBe("last");
    expect(apiGet).toHaveBeenNthCalledWith(1, "enrollmentsList", { active: true, limit: 500 });
    expect(apiGet).toHaveBeenNthCalledWith(2, "enrollmentsList", {
      active: true,
      limit: 500,
      startAfter: undefined,
      cursorUpdatedAt: 100,
      cursorId: "1",
    });
    expect(apiGet).toHaveBeenNthCalledWith(3, "enrollmentsList", {
      active: true,
      limit: 200,
      startAfter: undefined,
      cursorUpdatedAt: 90,
      cursorId: "2",
    });
  });

  it("keeps legacy document-id pagination working", async () => {
    const { Enrollments } = await import("./enrollments");
    const firstPage = Array.from({ length: 500 }, (_, index) => ({ id: `first-${index}` }));
    apiGet
      .mockResolvedValueOnce({ items: firstPage, next: "1" })
      .mockResolvedValueOnce({ items: [{ id: "2" }], next: null });

    await Enrollments.list({ limit: 600 });

    expect(apiGet).toHaveBeenNthCalledWith(2, "enrollmentsList", {
      limit: 100,
      startAfter: "1",
      cursorUpdatedAt: undefined,
      cursorId: undefined,
    });
  });

  it("honors listAll maxItems below one full server page", async () => {
    const { Enrollments } = await import("./enrollments");
    apiGet.mockResolvedValueOnce({ items: [{ id: "1" }], next: null, nextCursor: null });

    await Enrollments.listAll({ active: true }, { maxItems: 25 });

    expect(apiGet).toHaveBeenCalledWith("enrollmentsList", {
      active: true,
      limit: 25,
      startAfter: undefined,
      cursorUpdatedAt: undefined,
      cursorId: undefined,
    });
  });
});
