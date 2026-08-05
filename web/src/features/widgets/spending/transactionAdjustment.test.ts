import { describe, expect, it } from "vitest";
import { buildTransactionAdjustmentPatch } from "./transactionAdjustment";

describe("buildTransactionAdjustmentPatch", () => {
  it("allows an adjusted transaction to remain unassigned", () => {
    expect(buildTransactionAdjustmentPatch({
      amount: 42.5,
      amountCents: 4250,
      dueDate: "2026-07-14",
      grantId: null,
      lineItemId: null,
      comment: "Corrected source date",
    })).toEqual(expect.objectContaining({
      amount: 42.5,
      amountAbs: 42.5,
      direction: "charge",
      dueDate: "2026-07-14",
      grantId: null,
      lineItemId: null,
      okUnassigned: true,
      localModificationReason: "Corrected source date",
    }));
  });

  it("preserves grant-only assignments for eligibility review", () => {
    expect(buildTransactionAdjustmentPatch({
      amount: -18,
      amountCents: -1800,
      dueDate: "2026-06-29T23:30:00-06:00",
      grantId: "path-26-27",
      lineItemId: null,
    })).toEqual(expect.objectContaining({
      amount: -18,
      amountAbs: 18,
      direction: "return",
      dueDate: "2026-06-29",
      grantId: "path-26-27",
      lineItemId: null,
      okUnassigned: false,
    }));
  });
});
