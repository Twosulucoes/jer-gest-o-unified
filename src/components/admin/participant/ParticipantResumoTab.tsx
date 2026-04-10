import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Mail, Phone, CreditCard, Heart, Accessibility } from "lucide-react";

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

export default function ParticipantResumoTab({ participant, person, institution }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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
