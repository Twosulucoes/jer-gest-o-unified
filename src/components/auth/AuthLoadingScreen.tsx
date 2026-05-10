import { Loader2, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

export default function AuthLoadingScreen() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      {isOffline ? (
        <>
          <WifiOff className="h-8 w-8 text-amber-500" />
          <p className="text-sm text-muted-foreground text-center max-w-[240px]">
            Sem conexão. Restaurando sessão salva…
          </p>
        </>
      ) : (
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      )}
    </div>
  );
}
