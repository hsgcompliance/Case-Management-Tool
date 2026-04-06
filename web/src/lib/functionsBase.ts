import { shouldUseEmulators } from "./runtimeEnv";

function isRelativeBase(v: string) {
  const s = String(v || "").trim();
  return !!s && !/^https?:\/\//i.test(s);
}

export function resolveFunctionsBase() {
  const region = process.env.NEXT_PUBLIC_FUNCTIONS_REGION ?? "us-central1";
  const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "housing-db-v2";
  const configured = String(process.env.NEXT_PUBLIC_FUNCTIONS_BASE ?? "").trim();
  const emu = shouldUseEmulators();

  if (emu) {
    return configured || `http://127.0.0.1:5001/${project}/${region}`;
  }

  // Production safety: if a local dev file leaks `/__api` into the build, bypass it
  // and call the public Functions endpoint directly.
  if (isRelativeBase(configured)) {
    const host = typeof window !== "undefined" ? window.location.hostname : "";
    const isLocal = host === "localhost" || host === "127.0.0.1";
    if (!isLocal) {
      return `https://${region}-${project}.cloudfunctions.net`;
    }
  }

  return configured || `https://${region}-${project}.cloudfunctions.net`;
}

