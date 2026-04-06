/**
 * spendExtractor.ts
 *
 * Canonical spend-line extraction layer — TypeScript port of jotformMap.js +
 * formSchemas.js with the following guarantees:
 *
 *   1. Self-contained ledger records: every SpendLineItem captures the full raw
 *      text at extraction time, so if the Jotform form is later changed or
 *      retired the ledger entries remain valid forever.
 *
 *   2. Adaptable: primary path uses hardcoded schemas for the two known forms.
 *      When an unknown form ID is encountered, a caller-supplied digest schema
 *      (loaded from Firestore `jotformDigests/{formId}`) drives extraction with
 *      the same logic.  If no digest is available either, a safe fallback row is
 *      returned with an informative error code instead of throwing.
 *
 *   3. Error-transparent: every extraction result carries an `extractionErrors`
 *      array with structured codes — never silently swallows problems.
 *
 * Form ID source-of-truth (update when forms are replaced — old ledger entries
 * are unaffected because they store a snapshot of the extracted data):
 *
 *   Credit Card:  251878265158166
 *   Invoice:      252674777246167
 *
 * Schema version is stored on every SpendLineItem so a future re-extraction or
 * audit can know which mapping was in effect.
 */

// ─── Re-export schemas so callers only need one import ────────────────────────

export { CC_SCHEMA, INVOICE_SCHEMA, LINE_ITEMS_FORM_IDS } from "./lineItemsFormMap";
import { CC_SCHEMA, INVOICE_SCHEMA, LINE_ITEMS_FORM_IDS } from "./lineItemsFormMap";

// ─── Error codes ──────────────────────────────────────────────────────────────

export const SPEND_ERR = {
  /**  submission.form_id / formId is absent or empty string */
  NO_FORM_ID: "SPEND_ERR_NO_FORM_ID",

  /** form ID is present but not in hardcoded schemas AND no digest was supplied */
  UNKNOWN_FORM: "SPEND_ERR_UNKNOWN_FORM",

  /** digest was supplied but its schema block is incomplete / missing required keys */
  DIGEST_INCOMPLETE: "SPEND_ERR_DIGEST_INCOMPLETE",

  /** extraction ran but produced 0 items (e.g. all transactions were empty) */
  EMPTY_RESULT: "SPEND_ERR_EMPTY_RESULT",

  /** one or more fields could not be resolved cleanly — partial data returned */
  PARTIAL: "SPEND_ERR_PARTIAL",

  /**  amount could not be parsed as a finite number; stored as 0 */
  AMOUNT_UNPARSEABLE: "SPEND_ERR_AMOUNT_UNPARSEABLE",
} as const;

export type SpendErrCode = (typeof SPEND_ERR)[keyof typeof SPEND_ERR];

export type SpendExtractionError = {
  code: SpendErrCode;
  message: string;
  /** optional field key that triggered the error */
  fieldId?: string;
};

// ─── Canonical SpendLineItem ──────────────────────────────────────────────────
//
// This is the self-contained ledger record.  It is designed to be stored as a
// Firestore document or sub-document so that:
//   (a) full context is available for display without re-fetching the Jotform API
//   (b) ledger entries survive form changes / form retirement

export type SpendSource = "credit-card" | "invoice" | "unknown";

