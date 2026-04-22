import type { ReportDefinition } from '../core/types';

/**
 * Definição para o relatório de Súmula de Partida.
 * Permite gerar o documento oficial de uma partida específica ou lote de partidas.
 */
export const sumulaPartidaReport: ReportDefinition = {
  id: 'competicao-sumula',
  name: 'Súmula de Partida',
  description: 'Documento oficial para registro de ocorrências e resultados de uma partida.',
  scope: 'sport_event',
  formats: ['pdf'],
  filters: [
    { key: 'event_id', label: 'Evento', type: 'uuid', required: true },
    { key: 'match_id', label: 'Partida específica', type: 'uuid' },
    { key: 'date', label: 'Data das Partidas', type: 'date' },
  ],
  columns: [
    { key: 'match_code', label: 'Código', width: 20 },
    { key: 'time', label: 'Horário', width: 20 },
    { key: 'local', label: 'Local', width: 60 },
  ],
  datasource: {
    type: 'custom',
    customLoader: async (filters, _ctx, supabase) => {
      let query = supabase
        .from('competition_matches')
        .select(`
          id,
          match_date,
          start_time,
          venue:competition_venues(name)
        `)
        .order('match_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (filters.event_id) query = query.eq('event_id', filters.event_id as string);
      if (filters.match_id) query = query.eq('id', filters.match_id as string);
      if (filters.date) query = query.eq('match_date', filters.date as string);

      const { data } = await query;
      
      return (data || []).map(m => ({
        id: m.id,
        match_code: m.id.slice(0, 8),
        time: m.start_time || '--:--',
        local: (m as any).venue?.name || 'A definir'
      }));
    }
  },
  layout: { orientation: 'portrait', showLogo: true, showPageNumbers: true },
  permissions: { roles: ['admin', 'secretaria', 'coordenacao_tecnica', 'coordenador_modalidade'] },
};
