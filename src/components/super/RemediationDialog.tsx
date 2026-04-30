import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, ShieldAlert, CheckCircle2, Loader2, RefreshCw, Layers, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type RemediationAction = 
  | "republish_results" 
  | "revalidate_credentials" 
  | "fix_orphaned_records" 
  | "reset_system_cache";

interface RemediationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: RemediationAction;
  targetId?: string;
  targetName?: string;
  onSuccess?: () => void;
}

const ACTION_CONFIG = {
  republish_results: {
    title: "Republicar Resultados",
    description: "Esta ação forçará a atualização de todos os resultados públicos vinculados a este ID. Use apenas se houver divergência entre o sistema interno e o portal público.",
    confirmText: "Republicar Agora",
    severity: "warning",
    icon: RefreshCw,
  },
  revalidate_credentials: {
    title: "Revalidar Credenciais",
    description: "Verifica e corrige o status de validade de todas as credenciais do evento. Útil caso algum participante relate bloqueio indevido.",
    confirmText: "Iniciar Revalidação",
    severity: "warning",
    icon: ShieldAlert,
  },
  fix_orphaned_records: {
    title: "Corrigir Registros Órfãos",
    description: "Ação Crítica: Tenta vincular ou remover registros que perderam a referência de integridade. Pode afetar dados históricos.",
    confirmText: "Executar Correção",
    severity: "critical",
    icon: AlertCircle,
  },
  reset_system_cache: {
    title: "Reset de Cache Global",
    description: "Força todas as máquinas (PWA e Admin) a limparem o cache local na próxima sincronização.",
    confirmText: "Confirmar Reset",
    severity: "critical",
    icon: ShieldAlert,
  }
};

export function RemediationDialog({ 
  open, 
  onOpenChange, 
  action, 
  targetId, 
  targetName,
  onSuccess 
}: RemediationDialogProps) {
  const [isPending, setIsPending] = useState(false);
  const config = ACTION_CONFIG[action];

  const handleExecute = async () => {
    setIsPending(true);
    try {
      // 1. Criar trilha de auditoria e log de remediação
      await Promise.all([
        supabase.from("audit_events").insert({
          action: `REMEDIATION_${action.toUpperCase()}`,
          table_name: "system_remediation",
          record_id: targetId || "global",
          payload: { 
            target_name: targetName,
            executed_at: new Date().toISOString(),
            context: "Super Admin Remediation UI",
            status: "executed"
          }
        }),
        supabase.from("remediation_logs").insert({
          action_key: action,
          target_id: targetId,
          target_name: targetName,
          severity: config.severity,
          status: "success",
          payload: {
            context: "Super Admin Remediation UI",
            timestamp: new Date().toISOString()
          }
        })
      ]);

      // 2. Executar lógica específica (simulada por enquanto, integrável com RPCs)
      // Exemplo de integração: await supabase.rpc('remediate_' + action, { id: targetId });
      await new Promise(resolve => setTimeout(resolve, 1500)); 

      toast.success(`${config.title} executado com sucesso.`);
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(`Falha na remediação: ${error.message}`);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
        <div className={cn(
          "px-6 py-8 text-white relative overflow-hidden",
          config.severity === "critical" ? "bg-destructive" : "bg-amber-600"
        )}>
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <DialogHeader className="relative z-10">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
              <config.icon className="h-6 w-6" />
            </div>
            <DialogTitle className="text-2xl font-bold tracking-tight">{config.title}</DialogTitle>
            <DialogDescription className="text-white/80 font-medium">
              Ação de remediação técnica de alta prioridade.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-muted/50 p-4 rounded-2xl border border-border/50">
            <p className="text-sm leading-relaxed text-foreground/90">
              {config.description}
            </p>
            {targetName && (
              <p className="text-xs font-bold mt-3 text-muted-foreground uppercase tracking-widest">
                Alvo: <span className="text-foreground">{targetName}</span>
              </p>
            )}
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
            <CheckCircle2 className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-[10px] text-blue-700/70 font-medium italic">
              Esta ação será registrada permanentemente nos logs de auditoria vinculados ao seu usuário.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="font-bold rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              variant={config.severity === "critical" ? "destructive" : "default"}
              onClick={handleExecute}
              disabled={isPending}
              className={cn(
                "font-bold rounded-xl px-8 min-w-[160px]",
                config.severity !== "critical" && "bg-amber-600 hover:bg-amber-700 text-white"
              )}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                config.confirmText
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
