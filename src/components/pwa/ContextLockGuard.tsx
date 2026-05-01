import { useStageContext } from "@/contexts/StageContext";
import { Loader2 } from "lucide-react";

/**
 * Component that visually locks the UI when the application context
 * (stage, module, etc.) is transitioning.
 * This prevents race conditions from rapid user interactions.
 */
export function ContextLockGuard() {
  const { isContextLocked, stagesLoading } = useStageContext();

  if (!isContextLocked && !stagesLoading) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/40 backdrop-blur-[1px] animate-in fade-in duration-200">
      <div className="flex flex-col items-center gap-3 p-6 bg-card border rounded-xl shadow-2xl">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          Sincronizando contexto...
        </p>
      </div>
    </div>
  );
}
