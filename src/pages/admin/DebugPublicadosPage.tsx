import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { AppPageHeader } from "@/components/app/AppPageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, EyeOff } from "lucide-react";
import { toast } from "sonner";

interface PublishedRow {
  match_id: string;
  match_date: string | null;
  sport_name: string;
  category_name: string;
  entries: { side: string; team_name: string | null; participant_name: string | null; score: string | null }[];
  published_at: string | null;
  result_ids: string[];
}

export default function DebugPublicadosPage() {
  const eventId = useActiveEventId();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["debug-publicados", eventId],
    queryFn: async () => {
      // Get published results with match + sport_event info
      const { data: results, error } = await supabase
        .from("competition_match_results")
        .select(`
          id, match_id, score, published_at, result_status,
          match_entry_id,
          competition_match_entries!competition_match_results_match_entry_id_fkey(
            side,
            team_id,
            teams(name),
            participant_sport_event_id,
            participant_sport_events(participants(person:people(full_name)))
          ),
          competition_matches!competition_match_results_match_id_fkey(
            match_date, sport_event_id, event_id,
            sport_events(
              sports(name),
              categories(name)
            )
          )
        `)
        .eq("result_status", "publicado")
        .eq("competition_matches.event_id", eventId)
        .order("published_at", { ascending: false });

      if (error) throw error;

      // Group by match_id
      const byMatch = new Map<string, PublishedRow>();
      for (const r of results || []) {
        const match = r.competition_matches as any;
        if (!match) continue;
        const mid = r.match_id;
        if (!byMatch.has(mid)) {
          const se = match.sport_events as any;
          byMatch.set(mid, {
            match_id: mid,
            match_date: match.match_date,
            sport_name: se?.sports?.name ?? "—",
            category_name: se?.categories?.name ?? "—",
            entries: [],
            published_at: r.published_at,
            result_ids: [],
          });
        }
        const row = byMatch.get(mid)!;
        row.result_ids.push(r.id);
        const entry = r.competition_match_entries as any;
        if (entry) {
          row.entries.push({
            side: entry.side,
            team_name: entry.teams?.name ?? null,
            participant_name: (entry.participant_sport_events?.participants as any)?.person?.full_name ?? null,
            score: r.score,
          });
        }
      }

      return Array.from(byMatch.values());
    },
  });

  const unpublish = useMutation({
    mutationFn: async (resultIds: string[]) => {
      const { error } = await supabase
        .from("competition_match_results")
        .update({ result_status: "resultado_validado", published_at: null, published_bulletin_id: null, published_by: null })
        .in("id", resultIds);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Resultados despublicados.");
      qc.invalidateQueries({ queryKey: ["debug-publicados"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const rows = data ?? [];

  return (
    <div className="p-6 space-y-4">
      <AppPageHeader
        title={`${rows.length} partida(s) publicada(s)`}
        description="Resultados com status 'publicado' no evento ativo"
      />

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">Nenhuma partida publicada ainda.</p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Modalidade</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Participantes</TableHead>
                <TableHead>Placar</TableHead>
                <TableHead>Data Partida</TableHead>
                <TableHead>Publicado em</TableHead>
                <TableHead className="w-[100px]">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const home = r.entries.find((e) => e.side === "home");
                const away = r.entries.find((e) => e.side === "away");
                const homeName = home?.team_name || home?.participant_name || "—";
                const awayName = away?.team_name || away?.participant_name || "—";
                return (
                  <TableRow key={r.match_id}>
                    <TableCell>{r.sport_name}</TableCell>
                    <TableCell>{r.category_name}</TableCell>
                    <TableCell className="font-medium">{homeName} vs {awayName}</TableCell>
                    <TableCell>{home?.score ?? "—"} × {away?.score ?? "—"}</TableCell>
                    <TableCell>{r.match_date ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.published_at ? new Date(r.published_at).toLocaleString("pt-BR") : "—"}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => unpublish.mutate(r.result_ids)}
                        disabled={unpublish.isPending}
                      >
                        <EyeOff className="h-4 w-4 mr-1" /> Despublicar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
