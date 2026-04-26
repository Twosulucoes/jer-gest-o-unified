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
      // Se houver um service worker, podemos tentar atualizar
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.update();
          console.log("Service Worker updated");
        }
      }
      
      // Recarrega a página para garantir dados frescos
      window.location.reload();
    } catch (error) {
      console.error("Erro ao atualizar:", error);
      toast.error("Erro ao atualizar dados");
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
