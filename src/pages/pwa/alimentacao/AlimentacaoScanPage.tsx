import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ScanLine, CheckCircle, XCircle, AlertTriangle, Search, Loader2, User, LogOut } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import QrCodeScanner from "@/components/pwa/QrCodeScanner";
import { resolveQrCredential } from "@/lib/resolveQrCredential";
import { searchParticipantsByNameOrCpf, type ParticipantManualSearchRow } from "@/lib/participantManualSearch";
import { useParticipantStatusCache } from "@/hooks/pwa/useParticipantStatusCache";
import { useEventContext } from "@/contexts/EventContext";
import { useActiveStageId } from "@/contexts/StageContext";
import { isVoucherQr, tryRedeemVoucher } from "@/lib/voucherScan";
import { voucherErrorMessage, voucherSuccessMessage } from "@/lib/voucherMessages";
import { getSystemMessage, getPwaLang } from "@/lib/systemMessages";
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
import PwaLayout from "@/components/pwa/PwaLayout";
import { addToOfflineQueue, isOnline } from "@/lib/offlineQueue";
import { OfflineSyncStatus } from "@/components/pwa/OfflineSyncStatus";
import { addToVoucherQueue } from "@/lib/voucherOffline";
import { enqueueIncident } from "@/lib/incidentOffline";
import { readMealWindowsCache, writeMealWindowsCache } from "@/lib/mealWindowsCache";
import { useTodayString } from "@/hooks/useTodayString";
import { VoucherConflictCentral } from "@/components/pwa/VoucherConflictCentral";



interface MealWindow {
  id: string;
  meal_type: { name: string } | null;
  service_date: string;
  start_time: string;
  end_time: string;
}

// Saída antecipada (Etapa 2): pessoa fica inelegível para janelas com
// service_date >= left_event_at::date. O trigger no DB (etapa 2) bloqueia
// inserções; o front aplica a mesma regra para mensagem clara e trilha.
function leftEventBlocksWindow(
  leftEventAt: string | null | undefined,
  serviceDate: string | undefined,
): boolean {
  if (!leftEventAt || !serviceDate) return false;
  const leftDate = leftEventAt.slice(0, 10); // ISO -> YYYY-MM-DD
  return serviceDate >= leftDate;
}

const MODULE = "alimentacao" as const;

