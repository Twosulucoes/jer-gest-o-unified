import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ScanLine,
  CheckCircle,
  Search,
  Loader2,
  User,
  IdCard,
  Link as LinkIcon,
  RefreshCcw,
  UserPlus,
  Save,
  UtensilsCrossed,
  Bus,
  BedDouble,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import QrCodeScanner from "@/components/pwa/QrCodeScanner";
import {
  resolveQrCredential,
  extractCandidates,
  type ResolvedCredential,
} from "@/lib/resolveQrCredential";
import { isVoucherQr } from "@/lib/voucherScan";
import {
  searchParticipantsByNameOrCpf,
  type ParticipantManualSearchRow,
} from "@/lib/participantManualSearch";
import { useAuth } from "@/hooks/useAuth";
import { useEventContext } from "@/contexts/EventContext";
import { usePwaAudit } from "@/hooks/usePwaAudit";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import PwaLayout from "@/components/pwa/PwaLayout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type SchoolOption = {
  id: string;
  name: string;
};

type SportEventOption = {
  id: string;
  name: string;
  sport_name: string;
};

type ConsumptionData = {
  meals: number;
  transport: number;
  lodging: number;
};

type QuickCreateForm = {
  full_name: string;
  cpf: string;
  birth_date: string;
  sex: string;
  school_id: string;
  participant_type: string;
  function_name: string;
};

