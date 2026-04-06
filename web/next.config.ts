// web/next.config.ts

// is "/__api/:path*" the correct path?
import type { NextConfig } from "next";
import path from "node:path";

const useEmu =
  ["true", "1", "yes", "on"].includes(
    String(process.env.NEXT_PUBLIC_FIREBASE_EMULATORS ?? "").toLowerCase()
  ) ||
  ["true", "1", "yes", "on"].includes(
    String(process.env.NEXT_PUBLIC_USE_EMULATORS ?? "").toLowerCase()
  );

const allowEmuInProdBuild =
  ["true", "1", "yes", "on"].includes(
    String(process.env.ALLOW_EMULATORS_IN_PROD_BUILD ?? "").toLowerCase()
  );

const useEmuForRewrites = useEmu && (process.env.NODE_ENV !== "production" || allowEmuInProdBuild);

const project =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "housing-db-v2";

// Prefer FIREBASE_FUNCTIONS_REGION, fall back to legacy var if present
const region =
  process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION ||
  process.env.NEXT_PUBLIC_FUNCTIONS_REGION ||
  "us-central1";

const isStaticExport =
  ["true", "1", "yes", "on"].includes(
    String(process.env.STATIC_EXPORT ?? "").toLowerCase()
  );

const nextConfig: NextConfig = {
  turbopack: { root: path.join(__dirname, "..") },
  reactStrictMode: true,
  ...(isStaticExport ? { output: "export", images: { unoptimized: true } } : {}),

  eslint: {
    // Keep strict linting in dev/CI when desired, but don't fail production builds
    // due to stylistic rules while the codebase is being migrated.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow production builds/deploy previews while frontend typing cleanup is in progress.
    ignoreBuildErrors: true,
  },

  async headers() {
    if (isStaticExport) return [];
    return [
      {
        source: "/__api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET,POST,PATCH,DELETE,OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "authorization, content-type, x-firebase-appcheck, x-correlation-id",
          },
          { key: "Access-Control-Expose-Headers", value: "x-correlation-id" },
          { key: "Access-Control-Max-Age", value: "600" },
        ],
      },
    ];
  },

  async rewrites() {
    if (isStaticExport) return [];
    const base = useEmuForRewrites
      ? `http://127.0.0.1:5001/${project}/${region}`
      : `https://${region}-${project}.cloudfunctions.net`;
    return [{ source: "/__api/:path*", destination: `${base}/:path*` }];
  },
};

export default nextConfig;
