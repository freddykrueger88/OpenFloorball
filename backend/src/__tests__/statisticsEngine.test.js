/**
 * statisticsEngine.test.js – reine Berechnungslogik
 * (docs/planning/STATISTICS_ANALYTICS_ARCHITECTURE.md, Abschnitt 10),
 * isoliert ohne Testdatenbank testbar.
 */
import { calculateMatchScore, calculateLineStats, deriveZone, calculateShotStats, calculateGoalkeeperStats } from '../services/statisticsEngine.js';

describe('calculateMatchScore', () => {
  it('zählt eigene und gegnerische Tore getrennt', () => {
    const events = [
      { event_type: 'goal', is_opponent: false },
      { event_type: 'goal', is_opponent: false },
      { event_type: 'goal', is_opponent: true },
      { event_type: 'penalty_2', is_opponent: false },
    ];
    expect(calculateMatchScore(events)).toEqual({ ownGoals: 2, opponentGoals: 1 });
  });

  it('zählt ein Tor ohne Spielerzuordnung als eigenes Tor', () => {
    const events = [{ event_type: 'goal', is_opponent: false, roster_player_id: null }];
    expect(calculateMatchScore(events)).toEqual({ ownGoals: 1, opponentGoals: 0 });
  });

  it('liefert 0:0 ohne Ereignisse', () => {
    expect(calculateMatchScore([])).toEqual({ ownGoals: 0, opponentGoals: 0 });
  });

  it('ignoriert Nicht-Tor-Ereignisse', () => {
    const events = [
      { event_type: 'timeout', is_opponent: false },
      { event_type: 'kickoff_q1', is_opponent: false },
    ];
    expect(calculateMatchScore(events)).toEqual({ ownGoals: 0, opponentGoals: 0 });
  });
});

