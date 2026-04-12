import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, RefreshCw, ListX, ClipboardList } from "lucide-react";
import { useMapaKpis } from "@/hooks/useMapaKpis";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function KpiCards() {
  const { provasSemPartidas, partidasSemResultado } = useMapaKpis();
  const [drillDown, setDrillDown] = useState<"provas" | "partidas" | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* KPI 1: Provas sem partidas */}
        <KpiCard
          title="Provas sem partidas"
          icon={ListX}
          isLoading={provasSemPartidas.isLoading}
          isError={provasSemPartidas.isError}
          count={provasSemPartidas.data?.count ?? 0}
          onRetry={() => provasSemPartidas.refetch()}
          onDrillDown={() => setDrillDown("provas")}
        />

        {/* KPI 2: Partidas sem resultado */}
        <KpiCard
          title="Partidas sem resultado"
          icon={ClipboardList}
          isLoading={partidasSemResultado.isLoading}
          isError={partidasSemResultado.isError}
          count={partidasSemResultado.data?.count ?? 0}
          onRetry={() => partidasSemResultado.refetch()}
          onDrillDown={() => setDrillDown("partidas")}
        />
      </div>

      {/* Drill-down dialogs */}
      <Dialog open={drillDown === "provas"} onOpenChange={(o) => !o && setDrillDown(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Provas sem partidas ({provasSemPartidas.data?.count ?? 0})</DialogTitle>
          </DialogHeader>
          {provasSemPartidas.data?.items?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Modalidade</TableHead>
                  <TableHead>Prova</TableHead>
                  <TableHead className="text-right">Inscritos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {provasSemPartidas.data.items.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm">{item.sport_name}</TableCell>
                    <TableCell className="text-sm font-medium">{item.sport_event_name}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{item.enrolled_count}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma pendência.</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={drillDown === "partidas"} onOpenChange={(o) => !o && setDrillDown(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Partidas sem resultado ({partidasSemResultado.data?.count ?? 0})</DialogTitle>
          </DialogHeader>
          {partidasSemResultado.data?.items?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Modalidade</TableHead>
                  <TableHead>Prova</TableHead>
                  <TableHead>Fase</TableHead>
                  <TableHead className="text-right">Nº</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partidasSemResultado.data.items.map((item: any) => (
                  <TableRow key={item.match_id}>
                    <TableCell className="text-sm">{item.sport_name}</TableCell>
                    <TableCell className="text-sm font-medium">{item.sport_event_name}</TableCell>
                    <TableCell className="text-sm">{item.phase_name}</TableCell>
                    <TableCell className="text-right text-sm">{item.match_number ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{item.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma pendência.</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function KpiCard({
  title,
  icon: Icon,
  isLoading,
  isError,
  count,
  onRetry,
  onDrillDown,
}: {
  title: string;
  icon: React.ElementType;
  isLoading: boolean;
  isError: boolean;
  count: number;
  onRetry: () => void;
  onDrillDown: () => void;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-4 pb-4 flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-12" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="pt-4 pb-4 flex items-center gap-3">
          <AlertTriangle className="h-8 w-8 text-destructive shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-destructive">Erro ao carregar</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isOk = count === 0;

  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-all ${isOk ? "border-green-200" : "border-yellow-300"}`}
      onClick={onDrillDown}
    >
      <CardContent className="pt-4 pb-4 flex items-center gap-4">
        <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${isOk ? "bg-green-100" : "bg-yellow-100"}`}>
          {isOk ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
          ) : (
            <Icon className="h-5 w-5 text-yellow-600" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className={`text-2xl font-bold ${isOk ? "text-green-600" : "text-yellow-600"}`}>
            {isOk ? "Tudo em dia" : count}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
