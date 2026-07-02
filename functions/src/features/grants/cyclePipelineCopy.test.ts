import { describe, expect, it } from "vitest";
import { buildCyclePipelineCopy, cyclePipelineCopyId } from "./cyclePipelineCopy";

describe("grant cycle pipeline copy", () => {
  it("uses a deterministic target-specific id", () => {
    expect(cyclePipelineCopyId("source", "next")).toBe(cyclePipelineCopyId("source", "next"));
  });

  it("copies configuration without transaction data", () => {
    const copy = buildCyclePipelineCopy("p1", { grantId: "old", name: "Pipeline", includeGroups: [{ id: "g" }], transactionIds: ["tx1"] }, "new", "org");
    expect(copy).toMatchObject({ grantId: "new", copiedFromPipelineId: "p1", copiedFromGrantId: "old", name: "Pipeline" });
    expect(copy).not.toHaveProperty("transactionIds");
  });
});
