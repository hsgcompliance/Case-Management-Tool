import { describe, expect, it } from "vitest";
import {
  buildPaymentEditorGrantInfo,
  buildPaymentEditorRows,
  buildPaymentEditorSavePlan,
  createPaymentEditorBaseline,
  getChangedPaymentEditorRowIds,
  makeBlankPaymentEditorRow,
  type PaymentEditorEnrollmentOption,
  type PaymentEditorRow,
} from "./paymentEditorLabAdapter";

const grant = {
  id: "grant_1",
  name: "YHDP RRH",
  code: "YHDP",
  budget: {
    lineItems: [
      { id: "rent_li", label: "Rental Assistance" },
      { id: "utility_li", label: "Utility Assistance" },
      { id: "service_li", label: "Supportive Services" },
    ],
  },
  invoicing: {
    invoiceCode: "INV-YHDP",
    grantCode: "YHDP-26",
    funder: "HUD",
    contractNumber: "C-2026",
    frequency: "Monthly",
    dueDayOfMonth: 10,
    submissionPortal: "Sage",
    notes: "Attach tracker.",
  },
};

const enrollment = {
  id: "enr_1",
  customerId: "cust_1",
  customerName: "Kevin Coyle",
  grantId: "grant_1",
  name: "Kevin Coyle - YHDP RRH",
  payments: [
    {
      id: "pay_rent",
      amount: 1200,
      dueDate: "2026-06-01",
      type: "monthly",
      lineItemId: "rent_li",
      note: ["sub:rent", "June rent"],
      vendor: "Bridger Apartments",
      paid: false,
      compliance: { hmisComplete: true, caseworthyComplete: true },
    },
    {
      id: "pay_utility",
      amount: 165,
      dueDate: "2026-06-10",
      type: "monthly",
      lineItemId: "utility_li",
      note: ["sub:utility", "June utility"],
      vendor: "NorthWestern Energy",
      paid: true,
      compliance: { hmisComplete: false, caseworthyComplete: true },
    },
  ],
};

function rows() {
  const grantsById = buildPaymentEditorGrantInfo([grant]);
  return buildPaymentEditorRows({ enrollments: [enrollment], grantsById });
}

function baseRow(patch: Partial<PaymentEditorRow> = {}): PaymentEditorRow {
  return {
    id: "enr_1:pay_rent",
    enrollmentId: "enr_1",
    customerId: "cust_1",
    customerName: "Kevin Coyle",
    grantId: "grant_1",
    grantName: "YHDP RRH",
    sourcePaymentId: "pay_rent",
    sourceIndex: 0,
    dueDate: "2026-06-01",
    typeKey: "monthly-rent",
    lineItemId: "rent_li",
    lineItemName: "Rental Assistance",
    amount: "1200",
    vendor: "Bridger Apartments",
    notes: "June rent",
    rentCertDue: false,
    complianceStatus: "data-entry-complete",
    paidStatus: "projected",
    originalPaidStatus: "projected",
    paid: false,
    source: "schedule",
    ...patch,
  };
}

