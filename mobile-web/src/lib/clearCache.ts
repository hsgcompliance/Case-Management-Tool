/**
 * Forces the service worker to check for an updated version of the app,
 * then navigates to root so the browser picks up the latest assets.
 *
 * Why not unregister + clear caches?
 * Unregistering the SW while it still controls the page, then calling reload(),
 * causes the SW to intercept the reload with an empty cache → blank page.
 * With Vite's autoUpdate mode, calling registration.update() is enough:
 * the new SW calls skipWaiting() automatically, controllerchange fires, and
 * the page reloads into the new version.
 *
 * Firebase Auth persists in IndexedDB and is NOT affected unless clearAuth is true.
 */
export async function clearWebsiteCache(opts?: { clearAuth?: boolean }): Promise<void> {
  if (opts?.clearAuth) {
    // Full sign-out clear: remove local/session storage (not IndexedDB — Firebase handles that)
    localStorage.clear();
    sessionStorage.clear();
  }

  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
    // Ask each SW to check the server for an updated version right now.
    // With autoUpdate, a new SW calls skipWaiting() and takes over immediately.
    await Promise.all(registrations.map((r) => r.update().catch(() => {})));
  }

  // Navigate to root instead of reload() — avoids the blank-page race where
  // an unregistered SW intercepts the reload against an empty cache.
  window.location.replace(window.location.origin + "/");
}
