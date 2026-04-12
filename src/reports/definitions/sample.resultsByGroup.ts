import type { ReportDefinition } from '../core/types';

interface ResultRow {
  group_name: string;
  round_number: number | null;
  home_team: string;
  away_team: string;
  score: string;
  status: string;
  match_date: string | null;
  venue_name: string | null;
}

export const resultsByGroupReport: ReportDefinition<ResultRow> = {
  id: 'results-by-group',
  name: 'Resultados por Grupo',
  description: 'Partidas e placares agrupados por fase e grupo da competição.',
  scope: 'group',
  formats: ['pdf', 'excel'],
  filters: [
    { key: 'event_id', label: 'Evento', type: 'uuid', required: true },
    { key: 'sport_event_id', label: 'Prova', type: 'select' },
    { key: 'phase_id', label: 'Fase', type: 'select', dependsOn: 'sport_event_id' },
    { key: 'group_id', label: 'Grupo', type: 'select', dependsOn: 'phase_id' },
  ],
  columns: [
    { key: 'group_name', label: 'Grupo', width: 15, visibleByDefault: true },
    { key: 'round_number', label: 'Rodada', width: 8, align: 'center', visibleByDefault: true },
    { key: 'home_team', label: 'Mandante', width: 20, visibleByDefault: true },
    { key: 'away_team', label: 'Visitante', width: 20, visibleByDefault: true },
    { key: 'score', label: 'Placar', width: 10, align: 'center', visibleByDefault: true, pdf: { bold: true } },
    { key: 'status', label: 'Status', width: 10, align: 'center', visibleByDefault: true },
    { key: 'match_date', label: 'Data', width: 10, visibleByDefault: true },
    { key: 'venue_name', label: 'Local', width: 15, visibleByDefault: false },
  ],
  datasource: {
    type: 'custom',
    customLoader: async (filters, ctx, supabase) => {
      let query = supabase.from('competition_matches').select(`
        id, round_number, match_date, status, venue_id,
        competition_groups!inner(name),
        competition_match_entries(side, team_id, teams(name)),
        match_scores(match_entry_id, score_final, outcome),
        venues(name)
      `).eq('event_id', filters.event_id as string);

      if (filters.phase_id) query = query.eq('phase_id', filters.phase_id as string);
      if (filters.group_id) query = query.eq('group_id', filters.group_id as string);

      const { data, error } = await query.order('round_number');
      if (error) throw error;

      return (data || []).map((m: any) => {
        const entries = m.competition_match_entries || [];
        const homeEntry = entries.find((e: any) => e.side === 'home') || entries[0];
        const awayEntry = entries.find((e: any) => e.side === 'away') || entries[1];
        const scores = m.match_scores || [];
        const homeScore = scores.find((s: any) => s.match_entry_id === homeEntry?.id);
        const awayScore = scores.find((s: any) => s.match_entry_id === awayEntry?.id);

        return {
          group_name: m.competition_groups?.name || '—',
          round_number: m.round_number,
          home_team: homeEntry?.teams?.name || '—',
          away_team: awayEntry?.teams?.name || '—',
          score: homeScore?.score_final && awayScore?.score_final
            ? `${homeScore.score_final} x ${awayScore.score_final}`
            : '— x —',
          status: m.status,
          match_date: m.match_date || null,
          venue_name: m.venues?.name || null,
        };
      });
    },
  },
  summary: {
    enabled: true,
    reducers: [
      { key: 'total_matches', label: 'Total de Jogos', fn: (rows) => rows.length },
      {
        key: 'completed',
        label: 'Jogos Finalizados',
        fn: (rows) => rows.filter((r) => r.status === 'completed').length,
      },
    ],
  },
  layout: { orientation: 'landscape', showLogo: true, showPageNumbers: true },
  permissions: { roles: ['admin', 'secretaria', 'coordenacao_tecnica'] },
};
