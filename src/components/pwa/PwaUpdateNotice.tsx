import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

/**
 * Componente global para gerenciar atualizações de PWA.
 * Monitora novas versões do Service Worker e exibe uma notificação amigável.
 */
export function PwaUpdateNotice() {
  const {
    needUpdate: [needUpdate, setNeedUpdate],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered');
      // Verificar atualizações periodicamente (a cada 1 hora)
      if (r) {
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('SW Registration Error', error);
    }
  });

  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    if (needUpdate) {
      setShowNotification(true);
      toast.info("Nova versão disponível!", {
        description: "Uma atualização importante foi detectada para o sistema.",
        duration: 10000,
        action: {
          label: "Atualizar",
          onClick: () => updateServiceWorker(true),
        },
      });
    }
  }, [needUpdate, updateServiceWorker]);

  if (!showNotification && !needUpdate) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[100] md:left-auto md:right-4 md:bottom-4 md:w-80 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-background/95 p-4 shadow-2xl shadow-primary/10 backdrop-blur-md">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <RefreshCw className="h-5 w-5 animate-spin-slow" />
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="font-heading text-sm font-bold text-foreground">Sistema Atualizado</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Temos uma nova versão disponível com melhorias e correções.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 h-9 text-xs"
            onClick={() => {
              setShowNotification(false);
              setNeedUpdate(false);
            }}
          >
            Depois
          </Button>
          <Button 
            size="sm" 
            className="flex-1 h-9 text-xs gap-2 shadow-sm shadow-primary/20"
            onClick={() => updateServiceWorker(true)}
          >
            <Download className="h-3.5 w-3.5" />
            Atualizar Agora
          </Button>
        </div>
      </div>
    </div>
  );
}
