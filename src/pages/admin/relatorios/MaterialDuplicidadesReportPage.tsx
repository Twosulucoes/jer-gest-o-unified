import { useMemo, useState } from "react";
import { useActiveEventId, useEventContext } from "@/contexts/EventContext";
import { useEventBranding } from "@/hooks/useEventBranding";
import {
  useMaterialDuplicidadesRelatorio,
  formatDeltaSegundos,
  type MaterialDuplicidadeRow,
} from "./useMaterialDuplicidadesRelatorio";
import { exportMaterialDuplicidadesListPdf, exportMaterialDuplicidadeIndividualPdf } from "./materialDuplicidadesPdfExporter";
import { exportMaterialDuplicidadesXlsx } from "./materialDuplicidadesXlsxExporter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ScanLine,
  RefreshCw,
  FileText,
  FileSpreadsheet,
  AlertTriangle,
  Printer,
  Search,
} from "lucide-react";
import { toast } from "sonner";

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  tint,
}: {
  icon: any;
  label: string;
  value: string | number;
  sub?: string;
  tint: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 truncate text-2xl font-bold">{value}</p>
            {sub && <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>}
          </div>
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${tint}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const TODOS = "__todos__";

export default function MaterialDuplicidadesReportPage() {
  const eventId = useActiveEventId();
  const { activeEvent } = useEventContext();
  const { data: branding } = useEventBranding(eventId);
  const { rows, totals, isLoading, refetchAll } = useMaterialDuplicidadesRelatorio(eventId);

  const [busca, setBusca] = useState("");
  const [kitFilter, setKitFilter] = useState<string>(TODOS);
  const [escolaFilter, setEscolaFilter] = useState<string>(TODOS);
  const [classFilter, setClassFilter] = useState<string>(TODOS);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);
  const [exportingRowId, setExportingRowId] = useState<string | null>(null);

  const kits = useMemo(
    () => Array.from(new Map(rows.map((r) => [r.kit_id, r.kit_name])).entries()),
    [rows],
  );
  const escolas = useMemo(
    () => Array.from(new Set(rows.map((r) => r.escola))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [rows],
  );

  const filteredRows = useMemo<MaterialDuplicidadeRow[]>(() => {
    const buscaNorm = busca.trim().toLowerCase();
    return rows.filter((r) => {
      if (kitFilter !== TODOS && r.kit_id !== kitFilter) return false;
      if (escolaFilter !== TODOS && r.escola !== escolaFilter) return false;
      if (classFilter !== TODOS && r.classificacao !== classFilter) return false;
      if (buscaNorm) {
        const alvo = `${r.full_name} ${r.cpf ?? ""} ${r.qr_code ?? ""}`.toLowerCase();
        if (!alvo.includes(buscaNorm)) return false;
      }
      return true;
    });
  }, [rows, busca, kitFilter, escolaFilter, classFilter]);

  const handleRefresh = async () => {
    await refetchAll();
    toast.success("Dados atualizados");
  };

  const reportMeta = () => ({
    eventName: activeEvent?.name || "Evento",
    branding: branding ?? null,
    generatedAt: new Date(),
  });

  const handleExportPdf = async () => {
    try {
      setExporting("pdf");
      const blob = await exportMaterialDuplicidadesListPdf(filteredRows, reportMeta());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `Duplicidades_Material_${(activeEvent?.name || "Evento").replace(/\s+/g, "_")}_${dateStr}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF exportado");
    } catch (e: any) {
      toast.error("Falha ao exportar PDF: " + (e?.message ?? "erro desconhecido"));
    } finally {
      setExporting(null);
    }
  };

  const handleExportXlsx = async () => {
    try {
      setExporting("xlsx");
      await exportMaterialDuplicidadesXlsx(filteredRows, { eventName: activeEvent?.name || "Evento", generatedAt: new Date() });
      toast.success("Planilha exportada");
    } catch (e: any) {
      toast.error("Falha ao exportar planilha: " + (e?.message ?? "erro desconhecido"));
    } finally {
      setExporting(null);
    }
  };

  const handleExportIndividual = async (row: MaterialDuplicidadeRow) => {
    try {
      setExportingRowId(row.id);
      const blob = await exportMaterialDuplicidadeIndividualPdf(row, reportMeta());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      const nomeArquivo = (row.full_name || row.qr_code || "caso").replace(/\s+/g, "_");
      a.href = url;
      a.download = `Declaracao_Duplicidade_${nomeArquivo}_${dateStr}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Declaração gerada");
    } catch (e: any) {
      toast.error("Falha ao gerar declaração: " + (e?.message ?? "erro desconhecido"));
    } finally {
      setExportingRowId(null);
    }
  };

  if (!eventId) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Selecione um evento ativo para visualizar o relatório de duplicidades de material.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Tentativas de Duplicidade — Entrega de Material</h1>
          <p className="text-sm text-muted-foreground">
            {activeEvent?.name ?? "Evento"} — respaldo técnico para justificar casos questionados por escolas/participantes
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportXlsx} disabled={isLoading || !!exporting}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            {exporting === "xlsx" ? "Exportando..." : "Excel"}
          </Button>
          <Button size="sm" onClick={handleExportPdf} disabled={isLoading || !!exporting}>
            <FileText className="mr-2 h-4 w-4" />
            {exporting === "pdf" ? "Exportando..." : "PDF (lista)"}
          </Button>
        </div>
      </header>

      {/* KPIs */}
      <section>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[100px]" />)
          ) : (
            <>
              <KpiCard icon={ScanLine} label="Total de Tentativas" value={totals.total} tint="bg-primary/10 text-primary" />
              <KpiCard
                icon={AlertTriangle}
                label="Erro Técnico (releitura)"
                value={totals.erroTecnico}
                sub="mesmo operador, poucos segundos depois"
                tint="bg-amber-500/10 text-amber-600"
              />
              <KpiCard
                icon={AlertTriangle}
                label="Tentativa Real de Reentrega"
                value={totals.tentativaReal}
                sub="operador diferente ou intervalo de horas"
                tint="bg-red-500/10 text-red-600"
              />
            </>
          )}
        </div>
      </section>

      {/* Filtros */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Buscar (nome, CPF ou crachá)</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-8 w-64 pl-7 text-sm"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Ex: Giovana ou 09074897290"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Kit</label>
            <Select value={kitFilter} onValueChange={setKitFilter}>
              <SelectTrigger className="h-8 w-52 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos os kits</SelectItem>
                {kits.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Escola</label>
            <Select value={escolaFilter} onValueChange={setEscolaFilter}>
              <SelectTrigger className="h-8 w-52 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas as escolas</SelectItem>
                {escolas.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Classificação</label>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="h-8 w-56 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas</SelectItem>
                <SelectItem value="erro_tecnico">Erro técnico (releitura)</SelectItem>
                <SelectItem value="tentativa_real">Tentativa real de reentrega</SelectItem>
                <SelectItem value="indeterminado">Indeterminado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Detalhado */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <ScanLine className="h-4 w-4" /> Tentativas Detalhadas
            <span className="font-normal text-muted-foreground">({filteredRows.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : filteredRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma tentativa de duplicidade para os filtros selecionados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Participante</th>
                    <th className="px-2 py-2 font-medium">Escola</th>
                    <th className="px-2 py-2 font-medium">Kit</th>
                    <th className="px-2 py-2 font-medium">Entrega Confirmada</th>
                    <th className="px-2 py-2 font-medium">Tentativa Bloqueada</th>
                    <th className="px-2 py-2 font-medium">Δ Tempo</th>
                    <th className="px-2 py-2 font-medium">Classificação</th>
                    <th className="px-2 py-2 font-medium">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-4 py-2">
                        {r.linked ? (
                          <>
                            <p className="font-medium">{r.full_name || "—"}</p>
                            {r.cpf && <p className="text-xs text-muted-foreground">{r.cpf}</p>}
                          </>
                        ) : (
                          <>
                            <p className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="h-3.5 w-3.5" /> Crachá não vinculado
                            </p>
                            <p className="font-mono text-xs text-muted-foreground">{r.qr_code}</p>
                          </>
                        )}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">{r.escola}</td>
                      <td className="px-2 py-2 text-muted-foreground">{r.kit_name}</td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {r.delivery_at ? new Date(r.delivery_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                        {r.delivery_operator_name && (
                          <p className="text-[10px] text-muted-foreground">{r.delivery_operator_name}</p>
                        )}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {new Date(r.attempt_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        {r.attempt_operator_name && (
                          <p className="text-[10px] text-muted-foreground">{r.attempt_operator_name}</p>
                        )}
                      </td>
                      <td className="px-2 py-2 tabular-nums text-muted-foreground">
                        {formatDeltaSegundos(r.delta_seconds)}
                      </td>
                      <td className="px-2 py-2">
                        {r.classificacao === "erro_tecnico" ? (
                          <Badge className="bg-amber-500 text-[10px] hover:bg-amber-500">Erro técnico</Badge>
                        ) : r.classificacao === "tentativa_real" ? (
                          <Badge className="bg-red-600 text-[10px] hover:bg-red-600">Tentativa real</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            Indeterminado
                          </Badge>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1.5 px-2 text-xs"
                          onClick={() => handleExportIndividual(r)}
                          disabled={exportingRowId === r.id}
                        >
                          <Printer className="h-3.5 w-3.5" />
                          {exportingRowId === r.id ? "Gerando..." : "Declaração"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
