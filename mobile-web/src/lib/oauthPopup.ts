// Inline Google OAuth connect via a popup window.
//
// Why a popup: the connect flow normally does a full-page redirect to Google and
// the callback redirects back to /settings. From the "Log Session" screen we want
// the user to stay on the form (so the unsaved session isn't lost) and have the
// Calendar / Drive toggle light up the moment they finish — so we run the same
// OAuth round-trip inside a popup and signal the opener with postMessage.
//
// The popup lands back on this same app at `/settings?calendar=...&service=...`
// (the OAuth callback redirects to the originating app's origin). `main.tsx` calls
// `maybeHandleOAuthPopupCallback()` BEFORE rendering React; when the page is a
// popup carrying those params it forwards the result to the opener and closes,
// so the heavy settings UI never mounts in the popup.

import { GoogleIntegrations, type GoogleIntegrationService } from "@/lib/googleIntegrations";

const POPUP_MESSAGE_SOURCE = "hdb-oauth";

export type GoogleConnectPopupResult = {
  result: "connected" | "denied" | "error" | "closed";
  service: GoogleIntegrationService;
};

type OAuthPopupMessage = {
  source: typeof POPUP_MESSAGE_SOURCE;
  result: string;
  service?: string;
};

function popupFeatures(): string {
  const w = 480;
  const h = 640;
  const dualLeft = window.screenLeft ?? window.screenX ?? 0;
  const dualTop = window.screenTop ?? window.screenY ?? 0;
  const width = window.innerWidth || document.documentElement.clientWidth || screen.width;
  const height = window.innerHeight || document.documentElement.clientHeight || screen.height;
  const left = Math.max(0, dualLeft + (width - w) / 2);
  const top = Math.max(0, dualTop + (height - h) / 2);
  return `scrollbars=yes,resizable=yes,width=${w},height=${h},top=${Math.round(top)},left=${Math.round(left)}`;
}

function waitForPopupResult(
  popup: Window,
  service: GoogleIntegrationService,
): Promise<GoogleConnectPopupResult> {
  return new Promise((resolve) => {
    let settled = false;

    const finish = (result: GoogleConnectPopupResult["result"]) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      clearInterval(poll);
      try { if (!popup.closed) popup.close(); } catch { /* cross-origin */ }
      resolve({ result, service });
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as OAuthPopupMessage | undefined;
      if (!data || data.source !== POPUP_MESSAGE_SOURCE) return;
      if (data.service && data.service !== service) return;
      finish(
        data.result === "connected" ? "connected" : data.result === "denied" ? "denied" : "error",
      );
    };

    window.addEventListener("message", onMessage);

    // Fallback: the popup may land on a different origin (the denied/early-error
    // path redirects to the web app), or postMessage may be blocked — detect the
    // user closing the window and let the caller re-check status.
    const poll = setInterval(() => {
      if (popup.closed) finish("closed");
    }, 600);
  });
}

/**
 * Open the Google connect flow for `service` in a popup and resolve once it
 * completes. Falls back to a full-page redirect only if the popup is blocked, so
 * the connect always works even when popups are disabled.
 */
export async function openGoogleConnectPopup(
  service: GoogleIntegrationService,
): Promise<GoogleConnectPopupResult> {
  // Open synchronously inside the click gesture so mobile browsers don't block it.
  const popup = window.open("", "hdb-google-oauth", popupFeatures());

  let authUrl = "";
  try {
    authUrl = await GoogleIntegrations.connectAuthUrl(service);
  } catch {
    authUrl = "";
  }

  if (!popup) {
    // Popup blocked → fall back to the redirect flow (navigates away, but connects).
    if (authUrl) window.location.href = authUrl;
    return { result: "error", service };
  }

  if (!authUrl) {
    try { popup.close(); } catch { /* noop */ }
    return { result: "error", service };
  }

  try {
    popup.location.href = authUrl;
  } catch {
    // Some browsers disallow setting location on a foreign-named window — reopen.
    popup.close();
    const reopened = window.open(authUrl, "hdb-google-oauth", popupFeatures());
    if (!reopened) {
      window.location.href = authUrl;
      return { result: "error", service };
    }
    return waitForPopupResult(reopened, service);
  }

  return waitForPopupResult(popup, service);
}

/**
 * Runs at app startup (before React mounts). When the current page is an OAuth
 * popup that just came back from Google (`?calendar=...` with a `window.opener`),
 * forward the result to the opener and close. Returns true when handled so the
 * caller can skip rendering the app inside the popup.
 */
export function maybeHandleOAuthPopupCallback(): boolean {
  try {
    if (typeof window === "undefined") return false;
    const opener = window.opener as Window | null;
    if (!opener || opener === window) return false;

    const params = new URLSearchParams(window.location.search);
    const result = params.get("calendar");
    if (!result) return false;

    const service = params.get("service") === "googleDrive" ? "googleDrive" : "googleCalendar";

    try {
      opener.postMessage(
        { source: POPUP_MESSAGE_SOURCE, result, service } satisfies OAuthPopupMessage,
        window.location.origin,
      );
    } catch {
      /* opener gone / cross-origin — the opener's close-poll will still fire */
    }

    // In case window.close() is blocked (some mobile browsers), leave a hint.
    try {
      document.body.innerHTML =
        '<div style="font:15px system-ui,-apple-system,sans-serif;padding:32px;color:#334155">' +
        "Google connected. You can close this window.</div>";
    } catch {
      /* noop */
    }
    window.close();
    return true;
  } catch {
    return false;
  }
}
