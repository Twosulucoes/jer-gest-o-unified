
import { useState } from "react";
import { useBulletinDocuments } from "@/hooks/useBulletinDocuments";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Download, RefreshCw, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function DailyBulletinsTab({ eventId }: { eventId: string }) {
  const { bulletins, isLoading, generateBulletin } = useBulletinDocuments(eventId);
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [referenceDate, setReferenceDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  const { data: stages = [] } = useQuery({
    queryKey: ["event-stages", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_stages")
        .select("id, name, stage_code")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  const { data: pendingStatus, refetch: refetchPending } = useQuery({
    queryKey: ["pending-homologation", eventId, selectedStageId, referenceDate],
    queryFn: async () => {
      if (!selectedStageId || !referenceDate) return null;
      
      const { data } = await supabase
        .from("competition_matches")
        .select("id, competition_match_results(result_status)")
        .eq("event_id", eventId)
        .eq("event_stage_id", selectedStageId)
        .eq("match_date", referenceDate);
      
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
    enabled: !!selectedStageId && !!referenceDate
  });

  const dailyBulletins = bulletins.filter(b => b.bulletin_type === 'daily');

  const handleGenerate = () => {
    if (!eventId || !selectedStageId || !referenceDate) return;

    generateBulletin.mutate({
      stageId: selectedStageId,
      referenceDate,
      bulletinType: 'daily'
    }, {
      onSuccess: () => refetchPending()
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Publicação de Boletim Diário Oficial</CardTitle>
          <CardDescription>
            Atribui numeração automática e gera PDF institucional. Requer homologação total das partidas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Etapa</label>
              <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a etapa" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name} ({s.stage_code || "—"})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Data de Referência</label>
              <Input 
                type="date" 
                value={referenceDate} 
                onChange={(e) => setReferenceDate(e.target.value)} 
              />
            </div>
            <Button 
              onClick={handleGenerate} 
              disabled={!selectedStageId || !pendingStatus?.isReady || generateBulletin.isPending}
              className="gap-2"
            >
              {generateBulletin.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Publicar Boletim Oficial
            </Button>
          </div>
          
          {selectedStageId && pendingStatus && (
            <div className={`mt-4 p-3 rounded-md border flex items-center gap-3 ${pendingStatus.isReady ? 'bg-green-50 border-green-100 text-green-800' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
              {pendingStatus.isReady ? (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm font-medium">Todas as partidas do dia estão homologadas e prontas para publicação.</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5" />
                  <span className="text-sm font-medium">Existem {pendingStatus.count} partidas pendentes de homologação neste escopo. O botão de publicação ficará travado.</span>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Boletins Oficiais Publicados</CardTitle>
          <CardDescription>Lista de boletins diários com numeração automática.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : dailyBulletins.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              Nenhum boletim oficial publicado até o momento.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Data Ref.</TableHead>
                  <TableHead>Publicação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyBulletins.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">{b.summary?.bulletin_code || b.file_name.split('_')[0]}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {stages.find(s => s.id === b.stage_id)?.name || "—"}
                    </TableCell>
                    <TableCell>
                      {b.reference_date ? format(new Date(b.reference_date + "T12:00:00"), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(b.generated_at), "dd/MM/yy HH:mm")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <a href={b.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                          <Download className="h-4 w-4" />
                          PDF Profissional
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
