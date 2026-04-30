import { useState } from "react";
import { useEventContext } from "@/contexts/EventContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Receipt, Download, FileSpreadsheet, Users, BadgeCheck, UtensilsCrossed,
  Bed, Bus, Trophy, Award, Building2, Sparkles, Settings, ShieldCheck,
  AlertCircle, CheckCircle2, Calendar, Clock
} from "lucide-react";
import { useOscData } from "./useOscData";
import { useEventBranding } from "@/hooks/useEventBranding";
import { useEventOscConfig } from "@/hooks/useEventOscConfig";
import { exportOscPdf } from "./oscPdfExporter";
import { exportOscXlsx } from "./oscXlsxExporter";
import { ReportPresetsButton } from "@/components/relatorios/ReportPresetsButton";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

function Kpi({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1 truncate">{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PrestacaoContasOscPage() {
  const { activeEvent } = useEventContext();
  const eventId = activeEvent?.id;
  const { data, isLoading } = useOscData(eventId);
  const { data: branding } = useEventBranding(eventId);
  const { data: oscConfig } = useEventOscConfig(eventId);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);

  if (!eventId) {
    return (
      <div className="container mx-auto py-6">
        <p className="text-muted-foreground">Selecione um evento ativo para gerar a prestação de contas.</p>
      </div>
    );
  }

  const r = data?.resumo;
  const periodLabel = data?.event?.startDate && data?.event?.endDate
    ? `${new Date(data.event.startDate + "T00:00:00").toLocaleDateString("pt-BR")} a ${new Date(data.event.endDate + "T00:00:00").toLocaleDateString("pt-BR")}`
    : activeEvent?.name || "—";
  const credPct = r && r.totalParticipants > 0 ? Math.round((r.totalCredentialed / r.totalParticipants) * 100) : 0;
  const lodgePct = r && r.totalLodgingCapacity > 0 ? Math.round((r.totalLodgingOccupied / r.totalLodgingCapacity) * 100) : 0;

  const [auditHistory, setAuditHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const fetchAuditHistory = async () => {
    const { data: history } = await supabase
      .from("audit_events")
      .select("*")
      .eq("table_name", "osc_reports")
      .eq("record_id", eventId)
      .order("created_at", { ascending: false })
      .limit(10);
    setAuditHistory(history || []);
  };

  const onPdf = async () => {
    if (!data) return;
    try {
      setExporting("pdf");
      
      const { data: evs } = await supabase
        .from("operational_evidence")
        .select("*")
        .eq("event_id", eventId)
        .eq("status", "approved")
        .not("osc_category", "is", null);

      const evidences = evs || [];
      const categories = ["infraestrutura", "atendimento", "competicao", "cerimonial"];
      const counts = categories.reduce((acc, cat) => {
        acc[cat] = evidences.filter(e => e.osc_category === cat).length;
        return acc;
      }, {} as Record<string, number>);

      const hasCriticalGap = Object.values(counts).some(c => c === 0);
      const hasWarning = Object.values(counts).some(c => c < 2 || c > 4);

      if (hasCriticalGap) {
        const proceed = window.confirm("ATENÇÃO: Existem categorias sem NENHUMA foto. O relatório formal pode ser rejeitado. Deseja prosseguir mesmo assim?");
        if (!proceed) return;
      } else if (hasWarning) {
        const proceed = window.confirm("AVISO: Algumas categorias não possuem entre 2 e 4 fotos (regra de conformidade). Deseja prosseguir?");
        if (!proceed) return;
      }

      // NOVO: Gerar identificador único para o relatório (UUID v4)
      const reportId = crypto.randomUUID();
      const validationToken = Math.random().toString(36).substring(2, 10).toUpperCase();

      await exportOscPdf(data, {
        eventName: activeEvent?.name || "Evento",
        branding: branding ?? null,
        oscConfig: oscConfig ?? null,
        generatedAt: new Date(),
        periodLabel,
        evidences,
        reportId // Passar o ID para o PDF gerado
      });

      // Registrar auditoria com o vínculo do Relatório
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("audit_events").insert({
          table_name: "osc_reports",
          record_id: eventId,
          action: "generate_pdf",
          created_by: user.id,
          report_id: reportId,
          validation_token: validationToken,
          payload: {
            event_name: activeEvent?.name,
            photo_counts: counts,
            stats: {
              participants: data.resumo.totalParticipants,
              matches: data.resumo.totalMatches,
              meals: data.resumo.totalMeals
            },
            config_used: oscConfig,
            validation_url: `${window.location.origin}/admin/validar-qr?report=${reportId}`
          }
        } as any);
      }

      toast.success("PDF Oficial gerado com selo de autenticidade");
      fetchAuditHistory();
    } catch (e: any) {
      toast.error("Erro ao gerar PDF", { description: e?.message });
    } finally { setExporting(null); }
  };

  const onXlsx = async () => {
    if (!data) return;
    try {
      setExporting("xlsx");
      await exportOscXlsx(data, {
        eventName: activeEvent?.name || "Evento",
        generatedAt: new Date(),
        periodLabel,
      });
      toast.success("Planilha gerada");
    } catch (e: any) {
      toast.error("Erro ao gerar XLSX", { description: e?.message });
    } finally { setExporting(null); }
  };

  const getHistoryStatus = (entry: any) => {
    const counts = entry.payload?.photo_counts || {};
    const gaps = Object.values(counts).filter(c => (c as number) === 0).length;
    if (gaps > 0) return { label: "Incompleto", color: "text-red-500" };
    const warnings = Object.values(counts).filter(c => (c as number) < 2 || (c as number) > 4).length;
    if (warnings > 0) return { label: "Com Alertas", color: "text-amber-500" };
    return { label: "Conforme", color: "text-green-500" };
  };

  return (
    <div className="container mx-auto py-6 space-y-8 max-w-7xl animate-fade-in">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/30 p-6 rounded-xl border">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight">Relatório Formal da OSC</h1>
            <div className="flex items-center gap-2 mt-1 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span className="text-sm font-medium">{periodLabel}</span>
              <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-200">
                Auditoria Integrada
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => { setShowHistory(!showHistory); if (!showHistory) fetchAuditHistory(); }}>
            <Clock className="h-4 w-4 mr-2" />
            Histórico
          </Button>
          <Link to="/admin/registros/configuracao-osc">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Convênio
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={onXlsx} disabled={!data || exporting !== null}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            {exporting === "xlsx" ? "Gerando…" : "XLSX"}
          </Button>
          <Button size="sm" onClick={onPdf} disabled={!data || exporting !== null} className="shadow-lg shadow-primary/20">
            <Download className="h-4 w-4 mr-2" />
            {exporting === "pdf" ? "Gerando…" : "Gerar PDF Oficial"}
          </Button>
        </div>
      </header>

      {/* Alerta de Conformidade */}
      <Card className="bg-blue-50/50 border-blue-100">
        <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h4 className="font-semibold text-blue-900">Status de Prontidão para Publicação</h4>
            <p className="text-sm text-blue-700/80">O relatório consolida evidências operacionais aprovadas e indicadores de execução para envio aos órgãos fiscalizadores.</p>
          </div>
          <div className="flex items-center gap-4 bg-white/50 p-2 px-4 rounded-lg border border-blue-100 shrink-0">
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-blue-600">Última Publicação</p>
              <p className="text-xs font-medium">{auditHistory[0] ? new Date(auditHistory[0].created_at).toLocaleDateString("pt-BR") : "Nenhuma"}</p>
            </div>
            <Separator orientation="vertical" className="h-8 bg-blue-200" />
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-blue-600">Data Limite</p>
              <p className="text-xs font-medium">
                {data?.event?.endDate 
                  ? new Date(new Date(data.event.endDate).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-BR")
                  : "15/05/2026"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {showHistory && (
        <Card className="animate-in fade-in slide-in-from-top-4">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Histórico de Gerações</CardTitle></CardHeader>
          <CardContent>
            {auditHistory.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma geração registrada.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {auditHistory.map((entry) => {
                  const status = getHistoryStatus(entry);
                  return (
                    <div key={entry.id} className="p-3 border rounded-lg space-y-2 text-xs bg-card hover:shadow-sm transition-shadow">
                      <div className="flex justify-between items-start">
                        <span className="font-medium">{new Date(entry.created_at).toLocaleString("pt-BR")}</span>
                        <span className={`font-semibold ${status.color}`}>{status.label}</span>
                      </div>
                      <div className="text-muted-foreground">
                        {entry.report_id && (
                          <div className="mb-2 p-1.5 bg-muted rounded border border-dashed text-[10px] font-mono break-all flex items-center gap-1.5">
                            <ShieldCheck className="h-3 w-3 text-primary shrink-0" />
                            ID: {entry.report_id}
                          </div>
                        )}
                        {Object.entries(entry.payload?.photo_counts || {}).map(([k, v]) => (
                          <div key={k} className="flex justify-between">
                            <span className="capitalize">{k}:</span>
                            <span>{v as number} foto(s)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Indicadores */}
      <section>
        <h2 className="font-heading text-lg font-semibold mb-3">Indicadores Consolidados</h2>
        {isLoading || !r ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            <Kpi icon={Users} label="Participantes" value={r.totalParticipants} sub={`${r.totalAthletes} atletas`} />
            <Kpi icon={BadgeCheck} label="Credenciados" value={r.totalCredentialed} sub={`${credPct}% do total`} />
            <Kpi icon={Building2} label="Delegações" value={r.totalDelegations} sub={`${r.totalSports} modalidades`} />
            <Kpi icon={Trophy} label="Partidas publicadas" value={r.totalMatchesPublished} sub={`${r.totalMatches} agendadas`} />
            <Kpi icon={UtensilsCrossed} label="Refeições servidas" value={r.totalMeals} />
            <Kpi icon={Bed} label="Alojamento" value={`${r.totalLodgingOccupied}/${r.totalLodgingCapacity}`} sub={`${lodgePct}% ocupação`} />
            <Kpi icon={Bus} label="Viagens realizadas" value={r.totalTrips} sub={`${r.totalPassengers} passageiros`} />
            <Kpi icon={Sparkles} label="Doação alimentos (kg)" value={r.foodDonationKg} sub="Total estimado" />
          </div>
        )}
      </section>

      {/* Medalhas */}
      <section>
        <h2 className="font-heading text-lg font-semibold mb-3">Quadro de Medalhas Consolidado</h2>
        <div className="grid gap-3 grid-cols-3">
          <Kpi icon={Award} label="Ouro" value={r?.totalMedalsGold ?? 0} />
          <Kpi icon={Award} label="Prata" value={r?.totalMedalsSilver ?? 0} />
          <Kpi icon={Award} label="Bronze" value={r?.totalMedalsBronze ?? 0} />
        </div>
      </section>

      {/* Modalidades */}
      <Card>
        <CardHeader><CardTitle className="text-base">Modalidades Executadas</CardTitle></CardHeader>
        <CardContent>
          {!data || data.sports.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma modalidade registrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Modalidade</TableHead>
                  <TableHead className="text-center w-24">Partidas</TableHead>
                  <TableHead className="text-center w-28">Publicadas</TableHead>
                  <TableHead className="w-40">Progresso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.sports.map((sp) => {
                  const pct = sp.matches > 0 ? Math.round((sp.published / sp.matches) * 100) : 0;
                  return (
                    <TableRow key={sp.id}>
                      <TableCell>{sp.name}</TableCell>
                      <TableCell className="text-center">{sp.matches}</TableCell>
                      <TableCell className="text-center">{sp.published}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="h-2 flex-1" />
                          <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Registros Complementares */}
      {data && data.oscRegistros && data.oscRegistros.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registros Operacionais Complementares</CardTitle>
            <CardDescription>Eventos e indicadores manuais registrados para fins de prestação de contas.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.oscRegistros.map((reg) => (
                  <TableRow key={reg.id}>
                    <TableCell className="text-xs">{new Date(reg.recorded_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="capitalize text-xs font-medium">{reg.type.replace('_', ' ')}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{reg.description || "—"}</TableCell>
                    <TableCell className="text-right font-bold">{reg.value_numeric} {reg.unit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Delegações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Atendimento por Delegação
            {data && <Badge variant="secondary">{data.delegations.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data || data.delegations.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma delegação registrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Escola</TableHead>
                    <TableHead className="w-28">Rede</TableHead>
                    <TableHead className="text-center w-24">Inscritos</TableHead>
                    <TableHead className="text-center w-28">Credenciados</TableHead>
                    <TableHead className="text-center w-24">Refeições</TableHead>
                    <TableHead className="text-center w-16">Ouro</TableHead>
                    <TableHead className="text-center w-16">Prata</TableHead>
                    <TableHead className="text-center w-16">Bronze</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.delegations.map((d) => (
                    <TableRow key={d.delegationId}>
                      <TableCell>{d.schoolName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{d.network || "—"}</TableCell>
                      <TableCell className="text-center">{d.totalParticipants}</TableCell>
                      <TableCell className="text-center">{d.credentialed}</TableCell>
                      <TableCell className="text-center">{d.meals}</TableCell>
                      <TableCell className="text-center font-medium">{d.medalsGold}</TableCell>
                      <TableCell className="text-center">{d.medalsSilver}</TableCell>
                      <TableCell className="text-center">{d.medalsBronze}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground italic">
        Documento destinado à prestação de contas formal junto a Governo de Roraima, IDJUV, Acolher e demais parceiros institucionais.
      </p>
    </div>
  );
}
