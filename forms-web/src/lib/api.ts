// forms-web API client.
// The Forms surface is intentionally auth-less: every call is gated by the session
// token, not Firebase auth. We therefore POST the token in the body (keeps it out
// of URLs/server access logs) and never attach an Authorization header.
import { functionsBase } from "./runtimeEnv";
import type { TFormSessionResolved } from "@hdb/contracts";

export class ApiError extends Error {
  status: number;
  code?: number;
  constructor(message: string, status: number, code?: number) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function postPublic<T>(name: string, body: unknown): Promise<T> {
  const resp = await fetch(`${functionsBase()}/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const json = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
  if (!resp.ok || json.ok === false) {
    const msg = String(json.error ?? `HTTP ${resp.status}`);
    throw new ApiError(msg, resp.status, typeof json.code === "number" ? json.code : undefined);
  }
  return json as T;
}

export async function resolveFormSession(token: string): Promise<TFormSessionResolved> {
  const out = await postPublic<{ ok: true; session: TFormSessionResolved }>("resolveFormSession", { token });
  return out.session;
}

export async function completeFormSession(args: {
  token: string;
  jotformSubmissionId?: string | null;
  submission?: Record<string, unknown> | null;
}): Promise<{ formSessionId: string; status: string; linked: boolean }> {
  return postPublic("completeFormSession", args);
}
