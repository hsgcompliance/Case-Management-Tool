const truthy = new Set(["1", "true", "yes", "on"]);

export function isEmulatorRequested() {
  return (
    truthy.has(String(process.env.NEXT_PUBLIC_USE_EMULATORS ?? "").toLowerCase()) ||
    truthy.has(String(process.env.NEXT_PUBLIC_FIREBASE_EMULATORS ?? "").toLowerCase())
  );
}

export function isBrowserLocalhost() {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

export function shouldUseEmulators() {
  if (!isEmulatorRequested()) return false;
  // Production safety: only allow emulator mode in browser on localhost.
  if (typeof window !== "undefined") return isBrowserLocalhost();
  // Server-side render/build path: only allow outside production.
  return process.env.NODE_ENV !== "production";
}

