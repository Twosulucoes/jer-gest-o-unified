import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { rpcResolveQr, rpcCheckin, rpcCheckout, getDeviceId, getSelectedFacility } from "@/hooks/useAlojamento";
import { extractQrToken } from "@/lib/resolveQrCredential";
import { isVoucherQr, tryRedeemVoucher } from "@/lib/voucherScan";
import { voucherErrorMessage, voucherSuccessMessage } from "@/lib/voucherMessages";
import { getPwaMessage, getPwaLang } from "@/lib/pwa-messages";
import { useAlojamentoOffline } from "@/hooks/useAlojamentoOffline";
import { useAuth } from "@/hooks/useAuth";
import { addToVoucherQueue } from "@/lib/voucherOffline";
import { VoucherConflictCentral } from "@/components/pwa/VoucherConflictCentral";
import { OfflineSyncStatus } from "@/components/pwa/OfflineSyncStatus";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import { useEventContext } from "@/contexts/EventContext";
import { useActiveStageId } from "@/contexts/StageContext";
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
import { ScanLine, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import QrCodeScanner from "@/components/pwa/QrCodeScanner";
import { usePwaAudit } from "@/hooks/usePwaAudit";
import { dbTelemetry } from "@/lib/monitoring/dbTelemetry";


type ScanMode = "validate" | "checkin" | "checkout";

const MODULE = "alojamento" as const;

export default function AlojamentoScanPage() {
  const navigate = useNavigate();
  const { activeEvent } = useEventContext();
  usePwaAudit("alojamento/escanear");
  const stageId = useActiveStageId();
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

    // Auto-detecção de voucher
    if (isVoucherQr(rawValue)) {
      if (!facilityId) {
        toast.error(getPwaMessage("ERR_SELECT_FACILITY", lang));
        navigate("/pwa/alojamento");
        return;
      }
      setResult(null);
      if (!isOnline) {
        addToVoucherQueue(rawValue, "lodging", facilityId, userId || "", "Portador de Voucher");
        const successMsg = `Voucher registrado offline: ${rawValue.replace("voucher:", "")}`;
        setResult({
          ok: true,
          full_name: "Portador de Voucher",
          participant_type: "Voucher",
          message: successMsg,
        });
        toast.info("Voucher registrado offline. Sincronize quando houver internet.");
        recordOutcome("ok");
        if (navigator.vibrate) navigator.vibrate(200);
        reopenIfContinuous();
        return;
      }

      const voucher = await tryRedeemVoucher(rawValue, "lodging", facilityId);
      if (!voucher || !voucher.ok) {
        const msg = voucherErrorMessage(voucher?.reason, lang);
        let extra = "";
        if (voucher?.reason === 'already_used_here' && voucher.used_at) {
          extra = ` às ${format(new Date(voucher.used_at), "HH:mm")}`;
        }
        toast.error(`${msg.text}${extra}`);
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        return;
      }
      const successMsg = voucherSuccessMessage(voucher, "lodging", lang);
      const displayName = voucher.person_name || "Portador de Voucher";
      
      setResult({
        ok: true,
        full_name: displayName,
        participant_type: voucher.voucher_type === "aggregate" ? "Voucher anônimo" : "Voucher nominal",
        person_id: null,
        message: successMsg.text,
      });
      toast.success(successMsg.text);
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

      // Validação de Credencial Ativa na Etapa (Requirement)
      if (mode === "checkin" && stageId) {
        const resolved = await rpcResolveQr(token);
        if (resolved.ok && resolved.entity_id) {
          const { data: pse, error: pseErr } = await supabase
            .from("participant_event_stages")
            .select("status")
            .eq("participant_id", resolved.entity_id)
            .eq("event_stage_id", stageId)
            .maybeSingle();

          if (pseErr || !pse || pse.status !== "active") {
            setResult({
              ok: false,
              error: "CREDENTIAL_INACTIVE",
              message: "Participante não possui credencial ativa para esta etapa.",
              full_name: resolved.full_name
            });
            toast.error("Atenção: Participante sem credencial ativa!");
            if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
            recordOutcome("error");
            reopenIfContinuous();
            return;
          }
        }
      }

      let res: Record<string, any>;
      const eventId = activeEvent?.id;

      if (mode === "validate") {
        res = await rpcResolveQr(token);
        dbTelemetry.log({ moduleName: MODULE, tableName: 'RPC:rpcResolveQr', operation: 'SELECT', eventId, isSuccess: res.ok, errorCode: res.error });
      } else if (mode === "checkin") {
        res = await rpcCheckin(deviceId, token, facilityId);
        dbTelemetry.log({ moduleName: MODULE, tableName: 'lodging_assignments', operation: 'INSERT', eventId, isSuccess: res.ok, errorCode: res.error });
      } else {
        res = await rpcCheckout(deviceId, token, facilityId);
        dbTelemetry.log({ moduleName: MODULE, tableName: 'lodging_assignments', operation: 'UPDATE', eventId, isSuccess: res.ok, errorCode: res.error });
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
  }, [mode, facilityId, isOnline, enqueue, navigate, recordOutcome, reopenIfContinuous, lang, stageId]);

  return (
    <div className="min-h-screen bg-background">
      <PwaHeader 
        title="Scanner" 
        icon={ScanLine}
        backTo="/pwa/alojamento" 
      />

      <main className="p-4 max-w-md mx-auto space-y-4 pb-20">
        <OfflineSyncStatus />
        <VoucherConflictCentral />
        <ScanPreferencesPanel
          prefs={prefs}
          telemetry={telemetry}
          onChangeContinuous={(v) => updatePrefs({ ...prefs, continuousMode: v })}
          onChangeDelay={(v) => updatePrefs({ ...prefs, reopenDelayMs: v })}
          onResetTelemetry={() => setTelemetry(resetScanTelemetry(MODULE, userId))}
          switchId="continuous-lodging-scan"
        />

        <Tabs value={mode} onValueChange={(v) => setMode(v as ScanMode)}>
          <TabsList className="grid w-full grid-cols-3 h-11 bg-muted/40 p-1 rounded-xl">
            <TabsTrigger value="checkin" className="rounded-lg font-bold text-xs uppercase">In</TabsTrigger>
            <TabsTrigger value="checkout" className="rounded-lg font-bold text-xs uppercase">Out</TabsTrigger>
            <TabsTrigger value="validate" className="rounded-lg font-bold text-xs uppercase">Validar</TabsTrigger>
          </TabsList>
        </Tabs>

        <Button
          className="w-full h-14 rounded-2xl text-lg font-bold shadow-lg shadow-primary/10"
          onClick={() => setScannerOpen(true)}
        >
          <ScanLine className="h-6 w-6 mr-3" />
          Escanear QR Code
        </Button>

        {result && (
          <Card className={`overflow-hidden border-2 animate-in zoom-in-95 duration-200 ${result.ok ? "border-green-500/30 bg-green-50/50 dark:bg-green-950/20" : "border-destructive/30 bg-destructive/5 dark:bg-destructive/10"}`}>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${result.ok ? "bg-green-100 text-green-600 dark:bg-green-900/40" : "bg-destructive/10 text-destructive"}`}>
                  {result.ok ? (
                    <CheckCircle2 className="h-6 w-6" />
                  ) : (
                    <XCircle className="h-6 w-6" />
                  )}
                </div>
                <span className={`font-bold text-xl ${result.ok ? "text-green-700 dark:text-green-400" : "text-destructive"}`}>
                  {result.ok ? "Sucesso" : "Bloqueado"}
                </span>
              </div>
              
              <div className="space-y-1">
                {result.full_name && (
                  <p className="text-foreground font-bold text-lg">{result.full_name}</p>
                )}
                {result.participant_type && (
                  <Badge variant="secondary" className="font-bold uppercase tracking-wider text-[10px]">{result.participant_type}</Badge>
                )}
              </div>

              {result.message && (
                <p className={`text-sm font-medium ${result.ok ? "text-green-600/80 dark:text-green-400/80" : "text-destructive/80"}`}>
                  {result.message}
                </p>
              )}
              
              {result.error && !result.message && (
                <p className="text-sm font-medium text-destructive/80 uppercase tracking-tight">
                  Erro: {result.error}
                </p>
              )}

              {result.ok && result.person_id && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 rounded-xl font-bold border-green-500/20 hover:bg-green-500/10"
                  onClick={() => navigate(`/pwa/alojamento/pessoa/${result.person_id}`)}
                >
                  Ver Perfil Completo
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
