import { parseISO, isValid, format, startOfDay, endOfDay } from 'date-fns';
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
    { key: 'page_size', label: 'Itens por Seção', type: 'number', defaultValue: 50 },
    { key: 'page', label: 'Página', type: 'number', defaultValue: 1 },
  ],
  columns: [
    { key: 'section', label: 'Seção', width: 30 },
    { key: 'content', label: 'Conteúdo Resumido', width: 70 },
  ],
  datasource: {
    type: 'custom',
    customLoader: async (filters, _ctx, supabase) => {
      const eventId = filters?.event_id as string;
      const dateRaw = filters?.date as string;

      if (!eventId || !dateRaw) {
        console.error('Boletim Informativo: Filtros obrigatórios ausentes', { eventId, dateRaw });
        return [];
      }

      // 1. Validação e normalização (timezone/local vs UTC)
      const parsedDate = parseISO(dateRaw);
      if (!isValid(parsedDate)) {
        console.error('Boletim Informativo: Data inválida', { dateRaw });
        return [];
      }

      // Normalização: Data formatada para colunas DATE (YYYY-MM-DD)
      const date = format(parsedDate, 'yyyy-MM-dd');
      
      // Início e fim do dia para colunas TIMESTAMPTZ (published_at)
      // Usamos startOfDay/endOfDay para respeitar o contexto local do relatório
      const dayStart = startOfDay(parsedDate).toISOString();
      const dayEnd = endOfDay(parsedDate).toISOString();

      const includeSchedule = filters.include_schedule ?? true;
      const includeResults = filters.include_results ?? true;
      const pageSize = Number(filters.page_size || 50);
      const page = Number(filters.page || 1);
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const resultsData: { section: string; content: string }[] = [];

      // 1. Avisos (from official_bulletins)
      const { data: bulletins, count: bulletinsCount } = await supabase
        .from('official_bulletins')
        .select('title, content_md', { count: 'exact' })
        .eq('event_id', eventId)
        .eq('status', 'publicado')
        .gte('published_at', dayStart)
        .lte('published_at', dayEnd)
        .range(from, to);

      if (bulletins && bulletins.length > 0) {
        let bulletinsText = bulletins.map(b => 
          `**${b.title.toUpperCase()}**\n${b.content_md}`
        ).join('\n\n---\n\n');
        
        if (bulletinsCount && bulletinsCount > to + 1) {
          bulletinsText += `\n\n*(Exibindo ${bulletins.length} de ${bulletinsCount} avisos. Altere a página ou o limite para ver mais)*`;
        }

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
        const { data: matches, count: matchesCount } = await supabase
          .from('competition_matches')
          .select(`
            start_time,
            sport_events(name),
            venues(name)
          `, { count: 'exact' })
          .eq('event_id', eventId)
          .eq('match_date', date)
          .order('start_time', { ascending: true })
          .range(from, to);

        if (matches && matches.length > 0) {
          let scheduleText = matches.map(m => {
            const time = m.start_time ? m.start_time.substring(0, 5) : '--:--';
            const sportName = (m.sport_events as any)?.name || 'Modalidade';
            const venueName = (m.venues as any)?.name || 'Local a definir';
            return `• ${time} - ${sportName} (${venueName})`;
          }).join('\n');
          
          if (matchesCount && matchesCount > to + 1) {
            scheduleText += `\n\n*(Exibindo ${matches.length} de ${matchesCount} partidas. Altere a página ou o limite para ver mais)*`;
          }

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
        const { data: matchResults, count: resultsCount } = await supabase
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
          `, { count: 'exact' })
          .eq('competition_matches.event_id', eventId)
          .eq('competition_matches.match_date', date)
          .eq('result_status', 'resultado_validado')
          .range(from, to);

        if (matchResults && matchResults.length > 0) {
          const sortedResults = [...matchResults].sort((a, b) => {
            const timeA = (a.competition_matches as any)?.start_time || '';
            const timeB = (b.competition_matches as any)?.start_time || '';
            return timeA.localeCompare(timeB);
          });

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
            
            if (r.score) grouped[key].results.push(r.score);
            else if (r.result_text) grouped[key].results.push(r.result_text);
            else if (r.outcome) grouped[key].results.push(r.outcome);
          });

          let resultsText = Object.values(grouped).map(g => 
            `[${g.time}] ${g.title}: ${g.results.join(' x ')}`
          ).join('\n');

          if (resultsCount && resultsCount > to + 1) {
            resultsText += `\n\n*(Exibindo ${matchResults.length} de ${resultsCount} resultados. Altere a página ou o limite para ver mais)*`;
          }

          resultsData.push({
            section: 'Resultados Oficiais',
            content: resultsText
          });
        } else {
          resultsData.push({ 
            section: 'Resultados Oficiais', 
            content: 'Nenhum resultado validado para esta data.' 
          });
        }
      }

      return resultsData;
    }
  },
  layout: { orientation: 'portrait', showLogo: true, showPageNumbers: true },
  permissions: { roles: ['admin', 'secretaria', 'coordenacao_tecnica'] },
};
