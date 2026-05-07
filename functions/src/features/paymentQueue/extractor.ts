/**
 * paymentQueue/extractor.ts
 *
 * Server-side spend-line extraction — mirrors web/src/.../spendExtractor.ts.
 * Kept in sync manually; schema constants are duplicated here to avoid
 * cross-package imports from the web workspace.
 *
 * Call `extractSpendItems(sub)` to get one or more PaymentQueueExtracted items
 * from a raw Jotform submission Firestore document.
 */

// ─── Schema version ───────────────────────────────────────────────────────────
/** Bump when extraction logic changes in a way that produces different output. */
export const SCHEMA_VERSION = 1;

// ─── Form IDs ─────────────────────────────────────────────────────────────────
export const SPENDING_FORM_IDS = {
  creditCard: "251878265158166",
  invoice: "252674777246167",
} as const;

export type SpendingFormId = (typeof SPENDING_FORM_IDS)[keyof typeof SPENDING_FORM_IDS];

export function isSpendingFormId(formId: unknown): boolean {
  const id = String(formId || "").trim();
  return id === SPENDING_FORM_IDS.creditCard || id === SPENDING_FORM_IDS.invoice;
}

// ─── Error codes ──────────────────────────────────────────────────────────────
export const SPEND_ERR = {
  NO_FORM_ID: "SPEND_ERR_NO_FORM_ID",
  UNKNOWN_FORM: "SPEND_ERR_UNKNOWN_FORM",
  DIGEST_INCOMPLETE: "SPEND_ERR_DIGEST_INCOMPLETE",
  EMPTY_RESULT: "SPEND_ERR_EMPTY_RESULT",
  PARTIAL: "SPEND_ERR_PARTIAL",
  AMOUNT_UNPARSEABLE: "SPEND_ERR_AMOUNT_UNPARSEABLE",
  AMOUNT_MISMATCH: "SPEND_ERR_AMOUNT_MISMATCH",
} as const;

export type SpendErrCode = (typeof SPEND_ERR)[keyof typeof SPEND_ERR];

export type SpendExtractionError = {
  code: SpendErrCode;
  message: string;
  fieldId?: string;
};

// ─── Extracted item shape ─────────────────────────────────────────────────────
export type SpendSource = "credit-card" | "invoice" | "unknown";

export type ExtractedSpendItem = {
  id: string;
  baseId: string;
  submissionId: string;
  formId: string;
  formAlias: string;
  formTitle: string;
  schemaVersion: number;
  source: SpendSource;
  createdAt: string;
  month: string;
  amount: number;
  amountAbs?: number;
  direction?: "charge" | "return";
  directionFieldId?: string | null;
  amountFieldId?: string | null;
  extractionGroup?: { kind: "purchase" | "return" | "fallback"; index: number | null; orderRange?: [number, number] | null; fieldIds?: Record<string, string | null> };
  merchant: string;
  expenseType: string;
  program: string;
  billedTo: string;
  project: string;
  purchasePath: "customer" | "program" | "";
  card: string;
  cardBucket: "Youth" | "Housing" | "MAD" | "";
  creditCardId?: string | null;
  txnNumber: number | null;
  purpose: string;
  paymentMethod: string;
  serviceType: string;
  otherService: string;
  serviceScope: string;
  wex: string;
  descriptor: string;
  customer: string;
  customerKey: string;
  purchaser: string;
  email: string;
  isFlex: boolean;
  flexReasons: string[];
  submissionIsFlex: boolean;
  files: string[];
  files_txn: string[];
  files_uploadAll: string[];
  files_typed: { receipt: string[]; required: string[]; agenda: string[]; w9: string[] };
  notes: string;
  note: string;
  rawStatus: string;
  rawAnswers: Record<string, unknown>;
  rawMeta: { id: string; form_id: string; status: string; created_at: string; updated_at?: string };
  extractionErrors: SpendExtractionError[];
  extractionPath: "hardcoded" | "digest" | "fallback";
};

