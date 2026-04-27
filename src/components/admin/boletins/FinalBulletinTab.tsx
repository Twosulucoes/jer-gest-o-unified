
import { useBulletinDocuments } from "@/hooks/useBulletinDocuments";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, RefreshCw, Trophy, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function FinalBulletinTab({ eventId }: { eventId: string }) {
  const { bulletins, isLoading, generateBulletin } = useBulletinDocuments(eventId);

  const { data: readiness } = useQuery({
    queryKey: ["event-readiness", eventId],
    queryFn: async () => {
      // Check if all stages are completed
      const { data, error } = await supabase
        .from("event_stages")
        .select("status")
        .eq("event_id", eventId);
      if (error) throw error;
      
      const total = data.length;
      const completed = data.filter(s => s.status === 'completed').length;
      return { total, completed, allFinished: total > 0 && total === completed };
    },
    enabled: !!eventId,
  });

  const finalBulletins = bulletins.filter(b => b.bulletin_type === 'final');

  const handleGenerate = () => {
    generateBulletin.mutate({
      bulletinType: 'final'
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Boletim Final do Evento</CardTitle>
          <CardDescription>O boletim final consolida todos os resultados e o quadro de medalhas definitivo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={`p-4 rounded-lg border ${readiness?.allFinished ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-start gap-3">
              <Trophy className={`h-5 w-5 ${readiness?.allFinished ? 'text-green-600' : 'text-amber-600'} mt-0.5`} />
              <div>
                <p className="font-medium">Status de Prontidão</p>
                <p className="text-sm opacity-90">
                  {readiness?.allFinished 
                    ? "Todas as etapas foram concluídas. O evento está pronto para a emissão do boletim final."
                    : `Etapas concluídas: ${readiness?.completed ?? 0} de ${readiness?.total ?? 0}. O boletim final deve ser gerado preferencialmente após a conclusão de todas as etapas.`}
                </p>
              </div>
            </div>
          </div>

          <Button 
            onClick={handleGenerate} 
            disabled={generateBulletin.isPending}
            className="gap-2"
          >
            {generateBulletin.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Gerar Boletim Final Oficial
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Versões do Boletim Final</CardTitle>
          <CardDescription>Histórico de boletins finais gerados para este evento.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : finalBulletins.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              Nenhuma versão do boletim final gerada até o momento.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Versão</TableHead>
                  <TableHead>Geração</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {finalBulletins.map((b) => (
                  <TableRow key={b.id} className={!b.is_current ? "opacity-60 bg-muted/30" : ""}>
                    <TableCell className="font-medium">v{b.version}</TableCell>
                    <TableCell>
                      {format(new Date(b.generated_at), "dd/MM/yyyy HH:mm")}
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
