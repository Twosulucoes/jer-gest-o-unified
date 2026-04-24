import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSession, clearSession, addToQueue, saveDraft, clearDraft, getDraft } from '@/lib/pesquisaSession';
import { usePesquisaSync } from '@/hooks/usePesquisaSync';
import ScaleInput from '@/components/pesquisa/ScaleInput';
import OfflineBadge from '@/components/pesquisa/OfflineBadge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, Send, ScanLine, User as UserIcon, Loader2 } from 'lucide-react';
import QrCodeScanner from "@/components/pwa/QrCodeScanner";
import { resolveQrCredential } from "@/lib/resolveQrCredential";
import { toast } from "sonner";
import { differenceInYears, parseISO } from "date-fns";

type Step = 'profile' | 'questionnaire' | 'open';

const TYPE_OPTIONS = [
  { value: 'atleta', label: 'Atleta' },
  { value: 'familiar', label: 'Familiar' },
  { value: 'professor', label: 'Professor' },
  { value: 'tecnico', label: 'Técnico' },
  { value: 'outro', label: 'Outro' },
];

const AGE_OPTIONS = [
  { value: 'ate_12', label: 'Até 12 anos' },
  { value: '13_17', label: '13 a 17 anos' },
  { value: '18_30', label: '18 a 30 anos' },
  { value: 'acima_30', label: 'Acima de 30' },
];

const GENDER_OPTIONS = [
  { value: 'masculino', label: 'Masculino' },
  { value: 'feminino', label: 'Feminino' },
  { value: 'nao_informado', label: 'Prefiro não informar' },
];

const MODE_OPTIONS = [
  { value: 'entrevista', label: 'Entrevista' },
  { value: 'autopreenchimento', label: 'Autopreenchimento' },
];