export type SpendLineItem = {
  // ── Identity ──────────────────────────────────────────────────────────────
  /**
   * Unique ID for this spend line.
   *   CC:      "{submissionId}-t{txnNumber}"
   *   Invoice: "{submissionId}" (single) or "{submissionId}-{splitIndex}"
   *   Unknown: "{submissionId}"
   */
  id: string;
  /** Jotform submission ID (parent) */
  baseId: string;
  submissionId: string;
  /** Jotform form ID at extraction time — persisted so audits know which form */
  formId: string;
  formAlias: string;
  formTitle: string;
  /**
   * Schema version used to extract this item.
   * Increment SCHEMA_VERSION below when a breaking change is made to extraction
   * logic so that old vs. new extractions can be distinguished.
   */
  schemaVersion: number;
  source: SpendSource;

  // ── Timing ────────────────────────────────────────────────────────────────
  /**
   * Canonical ISO datetime.
   * Priority: invoiceDate (inv) → submissionDate (inv) → created_at (both)
   */
  createdAt: string;
  /** YYYY-MM derived from createdAt */
  month: string;

  // ── Amount ────────────────────────────────────────────────────────────────
  /** Dollar amount (not cents) */
  amount: number;

  // ── Counterparty / vendor ─────────────────────────────────────────────────
  merchant: string;

  // ── Classification ────────────────────────────────────────────────────────
  expenseType: string;
  /** Resolved grant / program name (best-effort from form answers) */
  program: string;
  /** "For a Program" billed-to label */
  billedTo: string;
  /** "For a Customer" project label */
  project: string;
  /** Which invoice path was taken */
  purchasePath: "customer" | "program" | "";

  // ── Credit-card specific ──────────────────────────────────────────────────
  /** Canonical card label: "Youth Card", "Housing Card", "MAD Card", or raw value */
  card: string;
  /** Derived bucket: "Youth" | "Housing" | "MAD" | "" */
  cardBucket: "Youth" | "Housing" | "MAD" | "";
  /** 1-based transaction index within the submission (CC only; null for invoices) */
  txnNumber: number | null;
  purpose: string;

  // ── Invoice specific ──────────────────────────────────────────────────────
  paymentMethod: string;
  serviceType: string;
  otherService: string;
  /** "IS" | "OS" | "" */
  serviceScope: string;
  /** "WEX" | "Non-WEX" | "" */
  wex: string;
  /** Service descriptor (customer path only) */
  descriptor: string;

  // ── Customer ──────────────────────────────────────────────────────────────
  customer: string;
  /** Normalized key for Flex grouping / dedup (lowercase, no diacritics) */
  customerKey: string;

  // ── Contact ───────────────────────────────────────────────────────────────
  purchaser: string;
  email: string;

  // ── Flex tagging ──────────────────────────────────────────────────────────
  /** True if this specific transaction is a YHDP Flex transaction */
  isFlex: boolean;
  /** Human-readable reasons why isFlex was set */
  flexReasons: string[];
  /** True if ANY transaction in the parent submission is Flex */
  submissionIsFlex: boolean;

  // ── Files ─────────────────────────────────────────────────────────────────
  /** All file URLs merged across buckets */
  files: string[];
  /** Per-transaction file URLs */
  files_txn: string[];
  /** "Upload All" slot URLs (CC Tx1 only) */
  files_uploadAll: string[];
  /** Typed file buckets (invoice only) */
  files_typed: {
    receipt: string[];
    required: string[];
    agenda: string[];
    w9: string[];
  };

  // ── Notes / text ──────────────────────────────────────────────────────────
  /** Per-transaction notes (CC) */
  notes: string;
  /** Top-level invoice note */
  note: string;

  // ── Raw preservation (snapshot at extraction time) ────────────────────────
  /** Jotform submission status string ("ACTIVE", "DELETED", etc.) */
  rawStatus: string;
  /**
   * Full answers object at extraction time.
   * Storing this means we can re-derive any field later without re-fetching
   * the Jotform API, even if the form has been changed or retired.
   */
  rawAnswers: Record<string, unknown>;
  /**
   * Minimal submission metadata (id, form_id, status, created_at, updated_at).
   * Not the full submission — answers already captured above.
   */
  rawMeta: {
    id: string;
    form_id: string;
    status: string;
    created_at: string;
    updated_at?: string;
  };

  // ── Downstream linking (populated after extraction) ───────────────────────
  /** Linked Firestore grant ID (may be set at sync time or manually later) */
  grantId: string | null;
  /** Linked Firestore customer ID */
  customerId: string | null;
  /** Linked Firestore enrollment ID */
  enrollmentId: string | null;
  /** Linked ledger entry ID (set once this item has been posted to the ledger) */
  ledgerEntryId: string | null;

  // ── Invoice workflow ──────────────────────────────────────────────────────
  invoiceStatus: "pending" | "invoiced" | "void" | null;
  invoicedAt: string | null;
  invoicedBy: string | null;
  /** External invoice / reference number */
  invoiceRef: string | null;

  // ── Unmatched workflow ────────────────────────────────────────────────────
  /** User has explicitly approved leaving this item without a grant/customer link */
  okUnassigned: boolean;
  okUnassignedAt: string | null;
  okUnassignedBy: string | null;

  // ── Extraction audit ──────────────────────────────────────────────────────
  /** Non-empty when extraction was partial or fell back to a digest/unknown path */
  extractionErrors: SpendExtractionError[];
  /** "hardcoded" | "digest" | "fallback" */
  extractionPath: "hardcoded" | "digest" | "fallback";
};

// ─── Schema version ───────────────────────────────────────────────────────────
// Bump this when extraction logic changes in a way that might produce different
// output from the same raw answers.
const SCHEMA_VERSION = 1;

// ─── Helpers (TypeScript ports of formSchemas.js helpers) ────────────────────

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
    // datetime widget with year/month/day parts
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

function getFiles(answers: AnyObj, ids: string[]): string[] {
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

/** Canonical ISO datetime parser */
function toISO(s: unknown): string {
  if (!s) return "";
  const str = asText(s).trim();
  if (!str) return "";
  // "YYYY-MM-DD HH:mm..." → ISO
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(str)) return str.replace(" ", "T");
  // "MM/DD/YYYY [H:mm AM/PM]"
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
  if (!iso || iso.length < 7) return "";
  return iso.slice(0, 7);
}