describe("paymentEditorLabAdapter", () => {
  it("maps enrollment payments into flat sheet rows", () => {
    const result = rows();

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: "enr_1:pay_rent",
      enrollmentId: "enr_1",
      customerName: "Kevin Coyle",
      grantName: "YHDP RRH",
      lineItemId: "rent_li",
      notes: "June rent",
      paidStatus: "projected",
    });
  });

  it("detects monthly rent vs utility type from notes", () => {
    const result = rows();

    expect(result.find((row) => row.sourcePaymentId === "pay_rent")?.typeKey).toBe("monthly-rent");
    expect(result.find((row) => row.sourcePaymentId === "pay_utility")?.typeKey).toBe("monthly-utility");
  });

  it("maps compliance and paid status flags", () => {
    const result = rows();

    expect(result.find((row) => row.sourcePaymentId === "pay_rent")?.complianceStatus).toBe("data-entry-complete");
    expect(result.find((row) => row.sourcePaymentId === "pay_utility")).toMatchObject({
      complianceStatus: "caseworthy-only",
      paidStatus: "invoice-submitted",
      paid: true,
    });
  });

  it("maps grant invoice metadata", () => {
    const grantsById = buildPaymentEditorGrantInfo([grant]);

    expect(grantsById.get("grant_1")?.invoice).toMatchObject({
      invoiceCode: "INV-YHDP",
      grantCode: "YHDP-26",
      funder: "HUD",
      contractNumber: "C-2026",
      frequency: "Monthly",
      dueDayOfMonth: "10",
      submissionPortal: "Sage",
    });
  });

  it("does not mark a row changed after a value is changed back", () => {
    const row = baseRow({ amount: "1200.00" });
    const baseline = createPaymentEditorBaseline([row]);
    const editedBack = { ...row, amount: "1200" };

    expect(getChangedPaymentEditorRowIds(baseline, [editedBack]).size).toBe(0);
  });

  it("plans an added unpaid row as a projection addition", () => {
    const option: PaymentEditorEnrollmentOption = {
      id: "enr_1",
      label: "Kevin - YHDP",
      customerId: "cust_1",
      customerName: "Kevin Coyle",
      grantId: "grant_1",
      grantName: "YHDP RRH",
      statusLabel: "open",
      lineItems: [{ id: "rent_li", label: "Rental Assistance" }],
      rawEnrollment: {},
    };
    const newRow = {
      ...makeBlankPaymentEditorRow(option),
      dueDate: "2026-07-01",
      amount: "1250",
      lineItemId: "rent_li",
      lineItemName: "Rental Assistance",
    };
    const plan = buildPaymentEditorSavePlan(createPaymentEditorBaseline([]), [newRow]);

    expect(plan.validationErrors).toEqual([]);
    expect(plan.projectionAdjustments[0].projectionAdjustment?.additions?.[0]).toMatchObject({
      amount: 1250,
      dueDate: "2026-07-01",
      lineItemId: "rent_li",
      type: "monthly",
    });
  });

  it("plans unpaid schedule edits and deletes through projection adjustment", () => {
    const row = baseRow();
    const baseline = createPaymentEditorBaseline([row, baseRow({ id: "enr_1:pay_2", sourcePaymentId: "pay_2" })]);
    const edited = { ...row, amount: "1300", dueDate: "2026-06-05", vendor: "New Vendor" };
    const plan = buildPaymentEditorSavePlan(baseline, [edited]);

    expect(plan.projectionAdjustments).toHaveLength(1);
    expect(plan.projectionAdjustments[0].projectionAdjustment?.edits?.[0]).toMatchObject({
      paymentId: "pay_rent",
      amount: 1300,
      dueDate: "2026-06-05",
      vendor: "New Vendor",
    });
    expect(plan.projectionAdjustments[0].projectionAdjustment?.deleteIds).toEqual(["pay_2"]);
  });

  it("plans paid schedule edits through adjustment-safe path", () => {
    const row = baseRow({
      id: "enr_1:pay_paid",
      sourcePaymentId: "pay_paid",
      paid: true,
      paidStatus: "invoice-submitted",
      originalPaidStatus: "invoice-submitted",
    });
    const plan = buildPaymentEditorSavePlan(createPaymentEditorBaseline([row]), [{ ...row, amount: "1400" }]);

    expect(plan.paidAdjustments).toHaveLength(1);
    expect(plan.paidAdjustments[0].spendAdjustment).toMatchObject({
      paymentId: "pay_paid",
      newAmount: 1400,
      reason: "Payment sheet paid-row adjustment",
    });
  });

  it("blocks more than one paid schedule edit per save batch", () => {
    const first = baseRow({ id: "enr_1:paid_1", sourcePaymentId: "paid_1", paid: true, paidStatus: "invoice-submitted" });
    const second = baseRow({ id: "enr_1:paid_2", sourcePaymentId: "paid_2", paid: true, paidStatus: "invoice-submitted" });
    const plan = buildPaymentEditorSavePlan(
      createPaymentEditorBaseline([first, second]),
      [{ ...first, amount: "1300" }, { ...second, amount: "1400" }],
    );

    expect(plan.validationErrors).toContain("Only one paid row schedule edit can be saved at a time.");
  });

  it("plans projected to invoice submitted as a spend action", () => {
    const row = baseRow();
    const plan = buildPaymentEditorSavePlan(createPaymentEditorBaseline([row]), [
      { ...row, paidStatus: "invoice-submitted" },
    ]);

    expect(plan.spendPosts).toEqual([{ enrollmentId: "enr_1", paymentId: "pay_rent", note: row.notes, vendor: row.vendor }]);
  });

  it("plans compliance selection patches", () => {
    const row = baseRow({ complianceStatus: "hmis-only" });
    const plan = buildPaymentEditorSavePlan(createPaymentEditorBaseline([row]), [
      { ...row, complianceStatus: "data-entry-complete" },
    ]);

    expect(plan.compliancePatches).toEqual([
      {
        enrollmentId: "enr_1",
        paymentId: "pay_rent",
        patch: { hmisComplete: true, caseworthyComplete: true, status: "data-entry-complete" },
      },
    ]);
  });

  it("plans rent cert checkbox changes", () => {
    const row = baseRow({ rentCertDue: false });
    const plan = buildPaymentEditorSavePlan(createPaymentEditorBaseline([row]), [
      { ...row, rentCertDue: true },
    ]);

    expect(plan.rentCertPatches).toEqual([
      { enrollmentId: "enr_1", paymentId: "pay_rent", status: "due" },
    ]);
  });
});
