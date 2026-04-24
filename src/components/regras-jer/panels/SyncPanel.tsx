import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FONTE_DE_VERDADE_JER2026 } from "@/regras/jer2026";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Sparkles, Trophy, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  eventId: string | undefined;
}

export function SyncPanel({ eventId }: Props) {
  const fonte = FONTE_DE_VERDADE_JER2026;
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState("");

  const { data: diff } = useQuery({
    queryKey: ["rules-diff", eventId, fonte.versao],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_diff_rules_vs_truth", {
        p_event_id: eventId!,
        p_payload: fonte as any,
      });
      if (error) throw error;
      return data as any;
    },
  });

  const sync = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("rpc_sync_rules_from_truth", {
        p_event_id: eventId!,
        p_payload: fonte as any,
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (res) => {
      toast.success(
        `Regras aplicadas: ${res.sport_events} provas, ${res.rules} regras técnicas, ${res.aliases} aliases.`,
      );
      queryClient.invalidateQueries({ queryKey: ["rules-diff"] });
      setConfirm("");
    },
    onError: (e: any) => toast.error("Falha ao sincronizar: " + e.message),
  });

  if (!eventId) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Selecione um evento</AlertTitle>
        <AlertDescription>Escolha um evento ativo para usar esta funcionalidade.</AlertDescription>
      </Alert>
    );
  }

  const provasEstimadas = fonte.modalidades.reduce(
    (s, m) => s + m.provas.length * m.categorias.length * m.naipes.length,
    0,
  );

  return (
    <div className="space-y-4 max-w-3xl">
      <Alert variant="default" className="border-blue-200 bg-blue-50/50">
        <Sparkles className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-800">Sincronização Inteligente</AlertTitle>
        <AlertDescription className="text-blue-700">
          Esta ação atualiza categorias, provas e regras técnicas sem apagar inscrições existentes. Provas que não
          constam mais no regulamento serão <strong>desativadas</strong>.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" /> O que será aplicado
          </CardTitle>
          <CardDescription>Regulamento JER {fonte.regras_gerais.evento.ano} v{fonte.versao}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Modalidades" value={fonte.modalidades.length} />
          <Row label="Categorias etárias" value={fonte.categorias.length} />
          <Row
            label="Provas estimadas (modalidade × prova × categoria × naipe)"
            value={provasEstimadas}
          />
          <Row label="Aliases de modalidades" value={Object.keys(fonte.aliases_modalidades).length} />
          <Separator className="my-2" />
          <Row
            label="Atualmente no banco"
            value={diff ? `${diff.db.sport_events} provas, ${diff.db.rules} regras` : "—"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Confirmar sincronização</CardTitle>
          <CardDescription>
            Digite <span className="font-mono font-semibold">SINCRONIZAR</span> para liberar o botão.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value.toUpperCase())}
            placeholder="SINCRONIZAR"
          />
          <Button
            onClick={() => sync.mutate()}
            disabled={confirm !== "SINCRONIZAR" || sync.isPending}
            className="w-full"
          >
            {sync.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
            Aplicar regulamento JER 2026
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
