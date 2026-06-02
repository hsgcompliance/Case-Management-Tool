import { useState, useEffect, useRef } from "react";
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { clearWebsiteCache } from "@/lib/clearCache";

// Persists across the redirect round-trip so we can show "Connecting…" on return.
const REDIRECT_KEY = "hdb:google-redirect-ts";
const REDIRECT_TTL = 30_000;

function classifyError(code: string, message: string): string | null {
  const s = `${code} ${message}`.toLowerCase();
  if (
    s.includes("popup-closed") ||
    code === "auth/popup-closed-by-user" ||
    code === "auth/cancelled-popup-request"
  ) {
    return null; // user dismissed — silent reset
  }
  if (
    s.includes("access_denied") ||
    s.includes("org_internal") ||
    s.includes("unauthorized-domain") ||
    s.includes("unauthorized_client") ||
    s.includes("not allowed") ||
    s.includes("hd_hint") // Google's hosted-domain hint rejection
  ) {
    return "That account is not allowed. Please sign in with your work Google account.";
  }
  return "Google sign-in failed. Please try again.";
}

export function LoginPage() {
  const { user, loading } = useAuth();

  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyGoogle, setBusyGoogle] = useState(false);
  const [busyEmail, setBusyEmail] = useState(false);

  // True while we're waiting for getRedirectResult() to resolve on mount.
  const [checkingRedirect, setCheckingRedirect] = useState(() => {
    const ts = sessionStorage.getItem(REDIRECT_KEY);
    return !!ts && Date.now() - Number(ts) < REDIRECT_TTL;
  });

  const timeoutRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // ── Handle redirect result on every mount ────────────────────────────────────
  useEffect(() => {
    getRedirectResult(auth)
      .then(() => {
        if (!mountedRef.current) return;
        sessionStorage.removeItem(REDIRECT_KEY);
        setCheckingRedirect(false);
        setBusyGoogle(false);
        // auth state listener in useAuth handles the actual login navigation
      })
      .catch((e: unknown) => {
        if (!mountedRef.current) return;
        sessionStorage.removeItem(REDIRECT_KEY);
        setCheckingRedirect(false);
        setBusyGoogle(false);
        const err = e as { code?: string; message?: string };
        const msg = classifyError(err?.code ?? "", err?.message ?? "");
        if (msg) setError(msg);
      });
  }, []); // intentionally empty — run once on mount only

  // ── Safety timeout — never stay stuck forever ─────────────────────────────────
  useEffect(() => {
    const isConnecting = busyGoogle || checkingRedirect;
    if (!isConnecting) {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      return;
    }
    timeoutRef.current = window.setTimeout(() => {
      if (!mountedRef.current) return;
      sessionStorage.removeItem(REDIRECT_KEY);
      setBusyGoogle(false);
      setCheckingRedirect(false);
    }, 10_000);
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [busyGoogle, checkingRedirect]);

  // ── Auth helpers ─────────────────────────────────────────────────────────────

  function resetAuthAttempt() {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    sessionStorage.removeItem(REDIRECT_KEY);
    setBusyGoogle(false);
    setCheckingRedirect(false);
    setError(null);
    signOut(auth).catch(() => {});
  }

  async function startGoogleSignIn() {
    resetAuthAttempt();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    setBusyGoogle(true);

    // Always try popup first — on iOS PWA this opens in-process via SFSafariViewController
    // and keeps auth state within the PWA's IndexedDB. Using signInWithRedirect on iOS PWA
    // opens Safari as a separate process, so the auth token lands in Safari's storage and
    // the PWA never receives it (causes the login loop).
    try {
      await signInWithPopup(auth, provider);
      // onAuthStateChanged handles navigation; component unmounts naturally.
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };

      if (err?.code === "auth/popup-blocked") {
        // Popup was blocked by the browser — fall back to redirect.
        sessionStorage.setItem(REDIRECT_KEY, String(Date.now()));
        try {
          await signInWithRedirect(auth, provider);
          // Page navigates away; never reaches here on success.
        } catch (e2: unknown) {
          sessionStorage.removeItem(REDIRECT_KEY);
          setBusyGoogle(false);
          const err2 = e2 as { code?: string; message?: string };
          const msg = classifyError(err2?.code ?? "", err2?.message ?? "");
          if (msg) setError(msg);
        }
        return;
      }

      setBusyGoogle(false);
      const msg = classifyError(err?.code ?? "", err?.message ?? "");
      if (msg) setError(msg);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusyEmail(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch {
      setError("Invalid email or password");
    } finally {
      setBusyEmail(false);
    }
  }

  // ── Render guards ─────────────────────────────────────────────────────────────

  if (loading || checkingRedirect) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-indigo-600 animate-spin" />
          <p className="text-sm text-slate-500">Signing in…</p>
        </div>
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const isConnecting = busyGoogle;

  // ── UI ────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg">
            <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Case Management</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to continue</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Google button */}
          <button
            type="button"
            onClick={() => void startGoogleSignIn()}
            disabled={isConnecting || busyEmail}
            className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-medium text-slate-700 shadow-sm active:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {isConnecting ? (
              <span className="w-5 h-5 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin flex-shrink-0" />
            ) : (
              <GoogleIcon />
            )}
            {isConnecting ? "Connecting to Google…" : "Continue with Google"}
          </button>

          {/* Use a different account — always clickable, resets and forces chooser */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => void startGoogleSignIn()}
              className="text-sm text-slate-500 underline underline-offset-2 active:text-slate-700"
            >
              Use a different email address
            </button>
          </div>

          {/* Email form toggle */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                resetAuthAttempt();
                setShowEmail((v) => !v);
              }}
              className="text-sm text-slate-400 underline underline-offset-2 active:text-slate-600"
            >
              {showEmail ? "Back to Google sign-in" : "Sign in with email instead"}
            </button>
          </div>

          {/* Email form */}
          {showEmail && (
            <>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <div className="flex-1 h-px bg-slate-200" />
                <span>or</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-700">Email</label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-700">Password</label>
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busyEmail || isConnecting}
                  className="w-full rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm active:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {busyEmail ? "Signing in…" : "Sign in"}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-5 text-center text-xs text-slate-400">
          Need help?{" "}
          <a href="mailto:Gseyfried@thehrdc.org" className="underline">Contact support</a>
        </p>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => void clearWebsiteCache({ clearAuth: true })}
            className="text-xs text-slate-400 underline underline-offset-2 active:text-slate-600"
          >
            Clear cache &amp; reload
          </button>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 533.5 544.3" aria-hidden>
      <path fill="#4285F4" d="M533.5 278.4c0-17.4-1.6-34.1-4.6-50.2H272v95h147.1c-6.4 34.6-25.7 63.9-54.7 83.6v69.2h88.5c51.7-47.7 80.6-118 80.6-197.6z"/>
      <path fill="#34A853" d="M272 544.3c73.8 0 135.7-24.4 181-66.3l-88.5-69.2c-24.6 16.5-56 26.2-92.6 26.2-71 0-131.1-47.9-152.6-112.2H28.6v70.6c45.1 89.2 137.4 150.9 243.4 150.9z"/>
      <path fill="#FBBC05" d="M119.4 322.8c-10.5-31.5-10.5-65.7 0-97.2V155H28.6c-41.4 82.9-41.4 180.8 0 263.6l90.8-70.8z"/>
      <path fill="#EA4335" d="M272 107.7c39.9-.6 78.1 14.7 107.2 42.5l80.2-80.2C404.7 24.2 341.8-.1 272 0 166.1 0 73.7 61.7 28.6 150.9l90.8 70.7C140.9 158.2 201 110.3 272 110.3z"/>
    </svg>
  );
}
