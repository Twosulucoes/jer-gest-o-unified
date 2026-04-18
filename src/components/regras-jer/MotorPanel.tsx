import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEventContext as useEvent } from "@/contexts/EventContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, AlertTriangle, Search, Cpu } from "lucide-react";

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
          Diagnóstico de cada prova: o que o motor está consumindo da Fonte de
          Verdade JER 2026 hoje (pontuação de grupo, cascata de desempates, política
          de W.O., quórum mínimo). Use a aba <strong>Sincronizar</strong> se houver
          provas marcadas como <code className="bg-muted px-1 rounded">db</code> ou
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

function StatCard({
  label,
  value,
  good,
}: {
  label: string;
  value: number | string;
  good?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div
          className={`text-2xl font-bold font-heading ${
            good === true ? "text-green-600" : good === false ? "text-amber-600" : ""
          }`}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function MotorRow({ row }: { row: any }) {
  const source = row.points_rules?.source ?? "default";
  const sourceVariant =
    source === "jer2026-truth"
      ? "bg-green-500/15 text-green-700 border-green-500/30"
      : source === "db"
        ? "bg-blue-500/15 text-blue-700 border-blue-500/30"
        : "bg-amber-500/15 text-amber-700 border-amber-500/30";

  const tbRaw: any[] = Array.isArray(row.points_rules?.tie_breakers)
    ? row.points_rules.tie_breakers
    : [];
  const tb: string[] = tbRaw.map((t) =>
    typeof t === "string"
      ? t
      : t && typeof t === "object"
        ? (t.criterio ?? t.criteria ?? t.name ?? JSON.stringify(t))
        : String(t)
  );
  const gp = row.points_rules?.group_points ?? {};
  const wo = row.points_rules?.walkover_policy;
  const q = row.quorum ?? {};

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-heading">{row.name}</CardTitle>
            <div className="text-xs text-muted-foreground mt-0.5">
              {row.sport_name} · {row.category_name}
            </div>
          </div>
          <div className="flex flex-col gap-1 shrink-0 items-end">
            <Badge variant="outline" className={sourceVariant}>
              {source === "jer2026-truth" ? "✓ Fonte JER 2026" : source}
            </Badge>
            <Badge
              variant="outline"
              className={
                q.ok
                  ? "bg-green-500/15 text-green-700 border-green-500/30"
                  : "bg-red-500/15 text-red-700 border-red-500/30"
              }
            >
              {q.ok ? (
                <CheckCircle2 className="h-3 w-3 mr-1" />
              ) : (
                <AlertTriangle className="h-3 w-3 mr-1" />
              )}
              Quórum {q.current ?? 0}/{q.required ?? 0}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-3">
        <div className="grid sm:grid-cols-3 gap-3 text-xs">
          <div>
            <div className="font-semibold text-muted-foreground uppercase text-[10px] mb-1">
              Pontuação
            </div>
            <div className="space-y-0.5">
              <div>V: {gp.win ?? "—"}</div>
              {gp.draw != null && <div>E: {gp.draw}</div>}
              <div>D: {gp.loss ?? "—"}</div>
              {gp.wo_win != null && (
                <div className="text-muted-foreground">W.O.+: {gp.wo_win}</div>
              )}
            </div>
          </div>
          <div>
            <div className="font-semibold text-muted-foreground uppercase text-[10px] mb-1">
              Desempates
            </div>
            <ol className="list-decimal list-inside space-y-0.5">
              {tb.length === 0 && <li className="text-muted-foreground">—</li>}
              {tb.slice(0, 5).map((t, i) => (
                <li key={i}>
                  <code className="text-[10px]">{t}</code>
                </li>
              ))}
              {tb.length > 5 && (
                <li className="text-muted-foreground">+{tb.length - 5}</li>
              )}
            </ol>
          </div>
          <div>
            <div className="font-semibold text-muted-foreground uppercase text-[10px] mb-1">
              W.O.
            </div>
            {wo ? (
              <pre className="text-[10px] bg-muted p-1.5 rounded">
                {JSON.stringify(wo, null, 0)}
              </pre>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
