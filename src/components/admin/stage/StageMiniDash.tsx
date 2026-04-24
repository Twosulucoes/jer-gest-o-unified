import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Users, BadgeCheck, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { cn } from "@/lib/utils";

interface KPI {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  tone?: "default" | "primary" | "success" | "warning" | "danger";
}

interface StageMiniDashProps {
  /** KPIs específicos do módulo (até 4 itens). */
  moduleKpis?: KPI[];
  /** Esconde os KPIs gerais da etapa (default: false). */
  hideGlobal?: boolean;
  className?: string;
}

const TONE_TEXT: Record<NonNullable<KPI["tone"]>, string> = {
  default: "text-foreground",
  primary: "text-[hsl(var(--module-accent))]",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-destructive",
};

const TONE_PILL: Record<NonNullable<KPI["tone"]>, string> = {
  default: "bg-muted text-muted-foreground ring-border",
  primary: "bg-[hsl(var(--module-accent)/0.15)] text-[hsl(var(--module-accent))] ring-[hsl(var(--module-accent)/0.35)]",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
  danger: "bg-destructive/10 text-destructive ring-destructive/20",
};

/**
 * Barra fina híbrida exibida no topo das páginas dos módulos da etapa.
 * Mostra 2-3 KPIs gerais da etapa (sempre) + KPIs do módulo (opcional).
 */
export function StageMiniDash({ moduleKpis = [], hideGlobal, className }: StageMiniDashProps) {
  const { stageId } = useParams<{ stageId: string }>();
  const eventId = useActiveEventId();

  const { data: globals } = useQuery({
    queryKey: ["stage_mini_dash_globals", stageId, eventId],
    enabled: !!stageId && !!eventId && !hideGlobal,
    queryFn: async () => {
      // Participantes vinculados à etapa
      const { count: participantsCount } = await (supabase.from("participant_event_stages" as never) as any)
        .select("participant_id", { count: "exact", head: true })
        .eq("event_stage_id", stageId);

      // Buscar IDs dos participantes da etapa para escopar credenciados
      const { data: links } = await (supabase.from("participant_event_stages" as never) as any)
        .select("participant_id")
        .eq("event_stage_id", stageId);
      const ids = (links ?? []).map((l: any) => l.participant_id);

      let credentialed = 0;
      let pending = 0;
      if (ids.length > 0) {
        // Em lotes para evitar URL gigante
        const chunkSize = 200;
        for (let i = 0; i < ids.length; i += chunkSize) {
          const chunk = ids.slice(i, i + chunkSize);
          const { data: parts } = await supabase
            .from("participants")
            .select("status")
            .in("id", chunk);
          for (const p of parts ?? []) {
            if (p.status === "credentialed") credentialed++;
            else if (p.status === "pending") pending++;
          }
        }
      }

      return {
        participants: participantsCount ?? 0,
        credentialed,
        pending,
      };
    },
  });

  const globalKpis: KPI[] = hideGlobal
    ? []
    : [
        {
          label: "Vinculados",
          value: globals?.participants ?? "—",
          icon: <Users className="h-3.5 w-3.5" />,
          tone: "primary",
        },
        {
          label: "Credenciados",
          value: globals ? `${globals.credentialed}/${globals.participants}` : "—",
          icon: <BadgeCheck className="h-3.5 w-3.5" />,
          tone: "success",
        },
        {
          label: "Pendentes",
          value: globals?.pending ?? "—",
          icon: <AlertTriangle className="h-3.5 w-3.5" />,
          tone: globals && globals.pending > 0 ? "warning" : "default",
        },
      ];

  const all = [...globalKpis, ...moduleKpis];

  if (all.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-xs",
        className,
      )}
    >
      {all.map((kpi, idx) => (
        <div
          key={`${kpi.label}-${idx}`}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2 py-1 ring-1 ring-inset",
            TONE_PILL[kpi.tone ?? "default"],
          )}
        >
          {kpi.icon}
          <span className="font-medium">{kpi.label}</span>
          <span className={cn("font-semibold tabular-nums", TONE_TEXT[kpi.tone ?? "default"])}>
            {kpi.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export type { KPI as StageMiniDashKpi };
