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
    { key: 'sport_id', label: 'Modalidade', type: 'select' },
    { key: 'category_id', label: 'Categoria', type: 'select', dependsOn: 'sport_id' },
  ],
  columns: [
    { key: 'match_code', label: 'Código', width: 10 },
    { key: 'time', label: 'Horário', width: 10 },
    { key: 'local', label: 'Local', width: 20 },
    { key: 'match_label', label: 'Confronto', width: 60 },
  ],
  datasource: {
    type: 'custom',
    customLoader: async (filters, ctx, supabase) => {
      let query = supabase
        .from('competition_matches')
        .select(`
          id,
          match_date,
          match_time,
          sport:sports(name),
          category:categories(name),
          venue:competition_venues(name),
          team1:competition_teams!competition_matches_team1_id_fkey(name),
          team2:competition_teams!competition_matches_team2_id_fkey(name),
          label
        `)
        .order('match_date', { ascending: true })
        .order('match_time', { ascending: true });

      if (filters.event_id) query = query.eq('event_id', filters.event_id);
      if (filters.match_id) query = query.eq('id', filters.match_id);
      if (filters.date) query = query.eq('match_date', filters.date);
      if (filters.sport_id) query = query.eq('sport_id', filters.sport_id);

      const { data } = await query;
      
      return (data || []).map(m => ({
        id: m.id,
        match_code: m.id.slice(0, 8),
        time: m.match_time || '--:--',
        local: (m as any).venue?.name || 'A definir',
        match_label: m.label || `${(m as any).team1?.name || '?'} x ${(m as any).team2?.name || '?'}`
      }));
    }
  },
  layout: { orientation: 'portrait', showLogo: true, showPageNumbers: true },
  permissions: { roles: ['admin', 'secretaria', 'coordenacao_tecnica', 'coordenador_modalidade'] },
};
