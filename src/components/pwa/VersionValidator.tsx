import { useState } from "react";
import { APP_VERSION } from "@/config/version";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePwaUpdateCheck } from "@/hooks/pwa/usePwaUpdateCheck";

/**
 * Detecta deploys novos enquanto o usuário está no app e força reload limpo.
 *
 * Implementação atual:
 *   - usePwaUpdateCheck() faz fetch de /version.json (NetworkFirst, cache-busted)
 *     ao montar, em visibility change, e a cada 5 min.
 *   - Quando detecta commit ≠ APP_VERSION, mostra overlay e roda hard reload
 *     (apaga caches + unregister SW). O hook chama window.location.reload em
 *     seguida; o overlay é só feedback visual durante o segundo de transição.
 *
 * Por que isso funciona (ao contrário da v1 baseada em localStorage):
 *   - localStorage não detecta nada quando o SW serve o JS antigo, porque
 *     o APP_VERSION em memória já é o velho.
 *   - Aqui a comparação é entre APP_VERSION (build time) × /version.json
 *     vivo do servidor → identifica deploy novo mesmo com SW travado.
 */
export function VersionValidator({ children }: { children: React.ReactNode }) {
  const [updateDetected, setUpdateDetected] = useState<string | null>(null);

  usePwaUpdateCheck({
    onUpdateDetected: (server) => setUpdateDetected(server),
  });

  if (updateDetected) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-destructive/10 backdrop-blur-lg">
        <div className="flex flex-col items-center gap-6 p-8 rounded-3xl bg-card border border-destructive/20 shadow-2xl max-w-sm text-center animate-in slide-in-from-bottom-4 duration-300">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
          <div className="space-y-2">
            <h3 className="font-heading font-bold text-xl">Atualizando o app</h3>
            <p className="text-sm text-muted-foreground">
              Detectamos uma versão nova no servidor. Limpando caches e recarregando…
            </p>
            <div className="mt-2 py-2 px-4 bg-muted rounded-lg text-xs font-mono">
              Em uso: {APP_VERSION}
              <br />
              Servidor: {updateDetected}
            </div>
          </div>
          <Button
            onClick={() => window.location.reload()}
            className="w-full gap-2 h-11 shadow-lg shadow-primary/20"
          >
            <RefreshCw className="h-4 w-4" />
            Recarregar agora
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
