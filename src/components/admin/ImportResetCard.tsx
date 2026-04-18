import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Trash2, Loader2, ShieldAlert } from "lucide-react";

interface Props {
  eventId: string | null;
  stageId?: string | null;
  stageName?: string | null;
  onDone?: () => void;
}

interface ResetResult {
  ok: boolean;
  blocked?: boolean;
  blocks?: Array<Record<string, unknown>>;
  deleted?: Record<string, number>;
  message?: string;
}

export default function ImportResetCard({ eventId, stageId, stageName, onDone }: Props) {
  const [force, setForce] = useState(false);
  const [scopeStage, setScopeStage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<ResetResult | null>(null);

  async function handleReset() {
    if (!eventId) {
      toast.error("Selecione um evento ativo primeiro");
      return;
    }
    setLoading(true);
    setLastResult(null);
    try {
      const { data, error } = await supabase.rpc("rpc_reset_import_data" as never, {
        p_event_id: eventId,
        p_stage_id: scopeStage && stageId ? stageId : null,
        p_force: force,
      } as never);
      if (error) throw error;
      const result = data as unknown as ResetResult;
      setLastResult(result);
      if (result.blocked) {
        toast.warning("Reset bloqueado por dados operacionais. Ative 'Forçar' para apagar mesmo assim.");
      } else if (result.ok) {
        const total = Object.values(result.deleted ?? {}).reduce((a, b) => a + (b ?? 0), 0);
        toast.success(`Reset concluído. ${total} registros apagados.`);
        onDone?.();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Falha no reset: " + msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <ShieldAlert className="h-5 w-5" />
          Zona de risco — Resetar dados importados
        </CardTitle>
        <CardDescription>
          Apaga todos os dados criados pela importação SIGECOM neste evento{scopeStage && stageName ? ` (etapa: ${stageName})` : ""},
          permitindo reimportar do zero. Pessoas e instituições órfãs também são removidas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {stageId && (
          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Limitar à etapa selecionada</Label>
              <p className="text-xs text-muted-foreground">
                Quando ativo, apaga apenas dados marcados com a etiqueta da etapa <strong>{stageName ?? stageId}</strong>.
              </p>
            </div>
            <Switch checked={scopeStage} onCheckedChange={setScopeStage} disabled={loading} />
          </div>
        )}

        <div className="flex items-center justify-between rounded-md border border-destructive/40 p-3">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium text-destructive">Forçar (cascata operacional)</Label>
            <p className="text-xs text-muted-foreground">
              Apaga também credenciais, partidas, scans, consumos, ocupações e embarques. Use com extremo cuidado.
            </p>
          </div>
          <Switch checked={force} onCheckedChange={setForce} disabled={loading} />
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={!eventId || loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Resetar dados da importação
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar reset</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação é <strong>irreversível</strong>. Serão apagados:
                <ul className="list-disc ml-5 mt-2 space-y-1">
                  <li>Inscrições em provas</li>
                  <li>Participantes</li>
                  <li>Delegações {scopeStage ? "da etapa" : "do evento"}</li>
                  <li>Provas, categorias e modalidades sem uso</li>
                  <li>Instituições e pessoas órfãs</li>
                  <li>Logs e pendências de importação</li>
                  {force && (
                    <li className="text-destructive font-medium">
                      + Credenciais, partidas, scans, consumos, alojamento e transporte
                    </li>
                  )}
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleReset} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Sim, apagar tudo
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {lastResult && (
          <div className="rounded-md border p-3 text-sm space-y-2">
            <div className="font-medium">Resultado do último reset</div>
            {lastResult.blocked ? (
              <div className="space-y-1">
                <Badge variant="destructive">Bloqueado</Badge>
                <p className="text-xs text-muted-foreground">{lastResult.message}</p>
                <ul className="text-xs ml-4 list-disc">
                  {(lastResult.blocks ?? []).map((b, i) => (
                    <li key={i}>{JSON.stringify(b)}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1 text-xs">
                {Object.entries(lastResult.deleted ?? {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-mono">{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
