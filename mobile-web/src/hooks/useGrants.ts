import { useQuery } from "@tanstack/react-query";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { qk } from "@hooks/queryKeys";
import { RQ_DEFAULTS } from "@hooks/base";
import type { User } from "firebase/auth";

export interface Grant {
  id: string;
  name: string;
  code?: string;
  status?: string;
  endDate?: string | null;
  kind?: string | null;
}

async function fetchActiveGrants(user: User): Promise<Grant[]> {
  const { claims } = await user.getIdTokenResult();
  const orgId = ((claims.orgId ?? claims.org ?? "") as string).trim();
  if (!orgId) return [];

  const snap = await getDocs(
    query(collection(db, "grants"), where("orgId", "==", orgId)),
  );
  return snap.docs
    .map((d): Grant => {
      const data = d.data();
      return {
        id: d.id,
        name: String(data.name || data.code || d.id).trim(),
        code: data.code ? String(data.code) : undefined,
        status: data.status ? String(data.status) : undefined,
        endDate: data.endDate ? String(data.endDate).slice(0, 10) : null,
        kind: data.kind ? String(data.kind) : null,
      };
    })
    .filter((g) => g.status !== "deleted" && g.status !== "inactive")
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function useGrants(user: User | null) {
  return useQuery({
    queryKey: qk.grants.active(user?.uid ?? ""),
    queryFn: () => fetchActiveGrants(user!),
    enabled: !!user,
    ...RQ_DEFAULTS,
    staleTime: 15 * 60_000,
  });
}
