/**
 * statisticsEngine.test.js – reine Berechnungslogik
 * (docs/planning/STATISTICS_ANALYTICS_ARCHITECTURE.md, Abschnitt 10),
 * isoliert ohne Testdatenbank testbar.
 */
import {
  calculateMatchScore, calculateLineStats, deriveZone, calculateShotStats, calculateGoalkeeperStats,
  calculateSpecialTeamsStats, calculateSituationalStats,
} from '../services/statisticsEngine.js';

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

describe('calculateSpecialTeamsStats', () => {
  it('liefert Nullwerte ohne Ereignisse', () => {
    expect(calculateSpecialTeamsStats([])).toEqual({
      powerPlay: { opportunities: 0, goals: 0, percentage: null },
      penaltyKill: { opportunities: 0, goalsAgainst: 0, percentage: null },
    });
  });

  it('zählt eine nicht-überlappende Gegner-Strafe als PP-Gelegenheit, Tor im Fenster als PP-Tor', () => {
    const events = [
      { event_type: 'penalty_2', is_opponent: true, period: 1, clock_seconds_at_event: 100 },
      { event_type: 'goal', is_opponent: false, period: 1, clock_seconds_at_event: 150 },
    ];
    const { powerPlay } = calculateSpecialTeamsStats(events, { periodMinutes: 20 });
    expect(powerPlay).toEqual({ opportunities: 1, goals: 1, percentage: 100 });
  });

  it('zählt eine nicht-überlappende eigene Strafe als PK-Gelegenheit, Gegentor im Fenster als Gegentor', () => {
    const events = [
      { event_type: 'penalty_5', is_opponent: false, period: 1, clock_seconds_at_event: 200 },
      { event_type: 'goal', is_opponent: true, period: 1, clock_seconds_at_event: 250 },
    ];
    const { penaltyKill } = calculateSpecialTeamsStats(events, { periodMinutes: 20 });
    expect(penaltyKill).toEqual({ opportunities: 1, goalsAgainst: 1, percentage: 0 });
  });

  it('zählt bei gleichzeitigen Strafen beider Teams keine Gelegenheit für keine Seite', () => {
    const events = [
      { event_type: 'penalty_2', is_opponent: false, period: 1, clock_seconds_at_event: 300 },
      { event_type: 'penalty_2', is_opponent: true, period: 1, clock_seconds_at_event: 300 },
    ];
    const { powerPlay, penaltyKill } = calculateSpecialTeamsStats(events, { periodMinutes: 20 });
    expect(powerPlay.opportunities).toBe(0);
    expect(penaltyKill.opportunities).toBe(0);
  });

  it('kappt das Strafenfenster am Periodenende – ein Tor danach zählt nicht mehr als PP-Tor', () => {
    const events = [
      { event_type: 'penalty_2', is_opponent: true, period: 1, clock_seconds_at_event: 1170 }, // Fenster würde bis 1290 gehen, gekappt auf 1200
      { event_type: 'goal', is_opponent: false, period: 1, clock_seconds_at_event: 1200 }, // genau am gekappten Ende – halb-offen, zählt nicht
    ];
    const { powerPlay } = calculateSpecialTeamsStats(events, { periodMinutes: 20 });
    expect(powerPlay).toEqual({ opportunities: 1, goals: 0, percentage: 0 });
  });

  it('ignoriert match_penalty vollständig (kein Fenster, keine Gelegenheit)', () => {
    const events = [
      { event_type: 'match_penalty', is_opponent: true, period: 1, clock_seconds_at_event: 50 },
      { event_type: 'penalty_2', is_opponent: true, period: 1, clock_seconds_at_event: 100 },
      { event_type: 'goal', is_opponent: false, period: 1, clock_seconds_at_event: 150 },
    ];
    const { powerPlay } = calculateSpecialTeamsStats(events, { periodMinutes: 20 });
    expect(powerPlay).toEqual({ opportunities: 1, goals: 1, percentage: 100 });
  });

  it('zählt zwei zeitlich getrennte eigene Strafen als zwei separate PK-Gelegenheiten (keine Intervall-Verschmelzung, ADR-0004)', () => {
    const events = [
      { event_type: 'penalty_2', is_opponent: false, period: 1, clock_seconds_at_event: 100 },
      { event_type: 'penalty_2', is_opponent: false, period: 1, clock_seconds_at_event: 400 },
    ];
    const { penaltyKill } = calculateSpecialTeamsStats(events, { periodMinutes: 20 });
    expect(penaltyKill.opportunities).toBe(2);
  });
});

