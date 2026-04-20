import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Sliders, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface PdfFieldOption {
  /** chave única estável (usada para persistência futura) */
  key: string;
  /** nome amigável exibido ao usuário */
  label: string;
}

interface Props {
  /** Lista completa de campos disponíveis para o PDF. */
  options: PdfFieldOption[];
  /** Chaves selecionadas atualmente. */
  value: string[];
  onChange: (next: string[]) => void;
  /** Limite máximo de campos no PDF (padrão 8). */
  max?: number;
  /** Mínimo de campos (padrão 1). */
  min?: number;
  /** Defaults para o botão "Restaurar". */
  defaults?: string[];
  label?: string;
}

/**
 * Seletor compacto (popover) para o usuário escolher quais campos
 * aparecerão no relatório PDF, respeitando um limite (ex.: 8).
 * O Excel/CSV continua exportando todos os campos definidos.
 */
export default function PdfFieldsPicker({
  options,
  value,
  onChange,
  max = 8,
  min = 1,
  defaults,
  label = "Campos do PDF",
}: Props) {
  const [open, setOpen] = useState(false);

  const toggle = (key: string) => {
    if (value.includes(key)) {
      if (value.length <= min) return; // mantém pelo menos 1
      onChange(value.filter((k) => k !== key));
    } else {
      if (value.length >= max) return; // bloqueia além do máximo
      onChange([...value, key]);
    }
  };

  const reset = () => {
    if (defaults && defaults.length > 0) onChange(defaults);
  };

  const reachedMax = value.length >= max;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <Sliders className="h-3.5 w-3.5" />
          <span className="text-xs">{label}</span>
          <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
            {value.length}/{max}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-semibold">
            Selecione até {max} campos
          </Label>
          {defaults && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] gap-1"
              onClick={reset}
            >
              <RotateCcw className="h-3 w-3" /> Restaurar
            </Button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mb-2">
          Para evitar quebra de layout, o PDF aceita no máximo {max} colunas.
          O Excel/CSV continua exportando todos os campos.
        </p>
        <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
          {options.map((opt) => {
            const checked = value.includes(opt.key);
            const disabled = !checked && reachedMax;
            return (
              <label
                key={opt.key}
                className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-pointer hover:bg-muted/50 ${
                  disabled ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={() => toggle(opt.key)}
                />
                <span>{opt.label}</span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
