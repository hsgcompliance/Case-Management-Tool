import { useInfiniteQuery } from "@tanstack/react-query";
import {
  collection, query, where, getDocs, orderBy, limit,
  startAfter, Timestamp, type DocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { qk } from "@hooks/queryKeys";
import { RQ_LIVE } from "@hooks/base";
import { rangeBounds, type DateRangeKey } from "@/lib/dateRange";
import type { TCmActivity } from "@hdb/contracts";

const PAGE_SIZE = 50;

function tsToISO(ts: unknown): string {
  if (ts instanceof Timestamp) return ts.toDate().toISOString();
  if (typeof ts === "string") return ts;
  return new Date(ts as number).toISOString();
}

function docToActivity(doc: DocumentSnapshot): TCmActivity {
  const d = doc.data() ?? {};
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
}

interface Page {
  items: TCmActivity[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
}

async function fetchPage(
  uid: string,
  customerId: string,
  range: DateRangeKey,
  cursor: DocumentSnapshot | null,
): Promise<Page> {
  const bounds = rangeBounds(range);
  const constraints: Parameters<typeof query>[1][] = [
    where("caseManagerId", "==", uid),
    where("customerId", "==", customerId),
  ];
  if (bounds) {
    constraints.push(where("date", ">=", bounds.start));
    constraints.push(where("date", "<=", bounds.end));
  }
  constraints.push(orderBy("date", "desc"), limit(PAGE_SIZE));
  if (cursor) constraints.push(startAfter(cursor));

  const snap = await getDocs(query(collection(db, "cmActivities"), ...constraints));
  const items = snap.docs.map(docToActivity).filter((a) => !a.archived);
  return {
    items,
    lastDoc: snap.docs[snap.docs.length - 1] ?? null,
    hasMore: snap.docs.length === PAGE_SIZE,
  };
}

/**
 * Paginated session list for one customer, scoped to the viewing CM and filtered
 * by a date-range preset. Infinite scroll at 50/page.
 */
export function useCustomerSessions(
  uid: string | undefined,
  customerId: string | undefined,
  range: DateRangeKey = "month",
) {
  return useInfiniteQuery<Page, Error, { pages: Page[] }, unknown[], DocumentSnapshot | null>({
    queryKey: [...qk.cmActivities.byCustomer(uid ?? "", customerId ?? ""), range],
    queryFn: ({ pageParam }) => fetchPage(uid!, customerId!, range, pageParam ?? null),
    initialPageParam: null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.lastDoc : undefined),
    enabled: !!uid && !!customerId,
    ...RQ_LIVE,
  });
}
