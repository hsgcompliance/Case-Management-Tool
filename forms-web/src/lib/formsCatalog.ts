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
  // Low-volume forms pulled in because the intake flow references them:
  { id: "260347030470043", title: "Self-Declaration of Zero Income", category: "other", submissions: 7 },
  { id: "260346243018046", title: "Self-Declaration of Zero Assets", category: "other", submissions: 1 },
  { id: "251613294244151", title: "Initiate Landlord Verification Process", category: "other", submissions: 0 },
];

/** The staff web app (customer documents + Google Drive folders live there). */
export const WEB_APP_BASE = "https://housing-db-v2.web.app";

export type IntakeFlowStep = {
  /** Jotform id → embedded form step. Omit for a task-only step. */
  formId?: string;
  /** Task title (required when there is no formId); overrides the form title otherwise. */
  title?: string;
  /** Guidance shown on the step card and inside the step view. */
  note?: string;
  /** Checklist items (rendered as persisted checkboxes in the step view). */
  checklist?: string[];
  /** External links. `{customerId}` is replaced with the active customer's id. */
  links?: { href: string; label: string }[];
  /** Optional steps don't block "all steps complete". */
  optional?: boolean;
  /**
   * The step where the customer record gets created. Intake usually STARTS
   * without an existing customer (ROIs/disclosures → Caseworthy → customer
   * doc); this step prompts create/link when no customer is active yet.
   */
  customerSetup?: boolean;
};

/**
 * The intake flow (mirrors the Jotform "Intake Flow" app), in step order.
 * Mixes Jotform steps and task steps (Caseworthy, Drive folder, documents).
 * The Intake tab renders these as a numbered checklist with next/back nav.
 * Reorder / edit freely — this array is the single source of truth.
 */
export const INTAKE_FLOW: IntakeFlowStep[] = [
  { formId: "260346853938064" }, // Self-Declaration of Citizenship Status
  { formId: "251076068294057" }, // HRDC Release of Information
  { formId: "251106052302034" }, // Program Disclosure Form
  {
    formId: "251037066837055", // HMIS and Coordinated Entry ROI
    note: "One per adult — repeat this form for every adult household member before moving on.",
  },
  { formId: "251106237751148" }, // Customer Self-Declarations
  {
    formId: "260346156157053", // TSS Non-Payer Source & Sliding Fee Acknowledgement
    title: "TSS Acknowledgement (payer OR non-payer)",
    note: "Payer or non-payer — never both. Only complete this Non-Payer form for TSS non-payers; payer agreements are handled outside Jotform.",
  },
  {
    title: "Caseworthy: create client / update assessments",
    note: "Open Caseworthy and create the client, or update the existing client's assessments.",
    links: [{ href: "https://cw.caseworthy.net/hrdc09_prod.ecm", label: "Open Caseworthy" }],
  },
  {
    title: "Create customer document & Google folder",
    note: "The customer usually doesn't exist in the database yet — create them here (this also builds + links their Google Drive folder), or link them if they already exist.",
    customerSetup: true,
    links: [
      { href: `${WEB_APP_BASE}/customers/{customerId}`, label: "Open customer in web app" },
      { href: "https://drive.google.com", label: "Open Google Drive" },
    ],
  },
  {
    formId: "251471204342143", // MT Homelessness Prevention Assessment (HMIS)
    title: "HMIS / Homelessness Prevention Assessment",
    note: "Complete the assessment in HMIS when applicable; otherwise use this MT Homelessness Prevention Assessment form.",
  },
  {
    title: "Collect documents",
    note: "File every collected/completed form in the CUSTOMER'S Google Drive folder. The template folders below hold blank income/asset file forms — paper alternatives to the Jotform self-declarations.",
    checklist: [
      "Photo ID for ALL household members",
      "Income documents",
      "Asset documents",
      "Copy of eviction notice (if applicable)",
    ],
    links: [
      { href: `${WEB_APP_BASE}/customers/{customerId}`, label: "Open customer in web app" },
      { href: "https://drive.google.com/drive/folders/1VEr-0FOR85ssTezafSbvo4YWxvYk016q", label: "Income file form templates (Drive)" },
      { href: "https://drive.google.com/drive/folders/1VF1Q3DbZxHjunU_jrTBU5F5CO2CbdMxm", label: "Asset file form templates (Drive)" },
    ],
  },
  {
    formId: "260347030470043", // Self-Declaration of Zero Income
    optional: true,
    note: "Only if the household reports zero income. Paper alternative: use an income file form template from Drive and file the completed copy in the customer's folder.",
    links: [
      { href: "https://drive.google.com/drive/folders/1VEr-0FOR85ssTezafSbvo4YWxvYk016q", label: "Income file form templates (Drive)" },
    ],
  },
  {
    formId: "260346243018046", // Self-Declaration of Zero Assets
    optional: true,
    note: "Only if the household reports zero assets. Paper alternative: use an asset file form template from Drive and file the completed copy in the customer's folder.",
    links: [
      { href: "https://drive.google.com/drive/folders/1VF1Q3DbZxHjunU_jrTBU5F5CO2CbdMxm", label: "Asset file form templates (Drive)" },
    ],
  },
  { formId: "251001226310030", title: "Eligibility Determination Request" },
  {
    formId: "251613294244151", // Initiate Landlord Verification Process
    title: "Create Landlord Verification prefill",
    note: "Initiates the prefilled Landlord Verification Form that gets sent to the landlord.",
  },
  { formId: "251916705430050", title: "Unit Eligibility Determination (Rent Determination)" },
  {
    title: "Memorandum of Understanding",
    note: "No Jotform for the MOU yet — generate and sign it per program process, then file it in the customer's Drive folder.",
  },
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
