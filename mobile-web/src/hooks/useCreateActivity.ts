import { useMutation, useQueryClient } from "@tanstack/react-query";
import { collection, addDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { qk } from "@hooks/queryKeys";
import type { User } from "firebase/auth";
import type { TCmActivity, TCmActivityCreateBody } from "@hdb/contracts";

function resolveOrgId(claims: Record<string, unknown>): string | undefined {
  // Mirror orgIdFromClaims() in functions/src/core/org.ts — supports all claim shapes.
  const direct =
    (claims.orgId as string) ||
    (claims.orgID as string) ||
    (claims.organizationId as string) ||
    (claims.org as string) ||
    undefined;
  if (direct) return direct;

  for (const nested of [claims.customClaims, claims.claims] as Record<string, unknown>[]) {
    if (!nested || typeof nested !== "object") continue;
    const id =
      (nested.orgId as string) ||
      (nested.orgID as string) ||
      (nested.org as string) ||
      undefined;
    if (id) return id;
  }
  return undefined;
}

async function createActivity(user: User, body: TCmActivityCreateBody): Promise<string> {
  const { claims } = await user.getIdTokenResult();
  const orgId = resolveOrgId(claims as Record<string, unknown>);

  // Only write orgId if resolved — omitting it lets sameOrg() in Firestore rules pass.
  const ref = await addDoc(collection(db, "cmActivities"), {
    ...(orgId ? { orgId } : {}),
    caseManagerId: user.uid,
    caseManagerName: user.displayName ?? "",
    customerId: body.customerId,
    customerName: body.customerName ?? "",
    type: body.type,
    date: body.date,
    startTime: body.startTime ?? null,
    endTime: body.endTime ?? null,
    note: body.note ?? null,
    calendarSynced: false,
    workbookSynced: false,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Flag a session as synced to the customer's TSS workbook. Called after the
 * progress-note push returns success so the session doc records the outcome
 * (mirrors calendarSynced/calendarEventId). Non-fatal — a flag write failure
 * must not undo a successful workbook append.
 */
export async function markSessionWorkbookSynced(sessionId: string, rowKey?: string): Promise<void> {
  await updateDoc(doc(db, "cmActivities", sessionId), {
    workbookSynced: true,
    workbookSyncedAt: new Date().toISOString(),
    ...(rowKey ? { workbookRowKey: rowKey } : {}),
    updatedAt: serverTimestamp(),
  });
}

type OptimisticContext = {
  key: readonly unknown[];
  previous: TCmActivity[] | undefined;
};

export function useCreateActivity(user: User | null) {
  const qc = useQueryClient();
  return useMutation<string, Error, TCmActivityCreateBody, OptimisticContext | undefined>({
    mutationFn: (body: TCmActivityCreateBody) => createActivity(user!, body),
    // Optimistically insert the session into the customer's list so it shows up
    // immediately — no waiting on the Firestore round-trip or the calendar /
    // workbook pushes that follow.
    onMutate: async (body): Promise<OptimisticContext | undefined> => {
      if (!user) return undefined;
      const key = qk.cmActivities.byCustomer(user.uid, body.customerId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<TCmActivity[]>(key);
      const optimistic = {
        id: `optimistic-${Date.now()}`,
        caseManagerId: user.uid,
        caseManagerName: user.displayName ?? "",
        customerId: body.customerId,
        customerName: body.customerName ?? "",
        type: body.type,
        date: body.date,
        startTime: body.startTime ?? undefined,
        endTime: body.endTime ?? undefined,
        note: body.note ?? undefined,
        calendarSynced: false,
        createdAt: new Date().toISOString(),
      } as TCmActivity;
      qc.setQueryData<TCmActivity[]>(key, (old) => [optimistic, ...(old ?? [])]);
      return { key, previous };
    },
    onError: (_err, _body, ctx) => {
      // Roll back the optimistic insert on failure.
      if (ctx?.key) qc.setQueryData(ctx.key, ctx.previous);
    },
    onSettled: () => {
      // Reconcile with the server (feed + customer sessions) on success or error.
      qc.invalidateQueries({ queryKey: qk.cmActivities.root });
    },
  });
}
