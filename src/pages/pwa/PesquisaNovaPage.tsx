import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSession, clearSession, addToQueue, saveDraft, clearDraft, getDraft } from '@/lib/pesquisaSession';
import { usePesquisaSync } from '@/hooks/usePesquisaSync';
import QuestionRenderer from '@/components/pesquisa/QuestionRenderer';
import OfflineBadge from '@/components/pesquisa/OfflineBadge';
import { PwaRefreshButton } from '@/components/pwa/PwaRefreshButton';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, Send, ScanLine, Loader2 } from 'lucide-react';
import QrCodeScanner from '@/components/pwa/QrCodeScanner';
import { resolveQrCredential } from '@/lib/resolveQrCredential';
import { toast } from 'sonner';
import { differenceInYears, parseISO } from 'date-fns';
import {
  coerceConfig, orderedSections, visibleQuestionsForSection, allVisibleQuestions,
  firstValidationError, isAnswerFilled, pruneHiddenAnswers, DEFAULT_CONFIG,
  type PesquisaConfig, type Answers, type AnswerValue,
} from '@/lib/pesquisa/config';

type Step = 'setup' | 'form';

const MODE_OPTIONS = [
  { value: 'entrevista', label: 'Entrevista' },
  { value: 'autopreenchimento', label: 'Autopreenchimento' },
];

