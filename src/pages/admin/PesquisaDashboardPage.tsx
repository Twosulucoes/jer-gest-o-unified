import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Download, FileText, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useStageModuleKpis } from '@/contexts/StageModuleKpisContext';
import { useEventBranding } from '@/hooks/useEventBranding';
import { coerceConfig, isConfigV2, type PesquisaConfig } from '@/lib/pesquisa/config';
import { computeStats, boolLabel, type SurveyRow } from '@/lib/pesquisa/aggregate';
import { exportPesquisaSatisfacaoPdf, type PesquisaReportMeta } from './relatorios/pesquisaSatisfacaoPdfExporter';
import { exportPesquisaListagemPdf } from './relatorios/pesquisaListagemPdfExporter';

export default function PesquisaDashboardPage() {

  const [eventFilter, setEventFilter] = useState<string>('all');
  const [researcherFilter, setResearcherFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exporting, setExporting] = useState<'consolidado' | 'listagem' | null>(null);

  // Esconde os KPIs globais da etapa (vinculados/credenciados/pendentes) — não se aplicam à pesquisa.
  useStageModuleKpis([], true);

  const { data: events } = useQuery({
    queryKey: ['pesquisa-events-cfg'],
    queryFn: async () => {
      const { data } = await supabase
        .from('pesquisa_events')
        .select('id, name, questions_config, event_stage_id, event_stages(event_id)')
        .order('created_at', { ascending: false });
      return (data || []) as unknown as {
        id: string; name: string; questions_config: unknown;
        event_stage_id: string | null;
        event_stages?: { event_id: string | null } | null;
      }[];
    },
  });

  const { data: researchers } = useQuery({
    queryKey: ['pesquisa-researchers-list', eventFilter],
    queryFn: async () => {
      // Lista todos os pesquisadores (inclusive inativos): coletas de pesquisadores
      // desativados continuam contando nos totais, então precisam ser filtráveis aqui.
      let query = supabase.from('pesquisa_researchers').select('id, name, active').order('name');
      if (eventFilter !== 'all') query = query.eq('event_id', eventFilter);
      const { data } = await query;
      return (data || []) as { id: string; name: string; active: boolean }[];
    },
  });

  const { data: surveys, isLoading } = useQuery({
    queryKey: ['pesquisa-surveys', eventFilter, researcherFilter, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from('pesquisa_surveys')
        .select('id, client_uuid, researcher_id, event_id, mode, collected_at, application_location, answers, pesquisa_researchers(name), pesquisa_events(name, location)')
        .order('collected_at', { ascending: false })
        .limit(1000);
      if (eventFilter !== 'all') query = query.eq('event_id', eventFilter);
      if (researcherFilter === '__public__') query = query.is('researcher_id', null);
      else if (researcherFilter !== 'all') query = query.eq('researcher_id', researcherFilter);
      if (dateFrom) query = query.gte('collected_at', dateFrom);
      if (dateTo) query = query.lte('collected_at', dateTo + 'T23:59:59');
      const { data } = await query;
      return (data || []) as unknown as SurveyRow[];
    },
  });

  // Config do evento selecionado (para rótulos/tipos). Em "todos", sem config.
  const selectedConfig: PesquisaConfig | null = useMemo(() => {
    if (eventFilter === 'all') return null;
    const ev = events?.find((e) => e.id === eventFilter);
    return ev && isConfigV2(ev.questions_config) ? coerceConfig(ev.questions_config) : null;
  }, [eventFilter, events]);

  const stats = useMemo(() => computeStats(surveys ?? [], selectedConfig), [surveys, selectedConfig]);

  // Evento principal (via etapa vinculada) para resolver logo/branding no PDF.
  const mainEventId = useMemo(() => {
    if (eventFilter === 'all') return undefined;
    return events?.find((e) => e.id === eventFilter)?.event_stages?.event_id ?? undefined;
  }, [eventFilter, events]);
  const { data: branding } = useEventBranding(mainEventId);

  const questionKeysForExport = useMemo(() => {
    if (selectedConfig) return selectedConfig.questions.map((q) => q.key);
    const keys = new Set<string>();
    (surveys ?? []).forEach((s) => Object.keys(s.answers ?? {}).forEach((k) => keys.add(k)));
    return [...keys];
  }, [selectedConfig, surveys]);

  const handleExport = () => {
    if (!surveys || surveys.length === 0) return;
    const meta = ['collected_at', 'researcher_name', 'event_name', 'application_location', 'mode'];
    const headers = [...meta, ...questionKeysForExport, 'client_uuid'];
    const cell = (v: unknown) => {
      if (v == null) return '';
      const s = Array.isArray(v) ? v.join('|') : typeof v === 'boolean' ? boolLabel(v) : String(v);
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = surveys.map((s) => {
      const base: Record<string, unknown> = {
        collected_at: s.collected_at,
        researcher_name: s.pesquisa_researchers?.name ?? '',
        event_name: s.pesquisa_events?.name ?? '',
        application_location: s.application_location ?? '',
        mode: s.mode ?? '',
        client_uuid: s.client_uuid,
      };
      return headers.map((h) => cell(h in base ? base[h] : s.answers?.[h])).join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pesquisa_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const buildPdfMeta = (): PesquisaReportMeta => {
    const eventName = eventFilter === 'all'
      ? 'Todos os eventos'
      : events?.find((e) => e.id === eventFilter)?.name ?? 'Evento';
    const researcherName = researcherFilter === 'all'
      ? undefined
      : researcherFilter === '__public__'
        ? 'Coletas públicas'
        : (researchers as { id: string; name: string }[] | undefined)?.find((r) => r.id === researcherFilter)?.name;
    return {
      eventName,
      researcherName,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      generatedAt: new Date(),
      branding: branding ?? null,
    };
  };

  const downloadPdf = (blob: Blob, prefix: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${prefix}_${new Date().toISOString().slice(0, 10)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = async () => {
    if (!surveys || surveys.length === 0) return;
    try {
      setExporting('consolidado');
      const blob = await exportPesquisaSatisfacaoPdf(surveys, selectedConfig, buildPdfMeta());
      downloadPdf(blob, 'pesquisa_satisfacao');
      toast.success('Relatório consolidado gerado');
    } catch (e: unknown) {
      toast.error('Falha ao gerar PDF: ' + (e instanceof Error ? e.message : 'erro desconhecido'));
    } finally {
      setExporting(null);
    }
  };

  const handleExportListagem = async () => {
    if (!surveys || surveys.length === 0) return;
    try {
      setExporting('listagem');
      const blob = await exportPesquisaListagemPdf(surveys, selectedConfig, buildPdfMeta());
      downloadPdf(blob, 'pesquisa_listagem');
      toast.success('Listagem de coletas gerada');
    } catch (e: unknown) {
      toast.error('Falha ao gerar PDF: ' + (e instanceof Error ? e.message : 'erro desconhecido'));
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pesquisa de Satisfação</h1>
        <p className="text-sm text-muted-foreground">Gestão e resultados das pesquisas</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger className="w-[240px]"><SelectValue placeholder="Evento de pesquisa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos eventos</SelectItem>
            {events?.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={researcherFilter} onValueChange={setResearcherFilter}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Pesquisador" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos pesquisadores</SelectItem>
            {researchers?.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.name}{r.active ? '' : ' · inativo'}</SelectItem>
            ))}
            <SelectItem value="__public__">Coletas públicas (sem pesquisador)</SelectItem>
          </SelectContent>
        </Select>

        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[160px]" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[160px]" />

        <Button variant="outline" onClick={handleExport} disabled={!surveys?.length}>
          <Download className="h-4 w-4 mr-2" /> Exportar CSV
        </Button>

        <Button onClick={handleExportPdf} disabled={!surveys?.length || exporting !== null}>
          <FileText className="h-4 w-4 mr-2" /> {exporting === 'consolidado' ? 'Gerando...' : 'PDF Consolidado'}
        </Button>

        <Button variant="outline" onClick={handleExportListagem} disabled={!surveys?.length || exporting !== null}>
          <FileText className="h-4 w-4 mr-2" /> {exporting === 'listagem' ? 'Gerando...' : 'PDF Listagem'}
        </Button>
      </div>

      {eventFilter === 'all' && (
        <p className="text-xs text-muted-foreground">
          Selecione um evento para ver a análise pergunta a pergunta (formulários podem diferir entre eventos).
        </p>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : !stats ? (
        <p className="text-muted-foreground">Nenhuma coleta encontrada.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-6 text-center">
              <p className="text-3xl font-bold text-primary">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total de coletas</p>
            </Card>
            <Card className="p-6 text-center">
              <p className="text-3xl font-bold text-primary">{stats.overallAvg ?? '—'}</p>
              <p className="text-sm text-muted-foreground">Média geral (escalas)</p>
            </Card>
            <Card className="p-6 text-center">
              <p className="text-3xl font-bold text-primary">{stats.today}</p>
              <p className="text-sm text-muted-foreground">Coletas hoje</p>
            </Card>
          </div>

          {stats.scaleStats.length > 0 && (
            <Card className="p-6">
              <h3 className="text-sm font-semibold mb-4">Média por pergunta (escala)</h3>
              <ResponsiveContainer width="100%" height={Math.max(200, stats.scaleStats.length * 38)}>
                <BarChart data={stats.scaleStats.map((s) => ({ name: s.label, avg: s.avg }))} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 5]} fontSize={12} />
                  <YAxis type="category" dataKey="name" width={140} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="avg" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Detalhamento por pergunta (não-escala) */}
          {stats.qStats.some((s) => s.type === 'choice' || s.type === 'boolean') && (
            <Card className="p-6 space-y-5">
              <h3 className="text-sm font-semibold">Distribuições</h3>
              {stats.qStats.map((s) => {
                if (s.type === 'boolean') {
                  const tot = s.yes + s.no || 1;
                  return (
                    <div key={s.key} className="space-y-1">
                      <p className="text-sm font-medium">{s.label}</p>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <span>Sim: <b className="text-foreground">{s.yes}</b> ({Math.round((s.yes / tot) * 100)}%)</span>
                        <span>Não: <b className="text-foreground">{s.no}</b> ({Math.round((s.no / tot) * 100)}%)</span>
                      </div>
                    </div>
                  );
                }
                if (s.type === 'choice') {
                  const tot = s.count || 1;
                  return (
                    <div key={s.key} className="space-y-1">
                      <p className="text-sm font-medium">{s.label}</p>
                      <div className="space-y-0.5">
                        {s.dist.sort((a, b) => b.count - a.count).map((d) => (
                          <div key={d.label} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{d.label}</span>
                            <span className="font-mono">{d.count} ({Math.round((d.count / tot) * 100)}%)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })}
            </Card>
          )}

          {/* Comentários (texto) */}
          {stats.recentComments.length > 0 && (
            <Card className="p-6 space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Comentários</h3>
              {stats.recentComments.map((c, i) => (
                <div key={i} className="border-l-2 border-primary pl-3 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {c.question} · {format(new Date(c.at), 'dd/MM HH:mm')}{c.who ? ` · ${c.who}` : ''}
                  </p>
                  <p className="text-sm">{c.text}</p>
                </div>
              ))}
            </Card>
          )}

          {/* Relatório de coletas */}
          <Card className="p-6">
            <h3 className="text-sm font-semibold mb-4">Relatório de Coletas</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Data/Hora</th>
                    <th className="text-left py-2">Pesquisador</th>
                    <th className="text-left py-2">Evento</th>
                    <th className="text-left py-2">Local</th>
                    <th className="text-left py-2">Modo</th>
                  </tr>
                </thead>
                <tbody>
                  {surveys?.slice(0, 100).map((s) => (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="py-2">{format(new Date(s.collected_at), 'dd/MM/yyyy HH:mm')}</td>
                      <td className="py-2">{s.pesquisa_researchers?.name || '—'}</td>
                      <td className="py-2">{s.pesquisa_events?.name || '—'}</td>
                      <td className="py-2">{s.application_location || s.pesquisa_events?.location || '—'}</td>
                      <td className="py-2">{s.mode || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