export default function VincularCredencialPage() {
  useAuth();

  const eventContext = useEventContext() as any;

  const activeEventId = eventContext?.activeEventId ?? null;

  const activeStageId =
    eventContext?.activeStageId ??
    eventContext?.selectedStageId ??
    eventContext?.currentStageId ??
    eventContext?.activeEventStageId ??
    null;

  usePwaAudit("credenciamento/vincular", activeEventId);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [participantScannerOpen, setParticipantScannerOpen] = useState(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [resolved, setResolved] = useState<ResolvedCredential | null>(null);
  const [currentOwner, setCurrentOwner] = useState<{ name: string; id: string } | null>(null);

  const [manualQuery, setManualQuery] = useState("");
  const [debouncedManual, setDebouncedManual] = useState("");
  const [manualHits, setManualHits] = useState<ParticipantManualSearchRow[]>([]);
  const [manualSearching, setManualSearching] = useState(false);

  const [linking, setLinking] = useState(false);
  const [pendingLink, setPendingLink] = useState<ParticipantManualSearchRow | null>(null);

  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [creatingParticipant, setCreatingParticipant] = useState(false);
  const [schoolQuery, setSchoolQuery] = useState("");
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(false);

  const [consumptionData, setConsumptionData] = useState<ConsumptionData | null>(null);
  const [loadingConsumption, setLoadingConsumption] = useState(false);

  const [sportEventOptions, setSportEventOptions] = useState<SportEventOption[]>([]);
  const [selectedSportEventIds, setSelectedSportEventIds] = useState<string[]>([]);
  const [defaultStageId, setDefaultStageId] = useState<string | null>(null);
  const [defaultStageName, setDefaultStageName] = useState<string | null>(null);
  const [loadingSportEvents, setLoadingSportEvents] = useState(false);

  const [quickForm, setQuickForm] = useState<QuickCreateForm>({
    full_name: "",
    cpf: "",
    birth_date: "",
    sex: "",
    school_id: "",
    participant_type: "athlete",
    function_name: "",
  });

  const lastScanRef = useRef<{ value: string; at: number } | null>(null);

  const normalizeCredentialCode = (value: string) => value.trim().replace(/\s+/g, "");
  const onlyDigits = (value: string) => value.replace(/\D/g, "");
  const normalizeCpf = (value: string) => onlyDigits(value);

  const formatBirthDateToISO = (value: string) => {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      return `${year}-${month}-${day}`;
    }

    return null;
  };

  const selectedSchool = schools.find((s) => s.id === quickForm.school_id);

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

  useEffect(() => {
    if (schoolQuery.trim().length < 2) {
      setSchools([]);
      setLoadingSchools(false);
      return;
    }

    let cancelled = false;

    const loadSchools = async () => {
      setLoadingSchools(true);

      const { data, error } = await supabase
        .from("institutions")
        .select("id, name")
        .ilike("name", `%${schoolQuery.trim()}%`)
        .limit(20);

      if (!cancelled) {
        if (error) {
          console.error(error);
          setSchools([]);
        } else {
          setSchools((data || []) as SchoolOption[]);
        }

        setLoadingSchools(false);
      }
    };

    void loadSchools();

    return () => {
      cancelled = true;
    };
  }, [schoolQuery]);

  const fetchConsumption = async (participantId: string) => {
    setLoadingConsumption(true);
    try {
      const [mealsRes, transportRes, lodgingRes] = await Promise.all([
        supabase
          .from("meal_consumptions")
          .select("id", { count: "exact", head: true })
          .eq("participant_id", participantId),
        supabase
          .from("transport_passengers")
          .select("id", { count: "exact", head: true })
          .eq("participant_id", participantId),
        supabase
          .from("lodging_occupancies")
          .select("id", { count: "exact", head: true })
          .eq("participant_id", participantId),
      ]);

      setConsumptionData({
        meals: mealsRes.count ?? 0,
        transport: transportRes.count ?? 0,
        lodging: lodgingRes.count ?? 0,
      });
    } catch (err) {
      console.error("fetchConsumption:", err);
    } finally {
      setLoadingConsumption(false);
    }
  };

  const loadSportEventsAndStage = async () => {
    if (!activeEventId) return;

    setLoadingSportEvents(true);

    try {
      const eventsRes = await supabase
        .from("sport_events")
        .select("id, name, sport:sports!sport_events_sport_id_fkey(name)")
        .eq("event_id", activeEventId)
        .eq("is_active", true)
        .order("name");

      if (eventsRes.data) {
        setSportEventOptions(
          eventsRes.data.map((se: any) => ({
            id: se.id,
            name: se.name,
            sport_name: (se.sport as any)?.name ?? "",
          })),
        );
      }

      let stageIdToUse: string | null = activeStageId || null;
      let stageNameToUse: string | null = null;

      if (stageIdToUse) {
        const { data: activeStageData, error: activeStageError } = await supabase
          .from("event_stages")
          .select("id, name")
          .eq("id", stageIdToUse)
          .eq("event_id", activeEventId)
          .maybeSingle();

        if (!activeStageError && activeStageData?.id) {
          stageIdToUse = activeStageData.id;
          stageNameToUse = activeStageData.name ?? null;
        }
      }

      if (!stageIdToUse) {
        const { data: fallbackStage } = await supabase
          .from("event_stages")
          .select("id, name")
          .eq("event_id", activeEventId)
          .order("sort_order", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (fallbackStage?.id) {
          stageIdToUse = fallbackStage.id;
          stageNameToUse = fallbackStage.name ?? null;

          toast.warning(
            "A etapa ativa não foi encontrada no contexto. Usei a primeira etapa do evento como reserva.",
          );
        }
      }

      setDefaultStageId(stageIdToUse);
      setDefaultStageName(stageNameToUse);

      if (!stageIdToUse) {
        toast.error("Nenhuma etapa encontrada para este evento.");
      }
    } catch (err) {
      console.error("loadSportEventsAndStage:", err);
      toast.error("Erro ao carregar modalidades e etapa.");
    } finally {
      setLoadingSportEvents(false);
    }
  };

  const handleScan = async (rawValue: string) => {
    setScannerOpen(false);
    if (!rawValue.trim()) return;

    const now = Date.now();
    const last = lastScanRef.current;

    if (last && last.value === rawValue && now - last.at < 1500) return;

    lastScanRef.current = { value: rawValue, at: now };

    if (isVoucherQr(rawValue)) {
      toast.error("Este QR é um voucher, não uma credencial.", {
        description:
          "Vouchers são consumidos no módulo de Alimentação, Transporte ou Alojamento — não podem ser vinculados aqui.",
        duration: 6000,
      });
      return;
    }

    const { values } = extractCandidates(rawValue);
    const code = values[0] || normalizeCredentialCode(rawValue);

    if (!code) {
      toast.error("Código inválido");
      return;
    }

    setScannedCode(code);

    try {
      const res = await resolveQrCredential(rawValue, { eventId: activeEventId });
      setResolved(res);

      if (res) {
        setCurrentOwner({
          name: res.full_name || "Sem nome",
          id: res.participant_id,
        });

        if (res.source === "cpf") {
          toast.success(`CPF de ${res.full_name} identificado!`);
        } else {
          toast.info(`Este código já pertence a: ${res.full_name}`);
          void fetchConsumption(res.participant_id);
        }
      } else {
        setCurrentOwner(null);
        toast.success("Código disponível para vínculo!");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao verificar código");
    }
  };

  const handleParticipantScan = async (rawValue: string) => {
    setParticipantScannerOpen(false);
    if (!rawValue.trim() || !activeEventId) return;

    if (isVoucherQr(rawValue)) {
      toast.error("Este QR é um voucher, não identifica participante.");
      return;
    }

    try {
      setManualSearching(true);

      const res = await resolveQrCredential(rawValue, { eventId: activeEventId });

      if (res && res.participant_id) {
        await handleLink({
          participant_id: res.participant_id,
          full_name: res.full_name || "Participante identificado",
          person_id: "",
          cpf: "",
          participant_type: "",
        });
      } else {
        const { cpfDigits } = extractCandidates(rawValue);

        if (cpfDigits) {
          setManualQuery(cpfDigits);
          toast.info("Pesquisando pelo CPF extraído...");
        } else {
          toast.error("Não foi possível identificar o participante por este QR Code");
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao identificar participante");
    } finally {
      setManualSearching(false);
    }
  };

  const handleReset = () => {
    setScannedCode(null);
    setResolved(null);
    setCurrentOwner(null);
    setManualQuery("");
    setShowQuickCreate(false);
    setConsumptionData(null);
    setSelectedSportEventIds([]);
    setSportEventOptions([]);
    setDefaultStageId(null);
    setDefaultStageName(null);
  };

  const ensureParticipantInStage = async (participantId: string, stageId: string) => {
    const { data: existingStage, error: existingStageError } = await supabase
      .from("participant_event_stages")
      .select("id")
      .eq("participant_id", participantId)
      .eq("event_stage_id", stageId)
      .eq("event_id", activeEventId)
      .maybeSingle();

    if (existingStageError) throw existingStageError;

    if (existingStage?.id) {
      return existingStage.id;
    }

    const { data, error } = await supabase
      .from("participant_event_stages")
      .insert({
        participant_id: participantId,
        event_stage_id: stageId,
        event_id: activeEventId!,
        status: "active",
      })
      .select("id")
      .single();

    if (error) throw error;

    return data.id;
  };

  const handleLink = async (participant: ParticipantManualSearchRow) => {
    if (!scannedCode || !activeEventId) return;

    let stageIdToUse = defaultStageId || activeStageId;

    if (!stageIdToUse) {
      await loadSportEventsAndStage();
      stageIdToUse = defaultStageId || activeStageId;
    }

    if (!stageIdToUse) {
      toast.error("Nenhuma etapa ativa encontrada. Abra a etapa correta antes de vincular.");
      return;
    }

    setLinking(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new Error("Sessão expirada — faça login novamente.");
      }

      await ensureParticipantInStage(participant.participant_id, stageIdToUse);

      const { data: existing } = await supabase
        .from("external_credentials")
        .select("id")
        .eq("participant_id", participant.participant_id)
        .eq("event_id", activeEventId)
        .eq("status", "active")
        .maybeSingle();

      const { error } = await (supabase as any).rpc("link_external_credential", {
        p_event_id: activeEventId,
        p_participant_id: participant.participant_id,
        p_credential_code: scannedCode,
        p_user_id: session.user.id,
        p_replace_id: existing?.id ?? null,
        p_is_internal_mode: false,
      });

      if (error) {
        const raw = (error.message || "").toLowerCase();

        if (
          raw.includes("já vinculada a outro") ||
          raw.includes("uq_external_credentials_event_code")
        ) {
          throw new Error(
            "Esta credencial já está com outro participante. Cancele a vinculação atual no admin antes de transferir.",
          );
        }

        if (
          raw.includes("uq_external_credentials_active_participant") ||
          raw.includes("uq_participant_credentials_active")
        ) {
          throw new Error(
            "Este participante já possui uma credencial ativa. Use a opção de substituir.",
          );
        }

        throw error;
      }

      toast.success("Credencial vinculada e participante incluído na etapa atual!");

      if (navigator.vibrate) navigator.vibrate(200);

      handleReset();
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao vincular: ${err.message}`);
    } finally {
      setLinking(false);
    }
  };

  const createPerson = async () => {
    const cpf = normalizeCpf(quickForm.cpf);
    const birthDate = formatBirthDateToISO(quickForm.birth_date);

    if (!birthDate) {
      throw new Error("Data de nascimento inválida.");
    }

    const { data: existingPerson, error: existingError } = await supabase
      .from("people")
      .select("id")
      .eq("cpf", cpf)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existingPerson?.id) return existingPerson.id;

    const fullName = quickForm.full_name.trim().toUpperCase();

    const { data, error } = await (supabase as any)
      .from("people")
      .insert({
        full_name: fullName,
        cpf,
        birth_date: birthDate,
        gender: quickForm.sex === "M" ? "male" : quickForm.sex === "F" ? "female" : null,
      })
      .select("id")
      .single();

    if (error) throw error;

    return data.id;
  };

  const getOrCreateDelegation = async () => {
    if (!activeEventId || !selectedSchool?.id) {
      throw new Error("Selecione a escola/delegação.");
    }

    const { data: existing, error: existingError } = await supabase
      .from("delegations")
      .select("id")
      .eq("event_id", activeEventId)
      .eq("institution_id", selectedSchool.id)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing?.id) return existing.id;

    const { data, error } = await supabase
      .from("delegations")
      .insert({
        event_id: activeEventId,
        institution_id: selectedSchool.id,
        status: "confirmed",
      })
      .select("id")
      .single();

    if (error) throw error;

    return data.id;
  };

  const createParticipant = async (personId: string) => {
    if (!activeEventId) {
      throw new Error("Nenhum evento ativo selecionado.");
    }

    const { data: existingParticipants, error: existingError } = await supabase
      .from("participants")
      .select("id, participant_type")
      .eq("person_id", personId)
      .eq("event_id", activeEventId);

    if (existingError) throw existingError;

    if (existingParticipants?.length) {
      return existingParticipants[0].id;
    }

    const delegationId = await getOrCreateDelegation();

    const now = new Date().toISOString();

    const { data, error } = await (supabase as any)
      .from("participants")
      .insert({
        person_id: personId,
        event_id: activeEventId,
        delegation_id: delegationId,
        participant_type: quickForm.participant_type,
        function_name: quickForm.function_name || null,
        status: "credentialed",
        needs_meals: true,
        credentialed_at: now,
      })
      .select("id")
      .single();

    if (error) throw error;

    return data.id;
  };

  const handleQuickCreateAndLink = async () => {
    if (!scannedCode) {
      toast.error("Nenhuma credencial escaneada.");
      return;
    }

    if (!activeEventId) {
      toast.error("Nenhum evento ativo selecionado.");
      return;
    }

    const cpf = normalizeCpf(quickForm.cpf);

    if (!quickForm.full_name.trim()) {
      toast.error("Informe o nome completo.");
      return;
    }

    if (cpf.length !== 11) {
      toast.error("Informe um CPF com 11 dígitos.");
      return;
    }

    if (!quickForm.birth_date) {
      toast.error("Informe a data de nascimento.");
      return;
    }

    if (!quickForm.sex) {
      toast.error("Informe o sexo.");
      return;
    }

    if (!quickForm.school_id) {
      toast.error("Selecione a escola/delegação.");
      return;
    }

    if (!defaultStageId) {
      toast.error("Nenhuma etapa ativa foi encontrada. Abra a etapa correta antes de cadastrar.");
      return;
    }

    setCreatingParticipant(true);

    try {
      const personId = await createPerson();
      const participantId = await createParticipant(personId);

      await ensureParticipantInStage(participantId, defaultStageId);

      if (selectedSportEventIds.length > 0) {
        const enrollments = selectedSportEventIds.map((sport_event_id) => ({
          participant_id: participantId,
          sport_event_id,
          event_stage_id: defaultStageId,
          status: "confirmed",
          registration_source: "emergency",
        }));

        const { error: pseError } = await supabase
          .from("participant_sport_events")
          .upsert(enrollments, {
            onConflict: "participant_id,sport_event_id,event_stage_id",
            ignoreDuplicates: true,
          });

        if (pseError) {
          console.error("Erro ao inscrever modalidades:", pseError);
          toast.warning("Participante criado na etapa, mas houve erro nas modalidades.");
        }
      }

      await handleLink({
        participant_id: participantId,
        person_id: personId,
        full_name: quickForm.full_name.trim().toUpperCase(),
        cpf,
        participant_type: quickForm.participant_type,
      });

      setQuickForm({
        full_name: "",
        cpf: "",
        birth_date: "",
        sex: "",
        school_id: "",
        participant_type: "athlete",
        function_name: "",
      });

      setSchoolQuery("");
      setSchools([]);
      setShowQuickCreate(false);
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao cadastrar participante: ${err.message}`);
    } finally {
      setCreatingParticipant(false);
    }
  };

  /**
   * Reavalia o dono da credencial escaneada (Passo 1). Cobre o caso de dois
   * operadores lendo o mesmo crachá quase ao mesmo tempo: se outro aparelho
   * vincula/desvincula essa credencial enquanto esta tela ainda mostra o
   * resultado da leitura, o estado aqui é atualizado sozinho — sem precisar
   * reescanear — evitando que o operador tente vincular um código que
   * acabou de ser assumido por outro dispositivo.
   */
  const refreshScannedCredential = async () => {
    if (!scannedCode) return;

    try {
      const res = await resolveQrCredential(scannedCode, { eventId: activeEventId });
      setResolved(res);

      if (res) {
        setCurrentOwner({
          name: res.full_name || "Sem nome",
          id: res.participant_id,
        });

        if (res.source !== "cpf") {
          void fetchConsumption(res.participant_id);
        } else {
          setConsumptionData(null);
        }
      } else {
        setCurrentOwner(null);
        setConsumptionData(null);
      }
    } catch (err) {
      console.error("refreshScannedCredential:", err);
    }
  };

  // Sincroniza em tempo real com outros aparelhos: se a credencial
  // atualmente escaneada nesta tela for vinculada/desvinculada em outro
  // dispositivo (tabela `external_credentials`, habilitada para Realtime),
  // refaz a resolução aqui automaticamente.
  useRealtimeSync({
    channelName: `pwa_credenciamento_vincular_${activeEventId ?? "sem-evento"}_${scannedCode ?? "sem-codigo"}`,
    tables:
      activeEventId && scannedCode
        ? [
            {
              table: "external_credentials",
              filter: `credential_code=eq.${scannedCode}`,
            },
          ]
        : [],
    onChange: (payload) => {
      // O filtro do canal cobre só `credential_code` (a API de Realtime não
      // combina duas condições aqui) — o mesmo código pode existir em outro
      // evento (a unicidade é por evento), então confirmamos o event_id no
      // cliente antes de refazer a resolução.
      const row = (payload.new ?? payload.old) as { event_id?: string } | undefined;
      if (row?.event_id && activeEventId && row.event_id !== activeEventId) return;
      void refreshScannedCredential();
    },
    enabled: !!activeEventId && !!scannedCode,
    debounceMs: 400,
  });

  return (
    <PwaLayout backTo="/pwa" moduleTitle="Credenciamento">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-25" />

      <main className="relative mx-auto max-w-md space-y-6 p-4">
        {!scannedCode ? (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ScanLine className="h-8 w-8" />
              </div>

              <h2 className="text-lg font-bold">Passo 1: Escanear</h2>

              <p className="text-sm text-muted-foreground">
                Escaneie o QR Code da credencial física.
              </p>
            </div>

            <Button
              variant="module"
              className="h-16 w-full rounded-2xl text-lg font-bold shadow-app-lg"
              onClick={() => setScannerOpen(true)}
            >
              <ScanLine className="mr-3 h-6 w-6" />
              Escanear Credencial
            </Button>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <Card className="border-primary/20 bg-primary/5 shadow-app-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-primary text-primary-foreground p-2 rounded-lg">
                    <IdCard className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="text-[10px] uppercase font-bold text-primary/70 tracking-wider">
                      Código Escaneado
                    </p>
                    <p className="text-lg font-mono font-bold">{scannedCode}</p>
                  </div>
                </div>

                <Button variant="ghost" size="icon" onClick={handleReset}>
                  <RefreshCcw className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            {resolved?.source === "cpf" ? (
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4 space-y-3 text-center animate-in zoom-in-95 duration-300">
                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                  Pessoa encontrada via CPF
                </p>

                <p className="text-xl font-black text-blue-900 dark:text-blue-100">
                  {resolved.full_name}
                </p>

                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl h-14"
                  onClick={() =>
                    setPendingLink({
                      participant_id: resolved.participant_id,
                      full_name: resolved.full_name || "",
                      person_id: "",
                      cpf: scannedCode,
                      participant_type: "",
                    })
                  }
                  disabled={linking}
                >
                  <LinkIcon className="mr-2 h-5 w-5" />
                  Confirmar Vínculo
                </Button>
              </div>
            ) : currentOwner ? (
              <div className="rounded-xl bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 p-4 space-y-3 text-center">
                <p className="text-sm font-medium text-orange-800 dark:text-orange-300 flex items-center justify-center gap-2">
                  <User className="h-4 w-4" /> Credencial já vinculada a:
                </p>

                <p className="text-lg font-bold text-orange-900 dark:text-orange-100">
                  {currentOwner.name}
                </p>

                {loadingConsumption ? (
                  <div className="flex justify-center pt-1">
                    <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                  </div>
                ) : consumptionData ? (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="rounded-lg bg-orange-50 dark:bg-orange-900/50 p-2 text-center">
                      <UtensilsCrossed className="h-4 w-4 mx-auto text-orange-500 mb-1" />
                      <p className="text-lg font-black text-orange-900 dark:text-orange-100">
                        {consumptionData.meals}
                      </p>
                      <p className="text-[10px] text-orange-600 dark:text-orange-400 uppercase tracking-wide">
                        Refeições
                      </p>
                    </div>
                    <div className="rounded-lg bg-orange-50 dark:bg-orange-900/50 p-2 text-center">
                      <Bus className="h-4 w-4 mx-auto text-orange-500 mb-1" />
                      <p className="text-lg font-black text-orange-900 dark:text-orange-100">
                        {consumptionData.transport}
                      </p>
                      <p className="text-[10px] text-orange-600 dark:text-orange-400 uppercase tracking-wide">
                        Transportes
                      </p>
                    </div>
                    <div className="rounded-lg bg-orange-50 dark:bg-orange-900/50 p-2 text-center">
                      <BedDouble className="h-4 w-4 mx-auto text-orange-500 mb-1" />
                      <p className="text-lg font-black text-orange-900 dark:text-orange-100">
                        {consumptionData.lodging}
                      </p>
                      <p className="text-[10px] text-orange-600 dark:text-orange-400 uppercase tracking-wide">
                        Alojamentos
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-xl bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 p-4 flex items-center justify-center gap-2 text-green-700 dark:text-green-300">
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm font-medium text-green-800 dark:text-green-200">
                  Código disponível para vínculo
                </span>
              </div>
            )}

            <div className="space-y-4">
              <div className="text-center space-y-1">
                <h2 className="text-lg font-bold">Passo 2: Quem é o dono?</h2>

                <p className="text-sm text-muted-foreground">
                  Busque o participante pelo nome ou CPF.
                </p>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                  <Input
                    placeholder="Buscar por nome ou CPF…"
                    value={manualQuery}
                    onChange={(e) => {
                      setManualQuery(e.target.value);

                      setQuickForm((prev) => ({
                        ...prev,
                        full_name:
                          e.target.value.replace(/\d/g, "").trim().length > 2
                            ? e.target.value
                            : prev.full_name,
                        cpf:
                          onlyDigits(e.target.value).length >= 8
                            ? onlyDigits(e.target.value)
                            : prev.cpf,
                      }));
                    }}
                    className="h-12 border-border/80 bg-card/90 pl-10 shadow-app-sm rounded-xl"
                    autoFocus
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-12 rounded-xl p-0 border-primary/20 bg-primary/5 text-primary shadow-app-sm"
                  onClick={() => setParticipantScannerOpen(true)}
                >
                  <ScanLine className="h-5 w-5" />
                </Button>
              </div>

              <div className="min-h-[200px]">
                {manualSearching ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground space-y-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-sm">Pesquisando participante...</span>
                  </div>
                ) : manualHits.length > 0 ? (
                  <div className="grid gap-3">
                    {manualHits.map((h) => (
                      <button
                        key={h.participant_id}
                        type="button"
                        onClick={() => setPendingLink(h)}
                        disabled={linking}
                        className="group flex items-center gap-4 rounded-2xl border bg-card p-4 text-left shadow-app-sm transition-all hover:border-primary/30 hover:shadow-app-md active:scale-[0.98] disabled:opacity-50"
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          <User className="h-6 w-6" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="truncate text-base font-bold text-foreground">
                            {h.full_name}
                          </p>

                          <p className="truncate text-xs text-muted-foreground">
                            {h.participant_type}
                          </p>
                        </div>

                        <div className="bg-primary/5 text-primary p-2 rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                          <LinkIcon className="h-5 w-5" />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : debouncedManual.length >= 2 ? (
                  <div className="space-y-3 text-center py-6 bg-muted/30 rounded-2xl border-2 border-dashed border-muted px-4">
                    <p className="text-muted-foreground font-medium">
                      Nenhum participante encontrado.
                    </p>

                    <Button
                      type="button"
                      variant="module"
                      className="w-full gap-2"
                      onClick={() => {
                        setShowQuickCreate(true);
                        void loadSportEventsAndStage();
                      }}
                    >
                      <UserPlus className="h-4 w-4" />
                      Cadastrar novo participante
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-10 text-muted-foreground">
                    <p className="text-sm">Os resultados aparecerão aqui.</p>
                  </div>
                )}
              </div>

              {showQuickCreate && (
                <Card className="border-amber-500/40 bg-card/95">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-5 w-5 text-amber-500" />

                      <div>
                        <p className="font-bold">Cadastro rápido</p>

                        <p className="text-xs text-muted-foreground">
                          Cadastra o participante e vincula a credencial{" "}
                          <strong>{scannedCode}</strong>.
                        </p>

                        {defaultStageName ? (
                          <p className="mt-1 text-xs font-bold text-primary">
                            Etapa atual: {defaultStageName}
                          </p>
                        ) : defaultStageId ? (
                          <p className="mt-1 text-xs font-bold text-primary">
                            Etapa ativa selecionada
                          </p>
                        ) : (
                          <p className="mt-1 text-xs font-bold text-destructive">
                            Nenhuma etapa ativa identificada
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-muted-foreground">
                        Nome completo
                      </label>

                      <Input
                        value={quickForm.full_name}
                        onChange={(e) =>
                          setQuickForm((prev) => ({
                            ...prev,
                            full_name: e.target.value,
                          }))
                        }
                        placeholder="Nome completo"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-muted-foreground">
                        CPF
                      </label>

                      <Input
                        value={quickForm.cpf}
                        onChange={(e) =>
                          setQuickForm((prev) => ({
                            ...prev,
                            cpf: normalizeCpf(e.target.value),
                          }))
                        }
                        placeholder="Somente números"
                        inputMode="numeric"
                        maxLength={11}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-muted-foreground">
                          Data nascimento
                        </label>

                        <Input
                          type="date"
                          value={quickForm.birth_date}
                          onChange={(e) =>
                            setQuickForm((prev) => ({
                              ...prev,
                              birth_date: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-muted-foreground">
                          Sexo
                        </label>

                        <select
                          value={quickForm.sex}
                          onChange={(e) =>
                            setQuickForm((prev) => ({
                              ...prev,
                              sex: e.target.value,
                            }))
                          }
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="">Selecione</option>
                          <option value="M">Masculino</option>
                          <option value="F">Feminino</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-muted-foreground">
                        Tipo
                      </label>

                      <select
                        value={quickForm.participant_type}
                        onChange={(e) =>
                          setQuickForm((prev) => ({
                            ...prev,
                            participant_type: e.target.value,
                          }))
                        }
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="athlete">Atleta</option>
                        <option value="coach">Técnico</option>
                        <option value="head_of_delegation">Chefe de Delegação</option>
                        <option value="official">Oficial</option>
                        <option value="staff">Staff / Equipe geral</option>
                        <option value="motorista">Motorista</option>
                        <option value="agente_operacao">Operacional</option>
                        <option value="logistica">Logística</option>
                        <option value="cozinheira">Cozinheira / Alimentação</option>
                        <option value="guia">Guia</option>
                        <option value="secretaria">Secretaria</option>
                        <option value="mesario">Mesário</option>
                        <option value="arbitro">Árbitro</option>
                        <option value="delegado">Delegado</option>
                        <option value="fiscal">Fiscal</option>
                        <option value="operador_pesquisa">Operador de Pesquisa</option>
                        <option value="tecnico_ti">Técnico de TI</option>
                        <option value="terceiro">Terceirizado</option>
                        <option value="colaborador">Colaborador</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-muted-foreground">
                        Função detalhada
                      </label>

                      <Input
                        value={quickForm.function_name}
                        onChange={(e) =>
                          setQuickForm((prev) => ({
                            ...prev,
                            function_name: e.target.value,
                          }))
                        }
                        placeholder="Ex: Fisioterapeuta, Fotógrafo, Credenciamento..."
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                        <Trophy className="h-3.5 w-3.5 text-amber-500" />
                        Inscrição de emergência — Modalidades
                      </label>

                      {loadingSportEvents ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Carregando modalidades...
                        </div>
                      ) : sportEventOptions.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">
                          Nenhuma modalidade ativa disponível.
                        </p>
                      ) : (
                        <div className="max-h-48 overflow-y-auto rounded-xl border bg-background divide-y">
                          {sportEventOptions.map((se) => (
                            <label
                              key={se.id}
                              className="flex items-center gap-3 px-3 py-2 hover:bg-muted cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-border accent-primary"
                                checked={selectedSportEventIds.includes(se.id)}
                                onChange={(e) => {
                                  setSelectedSportEventIds((prev) =>
                                    e.target.checked
                                      ? [...prev, se.id]
                                      : prev.filter((id) => id !== se.id),
                                  );
                                }}
                              />
                              <span className="flex-1 min-w-0">
                                <span className="text-sm font-medium">{se.name}</span>
                                {se.sport_name && (
                                  <span className="text-xs text-muted-foreground ml-1">
                                    — {se.sport_name}
                                  </span>
                                )}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}

                      {selectedSportEventIds.length > 0 && (
                        <p className="text-xs text-primary font-medium">
                          {selectedSportEventIds.length} modalidade
                          {selectedSportEventIds.length !== 1 ? "s" : ""} selecionada
                          {selectedSportEventIds.length !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-muted-foreground">
                        Escola / Delegação
                      </label>

                      <Input
                        value={schoolQuery}
                        onChange={(e) => {
                          setSchoolQuery(e.target.value);
                          setQuickForm((prev) => ({
                            ...prev,
                            school_id: "",
                          }));
                        }}
                        placeholder="Digite o nome da escola"
                      />

                      {loadingSchools && (
                        <p className="text-xs text-muted-foreground">
                          Buscando escolas...
                        </p>
                      )}

                      {schools.length > 0 && (
                        <div className="max-h-40 overflow-y-auto rounded-xl border bg-background">
                          {schools.map((school) => (
                            <button
                              key={school.id}
                              type="button"
                              onClick={() => {
                                setQuickForm((prev) => ({
                                  ...prev,
                                  school_id: school.id,
                                }));
                                setSchoolQuery(school.name);
                              }}
                              className={`w-full border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-muted ${
                                quickForm.school_id === school.id
                                  ? "bg-muted font-bold"
                                  : ""
                              }`}
                            >
                              {school.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => setShowQuickCreate(false)}
                        disabled={creatingParticipant}
                      >
                        Cancelar
                      </Button>

                      <Button
                        type="button"
                        variant="module"
                        className="w-full gap-2"
                        onClick={handleQuickCreateAndLink}
                        disabled={creatingParticipant}
                      >
                        {creatingParticipant ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}

                        Salvar e vincular
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </main>

      <QrCodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
        title="Escanear Credencial Física"
      />

      <QrCodeScanner
        isOpen={participantScannerOpen}
        onClose={() => setParticipantScannerOpen(false)}
        onScan={handleParticipantScan}
        title="Identificar Participante"
      />

      {linking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-lg font-bold">Vinculando...</p>
          </div>
        </div>
      )}

      <AlertDialog open={!!pendingLink} onOpenChange={(o) => !o && setPendingLink(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar vínculo de credencial</AlertDialogTitle>

            <AlertDialogDescription>
              Vincular a credencial{" "}
              <strong className="font-mono">{scannedCode ?? "—"}</strong> ao
              participante <strong>{pendingLink?.full_name || "—"}</strong>?
              <br />
              <span className="text-destructive font-medium">
                Esta ação é definitiva no PWA.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>

            <AlertDialogAction
              onClick={() => {
                if (pendingLink) {
                  const target = pendingLink;
                  setPendingLink(null);
                  void handleLink(target);
                }
              }}
            >
              Confirmar vínculo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PwaLayout>
  );
}
