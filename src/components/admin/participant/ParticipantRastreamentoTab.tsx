import { useState, useMemo, useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, BedDouble, UtensilsCrossed, Bus, Trophy, Activity, Phone, AlertTriangle, Pencil } from "lucide-react";
import { format, subDays, isAfter, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/hooks/use-toast";

interface Props {
  participantId: string;
  eventId: string;
}

type TimelineItem = {
  id: string;
  type: "lodging" | "meal" | "transport" | "competition";
  timestamp: string;
  description: string;
};

export default function ParticipantRastreamentoTab({ participantId, eventId }: Props) {
  const [filters, setFilters] = useState({ lodging: true, meal: true, transport: true, competition: true });
  const [period, setPeriod] = useState("all");
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const lodgingFilterId = useId();
  const mealFilterId = useId();
  const transportFilterId = useId();
  const competitionFilterId = useId();
  const periodLabelId = useId();

  // --- Current lodging ---
  const { data: currentLodging, isLoading: loadingLodging } = useQuery({
    queryKey: ["tracking_lodging", participantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("lodging_occupancies")
        .select("id, status, checked_in_at, checked_out_at, unit_id")
        .eq("participant_id", participantId)
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      if (!data || data.length === 0) return null;
      // get unit info for all
      const unitIds = [...new Set(data.map(d => d.unit_id))];
      const { data: units } = await supabase.from("lodging_units").select("id, name, location_id").in("id", unitIds);
      const locIds = [...new Set((units ?? []).map(u => u.location_id))];
      const { data: locs } = await supabase.from("lodging_locations").select("id, name").in("id", locIds);
      const unitMap = Object.fromEntries((units ?? []).map(u => [u.id, u]));
      const locMap = Object.fromEntries((locs ?? []).map(l => [l.id, l]));
      const active = data.find(d => d.status === "checked_in" || (d.checked_in_at && !d.checked_out_at));
      const enriched = data.map(d => {
        const unit = unitMap[d.unit_id];
        const loc = unit ? locMap[unit.location_id] : null;
        return { ...d, unitName: unit?.name ?? "?", locationName: loc?.name ?? "" };
      });
      return { active: active ? enriched.find(e => e.id === active.id) : null, all: enriched };
    },
  });

  // --- Last meal ---
  const { data: lastMeal, isLoading: loadingMeal } = useQuery({
    queryKey: ["tracking_meals", participantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("meal_consumptions")
        .select("id, consumed_at, meal_window_id")
        .eq("participant_id", participantId)
        .order("consumed_at", { ascending: false })
        .limit(1);
      if (!data || data.length === 0) return null;
      const { data: mw } = await supabase.from("meal_windows").select("id, label").eq("id", data[0].meal_window_id).maybeSingle();
      return { consumedAt: data[0].consumed_at, label: mw?.label ?? "Refeição" };
    },
  });

  // --- Next match ---
  const { data: nextMatch, isLoading: loadingMatch } = useQuery({
    queryKey: ["tracking_next_match", participantId],
    queryFn: async () => {
      const now = new Date().toISOString();
      // find participant's sport events
      const { data: pse } = await supabase
        .from("participant_sport_events")
        .select("id, sport_event_id")
        .eq("participant_id", participantId);
      if (!pse || pse.length === 0) return null;
      const pseIds = pse.map(p => p.id);
      // find entries for this participant
      const { data: entries } = await supabase
        .from("competition_match_entries")
        .select("match_id")
        .in("participant_sport_event_id", pseIds);
      if (!entries || entries.length === 0) return null;
      const matchIds = [...new Set(entries.map(e => e.match_id))];
      const { data: matches } = await supabase
        .from("competition_matches")
        .select("id, match_date, start_time, status, sport_event_id")
        .in("id", matchIds)
        .in("status", ["scheduled", "in_progress"])
        .order("match_date", { ascending: true })
        .limit(1);
      if (!matches || matches.length === 0) return null;
      const m = matches[0];
      // get sport name
      const { data: se } = await supabase.from("sport_events").select("id, sport_id, category_id").eq("id", m.sport_event_id!).maybeSingle();
      let sportName = "";
      if (se) {
        const { data: sport } = await supabase.from("sports").select("name").eq("id", se.sport_id).maybeSingle();
        sportName = sport?.name ?? "";
      }
      return { matchDate: m.match_date, startTime: m.start_time, sportName };
    },
  });

  // --- Timeline: lodging events ---
  const { data: lodgingEvents = [] } = useQuery({
    queryKey: ["timeline_lodging", participantId],
    queryFn: async () => {
      const items: TimelineItem[] = [];
      if (!currentLodging?.all) return items;
      for (const occ of currentLodging.all) {
        if (occ.checked_in_at) {
          items.push({ id: `li-${occ.id}`, type: "lodging", timestamp: occ.checked_in_at, description: `Check-in ${occ.unitName} - ${occ.locationName}` });
        }
        if (occ.checked_out_at) {
          items.push({ id: `lo-${occ.id}`, type: "lodging", timestamp: occ.checked_out_at, description: `Check-out ${occ.unitName} - ${occ.locationName}` });
        }
      }
      return items;
    },
    enabled: !!currentLodging,
  });

  // --- Timeline: meals ---
  const { data: mealEvents = [] } = useQuery({
    queryKey: ["timeline_meals", participantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("meal_consumptions")
        .select("id, consumed_at, meal_window_id")
        .eq("participant_id", participantId)
        .order("consumed_at", { ascending: false });
      if (!data) return [];
      const mwIds = [...new Set(data.map(d => d.meal_window_id))];
      const { data: mws } = await supabase.from("meal_windows").select("id, label").in("id", mwIds);
      const mwMap = Object.fromEntries((mws ?? []).map(m => [m.id, m.label]));
      return data.map(d => ({
        id: `meal-${d.id}`,
        type: "meal" as const,
        timestamp: d.consumed_at,
        description: `Consumiu ${mwMap[d.meal_window_id] ?? "Refeição"}`,
      }));
    },
  });

  // --- Timeline: transport ---
  const { data: transportEvents = [] } = useQuery({
    queryKey: ["timeline_transport", participantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("transport_passengers")
        .select("id, boarded_at, trip_id")
        .eq("participant_id", participantId)
        .not("boarded_at", "is", null)
        .order("boarded_at", { ascending: false });
      if (!data || data.length === 0) return [];
      const tripIds = [...new Set(data.map(d => d.trip_id))];
      const { data: trips } = await supabase.from("transport_trips").select("id, route_id").in("id", tripIds);
      const routeIds = [...new Set((trips ?? []).map(t => t.route_id))];
      const { data: routes } = await supabase.from("transport_routes").select("id, origin, destination").in("id", routeIds);
      const tripMap = Object.fromEntries((trips ?? []).map(t => [t.id, t]));
      const routeMap = Object.fromEntries((routes ?? []).map(r => [r.id, r]));
      return data.map(d => {
        const trip = tripMap[d.trip_id];
        const route = trip ? routeMap[trip.route_id] : null;
        const desc = route ? `Embarcou: ${route.origin} → ${route.destination}` : "Embarque registrado";
        return { id: `tp-${d.id}`, type: "transport" as const, timestamp: d.boarded_at!, description: desc };
      });
    },
  });

  // --- Timeline: competition lineups ---
  const { data: competitionEvents = [] } = useQuery({
    queryKey: ["timeline_competition", participantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("match_lineups")
        .select("id, created_at, match_id")
        .eq("participant_id", participantId)
        .order("created_at", { ascending: false });
      if (!data || data.length === 0) return [];
      const matchIds = [...new Set(data.map(d => d.match_id))];
      const { data: matches } = await supabase.from("competition_matches").select("id, match_date, sport_event_id").in("id", matchIds);
      const seIds = [...new Set((matches ?? []).filter(m => m.sport_event_id).map(m => m.sport_event_id!))];
      let sportMap: Record<string, string> = {};
      if (seIds.length > 0) {
        const { data: ses } = await supabase.from("sport_events").select("id, sport_id").in("id", seIds);
        const sportIds = [...new Set((ses ?? []).map(s => s.sport_id))];
        const { data: sports } = await supabase.from("sports").select("id, name").in("id", sportIds);
        const sMap = Object.fromEntries((sports ?? []).map(s => [s.id, s.name]));
        const seMap = Object.fromEntries((ses ?? []).map(s => [s.id, sMap[s.sport_id] ?? ""]));
        sportMap = seMap;
      }
      const matchMap = Object.fromEntries((matches ?? []).map(m => [m.id, m]));
      return data.map(d => {
        const match = matchMap[d.match_id];
        const sportName = match?.sport_event_id ? sportMap[match.sport_event_id] ?? "" : "";
        return {
          id: `comp-${d.id}`,
          type: "competition" as const,
          timestamp: d.created_at,
          description: `Escalado: ${sportName || "Partida"}${match?.match_date ? ` (${format(new Date(match.match_date), "dd/MM")})` : ""}`,
        };
      });
    },
  });

  // --- Participant contacts ---
  const { data: participant } = useQuery({
    queryKey: ["participant_contacts", participantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("participants")
        .select("guardian_name, guardian_phone, coach_name, coach_phone")
        .eq("id", participantId)
        .single();
      return data;
    },
  });

  // Merge & filter timeline
  const timeline = useMemo(() => {
    let items: TimelineItem[] = [];
    if (filters.lodging) items = items.concat(lodgingEvents);
    if (filters.meal) items = items.concat(mealEvents);
    if (filters.transport) items = items.concat(transportEvents);
    if (filters.competition) items = items.concat(competitionEvents);

    if (period !== "all") {
      const days = period === "today" ? 0 : period === "3days" ? 3 : 7;
      const cutoff = startOfDay(subDays(new Date(), days));
      items = items.filter(i => isAfter(new Date(i.timestamp), cutoff));
    }

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return items;
  }, [lodgingEvents, mealEvents, transportEvents, competitionEvents, filters, period]);

  const isLoading = loadingLodging || loadingMeal || loadingMatch;

  const iconMap = {
    lodging: <BedDouble className="h-4 w-4 text-info" />,
    meal: <UtensilsCrossed className="h-4 w-4 text-success" />,
    transport: <Bus className="h-4 w-4 text-warning" />,
    competition: <Trophy className="h-4 w-4 text-primary" />,
  };

  return (
    <div className="mt-4 space-y-4">
      {/* Current location card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" /> Localização Atual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <>
              <div className="flex items-center gap-2">
                <BedDouble className="h-4 w-4 text-muted-foreground" />
                {currentLodging?.active ? (
                  <>
                    <span>{currentLodging.active.unitName} - {currentLodging.active.locationName}</span>
                    <Badge variant="success">Hospedado</Badge>
                  </>
                ) : (
                  <span className="text-muted-foreground">Sem alojamento ativo</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                {lastMeal ? (
                  <span>{lastMeal.label} às {format(new Date(lastMeal.consumedAt), "HH:mm")}</span>
                ) : (
                  <span className="text-muted-foreground">Nenhuma refeição hoje</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-muted-foreground" />
                {nextMatch ? (
                  <span>
                    {nextMatch.sportName} {nextMatch.matchDate ? format(new Date(nextMatch.matchDate), "dd/MM", { locale: ptBR }) : ""}{" "}
                    {nextMatch.startTime ? nextMatch.startTime.slice(0, 5) : ""}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Nenhuma partida agendada</span>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        {/* Timeline column */}
        <div className="space-y-3">
          {/* Filters */}
          <Card>
            <CardContent className="pt-4 pb-3 flex flex-wrap items-center gap-4">
              {([
                { key: "lodging", label: "Alojamento", id: lodgingFilterId },
                { key: "meal", label: "Alimentação", id: mealFilterId },
                { key: "transport", label: "Transporte", id: transportFilterId },
                { key: "competition", label: "Competição", id: competitionFilterId },
              ] as const).map(({ key, label, id }) => (
                <div key={key} className="flex items-center gap-1.5 text-sm">
                  <Checkbox
                    id={id}
                    checked={filters[key]}
                    onCheckedChange={v => setFilters(f => ({ ...f, [key]: !!v }))}
                  />
                  <Label htmlFor={id} className="cursor-pointer">{label}</Label>
                </div>
              ))}
              <div>
                <Label id={periodLabelId} className="sr-only">Filtrar período</Label>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="w-[140px] h-8 text-sm" aria-labelledby={periodLabelId} aria-label="Filtrar período">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Hoje</SelectItem>
                    <SelectItem value="3days">3 dias</SelectItem>
                    <SelectItem value="week">Semana</SelectItem>
                    <SelectItem value="all">Todo evento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Timeline list */}
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma atividade encontrada.</p>
          ) : (
            <div className="space-y-1">
              {timeline.map(item => (
                <div key={item.id} className="flex items-start gap-3 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors">
                  <div className="mt-0.5">{iconMap[item.type]}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(item.timestamp), "dd/MM HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contacts sidebar */}
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Contatos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Responsável</span>
              {participant?.guardian_phone ? (
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="success" className="text-xs">{participant.guardian_name || "Responsável"}</Badge>
                  <a href={`tel:${participant.guardian_phone}`} className="text-primary underline flex items-center gap-1">
                    <Phone className="h-3 w-3" />{participant.guardian_phone}
                  </a>
                </div>
              ) : (
                <Badge variant="destructive" className="mt-0.5 text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />Sem contato
                </Badge>
              )}
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Professor/Técnico</span>
              {participant?.coach_phone ? (
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="warning" className="text-xs">{participant.coach_name || "Professor"}</Badge>
                  <a href={`tel:${participant.coach_phone}`} className="text-primary underline flex items-center gap-1">
                    <Phone className="h-3 w-3" />{participant.coach_phone}
                  </a>
                </div>
              ) : (
                <Badge variant="outline" className="mt-0.5 text-xs">Sem contato</Badge>
              )}
            </div>
            <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => setContactModalOpen(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1" /> Editar Contatos
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Edit contacts modal */}
      <EditContactsDialog
        open={contactModalOpen}
        onOpenChange={setContactModalOpen}
        participantId={participantId}
        initial={participant}
      />
    </div>
  );
}

function EditContactsDialog({ open, onOpenChange, participantId, initial }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  participantId: string;
  initial?: { guardian_name: string | null; guardian_phone: string | null; coach_name: string | null; coach_phone: string | null } | null;
}) {
  const [contactType, setContactType] = useState<"guardian" | "coach">("guardian");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const contactTypeLabelId = useId();
  const guardianRadioId = useId();
  const coachRadioId = useId();
  const nameInputId = useId();
  const phoneInputId = useId();

  const handleSave = async () => {
    if (!name.trim() || !phone.trim()) {
      toast({ title: "Preencha nome e telefone", variant: "destructive" });
      return;
    }
    setSaving(true);
    const update = contactType === "guardian"
      ? { guardian_name: name.trim(), guardian_phone: phone.trim() }
      : { coach_name: name.trim(), coach_phone: phone.trim() };
    const { error } = await supabase.from("participants").update(update).eq("id", participantId);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: String(error.message), variant: "destructive" });
    } else {
      toast({ title: "Contato salvo!" });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cadastrar Contato</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label id={contactTypeLabelId}>Tipo de contato</Label>
          <RadioGroup value={contactType} onValueChange={v => setContactType(v as "guardian" | "coach")} className="flex gap-4" aria-labelledby={contactTypeLabelId}>
            <div className="flex items-center gap-1.5 text-sm">
              <RadioGroupItem id={guardianRadioId} value="guardian" />
              <Label htmlFor={guardianRadioId} className="cursor-pointer">Responsável Legal</Label>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <RadioGroupItem id={coachRadioId} value="coach" />
              <Label htmlFor={coachRadioId} className="cursor-pointer">Professor/Técnico</Label>
            </div>
          </RadioGroup>
        </div>
        <div className="space-y-3 mt-2">
          <div>
            <Label htmlFor={nameInputId}>Nome</Label>
            <Input id={nameInputId} name="contactName" value={name} onChange={e => setName(e.target.value)} placeholder="Nome completo" />
          </div>
          <div>
            <Label htmlFor={phoneInputId}>Telefone</Label>
            <Input id={phoneInputId} name="contactPhone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(99) 99999-9999" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
