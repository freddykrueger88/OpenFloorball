/**
 * DemoDataSection.test.jsx – Verwaltung der Demo-Testumgebung
 * (Onboarding-Ausbau). Deckt ab: korrekter Zustand (vorhanden/nicht
 * vorhanden) und dass die Löschung erst nach exakter Texteingabe möglich
 * ist (zentrale Sicherheitsanforderung, siehe DemoDataDeleteDialog.jsx).
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import i18n from '../../i18n/i18n.js';
import DemoDataSection from './DemoDataSection.jsx';

const createDemoData = vi.fn().mockResolvedValue({ hasDemoData: true, seededAt: '2026-08-01T00:00:00.000Z' });
const deleteDemoData = vi.fn().mockResolvedValue({ hasDemoData: false, seededAt: null });
let mockStatus = { hasDemoData: false, seededAt: null };

vi.mock('../../hooks/useDemoData.js', () => ({
  useDemoData: () => ({ status: mockStatus, loading: false, error: null, createDemoData, deleteDemoData }),
}));

beforeAll(async () => { await i18n.changeLanguage('de'); });

beforeEach(() => {
  createDemoData.mockClear();
  deleteDemoData.mockClear();
});

describe('DemoDataSection', () => {
  it('zeigt den "Demo-Daten erstellen"-Button, wenn keine Demo-Daten vorhanden sind', () => {
    mockStatus = { hasDemoData: false, seededAt: null };
    render(<DemoDataSection />);
    expect(screen.getByRole('button', { name: /Demo-Daten erstellen/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Demo-Daten löschen/ })).not.toBeInTheDocument();
  });

  it('legt Demo-Daten per Klick an', async () => {
    mockStatus = { hasDemoData: false, seededAt: null };
    render(<DemoDataSection />);
    fireEvent.click(screen.getByRole('button', { name: /Demo-Daten erstellen/ }));
    expect(createDemoData).toHaveBeenCalledTimes(1);
  });

  it('zeigt den Lösch-Bereich, wenn Demo-Daten vorhanden sind', () => {
    mockStatus = { hasDemoData: true, seededAt: '2026-08-01T00:00:00.000Z' };
    render(<DemoDataSection />);
    expect(screen.getByRole('button', { name: /Demo-Daten löschen/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Demo-Daten erstellen/ })).not.toBeInTheDocument();
  });

  it('verlangt die exakte Texteingabe "DEMO LÖSCHEN", bevor die Löschung bestätigt werden kann', () => {
    mockStatus = { hasDemoData: true, seededAt: '2026-08-01T00:00:00.000Z' };
    render(<DemoDataSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Demo-Daten löschen' }));

    const dialog = screen.getByRole('alertdialog');
    const confirmBtn = within(dialog).getByRole('button', { name: 'Demo-Daten löschen' });
    const input = within(dialog).getByRole('textbox');

    expect(confirmBtn).toBeDisabled();

    fireEvent.change(input, { target: { value: 'falsch' } });
    expect(confirmBtn).toBeDisabled();

    fireEvent.change(input, { target: { value: 'DEMO LÖSCHEN' } });
    expect(confirmBtn).not.toBeDisabled();

    fireEvent.click(confirmBtn);
    expect(deleteDemoData).toHaveBeenCalledTimes(1);
  });

  it('schließt den Dialog über Abbrechen, ohne zu löschen', () => {
    mockStatus = { hasDemoData: true, seededAt: '2026-08-01T00:00:00.000Z' };
    render(<DemoDataSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Demo-Daten löschen' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(deleteDemoData).not.toHaveBeenCalled();
  });
});
