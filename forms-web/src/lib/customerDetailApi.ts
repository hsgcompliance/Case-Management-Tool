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
export type HouseholdFormGroup = {
  formId: string;
  formName: string;
  count: number;
  latestLinkedAt: string | null;
  latestSubmissionId: string | null;
};
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
  email: string | null;
  caseManagerName: string | null;
  caseManagerId: string | null;
  secondaryCaseManagerName: string | null;
  population: string | null;
  status: string | null;
  tier: number | null;
  acuityScore: number | null;
  otherContacts: Array<{ name: string | null; role: string | null }>;
  linkedSubmissions: LinkedSubmission[];
  household: HouseholdObject;
  driveFolderId: string | null;
  driveFolderUrl: string | null;
  tssWorkbook: {
    spreadsheetId: string;
    spreadsheetUrl: string;
    spreadsheetName: string | null;
    variant: string | null;
  } | null;
  notes: Record<string, string>;
  tssPayerStatus: string | null;
};

// Cache per customer id so flipping tabs / re-opening forms doesn't refetch.
const cache = new Map<string, Promise<CustomerDetail | null>>();
const listeners = new Map<string, Set<(detail: CustomerDetail | null) => void>>();

function publish(key: string, detail: CustomerDetail | null): CustomerDetail | null {
  for (const listener of listeners.get(key) ?? []) listener(detail);
  return detail;
}

export function getCustomerDetail(id: string, force = false): Promise<CustomerDetail | null> {
  const key = String(id || "").trim();
  if (!key) return Promise.resolve(null);
  if (!cache.has(key) || force) {
    cache.set(
      key,
      getAuthed<{ ok: true; detail: CustomerDetail }>("formsCustomerDetail", { id: key })
        .then((o) => o.detail ?? null)
        .then((detail) => publish(key, detail))
        .catch(() => null)
    );
  }
  return cache.get(key)!;
}

export function clearCustomerDetailCache(id: string): void {
  cache.delete(String(id || "").trim());
}

export function subscribeCustomerDetail(
  id: string,
  listener: (detail: CustomerDetail | null) => void,
): () => void {
  const key = String(id || "").trim();
  if (!key) return () => {};
  const current = listeners.get(key) ?? new Set<(detail: CustomerDetail | null) => void>();
  current.add(listener);
  listeners.set(key, current);
  return () => {
    const active = listeners.get(key);
    active?.delete(listener);
    if (!active?.size) listeners.delete(key);
  };
}

/** Keep the customer header synchronized immediately after the sidebar links a submission. */
export function cacheLinkedSubmission(id: string, linked: LinkedSubmission): void {
  const key = String(id || "").trim();
  const current = cache.get(key);
  if (!key || !current) return;

  const nextPromise = current.then((detail) => {
    if (!detail) return detail;
    const existingIndex = detail.linkedSubmissions.findIndex(
      (item) => item.submissionId === linked.submissionId,
    );
    const linkedSubmissions = existingIndex >= 0
      ? detail.linkedSubmissions.map((item, index) => index === existingIndex ? linked : item)
      : [...detail.linkedSubmissions, linked];
    const byForm = new Map<string, HouseholdFormGroup>();
    for (const item of linkedSubmissions) {
      const groupKey = item.formId || item.formName || item.submissionId;
      const group = byForm.get(groupKey) ?? {
        formId: item.formId,
        formName: item.formName || (item.formId ? `Form ${item.formId}` : "Form"),
        count: 0,
        latestLinkedAt: null,
        latestSubmissionId: null,
      };
      group.count += 1;
      if (
        !group.latestSubmissionId ||
        (item.linkedAt && (!group.latestLinkedAt || item.linkedAt > group.latestLinkedAt))
      ) {
        group.latestSubmissionId = item.submissionId;
      }
      if (item.linkedAt && (!group.latestLinkedAt || item.linkedAt > group.latestLinkedAt)) {
        group.latestLinkedAt = item.linkedAt;
      }
      byForm.set(groupKey, group);
    }
    const forms = [...byForm.values()].sort(
      (a, b) => (b.latestLinkedAt || "").localeCompare(a.latestLinkedAt || ""),
    );
    const normalized = detail.household.normalized.map((field) =>
      field.key === "linkedForms"
        ? { ...field, value: String(linkedSubmissions.length) }
        : field,
    );
    return publish(key, {
      ...detail,
      linkedSubmissions,
      household: {
        ...detail.household,
        forms,
        formCount: linkedSubmissions.length,
        normalized,
      },
    });
  });
  cache.set(key, nextPromise);
}
