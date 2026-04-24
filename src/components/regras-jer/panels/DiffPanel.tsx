import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FONTE_DE_VERDADE_JER2026 } from "@/regras/jer2026";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, RefreshCw, BookOpen, Database } from "lucide-react";

interface Props {
  eventId: string | undefined;
}

export function DiffPanel({ eventId }: Props) {
  const fonte = FONTE_DE_VERDADE_JER2026;

  const { data, isLoading, refetch, isFetching } = useQuery({
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

  if (!eventId) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Selecione um evento</AlertTitle>
        <AlertDescription>Escolha um evento ativo para usar esta funcionalidade.</AlertDescription>
      </Alert>
    );
  }

  if (isLoading) return <p className="text-muted-foreground">Comparando…</p>;
  if (!data) return null;

  const sincronizado = data.sincronizado;
  const onlyInTruth: string[] = data.modalidades_apenas_no_regulamento ?? [];
  const onlyInDb: string[] = data.modalidades_apenas_no_banco ?? [];
  const discrepancies: any[] = data.parameter_discrepancies ?? [];

  return (
    <div className="space-y-4">
      <Alert variant={sincronizado ? "default" : "destructive"}>
        {sincronizado ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
        <AlertTitle>
          {sincronizado ? "Banco sincronizado com o regulamento" : "Divergências detectadas"}
        </AlertTitle>
        <AlertDescription>
          {sincronizado
            ? "Todas as modalidades e parâmetros do regulamento estão refletidos no banco."
            : "Existem diferenças entre o regulamento (.ts) e o banco de dados. Sincronize para corrigir."}
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> Regulamento (.ts)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div>
              Versão: <Badge variant="outline">{data.truth.versao}</Badge>
            </div>
            <div>
              Modalidades: <strong>{data.truth.modalidades}</strong>
            </div>
            <div>
              Categorias: <strong>{data.truth.categorias}</strong>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4" /> Banco
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div>
              Modalidades: <strong>{data.db.modalidades}</strong>
            </div>
            <div>
              Provas (sport_events): <strong>{data.db.sport_events}</strong>
            </div>
            <div>
              Categorias: <strong>{data.db.categorias}</strong>
            </div>
            <div>
              Regras técnicas: <strong>{data.db.rules}</strong>
            </div>
          </CardContent>
        </Card>
      </div>

      {(onlyInTruth.length > 0 || onlyInDb.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-amber-600">
                Faltando no banco ({onlyInTruth.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1">
              {onlyInTruth.length === 0 && <span className="text-muted-foreground text-sm">—</span>}
              {onlyInTruth.map((s) => (
                <Badge key={s} variant="outline">
                  {s}
                </Badge>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-rose-600">
                Sobrando no banco ({onlyInDb.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1">
              {onlyInDb.length === 0 && <span className="text-muted-foreground text-sm">—</span>}
              {onlyInDb.map((s) => (
                <Badge key={s} variant="destructive">
                  {s}
                </Badge>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {discrepancies.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-amber-600 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Discrepâncias de parâmetros ({discrepancies.length})
            </CardTitle>
            <CardDescription>Valores configurados no banco diferem da fonte de verdade.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr className="text-left">
                    <th className="p-2">Slug</th>
                    <th className="p-2 text-rose-600 text-center">Banco</th>
                    <th className="p-2 text-emerald-600 text-center">Regulamento</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {discrepancies.map((d, i) => (
                    <tr key={i}>
                      <td className="p-2 font-mono">{d.slug}</td>
                      <td className="p-2 text-center text-rose-600 font-medium">
                        {d.db_min}–{d.db_max}
                      </td>
                      <td className="p-2 text-center text-emerald-600 font-medium">
                        {d.truth_min}–{d.truth_max}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
        <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
        Recomparar
      </Button>
    </div>
  );
}
