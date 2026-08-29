/**
 * dashboardSelectors.test.js – Spieler-Dashboard-Ausbau: schließt abgesagte
 * Termine aus, berücksichtigt verlegte, sortiert korrekt.
 */
import { describe, it, expect } from 'vitest';
import {
  selectNextMatch, selectNextTraining, selectLastMatch, selectUpcomingEvents, selectSeasonRecord,
  normalizeNextMatch,
} from './dashboardSelectors.js';

function futureDateString(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

describe('selectNextMatch', () => {
  it('wählt das früheste zukünftige, nicht abgesagte Spiel', () => {
    const games = [
      { _id: 'far', status: 'scheduled', playedAt: futureDateString(10) },
      { _id: 'near', status: 'scheduled', playedAt: futureDateString(2) },
      { _id: 'cancelled', status: 'cancelled', playedAt: futureDateString(1) },
    ];
    expect(selectNextMatch(games)._id).toBe('near');
  });

  it('berücksichtigt ein verlegtes Spiel über sein aktuelles Datum', () => {
    const games = [
      { _id: 'postponed', status: 'postponed', playedAt: futureDateString(5) },
    ];
    expect(selectNextMatch(games)._id).toBe('postponed');
  });

  it('gibt null zurück, wenn kein zukünftiges Spiel existiert', () => {
    expect(selectNextMatch([])).toBeNull();
    expect(selectNextMatch([{ _id: 'past', status: 'scheduled', playedAt: futureDateString(-30) }])).toBeNull();
  });
});

describe('selectNextTraining', () => {
  it('wählt das früheste zukünftige, nicht abgesagte Training', () => {
    const sessions = [
      { _id: 'far', status: 'scheduled', scheduledDate: futureDateString(7) },
      { _id: 'near', status: 'scheduled', scheduledDate: futureDateString(1) },
      { _id: 'cancelled', status: 'cancelled', scheduledDate: futureDateString(1) },
    ];
    expect(selectNextTraining(sessions)._id).toBe('near');
  });
});

describe('selectLastMatch', () => {
  it('wählt das letzte, tatsächlich vergangene Spiel (neuestes zuerst)', () => {
    const games = [
      { _id: 'older', status: 'scheduled', playedAt: futureDateString(-30) },
      { _id: 'newer', status: 'scheduled', playedAt: futureDateString(-10) },
      { _id: 'future', status: 'scheduled', playedAt: futureDateString(10) },
    ];
    expect(selectLastMatch(games)._id).toBe('newer');
  });

  it('ignoriert abgesagte vergangene Spiele', () => {
    const games = [{ _id: 'cancelled', status: 'cancelled', playedAt: futureDateString(-10) }];
    expect(selectLastMatch(games)).toBeNull();
  });
});

describe('selectUpcomingEvents', () => {
  it('mischt Spiele und Trainings chronologisch und begrenzt auf limit', () => {
    const games = [{ _id: 'g1', status: 'scheduled', playedAt: futureDateString(5), opponent: 'Gegner' }];
    const sessions = [
      { _id: 't1', status: 'scheduled', scheduledDate: futureDateString(1), name: 'Training A' },
      { _id: 't2', status: 'scheduled', scheduledDate: futureDateString(2), name: 'Training B' },
    ];
    const result = selectUpcomingEvents(games, sessions, { limit: 2 });
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('t1');
    expect(result[1].id).toBe('t2');
  });

  it('schließt abgesagte Termine aus', () => {
    const sessions = [{ _id: 't1', status: 'cancelled', scheduledDate: futureDateString(1), name: 'X' }];
    expect(selectUpcomingEvents([], sessions)).toHaveLength(0);
  });
});

describe('selectSeasonRecord', () => {
  it('aggregiert Siege/Unentschieden/Niederlagen und Tordifferenz aus result/ownGoals/opponentGoals', () => {
    const games = [
      { result: 'win', ownGoals: 5, opponentGoals: 2 },
      { result: 'loss', ownGoals: 1, opponentGoals: 3 },
      { result: 'draw', ownGoals: 2, opponentGoals: 2 },
      { result: null, ownGoals: 0, opponentGoals: 0 }, // noch nicht gespielt
    ];
    const record = selectSeasonRecord(games);
    expect(record.games).toBe(3);
    expect(record.won).toBe(1);
    expect(record.draw).toBe(1);
    expect(record.lost).toBe(1);
    expect(record.goalDiff).toBe(1); // (5+1+2) - (2+3+2) = 8 - 7
  });

  it('gibt null zurück, wenn noch kein Spiel ein Ergebnis hat', () => {
    expect(selectSeasonRecord([{ result: null }])).toBeNull();
  });
});

describe('normalizeNextMatch', () => {
  it('normalisiert ein lokales games-Objekt', () => {
    const n = normalizeNextMatch({
      _id: 'g1', opponent: 'Wolves', playedAt: '2026-09-20', kickoffTime: '18:30',
      isHome: true, venueName: 'Halle', venueAddress: 'Adr', venueLat: 1, venueLng: 2, status: 'scheduled',
    });
    expect(n).toEqual(expect.objectContaining({
      id: 'g1', source: 'local', date: '2026-09-20', time: '18:30', opponent: 'Wolves', venueLat: 1,
    }));
  });

  it('normalisiert ein Saisonmanager-Objekt ohne Koordinaten', () => {
    const n = normalizeNextMatch({
      source: 'saisonmanager', date: '2026-09-20', time: '18:30', opponent: 'Wolves',
      isHome: false, venueName: 'Halle', venueAddress: 'Adr', status: 'scheduled',
    });
    expect(n.id).toBeNull();
    expect(n.source).toBe('saisonmanager');
    expect(n.venueLat).toBeNull();
  });

  it('gibt null für kein Spiel zurück', () => {
    expect(normalizeNextMatch(null)).toBeNull();
  });
});
