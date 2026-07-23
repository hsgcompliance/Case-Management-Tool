// Staff forms catalog — derived from artifacts/jotform-shapes/jotforms-inventory.csv
// (enabled forms with >=10 submissions, per the "pipe in high-volume forms" plan).
// `category` drives the Purchases / Intake tabs; "All forms" shows everything.

export type FormCategory = "purchases" | "intake" | "referral" | "other";

export type FormDef = {
  id: string;
  title: string;
  /** Primary category (legacy single-select). */
  category: FormCategory;
  /** Multi-category membership (admin-set); when present it wins over `category`. */
  categories?: FormCategory[];
  submissions: number;
  customerSendable?: boolean;
  /** Surface new submissions of this form in the header notification bell. */
  notifyOnSubmit?: boolean;
  /** Submitting this form continues into the Basic Intake flow. */
  followUpIntake?: boolean;
  /** Feed this form's webhooks into the household model (Webhooks sidebar). */
  buildHousehold?: boolean;
  /** Show the credit-card spend cards when this form is open. */
  showCreditCards?: boolean;
};

/** Category membership check honoring multi-category admin overrides. */
export function formInCategory(f: FormDef, cat: FormCategory): boolean {
  return f.categories?.length ? f.categories.includes(cat) : f.category === cat;
}

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
  // Removed from the Intake tab (2026-07-13) but kept in All forms:
  { id: "250596908552063", title: "Intake Form: Eviction Prevention", category: "other", submissions: 13 },

  // ── Referral ────────────────────────────────────────────────────────────
  { id: "250809472429059", title: "Connect with Resources", category: "referral", submissions: 508 },
  { id: "251038163574153", title: "Refer a Household to Resource Navigation", category: "referral", submissions: 209 },
  { id: "251346523348053", title: "Referral to Rental Assistance (Homelessness)", category: "referral", submissions: 114 },
  { id: "253555227407155", title: "Bridging Home Referral", category: "referral", submissions: 74 },
  { id: "250021786346152", title: "Referral to Homelessness Prevention Screening", category: "referral", submissions: 71 },
  { id: "250785697676075", title: "Health Dept Referral to HRDC Case Management", category: "referral", submissions: 14 },
  { id: "260766127603053", title: "Referral to Family Shelter", category: "referral", submissions: 0 },

  // ── Other (high-volume) ─────────────────────────────────────────────────
  { id: "253485149991067", title: "TSS Client Session Timer", category: "other", submissions: 272 },
  { id: "250646887611061", title: "Landlord Verification Form", category: "other", submissions: 89, notifyOnSubmit: true },
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
  // Doubles as the TSS payer variant in the intake tssGate (referenced by id).
  { id: "260345071136045", title: "Referral to TSS", category: "referral", submissions: 4 },
];

/** The staff web app (customer documents + Google Drive folders live there). */
export const WEB_APP_BASE = "https://housing-db-v2.web.app";
const HOMELESSNESS_STATUS_CERTIFICATION_URL =
  "https://drive.google.com/file/d/1BTNL1fNO6oRH_EMGjQIR0qENXPw94up6/view?usp=drive_link";

/** Intake programs selected in step 1. PATH and TSS may accompany another path. */
export type IntakeTypeId =
  | "eviction-prevention"
  | "hud-rental"
  | "bridging-home"
  | "path-housing"
  | "ryan-white-housing"
  | "tss-deposit-fee";

export const INTAKE_TYPES: { id: IntakeTypeId; label: string; hint: string }[] = [
  { id: "eviction-prevention", label: "Eviction Prevention Intake", hint: "Assessment is a spreadsheet, not a form" },
  { id: "hud-rental", label: "HUD Rental Intake", hint: "Requires Coordinated Entry Assessment in HMIS" },
  { id: "bridging-home", label: "Bridging Home Intake", hint: "HUD workflow without an inspection" },
  { id: "path-housing", label: "PATH Housing Intake", hint: "Requires HMIS entry" },
  { id: "ryan-white-housing", label: "Ryan White Housing Assistance", hint: "Same HMIS workflow as PATH Housing Intake" },
  { id: "tss-deposit-fee", label: "TSS Deposit & Application Fee Only", hint: "Deposit / application fee assistance only" },
];

