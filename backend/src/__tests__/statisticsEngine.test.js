/**
 * statisticsEngine.test.js – reine Berechnungslogik
 * (docs/planning/STATISTICS_ANALYTICS_ARCHITECTURE.md, Abschnitt 10),
 * isoliert ohne Testdatenbank testbar.
 */
import { calculateMatchScore } from '../services/statisticsEngine.js';

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
