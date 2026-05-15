import { useEffect } from "react";

/**
 * DESATIVADO TEMPORARIAMENTE EM DESENVOLVIMENTO LOCAL
 * Evita travar no aviso "Atualizando o app" quando rodar localhost.
 */
export function usePwaUpdateCheck(
  options?: {
    intervalMs?: number;
    onUpdateDetected?: (server: string) => void;
  }
) {
  useEffect(() => {
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (isLocalhost) {
      console.log("[pwa-update] Desativado em localhost.");
      return;
    }

    // Por enquanto também não força reload no site.
    // Depois reativamos com segurança.
    console.log("[pwa-update] Checagem desativada temporariamente.");
  }, [options?.intervalMs, options?.onUpdateDetected]);
}