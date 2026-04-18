import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Save, RotateCcw, Layers, LayoutTemplate, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { PESQUISA_TEMPLATES, DEFAULT_TEMPLATE, type PesquisaQuestion } from '@/lib/pesquisa/templates';

interface EventStageOption {
  id: string;
  name: string;
  kind: string;
  event_name: string;
}

const KIND_LABELS: Record<string, string> = {
  classificatoria: 'Classificatória',
  semifinal: 'Semifinal',
  final: 'Final',
  legado: 'Legado',
  outro: 'Outro',
};

const BADGE_COLORS: Record<string, string> = {
  'Recomendado': 'bg-primary/10 text-primary border-primary/20',
  'OSC / Legal':  'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400',
  'Por Etapa':   'bg-info/10 text-info border-info/20',
  'Participante':'bg-success/10 text-success border-success/20',
};

export default function PesquisaFormEditorPage() {
  const { eventId, stageId } = useParams<{ eventId: string; stageId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [active, setActive] = useState(true);
  const [eventStageId, setEventStageId] = useState('');
  const [stageOptions, setStageOptions] = useState<EventStageOption[]>([]);
  const [questions, setQuestions] = useState<PesquisaQuestion[]>(DEFAULT_TEMPLATE.questions);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

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
        navigate(stageId ? `/admin/etapa/${stageId}/pesquisa/eventos` : '/admin/pesquisa/eventos');
        return;
      }

      const ev = eventRes.data as any;
      setName(ev.name ?? '');
      setLocation(ev.location ?? '');
      setEventDate(ev.event_date ?? '');
      setActive(ev.active ?? true);
      setEventStageId(ev.event_stage_id ?? '');

      if (Array.isArray(ev.questions_config) && ev.questions_config.length > 0) {
        setQuestions(ev.questions_config as PesquisaQuestion[]);
        // Detect which template matches saved config
        const matched = PESQUISA_TEMPLATES.find(
          t => JSON.stringify(t.questions) === JSON.stringify(ev.questions_config)
        );
        setActiveTemplateId(matched?.id ?? null);
      } else {
        setQuestions(DEFAULT_TEMPLATE.questions);
        setActiveTemplateId(DEFAULT_TEMPLATE.id);
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
  }, [eventId, navigate, stageId]);

  const applyTemplate = (templateId: string) => {
    const tpl = PESQUISA_TEMPLATES.find(t => t.id === templateId);
    if (!tpl) return;
    setQuestions([...tpl.questions]);
    setActiveTemplateId(templateId);
    toast.info(`Modelo "${tpl.name}" aplicado — salve para confirmar`);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Nome obrigatório'); return; }
    setSaving(true);

    const isDefault = JSON.stringify(questions) === JSON.stringify(DEFAULT_TEMPLATE.questions);

    const { error } = await supabase
      .from('pesquisa_events')
      .update({
        name: name.trim(),
        location: location.trim() || null,
        event_date: eventDate || null,
        active,
        event_stage_id: eventStageId || null,
        questions_config: isDefault ? null : questions,
      } as any)
      .eq('id', eventId!);

    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } else {
      toast.success('Configurações salvas com sucesso');
    }
    setSaving(false);
  };

  const updateQuestion = (idx: number, field: 'label' | 'dim', value: string) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));
    setActiveTemplateId(null); // user customized manually
  };

  const goBack = () => navigate(
    stageId ? `/admin/etapa/${stageId}/pesquisa/eventos` : '/admin/pesquisa/eventos'
  );

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full" />)}
      </div>
    );
  }

  const dimensions = [...new Set(questions.map(q => q.dim))];

  return (
    <div className="space-y-6 max-w-2xl pb-12">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold leading-tight">Configurar Pesquisa</h1>
          <p className="text-sm text-muted-foreground truncate">{name}</p>
        </div>
        <Button onClick={handleSave} disabled={saving || !name.trim()} className="gap-2 shrink-0">
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Local</Label>
              <Input value={location} onChange={e => setLocation(e.target.value)} maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="active" checked={active} onCheckedChange={setActive} />
            <Label htmlFor="active" className="cursor-pointer">Pesquisa ativa</Label>
          </div>
        </CardContent>
      </Card>

      {/* Etapa */}
      <Card className="card-accent-top">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4 text-accent" />
            Etapa da Competição
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={eventStageId || 'none'} onValueChange={v => setEventStageId(v === 'none' ? '' : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma etapa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Sem etapa vinculada —</SelectItem>
              {stageOptions.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.event_name} · {s.name} ({KIND_LABELS[s.kind] ?? s.kind})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Vinculando uma etapa, as respostas ficam rastreáveis por fase — essencial para prestação de contas da OSC.
          </p>
        </CardContent>
      </Card>

      {/* Modelos prontos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <LayoutTemplate className="h-4 w-4 text-primary" />
            Modelos de Formulário
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Selecione um modelo para preencher as perguntas automaticamente. Você pode personalizar os rótulos abaixo.
          </p>
          <div className="grid grid-cols-1 gap-2">
            {PESQUISA_TEMPLATES.map(tpl => {
              const isActive = activeTemplateId === tpl.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => applyTemplate(tpl.id)}
                  className={[
                    'w-full text-left rounded-lg border p-3 transition-all duration-150',
                    isActive
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                      : 'border-border hover:border-primary/30 hover:bg-muted/30',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <div className="flex items-center gap-2">
                      {isActive && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                      <span className="font-semibold text-sm">{tpl.name}</span>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${BADGE_COLORS[tpl.badge] ?? 'bg-muted text-muted-foreground'}`}>
                      {tpl.badge}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug pl-5">{tpl.description}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Perguntas */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Perguntas do Formulário</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => applyTemplate(DEFAULT_TEMPLATE.id)}
              className="text-xs text-muted-foreground gap-1"
            >
              <RotateCcw className="h-3 w-3" /> Restaurar padrão
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-xs text-muted-foreground">
            Personalize os rótulos das perguntas e nomes das dimensões conforme a necessidade da OSC.
          </p>

          {dimensions.map(dim => (
            <div key={dim} className="space-y-2">
              <div className="flex items-center gap-2">
                <Separator className="flex-1" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-primary whitespace-nowrap px-1">
                  {dim}
                </span>
                <Separator className="flex-1" />
              </div>

              {questions
                .map((q, idx) => ({ q, idx }))
                .filter(({ q }) => q.dim === dim)
                .map(({ q, idx }) => (
                  <div key={q.key} className="grid grid-cols-[1fr_180px] gap-2 items-start p-3 rounded-lg border bg-muted/20">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Rótulo — <code className="text-[10px] bg-muted px-1 py-0.5 rounded">{q.key}</code>
                      </Label>
                      <Input
                        value={q.label}
                        onChange={e => updateQuestion(idx, 'label', e.target.value)}
                        className="h-8 text-sm"
                        maxLength={100}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Dimensão</Label>
                      <Input
                        value={q.dim}
                        onChange={e => updateQuestion(idx, 'dim', e.target.value)}
                        className="h-8 text-sm"
                        maxLength={50}
                      />
                    </div>
                  </div>
                ))}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !name.trim()} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar configurações'}
        </Button>
      </div>
    </div>
  );
}
