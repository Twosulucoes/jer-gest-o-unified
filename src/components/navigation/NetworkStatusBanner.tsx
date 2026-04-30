import { useState, useEffect } from "react";
import { WifiOff, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Global Network Status Banner.
 * Automatically detects offline/slow connection and provides a retry mechanism.
 */
export function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSlow, setIsSlow] = useState(false);
  const [showSlowNotice, setShowSlowNotice] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Network Information API check
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (connection) {
      const updateConnectionStatus = () => {
        const slowTypes = ['slow-2g', '2g'];
        const highLatency = connection.rtt > 2000; // > 2s RTT
        const isCurrentlySlow = slowTypes.includes(connection.effectiveType) || highLatency;
        setIsSlow(isCurrentlySlow);
        if (isCurrentlySlow) setShowSlowNotice(true);
      };

      connection.addEventListener("change", updateConnectionStatus);
      updateConnectionStatus();
      
      return () => connection.removeEventListener("change", updateConnectionStatus);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleRetry = () => {
    window.location.reload();
  };

  if (isOnline && !isSlow) return null;

  return (
    <div className={cn(
      "fixed bottom-24 left-4 right-4 z-[100] animate-in slide-in-from-bottom-8 duration-300",
      "sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-xs"
    )}>
      <div className={cn(
        "flex flex-col gap-3 p-4 rounded-2xl border shadow-2xl backdrop-blur-xl",
        !isOnline ? "bg-destructive/95 border-destructive/20 text-white" : "bg-amber-500/95 border-amber-600/20 text-white"
      )}>
        <div className="flex items-start gap-3">
          <div className="mt-1 h-10 w-10 shrink-0 flex items-center justify-center rounded-full bg-white/20">
            {!isOnline ? <WifiOff className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          </div>
          <div className="space-y-1">
            <p className="font-bold text-sm">
              {!isOnline ? "Você está offline" : "Conexão Instável"}
            </p>
            <p className="text-xs opacity-90 leading-relaxed">
              {!isOnline 
                ? "Sincronização pausada. Algumas funções podem não estar disponíveis." 
                : "A internet está lenta. Os dados podem demorar para carregar."}
            </p>
          </div>
        </div>
        
        <Button 
          onClick={handleRetry} 
          variant="secondary" 
          size="sm" 
          className="w-full bg-white text-black hover:bg-white/90 font-bold h-9"
        >
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Tentar Reconectar
        </Button>
      </div>
    </div>
  );
}
