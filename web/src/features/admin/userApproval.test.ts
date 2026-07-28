import { describe, expect, it } from "vitest";
import { isPendingUserApproval } from "./userApproval";

describe("isPendingUserApproval", () => {
  it("keeps unverified accounts in the approval flow", () => {
    expect(isPendingUserApproval("unverified")).toBe(true);
    expect(isPendingUserApproval("public_user")).toBe(true);
  });

  it("does not treat deactivated approved accounts as pending", () => {
    expect(isPendingUserApproval("user")).toBe(false);
    expect(isPendingUserApproval("viewer")).toBe(false);
    expect(isPendingUserApproval("admin")).toBe(false);
  });
});
