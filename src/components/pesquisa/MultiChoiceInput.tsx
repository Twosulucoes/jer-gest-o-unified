import type { QuestionOption } from '@/lib/pesquisa/config';
import { Check } from 'lucide-react';

interface MultiChoiceInputProps {
  label: string;
  options: QuestionOption[];
  value: string[];
  onChange: (val: string[]) => void;
}

/** Múltipla escolha (checkboxes em forma de botões). */
export default function MultiChoiceInput({ label, options, value, onChange }: MultiChoiceInputProps) {
  const toggle = (v: string) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  };
  return (
    <div className="space-y-3">
      <p className="text-base font-semibold text-foreground">{label}</p>
      <div className="grid grid-cols-1 gap-2">
        {options.map((o) => {
          const active = value.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => toggle(o.value)}
              className={`min-h-[48px] px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all flex items-center gap-3 text-left ${
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-foreground border-border hover:border-primary/50'
              }`}
            >
              <span
                className={`h-5 w-5 shrink-0 rounded border-2 flex items-center justify-center ${
                  active ? 'border-primary-foreground' : 'border-muted-foreground'
                }`}
              >
                {active && <Check className="h-3.5 w-3.5" />}
              </span>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
