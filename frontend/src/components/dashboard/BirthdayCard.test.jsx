/**
 * BirthdayCard.test.jsx – zeigt heutige/nächste Team-Geburtstage,
 * Klick auf den Party-Popper-Button löst das Konfetti-Overlay aus
 * (unabhängig davon, ob heute tatsächlich jemand Geburtstag hat).
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import i18n from '../../i18n/i18n.js';
import { apiFetch } from '../../utils/apiFetch.js';
import BirthdayCard from './BirthdayCard.jsx';

vi.mock('../../utils/apiFetch.js', () => ({
  apiFetch: vi.fn(),
}));

// ConfettiOverlay zeichnet auf einem echten <canvas> per requestAnimationFrame –
// hier reicht der Nachweis, dass es überhaupt gemountet wird.
vi.mock('./ConfettiOverlay.jsx', () => ({
  default: ({ onDone }) => <div data-testid="confetti-overlay" onClick={onDone} />,
}));

beforeAll(async () => { await i18n.changeLanguage('de'); });

beforeEach(() => { apiFetch.mockReset(); });

describe('BirthdayCard', () => {
  it('zeigt eine Empty-State-Meldung, wenn niemand ein Geburtsdatum hinterlegt hat', async () => {
    apiFetch.mockResolvedValueOnce([]);
    render(<BirthdayCard />);
    await waitFor(() => expect(screen.getByText('Noch keine Geburtstage im Team hinterlegt.')).toBeInTheDocument());
  });

  it('hebt eine heutige Geburtstagsperson besonders hervor', async () => {
    const today = new Date();
    const todayStr = `1990-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    apiFetch.mockResolvedValueOnce([{ _id: 'u1', name: 'Anna', birthday: todayStr }]);
    render(<BirthdayCard />);
    await waitFor(() => expect(screen.getByText(/Anna hat heute Geburtstag/)).toBeInTheDocument());
  });

  it('zeigt die nächste anstehende Geburtstagsperson, wenn heute niemand Geburtstag hat', async () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    const futureStr = `1990-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    apiFetch.mockResolvedValueOnce([{ _id: 'u1', name: 'Bo', birthday: futureStr }]);
    render(<BirthdayCard />);
    await waitFor(() => expect(screen.getByText(/Bo Geburtstag/)).toBeInTheDocument());
  });

  it('löst das Konfetti-Overlay beim Klick aus, unabhängig vom Geburtstags-Status', async () => {
    apiFetch.mockResolvedValueOnce([]);
    render(<BirthdayCard />);
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());

    expect(screen.queryByTestId('confetti-overlay')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Konfetti auslösen' }));
    expect(screen.getByTestId('confetti-overlay')).toBeInTheDocument();
  });

  it('räumt das Konfetti-Overlay auf, sobald onDone aufgerufen wird', async () => {
    apiFetch.mockResolvedValueOnce([]);
    render(<BirthdayCard />);
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Konfetti auslösen' }));
    fireEvent.click(screen.getByTestId('confetti-overlay'));
    expect(screen.queryByTestId('confetti-overlay')).not.toBeInTheDocument();
  });
});
