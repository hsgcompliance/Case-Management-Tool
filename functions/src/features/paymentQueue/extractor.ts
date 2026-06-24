/**
 * paymentQueue/extractor.ts
 *
 * Server-side spend-line extraction — mirrors web/src/.../spendExtractor.ts.
 * Kept in sync manually; schema constants are duplicated here to avoid
 * cross-package imports from the web workspace.
 *
 * Call `extractSpendItems(sub, transactionModel)` to get one or more PaymentQueueExtracted items
 * from a raw Jotform submission Firestore document.
 */

import {
  transactionFieldKey,
  type LogicalTransactionWindow,
  type TransactionWindowModel,
} from "@hdb/contracts";

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
  SCHEMA_MISMATCH: "SPEND_ERR_SCHEMA_MISMATCH",
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
  extractionGroup?: {
    kind: "purchase" | "return" | "fallback";
    index: number | null;
    orderRange?: [number, number] | null;
    fieldIds?: Record<string, string | null>;
    fieldOrders?: Record<string, number | null>;
  };
  transactionFields: Record<string, unknown>;
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
    { merchant: "82", expenseType: "84", purpose: "85", cost: "86", supportiveProgram: "169", programOperations: "174", tssCategory: "296", wioaCategory: "311", pathCategory: "304", customerName: "156", notes: "151", files: ["70"], additionalFiles: ["317"], flexToggle: "204" },
    { merchant: "182", expenseType: "183", purpose: "106", cost: "107", supportiveProgram: "184", programOperations: "186", tssCategory: "297", wioaCategory: "312", pathCategory: "305", customerName: "185", notes: "143", files: ["109"], additionalFiles: ["318"], flexToggle: "205" },
    { merchant: "187", expenseType: "188", purpose: "114", cost: "115", supportiveProgram: "189", programOperations: "191", tssCategory: "298", wioaCategory: "313", pathCategory: "306", customerName: "190", notes: "147", files: ["117"], additionalFiles: ["319"], flexToggle: "206" },
    { merchant: "192", expenseType: "193", purpose: "122", cost: "123", supportiveProgram: "194", programOperations: "196", tssCategory: "299", wioaCategory: "314", pathCategory: "307", customerName: "195", notes: null, files: ["125"], additionalFiles: ["320"], flexToggle: "207" },
    { merchant: "197", expenseType: "198", purpose: "130", cost: "131", supportiveProgram: "199", programOperations: "201", tssCategory: "302", wioaCategory: "315", pathCategory: "308", customerName: "200", notes: null, files: ["133"], additionalFiles: ["321"], flexToggle: "208" },
  ],
  returnRecord: {
    cardUsed: "281",
    merchant: "284",
    expenseType: "285",
    supportiveProgram: "286",
    tssCategory: "303",
    wioaCategory: "316",
    pathCategory: "309",
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

const CC_FIELD_ORDER: Record<string, number> = {
  "219": 11,
  "82": 14, "84": 15, "169": 16, "174": 17, "296": 18, "204": 19, "311": 20, "304": 21, "156": 22, "85": 23, "86": 24, "317": 25, "70": 26, "151": 27,
  "182": 32, "183": 34, "184": 35, "186": 36, "297": 37, "205": 38, "312": 39, "305": 40, "185": 41, "106": 42, "107": 43, "318": 44, "109": 45, "143": 46,
  "187": 50, "188": 52, "189": 53, "191": 54, "298": 55, "206": 56, "313": 57, "306": 58, "190": 59, "114": 60, "115": 61, "319": 62, "117": 63,
  "192": 67, "193": 70, "194": 71, "196": 72, "299": 73, "207": 74, "314": 75, "307": 76, "195": 77, "122": 78, "123": 79, "320": 80, "125": 81, "147": 82,
  "197": 84, "198": 87, "199": 88, "201": 89, "302": 90, "208": 91, "315": 92, "308": 93, "200": 94, "130": 95, "131": 96, "321": 97, "133": 98,
  "281": 109, "284": 111, "285": 112, "286": 113, "289": 114, "303": 115, "287": 116, "316": 117, "309": 118, "288": 119, "290": 120, "291": 121, "293": 123, "294": 124, "295": 126,
};

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

function firstMeaningfulAnswer(answers: AnyObj, fieldIds: readonly string[]): unknown {
  let fallback: unknown = "";
  for (const id of fieldIds) {
    const value = getAns(answers, id);
    if (fallback === "") fallback = value;
    if (asText(value)) return value;
  }
  return fallback;
}

function transactionValues(
  answers: AnyObj,
  window: LogicalTransactionWindow,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(window.fieldIdsByKey).map(([key, fieldIds]) => [
      key,
      firstMeaningfulAnswer(answers, fieldIds),
    ]),
  );
}

