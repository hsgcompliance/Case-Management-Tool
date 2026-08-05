import type { WebhookEventDetail } from "./webhookDetailsApi";

// Builds the CONTINUOUS household picture from webhook events as intake forms
// come in — one merged model across the whole session, not per-form snapshots.
//
// Person-centric: every household member accumulates their own groups
// (demographics/disability, income, assets) as forms land; household-level
// facts (counts, housing/rent) live beside them. Merge rules:
//   • document-verified beats self-declared (see VERIFIED_FORM_IDS),
//   • within the same tier, the newest submission wins,
//   • members are keyed by normalized full name and enriched, never duplicated.
//
// Sequence-aware parsing: the Customer Self-Declarations form repeats
// [Name / Relationship to HOH / Disabling Condition / Disability Types] blocks
// per member and [Full Name / Source / Amount Monthly] income + [Full Name /
// Source] asset blocks — fields arrive in question order, so blocks are
// reassembled positionally, not by label alone.

export type ExtractedValue = {
  value: string;
  sourceFormId: string;
  sourceFormTitle: string;
  receivedAtISO: string | null;
  /** true = built from actual documents (paystubs / bank statements), not self-declared. */
  verified: boolean;
};

/**
 * Intake steps up to the workbook are SELF-DECLARED; these two forms are built
 * from real documents (paystubs, bank statements) and outrank self-declared
 * values when merging:
 *   251001226310030 — Eligibility Determination (step 13)
 *   251916705430050 — Rent Determination & Unit Eligibility (step 15)
 */
export const VERIFIED_FORM_IDS = new Set(["251001226310030", "251916705430050"]);

export type PersonName = { full: string; first: string; last: string };

