import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Swords, RefreshCw, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  eventId: string;
  sportEventId: string;
  isCollective: boolean;
  onChanged: () => void;
}

export default function CentralMatchesTab({ eventId, sportEventId, isCollective, onChanged }: Props) {
  const qc = useQueryClient();
  const [showGenDialog, setShowGenDialog] = useState(false);
  const [heatSize, setHeatSize] = useState(8);

  const { data: phases = [] } = useQuery({
    queryKey: ["central-phases-for-gen", eventId, sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_phases")
        .select("id, name")
        .eq("event_id", eventId)
        .eq("sport_event_id", sportEventId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const [selectedPhaseId, setSelectedPhaseId] = useState<string>("");

  const { data: matches = [], isLoading } = useQuery({
    queryKey: ["central-matches", eventId, sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_matches")
        .select(`
          id, match_number, match_date, start_time, status,
          competition_phases(name),
          competition_groups(name),
          venues(name),
          competition_match_entries(
            id, side, team_id, participant_sport_event_id,
            teams(name),
            participant_sport_events(participant_id, participants(person_id, people(full_name)))
          )
        `)
        .eq("event_id", eventId)
        .eq("sport_event_id", sportEventId)
        .order("match_number");
      if (error) throw error;
      return data;
    },
  });

  const generateMut = useMutation({
    mutationFn: async () => {
      const phaseId = selectedPhaseId || phases[0]?.id;
      if (!phaseId) throw new Error("Crie uma fase antes de gerar partidas");

      if (isCollective) {
        const { data, error } = await supabase.rpc("rpc_generate_matches_collective", {
          p_event_id: eventId,
          p_sport_event_id: sportEventId,
          p_phase_id: phaseId,
        });
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase.rpc("rpc_generate_matches_individual", {
          p_event_id: eventId,
          p_sport_event_id: sportEventId,
          p_phase_id: phaseId,
          p_heat_size: heatSize,
        });
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data: any) => {
      toast({ title: `${data.matches_created} partida(s) gerada(s)` });
      setShowGenDialog(false);
      qc.invalidateQueries({ queryKey: ["central-matches"] });
      onChanged();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  function getEntryLabel(entry: any): string {
    if (entry.teams?.name) return entry.teams.name;
    const pse = entry.participant_sport_events as any;
    return pse?.participants?.people?.full_name ?? "—";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Partidas</h3>
        <Button
          size="sm"
          onClick={() => {
            setSelectedPhaseId(phases[0]?.id ?? "");
            setShowGenDialog(true);
          }}
          disabled={phases.length === 0}
        >
          <Swords className="h-4 w-4 mr-1" />
          {matches.length > 0 ? "Regenerar Partidas" : "Gerar Partidas"}
        </Button>
      </div>

      {phases.length === 0 && (
        <p className="text-sm text-muted-foreground">Crie uma fase na aba "Estrutura" antes de gerar partidas.</p>
      )}

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma partida gerada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Fase</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Lado A</TableHead>
                  <TableHead>Lado B</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map((m: any) => {
                  const entries = m.competition_match_entries ?? [];
                  const sideA = entries.find((e: any) => e.side === "home" || e.side === "participant");
                  const sideB = entries.find((e: any) => e.side === "away");
                  const individualsInMatch = !isCollective ? entries : [];

                  return (
                    <TableRow key={m.id}>
                      <TableCell>{m.match_number ?? "—"}</TableCell>
                      <TableCell>{(m.competition_phases as any)?.name ?? "—"}</TableCell>
                      <TableCell>{(m.competition_groups as any)?.name ?? "—"}</TableCell>
                      <TableCell>
                        {isCollective
                          ? (sideA ? getEntryLabel(sideA) : "—")
                          : individualsInMatch.length > 0
                            ? `${individualsInMatch.length} atletas`
                            : "—"
                        }
                      </TableCell>
                      <TableCell>
                        {isCollective ? (sideB ? getEntryLabel(sideB) : "—") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={m.status === "finished" ? "default" : "outline"}>
                          {m.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Link to={`/admin/competicao/partida/${m.id}`}>
                          <Button variant="ghost" size="icon">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Generate Matches Dialog */}
      <Dialog open={showGenDialog} onOpenChange={setShowGenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isCollective ? "Gerar Partidas (Round Robin)" : "Gerar Baterias"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Fase</label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm mt-1"
                value={selectedPhaseId}
                onChange={(e) => setSelectedPhaseId(e.target.value)}
              >
                {phases.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            {!isCollective && (
              <div>
                <label className="text-sm font-medium">Atletas por bateria</label>
                <Input
                  type="number"
                  min={2}
                  max={50}
                  value={heatSize}
                  onChange={(e) => setHeatSize(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Partidas com status "scheduled" serão removidas e recriadas. Partidas já iniciadas/finalizadas não serão afetadas.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => generateMut.mutate()} disabled={generateMut.isPending}>
              <RefreshCw className="h-4 w-4 mr-1" />
              {generateMut.isPending ? "Gerando..." : "Gerar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
