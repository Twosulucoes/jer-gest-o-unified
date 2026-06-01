import { useMemo, useState } from "react";
import { useEventContext } from "@/contexts/EventContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList, Download, FileText, Settings, Building2, Users, UtensilsCrossed, BadgeCheck, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useEventBranding } from "@/hooks/useEventBranding";
import { useExecucaoFisicaData, useSaveMeta2Target } from "./useExecucaoFisicaData";
import { exportExecucaoFisicaPdf } from "./execucaoFisicaPdfExporter";
import { exportExecucaoFisicaDoc } from "./execucaoFisicaDocExporter";
import { EVIDENCE_CATEGORIES, type ExecFisicaMeta1Row } from "./execucaoFisicaService";

const nf = new Intl.NumberFormat("pt-BR");
const fmt = (n: number | null | undefined) => nf.format(Number(n || 0));
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

const hasData = (r: ExecFisicaMeta1Row) =>
  r.delegacoes_atendidas > 0 || r.atletas_alojados > 0 || r.refeicoes_fornecidas > 0 || r.kits_entregues > 0;

function Kpi({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold mt-1 truncate">{value}</p>
        </div>
        <div className="h-9 w-9 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-green-700" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function ExecucaoFisicaPage() {
  const { activeEvent } = useEventContext();
  const eventId = activeEvent?.id;
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [exporting, setExporting] = useState<"pdf" | "doc" | null>(null);
  const [editPrevisto, setEditPrevisto] = useState<Record<string, string>>({});

  const { data: report, isLoading } = useExecucaoFisicaData(eventId, dateFrom || null, dateTo || null);
  const { data: branding } = useEventBranding(eventId);
  const saveTarget = useSaveMeta2Target(eventId);

  const periodLabel = useMemo(() => {
    if (dateFrom && dateTo) return `${fmtDate(dateFrom)} a ${fmtDate(dateTo)}`;
    const id = report?.identificacao;
    if (id?.event_start && id?.event_end) return `${fmtDate(id.event_start)} a ${fmtDate(id.event_end)}`;
    return "Todo o período";
  }, [dateFrom, dateTo, report]);

  if (!eventId) {
    return (
      <div className="container mx-auto py-6">
        <p className="text-muted-foreground">Selecione um evento ativo para gerar o relatório de execução física.</p>
      </div>
    );
  }

  const id = report?.identificacao;
  const oscName = id?.osc_name || "Instituto AcolheRR";
  const stageRows = (report?.meta1.por_etapa ?? []).filter(hasData);
  const total = report?.meta1.total;

  const onPdf = async () => {
    if (!report) return;
    try {
      setExporting("pdf");
      await exportExecucaoFisicaPdf(report, { branding: branding ?? null, generatedAt: new Date(), periodLabel, oscFallbackName: oscName });
      toast.success("PDF gerado.");
    } catch (e: any) {
      toast.error("Erro ao gerar PDF", { description: e?.message });
    } finally { setExporting(null); }
  };

  const onDoc = async () => {
    if (!report) return;
    try {
      setExporting("doc");
      exportExecucaoFisicaDoc(report, { generatedAt: new Date(), periodLabel, oscFallbackName: oscName });
      toast.success("Documento Word (.doc) gerado.");
    } catch (e: any) {
      toast.error("Erro ao gerar DOCX", { description: e?.message });
    } finally { setExporting(null); }
  };

  const commitPrevisto = (metricKey: string) => {
    const raw = editPrevisto[metricKey];
    if (raw === undefined || raw === "") return;
    const valor = Number(raw);
    if (Number.isNaN(valor) || valor < 0) { toast.error("Valor previsto inválido."); return; }
    saveTarget.mutate(
      { metricKey, valor },
      // Após salvar, descarta o rascunho local para o campo refletir o valor revalidado do banco.
      { onSuccess: () => setEditPrevisto((s) => { const { [metricKey]: _omit, ...rest } = s; return rest; }) },
    );
  };

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-7xl animate-fade-in">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-green-50/60 p-6 rounded-xl border border-green-100">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
            <ClipboardList className="h-6 w-6 text-green-700" />
          </div>
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight">Relatório de Execução Física</h1>
            <div className="flex items-center gap-2 mt-1 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span className="text-sm font-medium">{periodLabel}</span>
              <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-200">
                Termo de Fomento {id?.termo_fomento || "01/2026"}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/registros/configuracao-osc">
            <Button variant="outline" size="sm"><Settings className="h-4 w-4 mr-2" />Convênio</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={onDoc} disabled={!report || exporting !== null}>
            <FileText className="h-4 w-4 mr-2" />{exporting === "doc" ? "Gerando…" : "Exportar DOCX"}
          </Button>
          <Button size="sm" onClick={onPdf} disabled={!report || exporting !== null} className="bg-green-700 hover:bg-green-800">
            <Download className="h-4 w-4 mr-2" />{exporting === "pdf" ? "Gerando…" : "Exportar PDF"}
          </Button>
        </div>
      </header>

      {/* Período */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label htmlFor="ef-from" className="text-xs">Período — início</Label>
            <Input id="ef-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-44" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ef-to" className="text-xs">Período — fim</Label>
            <Input id="ef-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-44" />
          </div>
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }}>Limpar período</Button>
          )}
          <p className="text-xs text-muted-foreground ml-auto max-w-md">
            O período filtra refeições e jogos pela data. Indicadores estruturais (delegações, atletas, kits) são cumulativos do evento.
          </p>
        </CardContent>
      </Card>

      {/* Identificação */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Identificação</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <div><p className="text-xs text-muted-foreground uppercase">Termo de Fomento</p><p className="font-semibold">{id?.termo_fomento || "01/2026"}</p></div>
          <div className="lg:col-span-2"><p className="text-xs text-muted-foreground uppercase">Objeto</p><p className="font-semibold">{id?.objeto || activeEvent?.name}</p></div>
          <div><p className="text-xs text-muted-foreground uppercase">OSC Parceira</p><p className="font-semibold">{oscName}</p></div>
          <div><p className="text-xs text-muted-foreground uppercase">CNPJ</p><p className="font-semibold">{id?.osc_cnpj || "—"}</p></div>
          <div><p className="text-xs text-muted-foreground uppercase">Órgão Concedente</p><p className="font-semibold">{id?.grantor_name || "IDJUV/RR"}</p></div>
        </CardContent>
      </Card>

      {/* KPIs consolidados */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {isLoading || !total ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)
        ) : (
          <>
            <Kpi icon={Building2} label="Delegações atendidas" value={fmt(total.delegacoes_atendidas)} />
            <Kpi icon={Users} label="Atletas alojados" value={fmt(total.atletas_alojados)} />
            <Kpi icon={UtensilsCrossed} label="Refeições fornecidas" value={fmt(total.refeicoes_fornecidas)} />
            <Kpi icon={BadgeCheck} label="Kits-atleta entregues" value={fmt(total.kits_entregues)} />
          </>
        )}
      </div>

      {/* Meta 1 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meta 1 — Apoio às Delegações</CardTitle>
          <CardDescription>Agregado por etapa regional / cidade-sede. Total consolidado sem duplicidade por participante.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : stageRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma etapa com execução registrada no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Etapa / Cidade-sede</TableHead>
                    <TableHead className="text-right">Delegações</TableHead>
                    <TableHead className="text-right">Atletas alojados</TableHead>
                    <TableHead className="text-right">Refeições</TableHead>
                    <TableHead className="text-right">Kits-atleta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stageRows.map((r) => (
                    <TableRow key={r.event_stage_id}>
                      <TableCell className="font-medium">{r.host_city}</TableCell>
                      <TableCell className="text-right">{fmt(r.delegacoes_atendidas)}</TableCell>
                      <TableCell className="text-right">{fmt(r.atletas_alojados)}</TableCell>
                      <TableCell className="text-right">{fmt(r.refeicoes_fornecidas)}</TableCell>
                      <TableCell className="text-right">{fmt(r.kits_entregues)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                {total && (
                  <TableFooter>
                    <TableRow className="bg-green-50">
                      <TableCell className="font-bold text-green-800">TOTAL (consolidado)</TableCell>
                      <TableCell className="text-right font-bold">{fmt(total.delegacoes_atendidas)}</TableCell>
                      <TableCell className="text-right font-bold">{fmt(total.atletas_alojados)}</TableCell>
                      <TableCell className="text-right font-bold">{fmt(total.refeicoes_fornecidas)}</TableCell>
                      <TableCell className="text-right font-bold">{fmt(total.kits_entregues)}</TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Meta 2 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meta 2 — Competições</CardTitle>
          <CardDescription>Previsto (do Plano de Trabalho, editável) x Executado (extraído do sistema).</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading || !report ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Indicador</TableHead>
                  <TableHead className="w-40 text-right">Previsto</TableHead>
                  <TableHead className="w-32 text-right">Executado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.meta2.map((m) => (
                  <TableRow key={m.metric_key}>
                    <TableCell className="font-medium">{m.label}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={0}
                        className="h-8 w-28 ml-auto text-right"
                        value={editPrevisto[m.metric_key] ?? (m.previsto ? String(m.previsto) : "")}
                        placeholder="—"
                        onChange={(e) => setEditPrevisto((s) => ({ ...s, [m.metric_key]: e.target.value }))}
                        onBlur={() => commitPrevisto(m.metric_key)}
                        disabled={saveTarget.isPending}
                      />
                    </TableCell>
                    <TableCell className="text-right font-bold">{fmt(m.executado)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Evidências */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checklist de Evidências</CardTitle>
          <CardDescription>Documentos e registros que acompanham a prestação de contas.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span>Listas de credenciamento</span><Badge variant="secondary">Sistema</Badge>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span>Relatório do sistema</span><Badge variant="secondary">Este documento</Badge>
          </div>
          {EVIDENCE_CATEGORIES.map((cat) => {
            const count = report?.evidencias.find((e) => e.osc_category === cat)?.count ?? 0;
            return (
              <div key={cat} className="flex items-center justify-between rounded-lg border p-3">
                <span className="capitalize">Fotos — {cat}</span>
                <Badge variant={count > 0 ? "default" : "outline"} className={count > 0 ? "bg-green-700" : ""}>
                  {count} evidência(s)
                </Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Declaração */}
      <Card>
        <CardHeader><CardTitle className="text-base">Declaração</CardTitle></CardHeader>
        <CardContent className="space-y-8 text-sm">
          <p className="text-justify leading-relaxed text-muted-foreground">
            Declaramos, para fins de prestação de contas junto ao IDJUV/RR, que os dados de execução
            FÍSICA constantes neste relatório foram extraídos diretamente do sistema JER Gestão e
            correspondem fielmente às atividades realizadas no âmbito do {id?.objeto || activeEvent?.name}.
            O presente documento trata exclusivamente da execução física das metas, não contemplando
            informações de natureza financeira.
          </p>
          <div className="pt-8 flex justify-center">
            <div className="text-center border-t border-foreground/40 pt-2 w-72">
              <p className="font-semibold">{id?.responsible_name || "________________________"}</p>
              <p className="text-xs text-muted-foreground">Responsável Técnico — {oscName}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground italic">
        Relatório de execução física destinado ao processo SEI junto ao IDJUV. Não inclui valores financeiros ou notas fiscais.
      </p>
    </div>
  );
}
