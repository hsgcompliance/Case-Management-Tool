"use client";

export type CustomerOtherContact = {
  uid: string;
  name: string | null;
  role: string | null;
};

function trimOrEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeOtherContacts(value: unknown): CustomerOtherContact[] {
  if (!Array.isArray(value)) return [];
  const out: CustomerOtherContact[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    const uid = trimOrEmpty((entry as { uid?: unknown })?.uid);
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);
    out.push({
      uid,
      name: trimOrEmpty((entry as { name?: unknown })?.name) || null,
      role: trimOrEmpty((entry as { role?: unknown })?.role) || null,
    });
  }

  return out;
}

export function contactCaseManagerIdsForCustomer(customer: Record<string, unknown> | null | undefined): string[] {
  if (!customer) return [];
  const ids = [
    trimOrEmpty(customer.caseManagerId),
    trimOrEmpty(customer.secondaryCaseManagerId),
    ...normalizeOtherContacts(customer.otherContacts).map((entry) => entry.uid),
  ].filter(Boolean);
  return Array.from(new Set(ids));
}

export function customerContactRoleForUid(
  customer: Record<string, unknown> | null | undefined,
  uid: string | null | undefined,
): "primary" | "secondary" | "other" | null {
  const targetUid = trimOrEmpty(uid);
  if (!customer || !targetUid) return null;
  if (trimOrEmpty(customer.caseManagerId) === targetUid) return "primary";
  if (trimOrEmpty(customer.secondaryCaseManagerId) === targetUid) return "secondary";
  return normalizeOtherContacts(customer.otherContacts).some((entry) => entry.uid === targetUid) ? "other" : null;
}
