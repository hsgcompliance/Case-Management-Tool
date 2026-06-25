import { getAuthed, postAuthed } from "./authedApi";

export type FormsRegistryItem = {
  formId: string;
  category: string;
  title: string;
  customerSendable: boolean;
  adminEdited: boolean;
  submissionCount: number;
  lastKind: string | null;
};

let cache: Promise<FormsRegistryItem[]> | null = null;

export function listFormsRegistry(force = false): Promise<FormsRegistryItem[]> {
  if (!cache || force) {
    cache = getAuthed<{ ok: true; items: FormsRegistryItem[] }>("listFormsRegistry", {})
      .then((o) => o.items ?? [])
      .catch(() => []);
  }
  return cache;
}

export async function updateForm(
  formId: string,
  patch: { title?: string; category?: string; customerSendable?: boolean }
): Promise<void> {
  await postAuthed("formsRegistryUpdate", { formId, ...patch });
  cache = null; // bust so the next load reflects the edit
}

export async function getFormsAuthInfo(): Promise<{ isAdmin: boolean }> {
  return getAuthed<{ ok: true; isAdmin: boolean }>("formsAuthInfo", {}).catch(() => ({ ok: true as const, isAdmin: false }));
}
