import { Database } from "@/integrations/supabase/types";

export type IncidentModule = Database["public"]["Enums"]["incident_module"];
export type IncidentStatus = Database["public"]["Enums"]["incident_status"];

export interface IncidentModuleConfig {
  label: string;
  color: string;
}

export interface IncidentStatusConfig {
  label: string;
  variant: "default" | "secondary" | "outline" | "destructive";
}

export const INCIDENT_MODULES: Record<IncidentModule, IncidentModuleConfig> = {
  transporte: { 
    label: "Transporte", 
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" 
  },
  alimentacao: { 
    label: "Alimentação", 
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
  },
  alojamento: { 
    label: "Alojamento", 
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" 
  },
  outro: { 
    label: "Geral", 
    color: "bg-muted text-muted-foreground" 
  },
};

export const INCIDENT_STATUSES: Record<IncidentStatus, IncidentStatusConfig> = {
  pending: { 
    label: "Pendente", 
    variant: "destructive" 
  },
  in_progress: { 
    label: "Em análise", 
    variant: "secondary" 
  },
  resolved: { 
    label: "Resolvida", 
    variant: "default" 
  },
};
