import { ReactNode } from "react";
import { AlertTriangle, Lock, Loader2, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface ModuleStateBoundaryProps {
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  isForbidden?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  emptyHint?: ReactNode;
  loadingFallback?: ReactNode;
  onRetry?: () => void;
  children: ReactNode;
}

function getErrorMessage(error: unknown): string {
  if (!error) return "Falha desconhecida ao carregar os dados.";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null && "message" in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "Falha desconhecida ao carregar os dados.";
}

export function ModuleStateBoundary({
  isLoading,
  isError,
  error,
  isForbidden,
  isEmpty,
  emptyMessage = "Nenhum item encontrado.",
  emptyHint,
  loadingFallback,
  onRetry,
  children,
}: ModuleStateBoundaryProps) {
  if (isForbidden) {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <Lock className="h-8 w-8 text-destructive" aria-hidden />
          <p className="text-sm font-medium text-destructive">Sem permissão para visualizar este conteúdo.</p>
          <p className="text-xs text-muted-foreground">Solicite acesso ao administrador do evento.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <>
        {loadingFallback ?? (
          <div className="space-y-3" aria-busy="true" aria-live="polite">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              <span className="text-xs">Carregando…</span>
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))}
          </div>
        )}
      </>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden />
          <div>
            <p className="text-sm font-medium text-destructive">Não foi possível carregar os dados.</p>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">{getErrorMessage(error)}</p>
          </div>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Tentar novamente
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (isEmpty) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium text-foreground">{emptyMessage}</p>
          {emptyHint && <div className="text-xs text-muted-foreground">{emptyHint}</div>}
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}

export default ModuleStateBoundary;