function txText(values: Record<string, unknown>, label: string): string {
  return asText(values[transactionFieldKey(label)]);
}

function txSpecifierText(values: Record<string, unknown>): string {
  const excluded = new Set([
    transactionFieldKey("Expense Type"),
    transactionFieldKey("Supportive Services Program"),
    transactionFieldKey("Program Operations for:"),
    transactionFieldKey("Customer Name"),
    transactionFieldKey("Merchant"),
    transactionFieldKey("Purpose"),
    transactionFieldKey("Cost"),
    transactionFieldKey("Notes (optional)"),
    transactionFieldKey("Is this YHDP Flex Funds?"),
  ]);
  const parts: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    if (excluded.has(key)) continue;
    const slug = key.replace(/^tx:/, "");
    if (!/(^|[-_])(category|specifier|scope|funding|fund)([-_]|$)/i.test(slug)) continue;
    const text = asText(value);
    if (text) parts.push(text);
  }
  return Array.from(new Set(parts)).join(", ");
}

function txRawId(window: LogicalTransactionWindow, label: string): string | null {
  return window.fieldIdsByKey[transactionFieldKey(label)]?.[0] ?? null;
}

function windowFieldIds(window: LogicalTransactionWindow): Record<string, string | null> {
  return Object.fromEntries(
    Object.entries(window.fieldIdsByKey).map(([key, ids]) => [key, ids[0] ?? null]),
  );
}

function windowFieldOrders(window: LogicalTransactionWindow): Record<string, number | null> {
  return Object.fromEntries(
    Object.entries(window.fieldOrdersByKey).map(([key, orders]) => [key, orders[0] ?? null]),
  );
}

function fieldOrders(answers: AnyObj, fieldIds: Record<string, string | null>): Record<string, number | null> {
  return Object.fromEntries(
      Object.entries(fieldIds).map(([key, id]) => {
        const answerOrder = Number(id ? (answers[id] as AnyObj | undefined)?.order : NaN);
        return [key, Number.isFinite(answerOrder) && answerOrder > 0 ? answerOrder : id ? CC_FIELD_ORDER[id] ?? null : null];
      }),
  );
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

/**
 * Resolve the submission's OWN timestamp as an ISO string, tolerant of every
 * shape the submission object takes across call sites:
 *   - raw Jotform API submission:          `created_at` / `updated_at`
 *   - mapped submission (camelCase):        `createdAt`
 *   - normalized `jotformSubmissions` doc:  `jotformCreatedAt` / `jotformUpdatedAt`
 * Returns "" only when no usable submission timestamp exists, so callers keep
 * `new Date()` strictly as an absolute last resort — never the normal fallback.
 */
function submissionTimestampISO(sub: AnyObj): string {
  return (
    toISO(sub.created_at) ||
    toISO(sub.createdAt) ||
    toISO(sub.jotformCreatedAt) ||
    toISO(sub.updated_at) ||
    toISO(sub.jotformUpdatedAt) ||
    ""
  );
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
    transactionFields: {},
    rawStatus: asText(sub.status || ""),
    rawAnswers: answers,
    rawMeta: buildRawMeta(sub),
    extractionErrors: errors,
    extractionPath: path,
  };
}

// ─── Credit-card extraction ───────────────────────────────────────────────────

