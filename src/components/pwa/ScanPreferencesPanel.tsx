import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Activity, RotateCcw } from "lucide-react";
import { REOPEN_DELAY_OPTIONS, type ScanPreferences, type ScanTelemetry } from "@/lib/pwaScan";

interface ScanPreferencesPanelProps {
  prefs: ScanPreferences;
  telemetry: ScanTelemetry;
  onChangeContinuous: (value: boolean) => void;
  onChangeDelay: (value: number) => void;
  onResetTelemetry: () => void;
  switchId?: string;
}

export default function ScanPreferencesPanel({
  prefs,
  telemetry,
  onChangeContinuous,
  onChangeDelay,
  onResetTelemetry,
  switchId = "continuous-scan",
}: ScanPreferencesPanelProps) {
  return (
    <Card>
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor={switchId} className="text-sm font-medium">Modo contínuo</Label>
          <Switch id={switchId} checked={prefs.continuousMode} onCheckedChange={onChangeContinuous} />
        </div>

        {prefs.continuousMode && (
          <div className="flex items-center justify-between gap-2">
            <Label className="text-sm text-muted-foreground">Reabertura</Label>
            <Select
              value={String(prefs.reopenDelayMs)}
              onValueChange={(v) => onChangeDelay(Number(v))}
            >
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REOPEN_DELAY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center justify-between border-t pt-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Activity className="h-3.5 w-3.5" /> {telemetry.total}</span>
            <span className="flex items-center gap-1 text-green-600"><CheckCircle className="h-3.5 w-3.5" /> {telemetry.ok}</span>
            <span className="flex items-center gap-1 text-destructive"><XCircle className="h-3.5 w-3.5" /> {telemetry.error}</span>
          </div>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onResetTelemetry} title="Zerar contadores do dia">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
