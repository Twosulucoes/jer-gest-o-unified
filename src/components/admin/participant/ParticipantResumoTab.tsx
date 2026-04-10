import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Mail, Phone, Heart, Accessibility, Trophy, Swords, IdCard, BedDouble, UtensilsCrossed, Bus } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  athlete: "Atleta", coach: "Técnico", head_of_delegation: "Chefe Delegação", staff: "Staff",
};
const GENDER_LABELS: Record<string, string> = { M: "Masculino", F: "Feminino", O: "Outro" };

interface Props {
  participant: {
    id: string;
    participant_type: string;
    status: string;
    is_active: boolean;
    notes: string | null;
    created_at: string;
    event_id: string;
  };
  person: {
    full_name: string;
    cpf: string | null;
    gender: string;
    birth_date: string;
    email: string | null;
    phone: string | null;
    food_restrictions: string | null;
    disability_type: string | null;
    medical_notes: string | null;
  } | null | undefined;
  institution: { id: string; name: string } | null | undefined;
}

interface HistoryRow {
  sport_event_id: string;
  match_id: string | null;
  result_status: string | null;
  position: number | null;
}

export default function ParticipantResumoTab({ participant, person, institution }: Props) {
  // Sport history summary
  const { data: history = [] } = useQuery<HistoryRow[]>({
    queryKey: ["participant_sport_history_summary", participant.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_participant_sport_history", {
        _participant_id: participant.id,
      });
      if (error) throw error;
      return (data ?? []) as HistoryRow[];
    },
  });

  // Credential status
  const { data: activeCredential } = useQuery({
    queryKey: ["participant_active_credential", participant.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_credentials")
        .select("id, status, credential_code")
        .eq("participant_id", participant.id)
        .eq("event_id", participant.event_id)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Lodging count
  const { data: lodgingCount } = useQuery({
    queryKey: ["participant_lodging_count", participant.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("lodging_occupancies")
        .select("id", { count: "exact", head: true })
        .eq("participant_id", participant.id)
        .eq("event_id", participant.event_id);
      if (error) throw error;
      return count ?? 0;
    },
  });

  // Meal count
  const { data: mealCount } = useQuery({
    queryKey: ["participant_meals_count_resumo", participant.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("meal_consumptions")
        .select("id", { count: "exact", head: true })
        .eq("participant_id", participant.id);
      if (error) throw error;
      return count ?? 0;
    },
  });

  // Transport count
  const { data: transportCount } = useQuery({
    queryKey: ["participant_transport_count", participant.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("transport_passengers")
        .select("id", { count: "exact", head: true })
        .eq("participant_id", participant.id);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const sportEvents = new Set(history.map(r => r.sport_event_id));
  const matches = new Set(history.filter(r => r.match_id).map(r => r.match_id));
  const podiums = history.filter(r => r.position != null && r.position >= 1 && r.position <= 3 && r.result_status === "publicado").length;

  return (
    <div className="space-y-4 mt-4">
      {/* Quick indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <IndicatorCard icon={<Trophy className="h-4 w-4 text-primary" />} label="Provas" value={sportEvents.size} />
        <IndicatorCard icon={<Swords className="h-4 w-4 text-blue-600" />} label="Partidas" value={matches.size} />
        <IndicatorCard icon={<IdCard className="h-4 w-4 text-green-600" />} label="Credencial" value={activeCredential ? "Ativa" : "—"} />
        <IndicatorCard icon={<BedDouble className="h-4 w-4 text-purple-600" />} label="Alojamento" value={lodgingCount ?? 0} />
        <IndicatorCard icon={<UtensilsCrossed className="h-4 w-4 text-orange-600" />} label="Refeições" value={mealCount ?? 0} />
        <IndicatorCard icon={<Bus className="h-4 w-4 text-teal-600" />} label="Viagens" value={transportCount ?? 0} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Dados pessoais */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Dados Pessoais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Nome" value={person?.full_name} />
            <Row label="CPF" value={person?.cpf} mono />
            <Row label="Gênero" value={person?.gender ? GENDER_LABELS[person.gender] ?? person.gender : undefined} />
            <Row label="Nascimento" value={person?.birth_date ? new Date(person.birth_date + "T00:00:00").toLocaleDateString("pt-BR") : undefined} icon={<Calendar className="h-3.5 w-3.5" />} />
            <Row label="E-mail" value={person?.email} icon={<Mail className="h-3.5 w-3.5" />} />
            <Row label="Telefone" value={person?.phone} icon={<Phone className="h-3.5 w-3.5" />} />
          </CardContent>
        </Card>

        {/* Participação */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Participação no Evento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Tipo" value={TYPE_LABELS[participant.participant_type] ?? participant.participant_type} />
            <Row label="Instituição" value={institution?.name} />
            <Row label="Ativo" value={participant.is_active ? "Sim" : "Não"} />
            <Row label="Inscrito em" value={new Date(participant.created_at).toLocaleDateString("pt-BR")} />
            {podiums > 0 && <Row label="Pódios" value={`${podiums}`} />}
            {participant.notes && <Row label="Observações" value={participant.notes} />}
          </CardContent>
        </Card>

        {/* Saúde / restrições */}
        {(person?.food_restrictions || person?.disability_type || person?.medical_notes) && (
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Saúde e Restrições</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {person?.food_restrictions && <Row label="Restrições alimentares" value={person.food_restrictions} icon={<Heart className="h-3.5 w-3.5" />} />}
              {person?.disability_type && <Row label="Deficiência" value={person.disability_type} icon={<Accessibility className="h-3.5 w-3.5" />} />}
              {person?.medical_notes && <Row label="Observações médicas" value={person.medical_notes} />}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function IndicatorCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-2.5 p-3">
        {icon}
        <div>
          <p className="text-lg font-bold leading-none text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, mono, icon }: { label: string; value?: string | null; mono?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
        {icon}{label}
      </span>
      <span className={`text-right ${mono ? "font-mono text-xs" : ""} ${value ? "text-foreground" : "text-muted-foreground"}`}>
        {value || "—"}
      </span>
    </div>
  );
}
