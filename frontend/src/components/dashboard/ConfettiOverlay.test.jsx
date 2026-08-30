/**
 * ConfettiOverlay.test.jsx – reines Deko-Overlay für den Geburtstags-
 * Klick-Gimmick. Deckt die zwei Lebenswege ab: normaler Ablauf (Canvas
 * rendert, ruft onDone nach der Animation) und reduzierte Bewegung
 * (CLAUDE.md §16 Accessibility First: keine Animation, kurzer onDone).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import ConfettiOverlay from './ConfettiOverlay.jsx';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ConfettiOverlay', () => {
  it('zeigt keine Animation und ruft onDone zeitnah auf, wenn reduzierte Bewegung bevorzugt wird', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    const onDone = vi.fn();
    render(<ConfettiOverlay onDone={onDone} />);

    await waitFor(() => expect(onDone).toHaveBeenCalled(), { timeout: 2000 });
  });

  it('rendert ein Canvas und ruft onDone auf, sobald die Animation abgelaufen ist', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    // jsdom implementiert HTMLCanvasElement.getContext nicht (kein echtes
    // Rendering nötig – nur die reine Frame-Loop-Logik wird hier geprüft).
    vi.spyOn(window.HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(), save: vi.fn(), translate: vi.fn(), rotate: vi.fn(),
      fillRect: vi.fn(), restore: vi.fn(),
    });
    // Erster Frame liegt bereits weit über der Animationsdauer -> onDone
    // feuert nach einem einzigen requestAnimationFrame-Tick, deterministisch
    // ohne echte 3-Sekunden-Wartezeit im Test.
    vi.stubGlobal('requestAnimationFrame', (cb) => { cb(999999); return 1; });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const onDone = vi.fn();
    const { container } = render(<ConfettiOverlay onDone={onDone} />);

    expect(container.querySelector('canvas')).toBeInTheDocument();
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });
});
