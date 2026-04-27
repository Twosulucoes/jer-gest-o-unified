import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, Navigate } from 'react-router-dom';
import PwaRouteGuard from '../PwaRouteGuard';

// Mock dependencies
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/contexts/EventContext', () => ({
  useEventContext: vi.fn(),
}));

vi.mock('@/contexts/StageContext', () => ({
  useStageContext: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Navigate: vi.fn(({ to, state }) => <div data-testid="navigate" data-to={to} data-state={JSON.stringify(state)} />),
  };
});

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
  },
}));

describe('PwaRouteGuard Redirection Logic', () => {
  const mockUseAuth = require('@/hooks/useAuth').useAuth;
  const mockUseEventContext = require('@/contexts/EventContext').useEventContext;
  const mockUseStageContext = require('@/contexts/StageContext').useStageContext;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to login if user is not authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    mockUseEventContext.mockReturnValue({ activeEventId: null, eventsLoading: false });
    mockUseStageContext.mockReturnValue({ activeStageId: null, stagesLoading: false });

    render(
      <MemoryRouter initialEntries={['/pwa/modulo']}>
        <PwaRouteGuard>Protected Content</PwaRouteGuard>
      </MemoryRouter>
    );

    const navigate = screen.getByTestId('navigate');
    expect(navigate.getAttribute('data-to')).toBe('/login');
  });

  it('redirects to configuration if event is missing on PWA internal route', () => {
    mockUseAuth.mockReturnValue({ user: { id: '1' }, loading: false, hasRole: () => true });
    mockUseEventContext.mockReturnValue({ activeEventId: null, eventsLoading: false });
    mockUseStageContext.mockReturnValue({ activeStageId: null, stagesLoading: false });

    render(
      <MemoryRouter initialEntries={['/pwa/dashboard']}>
        <PwaRouteGuard>Protected Content</PwaRouteGuard>
      </MemoryRouter>
    );

    const navigate = screen.getByTestId('navigate');
    expect(navigate.getAttribute('data-to')).toBe('/pwa/configuracao');
    const state = JSON.parse(navigate.getAttribute('data-state') || '{}');
    expect(state.reason).toBe('missing_event');
  });

  it('redirects to configuration if stage is missing when requireStage is true', () => {
    mockUseAuth.mockReturnValue({ user: { id: '1' }, loading: false, hasRole: () => true });
    mockUseEventContext.mockReturnValue({ activeEventId: 'event-1', eventsLoading: false });
    mockUseStageContext.mockReturnValue({ activeStageId: null, stagesLoading: false });

    render(
      <MemoryRouter initialEntries={['/pwa/dashboard']}>
        <PwaRouteGuard requireStage={true}>Protected Content</PwaRouteGuard>
      </MemoryRouter>
    );

    const navigate = screen.getByTestId('navigate');
    expect(navigate.getAttribute('data-to')).toBe('/pwa/configuracao');
    const state = JSON.parse(navigate.getAttribute('data-state') || '{}');
    expect(state.reason).toBe('missing_stage');
  });

  it('allows access if event and stage are present', () => {
    mockUseAuth.mockReturnValue({ user: { id: '1' }, loading: false, hasRole: () => true });
    mockUseEventContext.mockReturnValue({ activeEventId: 'event-1', eventsLoading: false });
    mockUseStageContext.mockReturnValue({ activeStageId: 'stage-1', stagesLoading: false });

    render(
      <MemoryRouter initialEntries={['/pwa/dashboard']}>
        <PwaRouteGuard>Protected Content</PwaRouteGuard>
      </MemoryRouter>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('allows access to configuration page without active event/stage', () => {
    mockUseAuth.mockReturnValue({ user: { id: '1' }, loading: false, hasRole: () => true });
    mockUseEventContext.mockReturnValue({ activeEventId: null, eventsLoading: false });
    mockUseStageContext.mockReturnValue({ activeStageId: null, stagesLoading: false });

    render(
      <MemoryRouter initialEntries={['/pwa/configuracao']}>
        <PwaRouteGuard>Configuration Content</PwaRouteGuard>
      </MemoryRouter>
    );

    expect(screen.getByText('Configuration Content')).toBeInTheDocument();
  });
});