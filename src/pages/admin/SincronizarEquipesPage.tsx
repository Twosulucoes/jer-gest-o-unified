import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { useStageScopedSportEventIds } from "@/hooks/useStageScopedSportEvents";
import ModuleHeader from "@/components/admin/ModuleHeader";
import SportEventPicker from "@/components/admin/competition/SportEventPicker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { RefreshCw, Eye, ShieldAlert, UserCheck, Users } from "lucide-react";
import { Link } from "react-router-dom";

const REASON_LABELS: Record<string, string> = {
  ENROLLMENT_INVALID: "Inscrição inválida",
  BLOCKING_IRREGULARITY: "Irregularidade bloqueante",
  MEMBER_INSERT_ERROR: "Erro ao inserir membro",
};

interface SkippedItem {
  sport_event_id: string;
  participant_id: string;
  reason: string;
  message?: string;
}

export default function SincronizarEquipesPage() {
  const eventId = useActiveEventId();
  const { isStageScoped, sportEventIds: stageSportEventIds } = useStageScopedSportEventIds();
  const qc = useQueryClient();
  const [sportEventId, setSportEventId] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  // Only show collective sport_events in the picker
  const { data: collectiveSportEvents = [] } = useQuery({
    queryKey: ["collective-sport-events", eventId, isStageScoped, stageSportEventIds ? Array.from(stageSportEventIds).sort().join(",") : null],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sport_events")
        .select("id, name, sports(name, is_collective)")
        .eq("event_id", eventId)
        .order("name");
      if (error) throw error;
      const collectives = (data ?? []).filter((se: any) => se.sports?.is_collective === true);
      if (isStageScoped && stageSportEventIds) {
        return collectives.filter((se: any) => stageSportEventIds.has(se.id));
      }
      return collectives;
    },
    enabled: !!eventId && (!isStageScoped || stageSportEventIds !== null),
  });

  const syncMut = useMutation({
    mutationFn: async () => {
      const params: any = { p_event_id: eventId };
      if (sportEventId) params.p_sport_event_id = sportEventId;
      const { data, error } = await supabase.rpc("rpc_sync_collective_teams", params);
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      setResult(data);
      toast({
        title: `Sincronização concluída`,
        description: `${data.teams_created} equipe(s) criada(s), ${data.members_added} membro(s) adicionado(s), ${data.skipped_count} pulado(s).`,
      });
      qc.invalidateQueries({ queryKey: ["central-teams"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const skipped: SkippedItem[] = result?.skipped_preview ?? [];

  return (
    <div className="space-y-6">
      <ModuleHeader
        route="/admin/competicao/sincronizar-equipes"
        title="Sincronizar Equipes Coletivas"
      />

      <div className="flex items-end gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium mb-1 block">Prova coletiva (opcional — vazio = todas)</label>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={sportEventId ?? ""}
            onChange={(e) => setSportEventId(e.target.value || null)}
          >
            <option value="">Todas as provas coletivas</option>
            {collectiveSportEvents.map((se: any) => (
              <option key={se.id} value={se.id}>
                {se.sports?.name} — {se.name}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={() => syncMut.mutate()} disabled={syncMut.isPending}>
          <RefreshCw className={`h-4 w-4 mr-1 ${syncMut.isPending ? "animate-spin" : ""}`} />
          {syncMut.isPending ? "Sincronizando..." : "Sincronizar Equipes"}
        </Button>
      </div>

      {result && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Equipes criadas</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{result.teams_created}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Equipes existentes</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{result.teams_existing}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Membros adicionados</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{result.members_added}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Pulados</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{result.skipped_count}</p></CardContent>
          </Card>
        </div>
      )}

      {skipped.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Atletas pulados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participante</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Detalhe</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {skipped.map((s, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-xs">{s.participant_id?.slice(0, 8)}…</TableCell>
                    <TableCell>
                      <Badge variant={s.reason === "BLOCKING_IRREGULARITY" ? "destructive" : "secondary"}>
                        {REASON_LABELS[s.reason] ?? s.reason}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{s.message ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Link to={`/admin/participantes/${s.participant_id}`}>
                          <Button variant="ghost" size="sm" title="Ver participante"><Eye className="h-3.5 w-3.5" /></Button>
                        </Link>
                        {s.reason === "BLOCKING_IRREGULARITY" && (
                          <Link to="/admin/irregularidades">
                            <Button variant="outline" size="sm" title="Irregularidades"><ShieldAlert className="h-3.5 w-3.5" /></Button>
                          </Link>
                        )}
                        <Link to={`/admin/credenciamento?participantId=${s.participant_id}`}>
                          <Button variant="outline" size="sm" title="Credenciar"><UserCheck className="h-3.5 w-3.5" /></Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
