import { describe, it, expect, vi, beforeEach } from 'vitest';
import { boletimInformativoReport } from './boletim.informativo';

describe('Boletim Informativo Report', () => {
  const createMockQuery = () => {
    const query: any = {
      eq: vi.fn(),
      in: vi.fn(),
      gte: vi.fn(),
      lte: vi.fn(),
      neq: vi.fn(),
      order: vi.fn(),
      range: vi.fn(),
      select: vi.fn(),
      then: vi.fn((onFulfilled) => Promise.resolve({ data: [], count: 0 }).then(onFulfilled)),
    };
    
    query.eq.mockReturnValue(query);
    query.in.mockReturnValue(query);
    query.gte.mockReturnValue(query);
    query.lte.mockReturnValue(query);
    query.neq.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.range.mockReturnValue(query);
    query.select.mockReturnValue(query);
    
    return query;
  };

  let mockSupabase: any;
  let queries: Map<string, any>;

  beforeEach(() => {
    vi.clearAllMocks();
    queries = new Map();
    mockSupabase = {
      from: vi.fn((table) => {
        if (!queries.has(table)) {
          queries.set(table, createMockQuery());
        }
        return queries.get(table);
      }),
    };
  });

  it('should filter official_bulletins by status "publicado"', async () => {
    const filters = {
      event_id: 'test-event-id',
      date: '2024-05-20',
      include_results: true,
      include_schedule: true
    };

    if (boletimInformativoReport.datasource.type === 'custom') {
      await (boletimInformativoReport.datasource as any).customLoader(filters, {}, mockSupabase);
    }

    const bulletinQuery = queries.get('official_bulletins');
    expect(mockSupabase.from).toHaveBeenCalledWith('official_bulletins');
    expect(bulletinQuery.eq).toHaveBeenCalledWith('status', 'publicado');
  });

  it('should filter competition_match_results by status "resultado_validado" or "publicado"', async () => {
    const filters = {
      event_id: 'test-event-id',
      date: '2024-05-20',
      include_results: true,
      include_schedule: true
    };

    if (boletimInformativoReport.datasource.type === 'custom') {
      await (boletimInformativoReport.datasource as any).customLoader(filters, {}, mockSupabase);
    }

    const resultsQuery = queries.get('competition_match_results');
    expect(mockSupabase.from).toHaveBeenCalledWith('competition_match_results');
    expect(resultsQuery.in).toHaveBeenCalledWith('result_status', ['resultado_validado', 'publicado']);
  });
});
