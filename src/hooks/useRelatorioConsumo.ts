import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";

export type SyncStatus = "all" | "realtime" | "queue" | "duplicidade";
export type OrigemFilter = "all" | "scan_qr" | "busca_manual" | "voucher";

export interface RelatorioFiltros {
  eventId: string | null;
  etapaId?: string;
  dataInicio?: string;
  dataFim?: string;
  operadorId?: string;
  syncStatus?: SyncStatus;
  origem?: OrigemFilter;
}

// ── Row types matching each view ──────────────────────────────────────────────

export interface ConsumoCompletoRow {
  id: string;
  created_at: string;
  consumed_at: string;
  participante_nome: string;
  participante_cpf: string | null;
  participante_id: string;
  etapa_nome: string | null;
  etapa_id: string | null;
  janela_nome: string;
  janela_data: string;
  janela_inicio: string;
  janela_fim: string;
  refeicao_tipo: string;
  registrado_por_nome: string | null;
  registrado_por_id: string;
  sync_status: "realtime" | "queue";
  sync_at: string | null;
  sync_delay_segundos: number | null;
  origem: "scan_qr" | "voucher" | "busca_manual";
  device_info: Record<string, unknown> | null;
  duplicidade_detectada: boolean;
  method: string;
  notes: string | null;
  event_id: string;
  event_stage_id: string | null;
}

export interface ConsumoPorDiaRow {
  data: string;
  etapa_nome: string | null;
  etapa_id: string | null;
  event_id: string;
  event_stage_id: string | null;
  total_consumos: number;
  total_realtime: number;
  total_queue: number;
  total_duplicidade: number;
  usuarios_distintos: number;
  participantes_distintos: number;
}

export interface ConsumoPorJanelaRow {
  data: string;
  etapa_nome: string | null;
  etapa_id: string | null;
  janela_id: string;
  janela_nome: string;
  refeicao_tipo: string;
  horario_inicio: string;
  horario_fim: string;
  event_id: string;
  event_stage_id: string | null;
  total_consumos: number;
  total_realtime: number;
  total_queue: number;
  total_duplicidade: number;
  primeiro_consumo: string | null;
  ultimo_consumo: string | null;
}

export interface ConsumoPorOperadorRow {
  operador_nome: string;
  operador_id: string;
  data: string;
  etapa_nome: string | null;
  etapa_id: string | null;
  janela_nome: string;
  janela_id: string;
  event_id: string;
  event_stage_id: string | null;
  total_registrado: number;
  total_scan_qr: number;
  total_manual: number;
  total_voucher: number;
  primeiro_scan: string | null;
  ultimo_scan: string | null;
  media_intervalo_segundos: number | null;
}

export interface ErroSyncRow {
  id: string;
  created_at: string;
  consumed_at: string;
  participante_nome: string;
  participante_id: string;
  etapa_nome: string | null;
  etapa_id: string | null;
  janela_nome: string;
  janela_data: string;
  sync_status: string;
  is_offline: boolean;
  sync_at: string | null;
  sync_delay_segundos: number | null;
  duplicidade_detectada: boolean;
  device_info: Record<string, unknown> | null;
  method: string;
  notes: string | null;
  registrado_por_nome: string | null;
  registrado_por_id: string;
  event_id: string;
  event_stage_id: string | null;
}

export interface ConsumoPorEtapaRow {
  etapa_nome: string;
  etapa_id: string;
  data_inicio: string | null;
  data_fim: string | null;
  event_id: string;
  total_refeicoes: number;
  total_participantes_distintos: number;
  media_por_dia: number;
  total_erros: number;
  total_queue: number;
  total_realtime: number;
  taxa_erro_percent: number;
}

// ── Summary card numbers ───────────────────────────────────────────────────────

