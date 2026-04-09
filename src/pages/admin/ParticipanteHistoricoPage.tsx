import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import ParticipantSportHistory from "@/components/admin/ParticipantSportHistory";

export default function ParticipanteHistoricoPage() {
  const { participantId } = useParams<{ participantId: string }>();
  const navigate = useNavigate();

  const { data: participant, isLoading } = useQuery({
    queryKey: ["participant_detail", participantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participants")
        .select("id, participant_type, person_id")
        .eq("id", participantId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!participantId,
  });

  const { data: person } = useQuery({
    queryKey: ["person_for_participant", participant?.person_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("people")
        .select("full_name")
        .eq("id", participant!.person_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!participant?.person_id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-xl font-bold">{person?.full_name ?? "Participante"}</h2>
          <p className="text-sm text-muted-foreground">Histórico Esportivo</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Participações e Resultados</CardTitle>
          <CardDescription>Histórico consolidado de todas as provas e partidas.</CardDescription>
        </CardHeader>
        <CardContent>
          {participantId && <ParticipantSportHistory participantId={participantId} />}
        </CardContent>
      </Card>
    </div>
  );
}