describe('calculateSituationalStats', () => {
  it('liefert 3 leere Spielstand-Buckets und ein leeres byPeriod ohne Ereignisse', () => {
    const result = calculateSituationalStats([]);
    expect(result.byScoreState).toHaveLength(3);
    expect(result.byScoreState.map((b) => b.scoreState).sort()).toEqual(['leading', 'tied', 'trailing']);
    for (const bucket of result.byScoreState) {
      expect(bucket).toMatchObject({ ownGoals: 0, opponentGoals: 0, shots: 0, shotsOnGoal: 0, shotGoals: 0, shotPercentage: null });
    }
    expect(result.byPeriod).toEqual([]);
  });

  it('klassifiziert jedes Ereignis nach dem Spielstand VOR ihm, aktualisiert Tallies erst danach', () => {
    const events = [
      { event_type: 'goal', is_opponent: true, period: 1, created_at: '2026-01-01T10:00:00.000Z' }, // vor: 0-0 tied
      { event_type: 'goal', is_opponent: false, period: 1, created_at: '2026-01-01T10:01:00.000Z' }, // vor: 0-1 trailing
      { event_type: 'goal', is_opponent: false, period: 1, created_at: '2026-01-01T10:02:00.000Z' }, // vor: 1-1 tied
      { event_type: 'shot', is_opponent: false, outcome: 'miss', period: 1, created_at: '2026-01-01T10:03:00.000Z' }, // vor: 2-1 leading
    ];
    const { byScoreState } = calculateSituationalStats(events);
    const tied = byScoreState.find((b) => b.scoreState === 'tied');
    const trailing = byScoreState.find((b) => b.scoreState === 'trailing');
    const leading = byScoreState.find((b) => b.scoreState === 'leading');
    expect(tied).toMatchObject({ opponentGoals: 1, ownGoals: 1 });
    expect(trailing).toMatchObject({ ownGoals: 1 });
    expect(leading).toMatchObject({ shots: 1 });
  });

  it('zählt ein shot+Companion-Goal-Paar nur einmal bei ownGoals', () => {
    const events = [
      { event_type: 'shot', is_opponent: false, outcome: 'goal', period: 1, created_at: '2026-01-01T10:00:00.000Z' },
      { event_type: 'goal', is_opponent: false, period: 1, created_at: '2026-01-01T10:00:00.000Z' },
    ];
    const { byScoreState } = calculateSituationalStats(events);
    const totalOwnGoals = byScoreState.reduce((sum, b) => sum + b.ownGoals, 0);
    expect(totalOwnGoals).toBe(1);
    const totalShots = byScoreState.reduce((sum, b) => sum + b.shots, 0);
    expect(totalShots).toBe(1);
  });

  it('zählt ein Tor über das klassische Preset (ohne shot-Unterbau) korrekt', () => {
    const events = [{ event_type: 'goal', is_opponent: false, period: 1, created_at: '2026-01-01T10:00:00.000Z' }];
    const { byScoreState } = calculateSituationalStats(events);
    const totalOwnGoals = byScoreState.reduce((sum, b) => sum + b.ownGoals, 0);
    expect(totalOwnGoals).toBe(1);
  });

  it('gruppiert nach Periode, unbekannte Periode (null) landet als letzter Eintrag', () => {
    const events = [
      { event_type: 'goal', is_opponent: false, period: 2, created_at: '2026-01-01T10:00:00.000Z' },
      { event_type: 'goal', is_opponent: false, period: 1, created_at: '2026-01-01T10:01:00.000Z' },
      { event_type: 'goal', is_opponent: true, period: 3, created_at: '2026-01-01T10:02:00.000Z' },
      { event_type: 'goal', is_opponent: false, period: null, created_at: '2026-01-01T10:03:00.000Z' },
    ];
    const { byPeriod } = calculateSituationalStats(events);
    expect(byPeriod.map((p) => p.period)).toEqual([1, 2, 3, null]);
  });
});
