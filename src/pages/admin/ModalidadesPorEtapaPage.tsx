import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId, useEventContext } from "@/contexts/EventContext";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Layers, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface StageRow { id: string; name: string; kind: string; status: string; starts_at: string | null; }
interface SportRow { id: string; name: string; is_paralympic: boolean; }
interface LinkRow { id: string; event_stage_id: string; sport_id: string; programa: string; }

export default function ModalidadesPorEtapaPage() {
  const eventId = useActiveEventId();
  const { activeEvent } = useEventContext();
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const canWrite = hasRole("admin") || hasRole("secretaria") || hasRole("super_admin");
  const [stageId, setStageId] = useState<string | null>(null);

  const { data: stages, isLoading: loadingStages } = useQuery({
    queryKey: ["mps", "stages", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data } = await supabase.from("event_stages")
        .select("id, name, kind, status, starts_at")
        .eq("event_id", eventId)
        .neq("kind", "legado")
        .order("starts_at", { nullsFirst: false });
      return (data ?? []).filter((s: any) => !["etapa-teste", "etapa-modelo-logistica"].includes(s.slug)) as StageRow[];
    },
  });

  const { data: sports, isLoading: loadingSports } = useQuery({
    queryKey: ["mps", "sports"],
    queryFn: async () => {
      const { data } = await supabase.from("sports").select("id, name, is_paralympic").order("name");
      return (data ?? []) as SportRow[];
    },
  });

  const { data: links, isLoading: loadingLinks } = useQuery({
    queryKey: ["mps", "links", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data } = await (supabase.from("event_stage_sports" as any))
        .select("id, event_stage_id, sport_id, programa")
        .eq("event_id", eventId);
      return (data ?? []) as LinkRow[];
    },
  });

  const linkSet = useMemo(() => {
    const m = new Map<string, LinkRow>();
    (links ?? []).forEach((l) => m.set(`${l.event_stage_id}:${l.sport_id}`, l));
    return m;
  }, [links]);

  const countByStage = useMemo(() => {
    const m = new Map<string, number>();
    (links ?? []).forEach((l) => m.set(l.event_stage_id, (m.get(l.event_stage_id) ?? 0) + 1));
    return m;
  }, [links]);

  const toggle = useMutation({
    mutationFn: async ({ sport, checked }: { sport: SportRow; checked: boolean }) => {
      if (!stageId || !eventId) return;
      if (checked) {
        const { error } = await (supabase.from("event_stage_sports" as any)).insert({
          event_id: eventId,
          event_stage_id: stageId,
          sport_id: sport.id,
          programa: sport.is_paralympic ? "jerpa" : "jers",
          source: "manual",
        });
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("event_stage_sports" as any))
          .delete().eq("event_stage_id", stageId).eq("sport_id", sport.id);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mps", "links", eventId] }); },
    onError: (e: any) => toast.error("Falha ao salvar: " + (e?.message ?? "erro")),
  });

  if (!eventId) {
    return <div className="container mx-auto py-6"><Card><CardContent className="p-6 text-sm text-muted-foreground">Selecione um evento ativo.</CardContent></Card></div>;
  }

  const selectedStage = stages?.find((s) => s.id === stageId) ?? null;
  const loading = loadingStages || loadingSports || loadingLinks;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-bold flex items-center gap-2"><Layers className="h-6 w-6" /> Modalidades por Etapa</h1>
        <p className="text-sm text-muted-foreground">
          Defina quais modalidades acontecem em cada etapa/sede — {activeEvent?.name ?? "evento"}.
          {!canWrite && " (somente leitura)"}
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle className="text-sm">Selecione a etapa</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {loadingStages ? <Skeleton className="h-10 w-full max-w-md" /> : (
            <Select value={stageId ?? undefined} onValueChange={setStageId}>
              <SelectTrigger className="max-w-md"><SelectValue placeholder="Escolha uma etapa..." /></SelectTrigger>
              <SelectContent>
                {(stages ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} {countByStage.get(s.id) ? `· ${countByStage.get(s.id)} modalidade(s)` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {selectedStage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="h-4 w-4" /> Modalidades — {selectedStage.name}
              <Badge variant="secondary">{countByStage.get(selectedStage.id) ?? 0} marcadas</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(sports ?? []).map((sp) => {
                  const checked = linkSet.has(`${selectedStage.id}:${sp.id}`);
                  return (
                    <label key={sp.id} className={`flex items-center gap-2 rounded-md border p-2 text-sm ${checked ? "border-primary/40 bg-primary/5" : "border-border"} ${canWrite ? "cursor-pointer" : "opacity-80"}`}>
                      <Checkbox
                        checked={checked}
                        disabled={!canWrite || toggle.isPending}
                        onCheckedChange={(v) => toggle.mutate({ sport: sp, checked: !!v })}
                      />
                      <span className="truncate flex-1">{sp.name}</span>
                      {sp.is_paralympic && <Badge variant="outline" className="text-[9px] h-5">JERPA</Badge>}
                    </label>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
