import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface Props {
  stats: {
    total: number;
    configured: number;
    missing: number;
    jerpa: number;
    pct: number;
  };
}

export function CoverageStats({ stats }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Cobertura de Regras</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>
            {stats.configured} de {stats.total} provas configuradas
          </span>
          <span className="font-bold">{stats.pct}%</span>
        </div>
        <Progress value={stats.pct} className="h-3" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          <div className="text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Provas</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{stats.configured}</p>
            <p className="text-xs text-muted-foreground">Configuradas</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-destructive">{stats.missing}</p>
            <p className="text-xs text-muted-foreground">Sem regra</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.jerpa}</p>
            <p className="text-xs text-muted-foreground">JERPA</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