export interface RelatorioResumo {
  totalRefeicoes: number;
  totalRealtime: number;
  totalQueue: number;
  totalDuplicidade: number;
  pctRealtime: number;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useRelatorioConsumo(filtros: RelatorioFiltros) {
  const debouncedFiltros = useDebounce(filtros, 300);
  const {
    eventId,
    etapaId,
    dataInicio,
    dataFim,
    operadorId,
    syncStatus,
    origem,
  } = debouncedFiltros;

  const enabled = !!eventId;
  const queryKey = [
    "relatorio-consumo",
    eventId,
    etapaId,
    dataInicio,
    dataFim,
    operadorId,
    syncStatus,
    origem,
  ];

  // Filtros compartilhados entre a query de detalhe (completoQuery, com
  // limit) e a de resumo (contagens exatas, sem limit) — mesma regra nos
  // dois lugares para não divergir.
  function applyConsumoCompletoFilters(q: any) {
    let query = q.eq("event_id", eventId);
    if (etapaId) query = query.eq("event_stage_id", etapaId);
    if (dataInicio) query = query.gte("janela_data", dataInicio);
    if (dataFim) query = query.lte("janela_data", dataFim);
    if (operadorId) query = query.eq("registrado_por_id", operadorId);
    if (syncStatus && syncStatus !== "all") {
      if (syncStatus === "duplicidade") {
        query = query.eq("duplicidade_detectada", true);
      } else {
        query = query.eq("sync_status", syncStatus);
      }
    }
    if (origem && origem !== "all") query = query.eq("origem", origem);
    return query;
  }

  // ── vw_consumo_completo ────────────────────────────────────────────────────
  // PostgREST trunca em 1000 por padrão; com 20k+ consumos por evento isso
  // mascarava a tabela "Completo". Usamos limit alto (a aba de detalhe/CSV
  // "Completo" ainda depende de uma lista de linhas), mas o resumo (cards)
  // não vem mais daqui — ver resumoQuery abaixo, que usa count() e por isso
  // não sofre com o mesmo truncamento em eventos muito grandes.
  const completoQuery = useQuery({
    queryKey: [...queryKey, "completo"],
    enabled,
    queryFn: async () => {
      const q = applyConsumoCompletoFilters(
        (supabase as any).from("vw_consumo_completo").select("*"),
      )
        .order("consumed_at", { ascending: false })
        .limit(50000);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ConsumoCompletoRow[];
    },
  });

  // ── Resumo via count() exato — não depende da lista de 50k linhas acima,
  // que já truncou silenciosamente uma vez (comentário de 20260511) e
  // voltaria a truncar em qualquer evento com mais consumos que o limite.
  const resumoQuery = useQuery({
    queryKey: [...queryKey, "resumo"],
    enabled,
    queryFn: async (): Promise<RelatorioResumo> => {
      const countOf = async (extra?: (q: any) => any) => {
        let q = applyConsumoCompletoFilters(
          (supabase as any).from("vw_consumo_completo").select("id", { count: "exact", head: true }),
        );
        if (extra) q = extra(q);
        const { count, error } = await q;
        if (error) throw error;
        return count ?? 0;
      };

      const [total, realtime, queue, duplicidade] = await Promise.all([
        countOf(),
        countOf((q) => q.eq("sync_status", "realtime")),
        countOf((q) => q.eq("sync_status", "queue")),
        countOf((q) => q.eq("duplicidade_detectada", true)),
      ]);

      return {
        totalRefeicoes: total,
        totalRealtime: realtime,
        totalQueue: queue,
        totalDuplicidade: duplicidade,
        pctRealtime: total > 0 ? Math.round((realtime / total) * 100) : 100,
      };
    },
  });

  // ── vw_consumo_por_dia ─────────────────────────────────────────────────────
  // .limit() explícito nas 5 queries abaixo: sem ele, o PostgREST trunca em
  // 1000 linhas por padrão — o mesmo truncamento silencioso já corrigido em
  // completoQuery/resumoQuery (comentário acima), mas que ainda não tinha
  // sido replicado aqui.
  const porDiaQuery = useQuery({
    queryKey: [...queryKey, "por-dia"],
    enabled,
    queryFn: async () => {
      let q = (supabase as any)
        .from("vw_consumo_por_dia")
        .select("*")
        .eq("event_id", eventId)
        .order("data", { ascending: false })
        .limit(20000);

      if (etapaId) q = q.eq("event_stage_id", etapaId);
      if (dataInicio) q = q.gte("data", dataInicio);
      if (dataFim) q = q.lte("data", dataFim);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ConsumoPorDiaRow[];
    },
  });

  // ── vw_consumo_por_janela ──────────────────────────────────────────────────
  const porJanelaQuery = useQuery({
    queryKey: [...queryKey, "por-janela"],
    enabled,
    queryFn: async () => {
      let q = (supabase as any)
        .from("vw_consumo_por_janela")
        .select("*")
        .eq("event_id", eventId)
        .order("data", { ascending: false })
        .limit(20000);

      if (etapaId) q = q.eq("event_stage_id", etapaId);
      if (dataInicio) q = q.gte("data", dataInicio);
      if (dataFim) q = q.lte("data", dataFim);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ConsumoPorJanelaRow[];
    },
  });

  // ── vw_consumo_por_operador ────────────────────────────────────────────────
  const porOperadorQuery = useQuery({
    queryKey: [...queryKey, "por-operador"],
    enabled,
    queryFn: async () => {
      let q = (supabase as any)
        .from("vw_consumo_por_operador")
        .select("*")
        .eq("event_id", eventId)
        .order("data", { ascending: false })
        .limit(20000);

      if (etapaId) q = q.eq("event_stage_id", etapaId);
      if (dataInicio) q = q.gte("data", dataInicio);
      if (dataFim) q = q.lte("data", dataFim);
      if (operadorId) q = q.eq("operador_id", operadorId);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ConsumoPorOperadorRow[];
    },
  });

  // ── vw_erros_sync ──────────────────────────────────────────────────────────
  const errosQuery = useQuery({
    queryKey: [...queryKey, "erros"],
    enabled,
    queryFn: async () => {
      let q = (supabase as any)
        .from("vw_erros_sync")
        .select("*")
        .eq("event_id", eventId)
        .order("consumed_at", { ascending: false })
        .limit(20000);

      if (etapaId) q = q.eq("event_stage_id", etapaId);
      if (dataInicio) q = q.gte("janela_data", dataInicio);
      if (dataFim) q = q.lte("janela_data", dataFim);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ErroSyncRow[];
    },
  });

  // ── vw_consumo_por_etapa ───────────────────────────────────────────────────
  const porEtapaQuery = useQuery({
    queryKey: [...queryKey, "por-etapa"],
    enabled,
    queryFn: async () => {
      let q = (supabase as any)
        .from("vw_consumo_por_etapa")
        .select("*")
        .eq("event_id", eventId)
        .order("etapa_nome")
        .limit(20000);

      if (etapaId) q = q.eq("etapa_id", etapaId);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ConsumoPorEtapaRow[];
    },
  });

  const resumo: RelatorioResumo = resumoQuery.data ?? {
    totalRefeicoes: 0,
    totalRealtime: 0,
    totalQueue: 0,
    totalDuplicidade: 0,
    pctRealtime: 100,
  };

  // ── CSV export helpers ─────────────────────────────────────────────────────
  function buildCsv<T extends Record<string, unknown>>(rows: T[]): string {
    if (!rows.length) return "";
    const headers = Object.keys(rows[0]);
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const lines = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
    ];
    return lines.join("\n");
  }

