import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEventContext } from "@/contexts/EventContext";
import { usePwaAudit } from "@/hooks/usePwaAudit";
import { PwaContainer } from "@/components/pwa/PwaScreen";
import { PwaStatTriplet } from "@/components/pwa/PwaDashboardPrimitives";
import { PwaActionGrid } from "@/components/pwa/PwaActionGrid";
import { PwaListItem } from "@/components/pwa/PwaListItem";
import {
  Calendar, Clock, MapPin, Radio, ShieldCheck, AlertTriangle, ChevronRight,
} from "lucide-react";
import { format, parseISO } from "date-fns";

interface AssignmentRow {
  id: string;
  match_id: string;
  role: string;
  acceptance_status: string | null;
  match_date: string | null;
  start_time: string | null;
  match_status: string | null;
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

export default function ArbitragemHomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeEventId } = useEventContext();
  const [refereeStatus, setRefereeStatus] = useState<string | null>(null);
  usePwaAudit("arbitragem");

  // Status do cadastro técnico (referee_profiles)
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("referee_profiles")
        .select("status, cpf, rne")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!data) {
        setRefereeStatus("incomplete");
      } else if (!data.cpf && !data.rne) {
        setRefereeStatus("missing-doc");
      } else {
        setRefereeStatus(data.status ?? "Ativo");
      }
    })();
  }, [user?.id]);

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["pwa-arb-home-assignments", user?.id, activeEventId],
    enabled: !!user?.id && !!activeEventId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("match_user_assignments")
        .select(`
          id, match_id, role, acceptance_status,
          competition_matches!inner(
            id, match_date, start_time, status,
            sport_events(sports(name), categories(name)),
            venues(name)
          )
        `)
        .eq("user_id", user!.id)
        .eq("event_id", activeEventId!);
      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        id: row.id,
        match_id: row.match_id,
        role: row.role,
        acceptance_status: row.acceptance_status,
        match_date: row.competition_matches?.match_date ?? null,
        start_time: row.competition_matches?.start_time ?? null,
        match_status: row.competition_matches?.status ?? null,
        sport_name: row.competition_matches?.sport_events?.sports?.name ?? null,
        category_name: row.competition_matches?.sport_events?.categories?.name ?? null,
        venue_name: row.competition_matches?.venues?.name ?? null,
      })) as AssignmentRow[];
    },
  });

  const kpis = useMemo(() => {
    const total = assignments.length;
    const confirmed = assignments.filter((a) => a.acceptance_status === "confirmed").length;
    const pending = assignments.filter(
      (a) => !a.acceptance_status || a.acceptance_status === "pending",
    ).length;
    return { total, confirmed, pending };
  }, [assignments]);

  // Próximas designações (futuras + sem data ainda)
  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return assignments
      .filter((a) => a.acceptance_status !== "unavailable")
      .filter((a) => !a.match_date || a.match_date >= today)
      .sort((a, b) => {
        const ax = `${a.match_date ?? "z"} ${a.start_time ?? ""}`;
        const bx = `${b.match_date ?? "z"} ${b.start_time ?? ""}`;
        return ax.localeCompare(bx);
      })
      .slice(0, 5);
  }, [assignments]);

  return (
    <PwaContainer>
      {/* Banner de cadastro incompleto */}
      {refereeStatus === "incomplete" && (
        <button
          type="button"
          onClick={() => navigate("/pwa/arbitragem/perfil")}
          className="op-card flex w-full items-center gap-3 border-amber-500/40 bg-amber-500/10 p-4 text-left transition-colors hover:bg-amber-500/15"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
              Cadastro técnico incompleto
            </p>
            <p className="text-xs text-muted-foreground">
              Complete seu perfil para receber designações.
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </button>
      )}
      {refereeStatus === "missing-doc" && (
        <button
          type="button"
          onClick={() => navigate("/pwa/arbitragem/perfil")}
          className="op-card flex w-full items-center gap-3 border-destructive/40 bg-destructive/10 p-4 text-left transition-colors hover:bg-destructive/15"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-destructive">CPF ou RNE pendente</p>
            <p className="text-xs text-muted-foreground">
              Sem documento, sua designação não pode ser confirmada.
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </button>
      )}

      {/* KPIs */}
      <PwaStatTriplet
        loading={isLoading}
        items={[
          { label: "Designações", value: kpis.total, tone: "module" },
          { label: "Confirmadas", value: kpis.confirmed, tone: "green" },
          { label: "Pendentes", value: kpis.pending, tone: "red" },
        ]}
      />

      {/* Próximas partidas */}
      {upcoming.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="op-label">Próximas partidas</span>
            <button
              onClick={() => navigate("/pwa/arbitragem/agenda")}
              className="text-[11px] font-semibold text-module hover:underline"
            >
              Ver agenda
            </button>
          </div>
          <div className="space-y-2">
            {upcoming.map((a) => (
              <PwaListItem
                key={a.id}
                leading={
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-module/15 text-module">
                    <Calendar className="h-5 w-5" />
                  </div>
                }
                title={
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold">{a.sport_name ?? "Modalidade"}</span>
                    {a.category_name && (
                      <span className="text-[10px] text-muted-foreground">
                        · {a.category_name}
                      </span>
                    )}
                  </span>
                }
                subtitle={
                  <span className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDateTime(a.match_date, a.start_time)}
                    </span>
                    {a.venue_name && (
                      <span className="inline-flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3" />
                        {a.venue_name}
                      </span>
                    )}
                    <span className="opacity-70">{ROLE_LABEL[a.role] ?? a.role}</span>
                  </span>
                }
                status={{
                  label:
                    a.acceptance_status === "confirmed"
                      ? "OK"
                      : a.acceptance_status === "unavailable"
                      ? "Indisp."
                      : "Pendente",
                  tone:
                    a.acceptance_status === "confirmed"
                      ? "ok"
                      : a.acceptance_status === "unavailable"
                      ? "danger"
                      : "pending",
                }}
                onClick={() => navigate("/pwa/arbitragem/agenda")}
              />
            ))}
          </div>
        </div>
      )}

      {/* Atalhos */}
      <PwaActionGrid
        actions={[
          { label: "Minha Agenda", icon: Calendar, to: "/pwa/arbitragem/agenda" },
          { label: "Indisponibilidades", icon: AlertTriangle, to: "/pwa/arbitragem/indisponibilidade" },
          { label: "Meu Perfil", icon: ShieldCheck, to: "/pwa/arbitragem/perfil" },
          { label: "Ao Vivo", icon: Radio, to: "/pwa/resultados" },
        ]}
      />
    </PwaContainer>
  );
}
