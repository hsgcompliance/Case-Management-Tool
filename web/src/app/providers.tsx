// web/src/app/providers.tsx
"use client";

import React, { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@app/auth/AuthProvider";
import { attachGlobalQueryClient } from "@hooks/optimistic";
import { RQ_DEFAULTS } from "@hooks/base";
import { attachReactQueryDebug } from "@lib/reactQueryDebug";
import { shouldUseEmulators } from "@lib/runtimeEnv";
import { resolveFunctionsBase } from "@lib/functionsBase";
import { getAuth } from "firebase/auth";
import GameMiniPlayerProvider from "@features/games/GameMiniPlayerContext";

const CHUNK_RELOAD_ONCE_KEY = "__hdb_chunk_reload_once__";

function isChunkLoadFailure(err: unknown): boolean {
  const msg = String(
    (err as any)?.message ||
      (err as any)?.reason?.message ||
      err ||
      ""
  ).toLowerCase();
  return (
    msg.includes("chunkloaderror") ||
    msg.includes("loading chunk") ||
    (msg.includes("/_next/static/chunks/") && msg.includes("404"))
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          ...RQ_DEFAULTS,
          retry: (failureCount, err: any) => {
            const status =
              err?.meta?.status ??
              err?.status ??
              err?.response?.status;

            if (status === 401 || status === 403) return false;
            return failureCount < 2;
          },
        },
        mutations: { retry: 0 },
      },
    });
    attachGlobalQueryClient(client);
    return client;
  });

  useEffect(() => {
    // Re-attach on client since useState initializer may not re-run during hydration
    attachGlobalQueryClient(qc);

    const detachRqDebug = attachReactQueryDebug(qc);
    const handleChunkFailure = (source: unknown) => {
      if (typeof window === "undefined") return;
      if (!isChunkLoadFailure(source)) return;
      try {
        if (window.sessionStorage.getItem(CHUNK_RELOAD_ONCE_KEY) === "1") return;
        window.sessionStorage.setItem(CHUNK_RELOAD_ONCE_KEY, "1");
      } catch {}
      console.warn("[HDB] Chunk load failure detected; reloading once.", source);
      window.location.reload();
    };

    const onError = (event: ErrorEvent) => {
      const target = event.target as HTMLScriptElement | null;
      const scriptSrc = target?.tagName === "SCRIPT" ? target.src : "";
      if (scriptSrc && scriptSrc.includes("/_next/static/chunks/")) {
        handleChunkFailure(new Error(`ChunkLoadError: ${scriptSrc}`));
      } else {
        handleChunkFailure(event.error || event.message);
      }
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      handleChunkFailure(event.reason);
    };

    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    (async () => {
      try {
        const { appCheckReadyPromise, auth, appCheck } = await import("@lib/firebase");
        await appCheckReadyPromise;

        const EMU = shouldUseEmulators();

        const base = (globalThis as any).__HDB_BASE || resolveFunctionsBase();

        // 1) Emulator bootstrap: create/sign-in + promote
        if (EMU && !auth.currentUser) {
          const email = process.env.NEXT_PUBLIC_DEV_EMAIL || "admin@example.com";
          const pass = process.env.NEXT_PUBLIC_DEV_PASS || "change-me";
          const { signInWithEmailAndPassword, createUserWithEmailAndPassword } =
            await import("firebase/auth");

          try {
            await signInWithEmailAndPassword(auth, email, pass);
          } catch (err: any) {
            if (err?.code === "auth/user-not-found") {
              await createUserWithEmailAndPassword(auth, email, pass);
            } else {
              console.warn("[HDB] EMU bootstrap sign-in failed", err);
            }
          }

          if (base) {
            try {
              const id = await auth.currentUser!.getIdToken();
              await fetch(`${String(base).replace(/\/+$/, "")}/devGrantAdmin`, {
                method: "POST",
                headers: { Authorization: `Bearer ${id}`, "Content-Type": "application/json" },
                body: "{}",
              });

              const auth2 = getAuth();
              await auth2.currentUser?.getIdToken(true);
              await new Promise((r) => setTimeout(r, 50));
            } catch {}
          }
        }

        // 2) Probe only when we actually have an ID token
        const { getToken } = await import("firebase/app-check");
        const id = auth.currentUser ? await auth.currentUser.getIdToken() : "";
        if (!id || !base) return;

        let appTok = "";
        try {
          appTok = (await getToken(appCheck!))?.token || "";
        } catch {}

        const headers: Record<string, string> = { Authorization: `Bearer ${id}` };
        if (appTok) headers["X-Firebase-AppCheck"] = appTok;

        const url = `${String(base).replace(/\/+$/, "")}/usersMe`;
        const r = await fetch(url, { headers });
        console.info("[HDB] probe status", r.status);
      } catch (e) {
        console.warn("[HDB] providers bootstrap error", e);
      }
    })();
    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      detachRqDebug();
    };
  }, []);

  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <GameMiniPlayerProvider>
          {children}
        </GameMiniPlayerProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
