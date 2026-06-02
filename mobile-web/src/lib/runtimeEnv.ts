const truthy = new Set(["1", "true", "yes", "on"]);

export function shouldUseEmulators() {
  const flag = String(import.meta.env.VITE_USE_EMULATORS ?? "").toLowerCase();
  if (!truthy.has(flag)) return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}
