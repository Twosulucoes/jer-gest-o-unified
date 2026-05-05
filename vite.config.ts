import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { execSync } from "child_process";

// Fallback version if git command fails
let commitHash = "unknown";
try {
  commitHash = execSync("git rev-parse --short HEAD").toString().trim();
} catch (e) {
  console.warn("Could not get commit hash", e);
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(commitHash),
  },
  optimizeDeps: {
    exclude: ["@capacitor-mlkit/barcode-scanning"],
  },
  build: {
    rollupOptions: {
      external: ["@capacitor-mlkit/barcode-scanning"],
    },
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      // autoUpdate: novo SW ativa automaticamente sem prompt explícito.
      // Combina com skipWaiting + clientsClaim para tomar controle das abas
      // abertas imediatamente. O usePwaUpdateCheck no front detecta a
      // mudança de commit via /version.json e força reload limpo.
      registerType: "autoUpdate",
      devOptions: {
        enabled: false,
      },
      manifest: false,
      workbox: {
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/~oauth/],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        // version.json é o sinal canônico de "tem deploy novo".
        // Tira do precache pra nunca vir do cache antigo do SW.
        globIgnores: ["version.json"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api",
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
          {
            // version.json: sempre tenta rede primeiro com timeout curto.
            // Garante que o front detecte deploys novos rapidamente.
            urlPattern: /\/version\.json$/,
            handler: "NetworkFirst",
            options: {
              cacheName: "app-version",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 1, maxAgeSeconds: 30 },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
