import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, AlertTriangle, Info, CheckSquare, ExternalLink } from "lucide-react";
import { ValidationAlert } from "./useBulletinData";

interface BulletinValidationAlertsProps {
  alerts: ValidationAlert[];
}

export default function BulletinValidationAlerts({ alerts }: BulletinValidationAlertsProps) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="space-y-3 mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex items-center gap-2 mb-2 px-1">
        <CheckSquare className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Checklist de Integridade do Boletim</h3>
      </div>
      
      {alerts.map((alert, i) => (
        <Alert 
          key={i} 
          variant={alert.type === "error" ? "destructive" : "default"} 
          className={alert.type === "warning" ? "border-amber-500/50 bg-amber-500/5 text-amber-900 dark:text-amber-200" : ""}
        >
          {alert.type === "error" ? (
            <AlertCircle className="h-4 w-4" />
          ) : alert.type === "warning" ? (
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          ) : (
            <Info className="h-4 w-4" />
          )}
          <AlertTitle className="font-semibold text-sm flex items-center justify-between">
            {alert.type === "error" ? "Inconsistência Crítica" : "Alerta de Inconsistência"}
            {alert.links && <Badge variant="outline" className="text-[10px] h-4 font-normal ml-2">{alert.links.length} pendente(s)</Badge>}
          </AlertTitle>
          <AlertDescription className="text-sm opacity-90">
            <div className="space-y-1">
              <p>{alert.message}</p>
              {alert.details && <p className="text-xs opacity-75">{alert.details}</p>}
            </div>
            {alert.links && alert.links.length > 0 && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {alert.links.map((link, j) => (
                  <a
                    key={j}
                    href={link.url}
                    className="flex items-center gap-2 rounded-md bg-background/50 border border-border/50 px-2 py-1.5 text-[11px] font-medium transition hover:bg-background/80 hover:border-primary/50 group"
                  >
                    <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-primary shrink-0" />
                    <span className="truncate">{link.label}</span>
                  </a>
                ))}
                {alert.links.length > 5 && (
                  <div className="text-[10px] text-muted-foreground pt-1 px-1">
                    ... e mais {alert.links.length - 5}
                  </div>
                )}
              </div>
            )}
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
