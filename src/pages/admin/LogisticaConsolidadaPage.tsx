import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { saveAs } from "file-saver";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Bus,
  UtensilsCrossed,
  BedDouble,
  Search,
  Loader2,
  Download,
  Users,
  TrendingDown,
  TrendingUp,
  Eye,
} from "lucide-react";

interface LogisticsRow {
  participant_id: string;
  person_id: string;
  full_name: string;
  cpf: string | null;
  participant_type: string;
  delegation_id: string | null;
  delegation_name: string | null;
  needs_transport: boolean;
  needs_meals: boolean;
  needs_lodging: boolean;
  transport_boardings: number;
  meals_consumed: number;
  lodging_nights: number;
  voucher_uses_total: number;
}

interface VoucherUseDetail {
  id: string;
  service_kind: string;
  used_at: string;
  notes: string | null;
}

type ScopeFilter = "all" | "transport" | "meals" | "lodging";
type StatusFilter = "all" | "consuming" | "no_consumption" | "over_consuming";

export default function LogisticaConsolidadaPage() {
  const eventId = useActiveEventId();
  const [search, setSearch] = useState("");
  const [delegationFilter, setDelegationFilter] = useState<string>("all");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [drillTarget, setDrillTarget] = useState<LogisticsRow | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["logistica-consolidada", eventId],
    queryFn: async () => {
      const all: LogisticsRow[] = [];
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("vw_person_logistics_consumption")
          .select("*")
          .eq("event_id", eventId)
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const chunk = (data ?? []) as any[];
        chunk.forEach((r) =>
          all.push({
            participant_id: r.participant_id ?? "",
            person_id: r.person_id ?? "",
            full_name: r.full_name ?? "—",
            cpf: r.cpf ?? null,
            participant_type: r.participant_type ?? "—",
            delegation_id: r.delegation_id,
            delegation_name: r.delegation_name,
            needs_transport: !!r.needs_transport,
            needs_meals: !!r.needs_meals,
            needs_lodging: !!r.needs_lodging,
            transport_boardings: r.transport_boardings ?? 0,
            meals_consumed: r.meals_consumed ?? 0,
            lodging_nights: r.lodging_nights ?? 0,
            voucher_uses_total: r.voucher_uses_total ?? 0,
          })
        );
        if (chunk.length < PAGE) break;
        from += PAGE;
      }
      return all;
    },
    enabled: !!eventId,
  });

  // Delegation options
  const delegationOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      if (r.delegation_id && r.delegation_name) map.set(r.delegation_id, r.delegation_name);
    });
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  // Filter
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (term && !r.full_name.toLowerCase().includes(term) && !(r.cpf ?? "").includes(term))
        return false;
      if (delegationFilter !== "all" && r.delegation_id !== delegationFilter) return false;
      if (scopeFilter === "transport" && !r.needs_transport) return false;
      if (scopeFilter === "meals" && !r.needs_meals) return false;
      if (scopeFilter === "lodging" && !r.needs_lodging) return false;
      if (statusFilter !== "all") {
        const expected =
          (r.needs_transport ? r.transport_boardings : 0) +
          (r.needs_meals ? r.meals_consumed : 0) +
          (r.needs_lodging ? r.lodging_nights : 0);
        const needsAny = r.needs_transport || r.needs_meals || r.needs_lodging;
        if (statusFilter === "no_consumption" && (!needsAny || expected > 0)) return false;
        if (statusFilter === "consuming" && expected === 0) return false;
        if (statusFilter === "over_consuming" && r.voucher_uses_total <= 10) return false;
      }
      return true;
    });
  }, [rows, search, delegationFilter, scopeFilter, statusFilter]);

  // KPIs
  const kpis = useMemo(() => {
    const totalPeople = rows.length;
    const needTransport = rows.filter((r) => r.needs_transport).length;
    const needMeals = rows.filter((r) => r.needs_meals).length;
    const needLodging = rows.filter((r) => r.needs_lodging).length;
    const totalBoardings = rows.reduce((s, r) => s + r.transport_boardings, 0);
    const totalMeals = rows.reduce((s, r) => s + r.meals_consumed, 0);
    const totalNights = rows.reduce((s, r) => s + r.lodging_nights, 0);
    const inactive = rows.filter(
      (r) =>
        (r.needs_transport || r.needs_meals || r.needs_lodging) &&
        r.transport_boardings + r.meals_consumed + r.lodging_nights === 0
    ).length;
    return { totalPeople, needTransport, needMeals, needLodging, totalBoardings, totalMeals, totalNights, inactive };
  }, [rows]);

  const exportCsv = () => {
    const header = [
      "Nome",
      "CPF",
      "Tipo",
      "Delegação",
      "Precisa Transporte",
      "Embarques",
      "Precisa Alimentação",
      "Refeições",
      "Precisa Alojamento",
      "Diárias",
      "Usos Voucher",
    ];
    const lines = filtered.map((r) =>
      [
        r.full_name,
        r.cpf ?? "",
        r.participant_type,
        r.delegation_name ?? "",
        r.needs_transport ? "Sim" : "Não",
        r.transport_boardings,
        r.needs_meals ? "Sim" : "Não",
        r.meals_consumed,
        r.needs_lodging ? "Sim" : "Não",
        r.lodging_nights,
        r.voucher_uses_total,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = "\uFEFF" + [header.join(","), ...lines].join("\n");
    saveAs(new Blob([csv], { type: "text/csv;charset=utf-8" }), `logistica-consolidada-${Date.now()}.csv`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Painel Logístico Consolidado</h1>
          <p className="text-sm text-muted-foreground">
            Consumo agregado por pessoa: transporte, alimentação, alojamento e vouchers
          </p>
        </div>
        <Button onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="h-4 w-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
            <Users className="h-3.5 w-3.5" /> Pessoas no evento
          </div>
          <p className="text-2xl font-bold mt-1">{kpis.totalPeople}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
            <Bus className="h-3.5 w-3.5" /> Embarques (Transp.)
          </div>
          <p className="text-2xl font-bold mt-1">{kpis.totalBoardings}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {kpis.needTransport} pessoas elegíveis
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
            <UtensilsCrossed className="h-3.5 w-3.5" /> Refeições servidas
          </div>
          <p className="text-2xl font-bold mt-1">{kpis.totalMeals}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{kpis.needMeals} pessoas elegíveis</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
            <BedDouble className="h-3.5 w-3.5" /> Diárias usadas
          </div>
          <p className="text-2xl font-bold mt-1">{kpis.totalNights}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {kpis.needLodging} pessoas elegíveis
          </p>
        </Card>
      </div>

      {kpis.inactive > 0 && (
        <Card className="p-3 border-warning/40 bg-warning/10">
          <p className="text-sm">
            <TrendingDown className="inline h-4 w-4 mr-1 text-warning" />
            <strong>{kpis.inactive}</strong> pessoa(s) elegíveis sem nenhum consumo registrado.
          </p>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[240px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou CPF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={delegationFilter} onValueChange={setDelegationFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Delegação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas delegações</SelectItem>
              {delegationOptions.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={scopeFilter} onValueChange={(v) => setScopeFilter(v as ScopeFilter)}>
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos escopos</SelectItem>
              <SelectItem value="transport">Precisa Transporte</SelectItem>
              <SelectItem value="meals">Precisa Alimentação</SelectItem>
              <SelectItem value="lodging">Precisa Alojamento</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Qualquer status</SelectItem>
              <SelectItem value="consuming">Consumindo</SelectItem>
              <SelectItem value="no_consumption">Sem consumo</SelectItem>
              <SelectItem value="over_consuming">Uso elevado (10+)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">Nenhuma pessoa encontrada</Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pessoa</TableHead>
                  <TableHead>Delegação</TableHead>
                  <TableHead className="text-center">
                    <Bus className="h-4 w-4 inline" />
                  </TableHead>
                  <TableHead className="text-center">
                    <UtensilsCrossed className="h-4 w-4 inline" />
                  </TableHead>
                  <TableHead className="text-center">
                    <BedDouble className="h-4 w-4 inline" />
                  </TableHead>
                  <TableHead className="text-center">Vouchers</TableHead>
                  <TableHead className="text-right w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 500).map((r) => (
                  <TableRow key={r.participant_id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{r.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.participant_type}
                          {r.cpf && ` · ${r.cpf}`}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{r.delegation_name ?? "—"}</TableCell>
                    <TableCell className="text-center">
                      <ConsumptionCell needed={r.needs_transport} count={r.transport_boardings} />
                    </TableCell>
                    <TableCell className="text-center">
                      <ConsumptionCell needed={r.needs_meals} count={r.meals_consumed} />
                    </TableCell>
                    <TableCell className="text-center">
                      <ConsumptionCell needed={r.needs_lodging} count={r.lodging_nights} />
                    </TableCell>
                    <TableCell className="text-center font-medium">{r.voucher_uses_total}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => setDrillTarget(r)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filtered.length > 500 && (
            <p className="text-xs text-muted-foreground text-center py-2 border-t">
              Exibindo 500 de {filtered.length}. Refine os filtros ou exporte CSV.
            </p>
          )}
        </Card>
      )}

      <DrillDownDialog target={drillTarget} onClose={() => setDrillTarget(null)} eventId={eventId} />
    </div>
  );
}

// ----- Consumption cell -----
function ConsumptionCell({ needed, count }: { needed: boolean; count: number }) {
  if (!needed) return <span className="text-muted-foreground text-xs">—</span>;
  if (count === 0)
    return (
      <Badge variant="outline" className="text-xs">
        0
      </Badge>
    );
  return <span className="font-medium">{count}</span>;
}

// ----- Drill-down -----
function DrillDownDialog({
  target,
  onClose,
  eventId,
}: {
  target: LogisticsRow | null;
  onClose: () => void;
  eventId: string;
}) {
  const { data: voucherUses = [], isLoading: loadingVouchers } = useQuery({
    queryKey: ["drill-vouchers", target?.participant_id],
    queryFn: async () => {
      if (!target) return [];
      const { data: vs, error } = await supabase
        .from("service_vouchers")
        .select("id")
        .eq("event_id", eventId)
        .eq("participant_id", target.participant_id);
      if (error) throw error;
      const ids = (vs ?? []).map((v) => v.id);
      if (ids.length === 0) return [];
      const { data: uses, error: uErr } = await supabase
        .from("service_voucher_uses")
        .select("id, service_kind, used_at, notes")
        .in("voucher_id", ids)
        .order("used_at", { ascending: false })
        .limit(100);
      if (uErr) throw uErr;
      return (uses ?? []) as VoucherUseDetail[];
    },
    enabled: !!target,
  });

  if (!target) return null;

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{target.full_name}</DialogTitle>
          <DialogDescription>
            {target.participant_type} · {target.delegation_name ?? "Sem delegação"}
            {target.cpf && ` · CPF ${target.cpf}`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2">
          <Card className="p-3 text-center">
            <Bus className="h-4 w-4 mx-auto text-muted-foreground" />
            <p className="text-xs text-muted-foreground mt-1">Embarques</p>
            <p className="text-xl font-bold">{target.transport_boardings}</p>
            <p className="text-xs text-muted-foreground">{target.needs_transport ? "Elegível" : "Não elegível"}</p>
          </Card>
          <Card className="p-3 text-center">
            <UtensilsCrossed className="h-4 w-4 mx-auto text-muted-foreground" />
            <p className="text-xs text-muted-foreground mt-1">Refeições</p>
            <p className="text-xl font-bold">{target.meals_consumed}</p>
            <p className="text-xs text-muted-foreground">{target.needs_meals ? "Elegível" : "Não elegível"}</p>
          </Card>
          <Card className="p-3 text-center">
            <BedDouble className="h-4 w-4 mx-auto text-muted-foreground" />
            <p className="text-xs text-muted-foreground mt-1">Diárias</p>
            <p className="text-xl font-bold">{target.lodging_nights}</p>
            <p className="text-xs text-muted-foreground">{target.needs_lodging ? "Elegível" : "Não elegível"}</p>
          </Card>
        </div>

        <div>
          <h3 className="font-medium text-sm mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Últimos usos de voucher ({target.voucher_uses_total})
          </h3>
          {loadingVouchers ? (
            <Loader2 className="h-5 w-5 animate-spin mx-auto my-4" />
          ) : voucherUses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum uso registrado</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-auto">
              {voucherUses.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between text-sm p-2 rounded bg-muted/40"
                >
                  <div className="flex items-center gap-2">
                    {u.service_kind === "transport" && <Bus className="h-3.5 w-3.5" />}
                    {u.service_kind === "meals" && <UtensilsCrossed className="h-3.5 w-3.5" />}
                    {u.service_kind === "lodging" && <BedDouble className="h-3.5 w-3.5" />}
                    <span className="capitalize">{u.service_kind}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(u.used_at).toLocaleString("pt-BR")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
