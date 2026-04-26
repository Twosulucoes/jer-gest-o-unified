import {
  Lock,
  Clock,
  Play,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Eye,
} from "lucide-react";
import type { ProvaStatus } from "./computeProvaData";

export const STATUS_CONFIG: Record<
  ProvaStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  bloqueada: {
    label: "Bloqueada",
    color: "bg-muted text-muted-foreground",
    icon: <Lock className="h-3.5 w-3.5" />,
  },
  nao_iniciada: {
    label: "Não iniciada",
    color: "bg-primary/10 text-primary",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  em_andamento: {
    label: "Em andamento",
    color: "bg-warning/10 text-warning",
    icon: <Play className="h-3.5 w-3.5" />,
  },
  com_pendencia: {
    label: "Com pendência",
    color: "bg-pending/15 text-pending",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  concluida: {
    label: "Concluída",
    color: "bg-success/10 text-success",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
};

export const STEP_COLORS: Record<string, string> = {
  done: "bg-success",
  active: "bg-warning",
  pending: "bg-muted",
  error: "bg-destructive",
};

export function getActionLabel(status: ProvaStatus): string {
  switch (status) {
    case "bloqueada":
      return "Pré-validação";
    case "nao_iniciada":
      return "Iniciar";
    case "em_andamento":
      return "Continuar";
    case "com_pendencia":
      return "Resolver";
    case "concluida":
      return "Ver resultados";
  }
}

export function getActionIcon(status: ProvaStatus): React.ReactNode {
  switch (status) {
    case "bloqueada":
      return <Lock className="h-3.5 w-3.5" />;
    case "nao_iniciada":
      return <Play className="h-3.5 w-3.5" />;
    case "em_andamento":
      return <ArrowRight className="h-3.5 w-3.5" />;
    case "com_pendencia":
      return <AlertTriangle className="h-3.5 w-3.5" />;
    case "concluida":
      return <Eye className="h-3.5 w-3.5" />;
  }
}
