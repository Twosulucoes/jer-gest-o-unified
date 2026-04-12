import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

export type ReportFormat = 'pdf' | 'excel';
export type ReportScope = 'event' | 'sport_event' | 'group' | 'delegation' | 'institution';

export type FilterValueType = 'text' | 'number' | 'boolean' | 'date' | 'dateRange' | 'uuid' | 'multiSelect' | 'select';

export interface FilterOption {
  value: string;
  label: string;
}

export interface ReportFilterDefinition {
  key: string;
  label: string;
  type: FilterValueType;
  required?: boolean;
  defaultValue?: unknown;
  options?: FilterOption[];
  optionsLoader?: (ctx: ReportContext, supabase: SupabaseClient<Database>) => Promise<FilterOption[]>;
  dependsOn?: string;
  validate?: (value: unknown) => string | null;
}

export interface ReportColumnExcelOpts {
  numFmt?: string;
  wrap?: boolean;
  bold?: boolean;
}

export interface ReportColumnPdfOpts {
  fontSize?: number;
  bold?: boolean;
}

export interface ReportColumnDefinition<Row = Record<string, unknown>> {
  key: string;
  label: string;
  width?: number; // percentage for PDF, character width for Excel
  align?: 'left' | 'center' | 'right';
  visibleByDefault?: boolean;
  format?: (row: Row) => string | number;
  excel?: ReportColumnExcelOpts;
  pdf?: ReportColumnPdfOpts;
}

export interface ReportDataSource<Row = Record<string, unknown>> {
  type: 'rpc' | 'table' | 'view' | 'custom';
  rpcName?: string;
  tableName?: string;
  select?: string;
  paramsMapper?: (filters: Record<string, unknown>, ctx: ReportContext) => Record<string, unknown>;
  whereBuilder?: (filters: Record<string, unknown>, ctx: ReportContext) => Array<{ column: string; operator: string; value: unknown }>;
  customLoader?: (filters: Record<string, unknown>, ctx: ReportContext, supabase: SupabaseClient<Database>) => Promise<Row[]>;
}

export interface ReportSummary {
  enabled: boolean;
  reducers: Array<{
    key: string;
    label: string;
    fn: (rows: Record<string, unknown>[]) => string | number;
  }>;
}

export interface ReportLayout {
  orientation: 'portrait' | 'landscape';
  showLogo?: boolean;
  showPageNumbers?: boolean;
  watermark?: string;
}

export interface ReportDefinition<Row = Record<string, unknown>> {
  id: string;
  name: string;
  description: string;
  scope: ReportScope;
  formats: ReportFormat[];
  filters: ReportFilterDefinition[];
  columns: ReportColumnDefinition<Row>[];
  datasource: ReportDataSource<Row>;
  sort?: ((a: Row, b: Row) => number) | string[];
  summary?: ReportSummary;
  layout?: ReportLayout;
  permissions?: { roles: AppRole[] };
}

export interface ReportContext {
  activeEventId: string | null;
  userId: string | null;
  roles: AppRole[];
  baseUrl: string;
}

export interface ReportPreset {
  id: string;
  event_id: string | null;
  report_id: string;
  name: string;
  filters: Record<string, unknown>;
  columns: string[] | null;
  created_by: string;
  created_at: string;
}
