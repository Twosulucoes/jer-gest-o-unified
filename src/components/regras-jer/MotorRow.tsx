import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export function MotorRow({ row }: { row: any }) {
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
        : String(t),
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
              {gp.wo_win != null && <div className="text-muted-foreground">W.O.+: {gp.wo_win}</div>}
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
              {tb.length > 5 && <li className="text-muted-foreground">+{tb.length - 5}</li>}
            </ol>
          </div>
          <div>
            <div className="font-semibold text-muted-foreground uppercase text-[10px] mb-1">W.O.</div>
            {wo ? (
              <pre className="text-[10px] bg-muted p-1.5 rounded">{JSON.stringify(wo, null, 0)}</pre>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
