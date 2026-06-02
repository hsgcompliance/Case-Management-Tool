import { useMutation, useQueryClient } from "@tanstack/react-query";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { qk } from "@hooks/queryKeys";
import type { User } from "firebase/auth";
import type { TCmActivityCreateBody } from "@hdb/contracts";

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
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export function useCreateActivity(user: User | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TCmActivityCreateBody) => createActivity(user!, body),
    onSuccess: () => {
      // Invalidate all cmActivities for this user (feed + customer sessions).
      qc.invalidateQueries({ queryKey: qk.cmActivities.root });
    },
  });
}
