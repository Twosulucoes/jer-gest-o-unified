import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installGlobalRefreshListener } from "@/lib/systemRefresh";
import {
  isChunkLoadError,
  recoverFromStaleChunk,
  clearStaleChunkReloadFlag,
} from "@/lib/staleChunk";

// Recupera o tema inicial
const savedTheme = (() => {
  try {
    return localStorage.getItem("jer-theme") || "dark";
  } catch {
    return "dark";
  }
})();
document.documentElement.classList.add(savedTheme);
document.documentElement.style.colorScheme = savedTheme as string;


// Guard: prevent service worker in iframes/preview
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister());
  });
}

// Recover from stale chunk references after a new deploy.
// When the SW serves an old index.html pointing to a chunk that no longer
// exists, dynamic imports throw "Failed to fetch dynamically imported module".
// Detect it once, clear caches, unregister SW, and hard-reload.
// Obs.: falhas de React.lazy são capturadas pelo MonitoringErrorBoundary
// (não chegam ao window) — ele usa a mesma recuperação de src/lib/staleChunk.
window.addEventListener("error", (e) => {
  if (isChunkLoadError(e.message)) void recoverFromStaleChunk();
});
window.addEventListener("unhandledrejection", (e) => {
  const msg = (e.reason && (e.reason.message || String(e.reason))) || "";
  if (isChunkLoadError(msg)) void recoverFromStaleChunk();
});
// Clear the reload flag on a successful full load
clearStaleChunkReloadFlag();

// Install error reporter (frontend monitoring)
import("@/lib/monitoring/errorReporter").then((m) => m.installErrorReporter()).catch(() => {});
installGlobalRefreshListener();

createRoot(document.getElementById("root")!).render(<App />);
