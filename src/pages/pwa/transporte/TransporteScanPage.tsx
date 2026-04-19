import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScanLine, CheckCircle, XCircle } from "lucide-react";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import QrCodeScanner from "@/components/pwa/QrCodeScanner";
import { resolveQrCredential } from "@/lib/resolveQrCredential";
import { useAuth } from "@/hooks/useAuth";
import {
  loadScanPreferences,
  saveScanPreferences,
  loadScanTelemetry,
  bumpScanTelemetry,
  resetScanTelemetry,
  type ScanPreferences,
  type ScanTelemetry,
} from "@/lib/pwaScan";
import ScanPreferencesPanel from "@/components/pwa/ScanPreferencesPanel";

const MODULE = "transporte" as const;

export default function TransporteScanPage() {
  const _navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [searchParams] = useSearchParams();
  const tripId = searchParams.get("tripId");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [prefs, setPrefs] = useState<ScanPreferences>(() => loadScanPreferences(MODULE, userId));
  const [telemetry, setTelemetry] = useState<ScanTelemetry>(() => loadScanTelemetry(MODULE, userId));

  useEffect(() => {
    setPrefs(loadScanPreferences(MODULE, userId));
    setTelemetry(loadScanTelemetry(MODULE, userId));
  }, [userId]);

  const updatePrefs = (next: ScanPreferences) => {
    setPrefs(next);
    saveScanPreferences(MODULE, next, userId);
  };

  const reopenIfContinuous = () => {
    if (!prefs.continuousMode) return;
    setTimeout(() => setScannerOpen(true), prefs.reopenDelayMs);
  };

  const getErrorMessage = (err: unknown) => {
    if (err instanceof Error && err.message) return err.message;
    return "desconhecido";
  };

  const recordOutcome = (outcome: "ok" | "error") => {
    setTelemetry(bumpScanTelemetry(MODULE, outcome, userId));
  };

  const handleScan = async (rawValue: string) => {
    setScannerOpen(false);
    if (!rawValue.trim()) return;

    try {
      const resolved = await resolveQrCredential(rawValue);
      if (!resolved) {
        setResult({ ok: false, message: "Credencial não encontrada ou inativa" });
        recordOutcome("error");
        return;
      }

      const name = resolved.full_name || "Participante identificado";

      if (tripId) {
        const { data: { session } } = await supabase.auth.getSession();

        const { data: existing } = await supabase
          .from("transport_passengers")
          .select("id, status")
          .eq("trip_id", tripId)
          .eq("participant_id", resolved.participant_id)
          .maybeSingle();

        if (existing) {
          if (existing.status === "boarded") {
            setResult({ ok: true, message: `${name} já embarcou anteriormente` });
            recordOutcome("ok");
            reopenIfContinuous();
            return;
          }
          const { error } = await supabase
            .from("transport_passengers")
            .update({ status: "boarded", boarded_at: new Date().toISOString(), boarded_by: session?.user.id ?? null })
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("transport_passengers")
            .insert({
              trip_id: tripId,
              participant_id: resolved.participant_id,
              status: "boarded",
              boarded_at: new Date().toISOString(),
              boarded_by: session?.user.id ?? null,
              is_manual: false,
            });
          if (error) throw error;
        }
      }

      setResult({ ok: true, message: `Embarque registrado: ${name}` });
      recordOutcome("ok");
      if (navigator.vibrate) navigator.vibrate(200);
      reopenIfContinuous();
    } catch (err: unknown) {
      setResult({ ok: false, message: `Erro ao validar: ${getErrorMessage(err)}` });
      recordOutcome("error");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PwaHeader
        title="Scan Embarque"
        icon={ScanLine}
        backTo={tripId ? `/pwa/transporte/embarque?tripId=${tripId}` : "/pwa/transporte"}
      />

      <main className="p-4 max-w-md mx-auto space-y-4">
        <ScanPreferencesPanel
          prefs={prefs}
          telemetry={telemetry}
          onChangeContinuous={(v) => updatePrefs({ ...prefs, continuousMode: v })}
          onChangeDelay={(v) => updatePrefs({ ...prefs, reopenDelayMs: v })}
          onResetTelemetry={() => setTelemetry(resetScanTelemetry(MODULE, userId))}
          switchId="continuous-transport-scan"
        />

        <Button className="w-full min-h-[44px]" onClick={() => setScannerOpen(true)}>
          <ScanLine className="h-5 w-5 mr-2" />
          Escanear QR Code
        </Button>

        {result && (
          <Card className={result.ok ? "border-success/50" : "border-destructive/50"}>
            <CardContent className="p-4 flex items-center gap-3">
              {result.ok ? (
                <CheckCircle className="h-6 w-6 text-success shrink-0" />
              ) : (
                <XCircle className="h-6 w-6 text-destructive shrink-0" />
              )}
              <span className="text-sm font-medium">{result.message}</span>
            </CardContent>
          </Card>
        )}
      </main>

      <QrCodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
        title="Scan Embarque"
      />
    </div>
  );
}
