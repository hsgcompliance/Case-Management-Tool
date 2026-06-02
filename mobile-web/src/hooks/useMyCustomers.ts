import { useQuery } from "@tanstack/react-query";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface CustomerOption {
  id: string;
  name: string;
  status: string;
}

async function fetchMyCustomers(uid: string): Promise<CustomerOption[]> {
  // Query active enrollments for this CM, then resolve customer names
  const snap = await getDocs(
    query(
      collection(db, "customerEnrollments"),
      where("caseManagerId", "==", uid),
      where("status", "==", "active"),
      where("deleted", "==", false),
      orderBy("customerName"),
      limit(200),
    ),
  );

  const seen = new Set<string>();
  const results: CustomerOption[] = [];
  snap.forEach((doc) => {
    const d = doc.data();
    const cid = d.customerId as string;
    if (!cid || seen.has(cid)) return;
    seen.add(cid);
    results.push({
      id: cid,
      name: d.customerName ?? d.customerFirstName ? `${d.customerFirstName ?? ""} ${d.customerLastName ?? ""}`.trim() : cid,
      status: d.status ?? "active",
    });
  });
  return results;
}

export function useMyCustomers(uid: string | undefined) {
  return useQuery({
    queryKey: ["myCustomers", uid],
    queryFn: () => fetchMyCustomers(uid!),
    enabled: !!uid,
    staleTime: 1000 * 60 * 10,
  });
}
