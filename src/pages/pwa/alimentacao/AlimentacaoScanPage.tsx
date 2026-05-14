import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  ScanLine,
  CheckCircle,
  XCircle,
  Search,
  Loader2,
  User,
  UserPlus,
  ChevronsUpDown,
  Lock,
  ListChecks,
  Settings2,
  Layers,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import QrCodeScanner from "@/components/pwa/QrCodeScanner";
import { resolveQrCredential } from "@/lib/resolveQrCredential";
import {
  searchParticipantsByNameOrCpf,
  type ParticipantManualSearchRow,
} from "@/lib/participantManualSearch";
import { useEventContext } from "@/contexts/EventContext";
import { useActiveStageId, useStageContext } from "@/contexts/StageContext";
import { isStageOpenToday, isWindowNearNow } from "@/lib/stageDateUtils";
import { isVoucherQr, tryRedeemVoucher } from "@/lib/voucherScan";
import { voucherErrorMessage, voucherSuccessMessage } from "@/lib/voucherMessages";
import { getSystemMessage, getPwaLang } from "@/lib/systemMessages";
import { useAuth } from "@/hooks/useAuth";
import {
  loadScanPreferences,
  saveScanPreferences,
  loadScanTelemetry,
  bumpScanTelemetry,
  type ScanPreferences,
  type ScanTelemetry,
} from "@/lib/pwaScan";
import { usePwaAudit } from "@/hooks/usePwaAudit";
import PwaLayout from "@/components/pwa/PwaLayout";
import { addToOfflineQueue, isOnline } from "@/lib/offlineQueue";
import { addToVoucherQueue } from "@/lib/voucherOffline";
import { enqueueIncident } from "@/lib/incidentOffline";
import { readMealWindowsCache, writeMealWindowsCache } from "@/lib/mealWindowsCache";
import { useTodayString } from "@/hooks/useTodayString";
import { dayRangeRoraima } from "@/lib/dayRangeRoraima";
import { VoucherConflictCentral } from "@/components/pwa/VoucherConflictCentral";
import { JanelaSheet, type JanelaStatus } from "@/components/pwa/alimentacao/JanelaSheet";
import { cn } from "@/lib/utils";

interface MealWindow {
  id: string;
  meal_type: { name: string } | null;
  meal_locations?: { name: string } | null;
  service_date: string;
  start_time: string;
  end_time: string;
  location?: string | null;
  label?: string | null;
}

function getWindowLocal(w: MealWindow | null | undefined) {
  if (!w) return "Local não informado";

  return (
    w.meal_locations?.name ||
    w.location ||
    w.label ||
    "Local não informado"
  );
}

function leftEventBlocksWindow(
  leftEventAt: string | null | undefined,
  serviceDate: string | undefined,
): boolean {
  if (!leftEventAt || !serviceDate) return false;
  const leftDate = leftEventAt.slice(0, 10);
  return serviceDate >= leftDate;
}

function statusForWindow(w: MealWindow, now: Date): JanelaStatus {
  const start = new Date(`${w.service_date}T${w.start_time}`);
  const end = new Date(`${w.service_date}T${w.end_time}`);
  if (now < start) return "futura";
  if (now > end) return "encerrada";
  return "ativa";
}

const STATUS_HEADER: Record<
  JanelaStatus,
  { label: string; dot: string; ring: string; text: string }
> = {
  ativa: {
    label: "ATIVA · JANELA SELECIONADA",
    dot: "bg-green-500",
    ring: "ring-green-500/40 border-green-600/60",
    text: "text-green-400",
  },
  encerrada: {
    label: "ENCERRADA · JANELA SELECIONADA",
    dot: "bg-zinc-500",
    ring: "ring-zinc-500/40 border-zinc-600/60",
    text: "text-zinc-400",
  },
  futura: {
    label: "AGUARDANDO · JANELA SELECIONADA",
    dot: "bg-blue-500",
    ring: "ring-blue-500/40 border-blue-600/60",
    text: "text-blue-400",
  },
};

const MODULE = "alimentacao" as const;

