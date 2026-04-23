import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installGlobalRefreshListener } from "@/lib/systemRefresh";

// JER Gestão é dark-only (forçado globalmente).
document.documentElement.classList.add("dark");
document.documentElement.style.colorScheme = "dark";
try { localStorage.setItem("jer-theme", "dark"); } catch {}

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
const RELOAD_FLAG = "jer-chunk-reload";
function isChunkLoadError(message?: string) {
  if (!message) return false;
  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("error loading dynamically imported module")
  );
}
async function handleStaleChunk() {
  if (sessionStorage.getItem(RELOAD_FLAG)) return;
  sessionStorage.setItem(RELOAD_FLAG, "1");
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    const regs = await navigator.serviceWorker?.getRegistrations();
    await Promise.all((regs ?? []).map((r) => r.unregister()));
  } catch {
    // ignore
  }
  window.location.reload();
}
window.addEventListener("error", (e) => {
  if (isChunkLoadError(e.message)) handleStaleChunk();
});
window.addEventListener("unhandledrejection", (e) => {
  const msg = (e.reason && (e.reason.message || String(e.reason))) || "";
  if (isChunkLoadError(msg)) handleStaleChunk();
});
// Clear the reload flag on a successful full load
window.addEventListener("load", () => {
  setTimeout(() => sessionStorage.removeItem(RELOAD_FLAG), 5000);
});

// Install error reporter (frontend monitoring)
import("@/lib/monitoring/errorReporter").then((m) => m.installErrorReporter()).catch(() => {});
installGlobalRefreshListener();

createRoot(document.getElementById("root")!).render(<App />);
