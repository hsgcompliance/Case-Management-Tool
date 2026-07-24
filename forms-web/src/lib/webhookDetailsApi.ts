import { getAuthed } from "./authedApi";

export type WebhookEventFieldRow = { label: string; value: string };

export type WebhookEventDetail = {
  id: string;
  formId: string;
  submissionId: string;
  submitterName: string;
  receivedAtISO: string | null;
  createdAtISO: string | null;
  pretty: string;
  fields: WebhookEventFieldRow[];
};

/** Flattened label/value fields per webhook event (for the Webhooks sidebar). */
export async function listWebhookEventDetails(
  formIds: string[],
  limit = 50,
  range: { sinceISO?: string; afterISO?: string } = {},
): Promise<WebhookEventDetail[]> {
  const out = await getAuthed<{ ok: true; items: WebhookEventDetail[] }>("listWebhookEventDetails", {
    formIds: formIds.join(","),
    limit,
    since: range.sinceISO,
    after: range.afterISO,
  });
  return out.items ?? [];
}
