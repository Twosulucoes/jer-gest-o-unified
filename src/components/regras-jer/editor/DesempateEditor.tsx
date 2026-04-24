import { TIE_BREAKER_OPTIONS } from "./constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function DesempateEditor({
  criterios,
  onChange,
}: {
  criterios: any[];
  onChange: (v: string[]) => void;
}) {
  // Normaliza: aceita strings (slugs) ou objetos { ordem, criterio } vindos de presets.
  const list: string[] = (Array.isArray(criterios) ? criterios : [])
    .map((c: any) =>
      typeof c === "string"
        ? c
        : c && typeof c === "object"
          ? String(c.slug ?? c.criterio ?? c.criteria ?? "")
          : "",
    )
    .filter(Boolean);

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...list];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };
  const remove = (idx: number) => onChange(list.filter((_, i) => i !== idx));
  const add = (slug: string) => {
    if (!slug || list.includes(slug)) {
      toast.error("Critério já existe ou inválido");
      return;
    }
    onChange([...list, slug]);
  };

  const available = TIE_BREAKER_OPTIONS.filter((o) => !list.includes(o.slug));

  return (
    <div className="space-y-2">
      <ol className="space-y-1">
        {list.length === 0 && (
          <li className="text-xs text-muted-foreground italic">Nenhum critério configurado.</li>
        )}
        {list.map((c, i) => {
          const opt = TIE_BREAKER_OPTIONS.find((o) => o.slug === c);
          return (
            <li
              key={`${c}-${i}`}
              className="flex items-center gap-2 rounded-md border bg-card px-3 py-2"
            >
              <span className="text-xs font-mono text-muted-foreground w-6">{i + 1}.</span>
              <span className="flex-1 text-sm">{opt?.label ?? c}</span>
              <Badge variant="outline" className="text-xs font-mono">
                {c}
              </Badge>
              <Button size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}>
                ↑
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => move(i, 1)}
                disabled={i === list.length - 1}
              >
                ↓
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove(i)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          );
        })}
      </ol>

      {available.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {available.map((o) => (
            <Button key={o.slug} size="sm" variant="outline" onClick={() => add(o.slug)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> {o.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
