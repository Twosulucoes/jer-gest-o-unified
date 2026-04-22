import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Download, MessageSquare, LayoutDashboard, ClipboardList, Users } from 'lucide-react';
import { format } from 'date-fns';

const DIM_LABELS: Record<string, string> = {
  d1_organizacao: 'Organização',
  d1_infraestrutura: 'Infraestrutura',
  d1_alimentacao: 'Alimentação',
  d1_seguranca: 'Segurança',
  d1_transporte: 'Transporte',
  d2_igualdade: 'Igualdade',
  d2_acessibilidade: 'Acessibilidade',
  d2_inclusao: 'Inclusão',
  d3_aprendizado: 'Aprendizado',
  d3_convivencia: 'Convivência',
  d3_cidadania: 'Cidadania',
  d3_superacao: 'Superação',
};

const QUESTION_KEYS = Object.keys(DIM_LABELS);

export default function PesquisaDashboardPage() {
  const navigate = useNavigate();
  const { stageId } = useParams<{ stageId: string }>();
  const base = stageId ? `/admin/etapa/${stageId}/pesquisa` : '/admin/pesquisa';

  const [eventFilter, setEventFilter] = useState<string>('all');
  const [researcherFilter, setResearcherFilter] = useState<string>('all');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const { data: events } = useQuery({
    queryKey: ['pesquisa-events'],
    queryFn: async () => {
      const { data } = await supabase
        .from('pesquisa_events')
        .select('id, name, event_stage_id')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: researchers } = useQuery({
    queryKey: ['pesquisa-researchers-list', eventFilter],
    queryFn: async () => {
      let query = supabase.from('pesquisa_researchers').select('id, name').eq('active', true).order('name');
      if (eventFilter !== 'all') query = query.eq('event_id', eventFilter);
      const { data } = await query;
      return data || [];
    },
  });

  // Load stages that are linked to at least one pesquisa_event
  const { data: stages } = useQuery({
    queryKey: ['pesquisa-stages'],
    queryFn: async () => {
      const { data } = await (supabase.from('event_stages' as never) as any)
        .select('id, name, kind')
        .eq('status', 'active')
        .order('sort_order');
      return (data || []) as { id: string; name: string; kind: string }[];
    },
  });

  const { data: surveys, isLoading } = useQuery({
    queryKey: ['pesquisa-surveys', eventFilter, researcherFilter, stageFilter, dateFrom, dateTo, typeFilter],
    queryFn: async () => {
      let query = supabase
        .from('pesquisa_surveys')
        .select('*, pesquisa_researchers(name), pesquisa_events(name, location, event_date)')
        .order('collected_at', { ascending: false })
        .limit(1000);
      if (eventFilter !== 'all') query = query.eq('event_id', eventFilter);
      if (researcherFilter !== 'all') query = query.eq('researcher_id', researcherFilter);
      if (stageFilter === 'none') query = (query as any).is('event_stage_id', null);
      else if (stageFilter !== 'all') query = (query as any).eq('event_stage_id', stageFilter);
      if (dateFrom) query = query.gte('collected_at', dateFrom);
      if (dateTo) query = query.lte('collected_at', dateTo + 'T23:59:59');
      if (typeFilter !== 'all') query = query.eq('respondent_type', typeFilter);
      const { data } = await query;
      return data || [];
    },
  });

  const stats = useMemo(() => {
    if (!surveys || surveys.length === 0) return null;

    const total = surveys.length;
    const today = surveys.filter(s => new Date(s.collected_at).toDateString() === new Date().toDateString()).length;

    // Per-question averages
    const questionAvgs = QUESTION_KEYS.map(key => {
      const sum = surveys.reduce((acc, s) => acc + ((s as any)[key] || 0), 0);
      return { key, label: DIM_LABELS[key], avg: +(sum / total).toFixed(2) };
    });

    const overallAvg = +(questionAvgs.reduce((a, q) => a + q.avg, 0) / questionAvgs.length).toFixed(2);

    // Dimension averages
    const d1Keys = QUESTION_KEYS.filter(k => k.startsWith('d1_'));
    const d2Keys = QUESTION_KEYS.filter(k => k.startsWith('d2_'));
    const d3Keys = QUESTION_KEYS.filter(k => k.startsWith('d3_'));

    const dimAvg = (keys: string[]) => +(keys.reduce((a, k) => a + (questionAvgs.find(q => q.key === k)?.avg || 0), 0) / keys.length).toFixed(2);

    const dimensions = [
      { name: 'D1 — Operação', avg: dimAvg(d1Keys) },
      { name: 'D2 — Valores', avg: dimAvg(d2Keys) },
      { name: 'D3 — Impacto', avg: dimAvg(d3Keys) },
    ];

    const recentComments = surveys
      .filter(s => s.ponto_positivo || s.sugestao)
      .slice(0, 10);

    return { total, today, overallAvg, questionAvgs, dimensions, recentComments };
  }, [surveys]);

  const handleExport = () => {
    if (!surveys || surveys.length === 0) return;
    const headers = [
      'event_id', 'event_stage_id', 'respondent_type', 'respondent_age', 'respondent_gender', 'mode',
      'researcher_id', 'researcher_name', 'event_name', 'event_location', 'application_location',
      ...QUESTION_KEYS, 'ponto_positivo', 'sugestao', 'collected_at', 'device_id', 'client_uuid'
    ];
    const rows = surveys.map(s => headers.map(h => {
      let val: unknown = (s as any)[h];
      if (h === 'researcher_name') val = (s as any).pesquisa_researchers?.name;
      if (h === 'event_name') val = (s as any).pesquisa_events?.name;
      if (h === 'event_location') val = (s as any).pesquisa_events?.location;
      if (val == null) return '';
      return typeof val === 'string' && val.includes(',') ? `"${val}"` : String(val);
    }).join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pesquisa_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header + Tabs */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pesquisa de Satisfação</h1>
          <p className="text-sm text-muted-foreground">Gestão e resultados das pesquisas OSC</p>
        </div>
        <div className="flex gap-1 border-b border-border">
          <button
            onClick={() => navigate(base)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 border-primary text-primary -mb-px transition-colors"
          >
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </button>
          <button
            onClick={() => navigate(`${base}/eventos`)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground hover:border-border -mb-px transition-colors"
          >
            <ClipboardList className="h-4 w-4" /> Pesquisas
          </button>
          <button
            onClick={() => navigate(`${base}/pesquisadores`)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground hover:border-border -mb-px transition-colors"
          >
            <Users className="h-4 w-4" /> Pesquisadores
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={eventFilter} onValueChange={(v) => { setEventFilter(v); setStageFilter('all'); }}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Evento de pesquisa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos eventos</SelectItem>
            {events?.map(e => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
                {(e as any).event_stage_id && <span className="ml-1 text-xs text-muted-foreground">· etapa</span>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!stageId && (
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Etapa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas etapas</SelectItem>
              <SelectItem value="none">Sem etapa</SelectItem>
              {stages?.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={researcherFilter} onValueChange={setResearcherFilter}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Pesquisador" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos pesquisadores</SelectItem>
            {researchers?.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[160px]" placeholder="Data inicial" />
        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[160px]" placeholder="Data final" />

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos tipos</SelectItem>
            <SelectItem value="atleta">Atleta</SelectItem>
            <SelectItem value="familiar">Familiar</SelectItem>
            <SelectItem value="professor">Professor</SelectItem>
            <SelectItem value="tecnico">Técnico</SelectItem>
            <SelectItem value="outro">Outro</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={handleExport} disabled={!surveys?.length}>
          <Download className="h-4 w-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      {/* Stage context badge */}
      {stageFilter !== 'all' && stageFilter !== 'none' && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            Etapa: {stages?.find(s => s.id === stageFilter)?.name ?? stageFilter}
          </Badge>
          <button className="text-xs text-muted-foreground underline" onClick={() => setStageFilter('all')}>
            limpar
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : !stats ? (
        <p className="text-muted-foreground">Nenhuma coleta encontrada.</p>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-6 text-center">
              <p className="text-3xl font-bold text-primary">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total de coletas</p>
            </Card>
            <Card className="p-6 text-center">
              <p className="text-3xl font-bold text-primary">{stats.overallAvg}</p>
              <p className="text-sm text-muted-foreground">Média geral</p>
            </Card>
            <Card className="p-6 text-center">
              <p className="text-3xl font-bold text-primary">{stats.today}</p>
              <p className="text-sm text-muted-foreground">Coletas hoje</p>
            </Card>
          </div>

          {/* Dimension Chart */}
          <Card className="p-6">
            <h3 className="text-sm font-semibold mb-4">Média por Dimensão</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.dimensions}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis domain={[0, 5]} />
                <Tooltip />
                <Bar dataKey="avg" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Per-question table */}
          <Card className="p-6">
            <h3 className="text-sm font-semibold mb-4">Médias por Pergunta</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Pergunta</th>
                    <th className="text-right py-2">Média</th>
                  </tr>
                </thead>
                <tbody>
                  {[...stats.questionAvgs].sort((a, b) => a.avg - b.avg).map(q => (
                    <tr key={q.key} className="border-b last:border-0">
                      <td className="py-2">{q.label}</td>
                      <td className="text-right py-2 font-mono">{q.avg}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Recent comments */}
          {stats.recentComments.length > 0 && (
            <Card className="p-6 space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Últimos Comentários
              </h3>
              {stats.recentComments.map((s, i) => {
                const stageName = (s as any).event_stage_id
                  ? stages?.find(st => st.id === (s as any).event_stage_id)?.name
                  : null;
                return (
                  <div key={i} className="border-l-2 border-primary pl-3 space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {s.respondent_type} · {format(new Date(s.collected_at), 'dd/MM HH:mm')}
                      {` · ${(s as any).pesquisa_researchers?.name || 'Pesquisador'}`}
                      {` · Local: ${(s as any).application_location || (s as any).pesquisa_events?.location || 'não informado'}`}
                      {stageName && <span className="ml-1">· <Badge variant="outline" className="text-xs py-0">{stageName}</Badge></span>}
                    </p>
                    {s.ponto_positivo && <p className="text-sm"><span className="font-medium">👍</span> {s.ponto_positivo}</p>}
                    {s.sugestao && <p className="text-sm"><span className="font-medium">💡</span> {s.sugestao}</p>}
                  </div>
                );
              })}
            </Card>
          )}

          <Card className="p-6">
            <h3 className="text-sm font-semibold mb-4">Relatório de Coletas (local, data e hora)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Data/Hora</th>
                    <th className="text-left py-2">Pesquisador</th>
                    <th className="text-left py-2">Evento</th>
                    <th className="text-left py-2">Local da pesquisa</th>
                    <th className="text-left py-2">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {surveys?.slice(0, 100).map((s: any) => (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="py-2">{format(new Date(s.collected_at), 'dd/MM/yyyy HH:mm')}</td>
                      <td className="py-2">{s.pesquisa_researchers?.name || '—'}</td>
                      <td className="py-2">{s.pesquisa_events?.name || '—'}</td>
                      <td className="py-2">{s.application_location || s.pesquisa_events?.location || '—'}</td>
                      <td className="py-2">{s.respondent_type}</td>
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
