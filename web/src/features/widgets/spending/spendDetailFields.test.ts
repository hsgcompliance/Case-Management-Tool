import { describe, expect, it } from "vitest";
import {
  clusteredCategoryFields,
  clusteredPaymentFiles,
  clusteredTransactionAnswer,
  rawSubmissionAnswer,
} from "./spendDetailFields";

describe("payment modal clustered fields", () => {
  const item = {
    transactionFields: {
      "tx:program-operations-for": "Housing Operations",
      "tx:wioa-category": "Youth WIOA",
      "tx:path-category": "Outreach",
      "tx:future-funding-category": "Pilot Fund",
    },
    extractionGroup: {
      orderRange: [30, 45],
      fieldIds: {
        "tx:program-operations-for": "186",
        "tx:wioa-category": "312",
        "tx:path-category": "305",
        "tx:future-funding-category": "400",
      },
      fieldOrders: {
        "tx:wioa-category": 39,
        "tx:path-category": 40,
        "tx:future-funding-category": 41,
      },
    },
    rawAnswers: {
      "312": { order: 39, text: "WIOA Category", answer: "Youth WIOA" },
      "305": { order: 40, text: "PATH Category", answer: "Outreach" },
      "400": { order: 41, text: "Future Funding Category", answer: "Pilot Fund" },
      "401": { order: 42, type: "control_fileupload", answer: ["https://files.test/a.pdf", "https://files.test/b.pdf"] },
      "999": { order: 90, type: "control_fileupload", answer: ["https://files.test/wrong-transaction.pdf"] },
    },
    files: ["https://files.test/known.pdf"],
  };

  it("reads current tx keys while retaining legacy-key compatibility", () => {
    expect(clusteredTransactionAnswer(item, "Program Operations for:", ["programOperations"]))
      .toBe("Housing Operations");
    expect(clusteredTransactionAnswer({
      extractionGroup: { fieldIds: { programOperations: "289" } },
      rawAnswers: { "289": { answer: "Legacy Operations" } },
    }, "Program Operations for:", ["programOperations"]))
      .toBe("Legacy Operations");
  });

  it("renders filled current and future category fields in Jotform order", () => {
    expect(clusteredCategoryFields(item)).toEqual([
      { key: "tx:wioa-category", label: "WIOA Category", value: "Youth WIOA" },
      { key: "tx:path-category", label: "PATH Category", value: "Outreach" },
      { key: "tx:future-funding-category", label: "Future Funding Category", value: "Pilot Fund" },
    ]);
  });

  it("links normalized files and file uploads inside only this order window", () => {
    expect(clusteredPaymentFiles(item)).toEqual([
      "https://files.test/known.pdf",
      "https://files.test/a.pdf",
      "https://files.test/b.pdf",
    ]);
  });

  it("reads first-class global answers outside the transaction window", () => {
    expect(rawSubmissionAnswer({
      rawAnswers: { "101": { answer: { year: "2026", month: "8", day: "1" } } },
    }, ["101"])).toBe("2026-08-01");
  });
});
