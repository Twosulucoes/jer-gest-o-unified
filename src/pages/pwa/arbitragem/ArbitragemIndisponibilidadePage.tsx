import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEventContext } from "@/contexts/EventContext";
import { usePwaAudit } from "@/hooks/usePwaAudit";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import PwaLayout from "@/components/pwa/PwaLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Clock, MapPin, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";

interface IndisponibilidadeRow {
  id: string;
  role: string;
  reported_at: string | null;
  indisponibility_reason: string | null;
  match_date: string | null;
  start_time: string | null;
  sport_name: string | null;
  category_name: string | null;
  venue_name: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  arbitro_principal: "Árbitro Principal",
  arbitro_auxiliar: "Auxiliar",
  mesario: "Mesário",
  fiscal: "Fiscal",
  anotador: "Anotador",
};

function formatDateTime(date: string | null, time: string | null) {
  if (!date) return "Data a definir";
  try {
    const d = format(parseISO(date), "dd/MM");
    return time ? `${d} ${time.slice(0, 5)}` : d;
  } catch {
    return date;
  }
}

export default function ArbitragemIndisponibilidadePage() {
  const { user } = useAuth();
  const { activeEventId } = useEventContext();
  const qc = useQueryClient();
  usePwaAudit("arbitragem/indisponibilidade");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pwa-arb-indisponibilidades", user?.id, activeEventId],
    enabled: !!user?.id && !!activeEventId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("match_user_assignments")
        .select(`
          id, role, indisponibility_reason, reported_at,
          competition_matches!inner(
            match_date, start_time,
            sport_events(sports(name), categories(name)),
            venues(name)
          )
        `)
        .eq("user_id", user!.id)
        .eq("event_id", activeEventId!)
        .eq("acceptance_status", "unavailable")
        .order("reported_at", { ascending: false });
      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        id: row.id,
        role: row.role,
        indisponibility_reason: row.indisponibility_reason,
        reported_at: row.reported_at,
        match_date: row.competition_matches?.match_date ?? null,
        start_time: row.competition_matches?.start_time ?? null,
        sport_name: row.competition_matches?.sport_events?.sports?.name ?? null,
        category_name: row.competition_matches?.sport_events?.categories?.name ?? null,
        venue_name: row.competition_matches?.venues?.name ?? null,
      })) as IndisponibilidadeRow[];
    },
  });

  // Sincronização em tempo real: novo report de indisponibilidade feito em
  // outro dispositivo deve aparecer aqui sem refresh manual.
  useRealtimeSync({
    channelName: `pwa-arb-indisponibilidade-${user?.id}`,
    tables: [
      { table: "match_user_assignments", filter: `user_id=eq.${user?.id}` },
    ],
    onChange: () => {
      qc.invalidateQueries({ queryKey: ["pwa-arb-indisponibilidades", user?.id, activeEventId] });
    },
    enabled: !!user?.id && !!activeEventId,
    debounceMs: 400,
  });

  return (
    <PwaLayout backTo="/pwa/arbitragem" moduleTitle="Indisponibilidades">
      <main className="p-4 max-w-md mx-auto space-y-4">
        <Card className="border-amber-500/40 bg-amber-50 dark:bg-amber-950/10">
          <CardContent className="p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Histórico das partidas que você reportou como indisponível neste evento. Para cancelar uma indisponibilidade
              já registrada, fale com a coordenação técnica — após o report, a coordenação pode ter agido na escala.
            </p>
          </CardContent>
        </Card>

        {isLoading ? (
          <>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
              Nenhuma indisponibilidade reportada.
            </CardContent>
          </Card>
        ) : (
          rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-3 space-y-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">
                    {r.sport_name ?? "Modalidade"}
                    {r.category_name && (
                      <span className="font-normal text-muted-foreground"> · {r.category_name}</span>
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {ROLE_LABEL[r.role] ?? r.role}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDateTime(r.match_date, r.start_time)}
                  </span>
                  {r.venue_name && (
                    <span className="inline-flex items-center gap-1 truncate">
                      <MapPin className="h-3 w-3" />
                      {r.venue_name}
                    </span>
                  )}
                </div>

                {r.indisponibility_reason && (
                  <div className="text-[11px] rounded border border-destructive/30 bg-destructive/5 p-2">
                    <span className="font-medium">Motivo:</span> {r.indisponibility_reason}
                  </div>
                )}

                {r.reported_at && (
                  <p className="text-[10px] text-muted-foreground">
                    Reportada em {format(parseISO(r.reported_at), "dd/MM HH:mm")}
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </PwaLayout>
  );
}
