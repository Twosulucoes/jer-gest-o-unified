import type { ScaleLabel } from '@/lib/pesquisa/config';
import { DEFAULT_SCALE_LABELS } from '@/lib/pesquisa/config';

interface ScaleInputProps {
  label: string;
  value: number | null;
  onChange: (val: number) => void;
  description?: string;
  scaleMax?: number;
  scaleLabels?: ScaleLabel[];
}

/**
 * Escala 1..scaleMax. Se houver scaleLabels (com emoji/rótulo), usa-os para
 * acessibilidade e para as legendas de mínimo/máximo. Caso contrário, exibe
 * apenas os números.
 */
export default function ScaleInput({
  label,
  value,
  onChange,
  description,
  scaleMax = 5,
  scaleLabels,
}: ScaleInputProps) {
  const labels = scaleLabels ?? (scaleMax === 5 ? DEFAULT_SCALE_LABELS : undefined);
  const labelFor = (n: number) => labels?.find((l) => l.value === n);
  const scale = Array.from({ length: scaleMax }, (_, i) => i + 1);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-base font-semibold text-foreground">{label}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="flex gap-2">
        {scale.map((n) => {
          const l = labelFor(n);
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-label={l ? `${l.label} (${n})` : `Nota ${n}`}
              className={`flex-1 min-h-[56px] rounded-lg border-2 font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
                active
                  ? 'bg-primary text-primary-foreground border-primary scale-105'
                  : 'bg-card text-foreground border-border hover:border-primary/50'
              }`}
            >
              {l?.emoji && <span className="text-xl leading-none">{l.emoji}</span>}
              <span className="text-base leading-none">{n}</span>
            </button>
          );
        })}
      </div>
      {labels && (
        <div className="flex justify-between text-xs text-muted-foreground px-1">
          <span>{labels[0]?.label}</span>
          <span>{labels[labels.length - 1]?.label}</span>
        </div>
      )}
    </div>
  );
}