/** Split "First [Middle] Last" or "Last, First" into separately copyable parts. */
export function splitPersonName(raw: string): PersonName {
  const cleaned = raw.trim().replace(/\s+/g, " ");
  if (cleaned.includes(",")) {
    const [last = "", first = ""] = cleaned.split(",").map((s) => s.trim());
    return { full: `${first} ${last}`.trim(), first, last };
  }
  const parts = cleaned.split(" ");
  if (parts.length === 1) return { full: cleaned, first: cleaned, last: "" };
  return { full: cleaned, first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

export type MemberIncome = { source: ExtractedValue; amountMonthly: ExtractedValue | null };

export type HouseholdMember = {
  name: PersonName;
  isHoH: boolean;
  /** Demographic / disability group. */
  relationship: ExtractedValue | null;
  dob: ExtractedValue | null;
  age: number | null;
  gender: ExtractedValue | null;
  citizenship: ExtractedValue | null;
  disabling: ExtractedValue | null;
  disabilityTypes: ExtractedValue | null;
  studentStatus: ExtractedValue | null;
  /** Contact group (usually only the head of household). */
  phone: ExtractedValue | null;
  email: ExtractedValue | null;
  /** Income group (self-declared until the verified forms land). */
  incomes: MemberIncome[];
  /** Asset / bank account group. */
  assets: ExtractedValue[];
  /** Provenance of the name itself. */
  nameProv: ExtractedValue;
};

export type SlotValue = { key: string; label: string; found: ExtractedValue | null };

export type UnmatchedField = {
  label: string;
  value: string;
  sourceFormTitle: string;
};

/** One raw field with the normalizer keys that consumed it (empty = unmatched). */
export type EventTraceField = { label: string; value: string; consumedBy: string[] };

/** Per-submission raw→normalized mapping trace (drives the sidebar export). */
export type EventTrace = {
  formId: string;
  formTitle: string;
  submissionId: string;
  submitterName: string;
  receivedAtISO: string | null;
  fields: EventTraceField[];
};

export type HouseholdInfo = {
  /** Members with per-person groups; head of household first. */
  members: HouseholdMember[];
  /** Household group: size / adults / children / total income. */
  household: SlotValue[];
  /** Housing group: status, eviction timeline, rent amounts, current address. */
  housing: SlotValue[];
  /** Verified rent-determination income, asset, and assistance calculations. */
  financial: SlotValue[];
  /**
   * HoH compatibility slots (hohName / dob / age / cwId) — kept for consumers
   * that prefill from the head of household (CreateCustomerModal).
   */
  slots: SlotValue[];
  /** Fields no matcher consumed — the troubleshooting list for tuning the regexes. */
  unmatched: UnmatchedField[];
  /** Newest-first per-submission trace: every raw field + what it normalized into. */
  trace: EventTrace[];
};

// ── matchers ────────────────────────────────────────────────────────────────

const EXCLUDE_OTHER_PEOPLE =
  /landlord|employer|case ?manager|staff|worker|user|business|company|agency|referr|designated|counselor|contact person/i;

type SlotDef = {
  key: string;
  label: string;
  match: RegExp;
  exclude?: RegExp;
  /** Extra gate on the VALUE (e.g. amounts should look like money/number). */
  valueOk?: (v: string) => boolean;
};

const money = (v: string) => /\$|\d/.test(v);

/** Fields that describe the head of household as a person (folded into their member card). */
const HOH_PERSON_SLOTS: SlotDef[] = [
  { key: "dob", label: "DOB", match: /date of birth|\bdob\b|birth ?date/i, exclude: /member|child|spouse|dependent/i },
  { key: "gender", label: "Gender", match: /^gender\b/i },
  { key: "citizenship", label: "Citizenship", match: /citizen|lawfully within the united states/i },
  { key: "phone", label: "Phone", match: /phone/i, exclude: EXCLUDE_OTHER_PEOPLE },
  { key: "email", label: "Email", match: /\be-?mail\b/i, exclude: EXCLUDE_OTHER_PEOPLE },
];

const HOUSEHOLD_SLOTS: SlotDef[] = [
  {
    key: "hhSize",
    label: "Household size",
    match: /household size|family size|(number|#|total|how many)( of)?( people| persons| members)?\s*\(?(adults and children)?\)?( are)?( in| of)? (the |your )?household/i,
    valueOk: (v) => /^\d{1,2}$/.test(v) || /^none$/i.test(v),
  },
  { key: "adults", label: "Adults", match: /(number|#|how many)( of)? adults/i, valueOk: (v) => /^\d{1,2}$/.test(v) || /^none$/i.test(v) },
  { key: "children", label: "Children", match: /(number|#|how many)( of)? (children|minors|kids)/i, valueOk: (v) => /^\d{1,2}$/.test(v) || /^none$/i.test(v) },
  {
    key: "totalIncome",
    label: "Total income (monthly)",
    match: /monthly income calculation|total (monthly )?(household )?income/i,
    valueOk: money,
  },
];

const HOUSING_SLOTS: SlotDef[] = [
  {
    key: "housingStatus",
    label: "Housing status",
    match: /housing status/i,
    // Free-text "share any additional information…" narratives must not win this slot.
    exclude: /verification|additional information|share any/i,
  },
  { key: "daysToVacate", label: "Days until eviction", match: /days.*(vacate|eviction)|days until eviction/i },
  { key: "monthlyRent", label: "Monthly rent", match: /monthly rent|^rent amount/i, valueOk: money },
  { key: "backRent", label: "Back rent owed", match: /back rent/i, valueOk: money },
  { key: "addressFull", label: "Current address", match: /address for current living|^unit address$|^tenant address$|^address$/i, exclude: /landlord|payee|mailing/i },
  { key: "street", label: "Street", match: /^street address/i },
  { key: "city", label: "City", match: /^city$/i },
  { key: "stateZip", label: "State, Zip", match: /^state,? ?zip/i },
  { key: "cwId", label: "CWID", match: /\bcw ?id\b|caseworthy/i },
];

const FINANCIAL_SLOTS: SlotDef[] = [
  { key: "includeArrears", label: "Includes arrears", match: /include arrears\?/i },
  { key: "annualIncome", label: "Household annual income", match: /^sum household income$|total household annual income/i, valueOk: money },
  { key: "assetTotal", label: "Total assets", match: /^total asset amount/i, valueOk: money },
  { key: "monthlyHousingCost", label: "Monthly housing cost", match: /^monthly housing cost/i, valueOk: money },
  { key: "depositAmount", label: "Security deposit", match: /^deposit amount/i, valueOk: money },
  {
    key: "proratedOrArrears",
    label: "Prorated rent / arrears",
    match: /^prorated rent\s*\/\s*arrears/i,
    exclude: /month/i,
    valueOk: money,
  },
  { key: "tenantRentPayment", label: "Tenant rent payment", match: /^tenant rent payment/i, valueOk: money },
  { key: "hrdcRentPayment", label: "HRDC rent payment", match: /^hrdc (rent initial payment portion|payment)/i, valueOk: money },
  { key: "utilityAllowance", label: "Utility allowance", match: /^utility allowance amount/i, valueOk: money },
];

/** Labels that name the head of household directly. */
const HOH_NAME_MATCH =
  /head of household|printed name|first (&|and) last name|client name|customer name|applicant name|participant name/i;

/** Bare per-person name labels — start a member block ("Name", "Name 1"). */
const MEMBER_NAME_MATCH = /^name\s*:?\s*\d*$/i;
/** Income/asset holder labels inside repeated blocks. */
const HOLDER_NAME_MATCH = /^full name$/i;
/** Legacy multi-member list labels. */
const MEMBER_LIST_MATCH =
  /household member|hh member|member('s)? name|additional (household )?member|dependent name|other adult|child(ren)?('s)? name/i;

const RELATIONSHIP_MATCH = /^relationship( to hoh)?/i;
const DISABLING_MATCH = /does (this person|the member)? ?have a disabling|disabling condition\?/i;
const DISABILITY_TYPES_MATCH = /which disability types/i;

const INCOME_SOURCE_BLOCK = /^source$/i;
const INCOME_AMOUNT_BLOCK = /^amount( monthly)?$/i;
/** Fallback HoH income descriptors on non-block forms. */
const INCOME_SOURCE_MATCH = /(source|type)s? of income|income (source|type)|primary income|employment status/i;
const BANK_MATCH = /bank|financial institution|account name/i;

/** Consent boilerplate, signatures, initials, plain dates — traced but never displayed. */
// NOTE: plain "Date" / "Date of Referral" are boilerplate, but "Date of Birth" must survive.
const IGNORE_MATCH =
  /^date\s*\d*$|^date of referral\b|^terms and conditions|signature|\binitials\b|^initial\s*\d*$|^i (agree|have received)|^counselor|widget_metadata|^typea$/i;
const UPLOAD_URL = /^https?:\/\/\S+\/uploads\//i;

// ── merge helpers ───────────────────────────────────────────────────────────

/** b replaces a when it's higher-tier (verified) or same-tier and not older. */
function wins(a: ExtractedValue | null, b: ExtractedValue): boolean {
  if (!a) return true;
  if (a.verified !== b.verified) return b.verified;
  return String(b.receivedAtISO || "") >= String(a.receivedAtISO || "");
}

/** Compute age in years from a parseable DOB string, or null. */
export function ageFromDob(dob: string): number | null {
  const normalized = normalizeDob(dob);
  const d = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

/** Jotform dates often contain both a display value and timestamp; retain ISO date only. */
export function normalizeDob(raw: string): string {
  const value = String(raw || "").trim();
  const iso = value.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = value.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  return value;
}

function eventDateISO(fields: WebhookEventDetail["fields"]): string | null {
  for (const field of fields) {
    if (!/^(?:submission )?date$/i.test(field.label.trim())) continue;
    const normalized = normalizeDob(field.value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  }
  return null;
}

function remainingDays(raw: string, submittedOn: string | null): string {
  const original = Number(String(raw).match(/\d+/)?.[0]);
  if (!Number.isFinite(original) || !submittedOn) return raw;
  const submitted = new Date(`${submittedOn}T00:00:00`);
  const today = new Date();
  const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const elapsed = Math.max(0, Math.floor((todayLocal.getTime() - submitted.getTime()) / 86_400_000));
  return String(Math.max(0, original - elapsed));
}

function indexedMemberLabel(label: string): { index: number; kind: "name" | "dob" | "relationship" | "student" | "disabling" } | null {
  const text = label.trim();
  let match = /^(?:household(?: member)?|hoh)\s*#?\s*(\d+)\b/i.exec(text);
  if (match && !/^# of household/i.test(text)) return { index: Number(match[1]), kind: "name" };
  match = /^child\s*#?\s*(\d+)\b/i.exec(text);
  if (match) return { index: Number(match[1]) + 1, kind: "name" };
  match = /date of birth(?:\s*-\s*hoh|\s*-\s*)?\s*#?\s*(\d+)?/i.exec(text);
  if (match) return { index: Number(match[1] || 1), kind: "dob" };
  match = /^relationship to hoh(?:\s*-\s*)?\s*#?\s*(\d+)?/i.exec(text);
  if (match) return { index: Number(match[1] || 1), kind: "relationship" };
  match = /^full[ -]?time student(?:\s*-\s*)?\s*#?\s*(\d+)?/i.exec(text);
  if (match) return { index: Number(match[1] || 1), kind: "student" };
  match = /documented disabling condition(?:\s*-\s*)?\s*#?\s*(\d+)?/i.exec(text);
  if (match) return { index: Number(match[1] || 1), kind: "disabling" };
  return null;
}

function addressParts(address: ExtractedValue | null): SlotValue[] {
  const empty = (key: string, label: string): SlotValue => ({ key, label, found: null });
  if (!address) {
    return [
      empty("addressStreet", "Street"),
      empty("addressUnit", "Unit"),
      empty("addressCity", "City"),
      empty("addressState", "State"),
      empty("addressZip", "ZIP"),
    ];
  }
  const parts = address.value.split(/\s*(?:Â·|·)\s*|,\s*/).map((part) => part.trim()).filter(Boolean);
  const zipIndex = parts.findIndex((part) => /^\d{5}(?:-\d{4})?$/.test(part));
  const zip = zipIndex >= 0 ? parts[zipIndex] : "";
  const stateNames = /^(?:A[LKZR]|C[AOT]|DE|FL|GA|HI|I[ADLN]|K[SY]|LA|M[ADEHINOPST]|N[CDEHJMVY]|O[HKR]|PA|RI|S[CD]|T[NX]|UT|V[AIT]|W[AIVY]|Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)$/i;
  const stateIndex = parts.findIndex((part) => stateNames.test(part));
  const localityBoundary = Math.min(
    zipIndex >= 0 ? zipIndex : parts.length,
    stateIndex >= 0 ? stateIndex : parts.length,
  );
  const cityIndex = localityBoundary > 0 ? localityBoundary - 1 : -1;
  const unitIndex = cityIndex > 1 ? cityIndex - 1 : -1;
  const streetEnd = unitIndex > 0 ? unitIndex : cityIndex > 0 ? cityIndex : parts.length;
  const found = (key: string, label: string, value: string): SlotValue => ({
    key,
    label,
    found: value ? { ...address, value } : null,
  });
  return [
    found("addressStreet", "Street", parts.slice(0, streetEnd).join(", ")),
    found("addressUnit", "Unit", unitIndex > 0 ? parts[unitIndex] : ""),
    found("addressCity", "City", cityIndex > 0 ? parts[cityIndex] : ""),
    found("addressState", "State", stateIndex > 0 ? parts[stateIndex] : ""),
    found("addressZip", "ZIP", zip),
  ];
}

function normCount(v: string): string {
  return /^none$/i.test(v.trim()) ? "0" : v.trim();
}

function isPlausibleName(v: string): boolean {
  return v.length >= 3 && v.length <= 80 && /[a-z]/i.test(v) && !/^https?:/i.test(v) && !/\d{3}/.test(v);
}

// ── extraction ──────────────────────────────────────────────────────────────

type MemberDraft = {
  name?: ExtractedValue;
  relationship?: ExtractedValue;
  disabling?: ExtractedValue;
  disabilityTypes?: ExtractedValue;
};

type MemberAccum = Omit<HouseholdMember, "age" | "isHoH" | "incomes" | "assets"> & {
  order: number;
  incomes: Map<string, MemberIncome>; // key: source value lowercased
  assets: Map<string, ExtractedValue>;
};

export function extractHousehold(
  events: WebhookEventDetail[],
  formTitleById: (id: string) => string
): HouseholdInfo {
  const membersByName = new Map<string, MemberAccum>();
  const slotFound = new Map<string, ExtractedValue>(); // all SlotDef keys
  const slotPriority = new Map<string, number>();
  let hohName: ExtractedValue | null = null;
  const unmatched = new Map<string, UnmatchedField>(); // key: label::value
  const trace: EventTrace[] = [];
  let memberOrder = 0;

  const upsertMember = (nameEV: ExtractedValue, draft: Omit<MemberDraft, "name"> = {}): MemberAccum => {
    const parsed = splitPersonName(nameEV.value);
    const k = parsed.full.toLowerCase();
    let m = membersByName.get(k);
    if (!m) {
      m = {
        name: parsed,
        relationship: null,
        dob: null,
        gender: null,
        citizenship: null,
        disabling: null,
        disabilityTypes: null,
        studentStatus: null,
        phone: null,
        email: null,
        incomes: new Map(),
        assets: new Map(),
        nameProv: nameEV,
        order: memberOrder++,
      };
      membersByName.set(k, m);
    }
    if (draft.relationship && wins(m.relationship, draft.relationship)) m.relationship = draft.relationship;
    if (draft.disabling && wins(m.disabling, draft.disabling)) m.disabling = draft.disabling;
    if (draft.disabilityTypes && wins(m.disabilityTypes, draft.disabilityTypes)) m.disabilityTypes = draft.disabilityTypes;
    return m;
  };

  // Oldest → newest so later submissions overwrite earlier same-tier answers.
  const ordered = [...events].sort((a, b) =>
    String(a.receivedAtISO || "").localeCompare(String(b.receivedAtISO || ""))
  );

  for (const ev of ordered) {
    const verified = VERIFIED_FORM_IDS.has(ev.formId);
    const src = {
      sourceFormId: ev.formId,
      sourceFormTitle: formTitleById(ev.formId),
      receivedAtISO: ev.receivedAtISO,
      verified,
    };
    const evTrace: EventTrace = {
      formId: ev.formId,
      formTitle: src.sourceFormTitle,
      submissionId: ev.submissionId,
      submitterName: ev.submitterName,
      receivedAtISO: ev.receivedAtISO,
      fields: [],
    };
    trace.push(evTrace);

    // Sequence state for this submission's repeated blocks.
    let draft: MemberDraft = {};
    let holder: ExtractedValue | null = null; // last "Full Name" (income/asset owner)
    let pendingSource: ExtractedValue | null = null;
    const indexedMembers = new Map<number, ExtractedValue>();
    const submittedOn = eventDateISO(ev.fields);
    // Some live forms copy-paste a per-member block's label ("Gender Identity
    // (head of household)") across every repeated dependent block instead of
    // indexing it. Once a repeated Name block has started, stop letting bare
    // HOH_PERSON_SLOTS fields (dob/gender/citizenship/phone/email) overwrite
    // the HoH's real value with a later dependent's mislabeled answer.
    let sawMemberBlock = false;

    const flushDraft = () => {
      if (draft.name && isPlausibleName(draft.name.value)) {
        upsertMember(draft.name, draft);
        // "Self" marks the head of household.
        if (draft.relationship && /^self$/i.test(draft.relationship.value) && wins(hohName, draft.name)) {
          hohName = draft.name;
        }
      }
      draft = {};
    };
    const commitPendingAsAsset = () => {
      if (!pendingSource) return;
      const owner = holder ?? hohName;
      const m = owner ? upsertMember(owner) : null;
      if (m) {
        const k = pendingSource.value.toLowerCase();
        const cur = m.assets.get(k);
        if (!cur || wins(cur, pendingSource)) m.assets.set(k, pendingSource);
      }
      pendingSource = null;
    };

    for (const f of ev.fields) {
      const label = f.label;
      const value = f.value.trim();
      if (!value) continue;
      const consumedBy: string[] = [];
      const ev8 = (v: string): ExtractedValue => ({ value: v, ...src });
      const indexed = indexedMemberLabel(label);

      if (indexed?.kind === "name" && isPlausibleName(value)) {
        const name = ev8(value);
        indexedMembers.set(indexed.index, name);
        upsertMember(name);
        if (indexed.index === 1 && wins(hohName, name)) hohName = name;
        consumedBy.push("member.name");
        sawMemberBlock = true;
      } else if (indexed && indexed.kind !== "name") {
        const owner = indexedMembers.get(indexed.index) ?? (indexed.index === 1 ? hohName : null);
        if (owner) {
          const member = upsertMember(owner);
          if (indexed.kind === "dob") {
            const candidate = ev8(normalizeDob(value));
            if (wins(member.dob, candidate)) member.dob = candidate;
            consumedBy.push("member.dob");
          } else if (indexed.kind === "relationship") {
            const candidate = ev8(value);
            if (wins(member.relationship, candidate)) member.relationship = candidate;
            consumedBy.push("member.relationship");
          } else if (indexed.kind === "student") {
            const candidate = ev8(value);
            if (wins(member.studentStatus, candidate)) member.studentStatus = candidate;
            consumedBy.push("member.studentStatus");
          } else {
            const candidate = ev8(value);
            if (wins(member.disabling, candidate)) member.disabling = candidate;
            consumedBy.push("member.disabling");
          }
        }
      }

      // Signature/consent/date boilerplate: traced, never displayed or unmatched.
      if (UPLOAD_URL.test(value) || IGNORE_MATCH.test(label)) {
        // Citizenship self-cert labels ("I certify… lawfully within…") must survive.
        if (!/citizen|lawfully/i.test(label)) {
          evTrace.fields.push({ label, value, consumedBy: ["ignored"] });
          continue;
        }
      }

      // ── member blocks (positional) ──
      if (!consumedBy.length && MEMBER_NAME_MATCH.test(label) && !EXCLUDE_OTHER_PEOPLE.test(label)) {
        flushDraft();
        if (isPlausibleName(value)) {
          draft.name = ev8(value);
          consumedBy.push("member.name");
          sawMemberBlock = true;
        }
      } else if (!consumedBy.length && HOLDER_NAME_MATCH.test(label)) {
        flushDraft();
        commitPendingAsAsset();
        if (isPlausibleName(value)) {
          holder = ev8(value);
          upsertMember(holder);
          consumedBy.push("member.name");
        }
      } else if (!consumedBy.length && RELATIONSHIP_MATCH.test(label)) {
        draft.relationship = ev8(value);
        consumedBy.push("member.relationship");
      } else if (!consumedBy.length && DISABILITY_TYPES_MATCH.test(label)) {
        draft.disabilityTypes = ev8(value);
        consumedBy.push("member.disabilityTypes");
      } else if (!consumedBy.length && DISABLING_MATCH.test(label)) {
        draft.disabling = ev8(value);
        consumedBy.push("member.disabling");
      } else if (!consumedBy.length && HOH_NAME_MATCH.test(label) && !EXCLUDE_OTHER_PEOPLE.test(label)) {
        if (isPlausibleName(value)) {
          const nameEV = ev8(value);
          upsertMember(nameEV);
          if (wins(hohName, nameEV)) hohName = nameEV;
          consumedBy.push("hohName");
        }
      } else if (!consumedBy.length && MEMBER_LIST_MATCH.test(label) && !EXCLUDE_OTHER_PEOPLE.test(label)) {
        // Multi-member answers come through as newline or "·"-separated lists.
        for (const part of value.split(/\n|·/)) {
          const name = part.replace(/^[^:]*:\s*/, "").trim();
          if (isPlausibleName(name)) upsertMember(ev8(name));
        }
        consumedBy.push("member.name");
      }

      // ── income / asset blocks (positional) ──
      if (!consumedBy.length && INCOME_SOURCE_BLOCK.test(label)) {
        commitPendingAsAsset(); // a Source with no Amount before the next one = asset
        pendingSource = ev8(value);
        consumedBy.push("income.source");
      } else if (!consumedBy.length && INCOME_AMOUNT_BLOCK.test(label) && money(value)) {
        if (pendingSource) {
          const owner = holder ?? hohName;
          const m = owner ? upsertMember(owner) : null;
          if (m) {
            const k = pendingSource.value.toLowerCase();
            const cur = m.incomes.get(k);
            const entry: MemberIncome = { source: pendingSource, amountMonthly: ev8(value) };
            if (!cur || wins(cur.source, pendingSource)) m.incomes.set(k, entry);
          }
          pendingSource = null;
          consumedBy.push("income.amount");
        }
      } else if (!consumedBy.length && INCOME_SOURCE_MATCH.test(label)) {
        // Non-block forms: a lone income-source descriptor attaches to the HoH.
        const m = hohName ? upsertMember(hohName) : null;
        if (m) {
          const k = value.toLowerCase();
          const cur = m.incomes.get(k);
          if (!cur || wins(cur.source, ev8(value))) m.incomes.set(k, { source: ev8(value), amountMonthly: cur?.amountMonthly ?? null });
        }
        consumedBy.push("income.source");
      } else if (!consumedBy.length && BANK_MATCH.test(label) && !/number|routing|balance/i.test(label)) {
        const m = hohName ? upsertMember(hohName) : null;
        if (m) {
          const k = value.toLowerCase();
          const cur = m.assets.get(k);
          if (!cur || wins(cur, ev8(value))) m.assets.set(k, ev8(value));
        }
        consumedBy.push("asset");
      }

      // ── slots (HoH person, household counts, housing) ──
      for (const def of [...HOH_PERSON_SLOTS, ...HOUSEHOLD_SLOTS, ...HOUSING_SLOTS, ...FINANCIAL_SLOTS]) {
        if ((indexed || sawMemberBlock) && ["dob", "gender", "citizenship", "phone", "email"].includes(def.key)) continue;
        if (!def.match.test(label)) continue;
        if (def.exclude?.test(label)) continue;
        if (def.valueOk && !def.valueOk(value)) continue;
        const isCount = def.key === "hhSize" || def.key === "adults" || def.key === "children";
        const normalizedValue =
          def.key === "dob" ? normalizeDob(value)
            : def.key === "daysToVacate" ? remainingDays(value, submittedOn)
              : isCount ? normCount(value) : value;
        const candidate = ev8(normalizedValue);
        consumedBy.push(def.key);
        const priority = def.key === "totalIncome"
          ? /monthly income calculation/i.test(label) ? 3
            : /total monthly income/i.test(label) ? 2
              : 1
          : 0;
        const currentPriority = slotPriority.get(def.key) ?? -1;
        if (priority > currentPriority || (priority === currentPriority && wins(slotFound.get(def.key) ?? null, candidate))) {
          slotFound.set(def.key, candidate);
          slotPriority.set(def.key, priority);
        }
      }

      if (!consumedBy.length) {
        const k = `${label.toLowerCase()}::${value.toLowerCase()}`;
        if (!unmatched.has(k) && unmatched.size < 150) {
          unmatched.set(k, { label, value, sourceFormTitle: src.sourceFormTitle });
        }
      }
      evTrace.fields.push({ label, value, consumedBy });
    }

    flushDraft();
    commitPendingAsAsset();
  }

  // ── assemble ──
  // Verified forms (VERIFIED_FORM_IDS) name the HoH from actual documents, so they
  // may override the pick. Otherwise default to the first household member listed
  // (order === 0) instead of last-write-wins across self-declared submissions —
  // a later self-declared re-submission or a generic "Client Name"/"Printed Name"
  // field on an unrelated form must not bump a correctly-first-listed member.
  const verifiedHohKey =
    hohName?.verified ? splitPersonName(hohName.value).full.toLowerCase() : null;
  const firstListed = [...membersByName.values()].reduce<MemberAccum | null>(
    (first, m) => (first === null || m.order < first.order ? m : first),
    null
  );
  const hoh = (verifiedHohKey ? membersByName.get(verifiedHohKey) ?? null : null) ?? firstListed;

  // HoH-person slots (dob/gender/citizenship/phone/email) fold into their card.
  if (hoh) {
    for (const def of HOH_PERSON_SLOTS) {
      const v = slotFound.get(def.key);
      if (!v) continue;
      const cur = hoh[def.key as "dob" | "gender" | "citizenship" | "phone" | "email"];
      if (wins(cur, v)) hoh[def.key as "dob" | "gender" | "citizenship" | "phone" | "email"] = v;
    }
  }

  const members: HouseholdMember[] = [...membersByName.values()]
    .sort((a, b) => Number(b === hoh) - Number(a === hoh) || a.order - b.order)
    .map((m) => ({
      ...m,
      isHoH: m === hoh,
      age: m.dob ? ageFromDob(m.dob.value) : null,
      incomes: [...m.incomes.values()],
      assets: [...m.assets.values()],
    }));

  const slot = (key: string) => slotFound.get(key) ?? null;

  // Current address: the full-location field wins; else compose street/city/zip.
  let address: ExtractedValue | null = slot("addressFull");
  if (!address && slot("street")) {
    const parts = [slot("street")?.value, slot("city")?.value, slot("stateZip")?.value].filter(Boolean);
    address = { ...slot("street")!, value: parts.join(", ") };
  }
  const decomposedAddress = addressParts(address);
  if (address) {
    const part = (key: string) => decomposedAddress.find((row) => row.key === key)?.found?.value || "";
    const locality = [part("addressCity"), [part("addressState"), part("addressZip")].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    address = {
      ...address,
      value: [
        part("addressStreet"),
        part("addressUnit") ? `Unit ${part("addressUnit")}` : "",
        locality,
      ].filter(Boolean).join(", "),
    };
  }

  const household: SlotValue[] = [
    { key: "hhSize", label: "Household size", found: slot("hhSize") },
    { key: "adults", label: "Adults", found: slot("adults") },
    { key: "children", label: "Children", found: slot("children") },
    { key: "totalIncome", label: "Total income (monthly)", found: slot("totalIncome") },
  ];

  const housing: SlotValue[] = [
    { key: "housingStatus", label: "Housing status", found: slot("housingStatus") },
    { key: "daysToVacate", label: "Days until eviction", found: slot("daysToVacate") },
    { key: "monthlyRent", label: "Monthly rent", found: slot("monthlyRent") },
    { key: "backRent", label: "Back rent owed", found: slot("backRent") },
    { key: "address", label: "Full unit address", found: address },
    ...decomposedAddress,
  ];

  const financial: SlotValue[] = [
    { key: "totalIncome", label: "Authoritative monthly income", found: slot("totalIncome") },
    { key: "annualIncome", label: "Household annual income", found: slot("annualIncome") },
    { key: "assetTotal", label: "Total assets", found: slot("assetTotal") },
    { key: "monthlyHousingCost", label: "Monthly housing cost", found: slot("monthlyHousingCost") },
    { key: "depositAmount", label: "Security deposit", found: slot("depositAmount") },
    {
      key: "arrearsAmount",
      label: "Rent arrears",
      found: /^y/i.test(slot("includeArrears")?.value || "") ? slot("proratedOrArrears") : slot("backRent"),
    },
    {
      key: "proratedAmount",
      label: "Prorated rent",
      found: /^y/i.test(slot("includeArrears")?.value || "") ? null : slot("proratedOrArrears"),
    },
    { key: "tenantRentPayment", label: "Tenant rent payment", found: slot("tenantRentPayment") },
    { key: "hrdcRentPayment", label: "HRDC rent payment", found: slot("hrdcRentPayment") },
    { key: "utilityAllowance", label: "Utility allowance", found: slot("utilityAllowance") },
  ];

  // Compatibility slots for HoH-prefill consumers (CreateCustomerModal).
  const hohDob = hoh?.dob ?? slot("dob");
  const hohAge = hohDob ? ageFromDob(hohDob.value) : null;
  const slots: SlotValue[] = [
    { key: "hohName", label: "Name", found: hoh ? { ...hoh.nameProv, value: hoh.name.full } : hohName },
    { key: "dob", label: "DOB", found: hohDob },
    { key: "age", label: "Age", found: hohDob && hohAge != null ? { ...hohDob, value: String(hohAge) } : null },
    { key: "cwId", label: "CWID", found: slot("cwId") },
  ];

  return {
    members,
    household,
    housing,
    financial,
    slots,
    unmatched: [...unmatched.values()],
    trace: [...trace].reverse(), // newest first for the export
  };
}
