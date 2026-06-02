import { auth, appCheck, appCheckReadyPromise } from "@/lib/firebase";
import { shouldUseEmulators } from "@/lib/runtimeEnv";

const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID || "housing-db-v2";
const REGION = "us-central1";

function functionsBase(): string {
  if (shouldUseEmulators()) {
    return `http://127.0.0.1:5001/${PROJECT_ID}/${REGION}`;
  }
  return `https://${REGION}-${PROJECT_ID}.cloudfunctions.net`;
}

type CallFunctionOptions = {
  method?: "GET" | "POST";
};

function toSearchParams(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const params = new URLSearchParams();
  Object.entries(value as Record<string, unknown>).forEach(([key, raw]) => {
    if (raw === undefined || raw === null) return;
    params.set(key, String(raw));
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function callFunction<T = unknown>(
  name: string,
  body: unknown = {},
  options: CallFunctionOptions = {},
): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const method = options.method ?? "POST";

  // Auth token
  const idToken = await user.getIdToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${idToken}`,
  };

  // App Check token — wait for initialization then fetch
  try {
    await appCheckReadyPromise;
    if (appCheck) {
      const { getToken } = await import("firebase/app-check");
      const appCheckResult = await getToken(appCheck);
      if (appCheckResult?.token) {
        headers["X-Firebase-AppCheck"] = appCheckResult.token;
      }
    }
  } catch {
    // Best effort — missing token will get a 401 from the server with a clear error
  }

  const query = method === "GET" ? toSearchParams(body) : "";
  const resp = await fetch(`${functionsBase()}/${name}${query}`, {
    method,
    headers,
    body: method === "GET" ? undefined : JSON.stringify(body),
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error((json as { error?: string }).error ?? `HTTP ${resp.status}`);
  }
  return json as T;
}
