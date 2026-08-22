/**
 * formatStatsSummary.test.js – reine Formatierungslogik für den
 * Spiel-Insights-Prompt (Statistik-Architektur Phase 9), isoliert ohne
 * Testdatenbank/HTTP testbar (analog statisticsEngine.test.js). Der
 * eigentliche KI-Aufruf wird in ai.test.js nicht end-to-end getestet
 * (kein echter/gemockter KI-Anbieter in der Test-Suite) – diese Datei
 * deckt stattdessen die Textbausteine ab, die tatsächlich in den Prompt
 * fließen.
 */
import { formatStatsSummary } from '../controllers/aiController.js';

describe('formatStatsSummary', () => {
  it('benennt fehlendes Schuss-Tracking explizit statt 0%/leere Werte zu zeigen ("unbekannt ≠ 0")', () => {
    const summary = formatStatsSummary([{ event_type: 'goal', is_opponent: false }], 20);
    expect(summary).toContain('Kein Schuss-Tracking für dieses Spiel erfasst.');
    expect(summary).toContain('Keine Powerplay-/Unterzahl-Situationen in diesem Spiel.');
  });

  it('enthält keine Spieler-IDs/Namen im Text, auch wenn Events welche tragen', () => {
    const events = [
      { event_type: 'shot', is_opponent: false, outcome: 'goal', x: 0.95, y: 0.5, roster_player_id: 'abc-123', created_at: new Date().toISOString() },
    ];
    const summary = formatStatsSummary(events, 20);
    expect(summary).not.toContain('abc-123');
  });

  it('fasst Schuss-Statistiken inkl. Zonen-Aufschlüsselung zusammen', () => {
    const events = [
      { event_type: 'shot', is_opponent: false, outcome: 'goal', x: 0.95, y: 0.5, zone: 'nahzone_zentrum', created_at: new Date().toISOString() },
      { event_type: 'shot', is_opponent: false, outcome: 'save', x: 0.95, y: 0.5, zone: 'nahzone_zentrum', created_at: new Date().toISOString() },
      { event_type: 'shot', is_opponent: false, outcome: 'miss', x: 0.1, y: 0.5, zone: 'distanz', created_at: new Date().toISOString() },
    ];
    const summary = formatStatsSummary(events, 20);
    expect(summary).toContain('Schüsse gesamt: 3');
    expect(summary).toContain('nahzone_zentrum (2 Schüsse, 1 Tore)');
    expect(summary).toContain('distanz (1 Schüsse, 0 Tore)');
  });

  it('fasst Special-Teams-Kennzahlen zusammen, wenn Strafzeiten erfasst wurden', () => {
    const events = [
      { event_type: 'penalty_2', is_opponent: true, period: 1, clock_seconds_at_event: 100, created_at: new Date().toISOString() },
      { event_type: 'goal', is_opponent: false, period: 1, clock_seconds_at_event: 150, created_at: new Date().toISOString() },
    ];
    const summary = formatStatsSummary(events, 20);
    expect(summary).toContain('Powerplay: 1 Gelegenheiten, 1 Tore');
  });

  it('fasst Situations-Splits nach Spielstand zusammen', () => {
    const events = [
      { event_type: 'goal', is_opponent: false, created_at: '2026-01-01T10:00:00Z' },
      { event_type: 'goal', is_opponent: false, created_at: '2026-01-01T10:05:00Z' },
    ];
    const summary = formatStatsSummary(events, 20);
    expect(summary).toContain('Unentschieden: 1 eigene Tore');
    expect(summary).toContain('In Führung: 1 eigene Tore');
  });
});
