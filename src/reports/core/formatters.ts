import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import type { ReportDefinition, ReportContext } from './types';

export async function loadReportRows<Row = Record<string, unknown>>(
  report: ReportDefinition<Row>,
  filters: Record<string, unknown>,
  ctx: ReportContext,
  supabase: SupabaseClient<Database>,
  limit?: number
): Promise<Row[]> {
  const ds = report.datasource;

  if (ds.type === 'custom' && ds.customLoader) {
    const rows = await ds.customLoader(filters, ctx, supabase);
    return limit ? rows.slice(0, limit) : rows;
  }

  if (ds.type === 'rpc' && ds.rpcName) {
    const params = ds.paramsMapper ? ds.paramsMapper(filters, ctx) : filters;
    const { data, error } = await supabase.rpc(ds.rpcName as any, params as any);
    if (error) throw new Error(`RPC ${ds.rpcName}: ${error.message}`);
    const rows = (data as Row[]) || [];
    return limit ? rows.slice(0, limit) : rows;
  }

  if ((ds.type === 'table' || ds.type === 'view') && ds.tableName) {
    let query = supabase.from(ds.tableName as any).select(ds.select || '*');
    if (ds.whereBuilder) {
      const wheres = ds.whereBuilder(filters, ctx);
      for (const w of wheres) {
        query = query.filter(w.column, w.operator as any, w.value);
      }
    }
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (error) throw new Error(`Query ${ds.tableName}: ${error.message}`);
    return (data as Row[]) || [];
  }

  throw new Error('Datasource inválida');
}

export function formatDate(date: string | Date | null): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR');
}

export function formatDateTime(date: string | Date | null): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('pt-BR');
}
