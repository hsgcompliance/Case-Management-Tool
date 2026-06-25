import { functionsBase } from "./runtimeEnv";
import { postAuthed } from "./authedApi";
import { ApiError } from "./api";

export type RenderField = {
  qid: string;
  name: string;
  type: string;
  label: string;
  required: boolean;
  options: string[];
  order: number;
};

export type ResolvedRenderForm = {
  formId: string;
  title: string;
  customerName: string | null;
  status: string;
  expired: boolean;
  submitted: boolean;
  revoked: boolean;
  fields: RenderField[];
};

/** Staff: mint a token link for a customer to fill a whitelisted form. */
export async function createRenderLink(formId: string, customerId: string | null): Promise<{ renderUrl: string; expiresAt: string }> {
  return postAuthed("renderFormCreate", { formId, customerId });
}

/** Public: resolve a render token → form schema + state. */
export async function resolveRenderForm(token: string): Promise<ResolvedRenderForm> {
  const resp = await fetch(`${functionsBase()}/renderFormResolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const json = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
  if (!resp.ok || json.ok === false) throw new ApiError(String(json.error ?? `HTTP ${resp.status}`), resp.status);
  return json as unknown as ResolvedRenderForm;
}

/** Public: submit the rendered form (multipart, one submission). */
export async function submitRenderForm(token: string, formData: FormData): Promise<{ submitted: boolean; submissionId: string }> {
  formData.set("token", token);
  const resp = await fetch(`${functionsBase()}/renderFormSubmit`, { method: "POST", body: formData });
  const json = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
  if (!resp.ok || json.ok === false) throw new ApiError(String(json.error ?? `HTTP ${resp.status}`), resp.status);
  return json as unknown as { submitted: boolean; submissionId: string };
}
