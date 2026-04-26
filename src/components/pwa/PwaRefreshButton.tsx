import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";

export function PwaRefreshButton() {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    
    // Simula uma pequena espera para feedback visual
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      // Limpar caches para garantir dados frescos e arquivos mais recentes
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }

      // Se houver um service worker, tentar atualizar ou desregistrar para forçar recarga limpa
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.update();
          // Opcionalmente desregistramos se quisermos ser super agressivos:
          // await registration.unregister();
        }
      }
      
      toast.success("Sincronizando dados...");
      
      // Recarrega a página para garantir dados frescos
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error("Erro ao atualizar:", error);
      toast.error("Erro ao sincronizar dados");
      setRefreshing(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleRefresh}
      disabled={refreshing}
      className="h-9 w-9 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
      title="Atualizar dados"
    >
      <RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
    </Button>
  );
}
