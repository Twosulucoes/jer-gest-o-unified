import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Banner sticky no topo do PWA que aparece SÓ quando o navegador está
 * offline. Usa os eventos online/offline da Window e o snapshot inicial
 * de navigator.onLine. Quando volta a ficar online, some sozinho.
 *
 * Por que: operador no campo (sol direto, túneis, eventos com WiFi
 * instável) precisa saber AGORA quando perdeu conexão, não depois de
 * tentar sincronizar.
 */
export function PwaOfflineBanner() {
  const [online, setOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 bg-amber-500 dark:bg-amber-600 text-white px-4 py-2 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider shadow-md"
    >
      <WifiOff className="h-4 w-4" aria-hidden="true" />
      Você está offline · operações ficam na fila e sincronizam quando voltar
    </div>
  );
}
