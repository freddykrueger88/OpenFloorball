/**
 * AvailabilityToggle.test.jsx – Spieler-Dashboard-Ausbau: Optimistic
 * Update beim Klick auf Dabei/Eventuell/Nicht dabei, inkl. Rollback bei
 * einem fehlgeschlagenen Speichern.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import i18n from '../../i18n/i18n.js';
import useAuthStore from '../../store/authStore.js';
import { apiFetch } from '../../utils/apiFetch.js';
import AvailabilityToggle from './AvailabilityToggle.jsx';

vi.mock('../../utils/apiFetch.js', () => ({
  apiFetch: vi.fn(),
}));

beforeAll(async () => { await i18n.changeLanguage('de'); });

beforeEach(() => {
  useAuthStore.setState({ user: { id: 'u1', email: 'me@example.com' } });
  apiFetch.mockReset();
});

describe('AvailabilityToggle', () => {
  it('lädt den eigenen Status aus der Roster-Liste und zeigt ihn hervorgehoben an', async () => {
    apiFetch.mockResolvedValueOnce([{ userId: 'u1', status: 'yes' }]);
    render(<AvailabilityToggle resourceKind="games" resourceId="g1" />);

    await waitFor(() => expect(screen.getByText('Du hast zugesagt.')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Zusage/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('aktualisiert den Status optimistisch sofort beim Klick und bestätigt nach Erfolg', async () => {
    apiFetch.mockResolvedValueOnce([]); // initial load: keine Rückmeldung
    apiFetch.mockResolvedValueOnce({ status: 'maybe' }); // PUT .../me
    render(<AvailabilityToggle resourceKind="games" resourceId="g1" />);

    await waitFor(() => expect(screen.getByText('Deine Rückmeldung: Noch offen')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Unsicher/ }));
    // Optimistic: Status ist sofort sichtbar, ohne auf die Antwort zu warten.
    expect(screen.getByText('Du bist eventuell dabei.')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('Rückmeldung gespeichert')).toBeInTheDocument());
    expect(apiFetch).toHaveBeenLastCalledWith('/api/games/g1/rsvps/me', {
      method: 'PUT', body: JSON.stringify({ status: 'maybe', reason: '' }),
    });
  });

  it('rollt bei fehlgeschlagenem Speichern auf den vorherigen Status zurück und zeigt einen Fehler', async () => {
    apiFetch.mockResolvedValueOnce([{ userId: 'u1', status: 'yes' }]); // initial: Dabei
    apiFetch.mockRejectedValueOnce(new Error('Netzwerkfehler'));
    render(<AvailabilityToggle resourceKind="games" resourceId="g1" />);

    await waitFor(() => expect(screen.getByText('Du hast zugesagt.')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Absage/ }));
    await waitFor(() => expect(screen.getByText('Netzwerkfehler')).toBeInTheDocument());

    // Rollback: wieder "zugesagt" statt der fehlgeschlagenen Absage.
    expect(screen.getByText('Du hast zugesagt.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Zusage/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('sperrt die Aktionen und zeigt einen Hinweis, wenn der Termin abgesagt wurde', async () => {
    apiFetch.mockResolvedValueOnce([]);
    render(<AvailabilityToggle resourceKind="games" resourceId="g1" disabled disabledReason="Dieser Termin wurde abgesagt." />);
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /Zusage/ })).not.toBeInTheDocument();
    expect(screen.getByText('Dieser Termin wurde abgesagt.')).toBeInTheDocument();
  });
});
