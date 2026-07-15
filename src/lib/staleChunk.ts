/**
 * Recuperação de chunks obsoletos após deploy.
 *
 * Quando o service worker serve um index.html antigo apontando para um chunk
 * com hash que não existe mais no servidor, o import() dinâmico da rota lazy
 * falha com "Failed to fetch dynamically imported module". A recuperação é:
 * limpar os caches, desregistrar o SW e recarregar uma única vez (flag em
 * sessionStorage evita loop infinito de reload).
 *
 * Usado em dois pontos:
 *  - main.tsx: listeners globais de window (error/unhandledrejection)
 *  - MonitoringErrorBoundary: falhas de React.lazy acontecem na fase de
 *    render e são capturadas pelo boundary — NUNCA chegam ao window — então
 *    o boundary precisa acionar a recuperação por conta própria.
 */

const RELOAD_FLAG = "jer-chunk-reload";

export function isChunkLoadError(message?: string | null): boolean {
  if (!message) return false;
  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("error loading dynamically imported module") ||
    message.includes("is not a valid JavaScript MIME type")
  );
}

async function clearSwAndCaches(): Promise<void> {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    const regs = await navigator.serviceWorker?.getRegistrations();
    await Promise.all((regs ?? []).map((r) => r.unregister()));
  } catch {
    // ignore — mesmo sem limpar tudo, o reload ainda pode resolver
  }
}

/**
 * Limpa caches/SW e recarrega a página. Retorna false quando a recuperação
 * automática já foi tentada nesta sessão (evita loop); `force` ignora a
 * flag para o botão manual de "Recarregar".
 */
export async function recoverFromStaleChunk(opts?: { force?: boolean }): Promise<boolean> {
  try {
    if (!opts?.force && sessionStorage.getItem(RELOAD_FLAG)) return false;
    sessionStorage.setItem(RELOAD_FLAG, "1");
  } catch {
    // sessionStorage indisponível — segue com o reload mesmo assim
  }
  await clearSwAndCaches();
  window.location.reload();
  return true;
}

/** Limpa a flag de reload após um carregamento bem-sucedido. */
export function clearStaleChunkReloadFlag(delayMs = 5000): void {
  window.addEventListener("load", () => {
    setTimeout(() => {
      try {
        sessionStorage.removeItem(RELOAD_FLAG);
      } catch {
        // ignore
      }
    }, delayMs);
  });
}
