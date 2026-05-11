import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export type JanelaStatus = "ativa" | "encerrada" | "futura";

export interface JanelaSheetItem {
  id: string;
  nome: string;
  inicio: string;
  fim: string;
  status: JanelaStatus;
}

interface JanelaSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  janelas: JanelaSheetItem[];
  selectedId: string;
  onSelect: (id: string) => void;
}

const STATUS_STYLE: Record<
  JanelaStatus,
  { dot: string; ring: string; chip: string; label: string }
> = {
  ativa: {
    dot: "bg-green-500",
    ring: "ring-green-500/40",
    chip: "bg-green-500/15 text-green-400 ring-1 ring-inset ring-green-500/30",
    label: "ATIVA",
  },
  encerrada: {
    dot: "bg-zinc-500",
    ring: "ring-zinc-500/40",
    chip: "bg-zinc-500/15 text-zinc-400 ring-1 ring-inset ring-zinc-500/30",
    label: "ENCERRADA",
  },
  futura: {
    dot: "bg-blue-500",
    ring: "ring-blue-500/40",
    chip: "bg-blue-500/15 text-blue-400 ring-1 ring-inset ring-blue-500/30",
    label: "AGUARDANDO",
  },
};

export function JanelaSheet({
  open,
  onOpenChange,
  janelas,
  selectedId,
  onSelect,
}: JanelaSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-t border-border/60 p-0 max-h-[80vh]"
      >
        <SheetHeader className="px-5 pt-5 pb-3 text-left">
          <SheetTitle className="text-base font-bold">Trocar janela</SheetTitle>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Selecione a refeição que está sendo operada agora
          </p>
        </SheetHeader>

        <div className="max-h-[60vh] overflow-y-auto px-3 pb-6 space-y-2">
          {janelas.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhuma janela cadastrada para hoje.
            </p>
          )}

          {janelas.map((j) => {
            const cfg = STATUS_STYLE[j.status];
            const isSelected = j.id === selectedId;
            return (
              <button
                key={j.id}
                type="button"
                onClick={() => {
                  onSelect(j.id);
                  onOpenChange(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all active:scale-[0.99]",
                  isSelected
                    ? "border-module bg-module-soft/30 ring-2 ring-module/40"
                    : "border-border/70 bg-card/60 hover:border-border",
                )}
              >
                <span
                  className={cn(
                    "relative inline-flex h-3 w-3 shrink-0 rounded-full",
                    cfg.dot,
                  )}
                >
                  {j.status === "ativa" && (
                    <span className="absolute inset-0 inline-flex animate-ping rounded-full bg-green-500/60" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">{j.nome}</p>
                  <p className="text-[11px] font-medium text-muted-foreground">
                    {j.inicio}–{j.fim}
                  </p>
                </div>

                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                    cfg.chip,
                  )}
                >
                  {cfg.label}
                </span>

                {isSelected && (
                  <Check className="h-4 w-4 shrink-0 text-module" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
