import { WifiOff } from "lucide-react";

/**
 * Banner exibido quando o app foi aberto sem internet e está usando
 * roles/perfil do cache local. Some automaticamente quando o
 * AuthProvider atualiza os dados via rede.
 */
export function OfflineSessionBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 bg-amber-500 dark:bg-amber-600 text-white px-4 py-2 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider shadow-md"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      Modo offline · usando sessão salva · sincroniza ao reconectar
    </div>
  );
}
