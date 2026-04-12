import { useState, useMemo, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExternalLink, Info, Search, X } from "lucide-react";
import {
  getAllItems,
  getStatusSummary,
  ModuleStatus,
  STATUS_META,
  type SystemMapItem,
} from "@/config/systemMap";
import QuickActionsCards from "@/components/admin/mapa/QuickActionsCards";
import KpiCards from "@/components/admin/mapa/KpiCards";

function StatusBadge({ status }: { status: ModuleStatus }) {
  const meta = STATUS_META[status];
  return (
    <Badge variant="outline" className={`${meta.color} text-xs`}>
      {meta.emoji} {meta.label}
    </Badge>
  );
}

export default function MapaSistemaPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const routeParam = searchParams.get("route");

  const [search, setSearch] = useState("");
  const [filterGroup, setFilterGroup] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterRole, setFilterRole] = useState("all");
  const [detailItem, setDetailItem] = useState<(SystemMapItem & { groupLabel: string }) | null>(null);

  const allItems = useMemo(() => getAllItems(), []);
  const summary = useMemo(() => getStatusSummary(), []);

  // Auto-open detail from ?route= param
  useEffect(() => {
    if (routeParam) {
      const item = allItems.find((i) => i.route === routeParam);
      if (item) {
        setDetailItem(item);
      }
    }
  }, [routeParam, allItems]);

  const clearRouteParam = () => {
    setSearchParams({}, { replace: true });
    setDetailItem(null);
  };

  const groupOptions = useMemo(() => {
    const labels = new Set<string>();
    allItems.forEach((i) => labels.add(i.groupLabel));
    return Array.from(labels);
  }, [allItems]);

  const roleOptions = useMemo(() => {
    const roles = new Set<string>();
    allItems.forEach((i) => i.roles.forEach((r) => roles.add(r)));
    return Array.from(roles).sort();
  }, [allItems]);

  const filtered = useMemo(() => {
    return allItems.filter((item) => {
      if (filterGroup !== "all" && item.groupLabel !== filterGroup) return false;
      if (filterStatus !== "all" && item.status !== filterStatus) return false;
      if (filterRole !== "all" && !item.roles.includes(filterRole as any)) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          item.label.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.route.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allItems, filterGroup, filterStatus, filterRole, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Mapa do Sistema</h1>
        <p className="text-muted-foreground mt-1">
          Visão geral de todos os módulos, o que está pronto e o que falta implementar.
        </p>
      </div>

      {/* Route highlight banner */}
      {routeParam && (
        <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-md px-4 py-2">
          <Info className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm text-foreground">
            Mostrando detalhes do módulo <code className="bg-muted px-1 rounded text-xs">{routeParam}</code>
          </span>
          <Button variant="ghost" size="sm" onClick={clearRouteParam} className="ml-auto">
            <X className="h-3.5 w-3.5 mr-1" />
            Limpar
          </Button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-3xl font-bold text-foreground">{summary.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-3xl font-bold text-green-600">{summary.done}</p>
            <p className="text-xs text-muted-foreground">✅ Feitos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-3xl font-bold text-yellow-600">{summary.partial}</p>
            <p className="text-xs text-muted-foreground">🟡 Parciais</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-3xl font-bold text-red-600">{summary.notStarted}</p>
            <p className="text-xs text-muted-foreground">⛔ Não iniciados</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar módulo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterGroup} onValueChange={setFilterGroup}>
              <SelectTrigger><SelectValue placeholder="Grupo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os grupos</SelectItem>
                {groupOptions.map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value={ModuleStatus.DONE}>✅ Feito</SelectItem>
                <SelectItem value={ModuleStatus.PARTIAL}>🟡 Parcial</SelectItem>
                <SelectItem value={ModuleStatus.NOT_STARTED}>⛔ Não iniciado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger><SelectValue placeholder="Perfil" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os perfis</SelectItem>
                {roleOptions.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Módulo</TableHead>
                <TableHead className="hidden md:table-cell">Grupo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Descrição</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhum módulo encontrado com os filtros aplicados.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((item) => (
                <TableRow
                  key={item.id}
                  className={routeParam === item.route ? "bg-primary/5" : ""}
                >
                  <TableCell className="font-medium">{item.label}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                    {item.groupLabel}
                  </TableCell>
                  <TableCell><StatusBadge status={item.status} /></TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-xs truncate">
                    {item.description}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => setDetailItem(item)} title="Detalhes">
                      <Info className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" asChild title="Abrir tela">
                      <Link to={item.route}><ExternalLink className="h-4 w-4" /></Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog
        open={!!detailItem}
        onOpenChange={(open) => {
          if (!open) {
            setDetailItem(null);
            if (routeParam) setSearchParams({}, { replace: true });
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          {detailItem && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detailItem.label}
                  <StatusBadge status={detailItem.status} />
                </DialogTitle>
                <DialogDescription>
                  {detailItem.groupLabel}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="font-semibold text-muted-foreground mb-1">Descrição</p>
                  <p>{detailItem.description}</p>
                </div>
                <div>
                  <p className="font-semibold text-muted-foreground mb-1">Rota</p>
                  <code className="text-xs bg-muted px-2 py-1 rounded">{detailItem.route}</code>
                </div>
                <div>
                  <p className="font-semibold text-muted-foreground mb-1">Arquivo</p>
                  <code className="text-xs bg-muted px-2 py-1 rounded">{detailItem.pageFile}</code>
                </div>
                <div>
                  <p className="font-semibold text-muted-foreground mb-1">Perfis autorizados</p>
                  <div className="flex flex-wrap gap-1">
                    {detailItem.roles.map((r) => (
                      <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-muted-foreground mb-1">Tabelas / Fontes de dados</p>
                  {detailItem.dataSources.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {detailItem.dataSources.map((ds) => (
                        <Badge key={ds} variant="outline" className="text-xs font-mono">{ds}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic">Nenhuma tabela direta</p>
                  )}
                </div>
                {detailItem.gaps.length > 0 && (
                  <div>
                    <p className="font-semibold text-muted-foreground mb-1">Gaps</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {detailItem.gaps.map((g, i) => <li key={i}>{g}</li>)}
                    </ul>
                  </div>
                )}
                {detailItem.nextActions.length > 0 && (
                  <div>
                    <p className="font-semibold text-muted-foreground mb-1">Próximos passos</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {detailItem.nextActions.map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                  </div>
                )}
                <div className="pt-2">
                  <Button asChild size="sm">
                    <Link to={detailItem.route}>Abrir tela</Link>
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
