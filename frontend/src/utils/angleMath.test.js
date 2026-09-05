/**
 * angleMath.test.js – Geometrie-Helfer für den Torwart-Winkel (§9.7).
 * Reine Pure-Function-Tests gegen die Großfeld-Konfiguration (40×20m,
 * Tor 2,85m von der Bande, 1,60m breit).
 */
import { describe, it, expect } from 'vitest';
import { IFF_FIELDS } from '../constants/fieldConfig.js';
import {
  resolveGoalSide,
  getGoalCenter,
  getGoalPosts,
  computeAngleTriangle,
  getKeeperStancePresets,
  getKeeperClearancePoint,
  computeReboundZone,
} from './angleMath.js';

const large = IFF_FIELDS.large;

describe('angleMath – Ziel-Tor-Auflösung', () => {
  it('löst explizite Seiten unverändert auf', () => {
    expect(resolveGoalSide('left', 30, large)).toBe('left');
    expect(resolveGoalSide('right', 5, large)).toBe('right');
  });

  it("löst 'auto' in Richtung des nächstgelegenen Tores auf (Hälfte über x)", () => {
    expect(resolveGoalSide('auto', 5, large)).toBe('left');
    expect(resolveGoalSide('auto', 35, large)).toBe('right');
    // Exakt auf der Mittellinie (x = 20): strikte Links-Vergleichs →
    // 'right' (definiertes Randverhalten, Base-Standort dort ohnehin egal)
    expect(resolveGoalSide('auto', 20, large)).toBe('right');
  });

  it('liefert die Tor-Mitte auf der Torlinie (magnetisch zur Bande, nicht an ihr)', () => {
    expect(getGoalCenter(large, 'left')).toEqual({ x: 2.85, y: 10 });
    expect(getGoalCenter(large, 'right')).toEqual({ x: 40 - 2.85, y: 10 });
  });
});

describe('angleMath – Torpfosten & Winkel-Dreieck', () => {
  it('liefert die beiden Torpfosten eines Tores', () => {
    const [oben, unten] = getGoalPosts(large, 'left');
    expect(oben).toEqual({ x: 2.85, y: 10 - 0.8 });
    expect(unten).toEqual({ x: 2.85, y: 10 + 0.8 });
  });

  it('setzt das Dreieck aus beiden Pfosten + Scheitelpunkt zusammen', () => {
    const { side, points } = computeAngleTriangle(large, 'auto', 30, 10);
    expect(side).toBe('right'); // apex 30 > Mitte → rechtes Tor
    // Grundseite = rechtes Tor (x = 37.15), Spitze = (30,10)
    expect(points[0][0]).toBeCloseTo(37.15);
    expect(points[1][0]).toBeCloseTo(37.15);
    expect(points[2]).toEqual([30, 10]);
  });
});

describe('angleMath – Positionierungs-Presets (§9.7 Positionierung/Verschiebung)', () => {
  it('stellt "base" mittig vor das Tor, die Kontra-Stände seitlich versetzt', () => {
    const presets = getKeeperStancePresets(large, 'left');
    const byId = Object.fromEntries(presets.map((p) => [p.id, p]));

    expect(byId.base).toMatchObject({ x: 2.85 + large.goalAreaDepth * 0.3, y: 10 });
    expect(byId.base.x).toBeGreaterThan(2.85); // ins Feld hinein, nicht hinter dem Tor
    expect(byId.kontraOben.y).toBeLessThan(10);
    expect(byId.kontraUnten.y).toBeGreaterThan(10);
    expect(byId.kontraOben.x).toBeCloseTo(byId.kontraUnten.x);
  });

  it('spiegelt die Richtung für das rechte Tor (ins Feld hinein = x kleiner)', () => {
    const presets = getKeeperStancePresets(large, 'right');
    expect(presets[0].x).toBeLessThan(40 - 2.85);
  });
});

describe('angleMath – Konterauslösung (§9.7)', () => {
  it('verankert den Auslöse-Pfeil an der Torlinien-Mitte', () => {
    expect(getKeeperClearancePoint(large, 'left')).toEqual({ x: 2.85, y: 10 });
    expect(getKeeperClearancePoint(large, 'right')).toEqual({ x: 40 - 2.85, y: 10 });
  });
});

describe('angleMath – Rebound-Raum (§9.7)', () => {
  it('baut ein Trapez von der Tormaulkante zur gewählten Tiefe', () => {
    const { side, points } = computeReboundZone(large, 'auto', 10, 10);
    expect(side).toBe('left'); // x=10 < 20 → linkes Tor
    // Grundseite am linken Tor (x = 2.85), darüber/darunter um halbe Torbreite
    expect(points[0][0]).toBeCloseTo(2.85);
    expect(points[1][0]).toBeCloseTo(2.85);
    expect(points[0][1]).toBeCloseTo(10 - 0.8);
    expect(points[1][1]).toBeCloseTo(10 + 0.8);
    // Kegel-Front mit der Tiefe breiter als die Torbreite (Tiefe = dist ≈ 7.15)
    const frontY = [points[2][1], points[3][1]];
    expect(Math.abs(frontY[1] - frontY[0])).toBeGreaterThan(large.goalWidth);
    // Front liegt nahe der gewählten Tiefe
    expect(Math.abs((points[2][0] + points[3][0]) / 2 - 10)).toBeLessThan(2);
  });

  it('wird zusammen mit dem gewählten Tor explizit begrenzt (rechtes Tor)', () => {
    const { side, points } = computeReboundZone(large, 'right', 30, 12);
    expect(side).toBe('right');
    expect(points[0][0]).toBeCloseTo(40 - 2.85);
    expect(points[1][0]).toBeCloseTo(40 - 2.85);
  });

  it('clampt alle Punkte ins Spielfeld (Tiefe in die Ecke)', () => {
    const { points } = computeReboundZone(large, 'right', 39.9, 0.1);
    for (const [x, y] of points) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(large.width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(large.height);
    }
  });
});