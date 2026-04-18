import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

interface Question {
  key: string;
  label: string;
  dim: string;
}

interface EventStageOption {
  id: string;
  name: string;
  kind: string;
  event_name: string;
}

const DEFAULT_QUESTIONS: Question[] = [
  { key: 'd1_organizacao', label: 'Organização do evento', dim: 'D1 — Operação' },
  { key: 'd1_infraestrutura', label: 'Infraestrutura', dim: 'D1 — Operação' },
  { key: 'd1_alimentacao', label: 'Alimentação', dim: 'D1 — Operação' },
  { key: 'd1_seguranca', label: 'Segurança', dim: 'D1 — Operação' },
  { key: 'd1_transporte', label: 'Transporte', dim: 'D1 — Operação' },
  { key: 'd2_igualdade', label: 'Igualdade de tratamento', dim: 'D2 — Valores' },
  { key: 'd2_acessibilidade', label: 'Acessibilidade', dim: 'D2 — Valores' },
  { key: 'd2_inclusao', label: 'Inclusão', dim: 'D2 — Valores' },
  { key: 'd3_aprendizado', label: 'Aprendizado', dim: 'D3 — Impacto' },
  { key: 'd3_convivencia', label: 'Convivência e amizade', dim: 'D3 — Impacto' },
  { key: 'd3_cidadania', label: 'Cidadania', dim: 'D3 — Impacto' },
  { key: 'd3_superacao', label: 'Superação pessoal', dim: 'D3 — Impacto' },
];

const KIND_LABELS: Record<string, string> = {
  classificatoria: 'Classificatória',
  semifinal: 'Semifinal',
  final: 'Final',
  legado: 'Legado',
  outro: 'Outro',
};

export default function PesquisaFormEditorPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Basic info
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [active, setActive] = useState(true);

  // Phase
  const [eventStageId, setEventStageId] = useState<string>('');
  const [stageOptions, setStageOptions] = useState<EventStageOption[]>([]);

  // Questions
  const [questions, setQuestions] = useState<Question[]>(DEFAULT_QUESTIONS);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      setLoading(true);

      const [eventRes, stagesRes] = await Promise.all([
        supabase
          .from('pesquisa_events')
          .select('id, name, location, event_date, active, event_stage_id, questions_config')
          .eq('id', eventId)
          .single(),
        supabase
          .from('event_stages')
          .select('id, name, kind, event_id, events(name)')
          .eq('status', 'active')
          .order('sort_order'),
      ]);

      if (eventRes.error) {
        toast.error('Evento não encontrado');
        navigate('/admin/pesquisa/eventos');
        return;
      }

      const ev = eventRes.data as any;
      setName(ev.name ?? '');
      setLocation(ev.location ?? '');
      setEventDate(ev.event_date ?? '');
      setActive(ev.active ?? true);
      setEventStageId(ev.event_stage_id ?? '');

      if (Array.isArray(ev.questions_config) && ev.questions_config.length > 0) {
        setQuestions(ev.questions_config as Question[]);
      }

      if (!stagesRes.error && Array.isArray(stagesRes.data)) {
        setStageOptions(
          stagesRes.data.map((s: any) => ({
            id: s.id,
            name: s.name,
            kind: s.kind,
            event_name: s.events?.name ?? '',
          }))
        );
      }

      setLoading(false);
    })();
  }, [eventId, navigate]);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Nome obrigatório'); return; }
    setSaving(true);

    const questionsChanged = JSON.stringify(questions) !== JSON.stringify(DEFAULT_QUESTIONS);

    const { error } = await supabase
      .from('pesquisa_events')
      .update({
        name: name.trim(),
        location: location.trim() || null,
        event_date: eventDate || null,
        active,
        event_stage_id: eventStageId || null,
        questions_config: questionsChanged ? questions : null,
      } as any)
      .eq('id', eventId!);

    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } else {
      toast.success('Configurações salvas');
    }
    setSaving(false);
  };

  const updateQuestion = (idx: number, field: 'label' | 'dim', value: string) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  };

  const resetQuestions = () => {
    setQuestions(DEFAULT_QUESTIONS);
    toast.info('Perguntas restauradas para o padrão');
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/pesquisa/eventos')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Editar Formulário</h1>
          <p className="text-sm text-muted-foreground">{name}</p>
        </div>
      </div>

      {/* Informações básicas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Informações do Evento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label>Local</Label>
            <Input value={location} onChange={e => setLocation(e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} />
            <Label>Evento ativo</Label>
          </div>
        </CardContent>
      </Card>

      {/* Fase da competição */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Fase da Competição</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label>Vincular fase</Label>
            <Select value={eventStageId || 'none'} onValueChange={v => setEventStageId(v === 'none' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Nenhuma fase selecionada" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Sem fase vinculada —</SelectItem>
                {stageOptions.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.event_name} · {s.name} ({KIND_LABELS[s.kind] ?? s.kind})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Vinculando uma fase permite rastrear as respostas por etapa da competição.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Perguntas */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Perguntas do Formulário</CardTitle>
            <Button variant="ghost" size="sm" onClick={resetQuestions} className="text-xs text-muted-foreground gap-1">
              <RotateCcw className="h-3 w-3" /> Restaurar padrões
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Personalize os rótulos das perguntas. Deixe igual ao padrão para não salvar configuração personalizada.
          </p>
          {questions.map((q, idx) => {
            const showDimHeader = idx === 0 || questions[idx - 1].dim !== q.dim;
            return (
              <div key={q.key}>
                {showDimHeader && (
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary mt-2 mb-1">{q.dim}</p>
                )}
                <div className="grid grid-cols-[1fr_auto] gap-2 items-start p-3 rounded-lg border bg-muted/20">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Rótulo — <code className="text-[10px]">{q.key}</code></Label>
                    <Input
                      value={q.label}
                      onChange={e => updateQuestion(idx, 'label', e.target.value)}
                      className="h-8 text-sm"
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-1.5 w-40">
                    <Label className="text-xs text-muted-foreground">Dimensão</Label>
                    <Input
                      value={q.dim}
                      onChange={e => updateQuestion(idx, 'dim', e.target.value)}
                      className="h-8 text-sm"
                      maxLength={50}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex justify-end pb-8">
        <Button onClick={handleSave} disabled={saving || !name.trim()} className="gap-2">
          <Save className="h-4 w-4" /> {saving ? 'Salvando...' : 'Salvar configurações'}
        </Button>
      </div>
    </div>
  );
}
