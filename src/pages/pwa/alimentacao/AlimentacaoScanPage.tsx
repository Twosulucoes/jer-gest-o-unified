import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ScanLine, CheckCircle, XCircle, AlertTriangle, Search, Loader2, User, LogOut } from "lucide-react";
import { toast } from "sonner";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import QrCodeScanner from "@/components/pwa/QrCodeScanner";
import { resolveQrCredential } from "@/lib/resolveQrCredential";
import { searchParticipantsByNameOrCpf, type ParticipantManualSearchRow } from "@/lib/participantManualSearch";
import { useEventContext } from "@/contexts/EventContext";
import { useActiveStageId } from "@/contexts/StageContext";
import { isVoucherQr, tryRedeemVoucher } from "@/lib/voucherScan";
import { getPwaMessage, getVoucherMessage, getPwaLang } from "@/lib/pwa-messages";
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
import { usePwaAudit } from "@/hooks/usePwaAudit";

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
  usePwaAudit("alimentacao/escanear");
  const { activeEventId } = useEventContext();
  const stageId = useActiveStageId();
  const userId = user?.id ?? null;
  const lang = getPwaLang();
  const [windows, setWindows] = useState<MealWindow[]>([]);
  const [windowId, setWindowId] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [prefs, setPrefs] = useState<ScanPreferences>(() => loadScanPreferences(MODULE, userId));
  const [telemetry, setTelemetry] = useState<ScanTelemetry>(() => loadScanTelemetry(MODULE, userId));
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
    restrictions?: string;
    source?: "qr" | "manual";
  } | null>(null);
  const [manualQuery, setManualQuery] = useState("");
  const [debouncedManual, setDebouncedManual] = useState("");
  const [manualHits, setManualHits] = useState<ParticipantManualSearchRow[]>([]);
  const [manualSearching, setManualSearching] = useState(false);

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
      let q = supabase
        .from("meal_windows")
        .select("id, meal_type:meal_types(name), service_date, start_time, end_time")
        .eq("service_date", today)
        .order("start_time");
      if (activeEventId) q = q.eq("event_id", activeEventId);
      if (stageId) q = q.eq("event_stage_id", stageId);
      const { data } = await q;
      const list = (data ?? []) as unknown as MealWindow[];
      setWindows(list);
      if (list.length === 1) setWindowId(list[0].id);
    })();
  }, [activeEventId, stageId]);

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

  async function registerMealConsumption(
    participantId: string,
    participantName: string | null,
    method: "qr_scan" | "voucher" | "manual",
    resultSource: "qr" | "manual",
    foodRestrictions?: string | null,
  ) {
    if (!windowId) {
      toast.error(getPwaMessage("ERR_WINDOW_REQUIRED", lang));
      return;
    }

    const { count } = await supabase
      .from("meal_consumptions")
      .select("id", { count: "exact", head: true })
      .eq("participant_id", participantId)
      .eq("meal_window_id", windowId);

    if ((count || 0) > 0) {
      const errorMsg = getPwaMessage("ERR_ALREADY_REGISTERED", lang);
      setResult({ ok: false, message: errorMsg, source: resultSource });
      toast.error(errorMsg);
      recordOutcome("error");
      reopenIfContinuous();
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user.id) {
      setResult({ ok: false, message: getPwaMessage("ERR_SESSION_EXPIRED", lang) });
      recordOutcome("error");
      return;
    }

    const { error } = await supabase.from("meal_consumptions").insert({
      participant_id: participantId,
      meal_window_id: windowId,
      method,
      registered_by: session.user.id,
    });

    if (error) throw error;

    const prefix = method === "voucher" ? "Voucher · " : method === "manual" ? `${getPwaMessage("MANUAL_SEARCH", lang)} · ` : "";
    const successMsg = `${prefix}${getPwaMessage("SUCCESS_REGISTERED", lang)}: ${participantName || ""}`;
    
    setResult({
      ok: true,
      source: resultSource,
      message: successMsg,
      restrictions: foodRestrictions || undefined,
    });
    
    toast.success(successMsg);
    recordOutcome("ok");
    if (navigator.vibrate) navigator.vibrate(200);
    reopenIfContinuous();
  }

  const handleScan = async (rawValue: string) => {
    setScannerOpen(false);
    if (!rawValue.trim()) return;

    if (!windowId) {
      toast.error(getPwaMessage("ERR_WINDOW_REQUIRED", lang));
      return;
    }

    try {
      let participantId: string | null = null;
      let participantName: string | null = null;
      const foodRestrictions: string | null = null;
      let method: "qr_scan" | "voucher" = "qr_scan";

      if (isVoucherQr(rawValue)) {
        const voucher = await tryRedeemVoucher(rawValue, "meals", windowId);
        if (!voucher || !voucher.ok) {
          const errorMsg = getVoucherMessage(voucher?.reason, lang);
          setResult({ ok: false, message: errorMsg, source: "qr" });
          toast.error(errorMsg);
          recordOutcome("error");
          reopenIfContinuous();
          return;
        }
        participantId = voucher.participant_id ?? null;
        participantName = voucher.person_name ?? null;
        method = "voucher";
      } else {
        const resolved = await resolveQrCredential(rawValue, { eventId: activeEventId });
        if (!resolved) {
          const errorMsg = getPwaMessage("ERR_NOT_FOUND", lang);
          setResult({ ok: false, message: errorMsg, source: "qr" });
          toast.error(errorMsg);
          recordOutcome("error");
          return;
        }
        participantId = resolved.participant_id;
        participantName = resolved.full_name;
        method = "qr_scan";
      }

      if (!participantId) {
        setResult({ ok: false, message: getPwaMessage("ERR_UNKNOWN", lang), source: "qr" });
        recordOutcome("error");
        return;
      }

      await registerMealConsumption(participantId, participantName, method, "qr", foodRestrictions);
    } catch (err: unknown) {
      setResult({ ok: false, message: `${getPwaMessage("ERR_UNKNOWN", lang)}: ${getErrorMessage(err)}` });
      recordOutcome("error");
    }
  };

  const handleManualPick = async (row: ParticipantManualSearchRow) => {
    setManualQuery("");
    setManualHits([]);
    try {
      await registerMealConsumption(row.participant_id, row.full_name, "manual", "manual", null);
    } catch (err: unknown) {
      setResult({ ok: false, message: `${getPwaMessage("ERR_UNKNOWN", lang)}: ${getErrorMessage(err)}` });
      recordOutcome("error");
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-25" />
      <PwaHeader 
        title={getPwaMessage("SCAN_QR", lang)} 
        icon={ScanLine}
        backTo="/pwa/alimentacao" 
      />

      <main className="relative mx-auto max-w-md space-y-4 p-4">
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
          <Card
            className={
              result.ok
                ? "border-blue-500/50 bg-card/95 shadow-app-lg ring-1 ring-blue-500/20"
                : "border-destructive/50 bg-card/95"
            }
          >
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start gap-3">
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
              </div>
              {result.restrictions && (
                <div className="flex items-center gap-2 rounded-lg bg-warning/10 p-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                  <span className="text-xs text-warning-foreground">Restrição: {result.restrictions}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          <p className="text-center text-xs text-muted-foreground">{getPwaMessage("SEARCH_MANUALLY", lang)}</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={getPwaMessage("SEARCH_PLACEHOLDER", lang)}
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
                    <span className="text-sm">{getPwaMessage("BUSCANDO", lang)}</span>
                  </div>
                )}
                {!manualSearching && manualHits.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">{getPwaMessage("NO_RESULTS", lang)}</p>
                )}
                {!manualSearching &&
                  manualHits.map((h) => (
                    <button
                      key={h.participant_id}
                      type="button"
                      disabled={!windowId}
                      onClick={() => void handleManualPick(h)}
                      className="flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left last:border-0 hover:bg-muted/40 active:bg-muted/60 disabled:pointer-events-none disabled:opacity-50"
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

        <Button variant="module" className="h-12 w-full rounded-xl font-semibold shadow-app-md" onClick={() => setScannerOpen(true)} disabled={!windowId}>
          <ScanLine className="mr-2 h-5 w-5" />
          {getPwaMessage("SCAN_QR", lang)}
        </Button>
      </main>

      <QrCodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
        title={getPwaMessage("SCAN_QR", lang)}
      />
    </div>
  );
}
