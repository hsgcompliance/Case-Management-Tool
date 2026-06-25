const truthy = new Set(["1", "true", "yes", "on"]);

export function shouldUseEmulators(): boolean {
  const flag = String(import.meta.env.VITE_USE_EMULATORS ?? "").toLowerCase();
  if (!truthy.has(flag)) return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

export const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID || "housing-db-v2";
export const REGION = "us-central1";

export function functionsBase(): string {
  if (shouldUseEmulators()) {
    return `http://127.0.0.1:5001/${PROJECT_ID}/${REGION}`;
  }
  return `https://${REGION}-${PROJECT_ID}.cloudfunctions.net`;
}
