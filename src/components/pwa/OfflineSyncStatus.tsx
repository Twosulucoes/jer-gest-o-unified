import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CloudOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { getOfflineQueue, syncOfflineQueue, isOnline } from "@/lib/offlineQueue";
import { toast } from "sonner";

export function OfflineSyncStatus() {
  const [queueCount, setQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [online, setOnline] = useState(isOnline());

  const updateQueueCount = () => {
    setQueueCount(getOfflineQueue().length);
  };

  useEffect(() => {
    updateQueueCount();
    
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    
    const interval = setInterval(updateQueueCount, 5000);
    
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  const handleSync = async () => {
    if (!online) {
      toast.error("Você está offline. Conecte-se à internet para sincronizar.");
      return;
    }
    
    setIsSyncing(true);
    try {
      const result = await syncOfflineQueue();
      updateQueueCount();
      if (result.count > 0) {
        toast.success(`${result.count} itens sincronizados com sucesso.`);
      } else if (result.errors && result.errors > 0) {
        toast.error(`Erro ao sincronizar ${result.errors} itens.`);
      }
    } catch (error) {
      toast.error("Erro inesperado ao sincronizar.");
    } finally {
      setIsSyncing(false);
    }
  };

  if (queueCount === 0 && online) return null;

  return (
    <Card className={`border-dashed ${!online ? "border-amber-500/50 bg-amber-500/5" : "border-blue-500/50 bg-blue-500/5"}`}>
      <CardContent className="p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {!online ? (
            <CloudOff className="h-5 w-5 text-amber-500" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-blue-500" />
          )}
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              {!online ? "Modo Offline" : "Sincronização Pendente"}
            </span>
            <span className="text-xs text-muted-foreground">
              {queueCount} item(s) na fila
            </span>
          </div>
        </div>
        
        {online && queueCount > 0 && (
          <Button 
            size="sm" 
            variant="outline" 
            className="h-8 gap-1.5"
            onClick={handleSync}
            disabled={isSyncing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            Sincronizar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
