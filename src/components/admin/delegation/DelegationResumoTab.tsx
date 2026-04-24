import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, IdCard, Trophy, BedDouble, UtensilsCrossed, Bus, Mail, Phone, User } from "lucide-react";

interface Props {
  delegation: {
    id: string;
    event_id: string;
    chief_name: string | null;
    chief_email: string | null;
    chief_phone: string | null;
    school_name: string;
    school_city?: string | null;
    school_state?: string | null;
    notes: string | null;
    status: string;
    created_at: string;
  };
  institution?: { id: string; name: string; city?: string | null; state?: string | null } | null | undefined;
  event: { id: string; name: string; year: number } | null | undefined;
}

const TYPE_LABELS: Record<string, string> = {
  athlete: "Atletas", coach: "Técnicos", head_of_delegation: "Chefes", staff: "Staff",
};

export default function DelegationResumoTab({ delegation, institution, event }: Props) {
  const { data: participants = [] } = useQuery({
    queryKey: ["delegation_participants_summary", delegation.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participants")
        .select("id, participant_type, status")
        .eq("delegation_id", delegation.id)
        .eq("event_id", delegation.event_id);
      if (error) throw error;
      return data;
    },
  });

  const participantIds = participants.map(p => p.id);

  const { data: credentialedCount = 0 } = useQuery({
    queryKey: ["delegation_credentialed", delegation.id],
    queryFn: async () => {
      if (!participantIds.length) return 0;
      const { count, error } = await supabase
        .from("participant_credentials")
        .select("id", { count: "exact", head: true })
        .in("participant_id", participantIds)
        .eq("status", "active");
      if (error) throw error;
      return count ?? 0;
    },
    enabled: participantIds.length > 0,
  });

  const { data: sportEventCount = 0 } = useQuery({
    queryKey: ["delegation_sport_events", delegation.id],
    queryFn: async () => {
      if (!participantIds.length) return 0;
      const { count, error } = await supabase
        .from("participant_sport_events")
        .select("id", { count: "exact", head: true })
        .in("participant_id", participantIds);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: participantIds.length > 0,
  });

  const { data: lodgingCount = 0 } = useQuery({
    queryKey: ["delegation_lodging", delegation.id],
    queryFn: async () => {
      if (!participantIds.length) return 0;
      const { count, error } = await supabase
        .from("lodging_occupancies")
        .select("id", { count: "exact", head: true })
        .in("participant_id", participantIds)
        .eq("event_id", delegation.event_id);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: participantIds.length > 0,
  });

  const { data: mealCount = 0 } = useQuery({
    queryKey: ["delegation_meals", delegation.id],
    queryFn: async () => {
      if (!participantIds.length) return 0;
      const { count, error } = await supabase
        .from("meal_consumptions")
        .select("id", { count: "exact", head: true })
        .in("participant_id", participantIds);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: participantIds.length > 0,
  });

  const { data: transportCount = 0 } = useQuery({
    queryKey: ["delegation_transport", delegation.id],
    queryFn: async () => {
      if (!participantIds.length) return 0;
      const { count, error } = await supabase
        .from("transport_passengers")
        .select("id", { count: "exact", head: true })
        .in("participant_id", participantIds);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: participantIds.length > 0,
  });

  const typeCounts = participants.reduce<Record<string, number>>((acc, p) => {
    acc[p.participant_type] = (acc[p.participant_type] || 0) + 1;
    return acc;
  }, {});

  const credentialedParticipants = participants.filter(p => p.status === "credentialed").length;

  return (
    <div className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
      {/* Quick indicators — 3 colunas no mobile pra caber bem */}
      <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-3">
        <IndicatorCard icon={<Users className="h-4 w-4 text-primary" />} label="Total" value={participants.length} />
        <IndicatorCard icon={<UserCheck className="h-4 w-4 text-green-600" />} label="Credenciados" value={credentialedParticipants} />
        <IndicatorCard icon={<IdCard className="h-4 w-4 text-emerald-600" />} label="Credenciais" value={credentialedCount} />
        <IndicatorCard icon={<Trophy className="h-4 w-4 text-blue-600" />} label="Inscrições" value={sportEventCount} />
        <IndicatorCard icon={<BedDouble className="h-4 w-4 text-purple-600" />} label="Alojados" value={lodgingCount} />
        <IndicatorCard icon={<UtensilsCrossed className="h-4 w-4 text-orange-600" />} label="Refeições" value={mealCount} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Composição */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Composição da Delegação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {Object.entries(TYPE_LABELS).map(([key, label]) => (
              <Row key={key} label={label} value={String(typeCounts[key] || 0)} />
            ))}
            <div className="border-t pt-2">
              <Row label="Total" value={String(participants.length)} />
            </div>
          </CardContent>
        </Card>

        {/* Dados da delegação */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Dados da Delegação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Instituição" value={delegation.school_name} />
            {delegation.school_city && <Row label="Cidade" value={`${delegation.school_city}${delegation.school_state ? `/${delegation.school_state}` : ""}`} />}
            <Row label="Evento" value={event ? `${event.name} (${event.year})` : undefined} />
            <Row label="Cadastrada em" value={new Date(delegation.created_at).toLocaleDateString("pt-BR")} />
            {delegation.chief_name && <Row label="Chefe" value={delegation.chief_name} icon={<User className="h-3.5 w-3.5" />} />}
            {delegation.chief_email && <Row label="E-mail" value={delegation.chief_email} icon={<Mail className="h-3.5 w-3.5" />} />}
            {delegation.chief_phone && <Row label="Telefone" value={delegation.chief_phone} icon={<Phone className="h-3.5 w-3.5" />} />}
            {delegation.notes && <Row label="Observações" value={delegation.notes} />}
          </CardContent>
        </Card>

        {/* Logística resumida */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Visão Logística</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <BedDouble className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                <p className="text-lg font-bold">{lodgingCount}</p>
                <p className="text-xs text-muted-foreground">Alojados</p>
              </div>
              <div>
                <UtensilsCrossed className="h-5 w-5 text-orange-600 mx-auto mb-1" />
                <p className="text-lg font-bold">{mealCount}</p>
                <p className="text-xs text-muted-foreground">Refeições</p>
              </div>
              <div>
                <Bus className="h-5 w-5 text-teal-600 mx-auto mb-1" />
                <p className="text-lg font-bold">{transportCount}</p>
                <p className="text-xs text-muted-foreground">Embarques</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function IndicatorCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="flex flex-col sm:flex-row items-center sm:items-center gap-1 sm:gap-2.5 p-2 sm:p-3 text-center sm:text-left">
        <span className="shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="text-base sm:text-lg font-bold leading-none text-foreground">{value}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 leading-tight truncate">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, icon }: { label: string; value?: string | null; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">{icon}{label}</span>
      <span className={`text-right ${value ? "text-foreground" : "text-muted-foreground"}`}>{value || "—"}</span>
    </div>
  );
}
