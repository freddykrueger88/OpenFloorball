/**
 * dashboardSelectors – reine, testbare Auswahl-/Aufbereitungsfunktionen
 * für das Spieler-Dashboard (DashboardPage.jsx/useDashboardData.js).
 * Getrennt von Datenabruf (Hooks) und Darstellung (Komponenten).
 */
import { toLocalDate, isWithinLiveOrFutureWindow } from './countdown.js';

// Nächstes, noch nicht sicher vorbei gegangenes Spiel – schließt abgesagte Spiele
// aus, berücksichtigt verlegte Spiele über ihr (bereits aktualisiertes)
// `playedAt`. "Noch nicht vorbei" nutzt dasselbe Zeitfenster wie
// getCountdown, damit ein laufendes Spiel nicht sofort ins "letzte Spiel"
// rutscht, bevor der Trainer es abgeschlossen hat.
export function selectNextMatch(games) {
  const now = new Date();
  const candidates = games
    .filter((g) => g.status !== 'cancelled' && g.playedAt)
    .map((g) => ({ game: g, date: toLocalDate(g.playedAt, g.kickoffTime) }))
    .filter((c) => c.date)
    .sort((a, b) => a.date - b.date);

  const next = candidates.find((c) => isWithinLiveOrFutureWindow(c.date, now));
  return next?.game ?? null;
}

export function selectNextTraining(sessions) {
  const now = new Date();
  const candidates = sessions
    .filter((s) => s.status !== 'cancelled' && s.scheduledDate)
    .map((s) => ({ session: s, date: toLocalDate(s.scheduledDate, s.startTime) }))
    .filter((c) => c.date)
    .sort((a, b) => a.date - b.date);

  const next = candidates.find((c) => isWithinLiveOrFutureWindow(c.date, now));
  return next?.session ?? null;
}

// Letztes tatsächlich vergangenes Spiel (unabhängig vom Status – ein
// abgesagtes Spiel taucht hier bewusst nicht als "letztes Spiel" auf, ein
// verlegtes schon, sobald sein neuer Termin vorbei ist).
export function selectLastMatch(games) {
  const now = new Date();
  const past = games
    .filter((g) => g.status !== 'cancelled' && g.playedAt)
    .map((g) => ({ game: g, date: toLocalDate(g.playedAt, g.kickoffTime) }))
    .filter((c) => c.date && !isWithinLiveOrFutureWindow(c.date, now) && c.date.getTime() < now.getTime())
    .sort((a, b) => b.date - a.date);
  return past[0]?.game ?? null;
}

// Nächste `limit` Termine (Spiele + Trainings gemischt), chronologisch.
export function selectUpcomingEvents(games, sessions, { limit = 5 } = {}) {
  const now = new Date();
  const gameEvents = games
    .filter((g) => g.status !== 'cancelled' && g.playedAt)
    .map((g) => ({ type: 'game', id: g._id, date: toLocalDate(g.playedAt, g.kickoffTime), title: g.opponent, status: g.status }));
  const trainingEvents = sessions
    .filter((s) => s.status !== 'cancelled' && s.scheduledDate)
    .map((s) => ({ type: 'training', id: s._id, date: toLocalDate(s.scheduledDate, s.startTime), title: s.name, status: s.status }));

  return [...gameEvents, ...trainingEvents]
    .filter((e) => e.date && e.date.getTime() >= now.getTime())
    .sort((a, b) => a.date - b.date)
    .slice(0, limit);
}

// Vereinheitlicht die beiden möglichen "nächstes Spiel"-Formen (eigenes,
// lokal angelegtes games-Objekt vs. das von saisonmanagerClient.js gemappte
// externe Format) auf eine gemeinsame Anzeige-Form, damit NextMatchCard/
// VenueMapCard nicht zweimal wissen müssen, wie ein Spiel aussieht.
export function normalizeNextMatch(match) {
  if (!match) return null;
  const isLocal = match.source !== 'saisonmanager';
  return {
    id: isLocal ? match._id : null,
    source: isLocal ? 'local' : 'saisonmanager',
    date: isLocal ? match.playedAt : match.date,
    time: isLocal ? match.kickoffTime : match.time,
    opponent: match.opponent,
    isHome: match.isHome ?? null,
    venueName: match.venueName ?? null,
    venueAddress: match.venueAddress ?? null,
    venueLat: isLocal ? (match.venueLat ?? null) : null,
    venueLng: isLocal ? (match.venueLng ?? null) : null,
    status: match.status ?? 'scheduled',
    result: match.result ?? null,
  };
}

// Saisonüberblick ausschließlich aus eigenen, real gespielten Spielen
// (game_events-basiert, server-seitig über ownGoals/opponentGoals/result
// berechnet) – bewusst KEIN Tabellenplatz/Punkte ohne Liga-Datenbasis,
// siehe Plan/ADR "keine erfundene Tabelle" (Präzedenzfall xG in
// DECISIONS.md). Echte Tabellenplätze kommen ausschließlich über die
// optionale Saisonmanager-Anbindung (useDashboardData.js).
export function selectSeasonRecord(games) {
  const played = games.filter((g) => g.result);
  const won = played.filter((g) => g.result === 'win').length;
  const draw = played.filter((g) => g.result === 'draw').length;
  const lost = played.filter((g) => g.result === 'loss').length;
  const goalsFor = played.reduce((sum, g) => sum + (g.ownGoals ?? 0), 0);
  const goalsAgainst = played.reduce((sum, g) => sum + (g.opponentGoals ?? 0), 0);

  if (played.length === 0) return null;

  return {
    games: played.length, won, draw, lost,
    goalsFor, goalsAgainst, goalDiff: goalsFor - goalsAgainst,
  };
}
