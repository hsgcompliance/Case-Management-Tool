"use client";

export type RegexExtractionField =
  | "staffPrefix"
  | "paymentType"
  | "customerName"
  | "vendor"
  | "serviceMonth"
  | "memo";

export type RegexExtractionPattern = {
  id: string;
  label: string;
  pattern: string;
  flags?: string;
};

export type RegexExtractionResult = {
  patternId: string;
  patternLabel: string;
  fields: Partial<Record<RegexExtractionField, string>>;
};

export const DEFAULT_FE_REFERENCE_PATTERNS: RegexExtractionPattern[] = [
  {
    id: "staff-type-vendor-month",
    label: "Staff + type + vendor + month",
    pattern: "^(?<staffPrefix>[A-Z]\\.\\s*[^\\s]+)\\s+(?<paymentType>.*?)(?:-|\\s{2,})(?<vendor>.*?)-(?<serviceMonth>[A-Z]{3}\\d{2})$",
    flags: "i",
  },
  {
    id: "staff-type-customer-month",
    label: "Staff + type + customer + month",
    pattern: "^(?<staffPrefix>[A-Z]\\.\\s*[^\\s]+)\\s+(?<paymentType>.*?)-(?<customerName>.*?)-(?<serviceMonth>[A-Z]{3}\\d{2})$",
    flags: "i",
  },
  {
    id: "loose-final-month",
    label: "Loose final month signal",
    pattern: "^(?<memo>.*?)(?:-|\\s)(?<serviceMonth>[A-Z]{3}\\d{2})$",
    flags: "i",
  },
];

export function parseFinancialEdgeReference(
  reference: unknown,
  patterns: RegexExtractionPattern[] = DEFAULT_FE_REFERENCE_PATTERNS,
): RegexExtractionResult | null {
  const value = String(reference ?? "").trim();
  if (!value) return null;
  for (const pattern of patterns) {
    try {
      const regex = new RegExp(pattern.pattern, pattern.flags || "");
      const match = regex.exec(value);
      if (!match?.groups) continue;
      const fields = Object.fromEntries(
        Object.entries(match.groups)
          .map(([key, raw]) => [key, String(raw ?? "").trim()] as const)
          .filter(([, raw]) => raw),
      ) as Partial<Record<RegexExtractionField, string>>;
      if (Object.keys(fields).length) return { patternId: pattern.id, patternLabel: pattern.label, fields };
    } catch {
      continue;
    }
  }
  return null;
}

export type FinancialEdgeRowClassification = {
  keep: boolean;
  category: "customer-payment" | "scrap";
  /**
   * Only for kept rows: "named" = the reference leads with a client name;
   * "unposted" = pending/placeholder reference (e.g. "Unposted Accounts Payable
   * Invoice") — still a real client payment, match by amount + date, no name.
   */
  paymentKind?: "named" | "unposted";
  reason: string;
  /** The scrap term or billable category that decided the classification. */
  term?: string;
};

const FE_SUMMARY_SCRAP_TERMS = [
  "beginning balance",
  "ending balance",
  "adjustments to balance",
  "totals for",
  "subtotal",
  "journal entry",
];

// Leading GL category stems only. Never key on "rental", "assistance", or
// "direct svcs" — scrap rows carry suffixes like "Salaries-Direct Svcs-Rental
// Assistance", so the decision must ride on the leading term.
const FE_OVERHEAD_SCRAP_TERMS = [
  "payroll", "salar", "wage", "fica", "accrued", "med ins", "medical ins",
  "work comp", "workers comp", "unemploy", "401k", "retire", "pension", "fringe", "benefit",
  "space cost", "allocation", "indirect", "overhead", "communicat", "depreciat", "occupancy",
];

/**
 * Fallback client-service categories, used in addition to (or in absence of)
 * billable categories sourced from grant budget line items. Additive-only:
 * over-keeping surfaces an unmatched row, over-scrapping silently loses a payment.
 */
export const FE_FALLBACK_BILLABLE_CATEGORIES = [
  "housing assistance", "rental assistance", "rental deposit", "security deposit",
  "intra company rent", "utilities assistance", "basic education",
  "preventive svc", "medium term", "arrears",
];

// "A. Guss …", "J.Patterson …", "C. Red Hat …", "Kevin Coyle …"
const FE_PERSON_REFERENCE_RE = /^\s*(?:[A-Za-z]\.\s*[A-Z]|[A-Z][a-z]+\s+[A-Z][a-z])/;
const FE_UNPOSTED_REFERENCE_RE = /unposted|accounts payable/i;

function feText(value: unknown) {
  return String(value ?? "").trim();
}

