/**
 * DashboardPage.test.jsx – Spieler-Dashboard-Ausbau: Smoke-Test.
 * Rendert Skeleton während des Ladens, dann die Karten mit Inhalt, und
 * bleibt bei einem Ladefehler funktionsfähig statt kaputtzugehen.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import i18n from '../i18n/i18n.js';
import useAuthStore from '../store/authStore.js';
import DashboardPage from './DashboardPage.jsx';

let mockDashboardData = {
  loading: true, error: null, load: vi.fn(),
  nextMatch: null, nextTraining: null, lastMatch: null, upcomingEvents: [],
  myRosterPlayer: null, myStats: null, myGameLog: [], seasonOverview: null,
};

vi.mock('../hooks/useDashboardData.js', () => ({
  useDashboardData: () => mockDashboardData,
}));

vi.mock('../hooks/useTeams.js', () => ({
  useTeams: () => ({ teams: [], fetchTeams: vi.fn().mockResolvedValue([]) }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>
  );
}

beforeAll(async () => { await i18n.changeLanguage('de'); });

beforeEach(() => {
  useAuthStore.setState({ user: { id: 'u1', email: 'me@example.com', name: 'Max' } });
});

describe('DashboardPage', () => {
  it('zeigt die Begrüßung mit Namen und ein Ladegerüst, solange geladen wird', () => {
    mockDashboardData = { ...mockDashboardData, loading: true };
    renderPage();
    expect(screen.getByText('Moin, Max 👋')).toBeInTheDocument();
    expect(screen.getByLabelText('Dashboard wird geladen…')).toBeInTheDocument();
  });

  it('zeigt nach dem Laden alle Karten mit Empty States, wenn keine Daten vorhanden sind', () => {
    mockDashboardData = { ...mockDashboardData, loading: false };
    renderPage();
    expect(screen.getByText('Derzeit ist kein kommendes Spiel geplant.')).toBeInTheDocument();
    expect(screen.getByText('Derzeit ist kein kommendes Training geplant.')).toBeInTheDocument();
    expect(screen.getByText(/noch mit keinem Kader-Eintrag verknüpft/)).toBeInTheDocument();
    expect(screen.getByText('Schnellzugriffe')).toBeInTheDocument();
  });

  it('zeigt einen Fehlerhinweis, bleibt aber vollständig nutzbar, wenn ein Ladefehler vorliegt', () => {
    mockDashboardData = { ...mockDashboardData, loading: false, error: 'Netzwerkfehler' };
    renderPage();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Schnellzugriffe')).toBeInTheDocument();
  });
});
