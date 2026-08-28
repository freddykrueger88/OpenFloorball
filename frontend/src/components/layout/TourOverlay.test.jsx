/**
 * TourOverlay.test.jsx – bisher hatte die gemeinsame Spotlight-Komponente
 * beider Touren (Nav-/Editor-Tour) nur den reinen Store getestet
 * (tourStore.test.js), nicht das tatsächliche Rendering/die Navigation
 * zwischen Schritten oder das Persistieren des "gesehen"-Status. Deckt
 * das hier nach (UI/UX-Audit 2026-08-28).
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '../../i18n/i18n.js';
import i18n from '../../i18n/i18n.js';
import useAuthStore from '../../store/authStore.js';
import useTourStore from '../../store/tourStore.js';
import TourOverlay from './TourOverlay.jsx';

const updateSettings = vi.fn().mockResolvedValue({});

vi.mock('../../hooks/useSettings.js', () => ({
  useSettings: () => ({ settings: { tourCompleted: true }, loading: false, updateSettings }),
}));

const STEPS = [
  { target: null, titleKey: 'tour.welcomeTitle', bodyKey: 'tour.welcomeBody' },
  { target: 'my-target', titleKey: 'tour.boardsGroupTitle', bodyKey: 'tour.boardsGroupBody' },
  { target: null, titleKey: 'tour.doneTitle', bodyKey: 'tour.doneBody' },
];

function renderOverlay(props = {}) {
  return render(
    <>
      <div data-tour="my-target" style={{ width: 10, height: 10 }} />
      <TourOverlay tourId="nav" steps={STEPS} settingsKey="tourCompleted" autoStart={false} {...props} />
    </>
  );
}

beforeAll(async () => { await i18n.changeLanguage('de'); });

beforeEach(() => {
  useAuthStore.setState({ user: { id: 'u1', email: 'coach@example.com' } });
  useTourStore.setState({ activeTourId: null, stepIndex: 0 });
  updateSettings.mockClear();
});

afterEach(() => {
  useAuthStore.setState({ user: null });
  useTourStore.setState({ activeTourId: null, stepIndex: 0 });
});

describe('TourOverlay', () => {
  it('rendert nichts, solange keine Tour mit dieser tourId aktiv ist', () => {
    renderOverlay();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('zeigt den ersten Schritt (Willkommen), sobald die Tour manuell gestartet wird', () => {
    useTourStore.getState().start('nav');
    renderOverlay();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Willkommen bei OpenFloorball!')).toBeInTheDocument();
    expect(screen.getByText('Schritt 1 von 3')).toBeInTheDocument();
    // Erster Schritt: kein "Zurück"-Button
    expect(screen.queryByRole('button', { name: 'Zurück' })).not.toBeInTheDocument();
  });

  it('zeigt beim Schritt ohne target den flächigen Hintergrund statt eines Spotlights', () => {
    useTourStore.getState().start('nav');
    const { container } = renderOverlay();
    expect(container.querySelector('[class*="plainBackdrop"]')).toBeInTheDocument();
    expect(container.querySelector('[class*="spotlight"]')).not.toBeInTheDocument();
  });

  it('hebt das Zielelement per Spotlight hervor, sobald ein Schritt ein target hat', () => {
    useTourStore.setState({ activeTourId: 'nav', stepIndex: 1 });
    const { container } = renderOverlay();
    // jsdom berechnet kein echtes Layout – offsetParent bleibt für jedes
    // Element null, obwohl TourOverlay.jsx genau das als Sichtbarkeits-
    // Filter nutzt (siehe Datei-Kommentar dort: mehrere data-tour-Treffer
    // möglich, z.B. Desktop-/Mobil-Nav, nur das sichtbare zählt). Für den
    // Test wird die reale Browser-Eigenschaft hier nachgestellt.
    const target = container.querySelector('[data-tour="my-target"]');
    Object.defineProperty(target, 'offsetParent', { value: document.body, configurable: true });
    fireEvent.resize(window);

    expect(screen.getByText('Boards')).toBeInTheDocument();
    expect(container.querySelector('[class*="spotlight"]')).toBeInTheDocument();
  });

  it('navigiert mit "Weiter"/"Zurück" zwischen den Schritten', () => {
    useTourStore.getState().start('nav');
    renderOverlay();

    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(screen.getByText('Schritt 2 von 3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(screen.getByText('Schritt 1 von 3')).toBeInTheDocument();
  });

  it('beendet die Tour beim letzten Schritt über "Fertig" und persistiert den Status', async () => {
    useTourStore.setState({ activeTourId: 'nav', stepIndex: 2 });
    renderOverlay();

    expect(screen.getByRole('button', { name: 'Fertig' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fertig' }));

    expect(useTourStore.getState().activeTourId).toBeNull();
    await vi.waitFor(() => expect(updateSettings).toHaveBeenCalledWith({ tourCompleted: true }));
  });

  it('bricht die Tour über "Überspringen" an jedem Schritt ab und persistiert den Status', async () => {
    useTourStore.getState().start('nav');
    renderOverlay();

    fireEvent.click(screen.getByRole('button', { name: 'Überspringen' }));

    expect(useTourStore.getState().activeTourId).toBeNull();
    await vi.waitFor(() => expect(updateSettings).toHaveBeenCalledWith({ tourCompleted: true }));
  });

  it('schließt bei Escape wie ein Überspringen', async () => {
    useTourStore.getState().start('nav');
    renderOverlay();

    fireEvent.keyDown(screen.getByRole('dialog').closest('div'), { key: 'Escape' });

    expect(useTourStore.getState().activeTourId).toBeNull();
    await vi.waitFor(() => expect(updateSettings).toHaveBeenCalled());
  });
});
