import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["hdb-mobile-icon.svg"],
      manifest: {
        name: "HDB Case Manager",
        short_name: "HDB Mobile",
        description: "Case manager companion app for quick activity logging",
        theme_color: "#4f46e5",
        background_color: "#f8fafc",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "/hdb-mobile-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@lib": path.resolve(__dirname, "src/lib"),
      "@hooks": path.resolve(__dirname, "src/hooks"),
      "@types": path.resolve(__dirname, "src/types/index.ts"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split heavy, rarely-changing vendor deps into their own long-cached
        // chunks so app-code edits don't force a full re-download, and first paint
        // isn't blocked on one ~900 KB bundle.
        manualChunks: {
          "vendor-firebase": ["firebase/app", "firebase/auth", "firebase/firestore", "firebase/app-check"],
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-query": ["@tanstack/react-query"],
        },
      },
    },
  },
});