export function intakeTypeLabel(id: string | null | undefined): string {
  return INTAKE_TYPES.find((t) => t.id === id)?.label ?? "";
}

export function intakeTypesLabel(ids: readonly string[] | null | undefined): string {
  return (ids ?? []).map(intakeTypeLabel).filter(Boolean).join(" + ");
}

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
  /** Render external workflow actions as large, centered primary buttons. */
  prominentLinks?: boolean;
  /** Optional steps don't block "all steps complete". */
  optional?: boolean;
  /** Informational/builder step: navigation is allowed without a manual completion mark. */
  noCompletionRequired?: boolean;
  /**
   * The step where the customer record gets created. Intake usually STARTS
   * without an existing customer (ROIs/disclosures → Caseworthy → customer
   * doc); this step prompts create/link when no customer is active yet.
   */
  customerSetup?: boolean;
  /** Section header rendered above this step in the list ("Basic intake" / "Full intake"). */
  section?: string;
  /**
   * Payer/non-payer gate: the step opens with a full-page choice that decides
   * which TSS form to embed. The choice also presets the customer-folder build
   * variant and is pushed onto the customer doc (tssPayerStatus).
   */
  tssGate?: { payerFormId: string; nonpayerFormId: string };
  /** Show an "Open customer folder" button (Drive pointer from the customer doc). */
  customerFolderLink?: boolean;
  /** Show the local missing-information fallback builder for incomplete intake data. */
  manualInfoBuilder?: boolean;
  /**
   * Rent-cert smart schedule builder: parse the completed Rent Determination,
   * select the billable enrollment(s), review the generated rows, apply.
   */
  rentCertBuilder?: boolean;
  /**
   * Intake-type gate: select one or more compatible programs. Persisted per
   * session and used to branch later workflow guidance.
   */
  intakeTypeGate?: boolean;
  /** Show program-specific HMIS/assessment instructions selected in step 1. */
  intakeGuidance?: boolean;
  /** Conditional inspection step: HQS for HUD, Habitability for Eviction Prevention. */
  inspectionGate?: boolean;
  /** Resolve the customer doc, indexed Drive folder, and linked TSS workbook. */
  driveSetup?: boolean;
  /** Open the linked TSS workbook inside the forms app. */
  workbookModal?: boolean;
  /** Display webhook-prefilled landlord data before opening Jotform prefill. */
  landlordPrefill?: boolean;
  /** Keep completion synchronized to all checklist items. */
  autoCompleteChecklist?: boolean;
  /** Review customer/landlord recipients and choose the program-specific MOU. */
  mouSend?: boolean;
};

/**
 * The intake flow (mirrors the Jotform "Intake Flow" app), in step order.
 * Mixes Jotform steps and task steps (Caseworthy, Drive folder, documents).
 * The Intake tab renders these as a numbered checklist with next/back nav.
 * Reorder / edit freely — this array is the single source of truth.
 */
