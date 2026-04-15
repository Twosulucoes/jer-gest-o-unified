import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Award, CheckCircle, Loader2, ShieldCheck, Info } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  eventId: string;
  sportEventId: string;
  isCollective: boolean;
  onHomologated?: () => void;
}

interface AptItem {
  id: string;
  name: string;
  type: "team" | "individual";
  delegationName: string;
}

export default function HomologarClassificadoCard({
  eventId,
  sportEventId,
  isCollective,
  onHomologated,
}: Props) {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const [homologated, setHomologated] = useState(false);

  const canHomologate = hasRole("admin") || hasRole("coordenacao_tecnica") || hasRole("coordenador_modalidade");

  // Count apt participants for this sport_event
  const { data, isLoading, error } = useQuery({
    queryKey: ["homologar-unico-apto", eventId, sportEventId, isCollective],
    queryFn: async () => {
      if (isCollective) {
        // Check active teams
        const { data: teams, error } = await supabase
          .from("teams")
          .select("id, name, delegation_id, delegations(institutions(name))")
          .eq("event_id", eventId)
          .eq("sport_event_id", sportEventId)
          .eq("status", "active");
        if (error) throw error;
        const items: AptItem[] = (teams ?? []).map((t: any) => ({
          id: t.id,
          name: t.name,
          type: "team" as const,
          delegationName: t.delegations?.institutions?.name ?? "—",
        }));
        return { aptCount: items.length, items };
      } else {
        // Check enrolled PSEs with active enrollment
        const { data: pses, error } = await supabase
          .from("participant_sport_events")
          .select("id, status, participants(id, people(full_name), delegation_id, delegations(institutions(name)))")
          .eq("sport_event_id", sportEventId)
          .eq("status", "confirmed");
        if (error) throw error;
        const items: AptItem[] = (pses ?? []).map((p: any) => ({
          id: p.id,
          name: p.participants?.people?.full_name ?? "—",
          type: "individual" as const,
          delegationName: p.participants?.delegations?.institutions?.name ?? "—",
        }));
        return { aptCount: items.length, items };
      }
    },
  });

  // Check if already homologated (has a match with result_type = 'walkover_unico_apto')
  const { data: existingHomologation } = useQuery({
    queryKey: ["homologacao-existente", sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_matches")
        .select("id, status, competition_match_results(id, result_type, outcome)")
        .eq("event_id", eventId)
        .eq("sport_event_id", sportEventId)
        .eq("notes", "homologacao_unico_apto")
        .limit(1);
      if (error) throw error;
      return data && data.length > 0 ? data[0] : null;
    },
  });

  const homologarMut = useMutation({
    mutationFn: async () => {
      if (!data || data.aptCount !== 1) throw new Error("Deve haver exatamente 1 apto.");
      const item = data.items[0];
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) throw new Error("Usuário não autenticado.");

      // Get or create a phase for homologation
      let phaseId: string;
      const { data: phases } = await supabase
        .from("competition_phases")
        .select("id")
        .eq("event_id", eventId)
        .eq("sport_event_id", sportEventId)
        .order("sort_order")
        .limit(1);

      if (phases && phases.length > 0) {
        phaseId = phases[0].id;
      } else {
        const { data: newPhase, error: phErr } = await supabase
          .from("competition_phases")
          .insert({
            event_id: eventId,
            sport_event_id: sportEventId,
            name: "Classificação Direta",
            phase_type: "direct",
            sort_order: 1,
            status: "completed",
          })
          .select("id")
          .single();
        if (phErr) throw phErr;
        phaseId = newPhase.id;
      }

      // Create a synthetic match
      const { data: match, error: mErr } = await supabase
        .from("competition_matches")
        .insert({
          event_id: eventId,
          sport_event_id: sportEventId,
          phase_id: phaseId,
          match_number: 0,
          status: "finished",
          notes: "homologacao_unico_apto",
        })
        .select("id")
        .single();
      if (mErr) throw mErr;

      // Create single entry
      const entryPayload: any = {
        match_id: match.id,
        side: "home",
      };
      if (isCollective) {
        entryPayload.team_id = item.id;
      } else {
        entryPayload.participant_sport_event_id = item.id;
      }

      const { data: entry, error: eErr } = await supabase
        .from("competition_match_entries")
        .insert(entryPayload)
        .select("id")
        .single();
      if (eErr) throw eErr;

      // Create result
      const { error: rErr } = await supabase
        .from("competition_match_results")
        .insert({
          match_id: match.id,
          match_entry_id: entry.id,
          outcome: "win",
          result_status: "resultado_validado",
          result_type: "walkover_unico_apto",
          result_text: "Classificação direta — único inscrito apto",
          notes: `Homologado como classificado direto. Único ${isCollective ? "equipe" : "atleta"} apto na prova.`,
          recorded_by: userId,
          recorded_at: new Date().toISOString(),
          position: 1,
        });
      if (rErr) throw rErr;

      // Audit
      await supabase.from("audit_events").insert({
        table_name: "competition_match_results",
        record_id: match.id,
        action: "homologar_classificado_unico_apto",
        payload: {
          sport_event_id: sportEventId,
          item_id: item.id,
          item_name: item.name,
          item_type: item.type,
          by: userId,
        },
        created_by: userId,
      });
    },
    onSuccess: () => {
      toast.success("Classificado homologado com sucesso!");
      setHomologated(true);
      qc.invalidateQueries({ queryKey: ["homologar-unico-apto"] });
      qc.invalidateQueries({ queryKey: ["homologacao-existente"] });
      qc.invalidateQueries({ queryKey: ["central-results"] });
      qc.invalidateQueries({ queryKey: ["competition-summary"] });
      qc.invalidateQueries({ queryKey: ["governance-counts"] });
      onHomologated?.();
    },
    onError: (e: Error) => toast.error("Erro ao homologar: " + e.message),
  });

  if (isLoading) return <Skeleton className="h-20 w-full" />;
  if (error) return null;
  if (!data || data.aptCount !== 1) return null;

  const item = data.items[0];
  const alreadyDone = !!existingHomologation || homologated;

  return (
    <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/10">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Award className="h-4 w-4 text-amber-600" />
          Classificação Direta — Único Apto
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium">{item.name}</p>
            <p className="text-xs text-muted-foreground">{item.delegationName}</p>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {isCollective ? "Equipe" : "Atleta"}
          </Badge>
        </div>

        <Alert className="border-amber-200 dark:border-amber-800">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-xs">
            Apenas {isCollective ? "1 equipe ativa" : "1 atleta com inscrição confirmada"} nesta prova.
            Não haverá confronto. {isCollective ? "A equipe" : "O atleta"} pode ser homologado(a) como classificado(a) direto(a).
          </AlertDescription>
        </Alert>

        {alreadyDone ? (
          <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
            <ShieldCheck className="h-4 w-4" />
            <span className="font-medium">Classificação homologada ✓</span>
          </div>
        ) : canHomologate ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" className="w-full" disabled={homologarMut.isPending}>
                {homologarMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-1" />
                )}
                Homologar Classificado
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Homologar classificação direta?</AlertDialogTitle>
                <AlertDialogDescription>
                  <strong>{item.name}</strong> ({item.delegationName}) será registrado(a) como
                  classificado(a) direto(a) com justificativa "único inscrito apto".
                  <br /><br />
                  Um registro de resultado será criado automaticamente. Esta ação será auditada.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => homologarMut.mutate()}>
                  Confirmar Homologação
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <p className="text-xs text-muted-foreground">
            Sem permissão para homologar. Solicite a um coordenador ou admin.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
