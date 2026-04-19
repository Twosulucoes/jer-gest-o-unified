import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ScanLine, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import QrCodeScanner from "@/components/pwa/QrCodeScanner";
import { resolveQrCredential } from "@/lib/resolveQrCredential";
import { isVoucherQr, tryRedeemVoucher, voucherReasonLabel } from "@/lib/voucherScan";
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

interface MealWindow {
  id: string;
  meal_type: { name: string } | null;
  service_date: string;
  start_time: string;
  end_time: string;
}

const MODULE = "alimentacao" as const;

export default function AlimentacaoScanPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [windows, setWindows] = useState<MealWindow[]>([]);
  const [windowId, setWindowId] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [prefs, setPrefs] = useState<ScanPreferences>(() => loadScanPreferences(MODULE, userId));
  const [telemetry, setTelemetry] = useState<ScanTelemetry>(() => loadScanTelemetry(MODULE, userId));
  const [result, setResult] = useState<{ ok: boolean; message: string; restrictions?: string } | null>(null);

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

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("meal_windows")
        .select("id, meal_type:meal_types(name), service_date, start_time, end_time")
        .eq("service_date", today)
        .order("start_time");
      const list = (data ?? []) as unknown as MealWindow[];
      setWindows(list);
      if (list.length === 1) setWindowId(list[0].id);
    })();
  }, []);

  const handleScan = async (rawValue: string) => {
    setScannerOpen(false);
    if (!rawValue.trim()) return;

    if (!windowId) {
      toast.error("Selecione uma janela de refeição primeiro");
      return;
    }

    try {
      let participantId: string | null = null;
      let participantName: string | null = null;
      const foodRestrictions: string | null = null;
      let viaVoucher = false;

      // Auto-detecção: voucher tem prefixo `voucher:`
      if (isVoucherQr(rawValue)) {
        const voucher = await tryRedeemVoucher(rawValue, "meals", windowId);
        if (!voucher || !voucher.ok) {
          setResult({ ok: false, message: voucherReasonLabel(voucher?.reason) });
          recordOutcome("error");
          reopenIfContinuous();
          return;
        }
        participantId = voucher.participant_id ?? null;
        participantName = voucher.person_name ?? null;
        viaVoucher = true;
      } else {
        const resolved = await resolveQrCredential(rawValue);
        if (!resolved) {
          setResult({ ok: false, message: "Credencial não encontrada ou inativa" });
          recordOutcome("error");
          return;
        }
        participantId = resolved.participant_id;
        participantName = resolved.full_name;
      }

      if (!participantId) {
        setResult({ ok: false, message: "Não foi possível identificar a pessoa" });
        recordOutcome("error");
        return;
      }

      const { count } = await supabase
        .from("meal_consumptions")
        .select("id", { count: "exact", head: true })
        .eq("participant_id", participantId)
        .eq("meal_window_id", windowId);

      if ((count || 0) > 0) {
        setResult({ ok: false, message: "Refeição já registrada nesta janela" });
        recordOutcome("error");
        reopenIfContinuous();
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user.id) {
        setResult({ ok: false, message: "Sessão expirada. Faça login novamente." });
        recordOutcome("error");
        return;
      }

      const { error } = await supabase.from("meal_consumptions").insert({
        participant_id: participantId,
        meal_window_id: windowId,
        method: viaVoucher ? "voucher" : "qr_scan",
        registered_by: session.user.id,
      });

      if (error) throw error;

      setResult({
        ok: true,
        message: `${viaVoucher ? "🎫 Voucher · " : ""}Consumo registrado: ${participantName || ""}`,
        restrictions: foodRestrictions || undefined,
      });
      recordOutcome("ok");
      if (navigator.vibrate) navigator.vibrate(200);
      reopenIfContinuous();
    } catch (err: unknown) {
      setResult({ ok: false, message: `Erro ao registrar consumo: ${getErrorMessage(err)}` });
      recordOutcome("error");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b bg-card px-4 h-14">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/pwa/alimentacao")} className="text-muted-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <ScanLine className="h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground">Scan Refeição</span>
        </div>
        <Button size="sm" onClick={() => setScannerOpen(true)} disabled={!windowId}>
          <ScanLine className="h-4 w-4 mr-1" /> Scan
        </Button>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-4">
        <ScanPreferencesPanel
          prefs={prefs}
          telemetry={telemetry}
          onChangeContinuous={(v) => updatePrefs({ ...prefs, continuousMode: v })}
          onChangeDelay={(v) => updatePrefs({ ...prefs, reopenDelayMs: v })}
          onResetTelemetry={() => setTelemetry(resetScanTelemetry(MODULE, userId))}
          switchId="continuous-food-scan"
        />

        {windows.length === 0 ? (
          <Card className="border-warning/50">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-warning shrink-0" />
              <span className="text-sm">Nenhuma janela de refeição aberta no momento</span>
            </CardContent>
          </Card>
        ) : (
          <Select value={windowId} onValueChange={setWindowId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a janela" />
            </SelectTrigger>
            <SelectContent>
              {windows.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.meal_type?.name || "Refeição"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {result && (
          <Card className={result.ok ? "border-success/50" : "border-destructive/50"}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-3">
                {result.ok ? <CheckCircle className="h-6 w-6 text-success shrink-0" /> : <XCircle className="h-6 w-6 text-destructive shrink-0" />}
                <span className="text-sm font-medium">{result.message}</span>
              </div>
              {result.restrictions && (
                <div className="flex items-center gap-2 p-2 rounded bg-warning/10">
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                  <span className="text-xs text-warning-foreground">Restrição: {result.restrictions}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Button
          variant="outline"
          className="w-full min-h-[44px]"
          onClick={() => setScannerOpen(true)}
          disabled={!windowId}
        >
          <ScanLine className="h-4 w-4 mr-2" />
          Escanear QR Code
        </Button>
      </main>

      <QrCodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
        title="Scan Refeição"
      />
    </div>
  );
}
