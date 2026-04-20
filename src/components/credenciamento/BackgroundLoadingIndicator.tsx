import { Loader2 } from "lucide-react";

interface Props {
  loaded: number;
  isLoading: boolean;
  label?: string;
}

/**
 * Indicador discreto que mostra que mais dados estão sendo carregados
 * em segundo plano, sem bloquear a UI.
 */
export function BackgroundLoadingIndicator({ loaded, isLoading, label = "registros" }: Props) {
  if (!isLoading) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary animate-pulse"
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      <span className="font-medium">
        Carregando mais dados em segundo plano… {loaded.toLocaleString("pt-BR")} {label} já disponíveis
      </span>
    </div>
  );
}
