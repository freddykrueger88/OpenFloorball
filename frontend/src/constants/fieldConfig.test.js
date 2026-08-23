import { describe, it, expect } from 'vitest';
import { ensureBall, buildDefaultPlayers, BALL_ID } from './fieldConfig.js';

describe('ensureBall (ROADMAP-Backlog: beweglicher Ball)', () => {
  it('ergänzt einen Ball am Feldmittelpunkt, wenn keiner vorhanden ist', () => {
    const players = [{ id: 'h1', team: 'home', role: 'C', x: 5, y: 5 }];
    const result = ensureBall(players, 'large');

    expect(result).toHaveLength(2);
    const ball = result.find((p) => p.team === 'ball');
    expect(ball).toEqual({ id: BALL_ID, team: 'ball', role: null, x: 20, y: 10 });
  });

  it('lässt einen bereits vorhandenen Ball unverändert (keine Duplikate)', () => {
    const players = [
      { id: 'h1', team: 'home', role: 'C', x: 5, y: 5 },
      { id: BALL_ID, team: 'ball', role: null, x: 12, y: 3 },
    ];
    const result = ensureBall(players, 'large');

    expect(result).toBe(players); // unverändertes Array zurückgegeben
    expect(result.filter((p) => p.team === 'ball')).toHaveLength(1);
  });

  it('platziert den Ball je nach Feldtyp am jeweiligen Mittelpunkt', () => {
    const ball = ensureBall([], 'small').find((p) => p.team === 'ball');
    expect(ball.x).toBe(10);
    expect(ball.y).toBe(7);
  });
});

describe('buildDefaultPlayers', () => {
  it('enthält für jeden Feldtyp genau einen Ball zusätzlich zu den Spielern', () => {
    for (const fieldType of ['large', 'small', 'street', '3v3']) {
      const players = buildDefaultPlayers(fieldType);
      const balls = players.filter((p) => p.team === 'ball');
      expect(balls).toHaveLength(1);
    }
  });

  it('enthält standardmäßig auch die gegnerische Aufstellung', () => {
    const players = buildDefaultPlayers('large');
    expect(players.some((p) => p.team === 'away')).toBe(true);
  });

  // Issue 025: neue Boards sollen nur die eigene Mannschaft zeigen.
  it('lässt die gegnerische Aufstellung bei includeAway:false weg', () => {
    for (const fieldType of ['large', 'small', 'street', '3v3']) {
      const players = buildDefaultPlayers(fieldType, { includeAway: false });
      expect(players.some((p) => p.team === 'away')).toBe(false);
      expect(players.some((p) => p.team === 'home')).toBe(true);
      expect(players.some((p) => p.team === 'ball')).toBe(true);
    }
  });
});
