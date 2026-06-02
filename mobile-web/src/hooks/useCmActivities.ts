import { useQuery } from "@tanstack/react-query";
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { TCmActivity } from "@hdb/contracts";

interface ActivityFilters {
  month?: string;    // "YYYY-MM"
  customerId?: string;
  maxItems?: number;
}

function tsToISO(ts: unknown): string {
  if (ts instanceof Timestamp) return ts.toDate().toISOString();
  if (typeof ts === "string") return ts;
  return new Date(ts as number).toISOString();
}

async function fetchActivities(uid: string, filters: ActivityFilters): Promise<TCmActivity[]> {
  const constraints: Parameters<typeof query>[1][] = [
    where("caseManagerId", "==", uid),
    orderBy("date", "desc"),
    orderBy("createdAt", "desc"),
    limit(filters.maxItems ?? 100),
  ];

  if (filters.customerId) {
    constraints.push(where("customerId", "==", filters.customerId));
  }
  if (filters.month) {
    const [year, month] = filters.month.split("-");
    const start = `${year}-${month}-01`;
    const nextMonth = new Date(Number(year), Number(month), 1);
    const end = nextMonth.toISOString().slice(0, 10);
    constraints.push(where("date", ">=", start), where("date", "<", end));
  }

  const snap = await getDocs(query(collection(db, "cmActivities"), ...constraints));
  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      orgId: d.orgId,
      caseManagerId: d.caseManagerId,
      caseManagerName: d.caseManagerName,
      customerId: d.customerId,
      customerName: d.customerName,
      type: d.type,
      date: d.date,
      startTime: d.startTime,
      endTime: d.endTime,
      note: d.note,
      calendarEventId: d.calendarEventId,
      calendarSynced: d.calendarSynced,
      createdAt: tsToISO(d.createdAt),
      updatedAt: d.updatedAt ? tsToISO(d.updatedAt) : undefined,
    } as TCmActivity;
  });
}

export function useCmActivities(uid: string | undefined, filters: ActivityFilters = {}) {
  return useQuery({
    queryKey: ["cmActivities", uid, filters],
    queryFn: () => fetchActivities(uid!, filters),
    enabled: !!uid,
    staleTime: 1000 * 60 * 2,
  });
}
