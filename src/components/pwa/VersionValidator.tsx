import { useState, useEffect } from 'react';
import { APP_VERSION, VERSION_KEY } from '@/config/version';
import { Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

/**
 * Componente que valida se a versão do sistema está sincronizada.
 * Bloqueia interações se uma inconsistência for detectada ou se o sistema estiver atualizando.
 */
export function VersionValidator({ children }: { children: React.ReactNode }) {
  const [isSyncing, setIsSyncing] = useState(true);
  const [versionMismatch, setVersionMismatch] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Exponha a versão para depuração
    (window as any).APP_VERSION = APP_VERSION;
    
    // Simula uma pequena verificação de sincronização de módulos
    const storedVersion = localStorage.getItem(VERSION_KEY);
    setCurrentVersion(APP_VERSION);

    const checkSync = () => {
      console.log(`[VersionCheck] Validating version: ${APP_VERSION}`);
      
      // Se não houver versão salva, salvamos a atual
      if (!storedVersion) {
        localStorage.setItem(VERSION_KEY, APP_VERSION);
        setIsSyncing(false);
        return;
      }

      // Se a versão salva for diferente da versão do código atual
      if (storedVersion !== APP_VERSION) {
        console.warn(`[VersionCheck] Mismatch: Code(${APP_VERSION}) vs Storage(${storedVersion})`);
        setVersionMismatch(true);
        setIsSyncing(false);
        return;
      }

      // Pequeno delay para garantir que recursos críticos carregaram (estético)
      const timer = setTimeout(() => {
        setIsSyncing(false);
      }, 800);

      return () => clearTimeout(timer);
    };

    checkSync();
  }, []);

  useEffect(() => {
    if (versionMismatch && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (versionMismatch && countdown === 0) {
      handleUpdateVersion();
    }
  }, [versionMismatch, countdown]);

  const handleUpdateVersion = () => {
    localStorage.setItem(VERSION_KEY, APP_VERSION);
    window.location.reload();
  };

  if (isSyncing) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/80 backdrop-blur-md">
        <div className="flex flex-col items-center gap-4 p-8 rounded-3xl bg-card border shadow-xl max-w-xs text-center animate-in fade-in zoom-in-95 duration-300">
          <div className="relative">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <ShieldCheck className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 text-primary/40" />
          </div>
          <div className="space-y-1">
            <h3 className="font-heading font-bold text-lg">Sincronizando Módulos</h3>
            <p className="text-sm text-muted-foreground">Validando integridade da versão {APP_VERSION}...</p>
          </div>
        </div>
      </div>
    );
  }

  if (versionMismatch) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-destructive/10 backdrop-blur-lg">
        <div className="flex flex-col items-center gap-6 p-8 rounded-3xl bg-card border border-destructive/20 shadow-2xl max-w-sm text-center animate-in slide-in-from-bottom-4 duration-500">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
            <RefreshCw className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h3 className="font-heading font-bold text-xl">Versão Incompatível</h3>
            <p className="text-sm text-muted-foreground">
              Detectamos que alguns módulos ainda estão rodando em versões anteriores. 
              Para evitar perda de dados, é necessário atualizar.
            </p>
            <div className="mt-2 py-2 px-4 bg-muted rounded-lg text-xs font-mono">
              Esperada: {APP_VERSION} <br />
              Detectada: {localStorage.getItem(VERSION_KEY)}
            </div>
          </div>
          <div className="w-full space-y-3">
            <Button 
              onClick={handleUpdateVersion} 
              className="w-full gap-2 h-11 shadow-lg shadow-primary/20"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar agora
            </Button>
            <p className="text-[10px] text-muted-foreground">
              Recarregando automaticamente em {countdown} segundos...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
