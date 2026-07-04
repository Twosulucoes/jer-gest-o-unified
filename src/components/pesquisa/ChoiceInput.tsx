import type { QuestionOption } from '@/lib/pesquisa/config';

interface ChoiceInputProps {
  label: string;
  options: QuestionOption[];
  value: string | null;
  onChange: (val: string) => void;
  columns?: number;
}

/** Escolha única (radio em forma de botões grandes, mobile-first). */
export default function ChoiceInput({ label, options, value, onChange, columns }: ChoiceInputProps) {
  const cols = columns ?? (options.length > 6 ? 2 : options.length > 3 ? 2 : 1);
  return (
    <div className="space-y-3">
      <p className="text-base font-semibold text-foreground">{label}</p>
      <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {options.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={`min-h-[48px] px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all text-left ${
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-foreground border-border hover:border-primary/50'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
