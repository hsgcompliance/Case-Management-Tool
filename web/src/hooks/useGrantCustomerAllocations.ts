// web/src/hooks/useGrantCustomerAllocations.ts
//
// Fetches per-customer allocation data for a grant:
//   - paid:      from grantCustomerSpend (written by ledger posts)
//   - projected: from pending paymentQueue rows (projection, invoice, credit-card)
//   - names:     batch-fetched from customers collection
//
// Returns a sorted list of CustomerAllocation records for the AllocationTab.

import { useQuery } from "@tanstack/react-query";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@lib/firebase";

export type CustomerAllocation = {
  customerId: string;
  customerName: string;
  paid: number;
  projected: number;
  total: number;
  lineItemSpend: Record<string, number>;
  lineItemProjected: Record<string, number>;
  lineItemTotal: Record<string, number>;
};

async function fetchCustomerNames(customerIds: string[]): Promise<Record<string, string>> {
  const names: Record<string, string> = {};
  if (!customerIds.length) return names;

  // Batch into chunks of 30 (Firestore "in" limit)
  const chunks: string[][] = [];
  for (let i = 0; i < customerIds.length; i += 30) {
    chunks.push(customerIds.slice(i, i + 30));
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      const snaps = await Promise.all(chunk.map((id) => getDoc(doc(db, "customers", id))));
      for (const snap of snaps) {
        if (!snap.exists()) continue;
        const d = snap.data() || {};
        const name =
          String(d.name || "").trim() ||
          [d.firstName, d.lastName].filter(Boolean).join(" ").trim() ||
          snap.id;
        names[snap.id] = name;
      }
    }),
  );

  return names;
}

async function fetchGrantAllocations(grantId: string): Promise<CustomerAllocation[]> {
  // 1. Paid totals from grantCustomerSpend
  const spendSnap = await getDocs(
    query(collection(db, "grantCustomerSpend"), where("grantId", "==", grantId)),
  );

  const paidMap: Record<string, { paid: number; lineItemSpend: Record<string, number> }> = {};
  for (const d of spendSnap.docs) {
    const data = d.data();
    const cid = String(data.customerId || "");
    if (!cid) continue;
    paidMap[cid] = {
      paid: Number(data.totalSpend || 0),
      lineItemSpend: (data.lineItemSpend as Record<string, number>) || {},
    };
  }

  // 2. Projected from pending paymentQueue rows that reserve grant/customer allocation.
  const projSnap = await getDocs(
    query(
      collection(db, "paymentQueue"),
      where("grantId", "==", grantId),
      where("queueStatus", "==", "pending"),
    ),
  );

  const projMap: Record<string, number> = {};
  const projLineMap: Record<string, Record<string, number>> = {};
  const allocationSources = new Set(["projection", "invoice", "credit-card"]);
  for (const d of projSnap.docs) {
    const data = d.data();
    const source = String(data.source || "").toLowerCase();
    if (!allocationSources.has(source)) continue;
    const cid = String(data.customerId || "");
    if (!cid) continue;
    const amount = Number(data.amount || 0);
    projMap[cid] = (projMap[cid] || 0) + amount;
    const lineItemId = String(data.lineItemId || "");
    if (lineItemId) {
      projLineMap[cid] = projLineMap[cid] || {};
      projLineMap[cid][lineItemId] = (projLineMap[cid][lineItemId] || 0) + amount;
    }
  }

  // 3. Merge all customer IDs
  const allIds = Array.from(new Set([...Object.keys(paidMap), ...Object.keys(projMap)]));
  const names = await fetchCustomerNames(allIds);

  const result: CustomerAllocation[] = allIds.map((customerId) => {
    const paid = paidMap[customerId]?.paid || 0;
    const projected = projMap[customerId] || 0;
    const lineItemSpend = paidMap[customerId]?.lineItemSpend || {};
    const lineItemProjected = projLineMap[customerId] || {};
    const lineItemIds = new Set([...Object.keys(lineItemSpend), ...Object.keys(lineItemProjected)]);
    const lineItemTotal = Array.from(lineItemIds).reduce<Record<string, number>>((acc, lineItemId) => {
      acc[lineItemId] = (lineItemSpend[lineItemId] || 0) + (lineItemProjected[lineItemId] || 0);
      return acc;
    }, {});
    return {
      customerId,
      customerName: names[customerId] || customerId,
      paid,
      projected,
      total: paid + projected,
      lineItemSpend,
      lineItemProjected,
      lineItemTotal,
    };
  });

  result.sort((a, b) => b.total - a.total);
  return result;
}

export function useGrantCustomerAllocations(
  grantId: string | null | undefined,
  opts?: { enabled?: boolean },
) {
  return useQuery({
    enabled: (opts?.enabled ?? true) && !!grantId,
    queryKey: ["grantAllocations", grantId ?? ""],
    queryFn: () => fetchGrantAllocations(grantId!),
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
}
