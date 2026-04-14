type AnyObj = Record<string, unknown>;

export const LINE_ITEMS_FORM_IDS = {
  creditCard: "251878265158166",
  invoice: "252674777246167",
} as const;

export const CC_SCHEMA = {
  globals: {
    cardChoice: "33",
    cardUsed: "219",
    purchaserName: "55",
    email: "56",
    returnDateTime: "28",
    checkoutDateTime: "101",
    txnCount: "93",
    uploadAllTxn1: "70",
  },
  transactions: [
    { merchant: "82", expenseType: "84", purpose: "85", cost: "86", supportiveProgram: "169", programOperations: "174", customerName: "156", notes: "151", files: ["70"], flexToggle: "204" },
    { merchant: "182", expenseType: "183", purpose: "106", cost: "107", supportiveProgram: "184", programOperations: "186", customerName: "185", notes: "143", files: ["109"], flexToggle: "205" },
    { merchant: "187", expenseType: "188", purpose: "114", cost: "115", supportiveProgram: "189", programOperations: "191", customerName: "190", notes: "147", files: ["117"], flexToggle: "206" },
    { merchant: "192", expenseType: "193", purpose: "122", cost: "123", supportiveProgram: "194", programOperations: "196", customerName: "195", notes: null, files: ["125"], flexToggle: "207" },
    { merchant: "197", expenseType: "198", purpose: "130", cost: "131", supportiveProgram: "199", programOperations: "201", customerName: "200", notes: null, files: ["133"], flexToggle: "208" },
  ],
} as const;

export const INVOICE_SCHEMA = {
  globals: {
    invoiceDate: "31",
    submissionDate: "4",
    purchaser: "33",
    expenseType: "34",
    vendor: "74",
    paymentMethod: "95",
    email: "25",
    purposeDetail: "75",
    note: "111",
    firstName: "84",
    lastName: "85",
    serviceType: "53",
    otherService: "155",
    wioaScopeWex: "134",
    costSingle: "17",
    files: {
      receipt: "7",
      required: "28",
      agenda: "29",
      w9: "156",
    },
  },
  customerPath: {
    multiToggle: "114",
    splitCount: "115",
    projects: ["55", "120", "121", "122", "123"],
    projectOther: ["154", "153", "152", "151", "150"],
    amounts: ["124", "125", "126", "127", "128"],
  },
  programPath: {
    multiToggle: "114",
    splitCount: "115",
    billToList: ["112", "116", "117", "118", "119"],
    billToOther: ["149", "148", "147", "146", "110"],
    amounts: ["129", "130", "131", "132", "133"],
  },
} as const;

export function isLineItemsFormId(formId: unknown): boolean {
  const id = String(formId || "").trim();
  return id === LINE_ITEMS_FORM_IDS.creditCard || id === LINE_ITEMS_FORM_IDS.invoice;
}

export function isInvoiceFormId(formId: unknown): boolean {
  return String(formId || "").trim() === LINE_ITEMS_FORM_IDS.invoice;
}

function asText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const obj = value as AnyObj;
    if ("answer" in obj) return asText(obj.answer);
    if ("prettyFormat" in obj) return asText(obj.prettyFormat);
    if ("value" in obj) return asText(obj.value);
    return Object.values(obj).map(asText).filter(Boolean).join(" ");
  }
  return "";
}