export default function AlimentacaoScanPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const preselectedWindowId = (location.state as any)?.windowId as string | undefined;

  const { user } = useAuth();
  const { activeEventId } = useEventContext();
  const { activeStage, stages, setActiveStageId } = useStageContext();

  usePwaAudit("alimentacao/escanear", activeEventId);

  const stageId = useActiveStageId();
  const userId = user?.id ?? null;
  const lang = getPwaLang();
  const today = useTodayString();

  const [windows, setWindows] = useState<MealWindow[]>([]);
  const [windowId, setWindowId] = useState(preselectedWindowId ?? "");
  const [consumptionCount, setConsumptionCount] = useState(0);
  const [totalToday, setTotalToday] = useState(0);
  const [myConsumptionCount, setMyConsumptionCount] = useState(0);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [janelaSheetOpen, setJanelaSheetOpen] = useState(false);
  const [online, setOnline] = useState(isOnline());

  const [prefs, setPrefs] = useState<ScanPreferences>(() =>
    loadScanPreferences(MODULE, userId),
  );

  const [telemetry, setTelemetry] = useState<ScanTelemetry>(() =>
    loadScanTelemetry(MODULE, userId),
  );

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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notFoundQr, setNotFoundQr] = useState<string | null>(null);

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    setPrefs(loadScanPreferences(MODULE, userId));
    setTelemetry(loadScanTelemetry(MODULE, userId));
  }, [userId]);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

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
      const cached = readMealWindowsCache<any>(activeEventId, stageId);

      if (cached?.windows?.length) {
        const todaysWindows = cached.windows.filter(
          (w: any) => w.service_date === today,
        );

        if (todaysWindows.length > 0) {
          setWindows(todaysWindows as MealWindow[]);
        }
      }

      let q = supabase
        .from("meal_windows")
        .select(`
          id,
          label,
          location,
          meal_type:meal_types(name),
          meal_locations(name),
          service_date,
          start_time,
          end_time
        `)
        .eq("service_date", today)
        .eq("event_id", activeEventId)
        .order("start_time");

      if (stageId) q = q.eq("event_stage_id", stageId);

      const { data } = await q;
      const list = (data ?? []) as unknown as MealWindow[];

      setWindows(list);
      if (list.length > 0) writeMealWindowsCache(activeEventId, stageId, list);
    })();
  }, [activeEventId, stageId, today]);

  useEffect(() => {
    if (windowId) {
      const stillExists = windows.some((w) => w.id === windowId);
      if (stillExists) return;
    }

    const source = visibleWindows.length > 0 ? visibleWindows : windows;
    if (source.length === 0) return;

    const ativa = source.find((w) => statusForWindow(w, now) === "ativa");
    setWindowId((ativa ?? source[0]).id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windows]);

  useEffect(() => {
    if (!windowId) {
      setConsumptionCount(0);
      return;
    }

    const fetchCount = async () => {
      const { count } = await supabase
        .from("meal_consumptions")
        .select("*", { count: "exact", head: true })
        .eq("meal_window_id", windowId);

      setConsumptionCount(count || 0);
    };

    void fetchCount();

    const channel = supabase
      .channel(`meal_consumptions_${windowId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "meal_consumptions",
          filter: `meal_window_id=eq.${windowId}`,
        },
        () => {
          void fetchCount();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [windowId]);

  useEffect(() => {
    if (!activeEventId) return;

    let cancelled = false;

    (async () => {
      const { startIso, endIsoExclusive } = dayRangeRoraima(today);

      let consumoQ = supabase
        .from("meal_consumptions")
        .select("id, meal_windows!meal_window_id!inner(event_id, event_stage_id)", {
          count: "exact",
          head: true,
        })
        .eq("meal_windows.event_id", activeEventId)
        .gte("consumed_at", startIso)
        .lt("consumed_at", endIsoExclusive);

      if (stageId) consumoQ = consumoQ.eq("meal_windows.event_stage_id", stageId);

      const { count } = await consumoQ;
      if (!cancelled) setTotalToday(count || 0);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeEventId, stageId, today, consumptionCount]);

  useEffect(() => {
    if (!userId || !activeEventId) {
      setMyConsumptionCount(0);
      return;
    }

    let cancelled = false;

    (async () => {
      const { startIso, endIsoExclusive } = dayRangeRoraima(today);

      let q = supabase
        .from("meal_consumptions")
        .select("id, meal_windows!meal_window_id!inner(event_id, event_stage_id)", {
          count: "exact",
          head: true,
        })
        .eq("registered_by", userId)
        .eq("meal_windows.event_id", activeEventId)
        .gte("consumed_at", startIso)
        .lt("consumed_at", endIsoExclusive);

      if (stageId) q = q.eq("meal_windows.event_stage_id", stageId);

      const { count } = await q;
      if (!cancelled) setMyConsumptionCount(count || 0);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, activeEventId, stageId, today, consumptionCount, totalToday]);

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

  const recordIncident = useCallback(
    async (type: string, participantId?: string) => {
      if (!windowId) return;

      const deviceInfo = {
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        platform: typeof navigator !== "undefined" ? navigator.platform : null,
        online: isOnline(),
      };

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
        const {
          data: { session },
        } = await supabase.auth.getSession();

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
        enqueueIncident({
          meal_window_id: windowId,
          incident_type: type,
          participant_id: participantId || null,
          device_info: { ...deviceInfo, fallback_from: "online_insert_failed" },
        });

        console.error("Failed to record meal incident, enqueued offline:", err);
      }
    },
    [windowId],
  );

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

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user.id) {
      setResult({
        ok: false,
        message: getSystemMessage("ERR_SESSION_EXPIRED", lang),
      });
      setNotFoundQr(null);
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
      const enqueueResult = addToOfflineQueue(
        "alimentacao",
        consumptionData,
        participantName || undefined,
      );

      if (enqueueResult.deduped) {
        const dedupMsg = `Já existe registro offline pendente para ${
          participantName || "este participante"
        } nesta janela.`;

        setResult({ ok: false, message: dedupMsg, source: resultSource });
        setNotFoundQr(null);

        toast.info(dedupMsg, {
          description: "Aguarde a sincronização para evitar duplicidade.",
        });

        recordOutcome("error");
        reopenIfContinuous();
        return;
      }

      const successMsg = `${getSystemMessage("SUCCESS_REGISTERED", lang)} (Offline): ${
        participantName || ""
      }`;

      setResult({
        ok: true,
        source: resultSource,
        message: successMsg,
        restrictions: foodRestrictions || undefined,
      });

      setNotFoundQr(null);

      toast.info("Registrado offline. Sincronize quando houver internet.");
      recordOutcome("ok");

      if (navigator.vibrate) navigator.vibrate(200);

      reopenIfContinuous();
      return;
    }

    if (stageId) {
      const { data: enrolled } = await supabase
        .from("participant_event_stages")
        .select("id")
        .eq("participant_id", participantId)
        .eq("event_stage_id", stageId)
        .eq("status", "active")
        .maybeSingle();

      if (!enrolled) {
        const msg = "Participante não está inscrito nesta etapa.";
        setResult({ ok: false, message: msg, source: resultSource });
        setNotFoundQr(null);
        toast.error(msg);
        recordOutcome("error");
        reopenIfContinuous();
        return;
      }
    }

    const { data: rpcResult, error: rpcError } = await supabase.rpc("record_meal_consumption", {
      p_participant_id: participantId,
      p_meal_window_id: windowId,
      p_method: method,
      p_registered_by: session.user.id,
    });

    if (rpcError) {
      void recordIncident("OTHER", participantId);
      throw rpcError;
    }

    const res = rpcResult as { ok: boolean; reason?: string };

    if (!res.ok) {
      let msg: string;
      let incidentType: "DUPLICATE" | "OTHER" = "OTHER";

      switch (res.reason) {
        case "ALREADY_REGISTERED":
          msg = getSystemMessage("ERR_ALREADY_REGISTERED", lang);
          incidentType = "DUPLICATE";
          break;
        case "WINDOW_NOT_FOUND":
          msg = "Janela de refeição não encontrada ou inativa.";
          break;
        case "WINDOW_WRONG_DATE":
          msg = "Esta janela não pertence ao dia de hoje.";
          break;
        case "WINDOW_CLOSED":
          msg = "Fora do horário desta janela de refeição.";
          break;
        case "NOT_ELIGIBLE":
          msg = "Participante sem direito a esta refeição (restrição de elegibilidade).";
          break;
        case "NOT_ENROLLED_IN_STAGE":
          msg = "Participante não está inscrito nesta etapa.";
          break;
        default:
          msg = "Não foi possível registrar o consumo. Tente novamente.";
      }

      setResult({ ok: false, message: msg, source: resultSource });
      setNotFoundQr(null);
      toast.error(msg);
      recordOutcome("error");
      void recordIncident(incidentType, participantId);
      reopenIfContinuous();
      return;
    }

    const prefix =
      method === "voucher"
        ? "Voucher · "
        : method === "manual"
          ? `${getSystemMessage("MANUAL_SEARCH", lang)} · `
          : "";

    const successMsg = `${prefix}${getSystemMessage("SUCCESS_REGISTERED", lang)}: ${
      participantName || ""
    }`;

    setResult({
      ok: true,
      source: resultSource,
      message: successMsg,
      restrictions: foodRestrictions || undefined,
    });

    setNotFoundQr(null);

    toast.success(successMsg);
    recordOutcome("ok");

    if (navigator.vibrate) navigator.vibrate(200);

    reopenIfContinuous();
  }

  const handleScan = async (rawValue: string) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setScannerOpen(false);

    let val = rawValue.trim();
    if (!val) {
      setIsSubmitting(false);
      return;
    }

    if (
      !val.toLowerCase().startsWith("voucher:") &&
      val.length === 6 &&
      /^[A-Z0-9]+$/i.test(val)
    ) {
      val = `voucher:${val.toUpperCase()}`;
    }

    if (!windowId) {
      toast.error(getSystemMessage("ERR_WINDOW_REQUIRED", lang));
      setIsSubmitting(false);
      return;
    }

    try {
      let participantId: string | null = null;
      let participantName: string | null = null;
      const foodRestrictions: string | null = null;
      let method: "qr_scan" | "voucher" = "qr_scan";

      if (isVoucherQr(val)) {
        setNotFoundQr(null);

        if (!isOnline()) {
          addToVoucherQueue(val, "meals", windowId, userId || "", "Portador de Voucher");

          const successMsg = `Voucher registrado offline: ${val.replace("voucher:", "")}`;

          setResult({
            ok: true,
            source: "qr",
            message: successMsg,
            is_offline: true,
            offline_at: new Date().toISOString(),
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

          if (voucher?.reason === "already_used_here" && voucher.used_at) {
            extra = ` em ${format(new Date(voucher.used_at), "HH:mm")}`;
            if (voucher.operator_name) extra += ` por ${voucher.operator_name}`;
          }

          setResult({ ok: false, message: `${msg.text}${extra}`, source: "qr" });
          setNotFoundQr(null);

          toast.error(`${msg.text}${extra}`);
          recordOutcome("error");

          let incType = "VOUCHER_INVALID";

          if (voucher?.reason === "already_used_here" || voucher?.reason === "already_used") {
            incType = "VOUCHER_ALREADY_USED";
          } else if (voucher?.reason === "expired") {
            incType = "VOUCHER_EXPIRED";
          } else if (voucher?.reason === "inactive") {
            incType = "VOUCHER_REVOKED";
          }

          void recordIncident(incType);
          reopenIfContinuous();
          return;
        }

        const msg = voucherSuccessMessage(voucher, "meals", lang);

        setResult({
          ok: true,
          source: "qr",
          message: msg.text,
          full_name: voucher.person_name || "Portador de Voucher",
        } as any);

        setNotFoundQr(null);

        toast.success(msg.text);
        recordOutcome("ok");

        if (navigator.vibrate) navigator.vibrate(200);

        reopenIfContinuous();
        return;
      }

      const resolved = await resolveQrCredential(val, { eventId: activeEventId });

      if (!resolved) {
        const errorMsg = getSystemMessage("ERR_NOT_FOUND", lang);

        setNotFoundQr(val);

        setResult({
          ok: false,
          message: `${errorMsg} Código lido: ${val}`,
          source: "qr",
        });

        toast.error(errorMsg);
        recordOutcome("error");
        void recordIncident("OTHER");
        return;
      }

      setNotFoundQr(null);

      const { data: partData, error: partError } = await (supabase as any)
        .from("participants")
        .select("status, is_active, credentialed_at, needs_meals, left_event_at")
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

      participantId = resolved.participant_id;
      participantName = resolved.full_name;
      method = "qr_scan";

      if (!participantId) {
        setResult({
          ok: false,
          message: getSystemMessage("ERR_UNKNOWN", lang),
          source: "qr",
        });
        setNotFoundQr(null);
        recordOutcome("error");
        return;
      }

      await registerMealConsumption(
        participantId,
        participantName,
        method,
        "qr",
        foodRestrictions,
      );
    } catch (err: unknown) {
      setResult({
        ok: false,
        message: `${getSystemMessage("ERR_UNKNOWN", lang)}: ${getErrorMessage(err)}`,
      });

      setNotFoundQr(null);
      recordOutcome("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  type EligibilityReason = "INACTIVE" | "NEEDS_MEALS_FALSE" | "NO_CREDENTIAL" | "LEFT_EVENT";

  const evaluateMealEligibility = (
    row: Pick<
      ParticipantManualSearchRow,
      "is_active" | "needs_meals" | "credentialed_at" | "left_event_at"
    >,
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
    setNotFoundQr(null);
    setIsSubmitting(true);

    try {
      const win = windows.find((w) => w.id === windowId);
      const verdict = evaluateMealEligibility(row, win?.service_date);

      if (!verdict.ok) {
        setResult({
          ok: false,
          message: (verdict as any).message,
          source: "manual",
        });

        toast.error((verdict as any).message, {
          description:
            (verdict as any).reason === "NO_CREDENTIAL"
              ? "Encaminhe para a secretaria."
              : undefined,
        });

        recordOutcome("error");
        void recordIncident(incidentTypeFor((verdict as any).reason), row.participant_id);
        return;
      }

      await registerMealConsumption(row.participant_id, row.full_name, "manual", "manual", null);
    } catch (err: unknown) {
      setResult({
        ok: false,
        message: `${getSystemMessage("ERR_UNKNOWN", lang)}: ${getErrorMessage(err)}`,
      });

      recordOutcome("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const stagesOpenToday = useMemo(
    () => stages.filter((s) => isStageOpenToday(s)),
    [stages],
  );

  const visibleWindows = useMemo(() => {
    const near = windows.filter((w) =>
      isWindowNearNow(w.start_time, w.end_time, w.service_date),
    );
    return near.length > 0 ? near : windows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windows]);

  const currentWindow = useMemo(
    () => windows.find((w) => w.id === windowId) ?? null,
    [windows, windowId],
  );

  const currentStatus: JanelaStatus | null = currentWindow
    ? statusForWindow(currentWindow, now)
    : null;

  const isJanelaAtiva = currentStatus === "ativa";

  const janelaSheetItems = useMemo(
  () =>
    visibleWindows.map((w) => ({
      id: w.id,

      nome: w.meal_type?.name || "Refeição",

      local:
        w.label ||
        w.meal_locations?.name ||
        w.location ||
        "Local não informado",

      inicio: w.start_time.slice(0, 5),

      fim: w.end_time.slice(0, 5),

      status: statusForWindow(w, now),
    })),
  [visibleWindows, now],
);

  const hiddenWindowCount = windows.length - visibleWindows.length;

  return (
    <PwaLayout
      backTo="/pwa/alimentacao/scan"
      moduleTitle={getSystemMessage("SCAN_QR", lang)}
    >
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-25" />

      <main className="relative mx-auto max-w-md space-y-3 p-3">
        <VoucherConflictCentral />

        {!activeStage && stagesOpenToday.length > 0 && (
          <div className="rounded-2xl border-2 border-amber-500/50 bg-amber-500/10 p-4 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                <Layers className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-extrabold uppercase tracking-tight text-amber-800 dark:text-amber-400">
                  Selecione sua Etapa
                </p>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-500/80">
                  {stagesOpenToday.length > 1
                    ? `${stagesOpenToday.length} etapas abertas hoje — qual é o seu local?`
                    : "Confirme a etapa de trabalho para começar."}
                </p>
              </div>
            </div>
            <div className="grid gap-2">
              {stagesOpenToday.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveStageId(s.id)}
                  className="w-full rounded-xl border border-amber-500/40 bg-white/70 dark:bg-amber-900/20 px-4 py-3 text-left flex items-center justify-between active:scale-[0.98] transition-all"
                >
                  <span className="font-bold text-sm text-foreground">{s.name}</span>
                  <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    Trabalhar aqui →
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {windows.length === 0 ? (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-center space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Sem janela de refeição para {today}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {activeStage
                ? "Cadastre janelas para esta etapa no painel administrativo."
                : "Selecione uma etapa para listar as janelas."}
            </p>
            <button
              type="button"
              onClick={() => navigate("/pwa/alimentacao/janelas")}
              className="mt-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 underline underline-offset-2"
            >
              Ver todas as janelas da etapa →
            </button>
          </div>
        ) : currentWindow && currentStatus ? (
          <button
            type="button"
            onClick={() => setJanelaSheetOpen(true)}
            className={cn(
              "w-full flex items-center gap-3 rounded-2xl border-2 bg-card/60 px-4 py-3 text-left transition-all active:scale-[0.99] ring-1",
              STATUS_HEADER[currentStatus].ring,
            )}
          >
            <span
              className={cn(
                "relative inline-flex h-3 w-3 shrink-0 rounded-full",
                STATUS_HEADER[currentStatus].dot,
              )}
            >
              {currentStatus === "ativa" && (
                <span className="absolute inset-0 inline-flex animate-ping rounded-full bg-green-500/60" />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-[10px] font-black uppercase tracking-[0.18em]",
                  STATUS_HEADER[currentStatus].text,
                )}
              >
                {STATUS_HEADER[currentStatus].label}
              </p>
              <p className="mt-0.5 truncate text-base font-extrabold text-foreground">
                {currentWindow.meal_type?.name || "Refeição"} — {getWindowLocal(currentWindow)}
              </p>
              <p className="mt-0.5 text-xs font-mono font-semibold text-muted-foreground">
                {currentWindow.start_time.slice(0, 5)}–
                {currentWindow.end_time.slice(0, 5)}
              </p>
            </div>

            <span className="shrink-0 inline-flex items-center gap-1 rounded-md border border-border/70 bg-background/40 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Trocar
              <ChevronsUpDown className="h-3 w-3" />
            </span>
          </button>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <KpiCard label="Meus Registros" value={myConsumptionCount} tone="blue" large />
          <KpiCard label="Total Geral" value={totalToday} tone="default" large />
        </div>

        <div className="grid grid-cols-4 gap-2">
          <KpiCard label="Janela" value={consumptionCount} tone="blue" />
          <KpiCard label="Hoje" value={totalToday} tone="default" />
          <KpiCard label="OK" value={telemetry.ok} tone="green" />
          <KpiCard
            label="Erro"
            value={telemetry.error}
            tone={telemetry.error > 0 ? "red" : "muted"}
          />
        </div>

        {!scannerOpen && (
          <button
            type="button"
            onClick={() => isJanelaAtiva && setScannerOpen(true)}
            disabled={!isJanelaAtiva || isSubmitting}
            className={cn(
              "w-full rounded-2xl px-4 py-4 text-left transition-all flex items-center gap-3 shadow-app-md",
              isJanelaAtiva
                ? "bg-module text-white hover:brightness-110 active:scale-[0.98]"
                : "bg-zinc-800/60 text-zinc-400 cursor-not-allowed opacity-70",
            )}
          >
            <div
              className={cn(
                "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
                isJanelaAtiva ? "bg-white/20" : "bg-zinc-700/50",
              )}
            >
              {isSubmitting ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : isJanelaAtiva ? (
                <ScanLine className="h-6 w-6" />
              ) : (
                <Lock className="h-6 w-6" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-extrabold leading-tight">
                {isSubmitting
                  ? "Processando…"
                  : isJanelaAtiva
                    ? "Escanear QR Code"
                    : "Janela não disponível"}
              </p>
              <p className="text-[11px] font-medium opacity-80 truncate">
                {isJanelaAtiva
                  ? `${currentWindow?.meal_type?.name || "Refeição"} · ${getWindowLocal(
                      currentWindow,
                    )}`
                  : currentStatus === "futura"
                    ? "Aguardando início da janela"
                    : currentStatus === "encerrada"
                      ? "Janela encerrada"
                      : "Selecione uma janela"}
              </p>
            </div>
          </button>
        )}

        {scannerOpen && (
          <QrCodeScanner
            isOpen={scannerOpen}
            onClose={() => setScannerOpen(false)}
            onScan={handleScan}
            continuous={prefs.continuousMode}
            title="Escanear QR"
            variant="inline"
          />
        )}

        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Nome, CPF ou código do voucher…"
              value={manualQuery}
              onChange={(e) => setManualQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && manualQuery.length >= 8) {
                  handleScan(manualQuery);
                }
              }}
              className="h-11 border-border/80 bg-card/90 pl-10"
            />
          </div>

          {!activeEventId && (
            <p className="text-center text-[11px] text-amber-600 dark:text-amber-400">
              Selecione o evento ativo para habilitar a busca.
            </p>
          )}

          {activeEventId && debouncedManual.length >= 2 && (
            <Card className="max-h-44 overflow-y-auto border-border/80 bg-card/95 shadow-app-sm">
              <CardContent className="p-0">
                {manualSearching && (
                  <div className="flex items-center justify-center gap-2 py-5 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">Buscando…</span>
                  </div>
                )}

                {!manualSearching && manualHits.length === 0 && (
                  <p className="px-4 py-5 text-center text-sm text-muted-foreground">
                    Nenhum participante encontrado neste evento.
                  </p>
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
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--module-accent)/0.18)] text-[hsl(var(--module-accent))]">
                          <User className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {h.full_name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {h.participant_type}
                          </p>
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
          <div
            className={cn(
              "flex items-start gap-2 rounded-2xl border px-3 py-2",
              result.ok
                ? "border-blue-500/40 bg-blue-500/5"
                : "border-destructive/40 bg-destructive/5",
            )}
          >
            {result.ok ? (
              <CheckCircle className="h-5 w-5 shrink-0 text-blue-500" />
            ) : (
              <XCircle className="h-5 w-5 shrink-0 text-destructive" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium leading-snug">{result.message}</p>
              {result.restrictions && (
                <p className="mt-0.5 text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">
                  Restrição: {result.restrictions}
                </p>
              )}
              {!result.ok && notFoundQr && (
                <Button
                  type="button"
                  size="sm"
                  className="mt-2 h-8 w-full gap-2 text-xs"
                  variant="module"
                  onClick={() =>
                    navigate("/pwa/credenciamento/vincular", {
                      state: {
                        qrCode: notFoundQr,
                        origem: "alimentacao",
                        motivo: "QR não encontrado na leitura da alimentação",
                      },
                    })
                  }
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Cadastrar / vincular substituto
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => navigate("/pwa/alimentacao/consumos")}
            className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/60 px-3 py-2.5 text-left active:scale-[0.98] transition-transform"
          >
            <ListChecks className="h-4 w-4 text-module shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-bold leading-tight truncate">Lista consumos</p>
              <p className="text-[10px] text-muted-foreground">Histórico do dia</p>
            </div>
          </button>

          <label className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/60 px-3 py-2.5 cursor-pointer">
            <Settings2 className="h-4 w-4 text-module shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold leading-tight truncate">Modo contínuo</p>
              <p className="text-[10px] text-muted-foreground">
                {prefs.continuousMode ? "Reabre câmera após scan" : "Desligado"}
              </p>
            </div>
            <Switch
              checked={prefs.continuousMode}
              onCheckedChange={(v) => updatePrefs({ ...prefs, continuousMode: v })}
              aria-label="Modo contínuo"
            />
          </label>
        </div>

        <SyncStatusLine online={online} />
      </main>

      <JanelaSheet
        open={janelaSheetOpen}
        onOpenChange={setJanelaSheetOpen}
        janelas={janelaSheetItems}
        selectedId={windowId}
        onSelect={setWindowId}
        hiddenCount={hiddenWindowCount}
      />
    </PwaLayout>
  );
}

function KpiCard({
  label,
  value,
  tone,
  large,
}: {
  label: string;
  value: number;
  tone: "default" | "blue" | "green" | "red" | "muted";
  large?: boolean;
}) {
  const valueClass = {
    default: "text-foreground",
    blue: "text-blue-400",
    green: "text-green-400",
    red: "text-red-400",
    muted: "text-zinc-500",
  }[tone];

  return (
    <div
      className={cn(
        "rounded-xl border border-border/70 bg-card/60 text-center",
        large ? "px-3 py-3" : "px-2 py-2",
      )}
    >
      <p
        className={cn(
          "font-bold uppercase tracking-wider text-muted-foreground",
          large ? "text-[10px]" : "text-[9px]",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 font-extrabold tabular-nums leading-none",
          large ? "text-3xl" : "text-2xl",
          valueClass,
        )}
      >
        {value}
      </p>
    </div>
  );
}

function SyncStatusLine({ online }: { online: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-xl border px-3 py-1.5",
        online
          ? "bg-green-950/30 border-green-900/40"
          : "bg-amber-950/30 border-amber-900/40",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full animate-pulse",
            online ? "bg-green-400" : "bg-amber-400",
          )}
        />
        <span
          className={cn(
            "text-[11px] font-semibold",
            online ? "text-green-400" : "text-amber-400",
          )}
        >
          {online ? "Sistema online · Sync ativo" : "Offline · dados em fila"}
        </span>
      </div>
      <BuildVersionTag />
    </div>
  );
}

function BuildVersionTag() {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/version.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.appVersion) setVersion(`v${d.appVersion}`);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  if (!version) return null;

  return <span className="text-[10px] font-mono text-zinc-500">{version}</span>;
}
