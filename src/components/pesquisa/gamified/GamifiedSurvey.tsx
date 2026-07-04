import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, Send, Sparkles, Star } from 'lucide-react';
import QuestionRenderer from '@/components/pesquisa/QuestionRenderer';
import {
  allVisibleQuestions, isAnswerFilled, firstValidationError,
  type PesquisaConfig, type Answers, type AnswerValue,
} from '@/lib/pesquisa/config';

const vibrate = (ms: number) => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(ms); } catch { /* noop */ }
  }
};

/** Frase de incentivo conforme o progresso. */
function cheer(pct: number): string {
  if (pct === 0) return 'Bora começar! 🚀';
  if (pct < 34) return 'Mandou bem! 👏';
  if (pct < 67) return 'Tá voando! ✨';
  if (pct < 100) return 'Falta pouco! 🔥';
  return 'Prontinho! 🎉';
}

interface GamifiedSurveyProps {
  config: PesquisaConfig;
  onSubmit: (answers: Answers) => Promise<void>;
}

/**
 * Questionário gamificado — uma pergunta por tela, avanço automático nos tipos
 * de resposta única, barra de progresso, pontos e microcopy de incentivo.
 * Reaproveita QuestionRenderer (mesmos inputs do fluxo do pesquisador).
 */
export default function GamifiedSurvey({ config, onSubmit }: GamifiedSurveyProps) {
  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);

  const visible = allVisibleQuestions(config, answers);
  const total = visible.length;
  const clamped = Math.min(index, Math.max(0, total - 1));
  const current = visible[clamped];

  const answeredCount = visible.filter((q) => isAnswerFilled(answers[q.key])).length;
  const progress = total ? Math.round((answeredCount / total) * 100) : 0;
  const points = answeredCount * 10;
  const sectionLabel = config.sections?.find((s) => s.key === current?.section)?.label;

  const isLast = clamped >= total - 1;
  const currentFilled = current ? isAnswerFilled(answers[current.key]) : false;
  const currentRequired = !!current?.required;
  const canFinish = firstValidationError(config, answers) === null;
  const autoType = current?.type === 'scale' || current?.type === 'single_choice' || current?.type === 'boolean';

  const setAnswer = (key: string, val: AnswerValue) =>
    setAnswers((a) => ({ ...a, [key]: val }));

  const handleChange = (val: AnswerValue) => {
    if (!current) return;
    setAnswer(current.key, val);
    vibrate(15);
    // Avanço automático nos tipos de escolha única (não no último — deixa Finalizar visível).
    if (autoType && !isLast) {
      window.setTimeout(() => setIndex((i) => i + 1), 280);
    }
  };

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => setIndex((i) => Math.min(i + 1, total - 1));

  const finish = async () => {
    if (!canFinish || busy) return;
    vibrate(30);
    try {
      setBusy(true);
      await onSubmit(answers);
    } finally {
      setBusy(false);
    }
  };

  if (!current) {
    return <p className="text-center text-muted-foreground py-12">Formulário sem perguntas.</p>;
  }

  return (
    <div className="flex flex-col min-h-[100dvh] max-w-lg mx-auto p-4">
      {/* Cabeçalho: progresso + pontos */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Pergunta {clamped + 1} de {total}
          </span>
          <span
            key={points}
            className="inline-flex items-center gap-1 font-semibold text-primary animate-count-up"
          >
            <Star className="h-4 w-4 fill-primary text-primary" /> {points} pts
          </span>
        </div>
        <Progress value={progress} />
        <div className="flex items-center justify-between">
          {sectionLabel && (
            <span className="text-xs uppercase tracking-wide text-primary font-semibold">{sectionLabel}</span>
          )}
          <span className="text-xs text-muted-foreground ml-auto inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> {cheer(progress)}
          </span>
        </div>
      </div>

      {/* Pergunta atual (re-monta por key → anima) */}
      <div className="flex-1 flex flex-col justify-center py-6">
        <div key={current.key} className="animate-slide-up">
          <QuestionRenderer
            question={current}
            value={answers[current.key]}
            onChange={handleChange}
            scaleLabels={config.scaleLabels}
          />
        </div>
      </div>

      {/* Navegação */}
      <div className="flex items-center gap-3 pb-2 sticky bottom-0 bg-background/80 backdrop-blur pt-2">
        <Button
          variant="outline"
          size="lg"
          className="gap-2"
          onClick={goPrev}
          disabled={clamped === 0 || busy}
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>

        {isLast ? (
          <Button
            size="lg"
            className="flex-1 h-14 text-lg gap-2"
            onClick={finish}
            disabled={!canFinish || busy}
          >
            <Send className="h-5 w-5" /> {busy ? 'Enviando...' : 'Finalizar'}
          </Button>
        ) : (
          <Button
            size="lg"
            className="flex-1 h-14 text-lg gap-2"
            onClick={goNext}
            disabled={currentRequired && !currentFilled}
          >
            Próxima <ArrowRight className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  );
}