describe('calculateLineStats', () => {
  const T0 = '2026-01-01T10:00:00.000Z';
  const T0_PLUS_2MIN = '2026-01-01T10:02:00.000Z';
  const T1 = '2026-01-01T10:05:00.000Z';
  const T1_PLUS_2MIN = '2026-01-01T10:07:00.000Z';
  const T2 = '2026-01-01T10:10:00.000Z';

  it('zwei geschlossene Zeitfenster mit unterschiedlichen Toren je Line', () => {
    const matchLines = [
      { line_id: 'A', line_name: 'Line A', started_at: T0, ended_at: T1 },
      { line_id: 'B', line_name: 'Line B', started_at: T1, ended_at: T2 },
    ];
    const events = [
      { event_type: 'goal', is_opponent: false, created_at: T0_PLUS_2MIN },
      { event_type: 'goal', is_opponent: true, created_at: T1_PLUS_2MIN },
    ];
    const result = calculateLineStats(matchLines, events);
    const a = result.find((r) => r.lineId === 'A');
    const b = result.find((r) => r.lineId === 'B');
    expect(a).toMatchObject({ totalSeconds: 300, hasOpenShift: false, goalsFor: 1, goalsAgainst: 0 });
    expect(b).toMatchObject({ totalSeconds: 300, hasOpenShift: false, goalsFor: 0, goalsAgainst: 1 });
  });

  it('offene Zeile mit now=null bleibt bei Dauer UND Toren unberücksichtigt ("unbekannt ≠ 0")', () => {
    const matchLines = [{ line_id: 'C', line_name: 'Line C', started_at: T0, ended_at: null }];
    const events = [{ event_type: 'goal', is_opponent: false, created_at: T0_PLUS_2MIN }];
    const [result] = calculateLineStats(matchLines, events);
    expect(result.totalSeconds).toBeNull();
    expect(result.hasOpenShift).toBe(true);
    expect(result.goalsFor).toBe(0);
  });

  it('offene Zeile mit gesetztem now zählt bis now, bleibt aber als vorläufig markiert', () => {
    const now = new Date('2026-01-01T10:02:00.000Z');
    const matchLines = [{ line_id: 'C', line_name: 'Line C', started_at: T0, ended_at: null }];
    const events = [{ event_type: 'goal', is_opponent: false, created_at: '2026-01-01T10:01:00.000Z' }];
    const [result] = calculateLineStats(matchLines, events, { now });
    expect(result.totalSeconds).toBe(120);
    expect(result.hasOpenShift).toBe(true);
    expect(result.goalsFor).toBe(1);
  });

  it('ein Tor genau auf der Wechsel-Sekunde gehört zur neu geöffneten Line (halb-offenes Intervall)', () => {
    const matchLines = [
      { line_id: 'A', line_name: 'Line A', started_at: T0, ended_at: T1 },
      { line_id: 'B', line_name: 'Line B', started_at: T1, ended_at: T2 },
    ];
    const events = [{ event_type: 'goal', is_opponent: false, created_at: T1 }];
    const result = calculateLineStats(matchLines, events);
    const a = result.find((r) => r.lineId === 'A');
    const b = result.find((r) => r.lineId === 'B');
    expect(a.goalsFor).toBe(0);
    expect(b.goalsFor).toBe(1);
  });

  it('gruppiert eine gelöschte Vorlage (line_id null) separat, selbst bei gleichem line_name', () => {
    const matchLines = [
      { line_id: 'X', line_name: 'Line A', started_at: T0, ended_at: T1 },
      { line_id: null, line_name: 'Line A', started_at: T1, ended_at: T2 },
    ];
    const result = calculateLineStats(matchLines, []);
    expect(result).toHaveLength(2);
  });

  it('ordnet ein Tor vor der ersten Line-Aktivierung keiner Line zu und wirft keinen Fehler', () => {
    const matchLines = [{ line_id: 'A', line_name: 'Line A', started_at: T1, ended_at: T2 }];
    const events = [{ event_type: 'goal', is_opponent: false, created_at: T0 }];
    const result = calculateLineStats(matchLines, events);
    expect(result[0].goalsFor).toBe(0);
  });

  it('eine gemischte Gruppe (eine geschlossene + eine offene Zeile derselben Line) ergibt die bekannte Summe trotz hasOpenShift', () => {
    const matchLines = [
      { line_id: 'D', line_name: 'Line D', started_at: T0, ended_at: T1 },
      { line_id: 'D', line_name: 'Line D', started_at: T2, ended_at: null },
    ];
    const [result] = calculateLineStats(matchLines, []);
    expect(result.totalSeconds).toBe(300);
    expect(result.hasOpenShift).toBe(true);
  });

  it('liefert ein leeres Array ohne Aktivierungen', () => {
    expect(calculateLineStats([], [])).toEqual([]);
  });
});

describe('deriveZone', () => {
  it('ordnet jede der 5 Zonen korrekt zu', () => {
    expect(deriveZone(0.9, 0.5)).toBe('nahzone_zentrum');
    expect(deriveZone(0.9, 0.1)).toBe('nahzone_links');
    expect(deriveZone(0.9, 0.9)).toBe('nahzone_rechts');
    expect(deriveZone(0.5, 0.5)).toBe('halbdistanz');
    expect(deriveZone(0.1, 0.5)).toBe('distanz');
  });

  it('behandelt Grenzwerte exakt auf der Schwelle als "innerhalb"', () => {
    expect(deriveZone(0.72, 0.5)).toBe('nahzone_zentrum');
    expect(deriveZone(0.40, 0.5)).toBe('halbdistanz');
    expect(deriveZone(0.9, 0.35)).toBe('nahzone_zentrum');
    expect(deriveZone(0.9, 0.65)).toBe('nahzone_zentrum');
  });

  it('liefert null bei fehlender Eingabe', () => {
    expect(deriveZone(null, 0.5)).toBeNull();
    expect(deriveZone(0.5, undefined)).toBeNull();
  });

  it('clamped Werte außerhalb [0,1]', () => {
    expect(deriveZone(1.5, 0.5)).toBe('nahzone_zentrum');
    expect(deriveZone(-0.5, 0.5)).toBe('distanz');
  });
});

