// web/src/app/auth/AuthProvider.tsx
"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  onAuthStateChanged,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as fbSignOut,
  GoogleAuthProvider,
  type UserCredential,
  type User,
} from "firebase/auth";
import { auth, appCheckReadyPromise } from "@lib/firebase";
import {
  clearGoogleDriveAccessToken,
  storeGoogleDriveAccessToken,
  syncGoogleDriveAccessTokenOwner,
} from "@lib/googleDriveAccessToken";
import { shouldUseEmulators } from "@lib/runtimeEnv";
import UsersClient from "@client/users";

type StaffProfile = {
  uid?: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  role?: string;
  roles?: string[];
  active?: boolean;
  [k: string]: unknown;
};

type AuthCtx = {
  user: User | null;
  profile: StaffProfile | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  reloadProfile: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

const DEBUG_TIMING = String(process.env.NEXT_PUBLIC_DEBUG_TIMING || "0") === "1";
const log = (...args: any[]) => { if (DEBUG_TIMING) console.log("[auth]", ...args); };

function captureGoogleDriveAccessToken(result: UserCredential | null | undefined) {
  const credential = result ? GoogleAuthProvider.credentialFromResult(result) : null;
  const accessToken = String(credential?.accessToken || "").trim();
  const uid = String(result?.user?.uid || "").trim();
  if (!uid || !accessToken) return;
  storeGoogleDriveAccessToken(uid, accessToken);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [booting, setBooting] = useState(true);
  const [error, setErr] = useState<string | null>(null);

  const qc = useQueryClient();

  // throttle & de-dupe profile fetches
  const lastFetchMs = useRef(0);
  const inflight = useRef<Promise<StaffProfile | null> | null>(null);
  const FETCH_DEBOUNCE_MS = 5000;

  const assignProfile = (raw: any | null) => {
    if (!raw) {
      setProfile(null);
      return;
    }

    const topRole =
      raw.topRole ? String(raw.topRole).toLowerCase() : "";

    const rawRoles: string[] = Array.isArray(raw?.roles)
      ? raw.roles
      : raw?.role
      ? [raw.role]
      : [];

    let roles = rawRoles
      .filter(Boolean)
      .map((r: any) => String(r).toLowerCase());

    // If no roles but we have a non-blocked topRole, use that as the visible role
    if (!roles.length) {
      if (topRole && topRole !== "unverified" && topRole !== "public_user") {
        roles = [topRole];
      }
    }

    // Only completely empty gets "unverified"
    if (!roles.length) {
      roles = ["unverified"];
    }

    setProfile({
      ...raw,
      roles,
      role: roles[0],
      topRole: topRole || roles[0],
    });
  };

  const fetchProfile = async (reason: string, force = false, seedUser?: User | null) => {
    const u = seedUser ?? auth.currentUser;
    if (!u) { assignProfile(null); return null; }

    const now = Date.now();
    if (!force && now - lastFetchMs.current < FETCH_DEBOUNCE_MS && !inflight.current) return;

    if (inflight.current) {
      try { return await inflight.current; } catch { return null; }
    }

    inflight.current = (async () => {
      try {
        log("fetchProfile start", reason);
        const res = await UsersClient.me();           // { ok, user }
        const me = (res as any)?.user ?? null;
        assignProfile(me);
        return me;
      } finally {
        lastFetchMs.current = Date.now();
        inflight.current = null;
        log("fetchProfile done", reason);
      }
    })();

    return inflight.current;
  };

  useEffect(() => {
    let cancelled = false;
    setBooting(true);

    void getRedirectResult(auth)
      .then((result) => {
        if (!cancelled) captureGoogleDriveAccessToken(result);
      })
      .catch(() => {});

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (cancelled) return;
      setUser(u);
      setErr(null);

      if (!u) {
        clearGoogleDriveAccessToken();
        assignProfile(null);
        setBooting(false);
        return;
      }

      syncGoogleDriveAccessTokenOwner(u.uid);

      try { await u.getIdToken(true); } catch {}
      try { await appCheckReadyPromise; } catch {}

      try {
        const me = await fetchProfile("auth-state", /* force */ true, u);
        const roles: string[] = (me?.roles as string[]) || (me?.role ? [me.role] : []);
        const role = roles[0] || me?.role;
        const hasActive = Object.prototype.hasOwnProperty.call(me || {}, "active");
        const isActive = hasActive ? (me as any)?.active !== false : true;
        const allowed = role && role !== "unverified" && isActive;
        if (allowed) {
          // page-level hooks fetch domain data as needed
        }
        } catch (e: any) {
          setErr(e?.message || "Failed to load profile");

          // DEV BYPASS: if emulator and we have a user, derive a minimal profile so RequireVerified passes
          const EMU = shouldUseEmulators();

          if (EMU && u) {
            try {
              const info = await u.getIdTokenResult(true);
              const claims: any = info?.claims || {};
              const rawTop = claims.topRole || (claims.admin ? "admin" : "user");
              const topRole = String(rawTop || "user").toLowerCase();
              const roles: string[] =
                Array.isArray(claims.roles) ? claims.roles :
                claims.admin ? ["admin"] :
                claims.role ? [claims.role] : ["staff"];

              assignProfile({
                uid: u.uid,
                email: u.email || '',
                displayName: u.displayName || '',
                photoURL: u.photoURL || '',
                roles,
                role: roles[0],
                topRole,
                active: true,
              });
              return null; // we’ve set a viable profile
            } catch {}
          }

          assignProfile(null);
      } finally {
        if (!cancelled) setBooting(false);
      }
    });

    const unsubId = onIdTokenChanged(auth, async (u) => {
      if (!u) return;
      try { await fetchProfile("id-token-changed"); } catch {}
    });

    return () => { cancelled = true; unsubAuth(); unsubId(); };
  }, []);

  const signIn = async (email: string, password: string) => {
    setErr(null);
    try { await signInWithEmailAndPassword(auth, email, password); }
    catch (e: any) { setErr(e?.message || "Sign-in failed"); throw e; }
  };

  const signInWithGoogle = async () => {
    setErr(null);
    const provider = new GoogleAuthProvider();
    provider.addScope("https://www.googleapis.com/auth/drive");
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      const result = await signInWithPopup(auth, provider);
      captureGoogleDriveAccessToken(result);
    } catch (e: any) {
      const msg = String(e?.message || "");
      const shouldRedirect =
        e?.code === "auth/popup-blocked" ||
        e?.code === "auth/operation-not-supported-in-this-environment" ||
        msg.includes("Cross-Origin-Opener-Policy") ||
        msg.includes("The operation is insecure") ||
        msg.includes("window.closed call") ||
        msg.includes("blocked by");

      if (shouldRedirect) { await signInWithRedirect(auth, provider); return; }
      throw e;
    }
  };

  const reloadProfile = async () => {
    if (!auth.currentUser) return;
    try { await appCheckReadyPromise; } catch {}
    await fetchProfile("manual-reload", /* force */ true, auth.currentUser);
  };

  const signOut = async () => {
    try {
      await fbSignOut(auth);
      qc.clear();
      setUser(null);
      clearGoogleDriveAccessToken();
      assignProfile(null);
      setErr(null);
    } catch (e: any) {
      console.error("SignOut failed", e);
      throw e;
    }
  };

  const value = useMemo<AuthCtx>(() => ({
    user, profile, loading: booting, error, signIn, signInWithGoogle, signOut, reloadProfile,
  }), [user, profile, booting, error]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within <AuthProvider>");
  return v;
}

export default AuthProvider;
