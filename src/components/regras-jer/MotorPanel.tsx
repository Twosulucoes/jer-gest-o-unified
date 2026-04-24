import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEventContext as useEvent } from "@/contexts/EventContext";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Cpu } from "lucide-react";
import { StatCard } from "./StatCard";
import { MotorRow } from "./MotorRow";

/**
 * Painel "Motor": diagnóstico do alinhamento entre a Fonte de Verdade JER 2026
 * e o que o motor de competição realmente está consumindo (standings, quórum).
 */
export function MotorPanel() {
  const { activeEvent } = useEvent();
  const eventId = activeEvent?.id;
  const [filter, setFilter] = useState("");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["motor-diagnostics", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      // 1. Lista provas + regras
      const { data: ses, error } = await supabase
        .from("sport_events")
        .select("id, name, slug, sport:sports(name, is_collective), category:categories(name)")
        .eq("event_id", eventId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;

      const seIds = (ses ?? []).map((s) => s.id);
      if (seIds.length === 0) return [];

      // 2. Para cada prova, chama as RPCs do motor em paralelo
      const enriched = await Promise.all(
        (ses ?? []).map(async (se) => {
          const [pointsRes, quorumRes] = await Promise.all([
            supabase.rpc("rpc_get_group_points_rules", { p_sport_event_id: se.id }),
            supabase.rpc("rpc_validate_sport_event_quorum", {
              p_event_id: eventId!,
              p_sport_event_id: se.id,
            }),
          ]);
          return {
            sport_event_id: se.id,
            name: se.name,
            slug: se.slug,
            sport_name: (se.sport as any)?.name ?? "—",
            category_name: (se.category as any)?.name ?? "—",
            is_collective: (se.sport as any)?.is_collective ?? false,
            points_rules: pointsRes.data as any,
            quorum: quorumRes.data as any,
          };
        }),
      );
      return enriched;
    },
  });

  const filtered = useMemo(() => {
    if (!rows) return [];
    const f = filter.trim().toLowerCase();
    if (!f) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(f) ||
        r.sport_name.toLowerCase().includes(f) ||
        r.category_name.toLowerCase().includes(f),
    );
  }, [rows, filter]);

  const stats = useMemo(() => {
    if (!rows) return { total: 0, jer2026: 0, ok_quorum: 0 };
    return {
      total: rows.length,
      jer2026: rows.filter((r) => r.points_rules?.source === "jer2026-truth").length,
      ok_quorum: rows.filter((r) => r.quorum?.ok).length,
    };
  }, [rows]);

  if (!eventId) {
    return (
      <Alert>
        <AlertDescription>Selecione um evento ativo.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Alert>
        <Cpu className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Diagnóstico de cada prova: o que o motor está consumindo da Fonte de Verdade JER 2026 hoje
          (pontuação de grupo, cascata de desempates, política de W.O., quórum mínimo). Use a aba{" "}
          <strong>Sincronizar</strong> se houver provas marcadas como{" "}
          <code className="bg-muted px-1 rounded">db</code> ou
          <code className="bg-muted px-1 rounded ml-1">default</code>.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Provas" value={stats.total} />
        <StatCard
          label="Regendo pela Fonte JER 2026"
          value={`${stats.jer2026}/${stats.total}`}
          good={stats.jer2026 === stats.total}
        />
        <StatCard
          label="Quórum atingido"
          value={`${stats.ok_quorum}/${stats.total}`}
          good={stats.ok_quorum === stats.total}
        />
      </div>

      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar por modalidade, prova ou categoria..."
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <ScrollArea className="h-[60vh]">
          <div className="space-y-2 pr-3">
            {filtered.map((r) => (
              <MotorRow key={r.sport_event_id} row={r} />
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma prova encontrada.
              </p>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
