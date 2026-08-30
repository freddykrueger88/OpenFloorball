/**
 * BirthdayGateDialog.test.jsx – erzwingt einmalig das Nachtragen des
 * Geburtsdatums für Bestandsnutzer (users.birthday NULL). Deckt: Speichern
 * aktualisiert den authStore (Dialog verschwindet dadurch aus App.jsx),
 * Fehlerfall zeigt eine Meldung statt den Dialog stillschweigend zu
 * schließen.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import i18n from '../../i18n/i18n.js';
import useAuthStore from '../../store/authStore.js';
import api from '../../utils/api.js';
import BirthdayGateDialog from './BirthdayGateDialog.jsx';

vi.mock('../../utils/api.js', () => ({
  default: { put: vi.fn() },
}));

beforeAll(async () => { await i18n.changeLanguage('de'); });

beforeEach(() => {
  useAuthStore.setState({ user: { id: 'u1', email: 'me@example.com', birthday: null } });
  api.put.mockReset();
});

describe('BirthdayGateDialog', () => {
  it('speichert ein eingegebenes Geburtsdatum und aktualisiert den authStore', async () => {
    api.put.mockResolvedValueOnce({ data: { data: { user: { id: 'u1', email: 'me@example.com', birthday: '1988-03-20' } } } });
    render(<BirthdayGateDialog />);

    fireEvent.change(screen.getByLabelText('Geburtsdatum'), { target: { value: '1988-03-20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/auth/birthday', { birthday: '1988-03-20' }));
    await waitFor(() => expect(useAuthStore.getState().user.birthday).toBe('1988-03-20'));
  });

  it('zeigt eine Fehlermeldung, wenn das Speichern fehlschlägt, statt sich zu schließen', async () => {
    api.put.mockRejectedValueOnce({ response: { data: { message: 'Ungültiges Geburtsdatum' } } });
    render(<BirthdayGateDialog />);

    fireEvent.change(screen.getByLabelText('Geburtsdatum'), { target: { value: '2099-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(screen.getByText('Ungültiges Geburtsdatum')).toBeInTheDocument());
    expect(useAuthStore.getState().user.birthday).toBeNull();
  });

  it('ist nicht per Escape schließbar (kein onEscape-Handler)', () => {
    render(<BirthdayGateDialog />);
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });
});
