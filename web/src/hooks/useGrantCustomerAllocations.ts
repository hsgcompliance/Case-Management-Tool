// web/src/hooks/useGrantCustomerAllocations.ts
//
// Fetches per-customer allocation data for a grant:
//   - paid:      from grantCustomerSpend (written by ledger posts)
//   - projected: from paymentQueue (source=projection, queueStatus=pending)
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

  // 2. Projected from paymentQueue (source=projection, queueStatus=pending)
  const projSnap = await getDocs(
    query(
      collection(db, "paymentQueue"),
      where("grantId", "==", grantId),
      where("source", "==", "projection"),
      where("queueStatus", "==", "pending"),
    ),
  );

  const projMap: Record<string, number> = {};
  for (const d of projSnap.docs) {
    const data = d.data();
    const cid = String(data.customerId || "");
    if (!cid) continue;
    projMap[cid] = (projMap[cid] || 0) + Number(data.amount || 0);
  }

  // 3. Merge all customer IDs
  const allIds = Array.from(new Set([...Object.keys(paidMap), ...Object.keys(projMap)]));
  const names = await fetchCustomerNames(allIds);

  const result: CustomerAllocation[] = allIds.map((customerId) => {
    const paid = paidMap[customerId]?.paid || 0;
    const projected = projMap[customerId] || 0;
    return {
      customerId,
      customerName: names[customerId] || customerId,
      paid,
      projected,
      total: paid + projected,
      lineItemSpend: paidMap[customerId]?.lineItemSpend || {},
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
