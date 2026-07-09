import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ptLabel, CRACHA_NAO_VINCULADO } from "./useMaterialEntregasRelatorio";

const SEM_ESCOLA = "Sem escola/delegação";

/**
 * Janela usada para classificar uma tentativa de duplicidade como "erro
 * técnico" (mesmo operador relendo o mesmo crachá ainda em quadro na câmera)
 * em vez de "tentativa real" de reentrega. Baseado em análise de casos reais:
 * releituras técnicas ficaram sempre abaixo de 15s (mesmo operador); toda
 * tentativa real observada teve horas de intervalo, frequentemente com
 * operador diferente. 120s dá margem confortável nos dois sentidos.
 */
export const ERRO_TECNICO_JANELA_SEGUNDOS = 120;

export type MaterialDuplicidadeClassificacao = "erro_tecnico" | "tentativa_real" | "indeterminado";

export interface MaterialDuplicidadeRow {
  id: string;
  kit_id: string;
  kit_name: string;
  linked: boolean;
  full_name: string;
  cpf: string | null;
  participant_type: string | null;
  escola: string;
  qr_code: string | null;

  attempt_at: string;
  attempt_operator_id: string | null;
  attempt_operator_name: string | null;

  delivery_id: string | null;
  delivery_at: string | null;
  delivery_operator_id: string | null;
  delivery_operator_name: string | null;

  delta_seconds: number | null;
  same_operator: boolean | null;
  classificacao: MaterialDuplicidadeClassificacao;
}

export function classificacaoLabel(c: MaterialDuplicidadeClassificacao) {
  switch (c) {
    case "erro_tecnico":
      return "Erro técnico (releitura)";
    case "tentativa_real":
      return "Tentativa real de reentrega";
    default:
      return "Indeterminado";
  }
}

/** Formata um intervalo em segundos como "2s", "14min32s", "18h23min". */
export function formatDeltaSegundos(segundos: number | null) {
  if (segundos === null) return "—";
  const s = Math.round(segundos);
  if (s < 60) return `${s}s`;
  const min = Math.floor(s / 60);
  const restSeg = s % 60;
  if (min < 60) return restSeg > 0 ? `${min}min${restSeg}s` : `${min}min`;
  const h = Math.floor(min / 60);
  const restMin = min % 60;
  return restMin > 0 ? `${h}h${restMin}min` : `${h}h`;
}

