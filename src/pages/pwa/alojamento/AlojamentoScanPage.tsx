import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  rpcResolveQr, 
  rpcCheckin, 
  rpcCheckout, 
  rpcRegisterPresence,
  getDeviceId, 
  getSelectedFacility,
  getSelectedUnit,
  setSelectedUnit
} from "@/lib/alojamentoRpc";
import { extractQrToken } from "@/lib/resolveQrCredential";
import { isVoucherQr, tryRedeemVoucher } from "@/lib/voucherScan";
import { voucherErrorMessage, voucherSuccessMessage } from "@/lib/voucherMessages";
import { getSystemMessage, getPwaLang } from "@/lib/systemMessages";
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
import { ScanLine, CheckCircle2, XCircle, AlertTriangle, Moon, Search } from "lucide-react";
import { format } from "date-fns";
import QrCodeScanner from "@/components/pwa/QrCodeScanner";
import { usePwaAudit } from "@/hooks/usePwaAudit";
import { dbTelemetry } from "@/lib/monitoring/dbTelemetry";

type ScanMode = "validate" | "checkin" | "checkout" | "presence";

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
  const [units, setUnits] = useState<any[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(getSelectedUnit());

  useEffect(() => {
    setPrefs(loadScanPreferences(MODULE, userId));
    setTelemetry(loadScanTelemetry(MODULE, userId));
  }, [userId]);

  useEffect(() => {
    async function loadUnits() {
      if (!facilityId) return;
      const { data } = await supabase
        .from("lodging_units")
        .select("id, name, capacity, gender_restriction")
        .eq("location_id", facilityId)
        .eq("is_active", true)
        .order("name");
      if (data) setUnits(data);
    }
    loadUnits();
  }, [facilityId]);

  const handleUnitChange = (val: string) => {
    const id = val === "none" ? null : val;
    setSelectedUnitId(id);
    setSelectedUnit(id);
  };

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
    let val = rawValue.trim();
    if (!val) return;

    // Normalização para entrada manual de código de voucher (6 caracteres)
    if (!val.toLowerCase().startsWith("voucher:") && val.length === 6 && /^[A-Z0-9]+$/i.test(val)) {
      val = `voucher:${val.toUpperCase()}`;
    }

    // Auto-detecção de voucher
    if (isVoucherQr(val)) {
      if (!facilityId) {
        toast.error(getSystemMessage("ERR_SELECT_FACILITY", lang));
        navigate("/pwa/alojamento");
        return;
      }
      setResult(null);
      if (!isOnline) {
        addToVoucherQueue(val, "lodging", facilityId, userId || "", "Portador de Voucher");
        const successMsg = `Voucher registrado offline: ${val.replace("voucher:", "")}`;
        setResult({
          ok: true,
          full_name: "Portador de Voucher",
          participant_type: "Voucher",
          message: successMsg,
        });
        toast.info(getSystemMessage("VOUCHER_OFFLINE_RECORDED", lang));
        recordOutcome("ok");
        if (navigator.vibrate) navigator.vibrate(200);
        reopenIfContinuous();
        return;
      }

      const voucher = await tryRedeemVoucher(val, "lodging", facilityId);
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

    const token = extractQrToken(val);
    if (!token) {
      toast.error(getSystemMessage("ERR_INVALID_QR", lang));
      return;
    }

    if (!facilityId) {
      toast.error(getSystemMessage("ERR_SELECT_FACILITY", lang));
      navigate("/pwa/alojamento");
      return;
    }

    const deviceId = getDeviceId();
    setResult(null);

    try {
      if (!isOnline) {
        if (mode === "checkin") {
          enqueue("checkin", { token, location_id: facilityId, unit_id: selectedUnitId, mode: "person_qr" });
          toast.info("Check-in enfileirado (offline)");
        } else if (mode === "checkout") {
          enqueue("checkout", { token, location_id: facilityId });
          toast.info("Check-out enfileirado (offline)");
        } else if (mode === "presence") {
          enqueue("presence", { token, unit_id: selectedUnitId });
          toast.info("Presença enfileirada (offline)");
        }
        return;
      }

      // Validação de Credencial Ativa na Etapa (Requirement)
      if ((mode === "checkin" || mode === "presence") && stageId) {
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
        res = await rpcCheckin(deviceId, token, facilityId, selectedUnitId || undefined);
        dbTelemetry.log({ moduleName: MODULE, tableName: 'lodging_occupancies', operation: 'INSERT', eventId, isSuccess: res.ok, errorCode: res.error });
      } else if (mode === "checkout") {
        res = await rpcCheckout(deviceId, token, facilityId);
        dbTelemetry.log({ moduleName: MODULE, tableName: 'lodging_occupancies', operation: 'UPDATE', eventId, isSuccess: res.ok, errorCode: res.error });
      } else {
        // Presence
        if (!selectedUnitId) {
          toast.error("Selecione uma unidade para registrar presença.");
          return;
        }
        res = await rpcRegisterPresence(deviceId, token, selectedUnitId);
        dbTelemetry.log({ moduleName: MODULE, tableName: 'lodging_presence_logs', operation: 'INSERT', eventId, isSuccess: res.ok, errorCode: res.error });
      }

      setResult(res);

      if (res.ok) {
        const msg = mode === "validate" ? getSystemMessage("QR_VALID", lang) :
                    mode === "checkin" ? getSystemMessage("CHECKIN_SUCCESS", lang) : 
                    mode === "presence" ? getSystemMessage("PRESENCE_SUCCESS", lang) :
                    getSystemMessage("CHECKOUT_SUCCESS", lang);
        toast.success(msg);
        recordOutcome("ok");
        if (navigator.vibrate) navigator.vibrate(200);
        reopenIfContinuous();
      } else {
        const errorMessages: Record<string, string> = {
          INVALID_TOKEN: getSystemMessage("ERR_INVALID_QR", lang),
          NOT_A_PERSON: getSystemMessage("ERR_NOT_FOUND", lang),
          UNDER_12: getSystemMessage("ERR_UNDER_12", lang),
          ALREADY_CHECKED_IN: getSystemMessage("ERR_ALREADY_STAYING", lang),
          NOT_CHECKED_IN: getSystemMessage("ERR_NOT_STAYING", lang),
          GENDER_MISMATCH: getSystemMessage("GENDER_MISMATCH", lang),
          UNIT_FULL: getSystemMessage("CAPACITY_FULL", lang),
          CAPACITY_NOT_DEFINED: getSystemMessage("CAPACITY_NOT_DEFINED", lang),
          PRESENCE_WITHOUT_CHECKIN: "Pessoa sem check-in ativo.",
          PRESENCE_WRONG_UNIT: "Pessoa em unidade divergente.",
          PRESENCE_ALREADY_REGISTERED: "Presença já registrada hoje.",
        };
        toast.error(errorMessages[res.error] || res.message || res.error || getSystemMessage("ERR_UNKNOWN", lang));
        recordOutcome("error");
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        reopenIfContinuous();
      }
    } catch (err: any) {
      toast.error(`${getSystemMessage("ERR_UNKNOWN", lang)}: ` + (err.message || "desconhecido"));
      recordOutcome("error");
      reopenIfContinuous();
    }
  }, [mode, facilityId, selectedUnitId, isOnline, enqueue, navigate, recordOutcome, reopenIfContinuous, lang, stageId, activeEvent?.id, userId]);

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
          <TabsList className="grid w-full grid-cols-4 h-11 bg-muted/40 p-1 rounded-xl">
            <TabsTrigger value="checkin" className="rounded-lg font-bold text-xs uppercase">In</TabsTrigger>
            <TabsTrigger value="presence" className="rounded-lg font-bold text-xs uppercase">
              <Moon className="h-3 w-3 mr-1" />
              Lua
            </TabsTrigger>
            <TabsTrigger value="checkout" className="rounded-lg font-bold text-xs uppercase">Out</TabsTrigger>
            <TabsTrigger value="validate" className="rounded-lg font-bold text-xs uppercase">Validar</TabsTrigger>
          </TabsList>
        </Tabs>

        {(mode === "checkin" || mode === "presence") && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase ml-1">Unidade / Quarto</label>
            <Select value={selectedUnitId || "none"} onValueChange={handleUnitChange}>
              <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-none shadow-inner font-medium">
                <SelectValue placeholder="Selecione a unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma selecionada</SelectItem>
                {units.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} {u.capacity ? `(${u.capacity} lug.)` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button
          className="w-full h-14 rounded-2xl text-lg font-bold shadow-lg shadow-primary/10"
          onClick={() => setScannerOpen(true)}
        >
          <ScanLine className="h-6 w-6 mr-3" />
          Escanear QR Code
        </Button>

        <div className="space-y-2">
          <label className="text-xs font-bold text-muted-foreground uppercase ml-1">Entrada Manual (Voucher/CPF)</label>
          <div className="flex gap-2">
            <Input 
              placeholder="Código do voucher ou CPF..." 
              className="h-11 rounded-xl bg-card border-border/50"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleScan((e.target as HTMLInputElement).value);
                  (e.target as HTMLInputElement).value = "";
                }
              }}
            />
            <Button 
              variant="secondary" 
              className="h-11 rounded-xl px-4"
              onClick={(e) => {
                const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                handleScan(input.value);
                input.value = "";
              }}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {result && (
          <div className="space-y-3 animate-in zoom-in-95 duration-200">
            {/* Divergence Alert above Success Card */}
            {result.ok && result.divergence && (
              <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
                <AlertTitle className="text-amber-800 dark:text-amber-400 font-bold">Divergência Detectada</AlertTitle>
                <AlertDescription className="text-amber-700 dark:text-amber-500/90 text-sm font-medium">
                  {result.divergence}
                </AlertDescription>
              </Alert>
            )}

            <Card className={`overflow-hidden border-2 ${result.ok ? "border-green-500/30 bg-green-50/50 dark:bg-green-950/20" : "border-destructive/30 bg-destructive/5 dark:bg-destructive/10"}`}>
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
          </div>
        )}
      </main>

      <QrCodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
        continuous={prefs.continuousMode}
        allowedPrefixes={["JER", "jer", "voucher:"]}
        title={`Scanner — ${mode === "checkin" ? "Check-in" : mode === "checkout" ? "Check-out" : mode === "presence" ? "Presença Noturna" : "Validar"}`}
      />
    </div>
  );
}