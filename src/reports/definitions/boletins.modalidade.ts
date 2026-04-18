import type { ReportDefinition } from '../core/types';

/**
 * Definição-âncora para presets do relatório "Boletins por Modalidade".
 * Página real: /admin/relatorios/boletins
 * Filtros persistidos via report_presets: sportId, categoryId, gender, phaseId.
 */
export const boletinsModalidadeReport: ReportDefinition = {
  id: 'boletins-modalidade',
  name: 'Boletins por Modalidade',
  description: 'Resultados oficiais por modalidade, categoria, gênero e fase. Exportação em PDF e XLSX.',
  scope: 'sport_event',
  formats: ['pdf', 'excel'],
  filters: [
    { key: 'event_id', label: 'Evento', type: 'uuid', required: true },
    { key: 'sportId', label: 'Modalidade', type: 'select' },
    { key: 'categoryId', label: 'Categoria', type: 'select', dependsOn: 'sportId' },
    { key: 'gender', label: 'Gênero', type: 'select' },
    { key: 'phaseId', label: 'Fase', type: 'select', dependsOn: 'sportId' },
  ],
  columns: [],
  datasource: { type: 'custom', customLoader: async () => [] },
  layout: { orientation: 'portrait', showLogo: true, showPageNumbers: true },
  permissions: { roles: ['admin', 'secretaria', 'coordenacao_tecnica'] },
};