describe('calculateShotStats', () => {
  it('liefert Nullwerte ohne Schüsse', () => {
    expect(calculateShotStats([])).toMatchObject({ shots: 0, shotsOnGoal: 0, goals: 0, saves: 0, misses: 0, blocks: 0, shotPercentage: null, byZone: [] });
  });

  it('berechnet Shot-% aus goals/shotsOnGoal (goal+save), nicht aus allen Schüssen', () => {
    const events = [
      { event_type: 'shot', outcome: 'goal', zone: 'nahzone_zentrum' },
      { event_type: 'shot', outcome: 'save', zone: 'nahzone_zentrum' },
      { event_type: 'shot', outcome: 'miss', zone: 'distanz' },
      { event_type: 'shot', outcome: 'block', zone: 'distanz' },
    ];
    const result = calculateShotStats(events);
    expect(result.shots).toBe(4);
    expect(result.shotsOnGoal).toBe(2);
    expect(result.goals).toBe(1);
    expect(result.shotPercentage).toBeCloseTo(50);
  });

  it('liefert shotPercentage=null statt 0, wenn keine Schüsse aufs Tor gingen ("unbekannt ≠ 0")', () => {
    const events = [
      { event_type: 'shot', outcome: 'miss' },
      { event_type: 'shot', outcome: 'block' },
    ];
    expect(calculateShotStats(events).shotPercentage).toBeNull();
  });

  it('gruppiert byZone, inkl. "unbekannt"-Bucket für Schüsse ohne zone/x/y', () => {
    const events = [
      { event_type: 'shot', outcome: 'goal', zone: 'distanz' },
      { event_type: 'shot', outcome: 'save', zone: null, x: null, y: null },
    ];
    const byZone = calculateShotStats(events).byZone;
    expect(byZone.find((b) => b.zone === 'distanz').shots).toBe(1);
    expect(byZone.find((b) => b.zone === null).shots).toBe(1);
  });

  it('leitet die Zone aus x/y ab, wenn die Zeile keine zone trägt', () => {
    const events = [{ event_type: 'shot', outcome: 'goal', zone: null, x: 0.9, y: 0.5 }];
    const byZone = calculateShotStats(events).byZone;
    expect(byZone[0].zone).toBe('nahzone_zentrum');
  });

  it('ignoriert Nicht-shot-Ereignisse', () => {
    const events = [{ event_type: 'goal', is_opponent: false }];
    expect(calculateShotStats(events).shots).toBe(0);
  });
});

describe('calculateGoalkeeperStats', () => {
  it('gruppiert Gegner-Schüsse nach secondary_roster_player_id', () => {
    const events = [
      { event_type: 'shot', is_opponent: true, secondary_roster_player_id: 'kp1', outcome: 'save' },
      { event_type: 'shot', is_opponent: true, secondary_roster_player_id: 'kp1', outcome: 'goal' },
      { event_type: 'shot', is_opponent: true, secondary_roster_player_id: 'kp2', outcome: 'save' },
    ];
    const result = calculateGoalkeeperStats(events);
    const kp1 = result.find((r) => r.rosterPlayerId === 'kp1');
    const kp2 = result.find((r) => r.rosterPlayerId === 'kp2');
    expect(kp1).toMatchObject({ shotsAgainst: 2, shotsOnGoalAgainst: 2, saves: 1, goalsAgainst: 1 });
    expect(kp1.savePercentage).toBeCloseTo(50);
    expect(kp2).toMatchObject({ shotsAgainst: 1, saves: 1, goalsAgainst: 0 });
  });

  it('schließt Schüsse ohne zugeordneten Torhüter aus', () => {
    const events = [{ event_type: 'shot', is_opponent: true, secondary_roster_player_id: null, outcome: 'goal' }];
    expect(calculateGoalkeeperStats(events)).toEqual([]);
  });

  it('schließt eigene Schüsse aus, selbst wenn secondary_roster_player_id gesetzt ist (Assist-Fall)', () => {
    const events = [{ event_type: 'shot', is_opponent: false, secondary_roster_player_id: 'assist1', outcome: 'goal' }];
    expect(calculateGoalkeeperStats(events)).toEqual([]);
  });

  it('liefert savePercentage=null bei 0 Schüssen aufs Tor', () => {
    const events = [{ event_type: 'shot', is_opponent: true, secondary_roster_player_id: 'kp1', outcome: 'block' }];
    const [result] = calculateGoalkeeperStats(events);
    expect(result.savePercentage).toBeNull();
  });
});
