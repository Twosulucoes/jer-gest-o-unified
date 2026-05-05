import { useEffect, useRef } from "react";
import { APP_VERSION } from "@/config/version";

/**
 * Detecta um deploy novo no servidor enquanto o usuário está no PWA, e
 * força reload limpo (apaga caches + unregister SW + window.location.reload).
 *
 * Estratégia:
 *   1. Lê APP_VERSION (commit hash injetado em build time pelo Vite).
 *   2. Periodicamente fetcha `/version.json` com cache-buster + cache: 'no-store'.
 *      O workbox runtime cache desse arquivo está em NetworkFirst com timeout
 *      curto (vite.config.ts), então o navegador recebe o JSON do servidor
 *      mesmo se o SW estiver vivo.
 *   3. Se `commit` retornado ≠ APP_VERSION em memória, sabemos que o servidor
 *      tem build novo e o cliente ainda roda o antigo → reload duro.
 *
 * Quando dispara:
 *   - Ao montar o componente (primeira navegação para qualquer rota PWA).
 *   - Quando a aba volta a ficar visível (visibilitychange).
 *   - A cada CHECK_INTERVAL_MS enquanto a aba está aberta.
 *
 * Idempotência:
 *   - sessionStorage RELOADED_FOR_VERSION evita loop se o navegador servir
 *     o bundle velho persistentemente (ex: SW velho ignora skipWaiting).
 */

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 min
const RELOADED_FOR_VERSION = "jer_pwa_reloaded_for";

interface VersionResponse {
  commit?: string;
  appVersion?: string;
  buildDate?: string;
}

async function fetchServerVersion(): Promise<string | null> {
  try {
    // cache-busting param + no-store: derruba qualquer cache que ainda
    // sobreviveu (proxy, SW antigo, browser HTTP cache).
    const res = await fetch(`/version.json?_=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data: VersionResponse = await res.json();
    // Aceita tanto `commit` (curto) quanto `appVersion` como fonte canônica.
    return (data.commit || data.appVersion || null)?.toString() || null;
  } catch {
    return null;
  }
}

async function performHardReload(serverVersion: string) {
  // Marca pra evitar loop se mesmo após reload o navegador continuar servindo
  // o bundle antigo (em geral significa SW completamente travado).
  const previous = sessionStorage.getItem(RELOADED_FOR_VERSION);
  if (previous === serverVersion) {
    console.warn("[pwa-update] Reload já tentado para", serverVersion, "— abortando.");
    return;
  }
  sessionStorage.setItem(RELOADED_FOR_VERSION, serverVersion);

  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch (err) {
    console.warn("[pwa-update] Falha ao limpar cache/SW antes do reload:", err);
  }
  window.location.reload();
}

export function usePwaUpdateCheck(options?: { intervalMs?: number; onUpdateDetected?: (server: string) => void }) {
  const intervalMs = options?.intervalMs ?? CHECK_INTERVAL_MS;
  const onUpdateDetected = options?.onUpdateDetected;
  const lastCheckRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const check = async () => {
      // Evita disparar checagens em rajada (ex: visibility + interval no mesmo segundo).
      const now = Date.now();
      if (now - lastCheckRef.current < 5_000) return;
      lastCheckRef.current = now;

      const server = await fetchServerVersion();
      if (cancelled || !server) return;

      // APP_VERSION pode vir como "unknown" em build local sem git; ignora.
      if (!APP_VERSION || APP_VERSION === "unknown") return;

      // Hashes truncados em tamanhos diferentes contam como iguais
      // se um for prefixo do outro. Cenário real:
      //   __APP_VERSION__ injetado pelo Vite = `git rev-parse --short HEAD`
      //   (7 chars por padrão). public/version.json é gerado pelo
      //   scripts/update-version e usa 8 chars. Sem essa normalização,
      //   "0cd4565" !== "0cd4565b" causaria reload infinito.
      const sameCommit = server === APP_VERSION
        || server.startsWith(APP_VERSION)
        || APP_VERSION.startsWith(server);
      if (sameCommit) return;

      const previous = sessionStorage.getItem(RELOADED_FOR_VERSION);
      if (previous === server) {
        console.warn("[pwa-update] Reload já tentado para", server, "— abortando para evitar loop.");
        return;
      }

      console.warn(
        `[pwa-update] Deploy novo detectado. Cliente=${APP_VERSION} Servidor=${server} → reload limpo.`,
      );
      
      if (onUpdateDetected) onUpdateDetected(server);
      await performHardReload(server);
    };

    // 1) Primeira checagem ao montar.
    void check();

    // 2) Volta da aba: rechecar.
    const onVisibility = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // 3) Polling enquanto aba aberta.
    interval = setInterval(check, intervalMs);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (interval) clearInterval(interval);
    };
  }, [intervalMs, onUpdateDetected]);
}
