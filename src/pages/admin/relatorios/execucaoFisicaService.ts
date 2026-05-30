import { supabase } from "@/integrations/supabase/client";

/**
 * Serviço do Relatório de Execução Física das Metas (OSC -> IDJUV / SEI).
 *
 * Consome a função SQL `get_osc_execucao_fisica` (endpoint PostgREST /rpc),
 * que agrega — direto do banco — os indicadores FÍSICOS das metas do Plano de
 * Trabalho. Nenhum dado financeiro é tratado aqui.
 */

export interface ExecFisicaIdentificacao {
  event_id: string;
  event_name: string;
  event_year: number | null;
  event_start: string | null;
  event_end: string | null;
  periodo_de: string | null;
  periodo_ate: string | null;
  termo_fomento: string;
  objeto: string;
  osc_name: string | null;
  osc_cnpj: string | null;
  osc_address: string | null;
  grantor_name: string | null;
  responsible_name: string | null;
  validity_start: string | null;
  validity_end: string | null;
}

export interface ExecFisicaMeta1Row {
  event_stage_id: string;
  stage_name: string;
  host_city: string;
  stage_code: string | null;
  kind: string | null;
  starts_at: string | null;
  ends_at: string | null;
  delegacoes_atendidas: number;
  atletas_alojados: number;
  refeicoes_fornecidas: number;
  kits_entregues: number;
}

export interface ExecFisicaMeta1Total {
  delegacoes_atendidas: number;
  atletas_alojados: number;
  refeicoes_fornecidas: number;
  kits_entregues: number;
}

export interface ExecFisicaMeta2Row {
  metric_key: string;
  label: string;
  previsto: number;
  executado: number;
}

export interface ExecFisicaEvidencia {
  osc_category: string;
  count: number;
}

export interface ExecucaoFisicaReport {
  identificacao: ExecFisicaIdentificacao;
  meta1: { por_etapa: ExecFisicaMeta1Row[]; total: ExecFisicaMeta1Total };
  meta2: ExecFisicaMeta2Row[];
  evidencias: ExecFisicaEvidencia[];
  generated_at: string;
}

/** Categorias de evidência esperadas no checklist (mesmo conjunto da Prestação de Contas OSC). */
export const EVIDENCE_CATEGORIES = [
  "infraestrutura",
  "atendimento",
  "competicao",
  "cerimonial",
] as const;

/**
 * Busca o relatório de execução física agregado.
 * @param eventId  Evento alvo.
 * @param dateFrom Início do período (YYYY-MM-DD) — opcional. Filtra refeições/jogos.
 * @param dateTo   Fim do período (YYYY-MM-DD) — opcional.
 */
export async function fetchExecucaoFisicaReport(
  eventId: string,
  dateFrom?: string | null,
  dateTo?: string | null,
): Promise<ExecucaoFisicaReport> {
  const { data, error } = await supabase.rpc("get_osc_execucao_fisica" as any, {
    p_event_id: eventId,
    p_date_from: dateFrom ?? null,
    p_date_to: dateTo ?? null,
  } as any);

  if (error) throw error;
  return data as unknown as ExecucaoFisicaReport;
}

/** Grava (upsert) um valor PREVISTO de uma métrica da Meta 2 no banco. */
export async function saveMeta2Target(
  eventId: string,
  metricKey: string,
  valorPrevisto: number,
): Promise<void> {
  const { error } = await supabase.rpc("set_osc_meta_target" as any, {
    p_event_id: eventId,
    p_meta_number: 2,
    p_metric_key: metricKey,
    p_valor_previsto: valorPrevisto,
    p_event_stage_id: null,
    p_unidade: null,
  } as any);

  if (error) throw error;
}