function parseMoney(value: unknown): number {
  const s = asText(value).replace(/[^0-9.-]/g, "");
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function parseYes(value: unknown): boolean {
  return /^(y|yes|true)\b/i.test(asText(value));
}

export function getAns(answers: AnyObj, id: string | null | undefined): unknown {
  if (!id) return "";
  return (answers?.[id] as AnyObj | undefined) || "";
}

export function lineItemsFormKind(submission: AnyObj): "credit-card" | "invoice" | null {
  const formId = String(submission?.formId || submission?.form_id || "").trim();
  if (formId === LINE_ITEMS_FORM_IDS.creditCard) return "credit-card";
  if (formId === LINE_ITEMS_FORM_IDS.invoice) return "invoice";

  const aliasBlob = `${String(submission?.formAlias || "")} ${String(submission?.formTitle || "")}`.toLowerCase();
  if (/(credit|card|checkout)/.test(aliasBlob)) return "credit-card";
  if (/invoice/.test(aliasBlob)) return "invoice";
  return null;
}

export function lineItemsAmountEstimate(submission: AnyObj): number {
  const kind = lineItemsFormKind(submission);
  const answers = ((submission?.answers || {}) as AnyObj) || {};
  if (kind === "credit-card") {
    let total = 0;
    for (const tx of CC_SCHEMA.transactions) total += parseMoney(getAns(answers, tx.cost));
    return total;
  }
  if (kind === "invoice") {
    const expenseType = asText(getAns(answers, INVOICE_SCHEMA.globals.expenseType)).toLowerCase();
    if (expenseType.includes("for a customer")) {
      const splits = INVOICE_SCHEMA.customerPath.amounts.map((id) => parseMoney(getAns(answers, id)));
      const splitTotal = splits.reduce((a, b) => a + b, 0);
      return splitTotal > 0 ? splitTotal : parseMoney(getAns(answers, INVOICE_SCHEMA.globals.costSingle));
    }
    const splits = INVOICE_SCHEMA.programPath.amounts.map((id) => parseMoney(getAns(answers, id)));
    const splitTotal = splits.reduce((a, b) => a + b, 0);
    return splitTotal > 0 ? splitTotal : parseMoney(getAns(answers, INVOICE_SCHEMA.globals.costSingle));
  }
  return 0;
}

export function lineItemsCounterparty(submission: AnyObj): string {
  const kind = lineItemsFormKind(submission);
  const answers = ((submission?.answers || {}) as AnyObj) || {};
  if (kind === "credit-card") {
    const purchaser = asText(getAns(answers, CC_SCHEMA.globals.purchaserName));
    if (purchaser) return purchaser;
  }
  if (kind === "invoice") {
    const vendor = asText(getAns(answers, INVOICE_SCHEMA.globals.vendor));
    if (vendor) return vendor;
    const first = asText(getAns(answers, INVOICE_SCHEMA.globals.firstName));
    const last = asText(getAns(answers, INVOICE_SCHEMA.globals.lastName));
    const customer = [first, last].filter(Boolean).join(" ");
    if (customer) return customer;
  }
  return "";
}

export type LineItemsCardData = {
  kind: "credit-card" | "invoice";
  title: string;
  rows: Array<{ label: string; value: string }>;
  blocks: Array<{ title: string; rows: Array<{ label: string; value: string }> }>;
};

export function buildLineItemsCardData(submission: AnyObj): LineItemsCardData | null {
  const kind = lineItemsFormKind(submission);
  if (!kind) return null;
  const answers = ((submission?.answers || {}) as AnyObj) || {};

  if (kind === "credit-card") {
    const card = asText(getAns(answers, CC_SCHEMA.globals.cardUsed)) || asText(getAns(answers, CC_SCHEMA.globals.cardChoice));
    const hasAnyFlex = CC_SCHEMA.transactions.some((tx) => parseYes(getAns(answers, tx.flexToggle)));
    const fileCount = CC_SCHEMA.transactions.reduce((acc, tx) => {
      const values = (tx.files || []).map((id) => getAns(answers, id));
      const count = values
        .flatMap((v) => (Array.isArray(v) ? v : [v]))
        .map((v) => asText(v))
        .filter(Boolean).length;
      return acc + count;
    }, 0);
    const rows = [
      { label: "Card Used", value: card || "-" },
      { label: "Purchaser", value: asText(getAns(answers, CC_SCHEMA.globals.purchaserName)) || "-" },
      { label: "Email", value: asText(getAns(answers, CC_SCHEMA.globals.email)) || "-" },
      { label: "Checkout Time", value: asText(getAns(answers, CC_SCHEMA.globals.checkoutDateTime)) || "-" },
      { label: "Return Time", value: asText(getAns(answers, CC_SCHEMA.globals.returnDateTime)) || "-" },
      { label: "Flex Tagged", value: hasAnyFlex ? "Yes" : "No" },
      { label: "Uploaded Files", value: String(fileCount) },
      { label: "Estimated Total", value: `$${lineItemsAmountEstimate(submission).toFixed(2)}` },
    ];
    const blocks = CC_SCHEMA.transactions
      .map((tx, idx) => {
        const amount = parseMoney(getAns(answers, tx.cost));
        const merchant = asText(getAns(answers, tx.merchant));
        const expenseType = asText(getAns(answers, tx.expenseType));
        const purpose = asText(getAns(answers, tx.purpose));
        const program = asText(getAns(answers, tx.supportiveProgram)) || asText(getAns(answers, tx.programOperations));
        const customer = asText(getAns(answers, tx.customerName));
        const notes = tx.notes ? asText(getAns(answers, tx.notes)) : "";
        const isFlex = parseYes(getAns(answers, tx.flexToggle));
        const fileCount = (tx.files || [])
          .map((id) => getAns(answers, id))
          .flatMap((v) => (Array.isArray(v) ? v : [v]))
          .map((v) => asText(v))
          .filter(Boolean).length;
        const hasCore = amount > 0 || merchant || expenseType || purpose || program || customer || notes || isFlex || fileCount > 0;
        if (!hasCore) return null;
        return {
          title: `Transaction ${idx + 1}`,
          rows: [
            { label: "Merchant", value: merchant || "-" },
            { label: "Expense Type", value: expenseType || "-" },
            { label: "Purpose", value: purpose || "-" },
            { label: "Program", value: program || "-" },
            { label: "Customer", value: customer || "-" },
            { label: "Amount", value: `$${amount.toFixed(2)}` },
            { label: "Flex", value: isFlex ? "Yes" : "No" },
            { label: "Files", value: fileCount ? String(fileCount) : "-" },
            { label: "Notes", value: notes || "-" },
          ],
        };
      })
      .filter(Boolean) as LineItemsCardData["blocks"];
    return { kind, title: "Line Items Card Checkout", rows, blocks };
  }

  const expenseType = asText(getAns(answers, INVOICE_SCHEMA.globals.expenseType));
  const serviceType = asText(getAns(answers, INVOICE_SCHEMA.globals.serviceType));
  const wioaScope = asText(getAns(answers, INVOICE_SCHEMA.globals.wioaScopeWex));
  const rows = [
    { label: "Vendor", value: asText(getAns(answers, INVOICE_SCHEMA.globals.vendor)) || "-" },
    { label: "Purchaser", value: asText(getAns(answers, INVOICE_SCHEMA.globals.purchaser)) || "-" },
    { label: "Expense Type", value: expenseType || "-" },
    { label: "Service Type", value: serviceType || "-" },
    { label: "WIOA Scope/WEX", value: wioaScope || "-" },
    { label: "Payment Method", value: asText(getAns(answers, INVOICE_SCHEMA.globals.paymentMethod)) || "-" },
    { label: "Purpose", value: asText(getAns(answers, INVOICE_SCHEMA.globals.purposeDetail)) || "-" },
    { label: "Estimated Total", value: `$${lineItemsAmountEstimate(submission).toFixed(2)}` },
  ];

  const fileCount = Object.values(INVOICE_SCHEMA.globals.files)
    .map((id) => getAns(answers, id))
    .flatMap((v) => (Array.isArray(v) ? v : [v]))
    .map((v) => asText(v))
    .filter(Boolean).length;
  rows.splice(rows.length - 1, 0, { label: "Uploaded Files", value: String(fileCount) });

  const customerSplits = INVOICE_SCHEMA.customerPath.amounts
    .map((amountId, idx) => {
      const amount = parseMoney(getAns(answers, amountId));
      const project = asText(getAns(answers, INVOICE_SCHEMA.customerPath.projects[idx]));
      const projectOther = asText(getAns(answers, INVOICE_SCHEMA.customerPath.projectOther[idx]));
      const label = project && !/other/i.test(project) ? project : projectOther || project;
      if (!label && amount <= 0) return null;
      return { title: `Customer Split ${idx + 1}`, rows: [{ label: "Project/Program", value: label || "-" }, { label: "Amount", value: `$${amount.toFixed(2)}` }] };
    })
    .filter(Boolean) as LineItemsCardData["blocks"];

  const programSplits = INVOICE_SCHEMA.programPath.amounts
    .map((amountId, idx) => {
      const amount = parseMoney(getAns(answers, amountId));
      const billTo = asText(getAns(answers, INVOICE_SCHEMA.programPath.billToList[idx]));
      const billToOther = asText(getAns(answers, INVOICE_SCHEMA.programPath.billToOther[idx]));
      const label = billTo && !/other/i.test(billTo) ? billTo : billToOther || billTo;
      if (!label && amount <= 0) return null;
      return { title: `Program Split ${idx + 1}`, rows: [{ label: "Bill To", value: label || "-" }, { label: "Amount", value: `$${amount.toFixed(2)}` }] };
    })
    .filter(Boolean) as LineItemsCardData["blocks"];

  const isCustomerPath = /for a customer/i.test(expenseType);
  const multiToggle = isCustomerPath
    ? parseYes(getAns(answers, INVOICE_SCHEMA.customerPath.multiToggle))
    : parseYes(getAns(answers, INVOICE_SCHEMA.programPath.multiToggle));
  rows.splice(rows.length - 1, 0, { label: "Multi-Split", value: multiToggle ? "Yes" : "No" });

  return {
    kind,
    title: "Line Items Invoice",
    rows,
    blocks: customerSplits.length ? customerSplits : programSplits,
  };
}

export function buildLineItemsDigestTemplate(input: {
  formId: string;
  formTitle?: string | null;
  formAlias?: string | null;
}): AnyObj | null {
  const formId = String(input.formId || "").trim();
  if (!isLineItemsFormId(formId)) return null;

  if (formId === LINE_ITEMS_FORM_IDS.creditCard) {
    const sections = [
      { id: "summary", label: "Summary", show: true, order: 0 },
      { id: "tx_1", label: "Transaction 1", show: true, order: 1 },
      { id: "tx_2", label: "Transaction 2", show: true, order: 2 },
      { id: "tx_3", label: "Transaction 3", show: true, order: 3 },
      { id: "tx_4", label: "Transaction 4", show: true, order: 4 },
      { id: "tx_5", label: "Transaction 5", show: true, order: 5 },
    ];

    const fields: AnyObj[] = [
      { key: CC_SCHEMA.globals.cardUsed, label: "Card Used", questionLabel: "Card Used", type: "question", sectionId: "summary", show: true, hideIfEmpty: true, order: 1 },
      { key: CC_SCHEMA.globals.cardChoice, label: "Card Choice", questionLabel: "Card Choice", type: "question", sectionId: "summary", show: true, hideIfEmpty: true, order: 2 },
      { key: CC_SCHEMA.globals.purchaserName, label: "Purchaser", questionLabel: "Purchaser Name", type: "question", sectionId: "summary", show: true, hideIfEmpty: true, order: 3 },
      { key: CC_SCHEMA.globals.email, label: "Email", questionLabel: "Email", type: "question", sectionId: "summary", show: true, hideIfEmpty: true, order: 4 },
      { key: CC_SCHEMA.globals.checkoutDateTime, label: "Checkout Time", questionLabel: "Checkout Time", type: "question", sectionId: "summary", show: true, hideIfEmpty: true, order: 5 },
      { key: CC_SCHEMA.globals.returnDateTime, label: "Return Time", questionLabel: "Return Time", type: "question", sectionId: "summary", show: true, hideIfEmpty: true, order: 6 },
      { key: CC_SCHEMA.globals.txnCount, label: "Transaction Count", questionLabel: "Transaction Count", type: "question", sectionId: "summary", show: true, hideIfEmpty: true, order: 7 },
    ];

    CC_SCHEMA.transactions.forEach((tx, idx) => {
      const sectionId = `tx_${idx + 1}`;
      const base = (idx + 1) * 100;
      fields.push(
        { key: tx.merchant, label: "Merchant", questionLabel: "Merchant", type: "question", sectionId, show: true, hideIfEmpty: true, order: base + 1 },
        { key: tx.expenseType, label: "Expense Type", questionLabel: "Expense Type", type: "question", sectionId, show: true, hideIfEmpty: true, order: base + 2 },
        { key: tx.purpose, label: "Purpose", questionLabel: "Purpose", type: "question", sectionId, show: true, hideIfEmpty: true, order: base + 3 },
        { key: tx.cost, label: "Cost", questionLabel: "Cost", type: "question", sectionId, show: true, hideIfEmpty: true, order: base + 4 },
        { key: tx.supportiveProgram, label: "Supportive Program", questionLabel: "Supportive Program", type: "question", sectionId, show: true, hideIfEmpty: true, order: base + 5 },
        { key: tx.programOperations, label: "Program Operations", questionLabel: "Program Operations", type: "question", sectionId, show: true, hideIfEmpty: true, order: base + 6 },
        { key: tx.customerName, label: "Customer", questionLabel: "Customer Name", type: "question", sectionId, show: true, hideIfEmpty: true, order: base + 7 },
        { key: tx.flexToggle, label: "YHDP Flex", questionLabel: "YHDP Flex", type: "question", sectionId, show: true, hideIfEmpty: true, order: base + 8 }
      );
      if (tx.notes) fields.push({ key: tx.notes, label: "Notes", questionLabel: "Notes", type: "question", sectionId, show: true, hideIfEmpty: true, order: base + 9 });
      (tx.files || []).forEach((fileId, fileIdx) =>
        fields.push({ key: fileId, label: `Files ${fileIdx + 1}`, questionLabel: "Files", type: "question", sectionId, show: true, hideIfEmpty: true, order: base + 10 + fileIdx })
      );
    });

    return {
      id: formId,
      formId,
      formAlias: input.formAlias || null,
      formTitle: input.formTitle || "Line Items Card Checkout",
      header: { show: true, title: input.formTitle || "Line Items Card Checkout", subtitle: "Line-items template map" },
      sections,
      fields,
      options: {
        hideEmptyFields: true,
        showQuestions: true,
        showAnswers: true,
        task: {
          enabled: true,
          assignedToGroup: "compliance",
          titlePrefix: "Credit Card Purchase Documentation",
          titleFieldKeys: [CC_SCHEMA.globals.purchaserName, CC_SCHEMA.globals.cardUsed],
          subtitleFieldKeys: [CC_SCHEMA.globals.email, CC_SCHEMA.globals.checkoutDateTime],
        },
      },
      mapKind: "line-items-template",
      mapVersion: 1,
      schemaKind: "credit-card",
      schema: { globals: CC_SCHEMA.globals, transactions: CC_SCHEMA.transactions },
    };
  }

  const sections = [
    { id: "summary", label: "Summary", show: true, order: 0 },
    { id: "customer_splits", label: "Customer Splits", show: true, order: 1 },
    { id: "program_splits", label: "Program Splits", show: true, order: 2 },
  ];
  const fields: AnyObj[] = [
    { key: INVOICE_SCHEMA.globals.invoiceDate, label: "Invoice Date", questionLabel: "Invoice Date", type: "question", sectionId: "summary", show: true, hideIfEmpty: true, order: 1 },
    { key: INVOICE_SCHEMA.globals.submissionDate, label: "Submission Date", questionLabel: "Submission Date", type: "question", sectionId: "summary", show: true, hideIfEmpty: true, order: 2 },
    { key: INVOICE_SCHEMA.globals.purchaser, label: "Purchaser", questionLabel: "Purchaser", type: "question", sectionId: "summary", show: true, hideIfEmpty: true, order: 3 },
    { key: INVOICE_SCHEMA.globals.expenseType, label: "Expense Type", questionLabel: "Expense Type", type: "question", sectionId: "summary", show: true, hideIfEmpty: true, order: 4 },
    { key: INVOICE_SCHEMA.globals.vendor, label: "Vendor", questionLabel: "Vendor", type: "question", sectionId: "summary", show: true, hideIfEmpty: true, order: 5 },
    { key: INVOICE_SCHEMA.globals.paymentMethod, label: "Payment Method", questionLabel: "Payment Method", type: "question", sectionId: "summary", show: true, hideIfEmpty: true, order: 6 },
    { key: INVOICE_SCHEMA.globals.email, label: "Email", questionLabel: "Email", type: "question", sectionId: "summary", show: true, hideIfEmpty: true, order: 7 },
    { key: INVOICE_SCHEMA.globals.purposeDetail, label: "Purpose", questionLabel: "Purpose Detail", type: "question", sectionId: "summary", show: true, hideIfEmpty: true, order: 8 },
    { key: INVOICE_SCHEMA.globals.note, label: "Note", questionLabel: "Note", type: "question", sectionId: "summary", show: true, hideIfEmpty: true, order: 9 },
    { key: INVOICE_SCHEMA.globals.serviceType, label: "Service Type", questionLabel: "Service Type", type: "question", sectionId: "summary", show: true, hideIfEmpty: true, order: 10 },
    { key: INVOICE_SCHEMA.globals.otherService, label: "Other Service", questionLabel: "Other Service", type: "question", sectionId: "summary", show: true, hideIfEmpty: true, order: 11 },
    { key: INVOICE_SCHEMA.globals.wioaScopeWex, label: "WIOA Scope/WEX", questionLabel: "WIOA Scope/WEX", type: "question", sectionId: "summary", show: true, hideIfEmpty: true, order: 12 },
    { key: INVOICE_SCHEMA.globals.costSingle, label: "Single Cost", questionLabel: "Single Cost", type: "question", sectionId: "summary", show: true, hideIfEmpty: true, order: 13 },
    { key: INVOICE_SCHEMA.customerPath.multiToggle, label: "Multi Split Toggle", questionLabel: "Multi Split", type: "question", sectionId: "summary", show: true, hideIfEmpty: true, order: 14 },
    { key: INVOICE_SCHEMA.customerPath.splitCount, label: "Split Count", questionLabel: "Split Count", type: "question", sectionId: "summary", show: true, hideIfEmpty: true, order: 15 },
  ];

  Object.values(INVOICE_SCHEMA.globals.files).forEach((fileId, idx) => {
    fields.push({ key: fileId, label: `Upload ${idx + 1}`, questionLabel: "Files", type: "question", sectionId: "summary", show: true, hideIfEmpty: true, order: 30 + idx });
  });

  INVOICE_SCHEMA.customerPath.amounts.forEach((amountId, idx) => {
    fields.push(
      { key: INVOICE_SCHEMA.customerPath.projects[idx], label: `Customer Project ${idx + 1}`, questionLabel: "Project", type: "question", sectionId: "customer_splits", show: true, hideIfEmpty: true, order: 100 + idx * 3 + 1 },
      { key: INVOICE_SCHEMA.customerPath.projectOther[idx], label: `Customer Project Other ${idx + 1}`, questionLabel: "Project Other", type: "question", sectionId: "customer_splits", show: true, hideIfEmpty: true, order: 100 + idx * 3 + 2 },
      { key: amountId, label: `Customer Amount ${idx + 1}`, questionLabel: "Amount", type: "question", sectionId: "customer_splits", show: true, hideIfEmpty: true, order: 100 + idx * 3 + 3 }
    );
  });

  INVOICE_SCHEMA.programPath.amounts.forEach((amountId, idx) => {
    fields.push(
      { key: INVOICE_SCHEMA.programPath.billToList[idx], label: `Program Bill To ${idx + 1}`, questionLabel: "Bill To", type: "question", sectionId: "program_splits", show: true, hideIfEmpty: true, order: 200 + idx * 3 + 1 },
      { key: INVOICE_SCHEMA.programPath.billToOther[idx], label: `Program Bill To Other ${idx + 1}`, questionLabel: "Bill To Other", type: "question", sectionId: "program_splits", show: true, hideIfEmpty: true, order: 200 + idx * 3 + 2 },
      { key: amountId, label: `Program Amount ${idx + 1}`, questionLabel: "Amount", type: "question", sectionId: "program_splits", show: true, hideIfEmpty: true, order: 200 + idx * 3 + 3 }
    );
  });

  return {
    id: formId,
    formId,
    formAlias: input.formAlias || null,
    formTitle: input.formTitle || "Line Items Invoice",
    header: { show: true, title: input.formTitle || "Line Items Invoice", subtitle: "Line-items template map" },
    sections,
    fields,
    options: {
      hideEmptyFields: true,
      showQuestions: true,
      showAnswers: true,
      task: {
        enabled: true,
        assignedToGroup: "compliance",
        titlePrefix: "Invoice Documentation",
        titleFieldKeys: [INVOICE_SCHEMA.globals.vendor, INVOICE_SCHEMA.globals.expenseType],
        subtitleFieldKeys: [INVOICE_SCHEMA.globals.invoiceDate, INVOICE_SCHEMA.globals.purchaser],
      },
    },
    mapKind: "line-items-template",
    mapVersion: 1,
    schemaKind: "invoice",
    schema: { globals: INVOICE_SCHEMA.globals, customerPath: INVOICE_SCHEMA.customerPath, programPath: INVOICE_SCHEMA.programPath },
  };
}
