interface BooleanInputProps {
  label: string;
  value: boolean | null;
  onChange: (val: boolean) => void;
  trueLabel?: string;
  falseLabel?: string;
}

/** Sim / Não. */
export default function BooleanInput({ label, value, onChange, trueLabel = 'Sim', falseLabel = 'Não' }: BooleanInputProps) {
  const opt = (v: boolean, text: string) => {
    const active = value === v;
    return (
      <button
        type="button"
        onClick={() => onChange(v)}
        className={`flex-1 min-h-[48px] px-4 py-3 rounded-lg border-2 text-sm font-semibold transition-all ${
          active
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-card text-foreground border-border hover:border-primary/50'
        }`}
      >
        {text}
      </button>
    );
  };
  return (
    <div className="space-y-3">
      <p className="text-base font-semibold text-foreground">{label}</p>
      <div className="flex gap-2">
        {opt(true, trueLabel)}
        {opt(false, falseLabel)}
      </div>
    </div>
  );
}
