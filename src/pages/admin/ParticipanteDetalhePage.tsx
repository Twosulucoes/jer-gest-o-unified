import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2, User, Shield, IdCard, Bus, Trophy, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ParticipantResumoTab from "@/components/admin/participant/ParticipantResumoTab";
import ParticipantHistoricoTab from "@/components/admin/participant/ParticipantHistoricoTab";
import ParticipantCredencialTab from "@/components/admin/participant/ParticipantCredencialTab";
import ParticipantLogisticaTab from "@/components/admin/participant/ParticipantLogisticaTab";

const TYPE_LABELS: Record<string, string> = {
  athlete: "Atleta", coach: "Técnico", head_of_delegation: "Chefe Delegação", staff: "Staff",
};
const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "Pendente", variant: "outline" },
  confirmed: { label: "Confirmado", variant: "secondary" },
  credentialed: { label: "Credenciado", variant: "default" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

export default function ParticipanteDetalhePage() {
  const { participantId } = useParams<{ participantId: string }>();
  const navigate = useNavigate();

  const { data: participant, isLoading: loadingParticipant } = useQuery({
    queryKey: ["participant_full", participantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participants")
        .select("id, participant_type, person_id, delegation_id, event_id, status, is_active, notes, created_at")
        .eq("id", participantId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!participantId,
  });

  const { data: person } = useQuery({
    queryKey: ["person_detail", participant?.person_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("people")
        .select("id, full_name, cpf, gender, birth_date, email, phone, photo_url, food_restrictions, disability_type, medical_notes")
        .eq("id", participant!.person_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!participant?.person_id,
  });

  const { data: delegation } = useQuery({
    queryKey: ["delegation_detail", participant?.delegation_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delegations")
        .select("id, institution_id")
        .eq("id", participant!.delegation_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!participant?.delegation_id,
  });

  const { data: institution } = useQuery({
    queryKey: ["institution_detail", delegation?.institution_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("institutions")
        .select("id, name")
        .eq("id", delegation!.institution_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!delegation?.institution_id,
  });

  if (loadingParticipant) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!participant) {
    return (
      <div className="text-center py-12 text-muted-foreground">Participante não encontrado.</div>
    );
  }

  const statusInfo = STATUS_LABELS[participant.status] ?? { label: participant.status, variant: "outline" as const };
  const initials = person?.full_name?.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() ?? "?";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mt-1 shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar className="h-14 w-14 shrink-0">
          <AvatarImage src={person?.photo_url ?? undefined} />
          <AvatarFallback className="text-lg font-semibold">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-foreground truncate">{person?.full_name ?? "Participante"}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge variant="outline">{TYPE_LABELS[participant.participant_type] ?? participant.participant_type}</Badge>
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            {!participant.is_active && <Badge variant="destructive">Inativo</Badge>}
            {institution && (
              <span className="text-sm text-muted-foreground">{institution.name}</span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="resumo" className="w-full">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
          <TabsTrigger value="resumo" className="gap-1.5">
            <User className="h-3.5 w-3.5" />Resumo
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5">
            <Trophy className="h-3.5 w-3.5" />Esportivo
          </TabsTrigger>
          <TabsTrigger value="credencial" className="gap-1.5">
            <IdCard className="h-3.5 w-3.5" />Credencial
          </TabsTrigger>
          <TabsTrigger value="logistica" className="gap-1.5">
            <Bus className="h-3.5 w-3.5" />Logística
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumo">
          <ParticipantResumoTab participant={participant} person={person} institution={institution} />
        </TabsContent>
        <TabsContent value="historico">
          <ParticipantHistoricoTab participantId={participant.id} />
        </TabsContent>
        <TabsContent value="credencial">
          <ParticipantCredencialTab participantId={participant.id} eventId={participant.event_id} />
        </TabsContent>
        <TabsContent value="logistica">
          <ParticipantLogisticaTab participantId={participant.id} eventId={participant.event_id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