function extractCreditCard(
  sub: AnyObj,
  formId: string,
  formAlias: string,
  formTitle: string,
  transactionModel: TransactionWindowModel,
): ExtractedSpendItem[] {
  const answers = (sub.answers || {}) as AnyObj;
  const rawStatus = asText(sub.status || "");
  const returnSubmission = isReturnSubmission(answers);
  const createdAt =
    (returnSubmission ? toISO(getAns(answers, CC_SCHEMA.globals.returnDateTime)) : "") ||
    toISO(getAns(answers, CC_SCHEMA.globals.checkoutDateTime)) ||
    submissionTimestampISO(sub) ||
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
    const wioaCategory = asText(getAns(answers, tx.wioaCategory));
    const pathCategory = asText(getAns(answers, tx.pathCategory));
    const specifier = [tssCategory, wioaCategory, pathCategory].find(Boolean) || "";
    const customer = asText(getAns(answers, tx.customerName));
    const notes = asText(getAns(answers, tx.notes));
    const isFlexTxn = parseYes(getAns(answers, tx.flexToggle));
    const receiptFiles = getFiles(answers, tx.files);
    const additionalFileIds: readonly string[] = [];
    const additionalFiles = getFiles(answers, additionalFileIds);
    const txnFiles = Array.from(new Set([...receiptFiles, ...additionalFiles]));
    const program = programOperations || specifier || supportiveProgram;
    const returnFieldIds = {
      cardUsed: tx.cardUsed,
      merchant: tx.merchant,
      expenseType: tx.expenseType,
      supportiveProgram: tx.supportiveProgram,
      tssCategory: tx.tssCategory,
      wioaCategory: tx.wioaCategory,
      pathCategory: tx.pathCategory,
      flexToggle: tx.flexToggle,
      programOperations: tx.programOperations,
      customerName: tx.customerName,
      purpose: tx.purpose,
      cost: tx.cost,
      files: tx.files[0] ?? null,
      additionalFiles: additionalFileIds[0] ?? null,
      notes: tx.notes,
      email: tx.email,
    };
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
        fieldIds: returnFieldIds,
        fieldOrders: fieldOrders(answers, returnFieldIds),
      },
      merchant, expenseType, program,
      billedTo: "", project: "", purchasePath: "",
      card, cardBucket, txnNumber: null, purpose,
      paymentMethod: "", serviceType: "", otherService: "", serviceScope: "", wex: "", descriptor: "",
      customer, customerKey: makeCustomerKey(customer), purchaser, email,
      files: txnFiles, files_txn: txnFiles, files_uploadAll: [],
      files_typed: { ...emptyTypedFiles(), receipt: receiptFiles, required: additionalFiles },
      notes, note: "", rawStatus,
      transactionFields: {},
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

  for (let i = 0; i < transactionModel.windows.length; i++) {
    if (i >= txnLimit) break;
    const window = transactionModel.windows[i];
    const values = transactionValues(answers, window);
    const amountFieldId = txRawId(window, "Cost");
    const amountAbs = Math.abs(parseMoney(txText(values, "Cost"), errors, amountFieldId ?? undefined));
    const amount = amountAbs;
    const merchant = txText(values, "Merchant");
    const expenseType = txText(values, "Expense Type");
    const purpose = txText(values, "Purpose");
    const supportiveProgram = txText(values, "Supportive Services Program");
    const tssCategory = txText(values, "TSS Spend Category");
    const specifier = txSpecifierText(values) || tssCategory;
    const programOperations = txText(values, "Program Operations for:");
    const customer = txText(values, "Customer Name");
    const notes = txText(values, "Notes (optional)");
    const isFlexTxn = parseYes(txText(values, "Is this YHDP Flex Funds?"));
    const receiptFiles = getFiles(answers, CC_SCHEMA.transactions[i]?.files ?? []);
    const additionalFiles = getFiles(answers, CC_SCHEMA.transactions[i]?.additionalFiles ?? []);
    const txnFiles = Array.from(new Set([...receiptFiles, ...additionalFiles]));
    const uploadAllForTxn = i === 0 ? uploadAll : [];
    const files = Array.from(new Set([...txnFiles, ...uploadAllForTxn]));
    const txFieldIds = windowFieldIds(window);

    const program = expenseType.toLowerCase().includes("customer")
      ? supportiveProgram || specifier
      : programOperations || specifier || supportiveProgram;

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
      amountFieldId,
      extractionGroup: {
        kind: "purchase",
        index: i + 1,
        orderRange: window.orderRange,
        fieldIds: txFieldIds,
        fieldOrders: windowFieldOrders(window),
      },
      merchant, expenseType, program,
      billedTo: "", project: "", purchasePath: "",
      card, cardBucket, txnNumber: i + 1, purpose,
      paymentMethod: "", serviceType: "", otherService: "", serviceScope: "", wex: "", descriptor: "",
      customer, customerKey: makeCustomerKey(customer), purchaser, email,
      files, files_txn: txnFiles, files_uploadAll: uploadAllForTxn,
      files_typed: { ...emptyTypedFiles(), receipt: receiptFiles, required: additionalFiles },
      notes, note: "", rawStatus,
      transactionFields: values,
      rawAnswers: answers, rawMeta: buildRawMeta(sub),
      extractionErrors: errors,
      extractionPath: "hardcoded",
      _txnFlex: isFlexTxn,
    });
  }

  // Empty-txn fallback
  if (items.length === 0) {
    const window = transactionModel.windows[0];
    const values = transactionValues(answers, window);
    const amountFieldId = txRawId(window, "Cost");
    const amountAbs = Math.abs(parseMoney(txText(values, "Cost"), errors, amountFieldId ?? undefined));
    const amount = amountAbs;
    const isFlexTxn = parseYes(txText(values, "Is this YHDP Flex Funds?"));
    const receiptFiles = getFiles(answers, CC_SCHEMA.transactions[0]?.files ?? []);
    const additionalFiles = getFiles(answers, CC_SCHEMA.transactions[0]?.additionalFiles ?? []);
    const txnFiles = Array.from(new Set([...receiptFiles, ...additionalFiles]));
    const files = Array.from(new Set([...txnFiles, ...uploadAll]));
    const customer = txText(values, "Customer Name");
    const fallbackFieldIds = windowFieldIds(window);
    anyFlex = anyFlex || isFlexTxn;
    errors.push({ code: SPEND_ERR.EMPTY_RESULT, message: "No non-empty transactions found; using Tx1 as fallback" });
    items.push({
      id: `${sub.id}-t1`, baseId: asText(sub.id), submissionId: asText(sub.id),
      formId, formAlias, formTitle, schemaVersion: SCHEMA_VERSION,
      source: "credit-card", createdAt, month, amount, amountAbs,
      direction: "charge",
      directionFieldId: CC_SCHEMA.globals.type,
      amountFieldId,
      extractionGroup: {
        kind: "fallback",
        index: 1,
        orderRange: window.orderRange,
        fieldIds: fallbackFieldIds,
        fieldOrders: windowFieldOrders(window),
      },
      merchant: txText(values, "Merchant"),
      expenseType: txText(values, "Expense Type"),
      program: txText(values, "Supportive Services Program") || txText(values, "Program Operations for:") || txText(values, "TSS Spend Category"),
      billedTo: "", project: "", purchasePath: "",
      card, cardBucket, txnNumber: 1,
      purpose: txText(values, "Purpose"),
      paymentMethod: "", serviceType: "", otherService: "", serviceScope: "", wex: "", descriptor: "",
      customer, customerKey: makeCustomerKey(customer), purchaser, email,
      files, files_txn: txnFiles, files_uploadAll: uploadAll,
      files_typed: { ...emptyTypedFiles(), receipt: receiptFiles, required: additionalFiles },
      notes: txText(values, "Notes (optional)"),
      transactionFields: values,
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

function extractInvoice(
  sub: AnyObj,
  formId: string,
  formAlias: string,
  formTitle: string,
  transactionModel: TransactionWindowModel,
): ExtractedSpendItem[] {
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
    transactionFields: {},
    extractionErrors: errors, extractionPath: "hardcoded",
  };

  const rows = transactionModel.windows.map((window) => ({
    window,
    values: transactionValues(answers, window),
  }));

  // Customer path
  if (isCustomerPath) {
    const multi = parseYes(getAns(answers, INVOICE_SCHEMA.customerPath.multiToggle));
    if (multi) {
      const splits: ExtractedSpendItem[] = [];
      for (let i = 0; i < rows.length; i++) {
        const {values} = rows[i];
        const p = txText(values, "Project");
        const o = txText(values, "Other");
        const label = p && !/other/i.test(p) ? p : o || p;
        const amountFieldId = txRawId(rows[i].window, "Amount to bill");
        const amt = parseMoney(txText(values, "Amount to bill"), errors, amountFieldId ?? undefined);
        if (!label && !amt) continue;
        splits.push({
          ...common,
          id: `${sub.id}-${i}`,
          amount: amt,
          amountFieldId,
          program: label,
          billedTo: "",
          project: label,
          txnNumber: null,
          transactionFields: values,
          extractionGroup: {
            kind: "purchase",
            index: rows[i].window.index,
            orderRange: rows[i].window.orderRange,
            fieldIds: windowFieldIds(rows[i].window),
            fieldOrders: windowFieldOrders(rows[i].window),
          },
        });
      }
      if (splits.length) return splits;
    }
    const first = rows.find(({values}) => txText(values, "Project") || txText(values, "Other")) ?? rows[0];
    const project = first ? txText(first.values, "Project") : "";
    const projOther = first ? txText(first.values, "Other") : "";
    const program = projOther || project || "";
    return [{
      ...common,
      id: asText(sub.id),
      amount: costSingle,
      program,
      billedTo: "",
      project,
      txnNumber: null,
      transactionFields: first?.values ?? {},
      extractionGroup: first ? {
        kind: "fallback",
        index: first.window.index,
        orderRange: first.window.orderRange,
        fieldIds: windowFieldIds(first.window),
        fieldOrders: windowFieldOrders(first.window),
      } : undefined,
    }];
  }

  // Program path
  const multi = parseYes(getAns(answers, INVOICE_SCHEMA.programPath.multiToggle));

  if (multi) {
    const splits: ExtractedSpendItem[] = [];
    for (let i = 0; i < rows.length; i++) {
      const {values} = rows[i];
      const bt = txText(values, "Bill To");
      const other = txText(values, "Other");
      const label = bt && !/other/i.test(bt) ? bt : other || "";
      const amountFieldId = txRawId(rows[i].window, "Amount to bill");
      const amt = parseMoney(txText(values, "Amount to bill"), errors, amountFieldId ?? undefined);
      if (!label && !amt) continue;
      splits.push({
        ...common,
        id: `${sub.id}-${i}`,
        amount: amt,
        amountFieldId,
        program: label,
        billedTo: label,
        project: "",
        txnNumber: null,
        transactionFields: values,
        extractionGroup: {
          kind: "purchase",
          index: rows[i].window.index,
          orderRange: rows[i].window.orderRange,
          fieldIds: windowFieldIds(rows[i].window),
          fieldOrders: windowFieldOrders(rows[i].window),
        },
      });
    }
    if (splits.length) return splits;
  }

  const first = rows.find(({values}) => txText(values, "Bill To") || txText(values, "Other")) ?? rows[0];
  const bt0 = first ? txText(first.values, "Bill To") : "";
  const o0 = first ? txText(first.values, "Other") : "";
  const label = bt0 && !/other/i.test(bt0) ? bt0 : o0 || bt0;
  return [{
    ...common,
    id: asText(sub.id),
    amount: costSingle,
    program: label,
    billedTo: label,
    project: "",
    txnNumber: null,
    transactionFields: first?.values ?? {},
    extractionGroup: first ? {
      kind: "fallback",
      index: first.window.index,
      orderRange: first.window.orderRange,
      fieldIds: windowFieldIds(first.window),
      fieldOrders: windowFieldOrders(first.window),
    } : undefined,
  }];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract one or more SpendLineItems from a Jotform submission Firestore doc.
 * Never throws — always returns at least one item (possibly a fallback row).
 */
export function extractSpendItems(
  sub: AnyObj,
  transactionModel?: TransactionWindowModel,
): ExtractedSpendItem[] {
  const formId = String(sub?.form_id || sub?.formId || "").trim();
  const formAlias = String(sub?.formAlias || "").trim();
  const formTitle = String(sub?.formTitle || sub?.formAlias || "Jotform Submission").trim();

  if (!formId) {
    const err: SpendExtractionError = { code: SPEND_ERR.NO_FORM_ID, message: "submission.formId is empty" };
    return [buildFallbackRow(sub, formId, formAlias, formTitle, [err], "fallback")];
  }

  if (formId === SPENDING_FORM_IDS.creditCard) {
    if (!transactionModel) {
      throw new Error(`${SPEND_ERR.SCHEMA_MISMATCH}: missing live transaction window model for credit-card form`);
    }
    return extractCreditCard(sub, formId, formAlias, formTitle, transactionModel);
  }
  if (formId === SPENDING_FORM_IDS.invoice) {
    if (!transactionModel) {
      throw new Error(`${SPEND_ERR.SCHEMA_MISMATCH}: missing live transaction window model for invoice form`);
    }
    return extractInvoice(sub, formId, formAlias, formTitle, transactionModel);
  }

  const err: SpendExtractionError = {
    code: SPEND_ERR.UNKNOWN_FORM,
    message: `Unknown form ID "${formId}". Add to SPENDING_FORM_IDS or pass a digest.`,
  };
  return [buildFallbackRow(sub, formId, formAlias, formTitle, [err], "fallback")];
}
