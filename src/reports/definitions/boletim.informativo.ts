import type { ReportDefinition } from '../core/types';

/**
 * Definição para o relatório de Boletim Informativo.
 * Compilado de informações gerais do evento para distribuição às delegações.
 */
export const boletimInformativoReport: ReportDefinition = {
  id: 'boletim-informativo',
  name: 'Boletim Informativo',
  description: 'Informativo geral com avisos, programação e resultados consolidados do dia.',
  scope: 'event',
  formats: ['pdf'],
  filters: [
    { key: 'event_id', label: 'Evento', type: 'uuid', required: true },
    { key: 'date', label: 'Data de Referência', type: 'date', required: true },
    { key: 'include_results', label: 'Incluir Resultados', type: 'boolean', defaultValue: true },
    { key: 'include_schedule', label: 'Incluir Programação', type: 'boolean', defaultValue: true },
  ],
  columns: [
    { key: 'section', label: 'Seção', width: 30 },
    { key: 'content', label: 'Conteúdo Resumido', width: 70 },
  ],
  datasource: {
    type: 'custom',
    customLoader: async (filters, _ctx, supabase) => {
      const eventId = filters?.event_id as string;
      const date = filters?.date as string;

      if (!eventId || !date) {
        console.error('Boletim Informativo: Filtros obrigatórios ausentes', { eventId, date });
        return [];
      }

      const includeSchedule = filters.include_schedule ?? true;
      const includeResults = filters.include_results ?? true;

      const resultsData: { section: string; content: string }[] = [];

      // 1. Avisos (from official_bulletins)
      const { data: bulletins } = await supabase
        .from('official_bulletins')
        .select('title, content_md')
        .eq('event_id', eventId)
        .eq('status', 'published')
        .gte('published_at', `${date}T00:00:00Z`)
        .lte('published_at', `${date}T23:59:59Z`);

      if (bulletins && bulletins.length > 0) {
        const bulletinsText = bulletins.map(b => 
          `**${b.title.toUpperCase()}**\n${b.content_md}`
        ).join('\n\n---\n\n');
        
        resultsData.push({
          section: 'Avisos Gerais',
          content: bulletinsText
        });
      } else {
        resultsData.push({ 
          section: 'Avisos Gerais', 
          content: 'Nenhum comunicado oficial publicado para esta data.' 
        });
      }

      // 2. Programação (from competition_matches)
      if (includeSchedule) {
        const { data: matches } = await supabase
          .from('competition_matches')
          .select(`
            start_time,
            sport_events(name),
            venues(name)
          `)
          .eq('event_id', eventId)
          .eq('match_date', date)
          .order('start_time', { ascending: true });

        if (matches && matches.length > 0) {
          const scheduleText = matches.map(m => {
            const time = m.start_time ? m.start_time.substring(0, 5) : '--:--';
            const sportName = (m.sport_events as any)?.name || 'Modalidade';
            const venueName = (m.venues as any)?.name || 'Local a definir';
            return `• ${time} - ${sportName} (${venueName})`;
          }).join('\n');
          
          resultsData.push({
            section: 'Programação do Dia',
            content: scheduleText
          });
        } else {
          resultsData.push({ 
            section: 'Programação do Dia', 
            content: 'Nenhuma atividade programada para esta data.' 
          });
        }
      }

      // 3. Resultados (from competition_match_results)
      if (includeResults) {
        const { data: matchResults } = await supabase
          .from('competition_match_results')
          .select(`
            match_id,
            score,
            outcome,
            result_text,
            competition_matches!inner(
              match_number,
              start_time,
              sport_events(name)
            )
          `)
          .eq('competition_matches.event_id', eventId)
          .eq('competition_matches.match_date', date)
          .eq('result_status', 'resultado_validado');

        if (matchResults && matchResults.length > 0) {
          // Sort matchResults by start_time in JS to be safe and consistent
          const sortedResults = [...matchResults].sort((a, b) => {
            const timeA = (a.competition_matches as any)?.start_time || '';
            const timeB = (b.competition_matches as any)?.start_time || '';
            return timeA.localeCompare(timeB);
          });

          // Agrupar resultados por partida para mostrar de forma consolidada
          const grouped: Record<string, { title: string; time: string; results: string[] }> = {};
          
          sortedResults.forEach(r => {
            const match = r.competition_matches as any;
            const sportName = match?.sport_events?.name || 'Modalidade';
            const time = match?.start_time ? match.start_time.substring(0, 5) : '--:--';
            const key = r.match_id;
            
            if (!grouped[key]) {
              grouped[key] = {
                title: `${sportName} - Partida #${match?.match_number || '?'}`,
                time: time,
                results: []
              };
            }
            
            if (r.score) {
              grouped[key].results.push(r.score);
            } else if (r.result_text) {
              grouped[key].results.push(r.result_text);
            } else if (r.outcome) {
              grouped[key].results.push(r.outcome);
            }
          });

          const resultsText = Object.values(grouped).map(g => 
            `[${g.time}] ${g.title}: ${g.results.join(' x ')}`
          ).join('\n');

          resultsData.push({
            section: 'Resultados Oficiais',
            content: resultsText
          });
        } else {
          resultsData.push({ 
            section: 'Resultados Oficiais', 
            content: 'Nenhum resultado publicado para esta data.' 
          });
        }
      }

      return resultsData;
    }
  },
  layout: { orientation: 'portrait', showLogo: true, showPageNumbers: true },
  permissions: { roles: ['admin', 'secretaria', 'coordenacao_tecnica'] },
};