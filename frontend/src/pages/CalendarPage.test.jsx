/**
 * CalendarPage.test.jsx – deckt die neue "Geburtstag"-Kategorie ab:
 * jährlich wiederkehrende Team-Geburtstage erscheinen als eigener,
 * nicht-klickbarer Chip-Typ neben Spielen/Trainings.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import i18n from '../i18n/i18n.js';
import { apiFetch } from '../utils/apiFetch.js';
import CalendarPage from './CalendarPage.jsx';

vi.mock('../utils/apiFetch.js', () => ({
  apiFetch: vi.fn(),
}));

beforeAll(async () => { await i18n.changeLanguage('de'); });

function mockEndpoints({ games = [], sessions = [], birthdays = [] } = {}) {
  apiFetch.mockImplementation((url) => {
    if (url.startsWith('/api/games')) return Promise.resolve(games);
    if (url.startsWith('/api/trainings')) return Promise.resolve(sessions);
    if (url.startsWith('/api/teams/birthdays')) return Promise.resolve(birthdays);
    return Promise.resolve([]);
  });
}

// Fixer "heute"-Anker für das Modul, damit der Kalender einen
// vorhersagbaren Monat zeigt statt vom echten Systemdatum abzuhängen.
const FIXED_TODAY = new Date(2026, 5, 10); // 10. Juni 2026

describe('CalendarPage – Geburtstage', () => {
  it('zeigt einen Geburtstags-Chip am richtigen Tag im aktuellen Monat', async () => {
    mockEndpoints({ birthdays: [{ _id: 'u1', name: 'Anna Beispiel', birthday: '1990-06-15' }] });
    vi.setSystemTime(FIXED_TODAY);

    render(<MemoryRouter><CalendarPage /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText('Anna Beispiel')).toBeInTheDocument());
    expect(screen.getByText('Geburtstage')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('rendert den Geburtstags-Chip als nicht-klickbares Element (kein <button>)', async () => {
    mockEndpoints({ birthdays: [{ _id: 'u1', name: 'Anna Beispiel', birthday: '1990-06-15' }] });
    vi.setSystemTime(FIXED_TODAY);

    render(<MemoryRouter><CalendarPage /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText('Anna Beispiel')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Anna Beispiel' })).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('zeigt keinen Geburtstags-Chip, wenn der Geburtstag in einen anderen Monat fällt', async () => {
    mockEndpoints({ birthdays: [{ _id: 'u1', name: 'Anna Beispiel', birthday: '1990-11-15' }] });
    vi.setSystemTime(FIXED_TODAY);

    render(<MemoryRouter><CalendarPage /></MemoryRouter>);

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(screen.queryByText('Anna Beispiel')).not.toBeInTheDocument();

    vi.useRealTimers();
  });
});
