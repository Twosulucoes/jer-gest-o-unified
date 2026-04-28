
import { useBulletinDocuments } from "@/hooks/useBulletinDocuments";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, RefreshCw, Trophy, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

export default function FinalBulletinTab({ eventId }: { eventId: string }) {
  const { bulletins, isLoading, generateBulletin } = useBulletinDocuments(eventId);
  const [selectedStageId, setSelectedStageId] = useState<string>("");

  const { data: stages = [] } = useQuery({
    queryKey: ["event-stages-final", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_stages")
        .select("id, name, stage_code, status")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  const { data: pendingStatus } = useQuery({
    queryKey: ["pending-homologation-final", eventId, selectedStageId],
    queryFn: async () => {
      if (!selectedStageId) return null;
      
      const { data } = await supabase
        .from("competition_matches")
        .select("id, competition_match_results(result_status)")
        .eq("event_id", eventId)
        .eq("event_stage_id", selectedStageId);
      
      const pending = (data || []).filter(m => {
        const results = m.competition_match_results as any[] || [];
        if (results.length === 0) return true;
        return results.some(r => r.result_status !== 'publicado' && r.result_status !== 'resultado_validado');
      });
      
      return {
        count: pending.length,
        isReady: pending.length === 0
      };
    },
    enabled: !!selectedStageId
  });

  const finalBulletins = bulletins.filter(b => b.bulletin_type === 'final');

  const handleGenerate = () => {
    if (!eventId || !selectedStageId) return;

    if (!pendingStatus?.isReady) {
      toast.warning("Atenção: Existem partidas não homologadas", {
        description: "O boletim final será travado pelo sistema se houver pendências técnicas."
      });
    }

    generateBulletin.mutate({
      bulletinType: 'final',
      stageId: selectedStageId
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Boletim Final Consolidado</CardTitle>
          <CardDescription>O boletim final gera o quadro de medalhas oficial da etapa selecionada.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Etapa</label>
              <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a etapa para o boletim final" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name} ({s.stage_code || "—"})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleGenerate} 
              disabled={!selectedStageId || !pendingStatus?.isReady || generateBulletin.isPending}
              className="gap-2"
            >
              {generateBulletin.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
              Publicar Boletim Final Oficial
            </Button>
          </div>

          {selectedStageId && pendingStatus && (
            <div className={`p-4 rounded-lg border flex items-start gap-3 ${pendingStatus.isReady ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
              {pendingStatus.isReady ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-800">Pronto para Finalização</p>
                    <p className="text-sm text-green-700">Todas as partidas da etapa estão homologadas. O quadro de medalhas será gerado com precisão total.</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800">Bloqueado por Pendências</p>
                    <p className="text-sm text-amber-700">Existem {pendingStatus.count} partidas pendentes de homologação. O boletim final oficial não pode ser publicado até que todos os resultados sejam validados.</p>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Boletins Finais</CardTitle>
          <CardDescription>Lista de boletins finais publicados com numeração SIGLA-FIN.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : finalBulletins.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              Nenhum boletim final oficial publicado até o momento.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Data de Publicação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {finalBulletins.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono">{b.summary?.bulletin_code || b.file_name.split('_')[0]}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {stages.find(s => s.id === b.stage_id)?.name || "—"}
                    </TableCell>
                    <TableCell>
                      {format(new Date(b.generated_at), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <a href={b.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                          <Download className="h-4 w-4" />
                          PDF Oficial
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
