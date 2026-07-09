import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  ScanLine,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Search,
  Loader2,
  User,
  ChevronsUpDown,
  Lock,
  ListChecks,
  Settings2,
  Layers,
  Package,
  Usb,
  X,
} from "lucide-react";
import { toast } from "sonner";
import QrCodeScanner from "@/components/pwa/QrCodeScanner";
import { resolveQrCredential } from "@/lib/resolveQrCredential";
import {
  searchParticipantsByNameOrCpf,
  type ParticipantManualSearchRow,
} from "@/lib/participantManualSearch";
import { useEventContext } from "@/contexts/EventContext";
import { useActiveStageId, useStageContext } from "@/contexts/StageContext";
import { isVoucherQr } from "@/lib/voucherScan";
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
import { useParticipantStatusCache } from "@/hooks/pwa/useParticipantStatusCache";
import { addToOfflineQueue, isOnline } from "@/lib/offlineQueue";
import { cn } from "@/lib/utils";

interface MaterialKit {
  id: string;
  name: string;
  description: string | null;
}

const MODULE = "material" as const;

/**
 * Internet "capenga" (navigator.onLine=true mas a requisição trava/falha) não
 * pode deixar a chamada pendurada indefinidamente — sem prazo, o operador
 * acaba recarregando a página no meio do envio e o registro se perde sem
 * nunca cair na fila offline. Após o timeout, a chamada original pode ainda
 * completar em segundo plano; isso é seguro porque tanto o INSERT nativo
 * (ON CONFLICT DO NOTHING) quanto o retry via fila offline são idempotentes.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("TIMEOUT_REDE")), ms),
    ),
  ]);
}

const RPC_TIMEOUT_MS = 8000;

export default function MaterialScanPage() {
  const navigate = useNavigate();

  const { user } = useAuth();
  const { activeEventId } = useEventContext();
  const { activeStage, stages, setActiveStageId } = useStageContext();

  usePwaAudit("material/escanear", activeEventId);

  const stageId = useActiveStageId();
  const userId = user?.id ?? null;

  const usbInputRef = useRef<HTMLInputElement>(null);

  const [kits, setKits] = useState<MaterialKit[]>([]);
  const [kitId, setKitId] = useState("");
  const [totalToday, setTotalToday] = useState(0);
  const [myCount, setMyCount] = useState(0);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [online, setOnline] = useState(isOnline());

  const { lookupQr, searchOffline } = useParticipantStatusCache({
    eventId: activeEventId,
    online,
  });

  const [prefs, setPrefs] = useState<ScanPreferences>(() =>
    loadScanPreferences(MODULE, userId),
  );
  const [telemetry, setTelemetry] = useState<ScanTelemetry>(() =>
    loadScanTelemetry(MODULE, userId),
  );

  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
    source?: "qr" | "manual";
    /** Destaque visual maior — já foi entregue (evita passar despercebido na fila). */
    variant?: "duplicate";
  } | null>(null);

  const [manualQuery, setManualQuery] = useState("");
  const [debouncedManual, setDebouncedManual] = useState("");
  const [manualHits, setManualHits] = useState<ParticipantManualSearchRow[]>([]);
  const [manualSearching, setManualSearching] = useState(false);
  // Busca manual/leitor USB fica escondida atrás de uma ação explícita por
  // padrão — a maioria dos scans é câmera. Some usuário com leitor USB, o
  // campo fica sempre visível e focado (é o alvo da "digitação" do leitor).
  const [manualSearchOpen, setManualSearchOpen] = useState(false);
  const showManualSearch = manualSearchOpen || !!prefs.usbReaderMode;

  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Só refoca automaticamente o campo quando há leitor USB conectado — em
   * celular (padrão), forçar foco nesse input abre o teclado virtual sozinho
   * e empurra a tela (era a causa do "teclado abre/rola" reportado).
   */
  const focusUsbInput = useCallback(() => {
    if (!prefs.usbReaderMode) return;
    setTimeout(() => {
      if (!scannerOpen) usbInputRef.current?.focus();
    }, 150);
  }, [scannerOpen, prefs.usbReaderMode]);

  useEffect(() => {
    if (!scannerOpen) focusUsbInput();
  }, [scannerOpen, kitId, isSubmitting, focusUsbInput]);

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

  /**
   * Duplicidade/erro fica na tela até o operador fechar — evita que a
   * câmera em tela cheia cubra a mensagem automaticamente antes de ser lida.
   */
  const dismissResult = () => {
    setResult(null);
    if (prefs.continuousMode) setScannerOpen(true);
  };

  /**
   * Nova entrega com sucesso: não exige fechar — mostra a confirmação e já
   * reabre a câmera (fluxo rápido). Só duplicidade/erro usam dismissResult.
   */
  const autoContinueOnSuccess = () => {
    if (prefs.continuousMode) {
      setTimeout(() => setScannerOpen(true), prefs.reopenDelayMs);
    }
  };

  const getErrorMessage = (err: unknown) => {
    if (err instanceof Error && err.message) return err.message;
    return "desconhecido";
  };

  const recordOutcome = (outcome: "ok" | "error") => {
    setTelemetry(bumpScanTelemetry(MODULE, outcome, userId));
  };

  useEffect(() => {
    if (!activeEventId) return;
    (async () => {
      let q = (supabase as any)
        .from("material_kits")
        .select("id, name, description")
        .eq("event_id", activeEventId)
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (stageId) q = q.eq("event_stage_id", stageId);

      const { data } = await q;
      const list = (data ?? []) as MaterialKit[];
      setKits(list);
    })();
  }, [activeEventId, stageId]);

  useEffect(() => {
    if (kitId && kits.some((k) => k.id === kitId)) return;
    if (kits.length > 0) setKitId(kits[0].id);
  }, [kits]);

  useEffect(() => {
    if (!activeEventId || kits.length === 0) {
      setTotalToday(0);
      setMyCount(0);
      return;
    }
    let cancelled = false;
    const kitIds = kits.map((k) => k.id);

    const fetchTotals = async () => {
      const [linkedTotal, unlinkedTotal] = await Promise.all([
        (supabase as any)
          .from("material_deliveries")
          .select("id", { count: "exact", head: true })
          .in("kit_id", kitIds)
          .eq("status", "active"),
        (supabase as any)
          .from("material_deliveries_unlinked")
          .select("id", { count: "exact", head: true })
          .in("kit_id", kitIds),
      ]);
      if (!cancelled) {
        setTotalToday((linkedTotal.count || 0) + (unlinkedTotal.count || 0));
      }

      if (userId) {
        const [linkedMine, unlinkedMine] = await Promise.all([
          (supabase as any)
            .from("material_deliveries")
            .select("id", { count: "exact", head: true })
            .in("kit_id", kitIds)
            .eq("status", "active")
            .eq("delivered_by", userId),
          (supabase as any)
            .from("material_deliveries_unlinked")
            .select("id", { count: "exact", head: true })
            .in("kit_id", kitIds)
            .eq("delivered_by", userId),
        ]);
        if (!cancelled) {
          setMyCount((linkedMine.count || 0) + (unlinkedMine.count || 0));
        }
      }
    };

    void fetchTotals();

    // Sem filtro por kit_id: cobre qualquer kit da etapa, não só o
    // selecionado neste aparelho — assim "Total Geral"/"Meus Registros"
    // ficam automáticos em TODOS os aparelhos, mesmo quando cada operador
    // está trabalhando um kit diferente ao mesmo tempo.
    const channel = supabase
      .channel(`material_totals_${activeEventId}_${stageId ?? "all"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "material_deliveries" },
        () => void fetchTotals(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "material_deliveries_unlinked" },
        () => void fetchTotals(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [activeEventId, stageId, kits, userId]);

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

    if (!online) {
      const results = searchOffline(debouncedManual);
      setManualHits(
        results.map((e) => ({
          participant_id: e.participant_id,
          person_id: "",
          full_name: e.full_name,
          cpf: e.cpf,
          participant_type: "",
          is_active: e.is_active,
          needs_meals: e.needs_meals,
          credentialed_at: e.credentialed_at,
          left_event_at: null,
        })),
      );
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
  }, [debouncedManual, activeEventId, online]);

  async function registerDelivery(
    participantId: string,
    participantName: string | null,
    method: "qr_scan" | "manual",
    resultSource: "qr" | "manual",
  ) {
    if (!kitId) {
      toast.error("Selecione um kit de material.");
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user.id) {
      setResult({ ok: false, message: "Sessão expirada. Faça login novamente." });
      recordOutcome("error");
      return;
    }

    const payload = {
      participant_id: participantId,
      kit_id: kitId,
      method,
      delivered_by: session.user.id,
    };

    const enqueueAndShowOfflineResult = () => {
      const enqueueResult = addToOfflineQueue(
        "material",
        payload,
        participantName || undefined,
      );

      if (enqueueResult.deduped) {
        const dedupMsg = `JÁ ENTREGUE (pendente offline neste aparelho): ${
          participantName || "esta pessoa"
        }`;
        setResult({ ok: false, message: dedupMsg, source: resultSource, variant: "duplicate" });
        recordOutcome("error");
        if (navigator.vibrate) navigator.vibrate([100, 80, 100]);
        return;
      }

      const successMsg = `Material registrado (offline): ${
        participantName || ""
      } — sincroniza quando houver internet.`;
      setResult({ ok: true, source: resultSource, message: successMsg });
      recordOutcome("ok");
      if (navigator.vibrate) navigator.vibrate(200);
      autoContinueOnSuccess();
    };

    if (!isOnline()) {
      enqueueAndShowOfflineResult();
      return;
    }

    try {
      const { data: rpcResult, error: rpcError } = await withTimeout(
        (supabase as any).rpc("record_material_delivery", {
          p_participant_id: participantId,
          p_kit_id: kitId,
          p_method: method,
          p_delivered_by: session.user.id,
        }),
        RPC_TIMEOUT_MS,
      );

      if (rpcError) throw rpcError;

      const res = rpcResult as { ok: boolean; reason?: string };

      if (!res.ok) {
        const isDuplicate = res.reason === "ALREADY_DELIVERED";
        let msg: string;
        switch (res.reason) {
          case "ALREADY_DELIVERED":
            msg = `JÁ ENTREGUE: ${participantName || "esta pessoa"} já recebeu este kit.`;
            break;
          case "KIT_NOT_FOUND":
            msg = "Kit não encontrado ou inativo.";
            break;
          case "NOT_ELIGIBLE":
            msg = "Este kit não é destinado ao perfil desta credencial.";
            break;
          default:
            msg = "Não foi possível registrar a entrega. Tente novamente.";
        }
        setResult({
          ok: false,
          message: msg,
          source: resultSource,
          variant: isDuplicate ? "duplicate" : undefined,
        });
        if (isDuplicate && navigator.vibrate) navigator.vibrate([100, 80, 100]);
        recordOutcome("error");
        return;
      }

      const prefix = method === "manual" ? "Busca manual · " : "";
      const successMsg = `${prefix}Material entregue: ${participantName || ""}`;
      setResult({ ok: true, source: resultSource, message: successMsg });
      recordOutcome("ok");
      if (navigator.vibrate) navigator.vibrate(200);
      autoContinueOnSuccess();
    } catch (networkErr) {
      // Falha/timeout de rede real (não resposta de negócio do servidor) —
      // nunca perde o registro: cai no mesmo caminho de fila offline usado
      // quando já se sabia estar sem internet.
      console.warn("[material] Falha de rede ao registrar entrega, enfileirando:", networkErr);
      enqueueAndShowOfflineResult();
    }
  }

  /**
   * Crachá não reconhecido (não achou participante nem no cache offline,
   * nem via resolveQrCredential online). Em vez de bloquear a entrega —
   * o que pararia a fila física —, grava o código bruto lido para
   * reconciliação posterior (import de credencial externa), igual ao
   * padrão já usado em Alimentação (`meal_consumptions_unlinked`).
   */
  async function registerDeliveryUnlinked(qrCode: string) {
    if (!kitId) {
      toast.error("Selecione um kit de material.");
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user.id) {
      setResult({ ok: false, message: "Sessão expirada. Faça login novamente." });
      recordOutcome("error");
      return;
    }

    const payload = {
      qr_code: qrCode,
      kit_id: kitId,
      method: "qr_scan",
      delivered_by: session.user.id,
    };

    const enqueueAndShowOfflineResult = () => {
      const enqueueResult = addToOfflineQueue("material", payload);

      if (enqueueResult.deduped) {
        const dedupMsg = `JÁ ENTREGUE (pendente offline neste aparelho) — crachá ${qrCode}`;
        setResult({ ok: false, message: dedupMsg, source: "qr", variant: "duplicate" });
        recordOutcome("error");
        if (navigator.vibrate) navigator.vibrate([100, 80, 100]);
        return;
      }

      const successMsg = `Material entregue (offline) — crachá não vinculado: ${qrCode}. Nome será associado após sincronizar.`;
      setResult({ ok: true, source: "qr", message: successMsg });
      recordOutcome("ok");
      if (navigator.vibrate) navigator.vibrate(200);
      autoContinueOnSuccess();
    };

    if (!isOnline()) {
      enqueueAndShowOfflineResult();
      return;
    }

    try {
      const { data: rpcResult, error: rpcError } = await withTimeout(
        (supabase as any).rpc("record_material_delivery_unlinked", {
          p_qr_code: qrCode,
          p_kit_id: kitId,
          p_method: "qr_scan",
          p_delivered_by: session.user.id,
        }),
        RPC_TIMEOUT_MS,
      );

      if (rpcError) throw rpcError;

      const res = rpcResult as { ok: boolean; reason?: string };

      if (!res.ok) {
        const isDuplicate = res.reason === "ALREADY_DELIVERED";
        const msg = isDuplicate
          ? `JÁ ENTREGUE — crachá não vinculado: ${qrCode}`
          : res.reason === "KIT_NOT_FOUND"
            ? "Kit não encontrado ou inativo."
            : "Não foi possível registrar a entrega. Tente novamente.";
        setResult({
          ok: false,
          message: msg,
          source: "qr",
          variant: isDuplicate ? "duplicate" : undefined,
        });
        if (isDuplicate && navigator.vibrate) navigator.vibrate([100, 80, 100]);
        recordOutcome("error");
        return;
      }

      const successMsg = `Material entregue — crachá não vinculado: ${qrCode}. Nome será associado quando o crachá for reconciliado.`;
      setResult({ ok: true, source: "qr", message: successMsg });
      recordOutcome("ok");
      if (navigator.vibrate) navigator.vibrate(200);
      autoContinueOnSuccess();
    } catch (networkErr) {
      console.warn(
        "[material] Falha de rede ao registrar entrega não vinculada, enfileirando:",
        networkErr,
      );
      enqueueAndShowOfflineResult();
    }
  }

  const handleScan = async (rawValue: string) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setScannerOpen(false);

    const val = rawValue.trim();

    if (!val) {
      setIsSubmitting(false);
      focusUsbInput();
      return;
    }

    if (!kitId) {
      toast.error("Selecione um kit de material.");
      setIsSubmitting(false);
      focusUsbInput();
      return;
    }

    try {
      if (isVoucherQr(val)) {
        const msg = "Este é um QR de voucher, não um crachá. Use o crachá do participante.";
        setResult({ ok: false, message: msg, source: "qr" });
        recordOutcome("error");
        return;
      }

      if (!isOnline()) {
        const cached = lookupQr(val);

        if (cached.state === "sem_cache") {
          toast.warning("Cache indisponível — registrando crachá para reconciliar depois.");
          await registerDeliveryUnlinked(val);
          return;
        }

        if (cached.state === "nao_cadastrado") {
          await registerDeliveryUnlinked(val);
          return;
        }

        if (cached.state === "nao_credenciado") {
          const msg = "Participante sem credencial ativa.";
          setResult({ ok: false, message: msg, source: "qr" });
          recordOutcome("error");
          return;
        }

        const cachedEntry = cached.entry;
        if (!cachedEntry.is_active) {
          const msg = "Participante inativo ou não encontrado.";
          setResult({ ok: false, message: msg, source: "qr" });
          recordOutcome("error");
          return;
        }

        await registerDelivery(
          cachedEntry.participant_id,
          cachedEntry.full_name,
          "qr_scan",
          "qr",
        );
        return;
      }

      let resolved: Awaited<ReturnType<typeof resolveQrCredential>>;
      try {
        resolved = await withTimeout(
          resolveQrCredential(val, { eventId: activeEventId }),
          RPC_TIMEOUT_MS,
        );
      } catch (resolveErr) {
        // Rede falhou ao tentar identificar o crachá — não descarta o scan:
        // grava o código bruto para reconciliar depois, igual a "não
        // reconhecido" (é exatamente o que está acontecendo: não conseguimos
        // saber quem é agora).
        console.warn(
          "[material] Falha de rede ao resolver credencial, tratando como não vinculado:",
          resolveErr,
        );
        await registerDeliveryUnlinked(val);
        return;
      }

      if (!resolved) {
        await registerDeliveryUnlinked(val);
        return;
      }

      let partData: { is_active: boolean; credentialed_at: string | null } | null = null;
      let partError: unknown = null;
      try {
        const partRes = await withTimeout(
          (supabase as any)
            .from("participants")
            .select("is_active, credentialed_at")
            .eq("id", resolved.participant_id)
            .single(),
          RPC_TIMEOUT_MS,
        );
        partData = partRes.data;
        partError = partRes.error;
      } catch (checkErr) {
        // Já sabemos quem é — só não deu pra confirmar elegibilidade agora
        // por causa da rede. Segue com a entrega; o trigger no banco valida
        // is_active/credencial no momento em que sincronizar (defesa em
        // profundidade já existente, independente do caminho de escrita).
        console.warn(
          "[material] Falha de rede ao checar elegibilidade, registrando mesmo assim:",
          checkErr,
        );
        await registerDelivery(resolved.participant_id, resolved.full_name, "qr_scan", "qr");
        return;
      }

      if (partError || !partData?.is_active) {
        const msg = "Participante inativo ou não encontrado.";
        setResult({ ok: false, message: msg, source: "qr" });
        recordOutcome("error");
        return;
      }

      if (!partData.credentialed_at) {
        const msg = "Participante sem credencial ativa.";
        setResult({ ok: false, message: msg, source: "qr" });
        recordOutcome("error");
        return;
      }

      await registerDelivery(
        resolved.participant_id,
        resolved.full_name,
        "qr_scan",
        "qr",
      );
    } catch (err: unknown) {
      setResult({
        ok: false,
        message: `Erro ao registrar: ${getErrorMessage(err)}`,
      });
      recordOutcome("error");
    } finally {
      setIsSubmitting(false);
      setManualQuery("");
      setDebouncedManual("");
      setManualHits([]);
      focusUsbInput();
    }
  };

  const handleManualPick = async (row: ParticipantManualSearchRow) => {
    if (isSubmitting) return;

    setManualQuery("");
    setManualHits([]);
    setIsSubmitting(true);

    try {
      if (row.is_active === false) {
        const msg = "Participante inativo.";
        setResult({ ok: false, message: msg, source: "manual" });
        recordOutcome("error");
        return;
      }
      await registerDelivery(row.participant_id, row.full_name, "manual", "manual");
    } catch (err: unknown) {
      setResult({
        ok: false,
        message: `Erro ao registrar: ${getErrorMessage(err)}`,
      });
      recordOutcome("error");
    } finally {
      setIsSubmitting(false);
      // Sem leitor USB, a busca foi aberta pra essa escolha pontual — fecha
      // depois de escolher, em vez de deixar o campo aberto ocupando espaço.
      if (!prefs.usbReaderMode) setManualSearchOpen(false);
      focusUsbInput();
    }
  };

  const currentKit = useMemo(
    () => kits.find((k) => k.id === kitId) ?? null,
    [kits, kitId],
  );

  const hasKit = !!currentKit;

  return (
    <PwaLayout backTo="/pwa/material/scan" moduleTitle="Entrega de Material">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-25" />

      <main className="relative mx-auto max-w-md space-y-3 p-3">
        {!activeStage && stages.length > 0 && (
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
                  Confirme a etapa de trabalho para começar.
                </p>
              </div>
            </div>
            <div className="grid gap-2">
              {stages.map((s) => (
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

        {kits.length === 0 ? (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-center space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Nenhum kit de material cadastrado
            </p>
            <p className="text-[11px] text-muted-foreground">
              {activeStage
                ? "Cadastre um kit para esta etapa no painel administrativo."
                : "Selecione uma etapa para listar os kits."}
            </p>
          </div>
        ) : (
          <div className="w-full flex items-center gap-3 rounded-2xl border-2 border-emerald-600/60 ring-1 ring-emerald-500/40 bg-card/60 px-4 py-3">
            <span className="relative inline-flex h-3 w-3 shrink-0 rounded-full bg-emerald-500">
              <span className="absolute inset-0 inline-flex animate-ping rounded-full bg-emerald-500/60" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">
                KIT SELECIONADO
              </p>
              <p className="mt-0.5 truncate text-base font-extrabold text-foreground">
                {currentKit?.name}
              </p>
              {currentKit?.description && (
                <p className="mt-0.5 text-xs text-muted-foreground truncate">
                  {currentKit.description}
                </p>
              )}
            </div>
            {kits.length > 1 ? (
              <select
                value={kitId}
                onChange={(e) => setKitId(e.target.value)}
                className="shrink-0 rounded-md border border-border/70 bg-background/40 px-2 py-1 text-xs font-semibold text-foreground"
                aria-label="Trocar kit"
              >
                {kits.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="shrink-0 inline-flex items-center gap-1 rounded-md border border-border/70 bg-background/40 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <ChevronsUpDown className="h-3 w-3" />
              </span>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <KpiCard label="Meus Registros" value={myCount} tone="blue" />
          <KpiCard label="Total Geral" value={totalToday} tone="default" />
        </div>

        {!scannerOpen && (
          <button
            type="button"
            onClick={() => hasKit && setScannerOpen(true)}
            disabled={!hasKit || isSubmitting}
            className={cn(
              "w-full rounded-2xl px-4 py-4 text-left transition-all flex items-center gap-3 shadow-app-md",
              hasKit
                ? "bg-module text-white hover:brightness-110 active:scale-[0.98]"
                : "bg-zinc-800/60 text-zinc-400 cursor-not-allowed opacity-70",
            )}
          >
            <div
              className={cn(
                "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
                hasKit ? "bg-white/20" : "bg-zinc-700/50",
              )}
            >
              {isSubmitting ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : hasKit ? (
                <ScanLine className="h-6 w-6" />
              ) : (
                <Lock className="h-6 w-6" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-extrabold leading-tight">
                {isSubmitting
                  ? "Processando…"
                  : hasKit
                    ? "Escanear Crachá"
                    : "Kit não disponível"}
              </p>
              <p className="text-[11px] font-medium opacity-80 truncate">
                {hasKit ? currentKit?.name : "Cadastre um kit para começar"}
              </p>
            </div>
          </button>
        )}

        {scannerOpen && (
          <QrCodeScanner
            isOpen={scannerOpen}
            onClose={() => {
              setScannerOpen(false);
              focusUsbInput();
            }}
            onScan={handleScan}
            continuous={prefs.continuousMode}
            title="Escanear Crachá"
            variant="fullscreen"
          />
        )}

        <div className="space-y-2">
          {!showManualSearch && (
            <button
              type="button"
              onClick={() => setManualSearchOpen(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border/70 bg-card/40 px-3 py-2.5 text-xs font-semibold text-muted-foreground active:scale-[0.98] transition-transform"
            >
              <Search className="h-3.5 w-3.5" />
              Busca manual por nome ou CPF
            </button>
          )}

          {showManualSearch && (
            <>
              {prefs.usbReaderMode && (
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-[11px] text-blue-700 dark:text-blue-300">
                  <strong>Leitor USB ativo:</strong> conecte o leitor, clique no campo abaixo e passe o crachá. A câmera do celular continua funcionando no botão acima.
                </div>
              )}

              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={usbInputRef}
                  autoFocus
                  placeholder={prefs.usbReaderMode ? "Leitor USB / Nome / CPF…" : "Nome ou CPF…"}
                  value={manualQuery}
                  disabled={isSubmitting}
                  onChange={(e) => setManualQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const code = manualQuery.trim();
                      if (code.length >= 3) {
                        setManualQuery("");
                        setDebouncedManual("");
                        setManualHits([]);
                        void handleScan(code).finally(() => focusUsbInput());
                      }
                    }
                  }}
                  onBlur={() => {
                    if (!scannerOpen) focusUsbInput();
                  }}
                  className="h-12 border-border/80 bg-card/90 pl-10 pr-10 text-base font-mono"
                />
                {!prefs.usbReaderMode && (
                  <button
                    type="button"
                    onClick={() => {
                      setManualSearchOpen(false);
                      setManualQuery("");
                      setDebouncedManual("");
                      setManualHits([]);
                    }}
                    aria-label="Fechar busca manual"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
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
                      manualHits.map((h) => (
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
                          {h.is_active === false && (
                            <span className="ml-2 shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                              inativo
                            </span>
                          )}
                        </button>
                      ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        {result?.variant === "duplicate" ? (
          <div className="flex flex-col gap-3 rounded-2xl border-2 border-amber-500/70 bg-amber-500/15 px-4 py-3 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 shrink-0 text-amber-500" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                  Atenção
                </p>
                <p className="text-base font-extrabold leading-snug text-amber-900 dark:text-amber-100">
                  {result.message}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissResult}
              className="h-11 w-full rounded-xl bg-amber-600 text-sm font-black uppercase tracking-wide text-white active:scale-[0.98] transition-transform"
            >
              Fechar
            </button>
          </div>
        ) : (
          result && (
            <div
              className={cn(
                "flex flex-col gap-2 rounded-2xl border px-3 py-2.5",
                result.ok
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : "border-destructive/40 bg-destructive/5",
              )}
            >
              <div className="flex items-start gap-2">
                {result.ok ? (
                  <CheckCircle className="h-5 w-5 shrink-0 text-emerald-500" />
                ) : (
                  <XCircle className="h-5 w-5 shrink-0 text-destructive" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug">{result.message}</p>
                </div>
              </div>
              {!result.ok && (
                <button
                  type="button"
                  onClick={dismissResult}
                  className="h-10 w-full rounded-lg bg-destructive text-xs font-bold uppercase tracking-wide text-destructive-foreground active:scale-[0.98] transition-transform"
                >
                  Fechar
                </button>
              )}
            </div>
          )
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => navigate("/pwa/material/lista")}
            className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/60 px-3 py-2.5 text-left active:scale-[0.98] transition-transform"
          >
            <ListChecks className="h-4 w-4 text-module shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-bold leading-tight truncate">Lista de entregas</p>
              <p className="text-[10px] text-muted-foreground">Histórico do kit</p>
            </div>
          </button>

          <label className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/60 px-3 py-2.5 cursor-pointer">
            <Settings2 className="h-4 w-4 text-module shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold leading-tight truncate">Modo contínuo</p>
              <p className="text-[10px] text-muted-foreground">
                {prefs.continuousMode
                  ? "Reabre câmera ao fechar a confirmação"
                  : "Desligado"}
              </p>
            </div>
            <Switch
              checked={prefs.continuousMode}
              onCheckedChange={(v) => updatePrefs({ ...prefs, continuousMode: v })}
              aria-label="Modo contínuo"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/60 px-3 py-2.5 cursor-pointer">
          <Usb className="h-4 w-4 text-module shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold leading-tight truncate">Leitor USB conectado</p>
            <p className="text-[10px] text-muted-foreground">
              {prefs.usbReaderMode
                ? "Campo de captura sempre visível e focado"
                : "Desligado — recomendado no celular"}
            </p>
          </div>
          <Switch
            checked={!!prefs.usbReaderMode}
            onCheckedChange={(v) => updatePrefs({ ...prefs, usbReaderMode: v })}
            aria-label="Leitor USB conectado"
          />
        </label>

        <SyncStatusLine online={online} />
      </main>
    </PwaLayout>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "default" | "blue";
}) {
  const valueClass = tone === "blue" ? "text-blue-400" : "text-foreground";

  return (
    <div className="rounded-xl border border-border/70 bg-card/60 px-3 py-3 text-center">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-0.5 text-3xl font-extrabold tabular-nums leading-none", valueClass)}>
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
      <Package className="h-3.5 w-3.5 text-zinc-500" />
    </div>
  );
}
