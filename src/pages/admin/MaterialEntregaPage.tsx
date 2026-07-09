import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEventId } from "@/contexts/EventContext";
import { useStageScope } from "@/hooks/useStageScope";
import { useStageModuleKpis } from "@/contexts/StageModuleKpisContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Package,
  Plus,
  RotateCcw,
  PackageCheck,
  School,
  X,
  Radio,
  Users,
  AlertTriangle,
  Undo2,
  UserX,
  Search,
  Copy,
} from "lucide-react";

interface MaterialKit {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  event_stage_id: string | null;
}

interface DeliveryRow {
  id: string;
  participant_id: string;
  delivered_at: string;
  method: string;
  full_name: string;
  cpf: string | null;
  participant_type: string | null;
  escola: string;
}

interface UnlinkedDeliveryRow {
  id: string;
  qr_code: string;
  delivered_at: string;
  method: string;
}

interface RevokedDeliveryRow {
  id: string;
  delivered_at: string;
  revoked_at: string | null;
  revoke_reason: string | null;
  full_name: string;
  cpf: string | null;
  participant_type: string | null;
  escola: string;
}

interface PendingParticipantRow {
  id: string;
  full_name: string;
  cpf: string | null;
  participant_type: string | null;
  escola: string;
}

interface DuplicateAttemptRow {
  id: string;
  created_at: string;
  linked: boolean;
  full_name: string;
  cpf: string | null;
  participant_type: string | null;
  escola: string;
  qr_code: string | null;
  operator_name: string | null;
}

const SEM_ESCOLA = "Sem escola/delegação";

// Todos os perfis (participant_type) do sistema, na ordem de exibição.
const PARTICIPANT_TYPES: { value: string; label: string }[] = [
  { value: "athlete", label: "Atleta" },
  { value: "coach", label: "Técnico" },
  { value: "head_of_delegation", label: "Chefe de Delegação" },
  { value: "official", label: "Oficial" },
  { value: "staff", label: "Staff" },
  { value: "motorista", label: "Motorista" },
  { value: "agente_operacao", label: "Agente de Operação" },
  { value: "logistica", label: "Logística" },
  { value: "cozinheira", label: "Cozinheira" },
  { value: "guia", label: "Guia" },
  { value: "secretaria", label: "Secretaria" },
  { value: "mesario", label: "Mesário" },
  { value: "arbitro", label: "Árbitro" },
  { value: "delegado", label: "Delegado" },
  { value: "fiscal", label: "Fiscal" },
  { value: "operador_pesquisa", label: "Operador de Pesquisa" },
  { value: "tecnico_ti", label: "Técnico de TI" },
  { value: "terceiro", label: "Terceiro" },
  { value: "colaborador", label: "Colaborador" },
];

const PARTICIPANT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  PARTICIPANT_TYPES.map((p) => [p.value, p.label]),
);

const ptLabel = (v: string | null | undefined) =>
  (v && PARTICIPANT_TYPE_LABELS[v]) || v || "—";

interface SchoolProgress {
  escola: string;
  delivered: number;
  total: number | null;
  faltam: number | null;
}

