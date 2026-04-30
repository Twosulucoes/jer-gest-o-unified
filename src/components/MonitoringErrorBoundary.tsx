import React from "react";
import { reportError } from "@/lib/monitoring/errorReporter";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class MonitoringErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportError({
      message: `[ErrorBoundary] ${error.message}`,
      stack: error.stack,
      severity: "critical",
      context: { componentStack: info.componentStack },
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return <>{this.props.fallback}</>;

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
          <div className="max-w-md w-full bg-card border border-border rounded-xl p-8 text-center space-y-6 shadow-app-lg animate-in fade-in zoom-in duration-300">
            <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">Oops! Algo deu errado</h1>
              <p className="text-muted-foreground text-sm">
                Ocorreu um erro inesperado na aplicação. Nossa equipe técnica já foi notificada.
              </p>
            </div>
            
            {process.env.NODE_ENV === 'development' && (
              <div className="bg-muted p-3 rounded-md text-left overflow-auto max-h-40">
                <p className="text-[10px] font-mono text-destructive break-words">
                  {this.state.error?.name}: {this.state.error?.message}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button
                onClick={() => window.location.reload()}
                className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-all active:scale-95"
              >
                Tentar novamente
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="w-full px-4 py-2 text-muted-foreground font-medium text-sm hover:text-foreground transition-colors"
              >
                Voltar para o início
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
