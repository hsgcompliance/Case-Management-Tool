// functions/src/features/inbox/customerLookup.ts
import { db } from "../../core";

const cleanText = (v: unknown): string | null => {
  const s = String(v || "").trim();
  return s || null;
};

export type CustomerCmFields = {
  customerName: string | null;
  cmUid: string | null;
  secondaryCmUid: string | null;
};

const EMPTY: CustomerCmFields = { customerName: null, cmUid: null, secondaryCmUid: null };

/**
 * Single source of customer name + primary/secondary CM uid derivation,
 * shared by the enrollment inbox indexer and the otherTasks indexer so both
 * projections agree on who "owns" a customer.
 */
export async function resolveCustomerCmFields(customerId: string | null | undefined): Promise<CustomerCmFields> {
  const id = String(customerId || "").trim();
  if (!id) return EMPTY;

  const snap = await db.collection("customers").doc(id).get().catch(() => null);
  if (!snap?.exists) return EMPTY;
  const c: any = snap.data() || {};

  const customerName =
    cleanText(c.name) ||
    [cleanText(c.firstName), cleanText(c.lastName)].filter(Boolean).join(" ").trim() ||
    null;

  return {
    customerName,
    cmUid: cleanText(c.caseManagerId),
    secondaryCmUid: cleanText(c.secondaryCaseManagerId),
  };
}