export default function PesquisaNovaPage() {
  const navigate = useNavigate();
  const { isOnline, pendingCount } = usePesquisaSync();
  const [searchParams] = useSearchParams();
  const session = getSession();

  const [step, setStep] = useState<Step>('setup');
  const [submitting, setSubmitting] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [config, setConfig] = useState<PesquisaConfig>(DEFAULT_CONFIG);

  // Campos operacionais (definidos pelo pesquisador)
  const [mode, setMode] = useState('');
  const [applicationLocation, setApplicationLocation] = useState('');

  // Respostas dinâmicas
  const [answers, setAnswers] = useState<Answers>({});

  // Carrega rascunho
  useEffect(() => {
    const draft = getDraft();
    if (draft) {
      if (draft.mode) setMode(draft.mode as string);
      if (draft.applicationLocation) setApplicationLocation(draft.applicationLocation as string);
      if (draft.answers) setAnswers(draft.answers as Answers);
    } else if (session?.researcher?.assigned_location || session?.event?.location) {
      setApplicationLocation((session.researcher.assigned_location || session.event.location || '').trim());
    }
  }, [session?.event?.location, session?.researcher?.assigned_location]);

  // Autosave do rascunho (debounced)
  const saveDraftDebounced = useCallback(() => {
    const timeout = setTimeout(() => {
      saveDraft({ mode, applicationLocation, answers });
    }, 500);
    return () => clearTimeout(timeout);
  }, [mode, applicationLocation, answers]);

  useEffect(() => saveDraftDebounced(), [saveDraftDebounced]);

  useEffect(() => {
    if (!session) navigate('/pesquisa/login', { replace: true });
  }, [session, navigate]);

  useEffect(() => {
    if (searchParams.get('scan') === 'true') setScannerOpen(true);
  }, [searchParams]);

  // Carrega o config do evento (v2). Fallback: DEFAULT_CONFIG.
  useEffect(() => {
    if (!session?.researcher?.event_id) return;
    (supabase.rpc as any)('pesquisa_get_event_config', { p_event_id: session.researcher.event_id })
      .then(({ data }: { data: any }) => {
        setConfig(coerceConfig(data?.questions_config));
      })
      .catch(() => setConfig(DEFAULT_CONFIG));
  }, [session?.researcher?.event_id]);

  const setAnswer = (key: string, val: AnswerValue) => setAnswers((prev) => ({ ...prev, [key]: val }));

  // Preenche uma resposta demográfica apenas se a pergunta existir e o valor for opção válida.
  const prefillIfValid = (updates: Record<string, string>) => {
    setAnswers((prev) => {
      const next = { ...prev };
      for (const [key, value] of Object.entries(updates)) {
        const q = config.questions.find((x) => x.key === key && x.type === 'single_choice');
        if (q && (q.options ?? []).some((o) => o.value === value)) next[key] = value;
      }
      return next;
    });
  };

  const handleScan = async (payload: string) => {
    setScannerOpen(false);
    setIdentifying(true);
    try {
      if (payload.trim().toLowerCase().startsWith('voucher:')) {
        const { data: voucher, error: vErr } = await supabase
          .from('service_vouchers')
          .select('label, participant_id, voucher_type')
          .eq('qr_code_value', payload.trim())
          .maybeSingle();
        if (vErr || !voucher) {
          toast.error('Voucher não encontrado ou inválido para identificação.');
          return;
        }
        const tv = voucher as any;
        if (tv.participant_id) {
          await loadParticipantData(tv.participant_id, tv.label || 'Portador de Voucher');
        } else {
          prefillIfValid({ tipo: tv.voucher_type === 'nominal' ? 'estudante_atleta' : 'outro' });
          toast.success(`Identificado via Voucher: ${tv.label || 'Portador'}`);
        }
        return;
      }
      const resolved = await resolveQrCredential(payload, { eventId: session?.researcher?.event_id });
      if (!resolved) {
        toast.error('Participante não encontrado');
        return;
      }
      await loadParticipantData(resolved.participant_id, resolved.full_name);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao identificar participante');
    } finally {
      setIdentifying(false);
    }
  };

  const loadParticipantData = async (participantId: string, name: string) => {
    const { data: part, error } = await (supabase as any)
      .from('participants')
      .select('participant_type, people(birth_date, gender)')
      .eq('id', participantId)
      .single();
    if (error) throw error;
    if (!part) return;

    const updates: Record<string, string> = {};
    updates.tipo = part.participant_type === 'athlete' ? 'estudante_atleta'
      : part.participant_type === 'coach' ? 'tecnico' : 'outro';

    const g: string | undefined = part.people?.gender;
    if (g) updates.sexo = g === 'male' ? 'masculino' : g === 'female' ? 'feminino' : 'nao_informado';

    const birth: string | undefined = part.people?.birth_date;
    if (birth) {
      const age = differenceInYears(new Date(), parseISO(birth));
      updates.idade = age <= 12 ? 'ate_12' : age <= 14 ? '13_14' : age <= 17 ? '15_17' : '18_mais';
    }
    prefillIfValid(updates);
    toast.success(`Identificado: ${name}`);
  };

  if (!session) return null;

  const isKiosk = mode === 'autopreenchimento';
  const setupComplete = !!mode && applicationLocation.trim() !== '';
  const sections = orderedSections(config);
  const visible = allVisibleQuestions(config, answers);
  const answeredCount = visible.filter((q) => isAnswerFilled(answers[q.key])).length;
  const progressPercent = visible.length ? (answeredCount / visible.length) * 100 : 0;
  const validationError = firstValidationError(config, answers);
  const canSubmit = validationError === null;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    const clientUuid = crypto.randomUUID();
    const payload: Record<string, unknown> = {
      client_uuid: clientUuid,
      mode,
      application_location: applicationLocation.trim(),
      answers: pruneHiddenAnswers(config, answers),
      collected_at: new Date().toISOString(),
    };

    let submitted = false;
    if (navigator.onLine) {
      try {
        const { data, error } = await supabase.rpc('pesquisa_pwa_submit_survey', {
          p_session_id: session.session_id,
          p_payload: payload as any,
        });
        if (error) throw error;
        const result = data as any;
        if (result?.error === 'SESSION_INVALID') {
          clearSession();
          navigate('/pesquisa/login', { replace: true });
          return;
        }
        if (result?.status === 'invalid') {
          setSubmitting(false);
          toast.error('Não foi possível enviar: revise as respostas obrigatórias.');
          return;
        }
        submitted = true;
      } catch {
        // cai na fila offline
      }
    }

    if (!submitted) {
      addToQueue({ client_uuid: clientUuid, payload, created_at: new Date().toISOString(), attempts: 0, last_error: null });
    }

    clearDraft();
    setSubmitting(false);
    navigate('/pesquisa/confirmacao', { state: { submitted, isKiosk }, replace: true });
  };

  const OptionButton = ({ value, label, selected, onClick }: { value: string; label: string; selected: boolean; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[48px] px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
        selected
          ? 'bg-[hsl(var(--module-accent))] text-black border-[hsl(var(--module-accent))]'
          : 'bg-card text-foreground border-border hover:border-primary/50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-background">
      {(!isKiosk || step === 'setup') && (
        <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => {
            if (step === 'setup') navigate('/pesquisa/home');
            else setStep('setup');
          }}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div className="flex items-center gap-2">
            <OfflineBadge isOnline={isOnline} pendingCount={pendingCount} />
            <PwaRefreshButton />
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto p-4 space-y-6">
        {/* SETUP: campos operacionais do pesquisador */}
        {step === 'setup' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Nova resposta</h2>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-primary/20 text-primary"
                onClick={() => setScannerOpen(true)}
                disabled={identifying}
              >
                {identifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
                Identificar QR
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Modo de coleta</label>
              <div className="grid grid-cols-2 gap-2">
                {MODE_OPTIONS.map((o) => (
                  <OptionButton key={o.value} {...o} selected={mode === o.value} onClick={() => setMode(o.value)} />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Local da aplicação *</label>
              <Textarea
                value={applicationLocation}
                onChange={(e) => setApplicationLocation(e.target.value)}
                placeholder="Ex.: Ginásio 2, arquibancada leste"
                rows={2}
              />
            </div>

            <Button onClick={() => setStep('form')} disabled={!setupComplete} className="w-full h-14 text-lg">
              Começar <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        )}

        {/* FORM: questionário dinâmico por seções */}
        {step === 'form' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">{config.name ?? 'Pesquisa de Satisfação'}</h2>
              <Progress value={progressPercent} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-1">{answeredCount} de {visible.length} respondidas</p>
            </div>

            {sections.map((section) => {
              const qs = visibleQuestionsForSection(config, section.key, answers);
              if (qs.length === 0) return null;
              return (
                <div key={section.key} className="space-y-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">{section.label}</p>
                  {qs.map((q) => (
                    <QuestionRenderer
                      key={q.key}
                      question={q}
                      value={answers[q.key]}
                      onChange={(v) => setAnswer(q.key, v)}
                      scaleLabels={config.scaleLabels}
                    />
                  ))}
                </div>
              );
            })}

            <Button onClick={handleSubmit} disabled={!canSubmit || submitting} className="w-full h-14 text-lg gap-2">
              <Send className="h-5 w-5" /> {submitting ? 'Enviando...' : 'Enviar resposta'}
            </Button>
          </div>
        )}
      </div>

      <QrCodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
        title="Identificar Respondente"
      />
    </div>
  );
}
