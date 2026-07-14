import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { FormShell } from "@/components/ui";
import StaffLandingPage from "@/pages/StaffLandingPage";

// Only auto-trigger Google sign-in once per browser session (prevents loops).
const AUTO_KEY = "hdb:forms:auto-signin-tried";
const REDIRECT_KEY = "hdb:forms:redirect-ts";
const REDIRECT_TTL = 30_000;

function classifyError(code: string, message: string): string | null {
  const s = `${code} ${message}`.toLowerCase();
  if (s.includes("popup-closed") || code === "auth/cancelled-popup-request") return null;
  if (s.includes("unauthorized-domain")) {
    return "This domain isn't authorized for sign-in yet. Add housing-db-forms.web.app to Firebase Auth → Authorized domains.";
  }
  if (s.includes("access_denied") || s.includes("org_internal") || s.includes("not allowed") || s.includes("hd_hint")) {
    return "That account is not allowed. Please sign in with your work Google account.";
  }
  return "Google sign-in failed. Please try again.";
}

export default function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/staff";
  const auto = params.get("auto") === "1";

  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyGoogle, setBusyGoogle] = useState(false);
  const [busyEmail, setBusyEmail] = useState(false);
  const [checkingRedirect, setCheckingRedirect] = useState(() => {
    const ts = sessionStorage.getItem(REDIRECT_KEY);
    return !!ts && Date.now() - Number(ts) < REDIRECT_TTL;
  });
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  // Navigate away once signed in.
  useEffect(() => {
    if (!loading && user) navigate(decodeURIComponent(next), { replace: true });
  }, [loading, user, next, navigate]);

  // Resolve any pending redirect result on mount.
  useEffect(() => {
    getRedirectResult(auth)
      .catch((e: unknown) => {
        const err = e as { code?: string; message?: string };
        const msg = classifyError(err?.code ?? "", err?.message ?? "");
        if (mounted.current && msg) setError(msg);
      })
      .finally(() => {
        sessionStorage.removeItem(REDIRECT_KEY);
        if (mounted.current) { setCheckingRedirect(false); setBusyGoogle(false); }
      });
  }, []);

  // Auto sign-in: when arriving via the guard (?auto=1), kick off Google once.
  useEffect(() => {
    if (loading || user || checkingRedirect) return;
    if (!auto || sessionStorage.getItem(AUTO_KEY)) return;
    sessionStorage.setItem(AUTO_KEY, "1");
    sessionStorage.setItem(REDIRECT_KEY, String(Date.now()));
    setBusyGoogle(true);
    const provider = new GoogleAuthProvider();
    signInWithRedirect(auth, provider).catch(() => {
      sessionStorage.removeItem(REDIRECT_KEY);
      if (mounted.current) setBusyGoogle(false);
    });
  }, [loading, user, checkingRedirect, auto]);

  async function startGoogle() {
    setError(null);
    setBusyGoogle(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await signInWithPopup(auth, provider);
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err?.code === "auth/popup-blocked") {
        sessionStorage.setItem(REDIRECT_KEY, String(Date.now()));
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (e2: unknown) {
          sessionStorage.removeItem(REDIRECT_KEY);
          const err2 = e2 as { code?: string; message?: string };
          const msg = classifyError(err2?.code ?? "", err2?.message ?? "");
          if (msg) setError(msg);
        }
      } else {
        const msg = classifyError(err?.code ?? "", err?.message ?? "");
        if (msg) setError(msg);
      }
      setBusyGoogle(false);
    }
  }

  async function onSubmitEmail(e: React.FormEvent) {
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

  if (loading || checkingRedirect) return <FormShell title="Staff sign-in"><div className="flex items-center justify-center gap-3 py-8 text-slate-500"><span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" /><span className="text-sm">Signing in…</span></div></FormShell>;

  const connecting = busyGoogle;

  return (
    <>
    <FormShell title="Staff sign-in" subtitle="Form-submission access for case managers">
      <div className="space-y-3">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>
        ) : null}

        <button
          type="button"
          onClick={() => void startGoogle()}
          disabled={connecting || busyEmail}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          {connecting ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          ) : (
            <GoogleIcon />
          )}
          {connecting ? "Connecting to Google…" : "Continue with Google"}
        </button>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowEmail((v) => !v)}
            className="text-sm text-slate-400 underline underline-offset-2 hover:text-slate-600"
          >
            {showEmail ? "Back to Google sign-in" : "Sign in with email instead"}
          </button>
        </div>

        {showEmail ? (
          <form onSubmit={(e) => void onSubmitEmail(e)} className="space-y-3 pt-1">
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <input
              type="password"
              required
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <button
              type="submit"
              disabled={busyEmail}
              className="block w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {busyEmail ? "Signing in…" : "Sign in"}
            </button>
          </form>
        ) : null}

        <div className="pt-1 text-center">
          <button
            type="button"
            onClick={() => { sessionStorage.removeItem(AUTO_KEY); signOut(auth).catch(() => {}); setError(null); }}
            className="text-xs text-slate-400 underline underline-offset-2 hover:text-slate-600"
          >
            Reset sign-in
          </button>
        </div>
      </div>
    </FormShell>

    {/* Quick links live on the sign-in page too — no sign-in needed for the
        new-tab links; signing in unlocks the embedded "Open" experiences. */}
    <div className="mx-auto max-w-4xl px-4 pb-12">
      <StaffLandingPage />
    </div>
    </>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 533.5 544.3" aria-hidden>
      <path fill="#4285F4" d="M533.5 278.4c0-17.4-1.6-34.1-4.6-50.2H272v95h147.1c-6.4 34.6-25.7 63.9-54.7 83.6v69.2h88.5c51.7-47.7 80.6-118 80.6-197.6z" />
      <path fill="#34A853" d="M272 544.3c73.8 0 135.7-24.4 181-66.3l-88.5-69.2c-24.6 16.5-56 26.2-92.6 26.2-71 0-131.1-47.9-152.6-112.2H28.6v70.6c45.1 89.2 137.4 150.9 243.4 150.9z" />
      <path fill="#FBBC05" d="M119.4 322.8c-10.5-31.5-10.5-65.7 0-97.2V155H28.6c-41.4 82.9-41.4 180.8 0 263.6l90.8-70.8z" />
      <path fill="#EA4335" d="M272 107.7c39.9-.6 78.1 14.7 107.2 42.5l80.2-80.2C404.7 24.2 341.8-.1 272 0 166.1 0 73.7 61.7 28.6 150.9l90.8 70.7C140.9 158.2 201 110.3 272 110.3z" />
    </svg>
  );
}
