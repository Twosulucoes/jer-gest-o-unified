import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import ModuleHeader from '@/components/admin/ModuleHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Download, MessageSquare } from 'lucide-react';
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
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const { data: events } = useQuery({
    queryKey: ['pesquisa-events'],
    queryFn: async () => {
      const { data } = await supabase.from('pesquisa_events').select('id, name').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: surveys, isLoading } = useQuery({
    queryKey: ['pesquisa-surveys', eventFilter, dateFrom, dateTo, typeFilter],
    queryFn: async () => {
      let query = supabase.from('pesquisa_surveys').select('*').order('collected_at', { ascending: false }).limit(1000);
      if (eventFilter !== 'all') query = query.eq('event_id', eventFilter);
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
      'event_id', 'respondent_type', 'respondent_age', 'respondent_gender', 'mode',
      ...QUESTION_KEYS, 'ponto_positivo', 'sugestao', 'collected_at', 'device_id', 'client_uuid'
    ];
    const rows = surveys.map(s => headers.map(h => {
      const val = (s as any)[h];
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Pesquisa de Satisfação</h1>
        <p className="text-sm text-muted-foreground">Dashboard de resultados da pesquisa</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Evento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos eventos</SelectItem>
            {events?.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
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
              {stats.recentComments.map((s, i) => (
                <div key={i} className="border-l-2 border-primary pl-3 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {s.respondent_type} · {format(new Date(s.collected_at), 'dd/MM HH:mm')}
                  </p>
                  {s.ponto_positivo && <p className="text-sm"><span className="font-medium">👍</span> {s.ponto_positivo}</p>}
                  {s.sugestao && <p className="text-sm"><span className="font-medium">💡</span> {s.sugestao}</p>}
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
