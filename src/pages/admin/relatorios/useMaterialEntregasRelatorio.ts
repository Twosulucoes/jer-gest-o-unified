import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const SEM_ESCOLA = "Sem escola/delegação";
export const CRACHA_NAO_VINCULADO = "Crachá não vinculado";

export const PARTICIPANT_TYPE_LABELS: Record<string, string> = {
  athlete: "Atleta",
  coach: "Técnico",
  head_of_delegation: "Chefe de Delegação",
  official: "Oficial",
  staff: "Staff",
  motorista: "Motorista",
  agente_operacao: "Agente de Operação",
  logistica: "Logística",
  cozinheira: "Cozinheira",
  guia: "Guia",
  secretaria: "Secretaria",
  mesario: "Mesário",
  arbitro: "Árbitro",
  delegado: "Delegado",
  fiscal: "Fiscal",
  operador_pesquisa: "Operador de Pesquisa",
  tecnico_ti: "Técnico de TI",
  terceiro: "Terceiro",
  colaborador: "Colaborador",
};

export const ptLabel = (v: string | null | undefined) =>
  (v && PARTICIPANT_TYPE_LABELS[v]) || v || "—";

export interface MaterialKitSummary {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  event_stage_id: string | null;
  stage_name: string | null;
  delivered: number;
  revoked: number;
  credentialed: number | null;
  faltam: number | null;
}

export interface MaterialDeliveryRow {
  id: string;
  kit_id: string;
  kit_name: string;
  delivered_at: string;
  method: string;
  status: string;
  /** false = crachá bipado mas não reconhecido no momento do scan (material_deliveries_unlinked). */
  linked: boolean;
  full_name: string;
  cpf: string | null;
  participant_type: string;
  escola: string;
  qr_code?: string | null;
}

export interface MaterialSchoolBreakdownRow {
  kit_id: string;
  kit_name: string;
  escola: string;
  delivered: number;
  total: number | null;
  faltam: number | null;
}

/**
 * Conferência de quantidade — os números "de controle" do módulo. Entrega de
 * material serve para controlar quantidade: todo bipe com material saído conta
 * como entrega, tenha ou não o crachá sido reconhecido. Este resumo deixa
 * explícito o total e a quebra identificadas x não identificadas, além da
 * conferência contra o universo credenciado.
 */
export interface MaterialResumoQuantidade {
  /** Total de kits que saíram (identificadas + não identificadas). Nº de controle. */
  entreguesTotal: number;
  /** Crachá reconhecido — entrega com nome. */
  identificadas: number;
  /** Crachá bipado mas não cadastrado no sistema (pendente de reconciliação). */
  naoIdentificadas: number;
  /** Entregas estornadas (material devolvido/anulado). */
  estornadas: number;
  /** Universo credenciado (null quando a etapa não é conhecida). */
  credenciados: number | null;
  /** entreguesTotal - credenciados. Positivo = saíram mais kits que credenciados. */
  diferenca: number | null;
}

/** Consolida os números de controle a partir dos dados já carregados. Puro —
 *  reaproveitado pela tela e pelos exportadores (PDF/XLSX). */
export function computeResumoQuantidade(
  kits: MaterialKitSummary[],
  deliveries: MaterialDeliveryRow[],
): MaterialResumoQuantidade {
  const entreguesTotal = kits.reduce((sum, k) => sum + k.delivered, 0);
  const identificadas = deliveries.filter((d) => d.linked && d.status === "active").length;
  const naoIdentificadas = deliveries.filter((d) => !d.linked).length;
  const estornadas = kits.reduce((sum, k) => sum + k.revoked, 0);
  const hasCredenciados = kits.some((k) => k.credentialed !== null);
  const credenciados = hasCredenciados
    ? kits.reduce((sum, k) => sum + (k.credentialed ?? 0), 0)
    : null;
  const diferenca = credenciados === null ? null : entreguesTotal - credenciados;
  return { entreguesTotal, identificadas, naoIdentificadas, estornadas, credenciados, diferenca };
}

