import { getAuthed } from "./authedApi";

export type WebhookEventItem = {
  id: string;
  formId: string;
  submissionId: string;
  submitterName: string;
  pretty: string;
  answerKeys: number;
  receivedAtISO: string | null;
};

export async function listWebhookEvents(limit = 50): Promise<WebhookEventItem[]> {
  const out = await getAuthed<{ ok: true; items: WebhookEventItem[] }>("listWebhookEvents", { limit });
  return out.items ?? [];
}
