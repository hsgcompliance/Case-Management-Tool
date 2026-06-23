import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { RQ_DEFAULTS } from "@hooks/base";
import type { User } from "firebase/auth";

export interface FolderIndexEntry {
  id: string;
  name: string;
  first: string | null;
  last: string | null;
  cwid: string | null;
  status: "active" | "exited";
  url: string;
  createdTime: string | null;
  linkedCustomerId?: string | null;
}

export interface FolderIndexResult {
  folders: FolderIndexEntry[];
  lastSyncedAt: string | null;
  count: number;
}

async function resolveOrgId(user: User): Promise<string> {
  const claims = (await user.getIdTokenResult()).claims;
  return String((claims.orgId ?? claims.org ?? "") || "").trim();
}

async function fetchFolderIndex(user: User): Promise<FolderIndexResult> {
  const orgId = await resolveOrgId(user);
  if (!orgId) return { folders: [], lastSyncedAt: null, count: 0 };

  const snap = await getDocs(collection(db, "orgs", orgId, "folderIndex"));
  const folders = snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      name: String(x.name ?? ""),
      first: x.first ?? null,
      last: x.last ?? null,
      cwid: x.cwid ?? null,
      status: x.status === "exited" ? "exited" : "active",
      url: String(x.url ?? `https://drive.google.com/drive/folders/${d.id}`),
      createdTime: x.createdTime ?? null,
      linkedCustomerId: x.linkedCustomerId ?? null,
    } as FolderIndexEntry;
  });

  let lastSyncedAt: string | null = null;
  try {
    const metaSnap = await getDoc(doc(db, "orgs", orgId, "cache", "folderIndexMeta"));
    lastSyncedAt = (metaSnap.data()?.lastSyncedAt as string) ?? null;
  } catch {
    /* meta is optional */
  }

  return { folders, lastSyncedAt, count: folders.length };
}

/** Cached customer-folder index (synced from the index sheet). Fast Firestore read. */
export function useOrgFolderIndex(user: User | null) {
  return useQuery({
    queryKey: ["folderIndex", user?.uid ?? ""],
    queryFn: () => fetchFolderIndex(user!),
    enabled: !!user,
    ...RQ_DEFAULTS,
    staleTime: 15 * 60_000,
  });
}
