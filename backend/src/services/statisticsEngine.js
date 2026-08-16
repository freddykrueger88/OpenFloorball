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

// calculateLineStats – Zeit-auf-dem-Feld + Goals For/Against je Line,
// aus match_lines + game_events (beide snake_case DB-Zeilen). Gruppierung
// über line_id, mit Fallback auf line_name, falls die Vorlage seither
// gelöscht wurde (line_id dann NULL).
//
// `now`: steuert, wie eine noch offene Zeile (ended_at IS NULL)
// behandelt wird.
//   - now = null (Default): die offene Zeile bleibt bei Dauer UND
//     Tor-Fenster komplett UNBERÜCKSICHTIGT ("unbekannt ≠ 0" – sicherer
//     Default für jeden nicht-live Aufrufer, z.B. eine spätere
//     Saison-Aggregation: dort eine geschätzte NOW()-Dauer in einem
//     gespeicherten/gecachten Wert einzufrieren wäre irreführend).
//   - now = ein Date-Objekt: NUR für die Live-Ansicht eines gerade
//     laufenden Spiels legitim – die offene Zeile zählt bis `now`, bleibt
//     im Ergebnis aber über `hasOpenShift: true` als vorläufig markiert.
//
// Zeitfenster-Grenzen: HALB-OFFEN [started_at, ended_at) – ein Tor genau
// auf der Wechsel-Sekunde gehört zur NEU geöffneten Line, nicht zur
// soeben geschlossenen (innerhalb derselben DB-Transaktion liefert
// Postgres' NOW() für UPDATE ended_at und INSERT started_at exakt
// denselben Zeitstempel, siehe matchLinesController.activateMatchLine –
// ohne diese Konvention würde ein Tor auf dieser Sekunde doppelt gezählt
// oder verloren gehen).
export function calculateLineStats(matchLineRows, eventRows, { now = null } = {}) {
  const groupKey = (row) => row.line_id ?? `__name__:${row.line_name}`;

  const groups = new Map();
  for (const row of matchLineRows) {
    const key = groupKey(row);
    if (!groups.has(key)) {
      groups.set(key, { lineId: row.line_id, lineName: row.line_name, rows: [], goalsFor: 0, goalsAgainst: 0 });
    }
    groups.get(key).rows.push(row);
  }

  const goalEvents = eventRows.filter((e) => e.event_type === 'goal');
  for (const row of matchLineRows) {
    const effectiveEnd = row.ended_at ?? now;
    if (effectiveEnd === null) continue; // offenes Fenster ohne `now` – unbekannt, keine Tor-Zuordnung möglich
    const start = new Date(row.started_at);
    const end = new Date(effectiveEnd);
    const group = groups.get(groupKey(row));
    for (const evt of goalEvents) {
      const at = new Date(evt.created_at);
      if (at >= start && at < end) {
        if (evt.is_opponent) group.goalsAgainst += 1;
        else group.goalsFor += 1;
      }
    }
  }

  return Array.from(groups.values()).map((group) => {
    let totalSeconds = 0;
    let hasKnownContribution = false;
    let hasOpenShift = false;
    for (const row of group.rows) {
      if (row.ended_at !== null) {
        totalSeconds += (new Date(row.ended_at) - new Date(row.started_at)) / 1000;
        hasKnownContribution = true;
      } else {
        hasOpenShift = true;
        if (now !== null) {
          totalSeconds += Math.max(0, (now - new Date(row.started_at)) / 1000);
          hasKnownContribution = true;
        }
      }
    }
    return {
      lineId: group.lineId,
      lineName: group.lineName,
      totalSeconds: hasKnownContribution ? Math.round(totalSeconds) : null,
      hasOpenShift,
      goalsFor: group.goalsFor,
      goalsAgainst: group.goalsAgainst,
    };
  });
}
