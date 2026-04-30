import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

interface NetworkErrorStateProps {
  onRetry: () => void;
  title?: string;
  description?: string;
}

/**
 * Standardized component for network errors when fetching data from Supabase.
 */
export function NetworkErrorState({ 
  onRetry, 
  title = "Falha na conexão", 
  description = "Não conseguimos estabelecer contato com o servidor. Verifique sua conexão e tente novamente."
}: NetworkErrorStateProps) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title={title}
      description={description}
      className="border-destructive/10 bg-destructive/5"
      action={
        <Button onClick={onRetry} variant="outline" size="sm" className="font-bold">
          <RefreshCw className="mr-2 h-3.5 w-3.5" /> 
          Tentar Novamente
        </Button>
      }
    />
  );
}
