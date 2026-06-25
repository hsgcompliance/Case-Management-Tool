import { getAuthed } from "./authedApi";

export type WebhookDestination = { label: string; kind: string; url: string };

export async function getWebhookDestinations(): Promise<{ destinations: WebhookDestination[]; hasToken: boolean }> {
  const out = await getAuthed<{ ok: true; destinations: WebhookDestination[]; hasToken: boolean }>("formsWebhookConfig", {});
  return { destinations: out.destinations ?? [], hasToken: !!out.hasToken };
}
