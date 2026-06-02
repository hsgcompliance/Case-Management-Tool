import { useQuery } from "@tanstack/react-query";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { qk } from "@hooks/queryKeys";
import { RQ_DEFAULTS } from "@hooks/base";

export interface Enrollment {
  id: string;
  customerId: string;
  grantId?: string;
  grantName?: string;
  name?: string;
  status?: string;
  active?: boolean;
  deleted?: boolean;
  startDate?: string;
  endDate?: string;
  totalProjected?: number;
  totalPaid?: number;
  nextDue?: { date?: string; amount?: number };
  rentCertDue?: string;
  caseManagerName?: string;
  updatedAt?: string;
  createdAt?: string;
}

function asTime(v: unknown): number {
  if (!v) return 0;
  if (typeof v === "string" || typeof v === "number") return new Date(v as string).getTime() || 0;
  const ts = v as { toDate?: () => Date; seconds?: number };
  if (typeof ts.toDate === "function") return ts.toDate().getTime();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  return 0;
}

function isActive(e: Enrollment): boolean {
  if (e.deleted === true) return false;
  const s = String(e.status || "").toLowerCase();
  return e.active === true || s === "active";
}

async function fetchEnrollments(customerId: string): Promise<Enrollment[]> {
  const snap = await getDocs(
    query(
      collection(db, "customerEnrollments"),
      where("customerId", "==", customerId),
      where("deleted", "==", false),
    ),
  );

  const items: Enrollment[] = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      customerId: data.customerId,
      grantId: data.grantId,
      grantName: data.grantName,
      name: data.name,
      status: data.status,
      active: data.active,
      deleted: data.deleted,
      startDate: data.startDate,
      endDate: data.endDate,
      totalProjected: data.totalProjected,
      totalPaid: data.totalPaid,
      nextDue: data.nextDue,
      rentCertDue: data.rentCertDue,
      caseManagerName: data.caseManagerName,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? data.updatedAt,
      createdAt: data.createdAt?.toDate?.()?.toISOString() ?? data.createdAt,
    };
  });

  // Active first, then by most recent activity
  return items.sort((a, b) => {
    const aA = isActive(a) ? 1 : 0;
    const bA = isActive(b) ? 1 : 0;
    if (bA !== aA) return bA - aA;
    return (
      Math.max(asTime(b.updatedAt), asTime(b.startDate), asTime(b.createdAt)) -
      Math.max(asTime(a.updatedAt), asTime(a.startDate), asTime(a.createdAt))
    );
  });
}

export function useCustomerEnrollments(customerId: string | undefined) {
  return useQuery({
    queryKey: qk.enrollments.byCustomer(customerId ?? ""),
    queryFn: () => fetchEnrollments(customerId!),
    enabled: !!customerId,
    ...RQ_DEFAULTS,
    staleTime: 10 * 60_000,
  });
}

/** Returns the set of customer IDs actively enrolled in a specific grant/program. */
export function useCustomersByGrant(grantId: string | null) {
  return useQuery({
    queryKey: ["enrollments", "byGrant", grantId ?? ""],
    queryFn: async () => {
      if (!grantId) return new Set<string>();
      const snap = await getDocs(
        query(
          collection(db, "customerEnrollments"),
          where("grantId", "==", grantId),
          where("active", "==", true),
        ),
      );
      return new Set(snap.docs.map((d) => String(d.data().customerId ?? "")));
    },
    enabled: !!grantId,
    staleTime: 5 * 60_000,
  });
}
