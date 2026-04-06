// src/app/layout.tsx
import "./globals.css";
import React from "react";
import Providers from "./providers";
import { Topbar } from "@app/layout/Topbar";
import GlobalPending from "@app/layout/GlobalPending";
import { Shell } from "./shell";

export const metadata = { title: "Case Managment Dashboard" };


const initThemeScript = `
    (function () {
      try {
        var root = document.documentElement;
        var mode = localStorage.getItem("hdb_theme_mode") || "light";
        var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        var shouldDark = mode === "dark" || (mode === "system" && prefersDark);
        if (shouldDark) root.classList.add("dark");
        else root.classList.remove("dark");
      } catch (_) {}
    })();
  `;

const chunkRecoveryScript = `
    (function () {
      try {
        var KEY = "hdb_chunk_retry_v1";
        function msgOf(input) {
          if (!input) return "";
          if (typeof input === "string") return input;
          return String(input.message || input.reason || "");
        }
        function isChunkError(msg) {
          var m = String(msg || "");
          return (
            m.indexOf("ChunkLoadError") !== -1 ||
            m.indexOf("Loading chunk") !== -1 ||
            m.indexOf("CSS_CHUNK_LOAD_FAILED") !== -1 ||
            m.indexOf("Failed to fetch dynamically imported module") !== -1
          );
        }
        function reloadOnce() {
          if (sessionStorage.getItem(KEY)) return;
          sessionStorage.setItem(KEY, "1");
          var url = new URL(window.location.href);
          url.searchParams.set("_chunk_retry", String(Date.now()));
          window.location.replace(url.toString());
        }
        window.addEventListener(
          "error",
          function (event) {
            var msg = msgOf((event && (event.error || event.message)) || "");
            if (isChunkError(msg)) reloadOnce();
          },
          true
        );
        window.addEventListener("unhandledrejection", function (event) {
          var msg = msgOf(event && event.reason);
          if (isChunkError(msg)) reloadOnce();
        });
      } catch (_) {}
    })();
  `;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: initThemeScript }} />
        <script dangerouslySetInnerHTML={{ __html: chunkRecoveryScript }} />
      </head>
      {/* Grammarly (and some extensions) mutate body. This avoids noisy hydration diffs. */}
      <body suppressHydrationWarning>
        <Providers>
          <Topbar />
          <Shell>
            {children}
            <GlobalPending />
          </Shell>
        </Providers>
      </body>
    </html>
  );
}
