import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Save, Layers, LayoutTemplate, Plus, Trash2, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import {
  coerceConfig, DEFAULT_CONFIG, PESQUISA_PRESETS,
  type PesquisaConfig, type PesquisaQuestion, type PesquisaSection, type QuestionType, type QuestionOption,
} from '@/lib/pesquisa/config';

interface EventStageOption { id: string; name: string; kind: string; event_name: string; }

const KIND_LABELS: Record<string, string> = {
  classificatoria: 'Classificatória', semifinal: 'Semifinal', final: 'Final', legado: 'Legado', outro: 'Outro',
};

const TYPE_LABELS: Record<QuestionType, string> = {
  scale: 'Escala (nota)',
  single_choice: 'Escolha única',
  multi_choice: 'Múltipla escolha',
  boolean: 'Sim / Não',
  text: 'Texto livre',
};

const genKey = (prefix = 'q') => `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
const CHOICE_TYPES: QuestionType[] = ['single_choice', 'multi_choice'];

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
  const [config, setConfig] = useState<PesquisaConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      setLoading(true);
      const [eventRes, stagesRes] = await Promise.all([
        supabase.from('pesquisa_events').select('id, name, location, event_date, active, event_stage_id, questions_config').eq('id', eventId).single(),
        supabase.from('event_stages').select('id, name, kind, event_id, events(name)').eq('status', 'active').order('sort_order'),
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
      setConfig(coerceConfig(ev.questions_config));
      if (!stagesRes.error && Array.isArray(stagesRes.data)) {
        setStageOptions(stagesRes.data.map((s: any) => ({ id: s.id, name: s.name, kind: s.kind, event_name: s.events?.name ?? '' })));
      }
      setLoading(false);
    })();
  }, [eventId, navigate, stageId]);

  // ----- helpers de edição do config -----
  const sortedSections = [...config.sections].sort((a, b) => a.order - b.order);
  const questionsOf = (sectionKey: string) =>
    config.questions.filter((q) => q.section === sectionKey).sort((a, b) => a.order - b.order);

  const applyPreset = (presetId: string) => {
    const p = PESQUISA_PRESETS.find((x) => x.id === presetId);
    if (!p) return;
    setConfig(JSON.parse(JSON.stringify(p.config)) as PesquisaConfig);
    toast.info(`Modelo "${p.name}" aplicado — salve para confirmar`);
  };

  const updateQuestion = (key: string, patch: Partial<PesquisaQuestion>) => {
    setConfig((c) => ({ ...c, questions: c.questions.map((q) => (q.key === key ? { ...q, ...patch } : q)) }));
  };
  const removeQuestion = (key: string) => {
    setConfig((c) => ({ ...c, questions: c.questions.filter((q) => q.key !== key) }));
  };
  const addQuestion = (sectionKey: string) => {
    setConfig((c) => {
      const order = Math.max(0, ...c.questions.map((q) => q.order)) + 1;
      const q: PesquisaQuestion = { key: genKey(), section: sectionKey, order, type: 'scale', label: 'Nova pergunta', required: true, scaleMax: 5 };
      return { ...c, questions: [...c.questions, q] };
    });
  };
  const moveQuestion = (key: string, dir: -1 | 1) => {
    setConfig((c) => {
      const q = c.questions.find((x) => x.key === key);
      if (!q) return c;
      const siblings = c.questions.filter((x) => x.section === q.section).sort((a, b) => a.order - b.order);
      const i = siblings.findIndex((x) => x.key === key);
      const j = i + dir;
      if (j < 0 || j >= siblings.length) return c;
      const a = siblings[i], b = siblings[j];
      return { ...c, questions: c.questions.map((x) => x.key === a.key ? { ...x, order: b.order } : x.key === b.key ? { ...x, order: a.order } : x) };
    });
  };

  const updateSection = (key: string, patch: Partial<PesquisaSection>) => {
    setConfig((c) => ({ ...c, sections: c.sections.map((s) => (s.key === key ? { ...s, ...patch } : s)) }));
  };
  const addSection = () => {
    setConfig((c) => {
      const order = Math.max(0, ...c.sections.map((s) => s.order)) + 1;
      return { ...c, sections: [...c.sections, { key: genKey('sec'), label: 'Nova seção', order }] };
    });
  };
  const removeSection = (key: string) => {
    setConfig((c) => {
      if (c.questions.some((q) => q.section === key)) {
        toast.error('Mova ou remova as perguntas desta seção antes de excluí-la.');
        return c;
      }
      return { ...c, sections: c.sections.filter((s) => s.key !== key) };
    });
  };
  const moveSection = (key: string, dir: -1 | 1) => {
    setConfig((c) => {
      const secs = [...c.sections].sort((a, b) => a.order - b.order);
      const i = secs.findIndex((s) => s.key === key);
      const j = i + dir;
      if (j < 0 || j >= secs.length) return c;
      const a = secs[i], b = secs[j];
      return { ...c, sections: c.sections.map((s) => s.key === a.key ? { ...s, order: b.order } : s.key === b.key ? { ...s, order: a.order } : s) };
    });
  };

  // opções (choice)
  const setOption = (qKey: string, idx: number, patch: Partial<QuestionOption>) => {
    updateQuestion(qKey, {
      options: (config.questions.find((q) => q.key === qKey)?.options ?? []).map((o, i) => (i === idx ? { ...o, ...patch } : o)),
    });
  };
  const addOption = (qKey: string) => {
    const opts = config.questions.find((q) => q.key === qKey)?.options ?? [];
    updateQuestion(qKey, { options: [...opts, { value: genKey('opt'), label: 'Nova opção' }] });
  };
  const removeOption = (qKey: string, idx: number) => {
    const opts = config.questions.find((q) => q.key === qKey)?.options ?? [];
    updateQuestion(qKey, { options: opts.filter((_, i) => i !== idx) });
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Nome obrigatório'); return; }
    // valida chaves únicas
    const keys = config.questions.map((q) => q.key);
    if (new Set(keys).size !== keys.length) { toast.error('Há perguntas com a mesma chave.'); return; }
    setSaving(true);
    // normaliza orders sequenciais
    const normalized: PesquisaConfig = {
      ...config,
      version: 2,
      sections: sortedSections.map((s, i) => ({ ...s, order: i + 1 })),
      questions: sortedSections.flatMap((s) => questionsOf(s.key)).map((q, i) => ({ ...q, order: i + 1 })),
    };
    const { error } = await supabase
      .from('pesquisa_events')
      .update({
        name: name.trim(), location: location.trim() || null, event_date: eventDate || null,
        active, event_stage_id: eventStageId || null, questions_config: normalized as any,
      } as any)
      .eq('id', eventId!);
    if (error) toast.error('Erro ao salvar: ' + error.message);
    else toast.success('Formulário salvo com sucesso');
    setSaving(false);
  };

  const goBack = () => navigate(stageId ? `/admin/etapa/${stageId}/pesquisa/eventos` : '/admin/pesquisa/eventos');

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
      </div>
    );
  }

  const otherQuestions = (self: PesquisaQuestion) => config.questions.filter((q) => q.key !== self.key);

  return (
    <div className="space-y-6 max-w-2xl pb-12">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={goBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold leading-tight">Configurar Pesquisa</h1>
          <p className="text-sm text-muted-foreground truncate">{name}</p>
        </div>
        <Button onClick={handleSave} disabled={saving || !name.trim()} className="gap-2 shrink-0">
          <Save className="h-4 w-4" />{saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>

      {/* Informações básicas */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Informações do Evento</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5"><Label>Nome *</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Local</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} /></div>
            <div className="space-y-1.5"><Label>Data</Label><Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} /></div>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="active" checked={active} onCheckedChange={setActive} />
            <Label htmlFor="active" className="cursor-pointer">Pesquisa ativa</Label>
          </div>
        </CardContent>
      </Card>

      {/* Etapa */}
      {!stageId && (
        <Card className="card-accent-top">
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Layers className="h-4 w-4 text-accent" />Etapa da Competição</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Select value={eventStageId || 'none'} onValueChange={(v) => setEventStageId(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione uma etapa" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Sem etapa vinculada —</SelectItem>
                {stageOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.event_name} · {s.name} ({KIND_LABELS[s.kind] ?? s.kind})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Modelos prontos */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><LayoutTemplate className="h-4 w-4 text-primary" />Modelos</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">Aplicar um modelo substitui todas as perguntas atuais.</p>
          {PESQUISA_PRESETS.map((p) => (
            <button key={p.id} type="button" onClick={() => applyPreset(p.id)}
              className="w-full text-left rounded-lg border p-3 border-border hover:border-primary/30 hover:bg-muted/30 transition-all">
              <span className="font-semibold text-sm">{p.name}</span>
              <p className="text-xs text-muted-foreground leading-snug mt-0.5">{p.description}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Seções + Perguntas */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Seções e Perguntas</CardTitle>
            <Button variant="outline" size="sm" onClick={addSection} className="gap-1 text-xs"><Plus className="h-3 w-3" />Seção</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {sortedSections.map((section, sIdx) => (
            <div key={section.key} className="space-y-3 rounded-lg border p-3 bg-muted/10">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input value={section.label} onChange={(e) => updateSection(section.key, { label: e.target.value })}
                  className="h-8 text-sm font-semibold" maxLength={60} />
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={sIdx === 0} onClick={() => moveSection(section.key, -1)}><ChevronUp className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={sIdx === sortedSections.length - 1} onClick={() => moveSection(section.key, 1)}><ChevronDown className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive" onClick={() => removeSection(section.key)}><Trash2 className="h-4 w-4" /></Button>
              </div>

              {questionsOf(section.key).map((q, qIdx, arr) => (
                <div key={q.key} className="space-y-2 rounded-md border bg-card p-3">
                  <div className="flex items-start gap-2">
                    <Input value={q.label} onChange={(e) => updateQuestion(q.key, { label: e.target.value })}
                      className="h-8 text-sm" maxLength={200} placeholder="Texto da pergunta" />
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={qIdx === 0} onClick={() => moveQuestion(q.key, -1)}><ChevronUp className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={qIdx === arr.length - 1} onClick={() => moveQuestion(q.key, 1)}><ChevronDown className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive" onClick={() => removeQuestion(q.key)}><Trash2 className="h-4 w-4" /></Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Tipo</Label>
                      <Select value={q.type} onValueChange={(v) => updateQuestion(q.key, { type: v as QuestionType })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(TYPE_LABELS) as QuestionType[]).map((t) => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end gap-2 pb-1">
                      <Switch id={`req_${q.key}`} checked={q.required ?? false} onCheckedChange={(v) => updateQuestion(q.key, { required: v })} />
                      <Label htmlFor={`req_${q.key}`} className="text-xs cursor-pointer">Obrigatória</Label>
                    </div>
                  </div>

                  {q.type === 'scale' && (
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Nota máxima</Label>
                      <Input type="number" min={2} max={10} value={q.scaleMax ?? 5}
                        onChange={(e) => updateQuestion(q.key, { scaleMax: Math.max(2, Math.min(10, Number(e.target.value) || 5)) })}
                        className="h-8 text-xs w-24" />
                    </div>
                  )}

                  {CHOICE_TYPES.includes(q.type) && (
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground">Opções</Label>
                      {(q.options ?? []).map((o, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <Input value={o.label} onChange={(e) => setOption(q.key, oi, { label: e.target.value, value: o.value })} className="h-7 text-xs" placeholder="Rótulo" />
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-destructive" onClick={() => removeOption(q.key, oi)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => addOption(q.key)} className="h-7 gap-1 text-xs"><Plus className="h-3 w-3" />Opção</Button>
                    </div>
                  )}

                  {/* Condicional */}
                  <div className="space-y-1 pt-1 border-t">
                    <Label className="text-[11px] text-muted-foreground">Mostrar só se…</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={q.visibleIf?.key ?? 'none'}
                        onValueChange={(v) => updateQuestion(q.key, v === 'none' ? { visibleIf: undefined } : { visibleIf: { key: v, values: [] } })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sempre visível" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sempre visível</SelectItem>
                          {otherQuestions(q).filter((c) => c.type === 'boolean' || c.type === 'single_choice').map((c) => (
                            <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {q.visibleIf && (() => {
                        const ctrl = config.questions.find((c) => c.key === q.visibleIf!.key);
                        const cur = q.visibleIf!.values[0];
                        const setVal = (raw: string) => {
                          const val: string | boolean = ctrl?.type === 'boolean' ? raw === 'true' : raw;
                          updateQuestion(q.key, { visibleIf: { key: q.visibleIf!.key, values: [val] } });
                        };
                        return (
                          <Select value={cur === undefined ? '' : String(cur)} onValueChange={setVal}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="valor…" /></SelectTrigger>
                            <SelectContent>
                              {ctrl?.type === 'boolean'
                                ? [<SelectItem key="t" value="true">Sim</SelectItem>, <SelectItem key="f" value="false">Não</SelectItem>]
                                : (ctrl?.options ?? []).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ))}

              <Button variant="outline" size="sm" onClick={() => addQuestion(section.key)} className="gap-1 text-xs w-full"><Plus className="h-3 w-3" />Adicionar pergunta</Button>
            </div>
          ))}
          <Separator />
          <p className="text-xs text-muted-foreground">
            As chaves das perguntas são geradas automaticamente. Perguntas condicionais (ex.: nota do kit só se “recebeu = Sim”) usam “Mostrar só se…”.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !name.trim()} className="gap-2">
          <Save className="h-4 w-4" />{saving ? 'Salvando...' : 'Salvar formulário'}
        </Button>
      </div>
    </div>
  );
}
