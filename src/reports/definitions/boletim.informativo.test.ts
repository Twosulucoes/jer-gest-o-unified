import { describe, it, expect, vi, beforeEach } from 'vitest';
import { boletimInformativoReport } from './boletim.informativo';
import { parseISO } from 'date-fns';

describe('Boletim Informativo Report', () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should filter official_bulletins by status "publicado"', async () => {
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockResolvedValue({ data: [], count: 0 });

    const filters = {
      event_id: 'test-event-id',
      date: '2024-05-20',
      include_results: true,
      include_schedule: true
    };

    if (boletimInformativoReport.datasource.type === 'custom') {
      await (boletimInformativoReport.datasource as any).customLoader(filters, {}, mockSupabase);
    }

    // Check if official_bulletins was filtered by status 'publicado'
    expect(mockSupabase.from).toHaveBeenCalledWith('official_bulletins');
    expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'publicado');
  });

  it('should filter competition_match_results by status "resultado_validado" or "publicado"', async () => {
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockResolvedValue({ data: [], count: 0 });

    const filters = {
      event_id: 'test-event-id',
      date: '2024-05-20',
      include_results: true,
      include_schedule: true
    };

    if (boletimInformativoReport.datasource.type === 'custom') {
      await (boletimInformativoReport.datasource as any).customLoader(filters, {}, mockSupabase);
    }

    // Check if competition_match_results was filtered by the correct statuses
    expect(mockSupabase.from).toHaveBeenCalledWith('competition_match_results');
    expect(mockSupabase.in).toHaveBeenCalledWith('result_status', ['resultado_validado', 'publicado']);
  });
});
