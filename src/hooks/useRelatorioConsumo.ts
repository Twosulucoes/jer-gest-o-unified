import { useMemo } from "react";
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

  // ── vw_consumo_completo ────────────────────────────────────────────────────
  // PostgREST trunca em 1000 por padrão; com 20k+ consumos por evento isso
  // mascarava o resumo. Usamos limit alto para garantir contagem correta.
  const completoQuery = useQuery({
    queryKey: [...queryKey, "completo"],
    enabled,
    queryFn: async () => {
      let q = (supabase as any)
        .from("vw_consumo_completo")
        .select("*")
        .eq("event_id", eventId)
        .order("consumed_at", { ascending: false })
        .limit(50000);

      if (etapaId) q = q.eq("event_stage_id", etapaId);
      if (dataInicio) q = q.gte("janela_data", dataInicio);
      if (dataFim) q = q.lte("janela_data", dataFim);
      if (operadorId) q = q.eq("registrado_por_id", operadorId);
      if (syncStatus && syncStatus !== "all") {
        if (syncStatus === "duplicidade") {
          q = q.eq("duplicidade_detectada", true);
        } else {
          q = q.eq("sync_status", syncStatus);
        }
      }
      if (origem && origem !== "all") q = q.eq("origem", origem);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ConsumoCompletoRow[];
    },
  });

  // ── vw_consumo_por_dia ─────────────────────────────────────────────────────
  const porDiaQuery = useQuery({
    queryKey: [...queryKey, "por-dia"],
    enabled,
    queryFn: async () => {
      let q = (supabase as any)
        .from("vw_consumo_por_dia")
        .select("*")
        .eq("event_id", eventId)
        .order("data", { ascending: false });

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
        .order("data", { ascending: false });

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
        .order("data", { ascending: false });

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
        .order("consumed_at", { ascending: false });

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
        .order("etapa_nome");

      if (etapaId) q = q.eq("etapa_id", etapaId);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ConsumoPorEtapaRow[];
    },
  });

  // ── Computed summary numbers ───────────────────────────────────────────────
  const resumo = useMemo<RelatorioResumo>(() => {
    const rows = completoQuery.data ?? [];
    const total = rows.length;
    const realtime = rows.filter((r) => r.sync_status === "realtime").length;
    const queue = rows.filter((r) => r.sync_status === "queue").length;
    const dupl = rows.filter((r) => r.duplicidade_detectada).length;
    return {
      totalRefeicoes: total,
      totalRealtime: realtime,
      totalQueue: queue,
      totalDuplicidade: dupl,
      pctRealtime: total > 0 ? Math.round((realtime / total) * 100) : 100,
    };
  }, [completoQuery.data]);

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
    completoQuery.isLoading ||
    porDiaQuery.isLoading ||
    porJanelaQuery.isLoading ||
    porOperadorQuery.isLoading ||
    errosQuery.isLoading ||
    porEtapaQuery.isLoading;

  const error =
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