  function downloadCsvFile(csv: string, filename: string) {
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const exportCSV = {
    completo: () =>
      downloadCsvFile(
        buildCsv(completoQuery.data ?? []),
        "consumo_completo.csv",
      ),
    porDia: () =>
      downloadCsvFile(buildCsv(porDiaQuery.data ?? []), "consumo_por_dia.csv"),
    porJanela: () =>
      downloadCsvFile(
        buildCsv(porJanelaQuery.data ?? []),
        "consumo_por_janela.csv",
      ),
    porOperador: () =>
      downloadCsvFile(
        buildCsv(porOperadorQuery.data ?? []),
        "consumo_por_operador.csv",
      ),
    erros: () =>
      downloadCsvFile(buildCsv(errosQuery.data ?? []), "erros_sync.csv"),
    porEtapa: () =>
      downloadCsvFile(
        buildCsv(porEtapaQuery.data ?? []),
        "consumo_por_etapa.csv",
      ),
  };

  const isLoading =
    resumoQuery.isLoading ||
    completoQuery.isLoading ||
    porDiaQuery.isLoading ||
    porJanelaQuery.isLoading ||
    porOperadorQuery.isLoading ||
    errosQuery.isLoading ||
    porEtapaQuery.isLoading;

  const error =
    resumoQuery.error ||
    completoQuery.error ||
    porDiaQuery.error ||
    porJanelaQuery.error ||
    porOperadorQuery.error ||
    errosQuery.error ||
    porEtapaQuery.error;

  return {
    completo: completoQuery.data ?? [],
    porDia: porDiaQuery.data ?? [],
    porJanela: porJanelaQuery.data ?? [],
    porOperador: porOperadorQuery.data ?? [],
    erros: errosQuery.data ?? [],
    porEtapa: porEtapaQuery.data ?? [],
    resumo,
    isLoading,
    error,
    exportCSV,
  };
}
