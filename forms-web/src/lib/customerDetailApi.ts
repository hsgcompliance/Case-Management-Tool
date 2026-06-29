import { getAuthed } from "./authedApi";

// Full(er) customer view sourced from the customer doc (not the minimal search
// index), plus the normalized household object. Powers the tabbed customer header.

export type LinkedSubmission = {
  formId: string;
  formName: string | null;
  submissionId: string;
  alias: string | null;
  cwId: string | null;
  linkedAt: string | null;
  linkedBy: string | null;
};

export type HouseholdField = { key: string; label: string; value: string };
export type HouseholdFormGroup = { formId: string; formName: string; count: number; latestLinkedAt: string | null };
export type HouseholdMember = { name: string; cwId: string | null; dob: string | null; relation: string };

export type HouseholdObject = {
  headOfHousehold: string;
  cwId: string | null;
  memberCount: number;
  members: HouseholdMember[];
  normalized: HouseholdField[];
  forms: HouseholdFormGroup[];
  formCount: number;
};

export type CustomerDetail = {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  cwId: string | null;
  dob: string | null;
  caseManagerName: string | null;
  secondaryCaseManagerName: string | null;
  population: string | null;
  status: string | null;
  acuityScore: number | null;
  otherContacts: Array<{ name: string | null; role: string | null }>;
  linkedSubmissions: LinkedSubmission[];
  household: HouseholdObject;
};

// Cache per customer id so flipping tabs / re-opening forms doesn't refetch.
const cache = new Map<string, Promise<CustomerDetail | null>>();

export function getCustomerDetail(id: string, force = false): Promise<CustomerDetail | null> {
  const key = String(id || "").trim();
  if (!key) return Promise.resolve(null);
  if (!cache.has(key) || force) {
    cache.set(
      key,
      getAuthed<{ ok: true; detail: CustomerDetail }>("formsCustomerDetail", { id: key })
        .then((o) => o.detail ?? null)
        .catch(() => null)
    );
  }
  return cache.get(key)!;
}