// ─── Hardcoded schemas (duplicated from web lineItemsFormMap.ts) ──────────────

const CC_SCHEMA = {
  globals: {
    type: "222",
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
  returnRecord: {
    cardUsed: "281",
    merchant: "284",
    expenseType: "285",
    supportiveProgram: "286",
    tssCategory: "303",
    flexToggle: "287",
    customerName: "288",
    programOperations: "289",
    purpose: "290",
    cost: "291",
    files: ["293"],
    notes: "294",
    email: "295",
  },
} as const;

const INVOICE_SCHEMA = {
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
    files: { receipt: "7", required: "28", agenda: "29", w9: "156" },
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

type AnyObj = Record<string, unknown>;

function asText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join(", ");
  if (typeof v === "object") {
    const o = v as AnyObj;
    if ("answer" in o) return asText(o.answer);
    if ("prettyFormat" in o) return asText(o.prettyFormat);
    if ("value" in o) return asText(o.value);
    const { year, month, day } = o as { year?: unknown; month?: unknown; day?: unknown };
    if (year && month && day)
      return `${year}-${String(Number(month)).padStart(2, "0")}-${String(Number(day)).padStart(2, "0")}`;
    return Object.values(o).map(asText).filter(Boolean).join(" ");
  }
  return "";
}

function getAns(answers: AnyObj, id: string | null | undefined): unknown {
  if (!id) return "";
  const entry = answers[id] as AnyObj | undefined;
  if (!entry) return "";
  const ans = entry.answer;
  if (ans == null) return entry.prettyFormat ?? "";
  if (typeof ans === "string" || typeof ans === "number" || typeof ans === "boolean") return ans;
  if (Array.isArray(ans)) return ans;
  if (typeof ans === "object") {
    const a = ans as AnyObj;
    if (typeof a.datetime === "string") return a.datetime;
    if (typeof entry.prettyFormat === "string") return entry.prettyFormat;
    const { year, month, day } = a as { year?: unknown; month?: unknown; day?: unknown };
    if (year && month && day)
      return `${year}-${String(Number(month)).padStart(2, "0")}-${String(Number(day)).padStart(2, "0")}`;
  }
  return entry.prettyFormat ?? "";
}

function getFiles(answers: AnyObj, ids: readonly string[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const v = getAns(answers, id);
    if (Array.isArray(v)) out.push(...v.map(asText).filter(Boolean));
    else { const s = asText(v); if (s) out.push(s); }
  }
  return Array.from(new Set(out)).filter(Boolean);
}

function parseMoney(v: unknown, errors?: SpendExtractionError[], fieldId?: string): number {
  const s = asText(v).replace(/[^0-9.-]/g, "");
  if (!s) return 0;
  const n = Number(s);
  if (!Number.isFinite(n)) {
    errors?.push({ code: SPEND_ERR.AMOUNT_UNPARSEABLE, message: `Could not parse "${asText(v)}" as money`, fieldId });
    return 0;
  }
  return n;
}

function parseYes(v: unknown): boolean {
  return /^(y|yes|true)\b/i.test(asText(v));
}

function isReturnSubmission(answers: AnyObj): boolean {
  return /made\s+a\s+return|return/i.test(asText(getAns(answers, CC_SCHEMA.globals.type)));
}

function toISO(s: unknown): string {
  if (!s) return "";
  const str = asText(s).trim();
  if (!str) return "";
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(str)) return str.replace(" ", "T");
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM))?$/i);
  if (m) {
    const [, mm, dd, yyyy, rawHh = "00", mi = "00", ap] = m;
    let H = Number(rawHh);
    if (ap) { const u = ap.toUpperCase(); if (u === "PM" && H < 12) H += 12; if (u === "AM" && H === 12) H = 0; }
    return `${yyyy}-${String(Number(mm)).padStart(2, "0")}-${String(Number(dd)).padStart(2, "0")}T${String(H).padStart(2, "0")}:${String(Number(mi)).padStart(2, "0")}:00`;
  }
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 19);
}

