import { useInfiniteQuery } from "@tanstack/react-query";
import {
  collection, query, where, getDocs, orderBy, limit,
  startAfter, Timestamp, type DocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { qk } from "@hooks/queryKeys";
import { RQ_LIVE } from "@hooks/base";
import type { TCmActivity, TCmActivityType } from "@hdb/contracts";

const PAGE_SIZE = 40;

export interface ActivityFeedFilters {
  type?: TCmActivityType;
}

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
  filters: ActivityFeedFilters,
  cursor: DocumentSnapshot | null,
): Promise<Page> {
  const constraints: Parameters<typeof query>[1][] = [
    where("caseManagerId", "==", uid),
    orderBy("date", "desc"),
    orderBy("createdAt", "desc"),
    limit(PAGE_SIZE),
  ];
  if (filters.type) constraints.push(where("type", "==", filters.type));
  if (cursor) constraints.push(startAfter(cursor));

  const snap = await getDocs(query(collection(db, "cmActivities"), ...constraints));
  const items = snap.docs.map(docToActivity).filter((a) => !a.archived);
  return { items, lastDoc: snap.docs[snap.docs.length - 1] ?? null, hasMore: snap.docs.length === PAGE_SIZE };
}

export function useCmActivitiesFeed(uid: string | undefined, filters: ActivityFeedFilters = {}) {
  return useInfiniteQuery<Page, Error, { pages: Page[] }, unknown[], DocumentSnapshot | null>({
    queryKey: [...qk.cmActivities.feed(uid ?? "", filters.type)],
    queryFn: ({ pageParam }) => fetchPage(uid!, filters, pageParam ?? null),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.lastDoc : undefined,
    enabled: !!uid,
    ...RQ_LIVE,
  });
}
