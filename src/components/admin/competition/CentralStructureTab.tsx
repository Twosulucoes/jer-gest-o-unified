import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Layers } from "lucide-react";

interface Props {
  eventId: string;
  sportEventId: string;
  onChanged: () => void;
}

export default function CentralStructureTab({ eventId, sportEventId, onChanged }: Props) {
  const qc = useQueryClient();
  const [showCreatePhase, setShowCreatePhase] = useState(false);
  const [phaseName, setPhaseName] = useState("Fase 1");
  const [showGenGroups, setShowGenGroups] = useState(false);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [groupCount, setGroupCount] = useState(2);

  const { data: phases = [], isLoading } = useQuery({
    queryKey: ["competition-phases-central", eventId, sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_phases")
        .select("*")
        .eq("event_id", eventId)
        .eq("sport_event_id", sportEventId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["competition-groups-central", eventId, sportEventId],
    queryFn: async () => {
      const phaseIds = phases.map((p) => p.id);
      if (phaseIds.length === 0) return [];
      const { data, error } = await supabase
        .from("competition_groups")
        .select("*")
        .eq("event_id", eventId)
        .in("phase_id", phaseIds)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: phases.length > 0,
  });

  const createPhaseMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("competition_phases").insert({
        event_id: eventId,
        sport_event_id: sportEventId,
        name: phaseName,
        sort_order: phases.length + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Fase criada" });
      setShowCreatePhase(false);
      qc.invalidateQueries({ queryKey: ["competition-phases-central"] });
      onChanged();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const generateGroupsMut = useMutation({
    mutationFn: async () => {
      if (!selectedPhaseId) throw new Error("Selecione uma fase");
      const { data, error } = await supabase.rpc("rpc_generate_groups", {
        p_event_id: eventId,
        p_sport_event_id: sportEventId,
        p_phase_id: selectedPhaseId,
        p_group_count: groupCount,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast({ title: `${data.groups_created} grupo(s) criado(s)` });
      setShowGenGroups(false);
      qc.invalidateQueries({ queryKey: ["competition-groups-central"] });
      onChanged();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Fases & Grupos</h3>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setShowCreatePhase(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nova Fase
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={phases.length === 0}
            onClick={() => {
              setSelectedPhaseId(phases[0]?.id ?? null);
              setShowGenGroups(true);
            }}
          >
            <Layers className="h-4 w-4 mr-1" /> Gerar Grupos
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : phases.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Nenhuma fase criada. Clique em "Nova Fase" para começar.
          </CardContent>
        </Card>
      ) : (
        phases.map((phase) => {
          const phaseGroups = groups.filter((g) => g.phase_id === phase.id);
          return (
            <Card key={phase.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {phase.name}
                  <span className="text-xs text-muted-foreground font-normal">
                    ({phase.phase_type} — {phase.status})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {phaseGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum grupo nesta fase.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Grupo</TableHead>
                        <TableHead>Ordem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {phaseGroups.map((g) => (
                        <TableRow key={g.id}>
                          <TableCell>{g.name}</TableCell>
                          <TableCell>{g.sort_order}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Create Phase Dialog */}
      <Dialog open={showCreatePhase} onOpenChange={setShowCreatePhase}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Fase</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Nome da fase"
              value={phaseName}
              onChange={(e) => setPhaseName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => createPhaseMut.mutate()} disabled={createPhaseMut.isPending}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Groups Dialog */}
      <Dialog open={showGenGroups} onOpenChange={setShowGenGroups}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar Grupos</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm font-medium">Fase</label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={selectedPhaseId ?? ""}
              onChange={(e) => setSelectedPhaseId(e.target.value)}
            >
              {phases.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <label className="text-sm font-medium">Quantidade de grupos</label>
            <Input
              type="number"
              min={1}
              max={16}
              value={groupCount}
              onChange={(e) => setGroupCount(Number(e.target.value))}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => generateGroupsMut.mutate()} disabled={generateGroupsMut.isPending}>
              Gerar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
