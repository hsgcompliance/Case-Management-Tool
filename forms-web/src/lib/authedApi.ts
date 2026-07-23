// forms-web authed API client — staff side only.
// Attaches the Firebase ID token. The endpoints it calls run appCheck:false, so
// no App Check token is needed (auth is still enforced server-side via the token
// + org claim).
import { functionsBase } from "./runtimeEnv";
import { auth } from "./firebase";
import { ApiError } from "./api";

async function idToken(): Promise<string | null> {
  const u = auth.currentUser;
  if (!u) return null;
  try {
    return await u.getIdToken();
  } catch {
    return null;
  }
}

export async function getAuthed<T>(name: string, query: Record<string, unknown> = {}): Promise<T> {
  const tok = await idToken();
  if (!tok) throw new ApiError("not_signed_in", 401);

  const url = new URL(`${functionsBase()}/${name}`);
  for (const [k, v] of Object.entries(query)) {
    if (v != null && v !== "") url.searchParams.set(k, String(v));
  }

  const resp = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${tok}` },
  });
  const json = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
  if (!resp.ok || json.ok === false) {
    const msg = String(json.error ?? `HTTP ${resp.status}`);
    throw new ApiError(msg, resp.status, typeof json.code === "number" ? json.code : undefined);
  }
  return json as T;
}

export async function postAuthed<T>(name: string, body: unknown = {}): Promise<T> {
  const tok = await idToken();
  if (!tok) throw new ApiError("not_signed_in", 401);

  const resp = await fetch(`${functionsBase()}/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
    body: JSON.stringify(body ?? {}),
  });
  const json = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
  if (!resp.ok || json.ok === false) {
    const msg = String(json.error ?? `HTTP ${resp.status}`);
    throw new ApiError(msg, resp.status, typeof json.code === "number" ? json.code : undefined);
  }
  return json as T;
}

export async function patchAuthed<T>(name: string, body: unknown = {}): Promise<T> {
  const tok = await idToken();
  if (!tok) throw new ApiError("not_signed_in", 401);

  const resp = await fetch(`${functionsBase()}/${name}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
    body: JSON.stringify(body ?? {}),
  });
  const json = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
  if (!resp.ok || json.ok === false) {
    const msg = String(json.error ?? `HTTP ${resp.status}`);
    throw new ApiError(msg, resp.status, typeof json.code === "number" ? json.code : undefined);
  }
  return json as T;
}
