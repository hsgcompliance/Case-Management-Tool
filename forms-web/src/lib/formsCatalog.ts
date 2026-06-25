// Staff forms catalog — derived from artifacts/jotform-shapes/jotforms-inventory.csv
// (enabled forms with >=10 submissions, per the "pipe in high-volume forms" plan).
// `category` drives the Purchases / Intake tabs; "All forms" shows everything.

export type FormCategory = "purchases" | "intake" | "referral" | "other";

export type FormDef = {
  id: string;
  title: string;
  category: FormCategory;
  submissions: number;
  customerSendable?: boolean;
};

export const FORMS: FormDef[] = [
  // ── Purchases (staff only) ──────────────────────────────────────────────
  { id: "251590902397160", title: "Credit Card Checkout", category: "purchases", submissions: 227 },
  { id: "251658579638173", title: "Credit Card Return", category: "purchases", submissions: 208 },
  { id: "251878265158166", title: "Credit Card Purchase Documentation", category: "purchases", submissions: 181 },
  { id: "252674777246167", title: "Invoice Requests", category: "purchases", submissions: 27 },

  // ── Intake ──────────────────────────────────────────────────────────────
  { id: "251916705430050", title: "Rent Determination & Unit Eligibility", category: "intake", submissions: 103 },
  { id: "251076068294057", title: "HRDC Release of Information", category: "intake", submissions: 85 },
  { id: "251106052302034", title: "Program Disclosure Form", category: "intake", submissions: 78 },
  { id: "251037066837055", title: "HMIS and Coordinated Entry ROI", category: "intake", submissions: 65 },
  { id: "251001226310030", title: "Eligibility Determination", category: "intake", submissions: 59 },
  { id: "251106237751148", title: "Customer Self-Declarations", category: "intake", submissions: 45 },
  { id: "250596908552063", title: "Intake Form: Eviction Prevention", category: "intake", submissions: 13 },

  // ── Referral ────────────────────────────────────────────────────────────
  { id: "250809472429059", title: "Connect with Resources", category: "referral", submissions: 508 },
  { id: "251038163574153", title: "Refer a Household to Resource Navigation", category: "referral", submissions: 209 },
  { id: "251346523348053", title: "Referral to Rental Assistance (Homelessness)", category: "referral", submissions: 114 },
  { id: "253555227407155", title: "Bridging Home Referral", category: "referral", submissions: 74 },
  { id: "250021786346152", title: "Referral to Homelessness Prevention Screening", category: "referral", submissions: 71 },
  { id: "250785697676075", title: "Health Dept Referral to HRDC Case Management", category: "referral", submissions: 14 },

  // ── Other (high-volume) ─────────────────────────────────────────────────
  { id: "253485149991067", title: "TSS Client Session Timer", category: "other", submissions: 272 },
  { id: "250646887611061", title: "Landlord Verification Form", category: "other", submissions: 89 },
  { id: "251054570555051", title: "SOAR Reporting Tool", category: "other", submissions: 85 },
  { id: "251858892830167", title: "Community-Based Care Coordination (CBCC) Enrollment", category: "other", submissions: 65 },
  { id: "260567136431051", title: "Customer Appeal Form", category: "other", submissions: 53 },
  { id: "260346853938064", title: "Self-Declaration of Citizenship Status", category: "other", submissions: 26 },
  { id: "250685847454065", title: "Wheat Suites: Housing Status Verification", category: "other", submissions: 25 },
  { id: "250965876394071", title: "HMIS User Survey", category: "other", submissions: 22 },
  { id: "250636350948159", title: "WEX Participant Timesheet", category: "other", submissions: 17 },
  { id: "250648244597063", title: "Habitability Inspection (ESG)", category: "other", submissions: 15 },
  { id: "260346156157053", title: "TSS Non-Payer Source & Sliding Fee Acknowledgement", category: "other", submissions: 14 },
  { id: "250635743353154", title: "WEX Supervisor Review", category: "other", submissions: 14 },
  { id: "251471204342143", title: "MT Homelessness Prevention Assessment (HMIS)", category: "other", submissions: 12 },
];

export function formsByCategory(category: FormCategory): FormDef[] {
  return FORMS.filter((f) => f.category === category).sort((a, b) => b.submissions - a.submissions);
}

export const ALL_FORMS = [...FORMS].sort((a, b) => b.submissions - a.submissions);

export function formById(id: string): FormDef | undefined {
  return FORMS.find((f) => f.id === id);
}

const VALID_CATEGORIES: FormCategory[] = ["purchases", "intake", "referral", "other"];

/**
 * Merge the hardcoded catalog with webhook-auto-discovered forms (formsRegistry).
 * Hardcoded definitions win; new forms are appended under their registered category.
 */
export function mergeWithRegistry(
  registry: Array<{
    formId: string;
    category: string;
    title?: string;
    customerSendable?: boolean;
    adminEdited?: boolean;
    submissionCount: number;
  }>
): FormDef[] {
  const byId = new Map<string, FormDef>(FORMS.map((f) => [f.id, { ...f }]));
  for (const r of registry) {
    if (!/^\d{6,24}$/.test(r.formId)) continue;
    const category = (VALID_CATEGORIES.includes(r.category as FormCategory) ? r.category : "other") as FormCategory;
    const base = byId.get(r.formId);
    if (base) {
      // Admin edits override the hardcoded definition; auto entries only enrich.
      if (r.adminEdited) {
        base.category = category;
        if (r.title) base.title = r.title;
      } else if (r.title && (!base.title || base.title.startsWith("Form "))) {
        base.title = r.title;
      }
      if (typeof r.customerSendable === "boolean") base.customerSendable = r.customerSendable;
    } else {
      byId.set(r.formId, {
        id: r.formId,
        title: r.title || `Form ${r.formId}`,
        category,
        submissions: r.submissionCount || 0,
        customerSendable: !!r.customerSendable,
      });
    }
  }
  return [...byId.values()].sort((a, b) => b.submissions - a.submissions);
}
