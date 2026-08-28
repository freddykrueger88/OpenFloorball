/**
 * LayerVisibilityPanel.test.jsx – Layer-System (CLAUDE.md §10.2).
 * Deckt nur die Panel-UI ab (Toggle-Klick → onToggle, aria-pressed/
 * Eye-Icon-Wechsel) – die eigentliche Filterlogik steckt in
 * PlayerLayer.jsx/DrawingLayer.jsx/CommentPinsLayer.jsx (Konva, dort
 * nicht sinnvoll isoliert testbar ohne vollen Canvas-Aufbau).
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import i18n from '../../i18n/i18n.js';
import LayerVisibilityPanel from './LayerVisibilityPanel.jsx';

beforeAll(async () => { await i18n.changeLanguage('de'); });

describe('LayerVisibilityPanel', () => {
  it('zeigt alle acht Layer standardmäßig als sichtbar (aria-pressed=true)', () => {
    render(<LayerVisibilityPanel visibility={{}} onToggle={() => {}} />);

    // aria-label ist "{Layer} ausblenden"/"einblenden" (beschreibt die
    // Klick-Wirkung), daher Regex statt exaktem Namen.
    for (const label of ['Eigene Spieler', 'Gegner', 'Laufwege', 'Passwege', 'Schüsse', 'Freihand', 'Trainingszonen', 'Kommentar-Pins']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${label} ausblenden$`) })).toHaveAttribute('aria-pressed', 'true');
    }
  });

  it('ruft onToggle mit dem passenden Layer-Key auf', () => {
    const onToggle = vi.fn();
    render(<LayerVisibilityPanel visibility={{}} onToggle={onToggle} />);

    fireEvent.click(screen.getByRole('button', { name: 'Gegner ausblenden' }));
    expect(onToggle).toHaveBeenCalledWith('away');
  });

  it('zeigt einen ausgeblendeten Layer als aria-pressed=false und bietet ihn zum Wieder-Einblenden an', () => {
    render(<LayerVisibilityPanel visibility={{ zone: false }} onToggle={() => {}} />);
    expect(screen.getByRole('button', { name: 'Trainingszonen einblenden' })).toHaveAttribute('aria-pressed', 'false');
  });
});
