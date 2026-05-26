import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PwaLayout from "@/components/pwa/PwaLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UtensilsCrossed, UserX, CheckCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { useEventContext } from "@/contexts/EventContext";
import { usePwaAudit } from "@/hooks/usePwaAudit";

interface MealWindowRow {
  id: string;
  service_date: string;
  start_time: string;
  end_time: string;
  meal_type_id: string;
  label: string | null;
  meal_types: { name: string } | null;
  meal_locations: { name: string } | null;
  meal_window_eligibility: Array<{
    eligibility_type: string;
    participant_type_value: string | null;
    reference_id: string | null;
  }> | null;
}

interface ConsumptionRow {
  id: string;
  participant_id: string;
  meal_window_id: string;
  consumed_at: string;
  method: string;
}

interface ParticipantRow {
  id: string;
  participant_type: string;
  delegation_id: string | null;
  is_active: boolean;
  needs_meals: boolean;
  credentialed_at: string | null;
  left_event_at: string | null;
  delegations: { institution_id: string | null; institutions: { name: string | null } | null } | null;
  people: { full_name: string | null } | null;
}

export default function DelegacaoAlimentacaoPage() {
  const { activeEventId } = useEventContext();
  usePwaAudit("delegacao/alimentacao");

  const [filterDate, setFilterDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [delegationId, setDelegationId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("user_delegations")
        .select("delegation_id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      setDelegationId(data?.delegation_id ?? null);
    })();
  }, []);

  // Janelas do dia para o evento (lê via RLS aberta para delegacao)
  const { data: windows = [], isLoading: loadingWindows } = useQuery<MealWindowRow[]>({
    queryKey: ["delegacao_meal_windows", activeEventId, filterDate],
    enabled: !!activeEventId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("meal_windows")
        .select(`
          id, service_date, start_time, end_time, meal_type_id, label,
          meal_types(name), meal_locations(name),
          meal_window_eligibility(eligibility_type, participant_type_value, reference_id)
        `)
        .eq("event_id", activeEventId)
        .eq("service_date", filterDate)
        .eq("is_active", true)
        .order("start_time");
      if (error) throw error;
      return (data ?? []) as MealWindowRow[];
    },
  });

  // Atletas/staff da delegação (RLS já filtra por delegação)
  const { data: participants = [], isLoading: loadingParts } = useQuery<ParticipantRow[]>({
    queryKey: ["delegacao_participants", delegationId, activeEventId],
    enabled: !!delegationId && !!activeEventId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("participants")
        .select(`
          id, participant_type, delegation_id, is_active, needs_meals,
          credentialed_at, left_event_at,
          delegations(institution_id, institutions(name)),
          people(full_name)
        `)
        .eq("event_id", activeEventId)
        .eq("delegation_id", delegationId);
      if (error) throw error;
      return (data ?? []) as ParticipantRow[];
    },
  });

  // Consumos do dia (RLS filtra por delegação)
  const windowIds = windows.map((w) => w.id);
  const { data: consumptions = [], isLoading: loadingCons } = useQuery<ConsumptionRow[]>({
    queryKey: ["delegacao_meal_consumptions", windowIds.join(","), delegationId],
    enabled: windowIds.length > 0 && !!delegationId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("meal_consumptions")
        .select("id, participant_id, meal_window_id, consumed_at, method")
        .in("meal_window_id", windowIds)
        .eq("status", "active")
        .order("consumed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ConsumptionRow[];
    },
  });

  // Presença efetiva da delegação na data
  const presentParticipants = useMemo(
    () =>
      participants.filter((p) => {
        if (!p.is_active || !p.needs_meals) return false;
        const credDate = p.credentialed_at?.slice(0, 10);
        if (!credDate || credDate > filterDate) return false;
        if (p.left_event_at) {
          const leftDate = p.left_event_at.slice(0, 10);
          if (leftDate <= filterDate) return false;
        }
        return true;
      }),
    [participants, filterDate],
  );

  // Ausências por janela: presente + elegível + sem consumo
  const ausencias = useMemo(() => {
    const out: Array<{ id: string; participant: ParticipantRow; window: MealWindowRow }> = [];
    for (const win of windows) {
      const rules = win.meal_window_eligibility ?? [];
      const consumedSet = new Set(
        consumptions.filter((c) => c.meal_window_id === win.id).map((c) => c.participant_id),
      );
      for (const p of presentParticipants) {
        let isEligible = rules.length === 0;
        if (rules.length > 0) {
          isEligible = rules.some((r) => {
            if (r.eligibility_type === "participant_type") return p.participant_type === r.participant_type_value;
            if (r.eligibility_type === "delegation") return p.delegation_id === r.reference_id;
            if (r.eligibility_type === "institution") return p.delegations?.institution_id === r.reference_id;
            return false;
          });
        }
        if (isEligible && !consumedSet.has(p.id)) {
          out.push({ id: `${win.id}-${p.id}`, participant: p, window: win });
        }
      }
    }
    return out;
  }, [windows, presentParticipants, consumptions]);

  const partMap = useMemo(() => new Map(participants.map((p) => [p.id, p])), [participants]);
  const winMap = useMemo(() => new Map(windows.map((w) => [w.id, w])), [windows]);

  const isLoading = loadingWindows || loadingParts || loadingCons;

  return (
    <PwaLayout backTo="/pwa/delegacao" moduleTitle="Alimentação da Delegação">
      <main className="p-4 max-w-md mx-auto space-y-4">
        {!delegationId && !loadingParts && (
          <Card className="border-amber/40">
            <CardContent className="p-4 text-center text-sm text-muted-foreground">
              Nenhuma delegação vinculada ao seu perfil.
            </CardContent>
          </Card>
        )}

        <div className="space-y-1">
          <label className="text-xs font-medium uppercase text-muted-foreground">
            Data de Serviço
          </label>
          <Input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-2">
          <Card>
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Presentes</p>
              <p className="text-2xl font-bold leading-tight">
                {loadingParts ? "…" : presentParticipants.length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Consumos</p>
              <p className="text-2xl font-bold leading-tight text-primary">
                {loadingCons ? "…" : consumptions.length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Ausências</p>
              <p className="text-2xl font-bold leading-tight text-amber-600">
                {isLoading ? "…" : ausencias.length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Janelas do dia */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
            Janelas de hoje
          </h2>
          {loadingWindows ? (
            <Skeleton className="h-20 w-full" />
          ) : windows.length === 0 ? (
            <Card>
              <CardContent className="p-4 text-center text-sm text-muted-foreground">
                Nenhuma janela ativa para a data selecionada.
              </CardContent>
            </Card>
          ) : (
            windows.map((w) => {
              const total = consumptions.filter((c) => c.meal_window_id === w.id).length;
              return (
                <Card key={w.id}>
                  <CardContent className="p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {w.label || w.meal_types?.name || "Refeição"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {w.start_time.slice(0, 5)}–{w.end_time.slice(0, 5)}
                        {w.meal_locations?.name ? ` · ${w.meal_locations.name}` : ""}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {total} consumo{total === 1 ? "" : "s"}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })
          )}
        </section>

        {/* Consumos */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
            Consumos registrados
          </h2>
          {loadingCons ? (
            <Skeleton className="h-20 w-full" />
          ) : consumptions.length === 0 ? (
            <Card>
              <CardContent className="p-4 text-center text-sm text-muted-foreground">
                Nenhum consumo registrado nesta data para sua delegação.
              </CardContent>
            </Card>
          ) : (
            consumptions.map((c) => {
              const p = partMap.get(c.participant_id);
              const w = winMap.get(c.meal_window_id);
              return (
                <Card key={c.id}>
                  <CardContent className="p-3 flex items-start gap-3">
                    <CheckCircle className="h-4 w-4 mt-0.5 shrink-0 text-emerald-500" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {p?.people?.full_name ?? "—"}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {w?.label || w?.meal_types?.name || "Refeição"} ·{" "}
                        {format(new Date(c.consumed_at), "HH:mm")} · {c.method}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </section>

        {/* Ausências */}
        {ausencias.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-amber-500" />
              Atletas presentes que não consumiram
            </h2>
            {ausencias.slice(0, 100).map((a) => (
              <Card key={a.id} className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="p-3 flex items-start gap-3">
                  <UserX className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {a.participant.people?.full_name ?? "—"}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {a.window.label || a.window.meal_types?.name || "Refeição"} ·{" "}
                      {a.window.start_time.slice(0, 5)}–{a.window.end_time.slice(0, 5)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
            {ausencias.length > 100 && (
              <p className="text-center text-[11px] text-muted-foreground">
                Mostrando primeiras 100 ausências.
              </p>
            )}
          </section>
        )}

        {/* Empty state geral */}
        {!isLoading &&
          windows.length === 0 &&
          consumptions.length === 0 &&
          ausencias.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                <UtensilsCrossed className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Sem dados de alimentação para esta data.
              </CardContent>
            </Card>
          )}
      </main>
    </PwaLayout>
  );
}