/** Canonical card label */
function canonicalCard(v: unknown): string {
  const s = asText(v).trim().toLowerCase();
  if (s === "mad card") return "MAD Card";
  if (s === "youth card") return "Youth Card";
  if (s === "housing card") return "Housing Card";
  return asText(v).trim();
}

/** Card bucket from label */
function bucketCard(label: string): SpendLineItem["cardBucket"] {
  const s = label.toLowerCase();
  if (s.includes("youth")) return "Youth";
  if (s.includes("housing")) return "Housing";
  if (s.includes("mad")) return "MAD";
  return "";
}

/** Customer key for Flex grouping */
function makeCustomerKey(s: unknown): string {
  return asText(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Flex detection: scans all answer values for text signals + per-txn flags */
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

/** Empty typed files object */
function emptyTypedFiles() {
  return { receipt: [] as string[], required: [] as string[], agenda: [] as string[], w9: [] as string[] };
}

/** Shared downstream-linking defaults (all null / false at extraction time) */
function linkingDefaults(): Pick<
  SpendLineItem,
  | "grantId"
  | "customerId"
  | "enrollmentId"
  | "ledgerEntryId"
  | "invoiceStatus"
  | "invoicedAt"
  | "invoicedBy"
  | "invoiceRef"
  | "okUnassigned"
  | "okUnassignedAt"
  | "okUnassignedBy"
> {
  return {
    grantId: null,
    customerId: null,
    enrollmentId: null,
    ledgerEntryId: null,
    invoiceStatus: null,
    invoicedAt: null,
    invoicedBy: null,
    invoiceRef: null,
    okUnassigned: false,
    okUnassignedAt: null,
    okUnassignedBy: null,
  };
}

// ─── Raw-meta snapshot helper ─────────────────────────────────────────────────

function rawMeta(sub: AnyObj): SpendLineItem["rawMeta"] {
  return {
    id: asText(sub.id || sub.submission_id || ""),
    form_id: asText(sub.form_id || sub.formId || ""),
    status: asText(sub.status || ""),
    created_at: asText(sub.created_at || ""),
    updated_at: asText(sub.updated_at || "") || undefined,
  };
}

// ─── Credit-card extraction ───────────────────────────────────────────────────

function extractCreditCard(
  sub: AnyObj,
  formId: string,
  formAlias: string,
  formTitle: string,
): SpendLineItem[] {
  const answers = ((sub.answers || {}) as AnyObj);
  const rawStatus = asText(sub.status || "");
  const createdAt =
    toISO(getAns(answers, CC_SCHEMA.globals.checkoutDateTime)) ||
    toISO(sub.created_at) ||
    new Date().toISOString();
  const month = toMonth(createdAt);

  const cardUsed = canonicalCard(getAns(answers, CC_SCHEMA.globals.cardUsed));
  const cardChoice = canonicalCard(getAns(answers, CC_SCHEMA.globals.cardChoice));
  const card = cardUsed || cardChoice || "Card";
  const cardBucket = bucketCard(card);

  const purchaser = asText(getAns(answers, CC_SCHEMA.globals.purchaserName));
  const email = asText(getAns(answers, CC_SCHEMA.globals.email));

  const uploadAll = getFiles(answers, [CC_SCHEMA.globals.uploadAllTxn1]);

  // Count declared transactions
  const countRaw = asText(getAns(answers, CC_SCHEMA.globals.txnCount)).toLowerCase();
  const countMap: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };
  const txnLimit = countMap[Object.keys(countMap).find((k) => countRaw.includes(k)) ?? ""] ?? 5;

  let anyFlex = false;
  const items: Array<Omit<SpendLineItem, "submissionIsFlex" | "isFlex" | "flexReasons"> & { _txnFlex: boolean }> = [];
  const errors: SpendExtractionError[] = [];

  for (let i = 0; i < CC_SCHEMA.transactions.length; i++) {
    if (i >= txnLimit) break;
    const tx = CC_SCHEMA.transactions[i];

    const amount = parseMoney(getAns(answers, tx.cost), errors, tx.cost);
    const merchant = asText(getAns(answers, tx.merchant));
    const expenseType = asText(getAns(answers, tx.expenseType));
    const purpose = asText(getAns(answers, tx.purpose));
    const supportiveProgram = asText(getAns(answers, tx.supportiveProgram));
    const programOperations = asText(getAns(answers, tx.programOperations ?? null));
    const customer = asText(getAns(answers, tx.customerName));
    const notes = tx.notes ? asText(getAns(answers, tx.notes)) : "";
    const isFlexTxn = parseYes(getAns(answers, tx.flexToggle));
    const txnFiles = getFiles(answers, (tx.files as string[]) || []);
    const uploadAllForTxn = i === 0 ? uploadAll : [];
    const files = Array.from(new Set([...txnFiles, ...uploadAllForTxn]));

    // Determine program: customer expense → supportiveProgram, otherwise programOperations
    const expLower = expenseType.toLowerCase();
    const programPrimary = expLower.includes("customer")
      ? supportiveProgram
      : programOperations;
    const program = programPrimary || supportiveProgram || programOperations;

    // Skip truly empty transaction slots (uploadAll alone doesn't create a txn)
    const hasCore = merchant || expenseType || supportiveProgram || programOperations || purpose || amount !== 0 || txnFiles.length > 0;
    if (!hasCore) continue;

    anyFlex = anyFlex || isFlexTxn;

    items.push({
      id: `${sub.id}-t${i + 1}`,
      baseId: asText(sub.id),
      submissionId: asText(sub.id),
      formId,
      formAlias,
      formTitle,
      schemaVersion: SCHEMA_VERSION,
      source: "credit-card",
      createdAt,
      month,
      amount,
      merchant,
      expenseType,
      program,
      billedTo: "",
      project: "",
      purchasePath: "",
      card,
      cardBucket,
      txnNumber: i + 1,
      purpose,
      paymentMethod: "",
      serviceType: "",
      otherService: "",
      serviceScope: "",
      wex: "",
      descriptor: "",
      customer,
      customerKey: makeCustomerKey(customer),
      purchaser,
      email,
      files,
      files_txn: txnFiles,
      files_uploadAll: uploadAllForTxn,
      files_typed: emptyTypedFiles(),
      notes,
      note: "",
      rawStatus,
      rawAnswers: answers,
      rawMeta: rawMeta(sub),
      extractionErrors: errors,
      extractionPath: "hardcoded",
      ...linkingDefaults(),
      _txnFlex: isFlexTxn,
    });
  }

  // If every txn was empty, emit a single fallback row
  if (items.length === 0) {
    const tx0 = CC_SCHEMA.transactions[0];
    const amount = parseMoney(getAns(answers, tx0.cost), errors, tx0.cost);
    const isFlexTxn = parseYes(getAns(answers, tx0.flexToggle));
    const txnFiles = getFiles(answers, (tx0.files as string[]) || []);
    const files = Array.from(new Set([...txnFiles, ...uploadAll]));
    const customer = asText(getAns(answers, tx0.customerName));
    anyFlex = anyFlex || isFlexTxn;
    errors.push({ code: SPEND_ERR.EMPTY_RESULT, message: "No non-empty transactions found; using Tx1 as fallback" });
    items.push({
      id: `${sub.id}-t1`,
      baseId: asText(sub.id),
      submissionId: asText(sub.id),
      formId,
      formAlias,
      formTitle,
      schemaVersion: SCHEMA_VERSION,
      source: "credit-card",
      createdAt,
      month,
      amount,
      merchant: asText(getAns(answers, tx0.merchant)),
      expenseType: asText(getAns(answers, tx0.expenseType)),
      program: asText(getAns(answers, tx0.supportiveProgram)) || asText(getAns(answers, tx0.programOperations ?? null)),
      billedTo: "",
      project: "",
      purchasePath: "",
      card,
      cardBucket,
      txnNumber: 1,
      purpose: asText(getAns(answers, tx0.purpose)),
      paymentMethod: "",
      serviceType: "",
      otherService: "",
      serviceScope: "",
      wex: "",
      descriptor: "",
      customer,
      customerKey: makeCustomerKey(customer),
      purchaser,
      email,
      files,
      files_txn: txnFiles,
      files_uploadAll: uploadAll,
      files_typed: emptyTypedFiles(),
      notes: tx0.notes ? asText(getAns(answers, tx0.notes)) : "",
      note: "",
      rawStatus,
      rawAnswers: answers,
      rawMeta: rawMeta(sub),
      extractionErrors: errors,
      extractionPath: "hardcoded",
      ...linkingDefaults(),
      _txnFlex: isFlexTxn,
    });
  }

  // Overlay submission-level flex onto each item
  const subFlex = computeFlex(answers, { anyFlexTxn: anyFlex });
  return items.map(({ _txnFlex, ...item }) => ({
    ...item,
    isFlex: _txnFlex || subFlex.isFlex,
    submissionIsFlex: anyFlex,
    flexReasons: Array.from(new Set([
      ...(_txnFlex ? ["txn:flex"] : []),
      ...subFlex.reasons,
    ])),
  }));
}

// ─── Invoice extraction ───────────────────────────────────────────────────────

function extractInvoice(
  sub: AnyObj,
  formId: string,
  formAlias: string,
  formTitle: string,
): SpendLineItem[] {
  const answers = ((sub.answers || {}) as AnyObj);
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

  // Files (typed)
  const files_typed = {
    receipt: getFiles(answers, [INVOICE_SCHEMA.globals.files.receipt]),
    required: getFiles(answers, [INVOICE_SCHEMA.globals.files.required]),
    agenda: getFiles(answers, [INVOICE_SCHEMA.globals.files.agenda]),
    w9: getFiles(answers, [INVOICE_SCHEMA.globals.files.w9]),
  };
  const filesAll = [...files_typed.receipt, ...files_typed.required, ...files_typed.agenda, ...files_typed.w9];

  // WIOA scope/wex
  const wioaRaw = asText(getAns(answers, INVOICE_SCHEMA.globals.wioaScopeWex));
  let serviceScope = "";
  let wex = "";
  if (wioaRaw) {
    const w = wioaRaw.toUpperCase();
    serviceScope = w.includes("IS") ? "IS" : w.includes("OS") ? "OS" : "";
    wex = w.includes("NON-WEX") ? "Non-WEX" : w.includes("WEX") ? "WEX" : "";
  }

  // Customer name
  const cFirst = asText(getAns(answers, INVOICE_SCHEMA.globals.firstName));
  const cLast = asText(getAns(answers, INVOICE_SCHEMA.globals.lastName));
  const customer = [cFirst, cLast].filter(Boolean).join(" ").trim();

  const isFlex =
    /yhdp\s*flex/i.test(serviceType) ||
    /yhdp\s*flex/i.test(otherService);
  const subFlex = computeFlex(answers, { forceFlex: isFlex });

  const errors: SpendExtractionError[] = [];

  const isCustomerPath = /^for\s+a\s+customer/i.test(expenseType);
  const purchasePath: SpendLineItem["purchasePath"] = isCustomerPath ? "customer" : "program";

  const descriptor = isCustomerPath ? serviceType || otherService : "";

  const common: Omit<SpendLineItem, "id" | "amount" | "program" | "billedTo" | "project" | "txnNumber"> = {
    baseId: asText(sub.id),
    submissionId: asText(sub.id),
    formId,
    formAlias,
    formTitle,
    schemaVersion: SCHEMA_VERSION,
    source: "invoice",
    createdAt,
    month,
    merchant: vendor,
    expenseType,
    purchasePath,
    card: "",
    cardBucket: "",
    purpose: "",
    paymentMethod,
    serviceType,
    otherService,
    serviceScope,
    wex,
    descriptor,
    customer,
    customerKey: makeCustomerKey(customer),
    purchaser,
    email,
    isFlex: subFlex.isFlex,
    flexReasons: subFlex.reasons,
    submissionIsFlex: subFlex.isFlex,
    files: filesAll,
    files_txn: [],
    files_uploadAll: [],
    files_typed,
    notes: "",
    note,
    rawStatus,
    rawAnswers: answers,
    rawMeta: rawMeta(sub),
    extractionErrors: errors,
    extractionPath: "hardcoded",
    ...linkingDefaults(),
  };

  // ── Customer path ──────────────────────────────────────────────────────────
  if (isCustomerPath) {
    const multi = parseYes(getAns(answers, INVOICE_SCHEMA.customerPath.multiToggle));
    if (multi) {
      const projects = (INVOICE_SCHEMA.customerPath.projects as readonly string[]).map((id) => asText(getAns(answers, id)));
      const projOther = (INVOICE_SCHEMA.customerPath.projectOther as readonly string[]).map((id) => asText(getAns(answers, id)));
      const amounts = (INVOICE_SCHEMA.customerPath.amounts as readonly string[]).map((id) => parseMoney(getAns(answers, id), errors, id));
      const splits: SpendLineItem[] = [];
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

  // ── Program path ──────────────────────────────────────────────────────────
  const multi = parseYes(getAns(answers, INVOICE_SCHEMA.programPath.multiToggle));
  const billTo = (INVOICE_SCHEMA.programPath.billToList as readonly string[]).map((id) => asText(getAns(answers, id)));
  const billToOther = (INVOICE_SCHEMA.programPath.billToOther as readonly string[]).map((id) => asText(getAns(answers, id)));
  const amounts = (INVOICE_SCHEMA.programPath.amounts as readonly string[]).map((id) => parseMoney(getAns(answers, id), errors, id));

  if (multi) {
    const splits: SpendLineItem[] = [];
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

// ─── Digest-driven extraction (adaptable fallback) ────────────────────────────
//
// When a new form is introduced, load its digest from Firestore and pass it here.
// The digest stores the schema in the same shape as CC_SCHEMA / INVOICE_SCHEMA so
// this function stays schema-version-agnostic.
//
// Supported digest shapes (stored in `digest.schema`):
//   CC-like:       { globals: { cardUsed, purchaserName, email, txnCount, ... }, transactions: [...] }
//   Invoice-like:  { globals: { vendor, expenseType, invoiceDate, ... }, customerPath, programPath }
//
// If the digest schema is missing or incomplete, returns a fallback row with
// SPEND_ERR_DIGEST_INCOMPLETE.

type DigestSchema = {
  globals?: AnyObj;
  transactions?: AnyObj[];
  customerPath?: AnyObj;
  programPath?: AnyObj;
};

type JotformDigest = {
  formId?: string;
  formAlias?: string;
  formTitle?: string;
  schemaKind?: string;
  schema?: DigestSchema;
};

function extractFromDigest(sub: AnyObj, digest: JotformDigest): SpendLineItem[] {
  const formId = asText(sub.form_id || sub.formId || digest.formId || "");
  const formAlias = asText(sub.formAlias || digest.formAlias || "");
  const formTitle = asText(sub.formTitle || digest.formTitle || "");
  const answers = ((sub.answers || {}) as AnyObj);
  const schema = digest.schema || {};
  const globals = (schema.globals || {}) as AnyObj;
  const errors: SpendExtractionError[] = [];

  if (!globals || Object.keys(globals).length === 0) {
    errors.push({ code: SPEND_ERR.DIGEST_INCOMPLETE, message: "Digest schema.globals is empty — cannot extract fields" });
    return [buildFallbackRow(sub, formId, formAlias, formTitle, errors, "digest")];
  }

  const rawStatus = asText(sub.status || "");
  const createdAt =
    toISO(getAns(answers, asText(globals.invoiceDate))) ||
    toISO(getAns(answers, asText(globals.submissionDate))) ||
    toISO(getAns(answers, asText(globals.checkoutDateTime))) ||
    toISO(sub.created_at) ||
    new Date().toISOString();
  const month = toMonth(createdAt);

  const schemaKind = asText(digest.schemaKind).toLowerCase();

  // ── CC-like path ──────────────────────────────────────────────────────────
  if (schemaKind === "credit-card" || Array.isArray(schema.transactions)) {
    const transactions = (schema.transactions || []) as AnyObj[];
    if (!transactions.length) {
      errors.push({ code: SPEND_ERR.DIGEST_INCOMPLETE, message: "Digest has schemaKind=credit-card but no transactions array" });
      return [buildFallbackRow(sub, formId, formAlias, formTitle, errors, "digest")];
    }

    const card = canonicalCard(getAns(answers, asText(globals.cardUsed))) ||
      canonicalCard(getAns(answers, asText(globals.cardChoice))) || "Card";
    const cardBucket = bucketCard(card);
    const purchaser = asText(getAns(answers, asText(globals.purchaserName)));
    const email = asText(getAns(answers, asText(globals.email)));
    const uploadAll = getFiles(answers, [asText(globals.uploadAllTxn1)].filter(Boolean));
    const countRaw = asText(getAns(answers, asText(globals.txnCount))).toLowerCase();
    const cMap: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };
    const txnLimit = cMap[Object.keys(cMap).find((k) => countRaw.includes(k)) ?? ""] ?? transactions.length;

    let anyFlex = false;
    const items: SpendLineItem[] = [];

    for (let i = 0; i < transactions.length; i++) {
      if (i >= txnLimit) break;
      const tx = transactions[i];
      const amount = parseMoney(getAns(answers, asText(tx.cost)), errors, asText(tx.cost));
      const merchant = asText(getAns(answers, asText(tx.merchant)));
      const expenseType = asText(getAns(answers, asText(tx.expenseType)));
      const purpose = asText(getAns(answers, asText(tx.purpose)));
      const supportiveProgram = asText(getAns(answers, asText(tx.supportiveProgram)));
      const programOperations = asText(getAns(answers, asText(tx.programOperations)));
      const customer = asText(getAns(answers, asText(tx.customerName)));
      const notes = asText(getAns(answers, asText(tx.notes)));
      const isFlexTxn = parseYes(getAns(answers, asText(tx.flexToggle)));
      const txnFileIds = (Array.isArray(tx.files) ? tx.files : [asText(tx.files)]).filter(Boolean).map(asText);
      const txnFiles = getFiles(answers, txnFileIds);
      const uploadAllForTxn = i === 0 ? uploadAll : [];
      const files = Array.from(new Set([...txnFiles, ...uploadAllForTxn]));
      const program = expenseType.toLowerCase().includes("customer") ? supportiveProgram : programOperations || supportiveProgram;
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
        createdAt, month,
        amount, merchant, expenseType, program,
        billedTo: "", project: "", purchasePath: "",
        card, cardBucket,
        txnNumber: i + 1,
        purpose,
        paymentMethod: "", serviceType: "", otherService: "", serviceScope: "", wex: "", descriptor: "",
        customer, customerKey: makeCustomerKey(customer),
        purchaser, email,
        isFlex: isFlexTxn, flexReasons: isFlexTxn ? ["txn:flex"] : [], submissionIsFlex: false,
        files, files_txn: txnFiles, files_uploadAll: uploadAllForTxn,
        files_typed: emptyTypedFiles(),
        notes, note: "",
        rawStatus, rawAnswers: answers, rawMeta: rawMeta(sub),
        extractionErrors: errors,
        extractionPath: "digest",
        ...linkingDefaults(),
      });
    }

    const subFlex = computeFlex(answers, { anyFlexTxn: anyFlex });
    return (items.length ? items : [buildFallbackRow(sub, formId, formAlias, formTitle,
      [...errors, { code: SPEND_ERR.EMPTY_RESULT, message: "Digest CC extraction produced 0 items" }], "digest")]).map((it) => ({
      ...it,
      isFlex: it.isFlex || subFlex.isFlex,
      submissionIsFlex: anyFlex,
      flexReasons: Array.from(new Set([...it.flexReasons, ...subFlex.reasons])),
    }));
  }

  // ── Invoice-like path ─────────────────────────────────────────────────────
  const vendor = asText(getAns(answers, asText(globals.vendor)));
  const expenseType = asText(getAns(answers, asText(globals.expenseType)));
  const purchaser = asText(getAns(answers, asText(globals.purchaser)));
  const paymentMethod = asText(getAns(answers, asText(globals.paymentMethod)));
  const email = asText(getAns(answers, asText(globals.email)));
  const note = asText(getAns(answers, asText(globals.note)));
  const costSingle = parseMoney(getAns(answers, asText(globals.costSingle)));
  const customer = [asText(getAns(answers, asText(globals.firstName))), asText(getAns(answers, asText(globals.lastName)))].filter(Boolean).join(" ");
  const serviceType = asText(getAns(answers, asText(globals.serviceType)));
  const otherService = asText(getAns(answers, asText(globals.otherService)));
  const isFlex = /yhdp\s*flex/i.test(serviceType) || /yhdp\s*flex/i.test(otherService);
  const subFlex = computeFlex(answers, { forceFlex: isFlex });
  const isCustomerPath = /^for\s+a\s+customer/i.test(expenseType);

  const fileGlobals = (globals.files || {}) as AnyObj;
  const files_typed = {
    receipt: getFiles(answers, [asText(fileGlobals.receipt)].filter(Boolean)),
    required: getFiles(answers, [asText(fileGlobals.required)].filter(Boolean)),
    agenda: getFiles(answers, [asText(fileGlobals.agenda)].filter(Boolean)),
    w9: getFiles(answers, [asText(fileGlobals.w9)].filter(Boolean)),
  };
  const filesAll = [...files_typed.receipt, ...files_typed.required, ...files_typed.agenda, ...files_typed.w9];

  errors.push({ code: SPEND_ERR.PARTIAL, message: "Digest invoice path used — split resolution may be incomplete if customerPath/programPath schema missing" });

  return [{
    id: asText(sub.id),
    baseId: asText(sub.id),
    submissionId: asText(sub.id),
    formId, formAlias, formTitle,
    schemaVersion: SCHEMA_VERSION,
    source: "invoice",
    createdAt, month,
    amount: costSingle,
    merchant: vendor,
    expenseType,
    program: isCustomerPath ? "" : asText(getAns(answers, asText((schema.programPath as AnyObj | undefined)?.billToList))),
    billedTo: "",
    project: "",
    purchasePath: isCustomerPath ? "customer" : "program",
    card: "", cardBucket: "", txnNumber: null,
    purpose: "", paymentMethod, serviceType, otherService,
    serviceScope: "", wex: "",
    descriptor: isCustomerPath ? serviceType : "",
    customer, customerKey: makeCustomerKey(customer),
    purchaser, email,
    isFlex: subFlex.isFlex, flexReasons: subFlex.reasons, submissionIsFlex: subFlex.isFlex,
    files: filesAll, files_txn: [], files_uploadAll: [], files_typed,
    notes: "", note,
    rawStatus, rawAnswers: answers, rawMeta: rawMeta(sub),
    extractionErrors: errors,
    extractionPath: "digest",
    ...linkingDefaults(),
  }];
}

// ─── Fallback row ─────────────────────────────────────────────────────────────

function buildFallbackRow(
  sub: AnyObj,
  formId: string,
  formAlias: string,
  formTitle: string,
  errors: SpendExtractionError[],
  path: SpendLineItem["extractionPath"],
): SpendLineItem {
  const answers = ((sub.answers || {}) as AnyObj);
  const rawStatus = asText(sub.status || "");
  const createdAt = toISO(sub.created_at) || new Date().toISOString();
  // Best-effort customer guess from first non-empty answer
  let customerGuess = "";
  for (const v of Object.values(answers)) {
    if (!v || typeof v !== "object") continue;
    const a = asText((v as AnyObj).answer);
    if (a && a.length > 0) { customerGuess = a; break; }
  }
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
    merchant: "",
    expenseType: "",
    program: "",
    billedTo: "",
    project: "",
    purchasePath: "",
    card: "",
    cardBucket: "",
    txnNumber: null,
    purpose: "",
    paymentMethod: "",
    serviceType: "",
    otherService: "",
    serviceScope: "",
    wex: "",
    descriptor: "",
    customer: customerGuess,
    customerKey: makeCustomerKey(customerGuess),
    purchaser: "",
    email: "",
    isFlex: false,
    flexReasons: [],
    submissionIsFlex: false,
    files: [],
    files_txn: [],
    files_uploadAll: [],
    files_typed: emptyTypedFiles(),
    notes: "",
    note: "",
    rawStatus,
    rawAnswers: answers,
    rawMeta: rawMeta(sub),
    extractionErrors: errors,
    extractionPath: path,
    ...linkingDefaults(),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type ExtractOptions = {
  /**
   * If provided, used as the fallback extraction schema when the form ID is not
   * recognized.  Caller is responsible for fetching this from Firestore
   * (`jotformDigests/{formId}`) before calling.  Pass `null` explicitly to
   * suppress the UNKNOWN_FORM fallback fetch warning.
   */
  digest?: JotformDigest | null;
};

/**
 * Extract one or more `SpendLineItem` records from a Jotform submission.
 *
 * Extraction path priority:
 *   1. Hardcoded CC schema      (form ID 251878265158166)
 *   2. Hardcoded Invoice schema (form ID 252674777246167)
 *   3. Digest-driven extraction (caller-supplied digest)
 *   4. Fallback single row with SPEND_ERR codes
 *
 * NEVER throws — always returns at least one item.  Check
 * `item.extractionErrors` to understand partial or failed extractions.
 *
 * The `rawAnswers` field on every returned item is a snapshot of the full
 * Jotform answers object at extraction time, so the ledger record remains
 * self-contained even if the Jotform form is later changed or retired.
 */
export function extractSpendLineItems(
  submission: AnyObj,
  opts: ExtractOptions = {},
): SpendLineItem[] {
  const formId = asText(submission?.form_id || submission?.formId || "").trim();
  const formAlias = asText(submission?.formAlias || "");
  const formTitle = asText(submission?.formTitle || "");

  // 1. No form ID at all
  if (!formId) {
    return [buildFallbackRow(
      submission, "", formAlias, formTitle,
      [{ code: SPEND_ERR.NO_FORM_ID, message: "submission.form_id is absent or empty" }],
      "fallback",
    )];
  }

  // 2. Known CC form
  if (formId === LINE_ITEMS_FORM_IDS.creditCard) {
    return extractCreditCard(submission, formId, formAlias, formTitle);
  }

  // 3. Known Invoice form
  if (formId === LINE_ITEMS_FORM_IDS.invoice) {
    return extractInvoice(submission, formId, formAlias, formTitle);
  }

  // 4. Digest-driven (caller fetched digest from Firestore)
  if (opts.digest) {
    return extractFromDigest(submission, opts.digest);
  }

  // 5. Unknown + no digest
  const errors: SpendExtractionError[] = [
    {
      code: SPEND_ERR.UNKNOWN_FORM,
      message:
        `Form ID "${formId}" is not in the hardcoded schemas and no digest was supplied. ` +
        `To fix: (a) update LINE_ITEMS_FORM_IDS if the form was replaced, or ` +
        `(b) create a jotformDigests/${formId} document via the Jotform Workbench tool and pass it as opts.digest.`,
      fieldId: "form_id",
    },
  ];
  return [buildFallbackRow(submission, formId, formAlias, formTitle, errors, "fallback")];
}

/**
 * Quick check: is this submission extractable with full fidelity?
 * Returns true if we have a hardcoded schema OR a valid digest for it.
 */
export function isKnownSpendForm(submission: AnyObj, digest?: JotformDigest | null): boolean {
  const formId = asText(submission?.form_id || submission?.formId || "").trim();
  if (!formId) return false;
  if (formId === LINE_ITEMS_FORM_IDS.creditCard || formId === LINE_ITEMS_FORM_IDS.invoice) return true;
  return !!(digest?.schema && Object.keys(digest.schema).length > 0);
}

/**
 * Compute the total spend amount across all SpendLineItems extracted from one
 * submission (sum of item.amount).  Returns 0 for fallback/unknown items.
 */
export function totalSpendAmount(items: SpendLineItem[]): number {
  return items.reduce((s, it) => s + (it.source !== "unknown" ? it.amount : 0), 0);
}

/**
 * True if the submission has any unresolved extraction errors that indicate
 * the ledger entry is missing data that a human should review.
 */
export function needsReview(items: SpendLineItem[]): boolean {
  return items.some(
    (it) => it.extractionErrors.some(
      (e) => e.code !== SPEND_ERR.PARTIAL || it.source === "unknown",
    ),
  );
}