const DEFAULT_QUESTIONS = [
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

export default function PesquisaNovaPage() {
  const navigate = useNavigate();
  const { isOnline, pendingCount } = usePesquisaSync();
  const [searchParams] = useSearchParams();
  const session = getSession();

  const [step, setStep] = useState<Step>('profile');
  const [questionIdx, setQuestionIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [QUESTIONS, setQUESTIONS] = useState(DEFAULT_QUESTIONS);

  // Profile fields
  const [respondentType, setRespondentType] = useState('');
  const [respondentAge, setRespondentAge] = useState('');
  const [respondentGender, setRespondentGender] = useState('');
  const [mode, setMode] = useState('');
  const [applicationLocation, setApplicationLocation] = useState('');

  // Question answers
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [pontoPositivo, setPontoPositivo] = useState('');
  const [sugestao, setSugestao] = useState('');

  // Load draft on mount
  useEffect(() => {
    const draft = getDraft();
    if (draft) {
      if (draft.respondentType) setRespondentType(draft.respondentType as string);
      if (draft.respondentAge) setRespondentAge(draft.respondentAge as string);
      if (draft.respondentGender) setRespondentGender(draft.respondentGender as string);
      if (draft.mode) setMode(draft.mode as string);
      if (draft.applicationLocation) setApplicationLocation(draft.applicationLocation as string);
      if (draft.answers) setAnswers(draft.answers as Record<string, number>);
      if (draft.pontoPositivo) setPontoPositivo(draft.pontoPositivo as string);
      if (draft.sugestao) setSugestao(draft.sugestao as string);
    } else if (session?.researcher?.assigned_location || session?.event?.location) {
      setApplicationLocation((session.researcher.assigned_location || session.event.location || '').trim());
    }
  }, [session?.event?.location, session?.researcher?.assigned_location]);

  // Save draft on changes (debounced)
  const saveDraftDebounced = useCallback(() => {
    const timeout = setTimeout(() => {
      saveDraft({ respondentType, respondentAge, respondentGender, mode, applicationLocation, answers, pontoPositivo, sugestao });
    }, 500);
    return () => clearTimeout(timeout);
  }, [respondentType, respondentAge, respondentGender, mode, applicationLocation, answers, pontoPositivo, sugestao]);

  useEffect(() => {
    const cleanup = saveDraftDebounced();
    return cleanup;
  }, [saveDraftDebounced]);

  useEffect(() => {
    if (!session) navigate('/pwa/pesquisa/login', { replace: true });
  }, [session, navigate]);

  useEffect(() => {
    if (searchParams.get('scan') === 'true') {
      setScannerOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!session?.researcher?.event_id) return;
    (supabase.rpc as any)('pesquisa_get_event_config', { p_event_id: session.researcher.event_id })
      .then(({ data }) => {
        const config = data as any;
        if (Array.isArray(config?.questions_config) && config.questions_config.length > 0) {
          setQUESTIONS(config.questions_config);
        }
      });
  }, [session?.researcher?.event_id]);

  const handleScan = async (payload: string) => {
    setScannerOpen(false);
    setIdentifying(true);
    try {
      const resolved = await resolveQrCredential(payload, { eventId: session?.researcher?.event_id });
      if (!resolved) {
        toast.error("Participante não encontrado");
        return;
      }

      // Fetch more details (age, gender)
      const { data: part, error } = await supabase
        .from("participants")
        .select("birth_date, biological_sex, participant_type")
        .eq("id", resolved.participant_id)
        .single();

      if (error) throw error;

      if (part) {
        setRespondentType(part.participant_type === 'athlete' ? 'atleta' : 
                          part.participant_type === 'coach' ? 'tecnico' : 'outro');
        
        if (part.biological_sex) {
          setRespondentGender(part.biological_sex === 'male' ? 'masculino' : 'feminino');
        }

        if (part.birth_date) {
          const age = differenceInYears(new Date(), parseISO(part.birth_date));
          if (age <= 12) setRespondentAge('ate_12');
          else if (age <= 17) setRespondentAge('13_17');
          else if (age <= 30) setRespondentAge('18_30');
          else setRespondentAge('acima_30');
        }

        toast.success(`Identificado: ${resolved.full_name}`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao identificar participante");
    } finally {
      setIdentifying(false);
    }
  };

  if (!session) return null;

  const isKiosk = mode === 'autopreenchimento';
  const profileComplete = respondentType && respondentAge && respondentGender && mode && applicationLocation.trim();
  const allAnswered = QUESTIONS.every(q => answers[q.key] != null);
  const totalProgress = Object.keys(answers).length;
  const progressPercent = (totalProgress / QUESTIONS.length) * 100;

  const handleSubmit = async () => {
    if (!allAnswered) return;
    setSubmitting(true);

    const clientUuid = crypto.randomUUID();
    const payload: Record<string, unknown> = {
      client_uuid: clientUuid,
      respondent_type: respondentType,
      respondent_age: respondentAge,
      respondent_gender: respondentGender,
      mode,
      application_location: applicationLocation.trim(),
      ...answers,
      ponto_positivo: pontoPositivo || null,
      sugestao: sugestao || null,
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
          navigate('/pwa/pesquisa/login', { replace: true });
          return;
        }
        submitted = true;
      } catch {
        // will queue
      }
    }

    if (!submitted) {
      addToQueue({ client_uuid: clientUuid, payload, created_at: new Date().toISOString(), attempts: 0, last_error: null });
    }

    clearDraft();
    setSubmitting(false);
    navigate('/pwa/pesquisa/confirmacao', { state: { submitted, isKiosk }, replace: true });
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
      {/* Header (hidden in kiosk after profile step) */}
      {(!isKiosk || step === 'profile') && (
        <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => {
            if (step === 'profile') navigate('/pwa/pesquisa/home');
            else if (step === 'open') setStep('questionnaire');
            else setStep('profile');
          }}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <OfflineBadge isOnline={isOnline} pendingCount={pendingCount} />
        </div>
      )}

      <div className="max-w-lg mx-auto p-4 space-y-6">
        {/* STEP 1: Profile */}
        {step === 'profile' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Perfil do Respondente</h2>
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
              <label className="text-sm font-medium text-muted-foreground">Tipo</label>
              <div className="grid grid-cols-2 gap-2">
                {TYPE_OPTIONS.map(o => (
                  <OptionButton key={o.value} {...o} selected={respondentType === o.value} onClick={() => setRespondentType(o.value)} />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Faixa etária</label>
              <div className="grid grid-cols-2 gap-2">
                {AGE_OPTIONS.map(o => (
                  <OptionButton key={o.value} {...o} selected={respondentAge === o.value} onClick={() => setRespondentAge(o.value)} />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Gênero</label>
              <div className="grid grid-cols-3 gap-2">
                {GENDER_OPTIONS.map(o => (
                  <OptionButton key={o.value} {...o} selected={respondentGender === o.value} onClick={() => setRespondentGender(o.value)} />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Modo de coleta</label>
              <div className="grid grid-cols-2 gap-2">
                {MODE_OPTIONS.map(o => (
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

            <Button onClick={() => setStep('questionnaire')} disabled={!profileComplete} className="w-full h-14 text-lg">
              Próxima Etapa <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        )}

        {/* STEP 2: Questionnaire */}
        {step === 'questionnaire' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">Avaliação</h2>
              <Progress value={progressPercent} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-1">{totalProgress} de {QUESTIONS.length} respondidas</p>
            </div>

            <div className="space-y-8">
              {QUESTIONS.map((q, idx) => {
                const showDimHeader = idx === 0 || QUESTIONS[idx - 1].dim !== q.dim;
                return (
                  <div key={q.key}>
                    {showDimHeader && (
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-3">{q.dim}</p>
                    )}
                    <ScaleInput
                      label={q.label}
                      value={answers[q.key] ?? null}
                      onChange={(val) => setAnswers(prev => ({ ...prev, [q.key]: val }))}
                    />
                  </div>
                );
              })}
            </div>

            <Button onClick={() => setStep('open')} disabled={!allAnswered} className="w-full h-14 text-lg">
              Continuar <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        )}

        {/* STEP 3: Open fields + Submit */}
        {step === 'open' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Comentários (opcional)</h2>

            <div className="space-y-2">
              <label className="text-sm font-medium">Ponto positivo do evento</label>
              <Textarea
                value={pontoPositivo}
                onChange={(e) => setPontoPositivo(e.target.value)}
                placeholder="O que você mais gostou?"
                maxLength={500}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Sugestão de melhoria</label>
              <Textarea
                value={sugestao}
                onChange={(e) => setSugestao(e.target.value)}
                placeholder="O que poderia melhorar?"
                maxLength={500}
                rows={3}
              />
            </div>

            <Button onClick={handleSubmit} disabled={submitting} className="w-full h-14 text-lg gap-2">
              <Send className="h-5 w-5" /> {submitting ? 'Enviando...' : 'Enviar resposta'}
            </Button>
          </div>
        )}
        {/* Step 3 content above ... */}
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
