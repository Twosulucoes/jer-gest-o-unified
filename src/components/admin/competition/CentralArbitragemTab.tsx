import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, ListChecks, Radio } from "lucide-react";
import { EscalaLoteDialog, formatMatchLabel } from "@/components/admin/arbitragem/EscalaLoteDialog";

interface Props {
  eventId: string;
  sportEventId: string;
  stageId?: string | null;
}

export default function CentralArbitragemTab({ eventId, sportEventId, stageId }: Props) {
  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(new Set());
  const [escalaOpen, setEscalaOpen] = useState(false);

  const { data: matches = [], isLoading, refetch } = useQuery({
    queryKey: ["central-arbitragem-matches", eventId, sportEventId, stageId],
    queryFn: async () => {
      let q = supabase
        .from("competition_matches")
        .select(`
          id, match_number, match_date, start_time, status, event_stage_id,
          venues(name),
          competition_phases(name),
          sport_events(
            id, gender,
            sports(id, name),
            categories(name)
          ),
          match_user_assignments(id, user_id, role)
        `)
        .eq("event_id", eventId)
        .eq("sport_event_id", sportEventId)
        .order("match_date", { ascending: true, nullsFirst: false })
        .order("start_time", { ascending: true, nullsFirst: false })
        .order("match_number", { ascending: true });
      if (stageId) q = q.eq("event_stage_id", stageId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const selectedMatches = useMemo(() => {
    return (matches as any[])
      .filter((m) => selectedMatchIds.has(m.id))
      .map((m) => ({ id: m.id, label: formatMatchLabel(m) }));
  }, [matches, selectedMatchIds]);

  const toggleMatch = (id: string, checked: boolean) => {
    setSelectedMatchIds((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const base = stageId ? `/admin/etapa/${stageId}/competicao` : "/admin/competicao";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Arbitragem e Ao Vivo</h3>
          <p className="text-sm text-muted-foreground">Selecione partidas agendadas, aplique a escala e libere o acesso no JER Ao Vivo.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`${base}/arbitragem?tab=lote`}>
              <ListChecks className="mr-1 h-4 w-4" /> Escalas por etapa
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/aovivo">
              <Radio className="mr-1 h-4 w-4" /> Ao Vivo
            </Link>
          </Button>
          <Button size="sm" onClick={() => setEscalaOpen(true)} disabled={selectedMatchIds.size === 0}>
            Escalar selecionadas ({selectedMatchIds.size})
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando partidas...</p>
          ) : matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma partida criada para esta prova. Monte as disputas antes de escalar a arbitragem.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Partida</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Escala</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(matches as any[]).map((m) => {
                  const assignments = m.match_user_assignments ?? [];
                  return (
                    <TableRow key={m.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedMatchIds.has(m.id)}
                          onCheckedChange={(v) => toggleMatch(m.id, v === true)}
                          aria-label={`Selecionar partida ${m.match_number ?? "sem número"}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">#{m.match_number ?? "—"} · {m.competition_phases?.name ?? "Fase"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {m.match_date ? new Date(`${m.match_date}T00:00:00`).toLocaleDateString("pt-BR") : "Sem data"}
                        {m.start_time ? ` · ${m.start_time.slice(0, 5)}` : ""}
                      </TableCell>
                      <TableCell className="text-sm">{m.venues?.name ?? "Sem local"}</TableCell>
                      <TableCell>
                        <Badge variant={assignments.length > 0 ? "default" : "outline"}>
                          {assignments.length > 0 ? `${assignments.length} designação(ões)` : "Sem escala"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`${base}/partida/${m.id}`}><ExternalLink className="h-4 w-4" /></Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EscalaLoteDialog
        open={escalaOpen}
        onOpenChange={setEscalaOpen}
        matches={selectedMatches}
        onSuccess={() => {
          setSelectedMatchIds(new Set());
          refetch();
        }}
      />
    </div>
  );
}