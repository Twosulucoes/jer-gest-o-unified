
import { useState } from "react";
import { useBulletinDocuments } from "@/hooks/useBulletinDocuments";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Download, RefreshCw, FileText, Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function DailyBulletinsTab({ eventId }: { eventId: string }) {
  const { bulletins, isLoading, generateBulletin } = useBulletinDocuments(eventId);
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [referenceDate, setReferenceDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  const { data: stages = [] } = useQuery({
    queryKey: ["event-stages", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_stages")
        .select("id, name")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  const dailyBulletins = bulletins.filter(b => b.bulletin_type === 'daily');

  const handleGenerate = () => {
    if (!selectedStageId) return;
    generateBulletin.mutate({
      stageId: selectedStageId,
      referenceDate,
      bulletinType: 'daily'
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Geração Manual de Boletim do Dia</CardTitle>
          <CardDescription>Selecione a etapa e a data para gerar ou regenerar o boletim.</CardDescription>
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
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
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
              disabled={!selectedStageId || generateBulletin.isPending}
              className="gap-2"
            >
              {generateBulletin.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Gerar Boletim
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3 italic">
            * O boletim só incluirá resultados com status <strong>"publicado"</strong>. 
            Vá até a Central de Resultados para validar e publicar partidas.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Boletins Gerados</CardTitle>
          <CardDescription>Lista de boletins diários para este evento.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : dailyBulletins.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              Nenhum boletim gerado até o momento.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Data Ref.</TableHead>
                  <TableHead>Versão</TableHead>
                  <TableHead>Geração</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyBulletins.map((b) => (
                  <TableRow key={b.id} className={!b.is_current ? "opacity-60 bg-muted/30" : ""}>
                    <TableCell className="font-medium">
                      {stages.find(s => s.id === b.stage_id)?.name || "—"}
                    </TableCell>
                    <TableCell>
                      {b.reference_date ? format(new Date(b.reference_date + "T12:00:00"), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell>v{b.version}</TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(b.generated_at), "dd/MM/yy HH:mm")}
                      <br />
                      <span className="text-muted-foreground">
                        {b.generation_trigger === 'automatic_after_publish' ? 'Automática' : 'Manual'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {b.is_current ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                          Atual
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                          Histórico
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <a href={b.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                          <Download className="h-4 w-4" />
                          PDF
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
