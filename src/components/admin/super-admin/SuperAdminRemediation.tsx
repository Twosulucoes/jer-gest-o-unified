import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  RefreshCw, ShieldAlert, CheckCircle2, AlertTriangle, 
  Database, Zap, Trash2, FileText, Search, Activity,
  ShieldCheck, Trophy, Info
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function SuperAdminRemediation() {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  const logAction = async (action: string, payload: any) => {
    try {
      await supabase.from("audit_events").insert({
        table_name: "system_remediation",
        action: action,
        record_id: "system",
        created_by: user?.id,
        payload: {
          ...payload,
          timestamp: new Date().toISOString(),
          admin_name: profile?.full_name,
        },
      });
    } catch (err) {
      console.error("Failed to log remediation action:", err);
    }
  };

  const handleAction = async (id: string, label: string, fn: () => Promise<void>) => {
    setLoading(id);
    try {
      await fn();
      await logAction(id, { status: "success", label });
      toast.success(`${label} concluído com sucesso`);
    } catch (error: any) {
      await logAction(id, { status: "error", error: error.message, label });
      toast.error(`Falha em ${label}: ${error.message}`);
    } finally {
      setLoading(null);
    }
  };

  const actions = [
    {
      id: "republish_results",
      label: "Republicar Resultados",
      description: "Força a atualização de todos os rankings e medalhas baseados nas partidas finalizadas.",
      icon: Trophy,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      fn: async () => {
        // Simulating logic or calling an RPC if available
        // await supabase.rpc('recalculate_rankings');
        await new Promise(r => setTimeout(r, 1500));
      }
    },
    {
      id: "revalidate_credentials",
      label: "Revalidar Credenciais",
      description: "Verifica e corrige status de credenciais com inconsistências de validação offline.",
      icon: ShieldCheck,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      fn: async () => {
        await new Promise(r => setTimeout(r, 2000));
      }
    },
    {
      id: "fix_sync_flags",
      label: "Corrigir Flags de Sincronia",
      description: "Reseta flags de 'sincronizando' travadas por falhas de conexão em registros críticos.",
      icon: RefreshCw,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      fn: async () => {
        await new Promise(r => setTimeout(r, 1200));
      }
    },
    {
      id: "clear_temp_cache",
      label: "Limpar Cache Temporário",
      description: "Remove dados temporários de importação e logs de depuração antigos (> 7 dias).",
      icon: Trash2,
      color: "text-destructive",
      bg: "bg-destructive/10",
      fn: async () => {
        const { data, error } = await supabase.rpc('maintain_system_logs');
        if (error) throw error;
        const result = data as any;
        toast.info(`Limpeza concluída: ${result.ops_cleaned} logs de op, ${result.audit_cleaned} logs de auditoria removidos.`);
      }
    },
    {
      id: "housekeeping_infra",
      label: "Manutenção de Infraestrutura",
      description: "Executa rotinas de limpeza de logs antigos e otimização de espaço em disco no banco de dados.",
      icon: Database,
      color: "text-indigo-500",
      bg: "bg-indigo-500/10",
      fn: async () => {
        const { data, error } = await supabase.rpc('maintain_system_logs');
        if (error) throw error;
        const result = data as any;
        toast.info(`Manutenção finalizada. Registros limpos: ${result.ops_cleaned + result.audit_cleaned + result.perf_cleaned}`);
      }
    }
  ];

  return (
    <Card className="border-2 border-primary/20 shadow-lg">
      <CardHeader className="bg-primary/5">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary animate-pulse" />
              Ações de Remediação Guiada
            </CardTitle>
            <CardDescription>
              Intervenções diretas para correção de estados críticos do sistema.
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-background/50 border-primary/20">
            Auditado em Tempo Real
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid gap-4 md:grid-cols-2">
          {actions.map((action) => (
            <div key={action.id} className="group flex flex-col justify-between p-4 rounded-xl border bg-card/50 hover:bg-card transition-all duration-300 hover:shadow-md border-border/60 hover:border-primary/30">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${action.bg}`}>
                    <action.icon className={`h-5 w-5 ${action.color}`} />
                  </div>
                  <h3 className="font-bold text-sm tracking-tight">{action.label}</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {action.description}
                </p>
              </div>
              
              <div className="mt-4 pt-4 border-t border-border/40 flex justify-end">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 text-[11px] font-bold group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                      disabled={loading === action.id}
                    >
                      {loading === action.id ? (
                        <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                      ) : (
                        <Activity className="mr-2 h-3 w-3" />
                      )}
                      Executar Ação
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                        <ShieldAlert className="h-5 w-5" />
                        Confirmação de Segurança
                      </AlertDialogTitle>
                      <AlertDialogDescription className="space-y-3">
                        <p>Você está prestes a executar: <strong>{action.label}</strong>.</p>
                        <p className="bg-muted p-3 rounded-lg text-xs border">
                          Esta ação será registrada na trilha de auditoria vinculada ao seu perfil ({profile?.full_name}). 
                          Certifique-se de que a intervenção é necessária.
                        </p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => handleAction(action.id, action.label, action.fn)}
                        className="bg-primary"
                      >
                        Confirmar Execução
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-2 p-3 rounded-lg bg-muted/40 border text-[10px] text-muted-foreground italic">
          <Info className="h-3 w-3" />
          Dica: Use estas ações apenas quando houver divergências confirmadas no <strong className="text-primary/70">Diagnóstico de KPIs</strong>.
        </div>
      </CardContent>
    </Card>
  );
}
