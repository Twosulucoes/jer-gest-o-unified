interface ScaleInputProps {
  label: string;
  value: number | null;
  onChange: (val: number) => void;
  description?: string;
}

const scaleLabels = ['Péssimo', 'Ruim', 'Regular', 'Bom', 'Ótimo'];

export default function ScaleInput({ label, value, onChange, description }: ScaleInputProps) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-base font-semibold text-foreground">{label}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`${scaleLabels[n - 1]} (${n})`}
            className={`flex-1 min-h-[48px] rounded-lg border-2 text-lg font-bold transition-all ${
              value === n
                ? 'bg-primary text-primary-foreground border-primary scale-105'
                : 'bg-card text-foreground border-border hover:border-primary/50'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground px-1">
        <span>Péssimo</span>
        <span>Ótimo</span>
      </div>
    </div>
  );
}
