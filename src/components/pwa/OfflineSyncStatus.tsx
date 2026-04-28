import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CloudOff, RefreshCw, CheckCircle2, Ticket } from "lucide-react";
import { getOfflineQueue, syncOfflineQueue, isOnline } from "@/lib/offlineQueue";
import { getVoucherQueue, syncVoucherQueue } from "@/lib/voucherOffline";
import { toast } from "sonner";

export function OfflineSyncStatus() {
  const [queueCount, setQueueCount] = useState(0);
  const [voucherQueueCount, setVoucherQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [online, setOnline] = useState(isOnline());

  const updateQueueCounts = () => {
    setQueueCount(getOfflineQueue().filter(i => i.status === "pending" || i.status === "failed").length);
    setVoucherQueueCount(getVoucherQueue().filter(i => i.status === "pending" || i.status === "failed").length);
  };

  useEffect(() => {
    updateQueueCounts();
    
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    
    const interval = setInterval(updateQueueCounts, 5000);
    
    // Auto-sync effect
    const autoSyncInterval = setInterval(() => {
      if (isOnline()) {
        handleSync();
      }
    }, 30000);
    
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
      clearInterval(autoSyncInterval);
    };
  }, []);

  const handleSync = async () => {
    if (!online) {
      toast.error("Você está offline. Conecte-se à internet para sincronizar.");
      return;
    }
    
    setIsSyncing(true);
    try {
      let syncedAny = false;
      
      if (queueCount > 0) {
        const result = await syncOfflineQueue();
        if (result.count > 0) {
          toast.success(`${result.count} credenciais sincronizadas.`);
          syncedAny = true;
        }
        if (result.errors && result.errors > 0) {
          toast.error(`Erro ao sincronizar ${result.errors} credenciais.`);
        }
      }

      if (voucherQueueCount > 0) {
        const vResult = await syncVoucherQueue();
        if (vResult.count > 0) {
          toast.success(`${vResult.count} vouchers sincronizados.`);
          syncedAny = true;
        }
        if (vResult.conflicts > 0) {
          toast.error(`${vResult.conflicts} conflitos detectados nos vouchers.`);
        }
      }

      updateQueueCounts();
    } catch (error) {
      toast.error("Erro inesperado ao sincronizar.");
    } finally {
      setIsSyncing(false);
    }
  };

  const totalPending = queueCount + voucherQueueCount;
  if (totalPending === 0 && online) return null;

  return (
    <Card className={cn(
      "border-dashed",
      !online ? "border-amber-500/50 bg-amber-500/5" : "border-blue-500/50 bg-blue-500/5 shadow-app-sm"
    )}>
      <CardContent className="p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {!online ? (
            <CloudOff className="h-5 w-5 text-amber-500" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-blue-500" />
          )}
          <div className="flex flex-col">
            <span className="text-sm font-bold">
              {!online ? "Operação Offline" : "Sincronização Pendente"}
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              {queueCount > 0 && (
                <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {queueCount} registros
                </span>
              )}
              {voucherQueueCount > 0 && (
                <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Ticket className="h-2.5 w-2.5" /> {voucherQueueCount} vouchers
                </span>
              )}
              {totalPending === 0 && !online && (
                <span className="text-[10px] text-muted-foreground italic">Pronto para campo</span>
              )}
            </div>
          </div>
        </div>
        
        {online && totalPending > 0 && (
          <Button 
            size="sm" 
            variant="module" 
            className="h-9 gap-2 font-bold shadow-app-md"
            onClick={handleSync}
            disabled={isSyncing}
          >
            <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
            Sync
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

import { cn } from "@/lib/utils";
