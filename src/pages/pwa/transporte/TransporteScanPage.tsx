import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScanLine, CheckCircle, XCircle, Search, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import QrCodeScanner from "@/components/pwa/QrCodeScanner";
import { resolveQrCredential } from "@/lib/resolveQrCredential";
import { searchParticipantsByNameOrCpf, type ParticipantManualSearchRow } from "@/lib/participantManualSearch";
import { useAuth } from "@/hooks/useAuth";
import { useEventContext } from "@/contexts/EventContext";
import { getPwaMessage, getPwaLang } from "@/lib/pwa-messages";
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
import { usePwaAudit } from "@/hooks/usePwaAudit";
import { addToOfflineQueue, isOnline } from "@/lib/offlineQueue";
import { OfflineSyncStatus } from "@/components/pwa/OfflineSyncStatus";
import { isVoucherQr, tryRedeemVoucher } from "@/lib/voucherScan";
import { voucherErrorMessage, voucherSuccessMessage } from "@/lib/voucherMessages";
import { addToVoucherQueue } from "@/lib/voucherOffline";
import { VoucherConflictCentral } from "@/components/pwa/VoucherConflictCentral";


const MODULE = "transporte" as const;

export default function TransporteScanPage() {
  const { user } = useAuth();
  const { activeEventId } = useEventContext();
  usePwaAudit("transporte/escanear", activeEventId);
  const userId = user?.id ?? null;
  const lang = getPwaLang();
  const [searchParams] = useSearchParams();
  const tripId = searchParams.get("tripId");
  const [result, setResult] = useState<{ ok: boolean; message: string; source?: "qr" | "manual" } | null>(null);
  const [manualQuery, setManualQuery] = useState("");
  const [debouncedManual, setDebouncedManual] = useState("");
  const [manualHits, setManualHits] = useState<ParticipantManualSearchRow[]>([]);
  const [manualSearching, setManualSearching] = useState(false);
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

  useEffect(() => {
    const t = setTimeout(() => setDebouncedManual(manualQuery.trim()), 320);
    return () => clearTimeout(t);
  }, [manualQuery]);

  useEffect(() => {
    if (!activeEventId || debouncedManual.length < 2) {
      setManualHits([]);
      setManualSearching(false);
      return;
    }
    let cancelled = false;
    setManualSearching(true);
    void searchParticipantsByNameOrCpf(debouncedManual, activeEventId)
      .then((rows) => {
        if (!cancelled) setManualHits(rows);
      })
      .finally(() => {
        if (!cancelled) setManualSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedManual, activeEventId]);

  async function applyBoarding(participantId: string, displayName: string, source: "qr" | "manual") {
    const name = displayName || "Participante identificado";

    if (tripId) {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const boardingData = {
        trip_id: tripId,
        participant_id: participantId,
        status: "boarded",
        boarded_at: new Date().toISOString(),
        boarded_by: session?.user.id ?? null,
        is_manual: source === "manual",
      };

      if (!isOnline()) {
        addToOfflineQueue("transporte", boardingData, name);
        const successMsg = `Embarque registrado (Offline): ${name}`;
        setResult({ ok: true, source, message: successMsg });
        toast.info("Registrado offline. Sincronize quando houver internet.");
        recordOutcome("ok");
        if (navigator.vibrate) navigator.vibrate(200);
        reopenIfContinuous();
        return;
      }

      const { data: existing } = await supabase
        .from("transport_passengers")
        .select("id, status")
        .eq("trip_id", tripId)
        .eq("participant_id", participantId)
        .maybeSingle();

      if (existing) {
        if (existing.status === "boarded") {
          const msg = `${name} já embarcou anteriormente`;
          setResult({ ok: true, source, message: msg });
          toast.info(msg);
          recordOutcome("ok");
          reopenIfContinuous();
          return;
        }
        const { error } = await supabase
          .from("transport_passengers")
          .update({ 
            status: "boarded", 
            boarded_at: boardingData.boarded_at, 
            boarded_by: boardingData.boarded_by 
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("transport_passengers").insert(boardingData);
        if (error) throw error;
      }

    }

    const successMsg = `Embarque registrado: ${name}`;
    setResult({ ok: true, source, message: successMsg });
    toast.success(successMsg);
    recordOutcome("ok");
    if (navigator.vibrate) navigator.vibrate(200);
    reopenIfContinuous();
  }

  const handleScan = async (rawValue: string) => {
    setScannerOpen(false);
    if (!rawValue.trim()) return;

    try {
      if (isVoucherQr(rawValue)) {
        if (!tripId) {
          toast.error("Selecione uma viagem primeiro");
          return;
        }

        if (!isOnline()) {
          addToVoucherQueue(rawValue, "transport", tripId, userId || "", "Portador de Voucher");
          const successMsg = `Voucher registrado offline: ${rawValue.replace("voucher:", "")}`;
          setResult({ ok: true, source: "qr", message: successMsg });
          toast.info("Voucher registrado offline. Sincronize quando houver internet.");
          recordOutcome("ok");
          if (navigator.vibrate) navigator.vibrate(200);
          reopenIfContinuous();
          return;
        }

        const voucher = await tryRedeemVoucher(rawValue, "transport", tripId);
        if (!voucher || !voucher.ok) {
          const msg = voucherErrorMessage(voucher?.reason, lang);
          setResult({ ok: false, message: msg.text, source: "qr" });
          toast.error(msg.text);
          recordOutcome("error");
          reopenIfContinuous();
          return;
        }

        const msg = voucherSuccessMessage(voucher, "transport", lang);
        setResult({ ok: true, source: "qr", message: msg.text });
        toast.success(msg.text);
        recordOutcome("ok");
        if (navigator.vibrate) navigator.vibrate(200);
        reopenIfContinuous();
        return;
      }

      const resolved = await resolveQrCredential(rawValue, { eventId: activeEventId });
      if (!resolved) {
        const errorMsg = "Credencial não encontrada ou inativa";
        setResult({ ok: false, message: errorMsg });
        toast.error(errorMsg);
        recordOutcome("error");
        return;
      }

      const name = resolved.full_name || "Participante identificado";
      await applyBoarding(resolved.participant_id, name, "qr");
    } catch (err: unknown) {
      setResult({ ok: false, message: `Erro ao validar: ${getErrorMessage(err)}` });
      recordOutcome("error");
    }
  };

  const handleManualPick = async (row: ParticipantManualSearchRow) => {
    setManualQuery("");
    setManualHits([]);
    try {
      await applyBoarding(row.participant_id, row.full_name, "manual");
    } catch (err: unknown) {
      setResult({ ok: false, message: `Erro ao validar: ${getErrorMessage(err)}` });
      recordOutcome("error");
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-25" />
      <PwaHeader
        title="Escanear QR"
        icon={ScanLine}
        backTo={tripId ? `/pwa/transporte/embarque?tripId=${tripId}` : "/pwa/transporte"}
      />

      <main className="relative mx-auto max-w-md space-y-4 p-4">
        <OfflineSyncStatus />

        <p className="text-center text-sm text-muted-foreground">Credencial ou voucher</p>

        <ScanPreferencesPanel
          prefs={prefs}
          telemetry={telemetry}
          onChangeContinuous={(v) => updatePrefs({ ...prefs, continuousMode: v })}
          onChangeDelay={(v) => updatePrefs({ ...prefs, reopenDelayMs: v })}
          onResetTelemetry={() => setTelemetry(resetScanTelemetry(MODULE, userId))}
          switchId="continuous-transport-scan"
        />

        <Button variant="module" className="h-12 w-full rounded-xl text-base font-semibold shadow-app-md" onClick={() => setScannerOpen(true)}>
          <ScanLine className="mr-2 h-5 w-5" />
          Escanear QR Code
        </Button>

        <div className="space-y-2">
          <p className="text-center text-xs text-muted-foreground">ou buscar manualmente</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou CPF…"
              value={manualQuery}
              onChange={(e) => setManualQuery(e.target.value)}
              className="h-11 border-border/80 bg-card/90 pl-10"
            />
          </div>
          {!activeEventId && (
            <p className="text-center text-[11px] text-amber-600 dark:text-amber-400">Selecione o evento ativo para habilitar a busca.</p>
          )}
          {activeEventId && debouncedManual.length >= 2 && (
            <Card className="max-h-52 overflow-y-auto border-border/80 bg-card/95 shadow-app-sm">
              <CardContent className="p-0">
                {manualSearching && (
                  <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">Buscando…</span>
                  </div>
                )}
                {!manualSearching && manualHits.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhum participante encontrado neste evento.</p>
                )}
                {!manualSearching &&
                  manualHits.map((h) => (
                    <button
                      key={h.participant_id}
                      type="button"
                      onClick={() => void handleManualPick(h)}
                      className="flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left last:border-0 hover:bg-muted/40 active:bg-muted/60"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--module-accent)/0.18)] text-[hsl(var(--module-accent))]">
                        <User className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{h.full_name}</p>
                        <p className="truncate text-xs text-muted-foreground">{h.participant_type}</p>
                      </div>
                    </button>
                  ))}
              </CardContent>
            </Card>
          )}
        </div>

        {result && (
          <Card
            className={
              result.ok
                ? "border-blue-500/50 bg-card/95 shadow-app-lg ring-1 ring-blue-500/20"
                : "border-destructive/50 bg-card/95"
            }
          >
            <CardContent className="flex items-start gap-3 p-4">
              {result.ok ? (
                <CheckCircle className="h-6 w-6 shrink-0 text-blue-500" />
              ) : (
                <XCircle className="h-6 w-6 shrink-0 text-destructive" />
              )}
              <div className="min-w-0">
                {result.ok && (
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                    {result.source === "manual" ? getPwaMessage("MANUAL_SEARCH", lang) : getPwaMessage("QR_VALID", lang)}
                  </p>
                )}
                <span className="text-sm font-medium leading-snug">{result.message}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      <QrCodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
        title="Escanear QR"
      />
    </div>
  );
}