function toMonth(iso: string): string {
  return iso && iso.length >= 7 ? iso.slice(0, 7) : "";
}

function canonicalCard(v: unknown): string {
  const s = asText(v).trim().toLowerCase();
  if (s === "mad card") return "MAD Card";
  if (s === "youth card") return "Youth Card";
  if (s === "housing card") return "Housing Card";
  return asText(v).trim();
}

function bucketCard(label: string): ExtractedSpendItem["cardBucket"] {
  const s = label.toLowerCase();
  if (s.includes("youth")) return "Youth";
  if (s.includes("housing")) return "Housing";
  if (s.includes("mad")) return "MAD";
  return "";
}

function makeCustomerKey(s: unknown): string {
  return asText(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function computeFlex(
  answers: AnyObj,
  extras: { anyFlexTxn?: boolean; forceFlex?: boolean } = {},
): { isFlex: boolean; reasons: string[] } {
  const pieces: string[] = [];
  for (const v of Object.values(answers)) {
    if (!v || typeof v !== "object") continue;
    const o = v as AnyObj;
    const ans = o.answer;
    if (typeof ans === "string") pieces.push(ans);
    else if (Array.isArray(ans)) pieces.push(...ans.map(String));
    if (typeof o.prettyFormat === "string") pieces.push(o.prettyFormat);
    if (typeof o.value === "string") pieces.push(o.value);
  }
  const hay = pieces.join(" ").toLowerCase();
  const reasons: string[] = [];
  if (/\byhdp\b.*\bflex\b/.test(hay) || /\bflex\s*fund/.test(hay) || /\bflex\b/.test(hay))
    reasons.push("text:flex");
  if (extras.anyFlexTxn) reasons.push("txn:flex");
  const isFlex = extras.forceFlex === true || reasons.length > 0;
  return { isFlex, reasons };
}

function emptyTypedFiles() {
  return { receipt: [] as string[], required: [] as string[], agenda: [] as string[], w9: [] as string[] };
}

function buildRawMeta(sub: AnyObj): ExtractedSpendItem["rawMeta"] {
  return {
    id: asText(sub.id || sub.submission_id || ""),
    form_id: asText(sub.form_id || sub.formId || ""),
    status: asText(sub.status || ""),
    created_at: asText(sub.created_at || ""),
    updated_at: asText(sub.updated_at || "") || undefined,
  };
}

function buildFallbackRow(
  sub: AnyObj,
  formId: string,
  formAlias: string,
  formTitle: string,
  errors: SpendExtractionError[],
  path: ExtractedSpendItem["extractionPath"],
): ExtractedSpendItem {
  const answers = (sub.answers || {}) as AnyObj;
  const createdAt = toISO(sub.created_at) || new Date().toISOString();
  return {
    id: asText(sub.id || "unknown"),
    baseId: asText(sub.id || ""),
    submissionId: asText(sub.id || ""),
    formId, formAlias, formTitle,
    schemaVersion: SCHEMA_VERSION,
    source: "unknown",
    createdAt,
    month: toMonth(createdAt),
    amount: 0,
    merchant: "", expenseType: "", program: "", billedTo: "", project: "", purchasePath: "",
    card: "", cardBucket: "", txnNumber: null,
    purpose: "", paymentMethod: "", serviceType: "", otherService: "", serviceScope: "", wex: "", descriptor: "",
    customer: "", customerKey: "", purchaser: "", email: "",
    isFlex: false, flexReasons: [], submissionIsFlex: false,
    files: [], files_txn: [], files_uploadAll: [],
    files_typed: emptyTypedFiles(),
    notes: "", note: "",
    rawStatus: asText(sub.status || ""),
    rawAnswers: answers,
    rawMeta: buildRawMeta(sub),
    extractionErrors: errors,
    extractionPath: path,
  };
}

// ─── Credit-card extraction ───────────────────────────────────────────────────

function extractCreditCard(sub: AnyObj, formId: string, formAlias: string, formTitle: string): ExtractedSpendItem[] {
  const answers = (sub.answers || {}) as AnyObj;
  const rawStatus = asText(sub.status || "");
  const returnSubmission = isReturnSubmission(answers);
  const createdAt =
    (returnSubmission ? toISO(getAns(answers, CC_SCHEMA.globals.returnDateTime)) : "") ||
    toISO(getAns(answers, CC_SCHEMA.globals.checkoutDateTime)) ||
    toISO(sub.created_at) ||
    new Date().toISOString();
  const month = toMonth(createdAt);

  const card = (returnSubmission ? canonicalCard(getAns(answers, CC_SCHEMA.returnRecord.cardUsed)) : "") ||
    canonicalCard(getAns(answers, CC_SCHEMA.globals.cardUsed)) ||
    canonicalCard(getAns(answers, CC_SCHEMA.globals.cardChoice)) || "Card";
  const cardBucket = bucketCard(card);
  const purchaser = asText(getAns(answers, CC_SCHEMA.globals.purchaserName));
  const email = (returnSubmission ? asText(getAns(answers, CC_SCHEMA.returnRecord.email)) : "") ||
    asText(getAns(answers, CC_SCHEMA.globals.email));
  const uploadAll = getFiles(answers, [CC_SCHEMA.globals.uploadAllTxn1]);

  const countRaw = asText(getAns(answers, CC_SCHEMA.globals.txnCount)).toLowerCase();
  const countMap: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };
  const txnLimit = countMap[Object.keys(countMap).find((k) => countRaw.includes(k)) ?? ""] ?? 5;

  let anyFlex = false;
  const errors: SpendExtractionError[] = [];
  type WithTxnFlex = Omit<ExtractedSpendItem, "submissionIsFlex" | "isFlex" | "flexReasons"> & { _txnFlex: boolean };
  const items: WithTxnFlex[] = [];

  if (returnSubmission) {
    const tx = CC_SCHEMA.returnRecord;
    const amountAbs = Math.abs(parseMoney(getAns(answers, tx.cost), errors, tx.cost));
    const merchant = asText(getAns(answers, tx.merchant));
    const expenseType = asText(getAns(answers, tx.expenseType));
    const purpose = asText(getAns(answers, tx.purpose));
    const supportiveProgram = asText(getAns(answers, tx.supportiveProgram));
    const programOperations = asText(getAns(answers, tx.programOperations));
    const tssCategory = asText(getAns(answers, tx.tssCategory));
    const customer = asText(getAns(answers, tx.customerName));
    const notes = asText(getAns(answers, tx.notes));
    const isFlexTxn = parseYes(getAns(answers, tx.flexToggle));
    const txnFiles = getFiles(answers, tx.files);
    const program = programOperations || tssCategory || supportiveProgram;
    anyFlex = anyFlex || isFlexTxn;

    items.push({
      id: `${sub.id}-return`,
      baseId: asText(sub.id),
      submissionId: asText(sub.id),
      formId, formAlias, formTitle,
      schemaVersion: SCHEMA_VERSION,
      source: "credit-card",
      createdAt, month, amount: -amountAbs, amountAbs,
      direction: "return",
      directionFieldId: CC_SCHEMA.globals.type,
      amountFieldId: tx.cost,
      extractionGroup: {
        kind: "return",
        index: 1,
        orderRange: [91, 109],
        fieldIds: {
          cardUsed: tx.cardUsed,
          merchant: tx.merchant,
          expenseType: tx.expenseType,
          supportiveProgram: tx.supportiveProgram,
          tssCategory: tx.tssCategory,
          programOperations: tx.programOperations,
          customerName: tx.customerName,
          purpose: tx.purpose,
          cost: tx.cost,
          notes: tx.notes,
        },
      },
      merchant, expenseType, program,
      billedTo: "", project: "", purchasePath: "",
      card, cardBucket, txnNumber: null, purpose,
      paymentMethod: "", serviceType: "", otherService: "", serviceScope: "", wex: "", descriptor: "",
      customer, customerKey: makeCustomerKey(customer), purchaser, email,
      files: txnFiles, files_txn: txnFiles, files_uploadAll: [],
      files_typed: emptyTypedFiles(),
      notes, note: "", rawStatus,
      rawAnswers: answers, rawMeta: buildRawMeta(sub),
      extractionErrors: errors,
      extractionPath: "hardcoded",
      _txnFlex: isFlexTxn,
    });

    const subFlex = computeFlex(answers, { anyFlexTxn: anyFlex });
    return items.map(({ _txnFlex, ...item }) => ({
      ...item,
      isFlex: _txnFlex || subFlex.isFlex,
      submissionIsFlex: anyFlex,
      flexReasons: Array.from(new Set([...(_txnFlex ? ["txn:flex"] : []), ...subFlex.reasons, "direction:return"])),
    }));
  }

  const orderRanges: Array<[number, number]> = [[13, 25], [27, 41], [43, 56], [59, 71], [73, 85]];

  for (let i = 0; i < CC_SCHEMA.transactions.length; i++) {
    if (i >= txnLimit) break;
    const tx = CC_SCHEMA.transactions[i];
    const amountAbs = Math.abs(parseMoney(getAns(answers, tx.cost), errors, tx.cost));
    const amount = amountAbs;
    const merchant = asText(getAns(answers, tx.merchant));
    const expenseType = asText(getAns(answers, tx.expenseType));
    const purpose = asText(getAns(answers, tx.purpose));
    const supportiveProgram = asText(getAns(answers, tx.supportiveProgram));
    const programOperations = asText(getAns(answers, (tx as any).programOperations ?? null));
    const customer = asText(getAns(answers, tx.customerName));
    const notes = tx.notes ? asText(getAns(answers, tx.notes)) : "";
    const isFlexTxn = parseYes(getAns(answers, tx.flexToggle));
    const txnFiles = getFiles(answers, tx.files);
    const uploadAllForTxn = i === 0 ? uploadAll : [];
    const files = Array.from(new Set([...txnFiles, ...uploadAllForTxn]));

    const program = expenseType.toLowerCase().includes("customer")
      ? supportiveProgram
      : programOperations || supportiveProgram;

    const hasCore = merchant || expenseType || supportiveProgram || programOperations || purpose || amount !== 0 || txnFiles.length > 0;
    if (!hasCore) continue;

    anyFlex = anyFlex || isFlexTxn;
    items.push({
      id: `${sub.id}-t${i + 1}`,
      baseId: asText(sub.id),
      submissionId: asText(sub.id),
      formId, formAlias, formTitle,
      schemaVersion: SCHEMA_VERSION,
      source: "credit-card",
      createdAt, month, amount, amountAbs,
      direction: "charge",
      directionFieldId: CC_SCHEMA.globals.type,
      amountFieldId: tx.cost,
      extractionGroup: {
        kind: "purchase",
        index: i + 1,
        orderRange: orderRanges[i] ?? null,
        fieldIds: {
          merchant: tx.merchant,
          expenseType: tx.expenseType,
          supportiveProgram: tx.supportiveProgram,
          programOperations: (tx as any).programOperations ?? null,
          customerName: tx.customerName,
          purpose: tx.purpose,
          cost: tx.cost,
          notes: tx.notes ?? null,
        },
      },
      merchant, expenseType, program,
      billedTo: "", project: "", purchasePath: "",
      card, cardBucket, txnNumber: i + 1, purpose,
      paymentMethod: "", serviceType: "", otherService: "", serviceScope: "", wex: "", descriptor: "",
      customer, customerKey: makeCustomerKey(customer), purchaser, email,
      files, files_txn: txnFiles, files_uploadAll: uploadAllForTxn,
      files_typed: emptyTypedFiles(),
      notes, note: "", rawStatus,
      rawAnswers: answers, rawMeta: buildRawMeta(sub),
      extractionErrors: errors,
      extractionPath: "hardcoded",
      _txnFlex: isFlexTxn,
    });
  }

  // Empty-txn fallback
  if (items.length === 0) {
    const tx0 = CC_SCHEMA.transactions[0];
    const amountAbs = Math.abs(parseMoney(getAns(answers, tx0.cost), errors, tx0.cost));
    const amount = amountAbs;
    const isFlexTxn = parseYes(getAns(answers, tx0.flexToggle));
    const txnFiles = getFiles(answers, tx0.files);
    const files = Array.from(new Set([...txnFiles, ...uploadAll]));
    const customer = asText(getAns(answers, tx0.customerName));
    anyFlex = anyFlex || isFlexTxn;
    errors.push({ code: SPEND_ERR.EMPTY_RESULT, message: "No non-empty transactions found; using Tx1 as fallback" });
    items.push({
      id: `${sub.id}-t1`, baseId: asText(sub.id), submissionId: asText(sub.id),
      formId, formAlias, formTitle, schemaVersion: SCHEMA_VERSION,
      source: "credit-card", createdAt, month, amount, amountAbs,
      direction: "charge",
      directionFieldId: CC_SCHEMA.globals.type,
      amountFieldId: tx0.cost,
      extractionGroup: {
        kind: "fallback",
        index: 1,
        orderRange: orderRanges[0],
        fieldIds: {
          merchant: tx0.merchant,
          expenseType: tx0.expenseType,
          supportiveProgram: tx0.supportiveProgram,
          programOperations: (tx0 as any).programOperations ?? null,
          customerName: tx0.customerName,
          purpose: tx0.purpose,
          cost: tx0.cost,
          notes: tx0.notes ?? null,
        },
      },
      merchant: asText(getAns(answers, tx0.merchant)),
      expenseType: asText(getAns(answers, tx0.expenseType)),
      program: asText(getAns(answers, tx0.supportiveProgram)) || asText(getAns(answers, (tx0 as any).programOperations ?? null)),
      billedTo: "", project: "", purchasePath: "",
      card, cardBucket, txnNumber: 1,
      purpose: asText(getAns(answers, tx0.purpose)),
      paymentMethod: "", serviceType: "", otherService: "", serviceScope: "", wex: "", descriptor: "",
      customer, customerKey: makeCustomerKey(customer), purchaser, email,
      files, files_txn: txnFiles, files_uploadAll: uploadAll,
      files_typed: emptyTypedFiles(),
      notes: tx0.notes ? asText(getAns(answers, tx0.notes)) : "",
      note: "", rawStatus, rawAnswers: answers, rawMeta: buildRawMeta(sub),
      extractionErrors: errors, extractionPath: "hardcoded",
      _txnFlex: isFlexTxn,
    });
  }

  const subFlex = computeFlex(answers, { anyFlexTxn: anyFlex });
  return items.map(({ _txnFlex, ...item }) => ({
    ...item,
    isFlex: _txnFlex || subFlex.isFlex,
    submissionIsFlex: anyFlex,
    flexReasons: Array.from(new Set([...(_txnFlex ? ["txn:flex"] : []), ...subFlex.reasons])),
  }));
}

// ─── Invoice extraction ───────────────────────────────────────────────────────

function extractInvoice(sub: AnyObj, formId: string, formAlias: string, formTitle: string): ExtractedSpendItem[] {
  const answers = (sub.answers || {}) as AnyObj;
  const rawStatus = asText(sub.status || "");
  const createdAt =
    toISO(getAns(answers, INVOICE_SCHEMA.globals.invoiceDate)) ||
    toISO(getAns(answers, INVOICE_SCHEMA.globals.submissionDate)) ||
    toISO(sub.created_at) ||
    new Date().toISOString();
  const month = toMonth(createdAt);

  const vendor = asText(getAns(answers, INVOICE_SCHEMA.globals.vendor));
  const expenseType = asText(getAns(answers, INVOICE_SCHEMA.globals.expenseType));
  const purchaser = asText(getAns(answers, INVOICE_SCHEMA.globals.purchaser));
  const paymentMethod = asText(getAns(answers, INVOICE_SCHEMA.globals.paymentMethod));
  const email = asText(getAns(answers, INVOICE_SCHEMA.globals.email));
  const note = asText(getAns(answers, INVOICE_SCHEMA.globals.note));
  const serviceType = asText(getAns(answers, INVOICE_SCHEMA.globals.serviceType));
  const otherService = asText(getAns(answers, INVOICE_SCHEMA.globals.otherService));
  const costSingle = parseMoney(getAns(answers, INVOICE_SCHEMA.globals.costSingle));

  const files_typed = {
    receipt: getFiles(answers, [INVOICE_SCHEMA.globals.files.receipt]),
    required: getFiles(answers, [INVOICE_SCHEMA.globals.files.required]),
    agenda: getFiles(answers, [INVOICE_SCHEMA.globals.files.agenda]),
    w9: getFiles(answers, [INVOICE_SCHEMA.globals.files.w9]),
  };
  const filesAll = [...files_typed.receipt, ...files_typed.required, ...files_typed.agenda, ...files_typed.w9];

  const wioaRaw = asText(getAns(answers, INVOICE_SCHEMA.globals.wioaScopeWex));
  const w = wioaRaw.toUpperCase();
  const serviceScope = w.includes("IS") ? "IS" : w.includes("OS") ? "OS" : "";
  const wex = w.includes("NON-WEX") ? "Non-WEX" : w.includes("WEX") ? "WEX" : "";

  const cFirst = asText(getAns(answers, INVOICE_SCHEMA.globals.firstName));
  const cLast = asText(getAns(answers, INVOICE_SCHEMA.globals.lastName));
  const customer = [cFirst, cLast].filter(Boolean).join(" ").trim();

  const isFlex = /yhdp\s*flex/i.test(serviceType) || /yhdp\s*flex/i.test(otherService);
  const subFlex = computeFlex(answers, { forceFlex: isFlex });

  const errors: SpendExtractionError[] = [];
  const isCustomerPath = /^for\s+a\s+customer/i.test(expenseType);
  const purchasePath: ExtractedSpendItem["purchasePath"] = isCustomerPath ? "customer" : "program";
  const descriptor = isCustomerPath ? serviceType || otherService : "";

  const common: Omit<ExtractedSpendItem, "id" | "amount" | "program" | "billedTo" | "project" | "txnNumber"> = {
    baseId: asText(sub.id), submissionId: asText(sub.id),
    formId, formAlias, formTitle, schemaVersion: SCHEMA_VERSION,
    source: "invoice", createdAt, month,
    merchant: vendor, expenseType, purchasePath,
    card: "", cardBucket: "", purpose: "", paymentMethod, serviceType, otherService,
    serviceScope, wex, descriptor, customer, customerKey: makeCustomerKey(customer),
    purchaser, email,
    isFlex: subFlex.isFlex, flexReasons: subFlex.reasons, submissionIsFlex: subFlex.isFlex,
    files: filesAll, files_txn: [], files_uploadAll: [], files_typed,
    notes: "", note, rawStatus, rawAnswers: answers, rawMeta: buildRawMeta(sub),
    extractionErrors: errors, extractionPath: "hardcoded",
  };

  // Customer path
  if (isCustomerPath) {
    const multi = parseYes(getAns(answers, INVOICE_SCHEMA.customerPath.multiToggle));
    if (multi) {
      const projects = (INVOICE_SCHEMA.customerPath.projects as readonly string[]).map((id) => asText(getAns(answers, id)));
      const projOther = (INVOICE_SCHEMA.customerPath.projectOther as readonly string[]).map((id) => asText(getAns(answers, id)));
      const amounts = (INVOICE_SCHEMA.customerPath.amounts as readonly string[]).map((id) => parseMoney(getAns(answers, id), errors, id));
      const splits: ExtractedSpendItem[] = [];
      for (let i = 0; i < projects.length; i++) {
        const p = projects[i] || "";
        const o = projOther[i] || "";
        const label = p && !/other/i.test(p) ? p : o || p;
        const amt = amounts[i] || 0;
        if (!label && !amt) continue;
        splits.push({ ...common, id: `${sub.id}-${i}`, amount: amt, program: label, billedTo: "", project: label, txnNumber: null });
      }
      if (splits.length) return splits;
    }
    const project = (INVOICE_SCHEMA.customerPath.projects as readonly string[]).map((id) => asText(getAns(answers, id))).find((v) => v) || "";
    const projOther = (INVOICE_SCHEMA.customerPath.projectOther as readonly string[]).map((id) => asText(getAns(answers, id))).find((v) => v) || "";
    const program = projOther || project || "";
    return [{ ...common, id: asText(sub.id), amount: costSingle, program, billedTo: "", project, txnNumber: null }];
  }

  // Program path
  const multi = parseYes(getAns(answers, INVOICE_SCHEMA.programPath.multiToggle));
  const billTo = (INVOICE_SCHEMA.programPath.billToList as readonly string[]).map((id) => asText(getAns(answers, id)));
  const billToOther = (INVOICE_SCHEMA.programPath.billToOther as readonly string[]).map((id) => asText(getAns(answers, id)));
  const amounts = (INVOICE_SCHEMA.programPath.amounts as readonly string[]).map((id) => parseMoney(getAns(answers, id), errors, id));

  if (multi) {
    const splits: ExtractedSpendItem[] = [];
    for (let i = 0; i < billTo.length; i++) {
      const bt = billTo[i] || "";
      const other = billToOther[i] || "";
      const label = bt && !/other/i.test(bt) ? bt : other || "";
      const amt = amounts[i] || 0;
      if (!label && !amt) continue;
      splits.push({ ...common, id: `${sub.id}-${i}`, amount: amt, program: label, billedTo: label, project: "", txnNumber: null });
    }
    if (splits.length) return splits;
  }

  const bt0 = billTo[0] || "";
  const o0 = billToOther[0] || "";
  const label = bt0 && !/other/i.test(bt0) ? bt0 : o0 || bt0;
  return [{ ...common, id: asText(sub.id), amount: costSingle, program: label, billedTo: label, project: "", txnNumber: null }];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract one or more SpendLineItems from a Jotform submission Firestore doc.
 * Never throws — always returns at least one item (possibly a fallback row).
 */
export function extractSpendItems(sub: AnyObj): ExtractedSpendItem[] {
  const formId = String(sub?.form_id || sub?.formId || "").trim();
  const formAlias = String(sub?.formAlias || "").trim();
  const formTitle = String(sub?.formTitle || sub?.formAlias || "Jotform Submission").trim();

  if (!formId) {
    const err: SpendExtractionError = { code: SPEND_ERR.NO_FORM_ID, message: "submission.formId is empty" };
    return [buildFallbackRow(sub, formId, formAlias, formTitle, [err], "fallback")];
  }

  if (formId === SPENDING_FORM_IDS.creditCard) {
    return extractCreditCard(sub, formId, formAlias, formTitle);
  }
  if (formId === SPENDING_FORM_IDS.invoice) {
    return extractInvoice(sub, formId, formAlias, formTitle);
  }

  const err: SpendExtractionError = {
    code: SPEND_ERR.UNKNOWN_FORM,
    message: `Unknown form ID "${formId}". Add to SPENDING_FORM_IDS or pass a digest.`,
  };
  return [buildFallbackRow(sub, formId, formAlias, formTitle, [err], "fallback")];
}