export const INTAKE_FLOW: IntakeFlowStep[] = [
  {
    title: "Choose intake type",
    section: "Basic intake",
    intakeTypeGate: true,
    note: "Select every program involved. PATH and TSS can accompany one primary program. HUD Rental, Bridging Home, and Eviction Prevention are mutually exclusive.",
  },
  { formId: "260346853938064" }, // Self-Declaration of Citizenship Status
  { formId: "251076068294057" }, // HRDC Release of Information
  { formId: "251106052302034" }, // Program Disclosure Form
  {
    formId: "251037066837055", // HMIS and Coordinated Entry ROI
    note: "One per adult — repeat this form for every adult household member before moving on.",
  },
  { formId: "251106237751148" }, // Customer Self-Declarations
  {
    formId: "260346156157053", // key/progress id; the gate decides which form embeds
    title: "TSS Form (payer / non-payer)",
    note: "Choose payer or non-payer first — the matching form loads, the choice presets the customer folder build, and it's saved onto the customer record.",
    tssGate: { payerFormId: "260345071136045", nonpayerFormId: "260346156157053" },
  },
  {
    title: "Caseworthy: create client / update assessments",
    section: "Full intake",
    note: "Open Caseworthy and create the client, or update the existing client's assessments.",
    links: [{ href: "https://cw.caseworthy.net/hrdc09_prod.ecm", label: "Open Caseworthy" }],
    prominentLinks: true,
  },
  {
    title: "Create customer document & Google folder",
    note: "Check the database and organization Drive index, then create or repair only the missing customer document, folder, or TSS workbook.",
    customerSetup: true,
    driveSetup: true,
    links: [
      { href: `${WEB_APP_BASE}/customers/{customerId}`, label: "Open customer in web app" },
    ],
  },
  {
    title: "Program assessment requirements",
    note: "Complete the requirements shown for every program selected in Step 1.",
    intakeGuidance: true,
  },
  {
    title: "Collect documents",
    note: "File everything in the CUSTOMER'S Google Drive folder. Zero income/assets? Use the Jotform self-declarations below, or a blank file-form template from the Drive folders.",
    customerFolderLink: true,
    autoCompleteChecklist: true,
    checklist: [
      "Photo ID for ALL household members",
      "Income documents (or zero-income self-declaration)",
      "Asset documents (or zero-assets self-declaration)",
      "Copy of eviction notice (if applicable)",
      "Copy of Homeless Certification (if applicable)",
    ],
    links: [
      { href: "https://form.jotform.com/260347030470043", label: "Self-Dec: Zero Income (Jotform)" },
      { href: "https://form.jotform.com/260346243018046", label: "Self-Dec: Zero Assets (Jotform)" },
      { href: "https://drive.google.com/drive/folders/1VEr-0FOR85ssTezafSbvo4YWxvYk016q", label: "Income file form templates (Drive)" },
      { href: "https://drive.google.com/drive/folders/1VF1Q3DbZxHjunU_jrTBU5F5CO2CbdMxm", label: "Asset file form templates (Drive)" },
      { href: `${WEB_APP_BASE}/customers/{customerId}`, label: "Open customer in web app" },
      { href: HOMELESSNESS_STATUS_CERTIFICATION_URL, label: "Certification of Homelessness Status (PDF)" },
    ],
  },
  {
    title: "Complete workbook and budget",
    workbookModal: true,
    note: "Open the linked TSS workbook here and complete the workbook and budget.",
    links: [
      { href: `${WEB_APP_BASE}/customers/{customerId}`, label: "Open customer in web app" },
      { href: "https://housing-db-mobile.web.app", label: "Open HHDB mobile" },
    ],
    prominentLinks: true,
  },
  {
    formId: "251001226310030",
    title: "Eligibility Determination Request",
    note: "Collect landlord / company name, mailing address, phone, and email here. The submitted values flow into Steps 14 and 17.",
  },
  {
    title: "Create Landlord Verification prefill",
    landlordPrefill: true,
    note: "Review the landlord information collected in Step 13, then use it on the Landlord Verification prefill page.",
    links: [
      { href: "https://www.jotform.com/build/250646887611061/publish/prefill", label: "Landlord Verification prefill builder" },
    ],
    prominentLinks: true,
  },
  {
    title: "Schedule inspection",
    note: "HUD Rental requires an HQS inspection. Eviction Prevention requires a Habitability Inspection.",
    inspectionGate: true,
  },
  { formId: "251916705430050", title: "Unit Eligibility Determination (Rent Determination)" },
  {
    title: "Link intake & build assistance payment schedule",
    note:
      "Confirm the sidebar submissions are linked, review the webhook-prefilled household and landlord information, " +
      "then select the funded grant and line item and build the payment schedule. The enrollment is resolved first; " +
      "payments are then created in order and flow into the real payment queue.",
    rentCertBuilder: true,
    noCompletionRequired: true,
  },
  {
    title: "Memorandum of Understanding",
    note: "For housholds with multiple adults the form must be edited to include all lease signees",
    mouSend: true,
  },
];

