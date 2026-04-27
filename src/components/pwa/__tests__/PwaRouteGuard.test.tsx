import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PwaRouteGuard from '../PwaRouteGuard';
import { useAuth } from '@/hooks/useAuth';
import { useEventContext } from '@/contexts/EventContext';
import { useStageContext } from '@/contexts/StageContext';
import React from 'react';

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

// Mock Lucide icons to avoid rendering issues
vi.mock('lucide-react', () => ({
  AlertCircle: () => <div />,
  CalendarDays: () => <div />,
  Lock: () => <div />,
  Layers: () => <div />,
}));

// Mock child components
vi.mock('../PwaBottomNav', () => ({
  PwaBottomNav: () => <div data-testid="bottom-nav" />,
}));

vi.mock('../../VersionBadge', () => ({
  VersionBadge: () => <div data-testid="version-badge" />,
}));

vi.mock('@/components/auth/AuthLoadingScreen', () => ({
  default: () => <div data-testid="loading-screen" />,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Navigate: vi.fn(({ to, state }) => <div data-testid="navigate" data-to={to} data-state={JSON.stringify(state)} />),
  };
});

describe('PwaRouteGuard Redirection Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to login if user is not authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: false, hasRole: vi.fn() } as any);
    vi.mocked(useEventContext).mockReturnValue({ activeEventId: null, eventsLoading: false } as any);
    vi.mocked(useStageContext).mockReturnValue({ activeStageId: null, stagesLoading: false } as any);

    render(
      <MemoryRouter initialEntries={['/pwa/dashboard']}>
        <PwaRouteGuard>Protected Content</PwaRouteGuard>
      </MemoryRouter>
    );

    const navigate = screen.getByTestId('navigate');
    expect(navigate.getAttribute('data-to')).toBe('/login');
  });

  it('redirects to configuration if event is missing on PWA internal route', () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: '1' } as any, loading: false, hasRole: () => true } as any);
    vi.mocked(useEventContext).mockReturnValue({ activeEventId: null, eventsLoading: false } as any);
    vi.mocked(useStageContext).mockReturnValue({ activeStageId: null, stagesLoading: false } as any);

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
    vi.mocked(useAuth).mockReturnValue({ user: { id: '1' } as any, loading: false, hasRole: () => true } as any);
    vi.mocked(useEventContext).mockReturnValue({ activeEventId: 'event-1', eventsLoading: false } as any);
    vi.mocked(useStageContext).mockReturnValue({ activeStageId: null, stagesLoading: false } as any);

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
    vi.mocked(useAuth).mockReturnValue({ user: { id: '1' } as any, loading: false, hasRole: () => true } as any);
    vi.mocked(useEventContext).mockReturnValue({ activeEventId: 'event-1', eventsLoading: false } as any);
    vi.mocked(useStageContext).mockReturnValue({ activeStageId: 'stage-1', stagesLoading: false } as any);

    render(
      <MemoryRouter initialEntries={['/pwa/dashboard']}>
        <PwaRouteGuard>Protected Content</PwaRouteGuard>
      </MemoryRouter>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-nav')).toBeInTheDocument();
  });

  it('allows access to configuration page without active event/stage', () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: '1' } as any, loading: false, hasRole: () => true } as any);
    vi.mocked(useEventContext).mockReturnValue({ activeEventId: null, eventsLoading: false } as any);
    vi.mocked(useStageContext).mockReturnValue({ activeStageId: null, stagesLoading: false } as any);

    render(
      <MemoryRouter initialEntries={['/pwa/configuracao']}>
        <PwaRouteGuard>Configuration Content</PwaRouteGuard>
      </MemoryRouter>
    );

    expect(screen.getByText('Configuration Content')).toBeInTheDocument();
  });
});