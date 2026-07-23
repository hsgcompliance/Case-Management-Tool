// forms-web authed API client — staff side only.
// Attaches Firebase ID and App Check tokens. Some older Forms endpoints do not
// enforce App Check, while canonical endpoints such as customersPatch do.
import { functionsBase } from "./runtimeEnv";
import { auth, appCheck, appCheckReadyPromise } from "./firebase";
import { ApiError } from "./api";

async function requestHeaders(
  contentType = false,
  requireAppCheck = false,
): Promise<Record<string, string>> {
  const u = auth.currentUser;
  if (!u) throw new ApiError("not_signed_in", 401);

  let idToken: string;
  try {
    idToken = await u.getIdToken();
  } catch {
    throw new ApiError("not_signed_in", 401);
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${idToken}`,
  };
  if (contentType) headers["Content-Type"] = "application/json";

  try {
    await appCheckReadyPromise;
    if (appCheck) {
      const { getToken } = await import("firebase/app-check");
      const result = await getToken(appCheck);
      if (result.token) headers["X-Firebase-AppCheck"] = result.token;
    }
  } catch {
    // Endpoints without App Check enforcement can still proceed.
  }

  if (requireAppCheck && !headers["X-Firebase-AppCheck"]) {
    throw new ApiError("app_check_unavailable", 401);
  }
  return headers;
}

export async function getAuthed<T>(name: string, query: Record<string, unknown> = {}): Promise<T> {
  const url = new URL(`${functionsBase()}/${name}`);
  for (const [k, v] of Object.entries(query)) {
    if (v != null && v !== "") url.searchParams.set(k, String(v));
  }

  const resp = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json", ...await requestHeaders() },
  });
  const json = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
  if (!resp.ok || json.ok === false) {
    const msg = String(json.error ?? `HTTP ${resp.status}`);
    throw new ApiError(msg, resp.status, typeof json.code === "number" ? json.code : undefined);
  }
  return json as T;
}

export async function postAuthed<T>(name: string, body: unknown = {}): Promise<T> {
  const resp = await fetch(`${functionsBase()}/${name}`, {
    method: "POST",
    headers: await requestHeaders(true),
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
  const resp = await fetch(`${functionsBase()}/${name}`, {
    method: "PATCH",
    headers: await requestHeaders(true, true),
    body: JSON.stringify(body ?? {}),
  });
  const json = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
  if (!resp.ok || json.ok === false) {
    const msg = String(json.error ?? `HTTP ${resp.status}`);
    throw new ApiError(msg, resp.status, typeof json.code === "number" ? json.code : undefined);
  }
  return json as T;
}