/** Reference links pinned at the bottom of the intake flow page. */
export const INTAKE_RESOURCES: { href: string; label: string }[] = [
  { href: "https://drive.google.com/file/d/1WY57mEu6-RW9Ry2bpTJWYsYmWwyYDZNT/view", label: "HQS Inspection form (PDF)" },
  { href: "https://www.jotform.com/sign/250647693231055/send", label: "MOU — send for signature" },
  { href: "https://www.jotform.com/build/250646887611061/publish/prefill", label: "Landlord Verification prefill builder" },
  { href: "https://www.jotform.com/boards/251318461516050", label: "Intake board (Jotform)" },
  { href: HOMELESSNESS_STATUS_CERTIFICATION_URL, label: "Certification of Homelessness Status (PDF)" },
];

export function formsByCategory(category: FormCategory): FormDef[] {
  return FORMS.filter((f) => formInCategory(f, category)).sort((a, b) => b.submissions - a.submissions);
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
    categories?: string[];
    title?: string;
    customerSendable?: boolean;
    notifyOnSubmit?: boolean | null;
    followUpIntake?: boolean | null;
    buildHousehold?: boolean | null;
    showCreditCards?: boolean | null;
    adminEdited?: boolean;
    submissionCount: number;
  }>
): FormDef[] {
  const byId = new Map<string, FormDef>(FORMS.map((f) => [f.id, { ...f }]));
  for (const r of registry) {
    if (!/^\d{6,24}$/.test(r.formId)) continue;
    const category = (VALID_CATEGORIES.includes(r.category as FormCategory) ? r.category : "other") as FormCategory;
    const categories = (r.categories ?? []).filter((c): c is FormCategory =>
      VALID_CATEGORIES.includes(c as FormCategory)
    );
    const base = byId.get(r.formId);
    if (base) {
      // Admin edits override the hardcoded definition; auto entries only enrich.
      if (r.adminEdited) {
        base.category = category;
        base.categories = categories.length ? categories : [category];
        if (r.title) base.title = r.title;
        // Flags come back as bare booleans, so only an admin edit may override
        // the hardcoded defaults (auto rows would wipe them with false).
        if (typeof r.notifyOnSubmit === "boolean") base.notifyOnSubmit = r.notifyOnSubmit;
        if (typeof r.followUpIntake === "boolean") base.followUpIntake = r.followUpIntake;
        if (typeof r.buildHousehold === "boolean") base.buildHousehold = r.buildHousehold;
        if (typeof r.showCreditCards === "boolean") base.showCreditCards = r.showCreditCards;
      } else if (r.title && (!base.title || base.title.startsWith("Form "))) {
        base.title = r.title;
      }
      if (typeof r.customerSendable === "boolean") base.customerSendable = r.customerSendable;
    } else {
      byId.set(r.formId, {
        id: r.formId,
        title: r.title || `Form ${r.formId}`,
        category,
        ...(categories.length ? { categories } : {}),
        submissions: r.submissionCount || 0,
        customerSendable: !!r.customerSendable,
        ...(typeof r.notifyOnSubmit === "boolean" ? { notifyOnSubmit: r.notifyOnSubmit } : {}),
        ...(typeof r.followUpIntake === "boolean" ? { followUpIntake: r.followUpIntake } : {}),
        ...(typeof r.buildHousehold === "boolean" ? { buildHousehold: r.buildHousehold } : {}),
        ...(typeof r.showCreditCards === "boolean" ? { showCreditCards: r.showCreditCards } : {}),
      });
    }
  }
  return [...byId.values()].sort((a, b) => b.submissions - a.submissions);
}
