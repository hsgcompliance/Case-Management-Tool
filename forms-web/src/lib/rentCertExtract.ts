// Parse certification fields out of a Rent Determination & Unit Eligibility
// webhook event (form 251916705430050). Field labels are grounded in the real
// form shape (artifacts/jotform-shapes/rent-determination-251916705430050.shape.json):
//
//   Program Name (dropdown)            Reason for Certification (Initial/Interim/Annual)
//   Intake Purpose (New Intake / YHDP Transitional Housing Recert / Update Rent Cert Letter)
//   Effective Date / Expiration Date (datetime)
//   Monthly Housing Cost (See LLVF)    Deposit Amount (see LLVF)
//   Prorated Rent/Arrears              Prorated Rent Month/Arrears (month dropdown)
//   Should this Rent Cert include arrears? (No/Yes)
//   Utility Allowance Amount           Tenant Rent Payment: Rent payment - Utility Allowance
//   HRDC Rent Initial Payment Portion
//
// Blank and zero stay distinct for monetary fields (null = blank).
import type { WebhookEventDetail } from "./webhookDetailsApi";

export const RENT_DETERMINATION_FORM_ID = "251916705430050";

export type CertFields = {
  programName: string | null;
  effectiveDate: string | null; // YYYY-MM-DD
  expirationDate: string | null; // YYYY-MM-DD
  reason: string | null; // raw "Initial" | "Interim" | "Annual" | …
  intakePurpose: string | null;
  includeArrears: boolean | null;
  proratedMonth: string | null; // raw month name from the dropdown ("N/A" → null)
  depositAmount: number | null;
  monthlyHousingCost: number | null;
  proratedOrArrears: number | null;
  tenantRentPayment: number | null;
  hrdcPayment: number | null;
  utilityAllowance: number | null;
};

export const EMPTY_CERT: CertFields = {
  programName: null,
  effectiveDate: null,
  expirationDate: null,
  reason: null,
  intakePurpose: null,
  includeArrears: null,
  proratedMonth: null,
  depositAmount: null,
  monthlyHousingCost: null,
  proratedOrArrears: null,
  tenantRentPayment: null,
  hrdcPayment: null,
  utilityAllowance: null,
};

/** "$1,234.50" → 1234.5 · "" → null · "0" → 0 (blank vs zero stays distinct). */
export function parseMoney(raw: string | null | undefined): number | null {
  const s = String(raw ?? "").replace(/[$,\s]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Tolerant date → ISO10. Handles ISO, MM-DD-YYYY, MM/DD/YYYY, "Jul 1, 2026". */
export function parseDateISO(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return null;
}

type Matcher = { key: keyof CertFields; match: RegExp; exclude?: RegExp };

// First matching non-empty value wins per key (fields arrive in question order,
// and the canonical fields sit before any repeats in later sections).
const MATCHERS: Matcher[] = [
  { key: "programName", match: /^program name/i },
  { key: "effectiveDate", match: /^effective date/i },
  { key: "expirationDate", match: /^expiration date/i },
  { key: "reason", match: /^reason for (this )?certification/i },
  { key: "intakePurpose", match: /^intake purpose/i },
  { key: "includeArrears", match: /include arrears\?/i },
  { key: "proratedMonth", match: /^prorated rent month/i },
  { key: "depositAmount", match: /^deposit amount/i },
  { key: "monthlyHousingCost", match: /^monthly housing cost/i },
  { key: "proratedOrArrears", match: /^prorated rent\s*\/\s*arrears/i, exclude: /month/i },
  { key: "tenantRentPayment", match: /^tenant rent payment/i },
  { key: "hrdcPayment", match: /^hrdc (rent initial payment portion|payment)/i },
  { key: "utilityAllowance", match: /^utility allowance amount/i },
];

const MONEY_KEYS = new Set<keyof CertFields>([
  "depositAmount",
  "monthlyHousingCost",
  "proratedOrArrears",
  "tenantRentPayment",
  "hrdcPayment",
  "utilityAllowance",
]);
const DATE_KEYS = new Set<keyof CertFields>(["effectiveDate", "expirationDate"]);

export function extractCertFields(ev: WebhookEventDetail): CertFields {
  const out: CertFields = { ...EMPTY_CERT };
  for (const f of ev.fields) {
    const label = f.label.trim();
    const value = f.value.trim();
    if (!value) continue;
    for (const m of MATCHERS) {
      if (!m.match.test(label)) continue;
      if (m.exclude?.test(label)) continue;
      if (out[m.key] !== null) continue; // first non-empty wins
      if (m.key === "includeArrears") {
        out.includeArrears = /^y/i.test(value) ? true : /^n/i.test(value) ? false : null;
      } else if (m.key === "proratedMonth") {
        out.proratedMonth = /^n\/?a$/i.test(value) ? null : value;
      } else if (DATE_KEYS.has(m.key)) {
        (out[m.key] as string | null) = parseDateISO(value);
      } else if (MONEY_KEYS.has(m.key)) {
        (out[m.key] as number | null) = parseMoney(value);
      } else {
        (out[m.key] as string | null) = value;
      }
      break;
    }
  }
  return out;
}
