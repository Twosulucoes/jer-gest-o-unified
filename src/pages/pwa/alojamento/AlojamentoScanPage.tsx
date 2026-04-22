import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { rpcResolveQr, rpcCheckin, rpcCheckout, getDeviceId, getSelectedFacility } from "@/hooks/useAlojamento";
import { extractQrToken } from "@/lib/resolveQrCredential";
import { isVoucherQr, tryRedeemVoucher } from "@/lib/voucherScan";
import { getPwaMessage, getVoucherMessage, getPwaLang } from "@/lib/pwa-messages";
import { useAlojamentoOffline } from "@/hooks/useAlojamentoOffline";
import { useAuth } from "@/hooks/useAuth";
import { AlojamentoNavHeader } from "@/components/pwa/alojamento/AlojamentoNavHeader";
import { useEventContext } from "@/contexts/EventContext";
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
import { ArrowLeft, ScanLine, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import QrCodeScanner from "@/components/pwa/QrCodeScanner";

type ScanMode = "validate" | "checkin" | "checkout";

const MODULE = "alojamento" as const;

export default function AlojamentoScanPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const lang = getPwaLang();
  const { enqueue, isOnline } = useAlojamentoOffline();
  const [mode, setMode] = useState<ScanMode>("checkin");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [result, setResult] = useState<Record<string, any> | null>(null);
  const [prefs, setPrefs] = useState<ScanPreferences>(() => loadScanPreferences(MODULE, userId));
  const [telemetry, setTelemetry] = useState<ScanTelemetry>(() => loadScanTelemetry(MODULE, userId));

  const facilityId = getSelectedFacility();

  useEffect(() => {
    setPrefs(loadScanPreferences(MODULE, userId));
    setTelemetry(loadScanTelemetry(MODULE, userId));
  }, [userId]);

  const updatePrefs = (next: ScanPreferences) => {
    setPrefs(next);
    saveScanPreferences(MODULE, next, userId);
  };

  const reopenIfContinuous = useCallback(() => {
    if (!prefs.continuousMode) return;
    setTimeout(() => setScannerOpen(true), prefs.reopenDelayMs);
  }, [prefs.continuousMode, prefs.reopenDelayMs]);

  const recordOutcome = useCallback((outcome: "ok" | "error") => {
    setTelemetry(bumpScanTelemetry(MODULE, outcome, userId));
  }, [userId]);

  const handleScan = useCallback(async (rawValue: string) => {
    setScannerOpen(false);

    // Auto-detecção de voucher: substitui credencial para validar/check-in operacional
    if (isVoucherQr(rawValue)) {
      if (!facilityId) {
        toast.error(getPwaMessage("ERR_SELECT_FACILITY", lang));
        navigate("/pwa/alojamento");
        return;
      }
      setResult(null);
      const voucher = await tryRedeemVoucher(rawValue, "lodging", facilityId);
      if (!voucher || !voucher.ok) {
        toast.error(getVoucherMessage(voucher?.reason, lang));
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        return;
      }
      setResult({
        ok: true,
        full_name: voucher.person_name,
        participant_type: "Voucher",
        person_id: null,
        message: `Voucher validado · ${voucher.remaining_uses ?? "∞"} usos restantes`,
      });
      toast.success(`🎫 Voucher validado — ${voucher.person_name ?? ""}`);
      recordOutcome("ok");
      if (navigator.vibrate) navigator.vibrate(200);
      reopenIfContinuous();
      return;
    }

    const token = extractQrToken(rawValue);
    if (!token) {
      toast.error(getPwaMessage("ERR_INVALID_QR", lang));
      return;
    }

    if (!facilityId) {
      toast.error(getPwaMessage("ERR_SELECT_FACILITY", lang));
      navigate("/pwa/alojamento");
      return;
    }

    const deviceId = getDeviceId();
    setResult(null);

    try {
      if (!isOnline) {
        if (mode === "checkin") {
          enqueue("checkin", { token, facility_id: facilityId, mode: "person_qr" });
          toast.info("Check-in enfileirado (offline)");
        } else if (mode === "checkout") {
          enqueue("checkout", { token, facility_id: facilityId });
          toast.info("Check-out enfileirado (offline)");
        }
        return;
      }

      let res: Record<string, any>;
      if (mode === "validate") {
        res = await rpcResolveQr(token);
      } else if (mode === "checkin") {
        res = await rpcCheckin(deviceId, token, facilityId);
      } else {
        res = await rpcCheckout(deviceId, token, facilityId);
      }

      setResult(res);

      if (res.ok) {
        const msg = mode === "validate" ? getPwaMessage("QR_VALID", lang) :
                    mode === "checkin" ? getPwaMessage("CHECKIN_SUCCESS", lang) : 
                    getPwaMessage("CHECKOUT_SUCCESS", lang);
        toast.success(msg);
        recordOutcome("ok");
        if (navigator.vibrate) navigator.vibrate(200);
        reopenIfContinuous();
      } else {
        const errorMessages: Record<string, string> = {
          INVALID_TOKEN: getPwaMessage("ERR_INVALID_QR", lang),
          NOT_A_PERSON: getPwaMessage("ERR_NOT_FOUND", lang),
          UNDER_12: getPwaMessage("ERR_UNDER_12", lang),
          ALREADY_CHECKED_IN: getPwaMessage("ERR_ALREADY_STAYING", lang),
          NOT_CHECKED_IN: getPwaMessage("ERR_NOT_STAYING", lang),
        };
        toast.error(errorMessages[res.error] || res.error || getPwaMessage("ERR_UNKNOWN", lang));
        recordOutcome("error");
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        reopenIfContinuous();
      }
    } catch (err: any) {
      toast.error(`${getPwaMessage("ERR_UNKNOWN", lang)}: ` + (err.message || "desconhecido"));
      recordOutcome("error");
      reopenIfContinuous();
    }
  }, [mode, facilityId, isOnline, enqueue, navigate, recordOutcome, reopenIfContinuous, lang]);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b bg-card px-4 h-14">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/pwa/alojamento")} className="text-muted-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <ScanLine className="h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground">Scanner</span>
        </div>
        <Button size="sm" onClick={() => setScannerOpen(true)}>
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
          switchId="continuous-lodging-scan"
        />

        <Tabs value={mode} onValueChange={(v) => setMode(v as ScanMode)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="checkin">Check-in</TabsTrigger>
            <TabsTrigger value="checkout">Check-out</TabsTrigger>
            <TabsTrigger value="validate">Validar</TabsTrigger>
          </TabsList>
        </Tabs>

        <Button
          className="w-full min-h-[44px]"
          onClick={() => setScannerOpen(true)}
        >
          <ScanLine className="h-5 w-5 mr-2" />
          Escanear QR Code
        </Button>

        {result && (
          <Card className={result.ok ? "border-green-500/50" : "border-destructive/50"}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                {result.ok ? (
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                ) : (
                  <XCircle className="h-6 w-6 text-destructive" />
                )}
                <span className="font-semibold text-lg">
                  {result.ok ? "Sucesso" : "Bloqueado"}
                </span>
              </div>
              {result.full_name && (
                <p className="text-foreground font-medium">{result.full_name}</p>
              )}
              {result.participant_type && (
                <Badge variant="module">{result.participant_type}</Badge>
              )}
              {result.error && (
                <p className="text-sm text-destructive">{result.error}: {result.message || ""}</p>
              )}
              {result.ok && result.person_id && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => navigate(`/pwa/alojamento/pessoa/${result.person_id}`)}
                >
                  Ver perfil
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      <QrCodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
        title={`Scanner — ${mode === "checkin" ? "Check-in" : mode === "checkout" ? "Check-out" : "Validar"}`}
      />
    </div>
  );
}
