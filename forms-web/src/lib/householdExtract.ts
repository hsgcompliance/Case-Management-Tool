import type { WebhookEventDetail } from "./webhookDetailsApi";

// Builds the "structured" household picture from webhook events as intake forms
// come in. Pure label heuristics over the flattened fields — newest submission
// wins per slot, and every extracted value keeps its source form + timestamp so
// staff can trust (and copy) what they see.

export type ExtractedValue = {
  value: string;
  sourceFormId: string;
  sourceFormTitle: string;
  receivedAtISO: string | null;
};

export type UnmatchedField = {
  label: string;
  value: string;
  sourceFormTitle: string;
};

export type HouseholdInfo = {
  /** Ordered head-of-household slots (label → newest value, if any). */
  slots: { key: string; label: string; found: ExtractedValue | null }[];
  /** Distinct household member names collected across forms. */
  members: ExtractedValue[];
  hhSize: ExtractedValue | null;
  adults: ExtractedValue | null;
  children: ExtractedValue | null;
  /** Fields no matcher consumed — the troubleshooting list for tuning the regexes. */
  unmatched: UnmatchedField[];
};

type SlotDef = {
  key: string;
  label: string;
  match: RegExp;
  exclude?: RegExp;
  /** Extra gate on the VALUE (e.g. income amount should look like money/number). */
  valueOk?: (v: string) => boolean;
};

const EXCLUDE_OTHER_PEOPLE = /landlord|employer|case ?manager|staff|worker|user|business|company|agency|contact person/i;

const SLOT_DEFS: SlotDef[] = [
  {
    key: "hohName",
    label: "Name",
    match: /head of household|full name|client name|customer name|applicant name|participant name|^name\b/i,
    exclude: new RegExp(`${EXCLUDE_OTHER_PEOPLE.source}|member|child|spouse|dependent|bank`, "i"),
  },
  {
    key: "dob",
    label: "DOB",
    match: /date of birth|\bdob\b|birth ?date/i,
    exclude: /member|child|spouse|dependent/i,
  },
  {
    key: "cwId",
    label: "CWID",
    match: /\bcw ?id\b|caseworthy/i,
  },
  {
    key: "citizenship",
    label: "Citizenship status",
    match: /citizen/i,
  },
  {
    key: "disabling",
    label: "Disabling conditions",
    match: /disab/i,
  },
  {
    key: "incomeSource",
    label: "Income source",
    match: /(source|type)s? of income|income (source|type)|primary income|employment status/i,
  },
  {
    key: "incomeAmount",
    label: "Est. income amount",
    match: /income/i,
    exclude: /(source|type)s? of income|income (source|type)|zero income|no income/i,
    valueOk: (v) => /\$|\d/.test(v),
  },
  {
    key: "bankName",
    label: "Bank account name",
    match: /bank|financial institution|account name/i,
    exclude: /number|routing|balance/i,
  },
];

const MEMBER_MATCH = /household member|hh member|member('s)? name|additional (household )?member|dependent name|other adult|child(ren)?('s)? name/i;
const HH_SIZE_MATCH = /household size|(number|#|total)( of)?( people| persons| members)?( in| of)? (the )?household|family size/i;
const ADULTS_MATCH = /(number|#|how many)( of)? adults/i;
const CHILDREN_MATCH = /(number|#|how many)( of)? (children|minors|kids)/i;

function newer(a: ExtractedValue | null, b: ExtractedValue): boolean {
  if (!a) return true;
  return String(b.receivedAtISO || "") >= String(a.receivedAtISO || "");
}

/** Compute age in years from a parseable DOB string, or null. */
export function ageFromDob(dob: string): number | null {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

export function extractHousehold(
  events: WebhookEventDetail[],
  formTitleById: (id: string) => string
): HouseholdInfo {
  const found = new Map<string, ExtractedValue>();
  const members = new Map<string, ExtractedValue>(); // key: normalized name
  let hhSize: ExtractedValue | null = null;
  let adults: ExtractedValue | null = null;
  let children: ExtractedValue | null = null;
  const unmatched = new Map<string, UnmatchedField>(); // key: label::value

  // Oldest → newest so later submissions overwrite earlier answers.
  const ordered = [...events].sort((a, b) =>
    String(a.receivedAtISO || "").localeCompare(String(b.receivedAtISO || ""))
  );

  for (const ev of ordered) {
    const src = {
      sourceFormId: ev.formId,
      sourceFormTitle: formTitleById(ev.formId),
      receivedAtISO: ev.receivedAtISO,
    };
    for (const f of ev.fields) {
      const label = f.label;
      const value = f.value.trim();
      if (!value) continue;
      let consumed = false;

      for (const def of SLOT_DEFS) {
        if (!def.match.test(label)) continue;
        if (def.exclude?.test(label)) continue;
        if (def.valueOk && !def.valueOk(value)) continue;
        consumed = true;
        const candidate: ExtractedValue = { value, ...src };
        if (newer(found.get(def.key) ?? null, candidate)) found.set(def.key, candidate);
      }

      if (MEMBER_MATCH.test(label) && !EXCLUDE_OTHER_PEOPLE.test(label)) {
        consumed = true;
        // Multi-member answers come through as newline or "·"-separated lists.
        for (const part of value.split(/\n|·/)) {
          const name = part.replace(/^[^:]*:\s*/, "").trim();
          if (name.length >= 3 && /[a-z]/i.test(name)) {
            const k = name.toLowerCase();
            if (!members.has(k)) members.set(k, { value: name, ...src });
          }
        }
      }

      const numeric = /^\d{1,2}$/.test(value);
      if (HH_SIZE_MATCH.test(label) && numeric) {
        consumed = true;
        if (newer(hhSize, { value, ...src })) hhSize = { value, ...src };
      }
      if (ADULTS_MATCH.test(label) && numeric) {
        consumed = true;
        if (newer(adults, { value, ...src })) adults = { value, ...src };
      }
      if (CHILDREN_MATCH.test(label) && numeric) {
        consumed = true;
        if (newer(children, { value, ...src })) children = { value, ...src };
      }

      if (!consumed) {
        const k = `${label.toLowerCase()}::${value.toLowerCase()}`;
        if (!unmatched.has(k) && unmatched.size < 150) {
          unmatched.set(k, { label, value, sourceFormTitle: src.sourceFormTitle });
        }
      }
    }
  }

  // Age derives from the extracted DOB (kept as its own copyable slot).
  const dob = found.get("dob") ?? null;
  const age = dob ? ageFromDob(dob.value) : null;

  const slots: HouseholdInfo["slots"] = [];
  for (const def of SLOT_DEFS) {
    slots.push({ key: def.key, label: def.label, found: found.get(def.key) ?? null });
    if (def.key === "dob") {
      slots.push({
        key: "age",
        label: "Age",
        found: age != null && dob ? { ...dob, value: String(age) } : null,
      });
    }
  }

  return { slots, members: [...members.values()], hhSize, adults, children, unmatched: [...unmatched.values()] };
}
