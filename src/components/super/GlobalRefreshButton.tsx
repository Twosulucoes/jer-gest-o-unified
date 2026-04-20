import { useMutation } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { dispatchGlobalRefresh } from "@/lib/systemRefresh";

type GlobalRefreshButtonProps = {
  className?: string;
  label?: string;
};

export default function GlobalRefreshButton({ className, label = "Refresh global" }: GlobalRefreshButtonProps) {
  const refreshAllMutation = useMutation({
    mutationFn: dispatchGlobalRefresh,
    onSuccess: () => {
      toast({ title: "Refresh global enviado", description: "Todas as máquinas conectadas irão recarregar." });
    },
    onError: (e: Error) => {
      toast({ title: "Erro ao enviar refresh", description: e.message, variant: "destructive" });
    },
  });

  const handleRefresh = () => {
    const confirmed = window.confirm("Confirma o refresh de todas as máquinas conectadas?");
    if (!confirmed) return;
    refreshAllMutation.mutate();
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleRefresh}
      disabled={refreshAllMutation.isPending}
      className={className}
    >
      <RefreshCw className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}
