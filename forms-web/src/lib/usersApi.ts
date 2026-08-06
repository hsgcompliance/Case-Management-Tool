import { getAuthed } from "./authedApi";

export type FormsUser = { uid: string; name: string; email: string | null; roles?: string[] };

/** Compliance-tagged users first (then alphabetical) for hand-off dropdowns. */
export function complianceFirst(users: FormsUser[]): { compliance: FormsUser[]; others: FormsUser[] } {
  const compliance = users.filter((u) => u.roles?.includes("compliance"));
  const others = users.filter((u) => !u.roles?.includes("compliance"));
  return { compliance, others };
}

// Active org users for the CM dropdowns — cached once per session.
let cache: Promise<FormsUser[]> | null = null;

export function loadUsers(force = false): Promise<FormsUser[]> {
  if (!cache || force) {
    cache = getAuthed<{ ok: true; items: FormsUser[] }>("formsUsersList", {})
      .then((o) => o.items ?? [])
      .catch(() => []);
  }
  return cache;
}
