// ============================================================
// useLodgingOccupancy — hook centralizado de ocupação
// Etapa 6 da auditoria de Alojamento
// (docs/modulos/alojamento-auditoria.md)
//
// Centraliza a contagem de ocupações por unidade e os totais do
// stage. Antes desta lib, Hub e UnidadesPage replicavam a mesma
// query + loop de agregação (achado 🟡 da reauditoria).
//
// Status considerados ATIVOS para fins de "ocupação corrente":
//   - allocated  (planejado para a unidade)
//   - checked_in (efetivamente hospedado)
//
// Status considerados INATIVOS (não contam como ocupação corrente):
//   - planned, checked_out, cancelled
//
// O hook devolve as 5 contagens separadas + soma "active" para
// quem precisa do detalhamento (ex.: Presenca/Divergencias) sem
// reconsultar o banco.
// ============================================================

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LodgingOccupancyCounts {
  planned: number;
  allocated: number;
  checked_in: number;
  checked_out: number;
  cancelled: number;
  /** allocated + checked_in (= "ocupação corrente"). */
  active: number;
}

export interface LodgingOccupancyRow {
  id: string;
  unit_id: string;
  participant_id: string;
  status: string;
  event_id: string;
  event_stage_id: string | null;
}

export interface LodgingOccupancyResult {
  /** Linhas brutas (apenas as colunas necessárias para agregação). */
  rows: LodgingOccupancyRow[];
  /** Map unit_id → contagens detalhadas. */
  countsByUnit: Map<string, LodgingOccupancyCounts>;
  /** Totais agregados sobre todas as unidades do stage. */
  totals: LodgingOccupancyCounts;
  isLoading: boolean;
  isError: boolean;
}

const ZERO_COUNTS: LodgingOccupancyCounts = {
  planned: 0,
  allocated: 0,
  checked_in: 0,
  checked_out: 0,
  cancelled: 0,
  active: 0,
};

function increment(counts: LodgingOccupancyCounts, status: string): LodgingOccupancyCounts {
  const next = { ...counts };
  switch (status) {
    case "planned":     next.planned += 1; break;
    case "allocated":   next.allocated += 1; next.active += 1; break;
    case "checked_in":  next.checked_in += 1; next.active += 1; break;
    case "checked_out": next.checked_out += 1; break;
    case "cancelled":   next.cancelled += 1; break;
    // Statuses fora do CHECK constraint não devem chegar aqui;
    // se chegarem, são silenciosamente ignorados na soma.
  }
  return next;
}

/**
 * Hook único para ocupação de alojamento, scoped por stage.
 *
 * @example
 * const { countsByUnit, totals, isLoading } = useLodgingOccupancy(stageId);
 * const counts = countsByUnit.get(unitId) ?? ZERO_COUNTS;
 * <p>{counts.active}/{unit.capacity}</p>
 */
export function useLodgingOccupancy(stageId: string | null | undefined): LodgingOccupancyResult {
  const { data: rows = [], isLoading, isError } = useQuery({
    queryKey: ["lodging_occupancy_full", stageId],
    enabled: !!stageId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("lodging_occupancies") as any)
        .select("id, unit_id, participant_id, status, event_id, event_stage_id")
        .eq("event_stage_id", stageId);
      if (error) throw error;
      return (data ?? []) as LodgingOccupancyRow[];
    },
  });

  return useMemo(() => {
    const countsByUnit = new Map<string, LodgingOccupancyCounts>();
    let totals: LodgingOccupancyCounts = { ...ZERO_COUNTS };

    for (const row of rows) {
      const current = countsByUnit.get(row.unit_id) ?? { ...ZERO_COUNTS };
      countsByUnit.set(row.unit_id, increment(current, row.status));
      totals = increment(totals, row.status);
    }

    return { rows, countsByUnit, totals, isLoading, isError };
  }, [rows, isLoading, isError]);
}

/** Helper estático para consumidores que recebem `countsByUnit` por prop. */
export function emptyOccupancyCounts(): LodgingOccupancyCounts {
  return { ...ZERO_COUNTS };
}
