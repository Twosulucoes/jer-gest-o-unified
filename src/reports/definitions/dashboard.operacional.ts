import type { ReportDefinition } from '../core/types';

/**
 * Definição-âncora para o Dashboard Operacional.
 * Página real: /admin/relatorios/dashboard
 */
export const dashboardOperacionalReport: ReportDefinition = {
  id: 'dashboard-operacional',
  name: 'Dashboard Operacional',
  description: 'Visão consolidada em tempo real de credenciamento, alojamento, alimentação, transporte e competição.',
  scope: 'event',
  formats: ['pdf'],
  filters: [
    { key: 'event_id', label: 'Evento', type: 'uuid', required: true },
  ],
  columns: [],
  datasource: { type: 'custom', customLoader: async () => [] },
  layout: { orientation: 'landscape', showLogo: true, showPageNumbers: true },
  permissions: { roles: ['admin', 'secretaria'] },
};
