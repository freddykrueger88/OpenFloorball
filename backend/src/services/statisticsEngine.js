/**
 * statisticsEngine – zentrale, reine Berechnungslogik für alle
 * Statistiken/Kennzahlen (docs/planning/STATISTICS_ANALYTICS_ARCHITECTURE.md,
 * Abschnitt 10). Keine DB-Zugriffe, kein Express – nimmt bereits
 * geladene Zeilen entgegen, damit die Funktionen isoliert testbar sind
 * und Frontend/PDF-Export/zukünftige Statistikseiten dieselbe Logik
 * verwenden statt sie jeweils selbst nachzubauen (bisher war die
 * Spielstand-Berechnung in GamePage.jsx und pdfExportController.js
 * unabhängig voneinander implementiert).
 *
 * Erwartet rohe DB-Zeilen aus `game_events` (snake_case Spaltennamen),
 * nicht die camelCase API-Form.
 */

// calculateMatchScore – "unser" Team gegen den Gegner, ausschließlich
// aus Tor-Ereignissen abgeleitet (kein gespeicherter Score, siehe
// Architektur-Dokument Abschnitt 8.4 "was bewusst nicht gebaut wird").
export function calculateMatchScore(eventRows) {
  const ownGoals = eventRows.filter((e) => e.event_type === 'goal' && !e.is_opponent).length;
  const opponentGoals = eventRows.filter((e) => e.event_type === 'goal' && e.is_opponent).length;
  return { ownGoals, opponentGoals };
}
