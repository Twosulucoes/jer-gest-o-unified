import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export function GlobalRefreshButton({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { hasRole } = useAuth();

  if (!hasRole("super_admin")) return null;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const toastId = toast.loading("Atualizando dados globais...");
    
    try {
      // Invalida todos os queries do React Query
      await queryClient.invalidateQueries();
      
      // Pequeno delay para a animação ser visível
      await new Promise(resolve => setTimeout(resolve, 800));
      
      toast.success("Dados atualizados com sucesso!", { id: toastId });
    } catch (error) {
      console.error("Erro ao atualizar dados:", error);
      toast.error("Erro ao atualizar dados.", { id: toastId });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleHardRefresh = () => {
    toast.info("Reiniciando a plataforma...");
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Button
        variant="outline"
        size="sm"
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="h-9 px-3 border-amber-500/20 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 gap-2"
        title="Atualizar dados (Cache)"
      >
        <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
        <span className="hidden md:inline">Atualizar Dados</span>
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        onClick={handleHardRefresh}
        className="h-9 w-9 text-muted-foreground hover:text-foreground"
        title="Recarregar Página (Hard Refresh)"
      >
        <RefreshCw className="h-3.5 w-3.5 rotate-180" />
      </Button>
    </div>
  );
}
