import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useEventBySlug, useConsolidatedSportEventRules, useEventParticipationRules } from "@/hooks/useEventRulesCenter";
import { RuleStatusBadge, DisciplineTypeBadge, ManualConfirmationBadge } from "@/components/regras/RuleBadges";
import { RuleWarningCallout } from "@/components/regras/RuleWarningCallout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ClipboardCheck, HelpCircle, AlertTriangle, Info, Check, X } from "lucide-react";
import { humanizeDisciplineType } from "@/lib/rulesTransform";
import type { RuleSportEventView } from "@/types/rulesSportEvent";

export default function EventoAssistenteInscricaoPage() {
  const { eventSlug = "jer-2026" } = useParams();
  const { data: event, isLoading: eventLoading } = useEventBySlug(eventSlug);
  const { data: rules = [], isLoading: rulesLoading, error } = useConsolidatedSportEventRules(event?.id);
  const { data: participationRules } = useEventParticipationRules(event?.id);

  const [selectedSportEventId, setSelectedSportEventId] = useState<string>("");

  const isLoading = eventLoading || rulesLoading;

  const sportOptions = useMemo(() => {
    return rules.map((r) => ({ value: r.sport_event_id, label: `${r.sport_name} — ${r.category_name}` }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rules]);

  const selected = useMemo(() => {
    return rules.find((r) => r.sport_event_id === selectedSportEventId) ?? null;
  }, [rules, selectedSportEventId]);

  const BoolRow = ({ label, value, description }: { label: string; value: boolean | null; description?: string }) => (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <div className="mt-0.5">
        {value ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-destructive" />}
      </div>
      <div className="flex-1">
        <span className="text-sm font-medium">{label}</span>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
  );

  if (error) {
    return <div className="p-6"><Alert variant="destructive"><AlertDescription>Erro: {(error as Error).message}</AlertDescription></Alert></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[900px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold font-heading text-foreground flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6 text-primary" />
          Assistente Operacional de Inscrição
        </h1>
        {event && <p className="text-sm text-muted-foreground mt-1">{event.name} ({event.year})</p>}
        <p className="text-xs text-muted-foreground mt-2">
          Selecione uma modalidade/categoria para visualizar as regras aplicáveis e orientações de inscrição.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-20" />
      ) : (
        <>
          {/* Seletor */}
          <Card>
            <CardContent className="py-4">
              <label className="text-sm font-medium text-foreground mb-2 block">Modalidade / Categoria</label>
              <Select value={selectedSportEventId} onValueChange={setSelectedSportEventId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione uma modalidade..." />
                </SelectTrigger>
                <SelectContent>
                  {sportOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {!selected ? (
            <Card>
              <CardContent className="py-12 text-center">
                <HelpCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Selecione uma modalidade acima para ver as regras aplicáveis.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Identificação */}
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">{selected.sport_name} — {selected.category_name}</CardTitle>
                    <DisciplineTypeBadge type={selected.discipline_type} />
                    <RuleStatusBadge status={selected.national_flow_status} />
                    {selected.is_paralympic && <Badge variant="outline" className="bg-purple-500/15 text-purple-700 border-purple-500/30">Paralímpico</Badge>}
                  </div>
                  <CardDescription>
                    <code className="text-[10px] bg-muted px-1 rounded">{selected.sport_event_slug}</code>
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Regras aplicáveis */}
              <Card>
                <CardHeader><CardTitle className="text-sm">Regras Aplicáveis</CardTitle></CardHeader>
                <CardContent className="space-y-0">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm text-muted-foreground">Tipo de disputa</span>
                    <span className="text-sm font-medium">{humanizeDisciplineType(selected.discipline_type)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm text-muted-foreground">Gêneros permitidos</span>
                    <span className="text-sm font-medium">{selected.allowed_genders_list.join(", ") || "—"}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm text-muted-foreground">Limite por instituição</span>
                    <span className="text-sm font-medium">{selected.institution_limit_summary}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm text-muted-foreground">Tamanho da equipe</span>
                    <span className="text-sm font-medium">{selected.team_size_summary}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-sm text-muted-foreground">Substituições</span>
                    <span className="text-sm font-medium">{selected.substitution_summary}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Restrições */}
              <Card>
                <CardHeader><CardTitle className="text-sm">Restrições e Requisitos</CardTitle></CardHeader>
                <CardContent className="space-y-0">
                  <BoolRow label="Exige CREF para técnico" value={selected.requires_cref_for_technician} description={selected.cref_summary} />
                  <BoolRow label="Aceita técnico externo" value={selected.allows_external_technician} description={selected.external_technician_summary} />
                  <BoolRow label="Exige autorização da escola para técnico externo" value={selected.requires_school_authorization_for_external_technician} />
                  {participationRules && (
                    <>
                      <div className="flex justify-between py-2.5 border-b">
                        <span className="text-sm text-muted-foreground">Máx. esportes individuais/atleta</span>
                        <span className="text-sm font-medium">{participationRules.max_individual_sports_per_athlete}</span>
                      </div>
                      <div className="flex justify-between py-2.5 border-b">
                        <span className="text-sm text-muted-foreground">Máx. provas/esporte individual</span>
                        <span className="text-sm font-medium">{participationRules.max_events_per_individual_sport}</span>
                      </div>
                      <div className="flex justify-between py-2.5">
                        <span className="text-sm text-muted-foreground">Máx. equipes coletivas/atleta</span>
                        <span className="text-sm font-medium">{participationRules.max_collective_teams_per_athlete}</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Elegibilidade nacional */}
              <Card>
                <CardHeader><CardTitle className="text-sm">Elegibilidade Nacional</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <RuleStatusBadge status={selected.national_flow_status} />
                  </div>
                  <p className="text-sm text-muted-foreground">{selected.national_flow_description}</p>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm text-muted-foreground">Método de seleção</span>
                    <span className="text-sm font-medium">{selected.selection_method_label}</span>
                  </div>
                  <RuleWarningCallout
                    status={selected.national_flow_status}
                    notes={selected.national_eligibility_notes}
                    reasonCode={selected.national_eligibility_reason_code}
                  />
                </CardContent>
              </Card>

              {/* Observações */}
              {selected.notes && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Observações</CardTitle></CardHeader>
                  <CardContent>
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>{selected.notes}</AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
