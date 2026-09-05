/**
 * elementShape.test.js – Normalisierung von Zeichen-Elementen in ein
 * exportierbares Zwischenformat. Deckt die strukturelle Varianz ab:
 * scalar (Pfeile/Linie/Zone) vs. points-Array (Freehand), Board-Typen
 * (move/pass/shot/zone/freehand) vs. Legacy-Video-Typen (line/arrow).
 */
import { describe, it, expect } from 'vitest';
import { normalizeElementShape } from './elementShape.js';

describe('normalizeElementShape – Pfeile (Board-Typen)', () => {
  it('normalisiert move/pass/shot zu einem Pfeil mit Eigenheiten', () => {
    expect(normalizeElementShape({ type: 'move', x1: 0, y1: 0, x2: 10, y2: 5, color: '#facc15', strokeWidth: 3, arrowHead: true, dash: [] }))
      .toEqual({ kind: 'arrow', points: [[0, 0], [10, 5]], strokeWidth: 3, color: '#facc15', dash: [], arrowHead: true });
    expect(normalizeElementShape({ type: 'pass', x1: 1, y1: 1, x2: 2, y2: 2, color: '#f97316', dash: [12, 8] }))
      .toMatchObject({ kind: 'arrow', points: [[1, 1], [2, 2]], color: '#f97316', dash: [12, 8] });
    expect(normalizeElementShape({ type: 'shot', x1: 0, y1: 0, x2: 1, y2: 1, color: '#000' }))
      .toMatchObject({ kind: 'arrow' });
  });

  it("setzt Defaults (arrowHead=false, dash=[], strokeWidth=2), wenn Felder fehlen", () => {
    expect(normalizeElementShape({ type: 'move', x1: 0, y1: 0, x2: 3, y2: 3, color: '#fff' }))
      .toMatchObject({ strokeWidth: 2, dash: [], arrowHead: false });
  });
});

describe('normalizeElementShape – Legacy-Video-Typen', () => {
  it('behandelt scalar "arrow" wie einen Board-Pfeil', () => {
    expect(normalizeElementShape({ type: 'arrow', x1: 5, y1: 6, x2: 7, y2: 8, color: '#ef4444' }))
      .toMatchObject({ kind: 'arrow', points: [[5, 6], [7, 8]] });
  });

  it('behandelt scalar "line" als einfache Linie (ohne Pfeilspitze)', () => {
    expect(normalizeElementShape({ type: 'line', x1: 1, y1: 2, x2: 3, y2: 4, color: '#22c55e' }))
      .toEqual({ kind: 'line', points: [[1, 2], [3, 4]], strokeWidth: 2, color: '#22c55e', dash: [], arrowHead: false });
  });

  it('liest ältere Video-Typen auch aus einem points-Array', () => {
    expect(normalizeElementShape({ type: 'arrow', points: [1, 2, 3, 4], color: '#ef4444' }))
      .toMatchObject({ kind: 'arrow', points: [[1, 2], [3, 4]] });
    expect(normalizeElementShape({ type: 'line', points: [0, 0, 5, 5], color: '#22c55e' }))
      .toMatchObject({ kind: 'line', points: [[0, 0], [5, 5]] });
    // Weder scalar noch Punkte → null
    expect(normalizeElementShape({ type: 'line', color: '#22c55e' })).toBeNull();
  });
});

describe('normalizeElementShape – Zone', () => {
  it('normalisiert Eckpunkte auf min/abs (Zeichenrichtung egal)', () => {
    // x1,y1 muss nicht oben-links sein – Zone "rückwärts" gezogen
    expect(normalizeElementShape({ type: 'zone', x1: 8, y1: 6, x2: 2, y2: 3, color: '#a855f7', fillOpacity: 0.25 }))
      .toEqual({ kind: 'rect', x: 2, y: 3, w: 6, h: 3, fillOpacity: 0.25, strokeWidth: 2, color: '#a855f7' });
  });
});

describe('normalizeElementShape – Freehand', () => {
  it('paart das flache points-Array zu [x,y]-Punkten', () => {
    expect(normalizeElementShape({ type: 'freehand', points: [1, 2, 3, 4, 5, 6], color: '#3b82f6', strokeWidth: 4 }))
      .toEqual({ kind: 'polyline', points: [[1, 2], [3, 4], [5, 6]], tension: 0.4, strokeWidth: 4, color: '#3b82f6', dash: [] });
  });

  it('verwirft Polylinien mit weniger als 2 Punkten', () => {
    expect(normalizeElementShape({ type: 'freehand', points: [1, 2] })).toBeNull();
    expect(normalizeElementShape({ type: 'freehand', points: [] })).toBeNull();
  });
});

describe('normalizeElementShape – Randfälle', () => {
  it('liefert null für unbekannte Typen (winkel wird separat im Renderer behandelt)', () => {
    expect(normalizeElementShape({ type: 'winkel', x1: 0, y1: 0 })).toBeNull();
    expect(normalizeElementShape({ type: 'sdfsd', x1: 0, y1: 0 })).toBeNull();
  });

  it('liefert null für fehlende Elemente', () => {
    expect(normalizeElementShape(null)).toBeNull();
    expect(normalizeElementShape(undefined)).toBeNull();
    expect(normalizeElementShape({})).toBeNull();
  });
});