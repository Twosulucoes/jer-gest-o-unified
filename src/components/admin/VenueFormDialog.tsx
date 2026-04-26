import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { Tables } from "@/integrations/supabase/types";
import { Layers, AlertTriangle, CalendarClock } from "lucide-react";

const VENUE_TYPE_OPTIONS = [
  { value: "arena", label: "Arena" },
  { value: "gymnasium", label: "Ginásio" },
  { value: "field", label: "Campo" },
  { value: "pool", label: "Piscina" },
  { value: "court", label: "Quadra" },
  { value: "track", label: "Pista" },
  { value: "other", label: "Outro" },
];

const venueSchema = z.object({
  event_id: z.string().min(1, "Selecione um evento"),
  event_stage_ids: z.array(z.string()).min(1, "Vincule o local a pelo menos uma etapa"),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  venue_type: z.string().min(1, "Selecione o tipo"),
  city: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  is_active: z.boolean(),
});

export type VenueFormValues = z.infer<typeof venueSchema>;

interface VenueFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venue?: (Tables<"venues"> & { event_stage_ids?: string[] }) | null;
  events: Tables<"events">[];
  onSubmit: (values: VenueFormValues) => void;
  isPending: boolean;
}

export default function VenueFormDialog({
  open, onOpenChange, venue, events, onSubmit, isPending,
}: VenueFormDialogProps) {
  const isEditing = !!venue;

  const form = useForm<VenueFormValues>({
    resolver: zodResolver(venueSchema),
    defaultValues: {
      event_id: "",
      event_stage_ids: [],
      name: "",
      venue_type: "arena",
      city: "",
      address: "",
      is_active: true,
    },
  });

  const selectedEventId = form.watch("event_id");
  const selectedStageIds = form.watch("event_stage_ids");

  const { data: stages = [] } = useQuery({
    queryKey: ["event_stages_with_host", selectedEventId],
    enabled: !!selectedEventId && open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("event_stages")
        .select("id, name, status, sort_order, host_name, host_city, starts_at, ends_at, event_id")
        .eq("event_id", selectedEventId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string; name: string; status: string; sort_order: number;
        host_name: string | null; host_city: string | null;
        starts_at: string | null; ends_at: string | null;
        event_id: string;
      }>;
    },
  });

  // Partidas já agendadas neste venue (para detectar conflito de escopo de etapas)
  const { data: scheduledMatches = [] } = useQuery({
    queryKey: ["venue-matches-scope", venue?.id],
    enabled: !!venue?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_matches")
        .select("id, match_date, sport_event_id, sport_events(sports(name))")
        .eq("venue_id", venue!.id)
        .not("match_date", "is", null);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string; match_date: string;
        sport_event_id: string;
        sport_events: { sports: { name: string } | null } | null;
      }>;
    },
  });

  // Carrega vínculos atuais quando editando
  const { data: existingLinks } = useQuery({
    queryKey: ["venue_event_stages", venue?.id],
    enabled: !!venue?.id && open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("venue_event_stages")
        .select("event_stage_id")
        .eq("venue_id", venue!.id);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.event_stage_id as string);
    },
  });

  useEffect(() => {
    if (venue) {
      form.reset({
        event_id: venue.event_id,
        event_stage_ids: existingLinks ?? venue.event_stage_ids ?? [],
        name: venue.name,
        venue_type: venue.venue_type,
        city: venue.city ?? "",
        address: venue.address ?? "",
        is_active: venue.is_active,
      });
    } else {
      form.reset({
        event_id: events.length === 1 ? events[0].id : "",
        event_stage_ids: [],
        name: "",
        venue_type: "arena",
        city: "",
        address: "",
        is_active: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venue, events, existingLinks?.join(",")]);

  // Pré-seleciona a etapa ativa ao criar (se ainda não houver seleção)
  useEffect(() => {
    if (isEditing) return;
    if (!stages.length) return;
    if ((form.getValues("event_stage_ids") ?? []).length > 0) return;
    const active = stages.find((s) => s.status === "active");
    if (active) form.setValue("event_stage_ids", [active.id], { shouldValidate: true });
  }, [stages, isEditing, form]);

  const toggleStage = (stageId: string, checked: boolean) => {
    const current = form.getValues("event_stage_ids") ?? [];
    const next = checked ? [...current, stageId] : current.filter((id) => id !== stageId);
    form.setValue("event_stage_ids", next, { shouldValidate: true, shouldDirty: true });
  };

  // ─── Detecção de conflitos ────────────────────────────────────────
  const conflicts = useMemo(() => {
    const result = {
      crossEvent: [] as string[],         // BLOQUEIO: etapa de outro evento
      overlapping: [] as Array<{ a: string; b: string; range: string }>, // ALERTA: etapas marcadas com datas sobrepostas
      orphanMatches: [] as Array<{ date: string; sport: string }>,        // ALERTA: partidas existentes fora do escopo
    };

    if (!selectedStageIds?.length) return result;

    const selectedStages = stages.filter((s) => selectedStageIds.includes(s.id));

    // 1) Cross-event (hard block)
    for (const s of selectedStages) {
      if (s.event_id !== selectedEventId) {
        result.crossEvent.push(s.name);
      }
    }

    // 2) Sobreposição de datas entre etapas selecionadas
    for (let i = 0; i < selectedStages.length; i++) {
      for (let j = i + 1; j < selectedStages.length; j++) {
        const A = selectedStages[i];
        const B = selectedStages[j];
        const aStart = A.starts_at ? new Date(A.starts_at).getTime() : null;
        const aEnd = A.ends_at ? new Date(A.ends_at).getTime() : null;
        const bStart = B.starts_at ? new Date(B.starts_at).getTime() : null;
        const bEnd = B.ends_at ? new Date(B.ends_at).getTime() : null;
        if (aStart == null || aEnd == null || bStart == null || bEnd == null) continue;
        if (aStart <= bEnd && bStart <= aEnd) {
          const fmt = (d: number) => new Date(d).toLocaleDateString("pt-BR");
          const ovStart = Math.max(aStart, bStart);
          const ovEnd = Math.min(aEnd, bEnd);
          result.overlapping.push({
            a: A.name,
            b: B.name,
            range: `${fmt(ovStart)} → ${fmt(ovEnd)}`,
          });
        }
      }
    }

    // 3) Partidas já agendadas que caem fora do range de qualquer etapa marcada
    if (scheduledMatches.length > 0 && selectedStages.length > 0) {
      const ranges = selectedStages
        .map((s) => ({
          start: s.starts_at ? new Date(s.starts_at).getTime() : null,
          end: s.ends_at ? new Date(s.ends_at).getTime() : null,
        }))
        .filter((r) => r.start != null && r.end != null) as Array<{ start: number; end: number }>;

      if (ranges.length > 0) {
        for (const m of scheduledMatches) {
          const t = new Date(m.match_date).getTime();
          const inside = ranges.some((r) => t >= r.start && t <= r.end);
          if (!inside) {
            result.orphanMatches.push({
              date: new Date(m.match_date).toLocaleDateString("pt-BR"),
              sport: m.sport_events?.sports?.name ?? "—",
            });
          }
        }
      }
    }

    return result;
  }, [selectedStageIds, stages, selectedEventId, scheduledMatches]);

  const hasBlockingConflict = conflicts.crossEvent.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Local" : "Novo Local"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Atualize os dados do local." : "Preencha os dados para criar um novo local."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="event_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Evento</FormLabel>
                  <Select
                    onValueChange={(v) => {
                      field.onChange(v);
                      form.setValue("event_stage_ids", []);
                    }}
                    value={field.value}
                    disabled={isEditing}
                  >
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Selecione o evento" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {events.map((ev) => (
                        <SelectItem key={ev.id} value={ev.id}>{ev.name} ({ev.year})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="event_stage_ids"
              render={() => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    <Layers className="h-4 w-4" />
                    Etapas atendidas
                    <span className="text-destructive" aria-label="obrigatório">*</span>
                  </FormLabel>
                  <FormDescription>
                    Marque <strong>todas as etapas</strong> em que este local será utilizado.
                    Cada etapa tem uma sede (ex: cidade), e um mesmo local pode atender etapas diferentes.
                  </FormDescription>
                  {!selectedEventId ? (
                    <p className="text-xs text-muted-foreground p-3 border rounded-md">
                      Selecione um evento primeiro.
                    </p>
                  ) : !stages.length ? (
                    <p className="text-xs text-muted-foreground p-3 border rounded-md">
                      Nenhuma etapa cadastrada para este evento.
                    </p>
                  ) : (
                    <div className="space-y-2 border rounded-md p-3 max-h-64 overflow-y-auto">
                      {stages.map((s) => {
                        const checked = selectedStageIds?.includes(s.id);
                        const sede = s.host_name || s.host_city;
                        return (
                          <label
                            key={s.id}
                            className="flex items-start gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(c) => toggleStage(s.id, c === true)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium">{s.name}</span>
                                {s.status === "active" && (
                                  <Badge variant="default" className="text-[10px]">ATIVA</Badge>
                                )}
                              </div>
                              {sede ? (
                                <p className="text-xs text-muted-foreground">
                                  Sede: {sede}{s.host_name && s.host_city ? ` — ${s.host_city}` : ""}
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground italic">
                                  Sede não informada
                                </p>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {(selectedStageIds?.length ?? 0) > 0 && (
                    <p className="text-xs text-primary">
                      ✓ {selectedStageIds.length} etapa(s) selecionada(s).
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Painel de conflitos / incompatibilidades */}
            {(conflicts.crossEvent.length > 0 ||
              conflicts.overlapping.length > 0 ||
              conflicts.orphanMatches.length > 0) && (
              <div className="space-y-2">
                {conflicts.crossEvent.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Etapa de outro evento</AlertTitle>
                    <AlertDescription className="text-xs">
                      Não é possível vincular este local a etapas de outro evento:{" "}
                      <strong>{conflicts.crossEvent.join(", ")}</strong>. Remova-as antes de salvar.
                    </AlertDescription>
                  </Alert>
                )}
                {conflicts.overlapping.length > 0 && (
                  <Alert>
                    <CalendarClock className="h-4 w-4" />
                    <AlertTitle>Etapas com datas sobrepostas</AlertTitle>
                    <AlertDescription className="text-xs space-y-1">
                      <p>
                        O mesmo local não pode ocorrer simultaneamente em etapas diferentes.
                        Verifique:
                      </p>
                      <ul className="list-disc list-inside">
                        {conflicts.overlapping.map((o, i) => (
                          <li key={i}>
                            <strong>{o.a}</strong> × <strong>{o.b}</strong> — sobreposição em {o.range}
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
                {conflicts.orphanMatches.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Agenda existente fora do escopo</AlertTitle>
                    <AlertDescription className="text-xs space-y-1">
                      <p>
                        Este local já tem {conflicts.orphanMatches.length} partida(s) agendada(s) em datas
                        que não pertencem a nenhuma etapa selecionada:
                      </p>
                      <ul className="list-disc list-inside max-h-24 overflow-y-auto">
                        {conflicts.orphanMatches.slice(0, 8).map((m, i) => (
                          <li key={i}>{m.date} — {m.sport}</li>
                        ))}
                        {conflicts.orphanMatches.length > 8 && (
                          <li>… e mais {conflicts.orphanMatches.length - 8}</li>
                        )}
                      </ul>
                      <p className="text-muted-foreground">
                        Considere incluir a etapa correspondente ou remarcar essas partidas.
                      </p>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl><Input placeholder="Ginásio Municipal" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="venue_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {VENUE_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade do local</FormLabel>
                    <FormControl><Input placeholder="São Paulo" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço</FormLabel>
                    <FormControl><Input placeholder="Rua..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Ativo</FormLabel>
                    <FormDescription>Local disponível para uso no evento</FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Salvando..." : isEditing ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
