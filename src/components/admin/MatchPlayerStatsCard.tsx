import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BarChart3, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MatchConfig, PlayerStatConfig } from "./MatchConfigEditor";

interface MatchPlayerStatsCardProps {
  matchId: string;
  entries: { id: string; team_id: string | null; label: string }[];
  matchConfig: MatchConfig;
  canWrite: boolean;
}

interface LineupRow {
  id: string;
  match_entry_id: string;
  participant_id: string;
  team_member_id: string;
  jersey_number: number | null;
  status: string;
  is_starter: boolean;
  participant_name?: string;
}

export default function MatchPlayerStatsCard({
  matchId,
  entries,
  matchConfig,
  canWrite,
}: MatchPlayerStatsCardProps) {
  const qc = useQueryClient();
  const playerStats = (matchConfig.player_stats ?? []).filter((s) => s.key && s.label && s.visible !== false);

  // Fetch lineups for all entries
  const teamEntryIds = entries.filter((e) => e.team_id).map((e) => e.id);

  const { data: lineups = [] } = useQuery({
    queryKey: ["match_lineups_for_stats", matchId],
    queryFn: async () => {
      if (!teamEntryIds.length) return [];
      const { data, error } = await supabase
        .from("match_lineups")
        .select("id, match_entry_id, participant_id, team_member_id, jersey_number, status, is_starter")
        .eq("match_id", matchId)
        .in("status", ["active", "bench"]);
      if (error) throw error;
      return data;
    },
    enabled: teamEntryIds.length > 0,
  });

  // Fetch participant names
  const participantIds = [...new Set(lineups.map((l) => l.participant_id))];
  const { data: participants = [] } = useQuery({
    queryKey: ["participants_stats", participantIds.length, participantIds.slice(0, 3).join(",")],
    queryFn: async () => {
      if (!participantIds.length) return [];
      const { data, error } = await supabase
        .from("participants")
        .select("id, person_id")
        .in("id", participantIds);
      if (error) throw error;
      return data;
    },
    enabled: participantIds.length > 0,
  });

  const personIds = [...new Set(participants.map((p) => p.person_id))];
  const { data: people = [] } = useQuery({
    queryKey: ["people_stats", personIds.length, personIds.slice(0, 3).join(",")],
    queryFn: async () => {
      if (!personIds.length) return [];
      const { data, error } = await supabase
        .from("people")
        .select("id, full_name")
        .in("id", personIds);
      if (error) throw error;
      return data;
    },
    enabled: personIds.length > 0,
  });

  const participantMap = new Map(participants.map((p) => [p.id, p]));
  const peopleMap = new Map(people.map((p) => [p.id, p]));

  const getPlayerName = (participantId: string) => {
    const p = participantMap.get(participantId);
    if (!p) return "—";
    return peopleMap.get(p.person_id)?.full_name ?? "—";
  };

  // Fetch existing stats
  const { data: existingStats = [] } = useQuery({
    queryKey: ["match_player_stats", matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_player_stats" as any)
        .select("*")
        .eq("match_id", matchId);
      if (error) throw error;
      return data as any[];
    },
  });

  // Local state for editing: keyed by `lineupId_statKey`
  const [values, setValues] = useState<Record<string, string>>({});
  const [initialized, setInitialized] = useState(false);

  // Initialize from existing stats
  if (!initialized && existingStats.length >= 0 && lineups.length > 0) {
    const init: Record<string, string> = {};
    existingStats.forEach((s: any) => {
      init[`${s.match_lineup_id}_${s.stat_key}`] = s.stat_value?.toString() ?? "0";
    });
    setValues(init);
    setInitialized(true);
  }

  const getValue = (lineupId: string, statKey: string) => {
    return values[`${lineupId}_${statKey}`] ?? "0";
  };

  const setValue = (lineupId: string, statKey: string, val: string) => {
    setValues((prev) => ({ ...prev, [`${lineupId}_${statKey}`]: val }));
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const upserts: any[] = [];
      lineups.forEach((lineup) => {
        playerStats.forEach((stat) => {
          const val = parseFloat(getValue(lineup.id, stat.key)) || 0;
          upserts.push({
            match_id: matchId,
            match_lineup_id: lineup.id,
            participant_id: lineup.participant_id,
            stat_key: stat.key,
            stat_value: val,
            period: null,
          });
        });
      });

      if (!upserts.length) return;

      // Delete existing and insert fresh (simpler than complex upsert with nullable period)
      await supabase
        .from("match_player_stats" as any)
        .delete()
        .eq("match_id", matchId)
        .is("period", null);

      const { error } = await supabase
        .from("match_player_stats" as any)
        .insert(upserts);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["match_player_stats", matchId] });
      toast.success("Estatísticas salvas com sucesso");
    },
    onError: (e: Error) => toast.error("Erro ao salvar: " + e.message),
  });

  if (playerStats.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />Estatísticas individuais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma estatística configurada para esta modalidade. Configure em Modalidades → editar → Estatísticas individuais.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (lineups.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />Estatísticas individuais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Gere a escalação das equipes primeiro para lançar estatísticas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />Estatísticas individuais
        </CardTitle>
        {canWrite && (
          <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            <Save className="mr-2 h-4 w-4" />{saveMut.isPending ? "Salvando..." : "Salvar"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {entries.filter((e) => e.team_id).map((entry) => {
          const entryLineups = lineups
            .filter((l) => l.match_entry_id === entry.id)
            .sort((a, b) => {
              if (a.is_starter !== b.is_starter) return a.is_starter ? -1 : 1;
              return (a.jersey_number ?? 99) - (b.jersey_number ?? 99);
            });

          if (entryLineups.length === 0) return null;

          return (
            <div key={entry.id}>
              <h4 className="text-sm font-semibold mb-2 text-foreground">{entry.label}</h4>
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Atleta</th>
                      {playerStats.map((stat) => (
                        <th key={stat.key} className="text-center px-3 py-2 font-medium text-muted-foreground w-24">
                          {stat.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {entryLineups.map((lineup) => (
                      <tr key={lineup.id} className="border-b last:border-0">
                        <td className="px-3 py-2 font-medium whitespace-nowrap">
                          {lineup.jersey_number != null && (
                            <span className="text-muted-foreground mr-1 font-mono text-xs">#{lineup.jersey_number}</span>
                          )}
                          {getPlayerName(lineup.participant_id)}
                        </td>
                        {playerStats.map((stat) => (
                          <td key={stat.key} className="px-3 py-1.5 text-center">
                            {canWrite ? (
                              <Input
                                type="number"
                                min={0}
                                step={stat.type === "count" ? 1 : "any"}
                                value={getValue(lineup.id, stat.key)}
                                onChange={(e) => setValue(lineup.id, stat.key, e.target.value)}
                                className="h-7 w-20 text-center mx-auto text-xs"
                              />
                            ) : (
                              <span className="font-mono">{getValue(lineup.id, stat.key)}</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