function feNormalize(value: unknown) {
  return feText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function findScrapTerm(normalizedValue: string, terms: string[]) {
  if (!normalizedValue) return "";
  return terms.find((term) => normalizedValue.includes(term)) ?? "";
}

function categoryMatches(description: string, category: string) {
  if (!description || !category) return false;
  if (description.includes(category)) return true;
  // "Rental Deposit Assist" should hit line item "Rental Deposit Assistance".
  return description.length >= 6 && category.includes(description);
}

/**
 * Billable/budgeted spend categories for FE keep/scrap classification, sourced
 * from grant names + grant budget line-item labels so recognized categories
 * stay in sync with real grant config.
 */
export function billableCategoriesFromGrants(grants: Array<Record<string, unknown>>): string[] {
  const out = new Set<string>();
  for (const grant of grants ?? []) {
    if (!grant || typeof grant !== "object") continue;
    for (const name of [grant.name, grant.grantName, grant.label, grant.title]) {
      const value = feNormalize(name);
      if (value.length >= 4) out.add(value);
    }
    const budget = grant.budget && typeof grant.budget === "object" ? grant.budget as Record<string, unknown> : null;
    const lineItems = budget && Array.isArray(budget.lineItems) ? budget.lineItems as Array<Record<string, unknown>> : [];
    for (const item of lineItems) {
      if (!item || typeof item !== "object") continue;
      const label = feNormalize(item.label ?? item.name);
      if (label.length >= 4) out.add(label);
    }
  }
  return Array.from(out);
}

/**
 * Classify a Financial Edge Project Activity row for payment reconciliation.
 * Description category is the primary decision (scrap bag first, so
 * "Salaries-…-Rental Assistance" never keeps on its suffix); rows in a billable
 * category with no client-named reference are KEPT as unposted/pending payments
 * that match by amount + date. `account` is accepted for the future grant-doc
 * invoicing-code filter but is not used yet.
 */
export function classifyFinancialEdgeRow(
  input: { description?: unknown; reference?: unknown; account?: unknown },
  options: { billableCategories?: string[] } = {},
): FinancialEdgeRowClassification {
  const description = feNormalize(input.description);
  const reference = feText(input.reference);
  const referenceNormalized = feNormalize(reference);

  const summaryTerm = findScrapTerm(description, FE_SUMMARY_SCRAP_TERMS) || findScrapTerm(referenceNormalized, FE_SUMMARY_SCRAP_TERMS);
  if (summaryTerm) {
    return { keep: false, category: "scrap", reason: `balance/summary row ("${summaryTerm}")`, term: summaryTerm };
  }

  const overheadTerm = findScrapTerm(description, FE_OVERHEAD_SCRAP_TERMS)
    || (!description ? findScrapTerm(referenceNormalized, FE_OVERHEAD_SCRAP_TERMS) : "");
  if (overheadTerm) {
    return { keep: false, category: "scrap", reason: `payroll/overhead category ("${overheadTerm}")`, term: overheadTerm };
  }

  const grantCategories = options.billableCategories ?? [];
  const matchedCategory = grantCategories.find((category) => categoryMatches(description, feNormalize(category)))
    || FE_FALLBACK_BILLABLE_CATEGORIES.find((category) => categoryMatches(description, category))
    || "";
  // Placeholder references like "Unposted Accounts Payable Invoice" are Title
  // Case and would false-positive the person pattern — check unposted first.
  const personReference = !FE_UNPOSTED_REFERENCE_RE.test(reference) && FE_PERSON_REFERENCE_RE.test(reference);

  if (matchedCategory) {
    if (personReference) {
      return { keep: true, category: "customer-payment", paymentKind: "named", reason: `billable category ("${matchedCategory}") with client-named reference`, term: matchedCategory };
    }
    const pendingNote = FE_UNPOSTED_REFERENCE_RE.test(reference) ? "unposted/pending reference" : "no client-named reference";
    return { keep: true, category: "customer-payment", paymentKind: "unposted", reason: `billable category ("${matchedCategory}") with ${pendingNote}; match by amount + date`, term: matchedCategory };
  }

  if (personReference) {
    return { keep: true, category: "customer-payment", paymentKind: "named", reason: "reference leads with a client name" };
  }

  return { keep: false, category: "scrap", reason: "no client name and description is not a recognized billable category" };
}

export function likelyBetterTool(profileId: string, currentTool: "enrollment" | "payment" | "identity") {
  if (profileId === "financial_edge_project_activity" && currentTool !== "payment") {
    return "This looks like a Financial Edge Project Activity Report. It is better supported in Payment Reconciliation.";
  }
  if ((profileId === "coordinated_entry_by_name_list" || profileId === "hmis_service_payment_report") && currentTool === "payment") {
    return "This looks like an HMIS enrollment/service report. Review whether Enrollment Reconciliation is the better first pass.";
  }
  return "";
}