export function useMaterialDuplicidadesRelatorio(eventId: string | null) {
  const qc = useQueryClient();

  const { data: kitsRaw = [], isLoading: loadingKits } = useQuery({
    queryKey: ["material_duplicidades_kits", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("material_kits")
        .select("id, name")
        .eq("event_id", eventId);
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const kitsMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const k of kitsRaw) map.set(k.id, k.name);
    return map;
  }, [kitsRaw]);

  const kitIds = useMemo(() => kitsRaw.map((k) => k.id), [kitsRaw]);

  const { data: attemptsRaw = [], isLoading: loadingAttempts } = useQuery({
    queryKey: ["material_duplicidades_attempts", kitIds],
    enabled: kitIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("audit_events")
        .select("id, created_at, created_by, table_name, record_id, payload")
        .eq("action", "duplicate_delivery_attempt")
        .in("payload->>kit_id", kitIds)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const linkedDeliveryIds = useMemo(
    () =>
      Array.from(
        new Set(
          attemptsRaw
            .filter((r) => r.table_name === "material_deliveries")
            .map((r) => r.record_id as string),
        ),
      ),
    [attemptsRaw],
  );

  const unlinkedDeliveryIds = useMemo(
    () =>
      Array.from(
        new Set(
          attemptsRaw
            .filter((r) => r.table_name === "material_deliveries_unlinked")
            .map((r) => r.record_id as string),
        ),
      ),
    [attemptsRaw],
  );

  const { data: linkedDeliveriesById = {} } = useQuery({
    queryKey: ["material_duplicidades_linked_deliveries", linkedDeliveryIds],
    enabled: linkedDeliveryIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("material_deliveries")
        .select(
          `id, kit_id, delivered_at, delivered_by,
           participants!inner(participant_type, people!inner(full_name, cpf), delegations(institutions(name)))`,
        )
        .in("id", linkedDeliveryIds);
      if (error) throw error;
      const map: Record<string, any> = {};
      for (const r of (data ?? []) as any[]) map[r.id] = r;
      return map;
    },
  });

  const { data: unlinkedDeliveriesById = {} } = useQuery({
    queryKey: ["material_duplicidades_unlinked_deliveries", unlinkedDeliveryIds],
    enabled: unlinkedDeliveryIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("material_deliveries_unlinked")
        .select("id, kit_id, delivered_at, delivered_by, qr_code")
        .in("id", unlinkedDeliveryIds);
      if (error) throw error;
      const map: Record<string, any> = {};
      for (const r of (data ?? []) as any[]) map[r.id] = r;
      return map;
    },
  });

  const operatorIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of attemptsRaw) if (r.created_by) ids.add(r.created_by);
    for (const d of Object.values(linkedDeliveriesById) as any[]) if (d.delivered_by) ids.add(d.delivered_by);
    for (const d of Object.values(unlinkedDeliveriesById) as any[]) if (d.delivered_by) ids.add(d.delivered_by);
    return Array.from(ids);
  }, [attemptsRaw, linkedDeliveriesById, unlinkedDeliveriesById]);

  const { data: operatorNamesById = {} } = useQuery({
    queryKey: ["material_duplicidades_operators", operatorIds],
    enabled: operatorIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", operatorIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const r of data ?? []) map[r.id] = r.full_name;
      return map;
    },
  });

  const rows = useMemo<MaterialDuplicidadeRow[]>(() => {
    return attemptsRaw.map((r) => {
      const linked = r.table_name === "material_deliveries";
      const delivery = linked ? linkedDeliveriesById[r.record_id] : unlinkedDeliveriesById[r.record_id];

      const participant = linked ? delivery?.participants : null;
      const full_name = participant?.people?.full_name || "";
      const cpf = participant?.people?.cpf || null;
      const participant_type = participant?.participant_type || null;
      const escola = linked
        ? participant?.delegations?.institutions?.name || SEM_ESCOLA
        : CRACHA_NAO_VINCULADO;
      const qr_code = !linked ? delivery?.qr_code || r.payload?.qr_code || null : null;

      const attempt_operator_id = r.created_by || null;
      const delivery_operator_id = delivery?.delivered_by || null;
      const delivery_at = delivery?.delivered_at || null;

      let delta_seconds: number | null = null;
      let same_operator: boolean | null = null;
      let classificacao: MaterialDuplicidadeClassificacao = "indeterminado";

      if (delivery_at) {
        delta_seconds = (new Date(r.created_at).getTime() - new Date(delivery_at).getTime()) / 1000;
        same_operator = !!attempt_operator_id && attempt_operator_id === delivery_operator_id;
        classificacao =
          same_operator && delta_seconds <= ERRO_TECNICO_JANELA_SEGUNDOS ? "erro_tecnico" : "tentativa_real";
      }

      return {
        id: r.id,
        kit_id: r.payload?.kit_id || delivery?.kit_id || "",
        kit_name: kitsMap.get(r.payload?.kit_id || delivery?.kit_id) || "—",
        linked,
        full_name,
        cpf,
        participant_type,
        escola,
        qr_code,
        attempt_at: r.created_at,
        attempt_operator_id,
        attempt_operator_name: (attempt_operator_id && operatorNamesById[attempt_operator_id]) || null,
        delivery_id: delivery?.id || null,
        delivery_at,
        delivery_operator_id,
        delivery_operator_name: (delivery_operator_id && operatorNamesById[delivery_operator_id]) || null,
        delta_seconds,
        same_operator,
        classificacao,
      };
    });
  }, [attemptsRaw, linkedDeliveriesById, unlinkedDeliveriesById, kitsMap, operatorNamesById]);

  const totals = useMemo(
    () => ({
      total: rows.length,
      erroTecnico: rows.filter((r) => r.classificacao === "erro_tecnico").length,
      tentativaReal: rows.filter((r) => r.classificacao === "tentativa_real").length,
      indeterminado: rows.filter((r) => r.classificacao === "indeterminado").length,
    }),
    [rows],
  );

  const refetchAll = async () => {
    await qc.invalidateQueries({ queryKey: ["material_duplicidades_kits", eventId] });
    await qc.invalidateQueries({ queryKey: ["material_duplicidades_attempts"] });
    await qc.invalidateQueries({ queryKey: ["material_duplicidades_linked_deliveries"] });
    await qc.invalidateQueries({ queryKey: ["material_duplicidades_unlinked_deliveries"] });
  };

  return {
    rows,
    totals,
    isLoading: loadingKits || loadingAttempts,
    refetchAll,
  };
}

export { ptLabel };
