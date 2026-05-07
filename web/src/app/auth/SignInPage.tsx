//web/app/auth/SignInPage.tsx
"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@app/auth/AuthProvider";
import { auth, appCheckReadyPromise } from "@lib/firebase";

export default function SignInPage() {
  const { signIn, signInWithGoogle, loading, reloadProfile } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const next = params.get("next") || "/reports";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busyGoogle, setBusyGoogle] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showEmail, setShowEmail] = useState(false);

  const showSignedOutBanner =
    params.get("inactivity") === "1" || params.get("reason") === "signedout";

  const onGoogle = async () => {
    setErr(null); setBusyGoogle(true);
    try {
      await signInWithGoogle();
      if (!auth.currentUser) return; // redirect fallback will finish via onAuthStateChanged
      await auth.currentUser.getIdToken(true);
      await appCheckReadyPromise;
      await reloadProfile();
      router.replace(next);
    } catch (e: any) {
      setErr(e?.message || "Google sign-in failed");
    } finally {
      setBusyGoogle(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      await signIn(email.trim(), password);
      await auth.currentUser?.getIdToken(true);
      await appCheckReadyPromise;
      await reloadProfile();
      router.replace(next);
    } catch (e: any) {
      setErr(e?.message || "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="card mx-auto w-full rounded-2xl">
          <div className="p-6 md:p-8">
            {/* Logo/Title */}
            <div className="mb-6 text-center">
              <div className="text-2xl font-semibold tracking-tight">Compliance Dashboard</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">Sign in</div>
            </div>

            {showSignedOutBanner && (
              <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 text-amber-800 p-3 text-sm">
                To protect your data you were automatically signed out. Sign in again to keep working.
              </div>
            )}

            {err && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 text-red-700 p-3 text-sm">
                {err}
              </div>
            )}

            <button
              onClick={onGoogle}
              disabled={busyGoogle || loading}
              className="btn-secondary w-full"
            >
              {busyGoogle ? "Connecting to Google..." : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 533.5 544.3" className="w-4 h-4" aria-hidden>
                    <path fill="#4285F4" d="M533.5 278.4c0-17.4-1.6-34.1-4.6-50.2H272v95h147.1c-6.4 34.6-25.7 63.9-54.7 83.6v69.2h88.5c51.7-47.7 80.6-118 80.6-197.6z"/>
                    <path fill="#34A853" d="M272 544.3c73.8 0 135.7-24.4 181-66.3l-88.5-69.2c-24.6 16.5-56 26.2-92.6 26.2-71 0-131.1-47.9-152.6-112.2H28.6v70.6c45.1 89.2 137.4 150.9 243.4 150.9z"/>
                    <path fill="#FBBC05" d="M119.4 322.8c-10.5-31.5-10.5-65.7 0-97.2V155H28.6c-41.4 82.9-41.4 180.8 0 263.6l90.8-70.8z"/>
                    <path fill="#EA4335" d="M272 107.7c39.9-.6 78.1 14.7 107.2 42.5l80.2-80.2C404.7 24.2 341.8-.1 272 0 166.1 0 73.7 61.7 28.6 150.9l90.8 70.7C140.9 158.2 201 110.3 272 110.3z"/>
                  </svg>
                  Continue with Google
                </>
              )}
            </button>

            <div className="mt-4 text-center">
              {!showEmail ? (
                <button
                  type="button"
                  onClick={() => setShowEmail(true)}
                  className="text-sm text-slate-700 hover:underline dark:text-slate-300"
                >
                  Use a different email address
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowEmail(false)}
                  className="text-sm text-slate-600 hover:underline dark:text-slate-300"
                >
                  Or login with Google
                </button>
              )}
            </div>

            {showEmail && (
              <>
                <div className="my-4 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                  <span>or</span>
                  <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                </div>

                <form onSubmit={onSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <input
                      type="email"
                      required
                      className="input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Password</label>
                    <input
                      type="password"
                      required
                      className="input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                  </div>
                  <button
                    disabled={busy || loading}
                    className="btn w-full"
                  >
                    {busy ? "Signing in..." : "Sign in"}
                  </button>
                </form>
              </>
            )}

            <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">
              Need help?{" "}
              <Link href="mailto:Gseyfried@thehrdc.org" className="underline">Contact support</Link>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
          By continuing you agree to our acceptable use & data handling policies.
        </p>
      </div>
    </div>
  );
}
