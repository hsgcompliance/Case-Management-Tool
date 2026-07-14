import { getAuthed } from "./authedApi";

export type FormsUser = { uid: string; name: string; email: string | null };

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
