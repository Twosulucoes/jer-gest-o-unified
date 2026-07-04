import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, PartyPopper, RotateCcw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { getDeviceId } from '@/lib/pesquisaSession';
import { coerceConfig, pruneHiddenAnswers, type PesquisaConfig, type Answers } from '@/lib/pesquisa/config';
import GamifiedSurvey from '@/components/pesquisa/gamified/GamifiedSurvey';
import Confetti from '@/components/pesquisa/gamified/Confetti';

type Phase = 'loading' | 'ready' | 'unavailable' | 'done';

const vibrate = (ms: number | number[]) => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(ms); } catch { /* noop */ }
  }
};

/**
 * Formulário PÚBLICO de pesquisa (acesso anônimo por QR code).
 * Carrega o questions_config do evento (RPC anon já existente) e envia via
 * pesquisa_public_submit_survey — sem login, sem sessão. Online-only.
 */
export default function PesquisaPublicaPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [phase, setPhase] = useState<Phase>('loading');
  const [config, setConfig] = useState<PesquisaConfig | null>(null);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!eventId) { setPhase('unavailable'); return; }
    (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>)(
      'pesquisa_get_event_config', { p_event_id: eventId },
    )
      .then(({ data }) => {
        if (cancelled) return;
        const raw = (data as { questions_config?: unknown } | null)?.questions_config;
        if (!raw) { setPhase('unavailable'); return; }
        setConfig(coerceConfig(raw));
        setPhase('ready');
      })
      .catch(() => { if (!cancelled) setPhase('unavailable'); });
    return () => { cancelled = true; };
  }, [eventId]);

  const handleSubmit = useCallback(async (answers: Answers) => {
    if (!eventId || !config) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast.error('Sem conexão. Tente novamente.');
      throw new Error('offline');
    }
    const payload = {
      client_uuid: crypto.randomUUID(),
      device_id: getDeviceId(),
      collected_at: new Date().toISOString(),
      answers: pruneHiddenAnswers(config, answers),
    };
    const { data, error } = await (supabase.rpc as unknown as (
      fn: string, args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: unknown }>)(
      'pesquisa_public_submit_survey', { p_event_id: eventId, p_payload: payload },
    );
    if (error) {
      toast.error('Falha ao enviar. Tente novamente.');
      throw error;
    }
    const res = data as { status?: string; error?: string } | null;
    if (res?.error === 'PUBLIC_DISABLED') { setPhase('unavailable'); return; }
    if (res?.status === 'invalid') {
      toast.error('Resposta inválida. Revise e tente novamente.');
      throw new Error('invalid');
    }
    vibrate([30, 40, 60]);
    setPhase('done');
  }, [eventId, config]);

  const restart = () => { setFormKey((k) => k + 1); setPhase('ready'); };

  if (phase === 'loading') {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Carregando pesquisa...</p>
      </div>
    );
  }

  if (phase === 'unavailable') {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-warning" />
        </div>
        <h1 className="text-xl font-bold">Pesquisa indisponível</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          Esta pesquisa não está aberta para respostas no momento. Procure a equipe do evento.
        </p>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-5 p-6 text-center">
        <Confetti />
        <div className="w-24 h-24 rounded-full bg-success/10 flex items-center justify-center animate-scale-in">
          <PartyPopper className="h-12 w-12 text-success animate-float" />
        </div>
        <h1 className="text-2xl font-bold animate-slide-up">Obrigado! 🎉</h1>
        <p className="text-muted-foreground max-w-xs animate-fade-in">
          Sua resposta foi registrada. Sua opinião ajuda a melhorar os Jogos Escolares!
        </p>
        <Button variant="outline" size="lg" className="gap-2 mt-2" onClick={restart}>
          <RotateCcw className="h-4 w-4" /> Responder novamente
        </Button>
      </div>
    );
  }

  // phase === 'ready'
  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="max-w-lg mx-auto px-4 pt-4">
        <h1 className="text-lg font-bold text-center text-primary">
          {config?.name || 'Pesquisa de Satisfação'}
        </h1>
        <p className="text-center text-xs text-muted-foreground">Sua opinião é anônima ✨</p>
      </div>
      {config && <GamifiedSurvey key={formKey} config={config} onSubmit={handleSubmit} />}
    </div>
  );
}
