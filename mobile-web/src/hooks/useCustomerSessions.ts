import { useQuery } from "@tanstack/react-query";
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { qk } from "@hooks/queryKeys";
import { RQ_LIVE } from "@hooks/base";
import type { TCmActivity } from "@hdb/contracts";

function tsToISO(ts: unknown): string {
  if (ts instanceof Timestamp) return ts.toDate().toISOString();
  if (typeof ts === "string") return ts;
  return new Date(ts as number).toISOString();
}

async function fetchCustomerSessions(uid: string, customerId: string): Promise<TCmActivity[]> {
  const snap = await getDocs(
    query(
      collection(db, "cmActivities"),
      where("caseManagerId", "==", uid),
      where("customerId", "==", customerId),
      orderBy("date", "desc"),
      limit(100),
    ),
  );
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
      startTime: d.startTime ?? undefined,
      endTime: d.endTime ?? undefined,
      note: d.note ?? undefined,
      calendarEventId: d.calendarEventId ?? undefined,
      calendarSynced: d.calendarSynced,
      workbookSynced: d.workbookSynced ?? undefined,
      workbookSyncedAt: d.workbookSyncedAt ?? undefined,
      workbookRowKey: d.workbookRowKey ?? undefined,
      archived: d.archived ?? undefined,
      createdAt: tsToISO(d.createdAt),
      updatedAt: d.updatedAt ? tsToISO(d.updatedAt) : undefined,
    } as TCmActivity;
  });
}

export function useCustomerSessions(uid: string | undefined, customerId: string | undefined) {
  return useQuery({
    queryKey: qk.cmActivities.byCustomer(uid ?? "", customerId ?? ""),
    queryFn: () => fetchCustomerSessions(uid!, customerId!),
    enabled: !!uid && !!customerId,
    ...RQ_LIVE,
  });
}
