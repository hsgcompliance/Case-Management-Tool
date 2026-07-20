import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig(({ mode }) => {
  const formsEnv = loadEnv(mode, __dirname, "VITE_FIREBASE_");
  const webEnv = loadEnv(mode, path.resolve(__dirname, "../web"), "NEXT_PUBLIC_FIREBASE_");

  const firebaseEnv = {
    VITE_FIREBASE_PROJECT_ID:
      formsEnv.VITE_FIREBASE_PROJECT_ID || webEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_API_KEY:
      formsEnv.VITE_FIREBASE_API_KEY || webEnv.NEXT_PUBLIC_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN:
      formsEnv.VITE_FIREBASE_AUTH_DOMAIN || webEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_STORAGE_BUCKET:
      formsEnv.VITE_FIREBASE_STORAGE_BUCKET || webEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    VITE_FIREBASE_MESSAGING_SENDER_ID:
      formsEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || webEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    VITE_FIREBASE_APP_ID:
      formsEnv.VITE_FIREBASE_APP_ID || webEnv.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  return {
    plugins: [react(), tailwindcss()],
    define: Object.fromEntries(
      Object.entries(firebaseEnv).map(([key, value]) => [
        `import.meta.env.${key}`,
        JSON.stringify(value || ""),
      ]),
    ),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-react": ["react", "react-dom", "react-router-dom"],
          },
        },
      },
    },
  };
});