export default function AlimentacaoScanPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const preselectedWindowId = (location.state as any)?.windowId as string | undefined;
  const { user } = useAuth();
  const { activeEventId } = useEventContext();
  usePwaAudit("alimentacao/escanear", activeEventId);
  const stageId = useActiveStageId();
  const userId = user?.id ?? null;
  const lang = getPwaLang();
  const today = useTodayString();
  const [windows, setWindows] = useState<MealWindow[]>([]);
  const [windowId, setWindowId] = useState(preselectedWindowId ?? "");
  const [consumptionCount, setConsumptionCount] = useState(0);
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
  // L4: trava de double-submit. Bloqueia handleScan/handleManualPick paralelos.
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [onlineState, setOnlineState] = useState(navigator.onLine);

  useEffect(() => {
    const up = () => setOnlineState(true);
    const down = () => setOnlineState(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);

  const { lookupQr } = useParticipantStatusCache({ eventId: activeEventId, online: onlineState });

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
      // 1. Cache chaveado por evento+etapa (auditoria L bloqueador 4) —
      //    sem o key composto, trocar de etapa exibia janelas do contexto
      //    antigo até o fetch terminar.
      const cached = readMealWindowsCache<any>(activeEventId, stageId);
      if (cached?.windows?.length) {
        const todaysWindows = cached.windows.filter((w: any) => w.service_date === today);
        if (todaysWindows.length > 0) {
          setWindows(todaysWindows as MealWindow[]);
          if (todaysWindows.length === 1) setWindowId(todaysWindows[0].id);
        }
      }

      // 2. Fetch fresh data
      let q = supabase
        .from("meal_windows")
        .select("id, meal_type:meal_types(name), service_date, start_time, end_time")
        .eq("service_date", today)
        .eq("event_id", activeEventId)
        .order("start_time");
      if (stageId) q = q.eq("event_stage_id", stageId);
      const { data } = await q;
      const list = (data ?? []) as unknown as MealWindow[];
      setWindows(list);
      if (list.length === 1) setWindowId(list[0].id);
      if (list.length > 0) writeMealWindowsCache(activeEventId, stageId, list);
    })();
  }, [activeEventId, stageId, today]);

  useEffect(() => {
    if (!windowId) {
      setConsumptionCount(0);
      return;
    }

    const fetchCount = async () => {
      const { count } = await supabase
        .from("meal_consumptions")
        .select("*", { count: 'exact', head: true })
        .eq("meal_window_id", windowId);
      
      setConsumptionCount(count || 0);
    };

    void fetchCount();

    // Subscribe to real-time updates for this window
    const channel = supabase
      .channel(`meal_consumptions_${windowId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meal_consumptions',
          filter: `meal_window_id=eq.${windowId}`
        },
        () => {
          void fetchCount();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [windowId]);

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

  const recordIncident = useCallback(async (type: string, participantId?: string) => {
    if (!windowId) return;

    const deviceInfo = {
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      platform: typeof navigator !== "undefined" ? navigator.platform : null,
      online: isOnline(),
    };

    // Offline: enfileira para sync — o `OfflineSyncStatus` flusha junto
    // com a fila de consumos. Sem isso, recusas durante operação offline
    // (sem credencial, inativo, NEEDS_MEALS_FALSE, LEFT_EVENT, voucher
    // inválido) ficavam sem trilha, quebrando a aba Divergências.
    if (!isOnline()) {
      enqueueIncident({
        meal_window_id: windowId,
        incident_type: type,
        participant_id: participantId || null,
        device_info: deviceInfo,
      });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user.id) return;

      await (supabase as any).from("meal_incidents").insert({
        meal_window_id: windowId,
        incident_type: type,
        participant_id: participantId || null,
        registered_by: session.user.id,
        is_offline: false,
        device_info: deviceInfo,
      });
    } catch (err) {
      // Se a inserção online falhar (RLS, rede caindo no meio do scan),
      // empurra pra fila para não perder a trilha.
      enqueueIncident({
        meal_window_id: windowId,
        incident_type: type,
        participant_id: participantId || null,
        device_info: { ...deviceInfo, fallback_from: "online_insert_failed" },
      });
      console.error("Failed to record meal incident, enqueued offline:", err);
    }
  }, [windowId]);

  async function registerMealConsumption(
    participantId: string,
    participantName: string | null,
    method: "qr_scan" | "voucher" | "manual",
    resultSource: "qr" | "manual",
    foodRestrictions?: string | null,
  ) {
    if (!windowId) {
      toast.error(getSystemMessage("ERR_WINDOW_REQUIRED", lang));
      return;
    }

    if (isOnline()) {
      const { count } = await supabase
        .from("meal_consumptions")
        .select("id", { count: "exact", head: true })
        .eq("participant_id", participantId)
        .eq("meal_window_id", windowId);

      if ((count || 0) > 0) {
        const errorMsg = getSystemMessage("ERR_ALREADY_REGISTERED", lang);
        setResult({ ok: false, message: errorMsg, source: resultSource });
        toast.error(errorMsg);
        recordOutcome("error");
        void recordIncident("DUPLICATE", participantId);
        reopenIfContinuous();
        return;
      }
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user.id) {
      setResult({ ok: false, message: getSystemMessage("ERR_SESSION_EXPIRED", lang) });
      recordOutcome("error");
      return;
    }

    const consumptionData = {
      participant_id: participantId,
      meal_window_id: windowId,
      method,
      registered_by: session.user.id,
    };

    if (!isOnline()) {
      const enqueueResult = addToOfflineQueue("alimentacao", consumptionData, participantName || undefined);
      if (enqueueResult.deduped) {
        const dedupMsg = `Já existe registro offline pendente para ${participantName || "este participante"} nesta janela.`;
        setResult({ ok: false, message: dedupMsg, source: resultSource });
        toast.info(dedupMsg, { description: "Aguarde a sincronização para evitar duplicidade." });
        recordOutcome("error");
        reopenIfContinuous();
        return;
      }
      const successMsg = `${getSystemMessage("SUCCESS_REGISTERED", lang)} (Offline): ${participantName || ""}`;
      setResult({
        ok: true,
        source: resultSource,
        message: successMsg,
        restrictions: foodRestrictions || undefined,
      });
      toast.info("Registrado offline. Sincronize quando houver internet.");
      recordOutcome("ok");
      if (navigator.vibrate) navigator.vibrate(200);
      reopenIfContinuous();
      return;
    }

    const { error } = await supabase.from("meal_consumptions").insert(consumptionData);

    if (error) {
      // Conflito UNIQUE (corrida entre operadores ou re-tap antes do realtime
      // atualizar a contagem) precisa virar DUPLICATE, não OTHER, para que a
      // aba Divergências consiga reconciliar e o operador veja a mensagem
      // certa em vez de erro genérico.
      if ((error as { code?: string }).code === "23505") {
        const dupMsg = getSystemMessage("ERR_ALREADY_REGISTERED", lang);
        setResult({ ok: false, message: dupMsg, source: resultSource });
        toast.error(dupMsg);
        recordOutcome("error");
        void recordIncident("DUPLICATE", participantId);
        reopenIfContinuous();
        return;
      }
      void recordIncident("OTHER", participantId);
      throw error;
    }

    const prefix = method === "voucher" ? "Voucher · " : method === "manual" ? `${getSystemMessage("MANUAL_SEARCH", lang)} · ` : "";
    const successMsg = `${prefix}${getSystemMessage("SUCCESS_REGISTERED", lang)}: ${participantName || ""}`;
    
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
    if (isSubmitting) return;
    setScannerOpen(false);
    let val = rawValue.trim();
    if (!val) return;

    // Normalização para entrada manual de código de voucher (6 caracteres)
    if (!val.toLowerCase().startsWith("voucher:") && val.length === 6 && /^[A-Z0-9]+$/i.test(val)) {
      val = `voucher:${val.toUpperCase()}`;
    }

    if (!windowId) {
      toast.error(getSystemMessage("ERR_WINDOW_REQUIRED", lang));
      return;
    }

    setIsSubmitting(true);
    try {
      let participantId: string | null = null;
      let participantName: string | null = null;
      let foodRestrictions: string | null = null;
      let method: "qr_scan" | "voucher" = "qr_scan";

      if (isVoucherQr(val)) {
        if (!isOnline()) {
          addToVoucherQueue(val, "meals", windowId, userId || "", "Portador de Voucher");
          const successMsg = `Voucher registrado offline: ${val.replace("voucher:", "")}`;
          setResult({ 
            ok: true, 
            source: "qr", 
            message: successMsg,
            is_offline: true,
            offline_at: new Date().toISOString()
          } as any);
          toast.info(getSystemMessage("VOUCHER_OFFLINE_RECORDED", lang));
          recordOutcome("ok");
          if (navigator.vibrate) navigator.vibrate(200);
          reopenIfContinuous();
          return;
        }

        const voucher = await tryRedeemVoucher(val, "meals", windowId);
        if (!voucher || !voucher.ok) {
          const msg = voucherErrorMessage(voucher?.reason, lang);
          let extra = "";
          if (voucher?.reason === 'already_used_here' && voucher.used_at) {
            extra = ` em ${format(new Date(voucher.used_at), "HH:mm")}`;
            if (voucher.operator_name) extra += ` por ${voucher.operator_name}`;
          }
          setResult({ ok: false, message: `${msg.text}${extra}`, source: "qr" });
          toast.error(`${msg.text}${extra}`);
          recordOutcome("error");

          // Map voucher reason to incident type
          let incType = "VOUCHER_INVALID";
          if (voucher?.reason === 'already_used_here' || voucher?.reason === 'already_used') incType = "VOUCHER_ALREADY_USED";
          else if (voucher?.reason === 'expired') incType = "VOUCHER_EXPIRED";
          else if (voucher?.reason === 'inactive') incType = "VOUCHER_REVOKED";
          
          void recordIncident(incType);
          reopenIfContinuous();
          return;
        }

        // Voucher Válido
        const msg = voucherSuccessMessage(voucher, "meals", lang);
        setResult({ 
          ok: true, 
          source: "qr", 
          message: msg.text,
          full_name: voucher.person_name || "Portador de Voucher"
        } as any);
        toast.success(msg.text);
        recordOutcome("ok");
        if (navigator.vibrate) navigator.vibrate(200);
        reopenIfContinuous();
        return;
      } else {
        // --- Offline: usa cache para verificar o estado do participante ---
        if (!isOnline()) {
          const cached = lookupQr(val);

          if (cached.state === "sem_cache") {
            const msg = "Sem conexão e dados não sincronizados. Abra o módulo online para baixar o cache.";
            setResult({ ok: false, message: msg, source: "qr" });
            toast.error("Cache indisponível.", { description: msg });
            recordOutcome("error");
            void recordIncident("OTHER");
            reopenIfContinuous();
            setIsSubmitting(false);
            return;
          }
          if (cached.state === "nao_cadastrado") {
            const msg = getSystemMessage("ERR_NOT_FOUND", lang);
            setResult({ ok: false, message: msg, source: "qr" });
            toast.error(msg);
            recordOutcome("error");
            void recordIncident("OTHER");
            reopenIfContinuous();
            setIsSubmitting(false);
            return;
          }
          if (cached.state === "nao_credenciado") {
            const msg = "Participante não possui credencial ativa (Aguardando Credenciamento).";
            setResult({ ok: false, message: msg, source: "qr" });
            toast.error("Sem credencial ativa.", { description: "Encaminhe o atleta para a secretaria." });
            recordOutcome("error");
            void recordIncident("NO_CREDENTIAL", cached.entry.participant_id);
            reopenIfContinuous();
            setIsSubmitting(false);
            return;
          }
          // credenciado offline
          const entry = cached.entry;
          if (!entry.needs_meals) {
            const msg = "Participante não declarou necessidade de alimentação.";
            setResult({ ok: false, message: msg, source: "qr" });
            toast.error(msg);
            recordOutcome("error");
            void recordIncident("NEEDS_MEALS_FALSE", entry.participant_id);
            reopenIfContinuous();
            setIsSubmitting(false);
            return;
          }
          await registerMealConsumption(entry.participant_id, entry.full_name, "qr_scan", "qr");
          setIsSubmitting(false);
          return;
        }

        // --- Online ---
        const resolved = await resolveQrCredential(val, { eventId: activeEventId });
        if (!resolved) {
          const errorMsg = getSystemMessage("ERR_NOT_FOUND", lang);
          setResult({ ok: false, message: errorMsg, source: "qr" });
          toast.error(errorMsg);
          recordOutcome("error");
          void recordIncident("OTHER");
          return;
        }

        // Verifica status do participante + elegibilidade para refeição.
        // Mantém paridade com evaluateMealEligibility (fluxo manual).
        const { data: partData, error: partError } = await (supabase as any)
          .from("participants")
          .select("status, is_active, credentialed_at, needs_meals, left_event_at, person_id")
          .eq("id", resolved.participant_id)
          .single();

        if (partError || !partData?.is_active) {
          const msg = "Participante Inativo ou não encontrado";
          setResult({ ok: false, message: msg, source: "qr" });
          toast.error(msg);
          recordOutcome("error");
          void recordIncident("PARTICIPANT_INACTIVE", resolved.participant_id);
          return;
        }

        if (partData.needs_meals === false) {
          const msg = "Participante não declarou necessidade de alimentação.";
          setResult({ ok: false, message: msg, source: "qr" });
          toast.error(msg);
          recordOutcome("error");
          void recordIncident("NEEDS_MEALS_FALSE", resolved.participant_id);
          return;
        }

        if (!partData.credentialed_at) {
          const msg = "Participante não possui credencial ativa (Aguardando Credenciamento)";
          setResult({ ok: false, message: msg, source: "qr" });
          toast.error(msg, { description: "Encaminhe o atleta para a secretaria." });
          recordOutcome("error");
          void recordIncident("NO_CREDENTIAL", resolved.participant_id);
          return;
        }

        const winForQr = windows.find((w) => w.id === windowId);
        if (leftEventBlocksWindow(partData.left_event_at, winForQr?.service_date)) {
          const msg = "Participante registrou saída antecipada do evento.";
          setResult({ ok: false, message: msg, source: "qr" });
          toast.error(msg);
          recordOutcome("error");
          void recordIncident("LEFT_EVENT", resolved.participant_id);
          return;
        }

        // Busca restrições alimentares para exibição no resultado.
        let qrFoodRestrictions: string | null = null;
        if (partData.person_id) {
          const { data: personData } = await (supabase as any)
            .from("people")
            .select("food_restrictions")
            .eq("id", partData.person_id)
            .maybeSingle();
          qrFoodRestrictions = personData?.food_restrictions ?? null;
        }

        participantId = resolved.participant_id;
        participantName = resolved.full_name;
        method = "qr_scan";
        foodRestrictions = qrFoodRestrictions;
      }

      if (!participantId) {
        setResult({ ok: false, message: getSystemMessage("ERR_UNKNOWN", lang), source: "qr" });
        recordOutcome("error");
        return;
      }

      await registerMealConsumption(participantId, participantName, method, "qr", foodRestrictions);
    } catch (err: unknown) {
      setResult({ ok: false, message: `${getSystemMessage("ERR_UNKNOWN", lang)}: ${getErrorMessage(err)}` });
      recordOutcome("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  type EligibilityReason = "INACTIVE" | "NEEDS_MEALS_FALSE" | "NO_CREDENTIAL" | "LEFT_EVENT";

  // Avalia presença/elegibilidade do participante para refeição.
  // Mantém paridade com a trava aplicada no fluxo de QR (handleScan).
  const evaluateMealEligibility = (
    row: Pick<ParticipantManualSearchRow, "is_active" | "needs_meals" | "credentialed_at" | "left_event_at">,
    serviceDate?: string,
  ): { ok: true } | { ok: false; reason: EligibilityReason; message: string } => {
    if (row.is_active === false) {
      return { ok: false, reason: "INACTIVE", message: "Participante Inativo." };
    }
    if (row.needs_meals === false) {
      return {
        ok: false,
        reason: "NEEDS_MEALS_FALSE",
        message: "Participante não declarou necessidade de alimentação.",
      };
    }
    if (!row.credentialed_at) {
      return {
        ok: false,
        reason: "NO_CREDENTIAL",
        message: "Participante não possui credencial ativa (Aguardando Credenciamento).",
      };
    }
    if (leftEventBlocksWindow(row.left_event_at, serviceDate)) {
      return {
        ok: false,
        reason: "LEFT_EVENT",
        message: "Participante registrou saída antecipada do evento.",
      };
    }
    return { ok: true };
  };

  const incidentTypeFor = (reason: EligibilityReason): string => {
    switch (reason) {
      case "INACTIVE":
        return "PARTICIPANT_INACTIVE";
      case "NEEDS_MEALS_FALSE":
        return "NEEDS_MEALS_FALSE";
      case "NO_CREDENTIAL":
        return "NO_CREDENTIAL";
      case "LEFT_EVENT":
        return "LEFT_EVENT";
    }
  };

  const handleManualPick = async (row: ParticipantManualSearchRow) => {
    if (isSubmitting) return;
    setManualQuery("");
    setManualHits([]);
    setIsSubmitting(true);
    try {
      // Trava de presença aplicada também no caminho manual (Etapa 0/1/2 da
      // auditoria de Alimentação). Sem isso, o operador conseguia inserir
      // consumo para qualquer pessoa do evento via busca por nome/CPF.
      const win = windows.find((w) => w.id === windowId);
      const verdict = evaluateMealEligibility(row, win?.service_date);
      if (!verdict.ok) {
        setResult({ ok: false, message: (verdict as any).message, source: "manual" });
        toast.error((verdict as any).message, {
          description: (verdict as any).reason === "NO_CREDENTIAL" ? "Encaminhe para a secretaria." : undefined,
        });
        recordOutcome("error");
        // Etapa 1: o enum meal_incident_type foi estendido com os motivos
        // específicos abaixo, então a trilha distingue cada situação.
        void recordIncident(incidentTypeFor((verdict as any).reason), row.participant_id);
        return;
      }
      await registerMealConsumption(row.participant_id, row.full_name, "manual", "manual", null);
    } catch (err: unknown) {
      setResult({ ok: false, message: `${getSystemMessage("ERR_UNKNOWN", lang)}: ${getErrorMessage(err)}` });
      recordOutcome("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PwaLayout backTo="/pwa/alimentacao" moduleTitle={getSystemMessage("SCAN_QR", lang)}>
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-25" />

      <main className="relative mx-auto max-w-md space-y-4 p-4">
        <OfflineSyncStatus />
        <VoucherConflictCentral />

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
                  {w.meal_type?.name || "Refeição"} — {w.start_time.slice(0, 5)}–{w.end_time.slice(0, 5)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {windowId && (
          <div className="rounded-lg border border-border/50 bg-card/50 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium uppercase tracking-wider">Consumos nesta janela:</span>{" "}
            <span className="text-sm font-bold text-foreground">{consumptionCount}</span>
          </div>
        )}

        <Button
          variant="module"
          className="h-12 w-full rounded-xl text-base font-semibold shadow-app-md"
          onClick={() => setScannerOpen(true)}
          disabled={isSubmitting || !windowId}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processando…
            </>
          ) : (
            <>
              <ScanLine className="mr-2 h-5 w-5" />
              Escanear QR Code
            </>
          )}
        </Button>

        <div className="space-y-2">
          <p className="text-center text-xs text-muted-foreground">ou buscar manualmente</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Nome, CPF ou código do voucher…"
              value={manualQuery}
              onChange={(e) => setManualQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && manualQuery.length >= 8) {
                  handleScan(manualQuery);
                }
              }}
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
                  manualHits.map((h) => {
                    const winForBadge = windows.find((w) => w.id === windowId);
                    const verdict = evaluateMealEligibility(h, winForBadge?.service_date);
                    const badgeLabel = !verdict.ok
                      ? (verdict as any).reason === "NO_CREDENTIAL"
                        ? "sem credencial"
                        : (verdict as any).reason === "NEEDS_MEALS_FALSE"
                          ? "não precisa alim."
                          : (verdict as any).reason === "LEFT_EVENT"
                            ? "saiu do evento"
                            : "inativo"
                      : null;
                    return (
                      <button
                        key={h.participant_id}
                        type="button"
                        onClick={() => void handleManualPick(h)}
                        disabled={isSubmitting}
                        className="flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left last:border-0 hover:bg-muted/40 active:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--module-accent)/0.18)] text-[hsl(var(--module-accent))]">
                          <User className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{h.full_name}</p>
                          <p className="truncate text-xs text-muted-foreground">{h.participant_type}</p>
                        </div>
                        {badgeLabel && (
                          <span className="ml-2 shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                            {badgeLabel}
                          </span>
                        )}
                      </button>
                    );
                  })}
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
                    {result.source === "manual" ? getSystemMessage("MANUAL_SEARCH", lang) : getSystemMessage("QR_VALID", lang)}
                  </p>
                )}
                <span className="text-sm font-medium leading-snug">{result.message}</span>
                {result.restrictions && (
                  <p className="mt-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase">
                    Restrição: {result.restrictions}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      <QrCodeScanner
  isOpen={scannerOpen}
  onClose={() => setScannerOpen(false)}
  onScan={handleScan}
  continuous={prefs.continuousMode}
  title="Escanear QR"
/>
    </PwaLayout>
  );
}
