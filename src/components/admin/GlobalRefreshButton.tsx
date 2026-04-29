import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { RefreshCw, Globe, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { dispatchGlobalRefresh } from "@/lib/systemRefresh";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function GlobalRefreshButton({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { hasRole } = useAuth();

  if (!hasRole("super_admin")) return null;

  const handleLocalRefresh = async () => {
    setIsRefreshing(true);
    const toastId = toast.loading("Atualizando cache local...");
    
    try {
      await queryClient.invalidateQueries();
      await new Promise(resolve => setTimeout(resolve, 800));
      toast.success("Cache local atualizado!", { id: toastId });
    } catch (error) {
      console.error("Erro ao atualizar cache:", error);
      toast.error("Erro ao atualizar cache local.", { id: toastId });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleGlobalRefresh = async () => {
    const confirmed = window.confirm(
      "Isso forçará o recarregamento de TODAS as máquinas conectadas (incluindo competidores, telões e recepção). Confirma?"
    );
    
    if (!confirmed) return;

    setIsRefreshing(true);
    const toastId = toast.loading("Enviando comando global...");
    
    try {
      await dispatchGlobalRefresh();
      toast.success("Refresh global enviado com sucesso!", { id: toastId });
    } catch (error) {
      console.error("Erro ao enviar refresh global:", error);
      toast.error("Erro ao enviar comando global.", { id: toastId });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleHardRefresh = () => {
    window.location.reload();
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={isRefreshing}
            className="h-10 w-10 rounded-lg text-muted-foreground hover:bg-muted/70 hover:text-foreground"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Opções de Atualização</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={handleLocalRefresh} className="cursor-pointer">
            <RotateCcw className="mr-2 h-4 w-4" />
            <span>Atualizar Cache Local</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={handleHardRefresh} className="cursor-pointer">
            <RefreshCw className="mr-2 h-4 w-4" />
            <span>Recarregar Minha Página</span>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem 
            onClick={handleGlobalRefresh} 
            className="cursor-pointer text-amber-600 dark:text-amber-400 focus:text-amber-600"
          >
            <Globe className="mr-2 h-4 w-4" />
            <span className="font-semibold">Refresh Global (Todos)</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
