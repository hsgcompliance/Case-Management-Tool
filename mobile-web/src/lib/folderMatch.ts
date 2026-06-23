// Rank cached folder-index entries against a customer to suggest links. A pure
// port of the backend scoreFolderMatch heuristic (functions customerFolderSync),
// run client-side over the cached index so suggestions need no Drive call.

import type { FolderIndexEntry } from "@/hooks/useOrgFolderIndex";

interface MatchCustomer {
  firstName?: string;
  lastName?: string;
  name?: string;
  cwId?: string;
  hmisId?: string;
}

function normText(v: unknown): string {
  return String(v ?? "")
    .toLowerCase()
    .trim()
    .replace(/[_,-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "");
}
function normId(v: unknown): string {
  return String(v ?? "").trim();
}

export function scoreFolder(folder: FolderIndexEntry, customer: MatchCustomer): number {
  let score = 0;
  const cFirst = normText(customer.firstName);
  const cLast = normText(customer.lastName);
  const cName = normText(customer.name);
  const cCwid = normId(customer.cwId || customer.hmisId);

  const fFirst = normText(folder.first);
  const fLast = normText(folder.last);
  const fName = normText(folder.name);
  const fCwid = normId(folder.cwid);

  if (cCwid && fCwid && cCwid.toLowerCase() === fCwid.toLowerCase()) score += 95;
  else if (cCwid && fCwid) score -= 30;

  if (cLast && fLast && cLast === fLast) score += 42;
  else if (cLast && fLast && (fLast.startsWith(cLast) || cLast.startsWith(fLast))) score += 20;

  if (cFirst && fFirst && cFirst === fFirst) score += 34;
  else if (cFirst && fFirst && (fFirst.startsWith(cFirst) || cFirst.startsWith(fFirst))) score += 16;

  if (cName && fName && fName.includes(cName)) score += 12;

  return Math.max(0, Math.min(100, score));
}

/** Top folder suggestions for a customer (score ≥ threshold), best first. */
export function suggestFolders(
  folders: FolderIndexEntry[],
  customer: MatchCustomer,
  opts?: { min?: number; limit?: number },
): Array<{ folder: FolderIndexEntry; score: number }> {
  const min = opts?.min ?? 35;
  const limit = opts?.limit ?? 5;
  return folders
    .map((folder) => ({ folder, score: scoreFolder(folder, customer) }))
    .filter((c) => c.score >= min)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
