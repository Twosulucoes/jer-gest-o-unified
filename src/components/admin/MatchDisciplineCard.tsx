import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { ShieldAlert } from "lucide-react";

interface Props {
  matchId: string;
  eventId: string;
  entries: Array<{ id: string; team_id?: string | null; participant_sport_event_id?: string | null }>;
  getEntryLabel: (entry: any) => string;
  canWrite: boolean;
}

interface DisciplineForm {
  yellow_cards: number;
  red_cards: number;
}

export default function MatchDisciplineCard({ matchId, eventId, entries, getEntryLabel, canWrite }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, DisciplineForm>>({});

  const { data: disciplines = [] } = useQuery({
    queryKey: ["match_discipline", matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_discipline" as any)
        .select("*")
        .eq("match_id", matchId);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!matchId,
  });

  // Sync form with fetched data
  useEffect(() => {
    const newForm: Record<string, DisciplineForm> = {};
    entries.forEach((entry) => {
      const existing = disciplines.find((d: any) => d.match_entry_id === entry.id);
      newForm[entry.id] = {
        yellow_cards: existing?.yellow_cards ?? 0,
        red_cards: existing?.red_cards ?? 0,
      };
    });
    setForm(newForm);
  }, [disciplines, entries]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const upserts = entries.map((entry) => {
        const f = form[entry.id] || { yellow_cards: 0, red_cards: 0 };
        const existing = disciplines.find((d: any) => d.match_entry_id === entry.id);
        return {
          ...(existing ? { id: existing.id } : {}),
          event_id: eventId,
          match_id: matchId,
          match_entry_id: entry.id,
          yellow_cards: f.yellow_cards,
          red_cards: f.red_cards,
        };
      });
      const { error } = await supabase
        .from("match_discipline" as any)
        .upsert(upserts as any, { onConflict: "match_entry_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["match_discipline", matchId] });
      toast.success("Disciplina salva");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const updateField = (entryId: string, field: keyof DisciplineForm, value: number) => {
    setForm((prev) => ({
      ...prev,
      [entryId]: { ...prev[entryId], [field]: Math.max(0, value) },
    }));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="h-4 w-4" />
          Disciplina (Cartões)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {entries.map((entry) => {
            const f = form[entry.id] || { yellow_cards: 0, red_cards: 0 };
            return (
              <div key={entry.id} className="flex items-center gap-3 border rounded-lg p-3">
                <span className="text-sm font-medium flex-1 min-w-0 truncate">
                  {getEntryLabel(entry)}
                </span>
                <div className="flex items-center gap-2">
                  <div className="text-center">
                    <label className="text-[10px] text-muted-foreground block">CA</label>
                    <Input
                      type="number"
                      min={0}
                      className="w-14 h-8 text-center text-sm"
                      value={f.yellow_cards}
                      onChange={(e) => updateField(entry.id, "yellow_cards", parseInt(e.target.value) || 0)}
                      disabled={!canWrite}
                    />
                  </div>
                  <div className="text-center">
                    <label className="text-[10px] text-muted-foreground block">CV</label>
                    <Input
                      type="number"
                      min={0}
                      className="w-14 h-8 text-center text-sm"
                      value={f.red_cards}
                      onChange={(e) => updateField(entry.id, "red_cards", parseInt(e.target.value) || 0)}
                      disabled={!canWrite}
                    />
                  </div>
                </div>
              </div>
            );
          })}
          {canWrite && (
            <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending ? "Salvando..." : "Salvar disciplina"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
