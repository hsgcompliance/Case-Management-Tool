import { describe, expect, it } from "vitest";
import { inferTransactionWindowModel, type TransactionQuestionField } from "@hdb/contracts";

function field(
  order: number,
  label: string,
  rawType: string,
  type: TransactionQuestionField["type"],
  rawFieldId = String(order),
): TransactionQuestionField {
  return {
    rawFieldId,
    label,
    rawType,
    type,
    logicType: type === "select" ? "dropdown" : type,
    typeLabel: type,
    order,
  };
}

function cardFields(extraEverywhere = false, driftOnlyFirst = false): TransactionQuestionField[] {
  const out: TransactionQuestionField[] = [];
  for (let i = 0; i < 3; i++) {
    const base = i * 10;
    out.push(
      field(base + 1, `Transaction ${i + 1}`, "control_text", "text", `h${i}`),
      field(base + 2, "Merchant", "control_textbox", "text", `m${i}`),
      ...(extraEverywhere || (driftOnlyFirst && i === 0)
        ? [field(base + 3, "Funding Tag", "control_textbox", "text", `f${i}`)]
        : []),
      field(base + 4, "Cost", "control_textbox", "text", `c${i}`),
    );
  }
  out.push(field(99, "RETURN DOCUMENTATION", "control_head", "text", "return"));
  return out;
}

function invoiceFields(): TransactionQuestionField[] {
  return [
    field(1, "Project", "control_dropdown", "select", "p1"),
    field(2, "Other", "control_textbox", "text", "o1"),
    field(3, "Amount to bill", "control_number", "number", "a1"),
    field(4, "Divider", "control_divider", "text", "d1"),
    field(5, "Project", "control_dropdown", "select", "p2"),
    field(6, "Other", "control_textbox", "text", "o2"),
    field(7, "Amount to bill", "control_number", "number", "a2"),
    field(8, "Divider", "control_divider", "text", "d2"),
    field(9, "Project", "control_dropdown", "select", "p3"),
    field(10, "Other", "control_textbox", "text", "o3"),
    field(11, "Amount to bill", "control_number", "number", "a3"),
    field(12, "Divider", "control_divider", "text", "d3"),
    field(13, "Staff Email", "control_email", "text", "email"),
    field(14, "Bill To", "control_dropdown", "select", "b1"),
    field(15, "Other", "control_textbox", "text", "bo1"),
    field(16, "Amount to bill", "control_number", "number", "ba1"),
    field(17, "Divider", "control_divider", "text", "d4"),
    field(18, "Bill To", "control_dropdown", "select", "b2"),
    field(19, "Other", "control_textbox", "text", "bo2"),
    field(20, "Amount to bill", "control_number", "number", "ba2"),
    field(21, "Divider", "control_divider", "text", "d5"),
    field(22, "Bill To", "control_dropdown", "select", "b3"),
    field(23, "Other", "control_textbox", "text", "bo3"),
    field(24, "Amount to bill", "control_number", "number", "ba3"),
  ];
}

describe("transaction window inference", () => {
  it("adds a repeated card field automatically", () => {
    const model = inferTransactionWindowModel("251878265158166", cardFields(true));
    expect(model.fields.map((entry) => entry.label)).toContain("Funding Tag");
    expect(model.windows).toHaveLength(3);
  });

  it("fails when only one card transaction window drifts", () => {
    expect(() =>
      inferTransactionWindowModel("251878265158166", cardFields(false, true)),
    ).toThrow(/does not match/i);
  });

  it("combines invoice customer and program halves into one logical transaction model", () => {
    const model = inferTransactionWindowModel("252674777246167", invoiceFields());
    expect(model.windows).toHaveLength(3);
    expect(model.fields.map((entry) => entry.label)).toEqual([
      "Project",
      "Other",
      "Amount to bill",
      "Bill To",
    ]);
  });
});
