import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, RefreshCw, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const LINEUP_STATUS_OPTIONS = [
  { value: "active", label: "Ativo" },
  { value: "bench", label: "Reserva" },
  { value: "inactive", label: "Inativo" },
  { value: "removed", label: "Removido" },
];

const STATUS_BADGE: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  bench: "secondary",
  inactive: "outline",
  removed: "destructive",
};

interface MatchLineupCardProps {
  matchId: string;
  entry: { id: string; team_id: string | null };
  teamName: string;
  canWrite: boolean;
  peopleMap: Map<string, { full_name: string }>;
  participantsMap: Map<string, { person_id: string }>;
}

export default function MatchLineupCard({
  matchId,
  entry,
  teamName,
  canWrite,
  peopleMap,
  participantsMap,
}: MatchLineupCardProps) {
  const qc = useQueryClient();
  const teamId = entry.team_id;
  const [editingId, setEditingId] = useState<string | null>(null);

  // Fetch lineups for this entry
  const { data: lineups = [], isLoading: lineupsLoading } = useQuery({
    queryKey: ["match_lineups", matchId, entry.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_lineups" as any)
        .select("*")
        .eq("match_id", matchId)
        .eq("match_entry_id", entry.id)
        .order("is_starter", { ascending: false })
        .order("jersey_number", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch team_members for this team
  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team_members_for_lineup", teamId],
    queryFn: async () => {
      if (!teamId) return [];
      const { data, error } = await supabase
        .from("team_members")
        .select("*")
        .eq("team_id", teamId)
        .eq("is_active", true)
        .order("jersey_number");
      if (error) throw error;
      return data;
    },
    enabled: !!teamId,
  });

  const getPersonName = (participantId: string) => {
    const p = participantsMap.get(participantId);
    if (!p) return "—";
    const person = peopleMap.get(p.person_id);
    return person?.full_name ?? "—";
  };

  // Generate lineup from team members
  const generateMut = useMutation({
    mutationFn: async () => {
      const existingMemberIds = new Set(lineups.map((l: any) => l.team_member_id));
      const toInsert = teamMembers
        .filter((tm) => !existingMemberIds.has(tm.id))
        .map((tm) => ({
          match_id: matchId,
          match_entry_id: entry.id,
          team_member_id: tm.id,
          participant_id: tm.participant_id,
          status: "active",
          jersey_number: tm.jersey_number,
          is_starter: false,
        }));
      if (!toInsert.length) throw new Error("Todos os membros já estão na escalação");
      const { error } = await supabase.from("match_lineups" as any).insert(toInsert);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["match_lineups", matchId, entry.id] });
      toast.success("Escalação gerada a partir do elenco da equipe");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Update a single lineup entry
  const updateMut = useMutation({
    mutationFn: async (updates: { id: string; status?: string; is_starter?: boolean; jersey_number?: number | null; position?: string | null }) => {
      const { id, ...fields } = updates;
      const { error } = await supabase.from("match_lineups" as any).update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["match_lineups", matchId, entry.id] });
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const hasMembers = teamMembers.length > 0;
  const existingCount = lineups.length;
  const canGenerate = hasMembers && teamMembers.some((tm) => !lineups.find((l: any) => l.team_member_id === tm.id));

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm">{teamName}</CardTitle>
          <Badge variant="outline" className="text-xs">{existingCount} atletas</Badge>
        </div>
        {canWrite && canGenerate && (
          <Button size="sm" variant="outline" onClick={() => generateMut.mutate()} disabled={generateMut.isPending}>
            <RefreshCw className="mr-2 h-3 w-3" />
            {existingCount === 0 ? "Carregar elenco" : "Completar elenco"}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {lineupsLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
        ) : lineups.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhum atleta na escalação.{" "}
            {canWrite && hasMembers && "Clique em \"Carregar elenco\" para gerar."}
          </p>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">#</TableHead>
                  <TableHead>Atleta</TableHead>
                  <TableHead className="w-[80px]">Titular</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  {canWrite && <TableHead className="w-[100px]">Posição</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineups.map((lineup: any) => (
                  <TableRow key={lineup.id} className={lineup.status === "removed" ? "opacity-50" : ""}>
                    <TableCell className="font-mono text-sm">
                      {canWrite && editingId === lineup.id ? (
                        <Input
                          type="number"
                          className="h-7 w-14 text-xs"
                          defaultValue={lineup.jersey_number ?? ""}
                          onBlur={(e) => {
                            const val = e.target.value ? parseInt(e.target.value) : null;
                            if (val !== lineup.jersey_number) updateMut.mutate({ id: lineup.id, jersey_number: val });
                            setEditingId(null);
                          }}
                        />
                      ) : (
                        <span
                          className={canWrite ? "cursor-pointer hover:underline" : ""}
                          onClick={() => canWrite && setEditingId(lineup.id)}
                        >
                          {lineup.jersey_number ?? "—"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {getPersonName(lineup.participant_id)}
                    </TableCell>
                    <TableCell>
                      {canWrite ? (
                        <Switch
                          checked={lineup.is_starter}
                          onCheckedChange={(v) => updateMut.mutate({ id: lineup.id, is_starter: v })}
                          disabled={lineup.status === "removed"}
                        />
                      ) : (
                        lineup.is_starter && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      )}
                    </TableCell>
                    <TableCell>
                      {canWrite ? (
                        <Select
                          value={lineup.status}
                          onValueChange={(v) => updateMut.mutate({ id: lineup.id, status: v })}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LINEUP_STATUS_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={STATUS_BADGE[lineup.status] ?? "outline"}>
                          {LINEUP_STATUS_OPTIONS.find((o) => o.value === lineup.status)?.label ?? lineup.status}
                        </Badge>
                      )}
                    </TableCell>
                    {canWrite && (
                      <TableCell>
                        <Input
                          className="h-7 text-xs"
                          placeholder="Pos."
                          defaultValue={lineup.position ?? ""}
                          onBlur={(e) => {
                            const val = e.target.value || null;
                            if (val !== lineup.position) updateMut.mutate({ id: lineup.id, position: val });
                          }}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
