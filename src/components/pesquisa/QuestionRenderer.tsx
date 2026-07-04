import type { PesquisaQuestion, ScaleLabel, AnswerValue } from '@/lib/pesquisa/config';
import { Textarea } from '@/components/ui/textarea';
import ScaleInput from './ScaleInput';
import ChoiceInput from './ChoiceInput';
import MultiChoiceInput from './MultiChoiceInput';
import BooleanInput from './BooleanInput';

interface QuestionRendererProps {
  question: PesquisaQuestion;
  value: AnswerValue | undefined;
  onChange: (val: AnswerValue) => void;
  scaleLabels?: ScaleLabel[];
}

/** Renderiza uma pergunta dinâmica de acordo com o seu tipo. */
export default function QuestionRenderer({ question, value, onChange, scaleLabels }: QuestionRendererProps) {
  const label = question.required ? `${question.label} *` : question.label;

  switch (question.type) {
    case 'scale':
      return (
        <ScaleInput
          label={label}
          value={typeof value === 'number' ? value : null}
          onChange={(v) => onChange(v)}
          scaleMax={question.scaleMax ?? 5}
          scaleLabels={scaleLabels}
        />
      );
    case 'single_choice':
      return (
        <ChoiceInput
          label={label}
          options={question.options ?? []}
          value={typeof value === 'string' ? value : null}
          onChange={(v) => onChange(v)}
        />
      );
    case 'multi_choice':
      return (
        <MultiChoiceInput
          label={label}
          options={question.options ?? []}
          value={Array.isArray(value) ? value : []}
          onChange={(v) => onChange(v)}
        />
      );
    case 'boolean':
      return (
        <BooleanInput
          label={label}
          value={typeof value === 'boolean' ? value : null}
          onChange={(v) => onChange(v)}
        />
      );
    case 'text':
      return (
        <div className="space-y-2">
          <label className="text-base font-semibold text-foreground block">{label}</label>
          <Textarea
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={question.placeholder}
            maxLength={question.maxLength}
            rows={3}
          />
        </div>
      );
    default:
      return null;
  }
}