export function useMaterialEntregasRelatorio(eventId: string | null) {
  const qc = useQueryClient();

  const { data: kitsRaw = [], isLoading: loadingKits } = useQuery({
    queryKey: ["material_relatorio_kits", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("material_kits")
        .select("id, name, description, is_active, event_stage_id, event_stages(name)")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const kitIds = useMemo(() => kitsRaw.map((k) => k.id), [kitsRaw]);

  const { data: eligibilityByKit = {} } = useQuery({
    queryKey: ["material_relatorio_eligibility", kitIds],
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

  const { data: deliveriesRaw = [], isLoading: loadingDeliveries } = useQuery({
    queryKey: ["material_relatorio_deliveries", kitIds],
    enabled: kitIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("material_deliveries")
        .select(
          `id, kit_id, delivered_at, method, status,
           participants!inner(participant_type, people!inner(full_name, cpf), delegations(institutions(name)))`,
        )
        .in("kit_id", kitIds)
        .order("delivered_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Crachás bipados mas ainda não vinculados a um participante — o kit já foi
  // fisicamente entregue, só falta a reconciliação (mesmo padrão do PWA em
  // MaterialListaPage: não pode ficar de fora da contagem de entregues).
  const { data: unlinkedRaw = [], isLoading: loadingUnlinked } = useQuery({
    queryKey: ["material_relatorio_unlinked", kitIds],
    enabled: kitIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("material_deliveries_unlinked")
        .select("id, kit_id, delivered_at, method, qr_code")
        .in("kit_id", kitIds)
        .order("delivered_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Universo de credenciados (ativos e credenciados) do evento, com a etapa
  // em que estão vinculados — usado para calcular "faltam" por kit/escola.
  const { data: credentialedRows = [] } = useQuery({
    queryKey: ["material_relatorio_credentialed", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("participants")
        .select(
          "id, participant_type, delegations(institutions(name)), participant_event_stages!inner(event_stage_id, status)",
        )
        .eq("event_id", eventId)
        .eq("is_active", true)
        .not("credentialed_at", "is", null)
        .eq("participant_event_stages.status", "active");
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        id: r.id as string,
        participant_type: r.participant_type as string,
        escola: r.delegations?.institutions?.name || SEM_ESCOLA,
        event_stage_id: r.participant_event_stages?.event_stage_id as string,
      }));
    },
  });

  const kitsMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const k of kitsRaw) map.set(k.id, k);
    return map;
  }, [kitsRaw]);

  const deliveries = useMemo<MaterialDeliveryRow[]>(() => {
    const linked: MaterialDeliveryRow[] = deliveriesRaw.map((r) => ({
      id: r.id,
      kit_id: r.kit_id,
      kit_name: kitsMap.get(r.kit_id)?.name || "—",
      delivered_at: r.delivered_at,
      method: r.method,
      status: r.status,
      linked: true,
      full_name: r.participants?.people?.full_name || "",
      cpf: r.participants?.people?.cpf || null,
      participant_type: r.participants?.participant_type || "",
      escola: r.participants?.delegations?.institutions?.name || SEM_ESCOLA,
    }));

    const unlinked: MaterialDeliveryRow[] = unlinkedRaw.map((r) => ({
      id: r.id,
      kit_id: r.kit_id,
      kit_name: kitsMap.get(r.kit_id)?.name || "—",
      delivered_at: r.delivered_at,
      method: r.method,
      status: "active",
      linked: false,
      full_name: "",
      cpf: null,
      participant_type: "",
      escola: CRACHA_NAO_VINCULADO,
      qr_code: r.qr_code,
    }));

    return [...linked, ...unlinked].sort(
      (a, b) => new Date(b.delivered_at).getTime() - new Date(a.delivered_at).getTime(),
    );
  }, [deliveriesRaw, unlinkedRaw, kitsMap]);

  const kits = useMemo<MaterialKitSummary[]>(() => {
    return kitsRaw.map((k) => {
      const kitDeliveries = deliveries.filter((d) => d.kit_id === k.id);
      const delivered = kitDeliveries.filter((d) => d.status === "active").length;
      const revoked = kitDeliveries.filter((d) => d.status === "revoked").length;

      const eligibleTypes = eligibilityByKit[k.id] ?? [];
      let universe = k.event_stage_id
        ? credentialedRows.filter((r) => r.event_stage_id === k.event_stage_id)
        : (() => {
            const seen = new Set<string>();
            return credentialedRows.filter((r) => {
              if (seen.has(r.id)) return false;
              seen.add(r.id);
              return true;
            });
          })();
      if (eligibleTypes.length > 0) {
        universe = universe.filter((r) => eligibleTypes.includes(r.participant_type));
      }
      const credentialed = universe.length;

      return {
        id: k.id,
        name: k.name,
        description: k.description,
        is_active: k.is_active,
        event_stage_id: k.event_stage_id,
        stage_name: k.event_stages?.name ?? null,
        delivered,
        revoked,
        credentialed,
        faltam: Math.max(0, credentialed - delivered),
      };
    });
  }, [kitsRaw, deliveries, eligibilityByKit, credentialedRows]);

  const schoolBreakdown = useMemo<MaterialSchoolBreakdownRow[]>(() => {
    const rows: MaterialSchoolBreakdownRow[] = [];
    for (const k of kitsRaw) {
      const eligibleTypes = eligibilityByKit[k.id] ?? [];
      let universe = k.event_stage_id
        ? credentialedRows.filter((r) => r.event_stage_id === k.event_stage_id)
        : (() => {
            const seen = new Set<string>();
            return credentialedRows.filter((r) => {
              if (seen.has(r.id)) return false;
              seen.add(r.id);
              return true;
            });
          })();
      if (eligibleTypes.length > 0) {
        universe = universe.filter((r) => eligibleTypes.includes(r.participant_type));
      }

      const totalBySchool = new Map<string, number>();
      for (const r of universe) totalBySchool.set(r.escola, (totalBySchool.get(r.escola) ?? 0) + 1);

      const deliveredBySchool = new Map<string, number>();
      for (const d of deliveries.filter((d) => d.kit_id === k.id && d.status === "active")) {
        deliveredBySchool.set(d.escola, (deliveredBySchool.get(d.escola) ?? 0) + 1);
      }

      const escolas = new Set<string>([...totalBySchool.keys(), ...deliveredBySchool.keys()]);
      for (const escola of escolas) {
        const delivered = deliveredBySchool.get(escola) ?? 0;
        // Crachás não vinculados não pertencem ao universo de credenciados de
        // nenhuma escola conhecida — não faz sentido calcular "faltam" aqui.
        const isUnlinkedBucket = escola === CRACHA_NAO_VINCULADO;
        const total = isUnlinkedBucket ? null : totalBySchool.get(escola) ?? 0;
        rows.push({
          kit_id: k.id,
          kit_name: k.name,
          escola,
          delivered,
          total,
          faltam: total === null ? null : Math.max(0, total - delivered),
        });
      }
    }
    rows.sort((a, b) => a.kit_name.localeCompare(b.kit_name, "pt-BR") || a.escola.localeCompare(b.escola, "pt-BR"));
    return rows;
  }, [kitsRaw, eligibilityByKit, credentialedRows, deliveries]);

  const resumoQuantidade = useMemo(
    () => computeResumoQuantidade(kits, deliveries),
    [kits, deliveries],
  );

  const refetchAll = async () => {
    await qc.invalidateQueries({ queryKey: ["material_relatorio_kits", eventId] });
    await qc.invalidateQueries({ queryKey: ["material_relatorio_deliveries"] });
    await qc.invalidateQueries({ queryKey: ["material_relatorio_unlinked"] });
    await qc.invalidateQueries({ queryKey: ["material_relatorio_credentialed", eventId] });
  };

  return {
    kits,
    deliveries,
    schoolBreakdown,
    resumoQuantidade,
    isLoading: loadingKits || loadingDeliveries || loadingUnlinked,
    refetchAll,
  };
}
