import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { ValidationAlert } from "./useBulletinData";

interface BulletinValidationAlertsProps {
  alerts: ValidationAlert[];
}

export default function BulletinValidationAlerts({ alerts }: BulletinValidationAlertsProps) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="space-y-3 mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
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
          <AlertTitle className="font-semibold">{alert.type === "error" ? "Inconsistência Crítica" : "Alerta de Inconsistência"}</AlertTitle>
          <AlertDescription className="text-sm opacity-90">
            {alert.message}
            {alert.details && <p className="mt-1 text-xs">{alert.details}</p>}
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