export default function MaterialEntregaPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const eventId = useActiveEventId();
  const { stageId } = useStageScope();
  const canWrite = hasRole("admin") || hasRole("secretaria");

  const [kitDialog, setKitDialog] = useState<MaterialKit | "new" | null>(null);
  const [kitName, setKitName] = useState("");
  const [kitDesc, setKitDesc] = useState("");
  const [restrictEligibility, setRestrictEligibility] = useState(false);
  const [kitEligibility, setKitEligibility] = useState<Set<string>>(new Set());
  const [selectedKitId, setSelectedKitId] = useState<string>("");
  const [schoolFilter, setSchoolFilter] = useState<string | null>(null);

  // ── Kits ────────────────────────────────────────────────
  const { data: kits = [], isLoading: loadingKits } = useQuery({
    queryKey: ["material_kits", eventId, stageId],
    enabled: !!eventId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("material_kits")
        .select("id, name, description, is_active, event_stage_id")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });
      if (stageId) q = q.eq("event_stage_id", stageId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as MaterialKit[];
    },
  });

  const activeKitId = selectedKitId || kits.find((k) => k.is_active)?.id || kits[0]?.id || "";

  const kitIds = useMemo(() => kits.map((k) => k.id), [kits]);

  // Elegibilidade (perfis) de todos os kits — para exibir nos cards e
  // limitar as contagens de credenciados ao público-alvo do kit.
  const { data: eligibilityByKit = {} } = useQuery({
    queryKey: ["material_kit_eligibility_map", kitIds],
    enabled: kitIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("material_kit_eligibility")
        .select("kit_id, participant_type")
        .in("kit_id", kitIds);
      if (error) throw error;
      const map: Record<string, string[]> = {};
      for (const r of (data ?? []) as any[]) {
        (map[r.kit_id] ??= []).push(r.participant_type);
      }
      return map;
    },
  });

  // Perfis elegíveis do kit ativo (vazio = todos os perfis).
  const activeKitTypes = useMemo(
    () => eligibilityByKit[activeKitId] ?? [],
    [eligibilityByKit, activeKitId],
  );

  const saveKit = useMutation({
    mutationFn: async () => {
      const name = kitName.trim();
      if (!name) throw new Error("Informe o nome do kit.");
      const { data: { session } } = await supabase.auth.getSession();

      let kitId: string;
      if (kitDialog === "new") {
        const { data, error } = await (supabase as any)
          .from("material_kits")
          .insert({
            event_id: eventId,
            event_stage_id: stageId || null,
            name,
            description: kitDesc.trim() || null,
            created_by: session?.user.id ?? null,
          })
          .select("id")
          .single();
        if (error) throw error;
        kitId = data.id as string;
      } else if (kitDialog) {
        const { error } = await (supabase as any)
          .from("material_kits")
          .update({ name, description: kitDesc.trim() || null })
          .eq("id", kitDialog.id);
        if (error) throw error;
        kitId = kitDialog.id;
      } else {
        return;
      }

      // Sincroniza a elegibilidade por perfil (delete-all + re-insert).
      const desired = restrictEligibility ? [...kitEligibility] : [];
      const { error: delErr } = await (supabase as any)
        .from("material_kit_eligibility")
        .delete()
        .eq("kit_id", kitId);
      if (delErr) throw delErr;
      if (desired.length > 0) {
        const rows = desired.map((pt) => ({ kit_id: kitId, participant_type: pt }));
        const { error: insErr } = await (supabase as any)
          .from("material_kit_eligibility")
          .insert(rows);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material_kits", eventId, stageId] });
      qc.invalidateQueries({ queryKey: ["material_kit_eligibility_map"] });
      qc.invalidateQueries({ queryKey: ["material_credentialed_count"] });
      qc.invalidateQueries({ queryKey: ["material_credentialed_by_school"] });
      qc.invalidateQueries({ queryKey: ["material_credentialed_participants"] });
      toast.success("Kit salvo.");
      setKitDialog(null);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar kit."),
  });

  const toggleKit = useMutation({
    mutationFn: async (kit: MaterialKit) => {
      const { error } = await (supabase as any)
        .from("material_kits")
        .update({ is_active: !kit.is_active })
        .eq("id", kit.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material_kits", eventId, stageId] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao atualizar kit."),
  });

  // ── Entregas do kit selecionado ─────────────────────────
  const { data: deliveries = [], isLoading: loadingDeliveries } = useQuery({
    queryKey: ["material_deliveries", activeKitId],
    enabled: !!activeKitId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("material_deliveries")
        .select(
          `id, participant_id, delivered_at, method,
           participants!inner(participant_type, people!inner(full_name, cpf), delegations(institutions(name)))`,
        )
        .eq("kit_id", activeKitId)
        .eq("status", "active")
        .order("delivered_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        participant_id: r.participant_id,
        delivered_at: r.delivered_at,
        method: r.method,
        full_name: r.participants?.people?.full_name || "",
        cpf: r.participants?.people?.cpf || null,
        participant_type: r.participants?.participant_type || null,
        escola: r.participants?.delegations?.institutions?.name || SEM_ESCOLA,
      })) as DeliveryRow[];
    },
  });

  // Crachá não reconhecido no momento do scan — não identifica participante,
  // fica pendente de reconciliação (ver PR do fluxo "não vinculado" do PWA).
  const { data: unlinkedDeliveries = [], isLoading: loadingUnlinked } = useQuery({
    queryKey: ["material_deliveries_unlinked", activeKitId],
    enabled: !!activeKitId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("material_deliveries_unlinked")
        .select("id, qr_code, delivered_at, method")
        .eq("kit_id", activeKitId)
        .order("delivered_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as UnlinkedDeliveryRow[];
    },
  });

  const { data: revokedDeliveries = [], isLoading: loadingRevoked } = useQuery({
    queryKey: ["material_revoked_deliveries", activeKitId],
    enabled: !!activeKitId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("material_deliveries")
        .select(
          `id, delivered_at, revoked_at, revoke_reason,
           participants!inner(participant_type, people!inner(full_name, cpf), delegations(institutions(name)))`,
        )
        .eq("kit_id", activeKitId)
        .eq("status", "revoked")
        .order("revoked_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        delivered_at: r.delivered_at,
        revoked_at: r.revoked_at,
        revoke_reason: r.revoke_reason,
        full_name: r.participants?.people?.full_name || "",
        cpf: r.participants?.people?.cpf || null,
        participant_type: r.participants?.participant_type || null,
        escola: r.participants?.delegations?.institutions?.name || SEM_ESCOLA,
      })) as RevokedDeliveryRow[];
    },
  });

  // Tentativas de reentrega (crachá já entregue neste kit) — gravadas pela
  // RPC em audit_events (action='duplicate_delivery_attempt'), ver migration
  // 20260709100000_material_duplicate_delivery_audit.
  const { data: duplicateAttemptsRaw = [], isLoading: loadingDuplicates } = useQuery({
    queryKey: ["material_duplicate_attempts", activeKitId],
    enabled: !!activeKitId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("audit_events")
        .select("id, created_at, created_by, table_name, record_id, payload")
        .eq("action", "duplicate_delivery_attempt")
        .eq("payload->>kit_id", activeKitId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Nome do participante das tentativas com crachá vinculado (busca pela
  // entrega já existente, referenciada em record_id/payload.existing_delivery_id).
  const linkedAttemptDeliveryIds = useMemo(
    () =>
      Array.from(
        new Set(
          duplicateAttemptsRaw
            .filter((r) => r.table_name === "material_deliveries")
            .map((r) => r.record_id as string),
        ),
      ),
    [duplicateAttemptsRaw],
  );

  const { data: attemptParticipantsById = {} } = useQuery({
    queryKey: ["material_duplicate_attempt_participants", linkedAttemptDeliveryIds],
    enabled: linkedAttemptDeliveryIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("material_deliveries")
        .select(
          "id, participants!inner(participant_type, people!inner(full_name, cpf), delegations(institutions(name)))",
        )
        .in("id", linkedAttemptDeliveryIds);
      if (error) throw error;
      const map: Record<
        string,
        { full_name: string; cpf: string | null; participant_type: string | null; escola: string }
      > = {};
      for (const r of (data ?? []) as any[]) {
        map[r.id] = {
          full_name: r.participants?.people?.full_name || "",
          cpf: r.participants?.people?.cpf || null,
          participant_type: r.participants?.participant_type || null,
          escola: r.participants?.delegations?.institutions?.name || SEM_ESCOLA,
        };
      }
      return map;
    },
  });

  // Nome de quem operou o scan que gerou a tentativa.
  const attemptOperatorIds = useMemo(
    () => Array.from(new Set(duplicateAttemptsRaw.map((r) => r.created_by).filter(Boolean))),
    [duplicateAttemptsRaw],
  );

  const { data: attemptOperatorNamesById = {} } = useQuery({
    queryKey: ["material_duplicate_attempt_operators", attemptOperatorIds],
    enabled: attemptOperatorIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", attemptOperatorIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const r of data ?? []) map[r.id] = r.full_name;
      return map;
    },
  });

  const duplicateAttempts = useMemo<DuplicateAttemptRow[]>(
    () =>
      duplicateAttemptsRaw.map((r) => {
        const linked = r.table_name === "material_deliveries";
        const participant = linked ? attemptParticipantsById[r.record_id] : null;
        return {
          id: r.id,
          created_at: r.created_at,
          linked,
          full_name: participant?.full_name || "",
          cpf: participant?.cpf || null,
          participant_type: participant?.participant_type || null,
          escola: participant?.escola || (linked ? SEM_ESCOLA : ""),
          qr_code: r.payload?.qr_code || null,
          operator_name: (r.created_by && attemptOperatorNamesById[r.created_by]) || null,
        };
      }),
    [duplicateAttemptsRaw, attemptParticipantsById, attemptOperatorNamesById],
  );

  // Atualização ao vivo: qualquer entrega/estorno/crachá não vinculado
  // neste kit recarrega os dados (as duas tabelas de entrega precisam
  // estar na publicação supabase_realtime — ver migration correspondente).
  useEffect(() => {
    if (!activeKitId) return;
    const channel = supabase
      .channel(`admin_material_deliveries_${activeKitId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "material_deliveries",
          filter: `kit_id=eq.${activeKitId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["material_deliveries", activeKitId] });
          qc.invalidateQueries({ queryKey: ["material_revoked_deliveries", activeKitId] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "material_deliveries_unlinked",
          filter: `kit_id=eq.${activeKitId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["material_deliveries_unlinked", activeKitId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeKitId, qc]);

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any).rpc("revoke_material_delivery", {
        p_delivery_id: id,
        p_reason: "Estorno pelo painel administrativo",
      });
      if (error) throw error;
      const res = data as { ok: boolean };
      if (!res.ok) throw new Error("Não foi possível estornar (já estornada?).");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material_deliveries", activeKitId] });
      qc.invalidateQueries({ queryKey: ["material_revoked_deliveries", activeKitId] });
      toast.success("Entrega estornada.");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao estornar."),
  });

  const openNewKit = () => {
    setKitName("");
    setKitDesc("");
    setRestrictEligibility(false);
    setKitEligibility(new Set());
    setKitDialog("new");
  };
  const openEditKit = (kit: MaterialKit) => {
    setKitName(kit.name);
    setKitDesc(kit.description || "");
    const existing = eligibilityByKit[kit.id] ?? [];
    setRestrictEligibility(existing.length > 0);
    setKitEligibility(new Set(existing));
    setKitDialog(kit);
  };

  const toggleEligibilityType = (value: string) => {
    setKitEligibility((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const totalDeliveredLinked = deliveries.length;
  const totalDelivered = totalDeliveredLinked + unlinkedDeliveries.length;

  const activeKit = useMemo(
    () => kits.find((k) => k.id === activeKitId) ?? null,
    [kits, activeKitId],
  );

  // Contadores para os KPIs do módulo (substituem o cabeçalho global de credenciais)
  const revokedCount = revokedDeliveries.length;

  // Universo de quem deveria receber: participantes credenciados e ativos
  // na etapa, limitados aos perfis elegíveis do kit (se houver restrição).
  const { data: credentialedCount = 0 } = useQuery({
    queryKey: ["material_credentialed_count", eventId, stageId, activeKitTypes],
    enabled: !!eventId && !!stageId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("participants")
        .select("id, participant_event_stages!inner(event_stage_id, status)", {
          count: "exact",
          head: true,
        })
        .eq("is_active", true)
        .not("credentialed_at", "is", null)
        .eq("participant_event_stages.event_stage_id", stageId)
        .eq("participant_event_stages.status", "active");
      if (activeKitTypes.length > 0) q = q.in("participant_type", activeKitTypes);
      const { count, error } = await q;
      if (error) throw error;
      return count || 0;
    },
  });

  // Lista completa dos credenciados/elegíveis (para a lista "quem falta"
  // — diferente de credentialedCount/credentialedBySchool, que só agregam).
  const { data: credentialedParticipants = [], isLoading: loadingPending } = useQuery({
    queryKey: ["material_credentialed_participants", eventId, stageId, activeKitTypes],
    enabled: !!eventId && !!stageId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("participants")
        .select(
          `id, participant_type, participant_event_stages!inner(event_stage_id, status),
           people!inner(full_name, cpf), delegations(institutions(name))`,
        )
        .eq("is_active", true)
        .not("credentialed_at", "is", null)
        .eq("participant_event_stages.event_stage_id", stageId)
        .eq("participant_event_stages.status", "active");
      if (activeKitTypes.length > 0) q = q.in("participant_type", activeKitTypes);
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as any[]).map((p) => ({
        id: p.id,
        full_name: p.people?.full_name || "",
        cpf: p.people?.cpf || null,
        participant_type: p.participant_type,
        escola: p.delegations?.institutions?.name || SEM_ESCOLA,
      })) as PendingParticipantRow[];
    },
  });

  // Quem falta receber = credenciado/elegível, mas sem entrega VINCULADA
  // ativa neste kit. (Crachás não vinculados não identificam participante,
  // então não dá pra excluí-los daqui até serem reconciliados.)
  const pendingParticipants = useMemo(() => {
    const deliveredIds = new Set(deliveries.map((d) => d.participant_id));
    return credentialedParticipants.filter((p) => !deliveredIds.has(p.id));
  }, [credentialedParticipants, deliveries]);

  // Universo credenciado quebrado por escola (para o "faltam" por escola).
  const { data: credentialedBySchool = null } = useQuery({
    queryKey: ["material_credentialed_by_school", eventId, stageId, activeKitTypes],
    enabled: !!eventId && !!stageId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("participants")
        .select(
          "id, participant_event_stages!inner(event_stage_id, status), delegations(institutions(name))",
        )
        .eq("is_active", true)
        .not("credentialed_at", "is", null)
        .eq("participant_event_stages.event_stage_id", stageId)
        .eq("participant_event_stages.status", "active");
      if (activeKitTypes.length > 0) q = q.in("participant_type", activeKitTypes);
      const { data, error } = await q;
      if (error) throw error;
      const map = new Map<string, number>();
      for (const r of (data ?? []) as any[]) {
        const escola = r.delegations?.institutions?.name || SEM_ESCOLA;
        map.set(escola, (map.get(escola) ?? 0) + 1);
      }
      return map;
    },
  });

  // Consolidação por escola: entregues (do kit) x credenciados (da etapa).
  const schoolProgress = useMemo<SchoolProgress[]>(() => {
    const delivered = new Map<string, number>();
    for (const d of deliveries) {
      delivered.set(d.escola, (delivered.get(d.escola) ?? 0) + 1);
    }

    const escolas = new Set<string>([...delivered.keys()]);
    if (credentialedBySchool) {
      for (const k of credentialedBySchool.keys()) escolas.add(k);
    }

    const rows: SchoolProgress[] = [...escolas].map((escola) => {
      const del = delivered.get(escola) ?? 0;
      const total = credentialedBySchool ? credentialedBySchool.get(escola) ?? 0 : null;
      return {
        escola,
        delivered: del,
        total,
        faltam: total === null ? null : Math.max(0, total - del),
      };
    });

    rows.sort((a, b) => {
      // Com universo conhecido, prioriza quem ainda tem pendências.
      if (a.faltam !== null && b.faltam !== null && b.faltam !== a.faltam) {
        return b.faltam - a.faltam;
      }
      if (b.delivered !== a.delivered) return b.delivered - a.delivered;
      return a.escola.localeCompare(b.escola, "pt-BR");
    });

    return rows;
  }, [deliveries, credentialedBySchool]);

  const filteredDeliveries = useMemo(
    () =>
      schoolFilter
        ? deliveries.filter((d) => d.escola === schoolFilter)
        : deliveries,
    [deliveries, schoolFilter],
  );

  // Baseado só em entregas VINCULADAS: crachá não reconhecido não identifica
  // o participante, então não dá pra tirá-lo da lista de "quem falta" até
  // ser reconciliado (ver seção "Crachás não vinculados" abaixo).
  const faltam = Math.max(0, credentialedCount - totalDeliveredLinked);

  useStageModuleKpis([
    { label: "Entregues", value: totalDelivered, tone: "success" },
    ...(stageId
      ? [{ label: "Faltam", value: faltam, tone: "warning" as const }]
      : []),
    ...(revokedCount > 0
      ? [{ label: "Estornadas", value: revokedCount, tone: "danger" as const }]
      : []),
    ...(unlinkedDeliveries.length > 0
      ? [{ label: "Não vinculados", value: unlinkedDeliveries.length, tone: "warning" as const }]
      : []),
    ...(duplicateAttempts.length > 0
      ? [{ label: "Duplicadas", value: duplicateAttempts.length, tone: "warning" as const }]
      : []),
  ]);

  // Refs para os KPIs clicáveis rolarem até a seção correspondente.
  const entreguesRef = useRef<HTMLDivElement>(null);
  const faltamRef = useRef<HTMLDivElement>(null);
  const estornadasRef = useRef<HTMLDivElement>(null);
  const naoVinculadosRef = useRef<HTMLDivElement>(null);
  const duplicadasRef = useRef<HTMLDivElement>(null);
  const scrollTo = (ref: React.RefObject<HTMLDivElement>) =>
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const [pendingFilter, setPendingFilter] = useState("");
  const filteredPending = useMemo(() => {
    const q = pendingFilter.trim().toLowerCase();
    if (!q) return pendingParticipants;
    return pendingParticipants.filter(
      (p) => p.full_name.toLowerCase().includes(q) || (p.cpf || "").includes(q),
    );
  }, [pendingParticipants, pendingFilter]);

  return (
    <div className="space-y-4">
      {/* KPIs clicáveis — cada um rola até a lista correspondente */}
      {activeKitId && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <button
            type="button"
            onClick={() => scrollTo(entreguesRef)}
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-left transition-colors hover:bg-emerald-500/10"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Entregues
            </p>
            <p className="mt-0.5 text-2xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
              {totalDelivered}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {totalDeliveredLinked} identificados
              {unlinkedDeliveries.length > 0 && ` + ${unlinkedDeliveries.length} não vinc.`}
            </p>
          </button>

          {stageId && (
            <button
              type="button"
              onClick={() => scrollTo(faltamRef)}
              className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-left transition-colors hover:bg-amber-500/10"
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Faltam
              </p>
              <p className="mt-0.5 text-2xl font-extrabold tabular-nums text-amber-700 dark:text-amber-400">
                {faltam}
              </p>
              <p className="text-[10px] text-muted-foreground">de {credentialedCount} credenciados</p>
            </button>
          )}

          <button
            type="button"
            onClick={() => scrollTo(estornadasRef)}
            disabled={revokedCount === 0}
            className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-left transition-colors hover:bg-destructive/10 disabled:cursor-default disabled:opacity-60 disabled:hover:bg-destructive/5"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-destructive">
              Estornadas
            </p>
            <p className="mt-0.5 text-2xl font-extrabold tabular-nums text-destructive">
              {revokedCount}
            </p>
            <p className="text-[10px] text-muted-foreground">entregas desfeitas</p>
          </button>

          <button
            type="button"
            onClick={() => scrollTo(naoVinculadosRef)}
            disabled={unlinkedDeliveries.length === 0}
            className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-left transition-colors hover:bg-amber-500/10 disabled:cursor-default disabled:opacity-60 disabled:hover:bg-amber-500/5"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Não vinculados
            </p>
            <p className="mt-0.5 text-2xl font-extrabold tabular-nums text-amber-700 dark:text-amber-400">
              {unlinkedDeliveries.length}
            </p>
            <p className="text-[10px] text-muted-foreground">crachá não reconhecido</p>
          </button>

          <button
            type="button"
            onClick={() => scrollTo(duplicadasRef)}
            disabled={duplicateAttempts.length === 0}
            className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-left transition-colors hover:bg-amber-500/10 disabled:cursor-default disabled:opacity-60 disabled:hover:bg-amber-500/5"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Duplicadas
            </p>
            <p className="mt-0.5 text-2xl font-extrabold tabular-nums text-amber-700 dark:text-amber-400">
              {duplicateAttempts.length}
            </p>
            <p className="text-[10px] text-muted-foreground">tentativas de reentrega</p>
          </button>
        </div>
      )}

      {/* Gestão de Kits */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" /> Kits de Material
          </CardTitle>
          {canWrite && (
            <Button size="sm" onClick={openNewKit}>
              <Plus className="mr-1 h-4 w-4" /> Novo Kit
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {loadingKits ? (
            <Skeleton className="h-16 w-full" />
          ) : kits.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhum kit cadastrado para esta etapa. Crie um para começar.
            </p>
          ) : (
            kits.map((kit) => (
              <div
                key={kit.id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <button
                  type="button"
                  onClick={() => setSelectedKitId(kit.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{kit.name}</p>
                    {kit.id === activeKitId && (
                      <Badge variant="secondary" className="text-[10px]">
                        selecionado
                      </Badge>
                    )}
                    {!kit.is_active && (
                      <Badge variant="outline" className="text-[10px]">
                        inativo
                      </Badge>
                    )}
                  </div>
                  {kit.description && (
                    <p className="truncate text-xs text-muted-foreground">
                      {kit.description}
                    </p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {(eligibilityByKit[kit.id]?.length ?? 0) === 0 ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                        <Users className="h-3 w-3" /> Todos os perfis
                      </span>
                    ) : (
                      <>
                        <Users className="h-3 w-3 text-muted-foreground" />
                        {eligibilityByKit[kit.id]!.slice(0, 4).map((pt) => (
                          <Badge
                            key={pt}
                            variant="outline"
                            className="px-1.5 py-0 text-[10px]"
                          >
                            {ptLabel(pt)}
                          </Badge>
                        ))}
                        {eligibilityByKit[kit.id]!.length > 4 && (
                          <Badge
                            variant="outline"
                            className="px-1.5 py-0 text-[10px]"
                          >
                            +{eligibilityByKit[kit.id]!.length - 4}
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                </button>
                {canWrite && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditKit(kit)}
                    >
                      Editar
                    </Button>
                    <Switch
                      checked={kit.is_active}
                      onCheckedChange={() => toggleKit.mutate(kit)}
                      aria-label="Ativar/desativar kit"
                    />
                  </>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Acompanhamento por escola */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <School className="h-4 w-4" /> Por Escola
            {activeKit && (
              <span className="text-sm font-normal text-muted-foreground">
                · {activeKit.name}
              </span>
            )}
          </CardTitle>
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <Radio className="h-3.5 w-3.5 animate-pulse" /> ao vivo
          </span>
        </CardHeader>
        <CardContent className="space-y-2">
          {loadingDeliveries ? (
            <Skeleton className="h-24 w-full" />
          ) : schoolProgress.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma entrega registrada ainda para este kit.
            </p>
          ) : (
            <>
              {!stageId && (
                <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  Selecione uma etapa para ver o total de credenciados e quantos
                  faltam por escola. Sem etapa, mostramos apenas os entregues.
                </p>
              )}
              {schoolProgress.map((s) => {
                const isFiltered = schoolFilter === s.escola;
                const pct =
                  s.total && s.total > 0
                    ? Math.min(100, Math.round((s.delivered / s.total) * 100))
                    : null;
                return (
                  <button
                    key={s.escola}
                    type="button"
                    onClick={() =>
                      setSchoolFilter(isFiltered ? null : s.escola)
                    }
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      isFiltered
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate text-sm font-medium">
                        {s.escola}
                      </p>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Badge variant="secondary" className="text-[10px]">
                          {s.total !== null
                            ? `${s.delivered}/${s.total}`
                            : `${s.delivered} entregue${s.delivered === 1 ? "" : "s"}`}
                        </Badge>
                        {s.faltam !== null && s.faltam > 0 && (
                          <Badge
                            variant="outline"
                            className="border-amber-500/40 text-[10px] text-amber-600 dark:text-amber-400"
                          >
                            faltam {s.faltam}
                          </Badge>
                        )}
                        {s.faltam === 0 && (
                          <Badge className="bg-emerald-600 text-[10px] hover:bg-emerald-600">
                            completo
                          </Badge>
                        )}
                      </div>
                    </div>
                    {pct !== null && (
                      <Progress value={pct} className="mt-2 h-1.5" />
                    )}
                  </button>
                );
              })}
            </>
          )}
        </CardContent>
      </Card>

      {/* Relatório de entregas */}
      <Card ref={entreguesRef}>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <PackageCheck className="h-4 w-4" /> Entregas
            {activeKit && (
              <span className="text-sm font-normal text-muted-foreground">
                · {activeKit.name}
              </span>
            )}
          </CardTitle>
          {schoolFilter && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs"
              onClick={() => setSchoolFilter(null)}
            >
              <X className="h-3.5 w-3.5" />
              <span className="max-w-[10rem] truncate">{schoolFilter}</span>
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingDeliveries ? (
            <Skeleton className="h-24 w-full" />
          ) : filteredDeliveries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {schoolFilter
                ? "Nenhuma entrega desta escola para este kit."
                : "Nenhuma entrega registrada para este kit."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-2 font-medium">Participante</th>
                    <th className="py-2 pr-2 font-medium">Escola</th>
                    <th className="py-2 pr-2 font-medium">Tipo</th>
                    <th className="py-2 pr-2 font-medium">Data/Hora</th>
                    <th className="py-2 font-medium text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeliveries.map((d) => (
                    <tr key={d.id} className="border-b last:border-0">
                      <td className="py-2 pr-2">
                        <p className="font-medium">{d.full_name || "—"}</p>
                        {d.cpf && (
                          <p className="text-xs text-muted-foreground">{d.cpf}</p>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-muted-foreground">
                        {d.escola}
                      </td>
                      <td className="py-2 pr-2 text-muted-foreground">
                        {ptLabel(d.participant_type)}
                      </td>
                      <td className="py-2 pr-2 text-muted-foreground">
                        {format(new Date(d.delivered_at), "dd/MM HH:mm")}
                      </td>
                      <td className="py-2 text-right">
                        {canWrite && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Estornar a entrega de "${d.full_name || "esta pessoa"}"?`,
                                )
                              ) {
                                revoke.mutate(d.id);
                              }
                            }}
                          >
                            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Estornar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quem falta receber o kit */}
      {stageId && (
        <Card ref={faltamRef}>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserX className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Faltam Receber
              {activeKit && (
                <span className="text-sm font-normal text-muted-foreground">
                  · {activeKit.name}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Credenciados/elegíveis sem entrega vinculada ativa neste kit. Crachás
              não vinculados não identificam a pessoa, então não são descontados
              daqui até serem reconciliados.
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou CPF…"
                value={pendingFilter}
                onChange={(e) => setPendingFilter(e.target.value)}
                className="pl-9"
              />
            </div>
            {loadingPending ? (
              <Skeleton className="h-24 w-full" />
            ) : filteredPending.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {pendingParticipants.length === 0
                  ? "Todo mundo já recebeu o kit."
                  : "Nenhum resultado para essa busca."}
              </p>
            ) : (
              <div className="max-h-96 overflow-y-auto overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-2 font-medium">Participante</th>
                      <th className="py-2 pr-2 font-medium">Escola</th>
                      <th className="py-2 font-medium">Tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPending.map((p) => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2 pr-2">
                          <p className="font-medium">{p.full_name || "—"}</p>
                          {p.cpf && (
                            <p className="text-xs text-muted-foreground">{p.cpf}</p>
                          )}
                        </td>
                        <td className="py-2 pr-2 text-muted-foreground">{p.escola}</td>
                        <td className="py-2 text-muted-foreground">
                          {ptLabel(p.participant_type)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Entregas estornadas */}
      <Card ref={estornadasRef}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Undo2 className="h-4 w-4 text-destructive" /> Entregas Estornadas
            {activeKit && (
              <span className="text-sm font-normal text-muted-foreground">
                · {activeKit.name}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRevoked ? (
            <Skeleton className="h-16 w-full" />
          ) : revokedDeliveries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma entrega estornada para este kit.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-2 font-medium">Participante</th>
                    <th className="py-2 pr-2 font-medium">Escola</th>
                    <th className="py-2 pr-2 font-medium">Entregue em</th>
                    <th className="py-2 font-medium">Estornado em</th>
                  </tr>
                </thead>
                <tbody>
                  {revokedDeliveries.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2 pr-2">
                        <p className="font-medium">{r.full_name || "—"}</p>
                        {r.cpf && (
                          <p className="text-xs text-muted-foreground">{r.cpf}</p>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-muted-foreground">{r.escola}</td>
                      <td className="py-2 pr-2 text-muted-foreground">
                        {format(new Date(r.delivered_at), "dd/MM HH:mm")}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {r.revoked_at ? format(new Date(r.revoked_at), "dd/MM HH:mm") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Crachás não vinculados (não reconhecidos no momento do scan) */}
      <Card ref={naoVinculadosRef}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Crachás
            Não Vinculados
            {activeKit && (
              <span className="text-sm font-normal text-muted-foreground">
                · {activeKit.name}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            O material foi entregue, mas o crachá não foi reconhecido no momento
            do scan (offline sem cache, ou código sem vínculo). Reconcilie via
            importação de credencial externa para associar o nome.
          </p>
          {loadingUnlinked ? (
            <Skeleton className="h-16 w-full" />
          ) : unlinkedDeliveries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum crachá não vinculado para este kit.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-2 font-medium">Código do crachá</th>
                    <th className="py-2 font-medium">Entregue em</th>
                  </tr>
                </thead>
                <tbody>
                  {unlinkedDeliveries.map((u) => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="py-2 pr-2 font-mono">{u.qr_code}</td>
                      <td className="py-2 text-muted-foreground">
                        {format(new Date(u.delivered_at), "dd/MM HH:mm")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tentativas de entrega duplicada (crachá já recebeu este kit) */}
      <Card ref={duplicadasRef}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Copy className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Tentativas de
            Duplicação
            {activeKit && (
              <span className="text-sm font-normal text-muted-foreground">
                · {activeKit.name}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Crachás escaneados que já haviam recebido este kit — a entrega foi
            bloqueada (sem duplicar o material), mas a tentativa fica registrada
            aqui para auditoria.
          </p>
          {loadingDuplicates ? (
            <Skeleton className="h-16 w-full" />
          ) : duplicateAttempts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma tentativa de duplicação registrada para este kit.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-2 font-medium">Participante</th>
                    <th className="py-2 pr-2 font-medium">Escola</th>
                    <th className="py-2 pr-2 font-medium">Tipo</th>
                    <th className="py-2 pr-2 font-medium">Operador</th>
                    <th className="py-2 font-medium">Tentativa em</th>
                  </tr>
                </thead>
                <tbody>
                  {duplicateAttempts.map((d) => (
                    <tr key={d.id} className="border-b last:border-0">
                      <td className="py-2 pr-2">
                        {d.linked ? (
                          <>
                            <p className="font-medium">{d.full_name || "—"}</p>
                            {d.cpf && (
                              <p className="text-xs text-muted-foreground">{d.cpf}</p>
                            )}
                          </>
                        ) : (
                          <>
                            <p className="font-medium text-amber-600 dark:text-amber-400">
                              Crachá não vinculado
                            </p>
                            <p className="font-mono text-xs text-muted-foreground">
                              {d.qr_code}
                            </p>
                          </>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-muted-foreground">{d.escola || "—"}</td>
                      <td className="py-2 pr-2 text-muted-foreground">
                        {d.linked ? ptLabel(d.participant_type) : "—"}
                      </td>
                      <td className="py-2 pr-2 text-muted-foreground">
                        {d.operator_name || "—"}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {format(new Date(d.created_at), "dd/MM HH:mm")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog criar/editar kit */}
      <Dialog open={kitDialog !== null} onOpenChange={(o) => !o && setKitDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {kitDialog === "new" ? "Novo Kit de Material" : "Editar Kit"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="kit-name">Nome</Label>
              <Input
                id="kit-name"
                value={kitName}
                onChange={(e) => setKitName(e.target.value)}
                placeholder="Ex: Kit do Atleta JER 2026"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="kit-desc">Descrição (opcional)</Label>
              <Textarea
                id="kit-desc"
                value={kitDesc}
                onChange={(e) => setKitDesc(e.target.value)}
                placeholder="Ex: Camiseta, sacola e credencial"
              />
            </div>

            {/* Público-alvo: quais perfis recebem este kit */}
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" /> Quem recebe este kit
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {restrictEligibility
                      ? "Apenas os perfis marcados poderão receber."
                      : "Todos os perfis credenciados podem receber."}
                  </p>
                </div>
                <Switch
                  checked={restrictEligibility}
                  onCheckedChange={(v) => setRestrictEligibility(v)}
                  aria-label="Restringir por perfil"
                />
              </div>

              {restrictEligibility && (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {PARTICIPANT_TYPES.map((pt) => {
                      const active = kitEligibility.has(pt.value);
                      return (
                        <button
                          key={pt.value}
                          type="button"
                          onClick={() => toggleEligibilityType(pt.value)}
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background hover:bg-muted"
                          }`}
                        >
                          {pt.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <button
                      type="button"
                      className="underline-offset-2 hover:underline"
                      onClick={() =>
                        setKitEligibility(
                          new Set(PARTICIPANT_TYPES.map((p) => p.value)),
                        )
                      }
                    >
                      Selecionar todos
                    </button>
                    <button
                      type="button"
                      className="underline-offset-2 hover:underline"
                      onClick={() => setKitEligibility(new Set())}
                    >
                      Limpar
                    </button>
                  </div>
                  {kitEligibility.size === 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Nenhum perfil marcado: com a restrição ligada, ninguém
                      poderá receber. Marque ao menos um perfil.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKitDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={() => saveKit.mutate()} disabled={saveKit.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
