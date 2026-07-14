import { getAuthed, postAuthed } from "./authedApi";

export type FormsCustomer = {
  id: string;
  name: string;
  caseManagerName: string | null;
  cwId: string | null;
  dob: string | null;
};

// Minimal customer index (name + id + CWID + CM) — cached once, filtered client-side.
// We intentionally cache only these fields, never the full customer doc.
let cache: Promise<FormsCustomer[]> | null = null;

export function loadCustomers(force = false): Promise<FormsCustomer[]> {
  if (!cache || force) {
    cache = getAuthed<{ ok: true; items: FormsCustomer[] }>("formsCustomerSearch", {})
      .then((o) => o.items ?? [])
      .catch(() => []);
  }
  return cache;
}

export type CreateCustomerBody = {
  firstName: string;
  lastName: string;
  dob?: string;
  cwId?: string;
  caseManagerName?: string;
  caseManagerId?: string;
  secondaryCaseManagerName?: string;
  secondaryCaseManagerId?: string;
  otherContacts?: { uid: string; name?: string; role?: string }[];
  medicaid?: "yes" | "no" | "not_sure";
  buildDrive?: boolean;
  force?: boolean;
};

export type CreateCustomerResp = {
  ok: true;
  customer: FormsCustomer;
  drive: {
    built: boolean;
    folderUrl?: string;
    folderName?: string;
    workbookLinked?: boolean;
    reason?: string;
    error?: string;
    linkError?: string;
  };
};

/** Create a customer (+ best-effort Drive folder build/link) via the backend. */
export function createCustomer(body: CreateCustomerBody): Promise<CreateCustomerResp> {
  return postAuthed<CreateCustomerResp>("formsCustomerCreate", body);
}

/** Persist the intake TSS payer/non-payer gate selection onto the customer doc. */
export function setCustomerTssStatus(customerId: string, status: "payer" | "nonpayer"): Promise<void> {
  return postAuthed("formsCustomerSetTssStatus", { customerId, status });
}

export function filterCustomers(list: FormsCustomer[], q: string, limit = 12): FormsCustomer[] {
  const ql = q.trim().toLowerCase();
  if (!ql) return list.slice(0, limit);
  return list.filter((c) => `${c.name} ${c.cwId ?? ""}`.toLowerCase().includes(ql)).slice(0, limit);
}
