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

// SHOT_ZONES/deriveZone – floorball-eigene Zonen-Taxonomie (Statistik-
// Architektur Phase 3, Abschnitt 8.5/9 des Architektur-Dokuments): bewusst
// NICHT aus dem Eishockey übernommen (kein "Slot"/"Point"/"blaue Linie"),
// sondern eine einfache, dokumentierte Schema-Näherung. x∈[0,1] = Nähe
// zum beschossenen Tor (1 = am Tor), y∈[0,1] = quer zur Torbreite
// (0=links, 1=rechts aus Schützensicht). Die Schwellwerte 0.72/0.40
// orientieren sich grob am IFF-Torraum (5 m Tiefe) relativ zu einem
// Diagramm, das ungefähr das letzte Angriffsdrittel abbildet – eine
// Schema-Näherung, keine exakte Feldvermessung.
//
// Bewusste kleine Duplikation: dieselbe Logik liegt zusätzlich in
// frontend/src/constants/shotZones.js (kein Shared-Package zwischen
// Backend/Frontend vorhanden – gleiche Toleranz wie z.B. toDateString,
// das mehrfach pro Controller dupliziert ist). Bei Änderung der
// Schwellwerte beide Dateien synchron halten.
export const SHOT_ZONES = [
  { key: 'nahzone_zentrum', labelDe: 'Nahzone Zentrum', labelEn: 'Close range – central' },
  { key: 'nahzone_links',   labelDe: 'Nahzone Links',    labelEn: 'Close range – left' },
  { key: 'nahzone_rechts',  labelDe: 'Nahzone Rechts',   labelEn: 'Close range – right' },
  { key: 'halbdistanz',     labelDe: 'Halbdistanz',      labelEn: 'Mid range' },
  { key: 'distanz',         labelDe: 'Distanz',          labelEn: 'Long range' },
];

const ZONE_CLOSE_X = 0.72;
const ZONE_MID_X = 0.40;
const ZONE_Y_LEFT = 0.35;
const ZONE_Y_RIGHT = 0.65;

export function deriveZone(x, y) {
  if (x == null || y == null) return null;
  const cx = Math.min(1, Math.max(0, x));
  const cy = Math.min(1, Math.max(0, y));
  if (cx >= ZONE_CLOSE_X) {
    if (cy < ZONE_Y_LEFT) return 'nahzone_links';
    if (cy > ZONE_Y_RIGHT) return 'nahzone_rechts';
    return 'nahzone_zentrum';
  }
  return cx >= ZONE_MID_X ? 'halbdistanz' : 'distanz';
}

// calculateShotStats – aus `shot`-Ereignissen (event_type='shot',
// eventRows = ALLE game_events-Zeilen eines Spiels, wie bei
// calculateMatchScore/calculateLineStats). Shot-% = goals / shotsOnGoal
// (goal+save-Outcomes), NICHT durch alle Schüsse – Standard-Konvention:
// "Shots on Goal" umfasst nur Würfe, die ohne Torhüter-Eingreifen ein Tor
// gewesen wären; miss/block hätten nie eine echte Torchance dargestellt
// und würden die Kennzahl sonst mit reiner Zielgenauigkeit vermengen.
// "unbekannt ≠ 0": ohne Schüsse aufs Tor bleibt shotPercentage null.
export function calculateShotStats(eventRows) {
  const shots = eventRows.filter((e) => e.event_type === 'shot');
  const goals = shots.filter((s) => s.outcome === 'goal').length;
  const saves = shots.filter((s) => s.outcome === 'save').length;
  const misses = shots.filter((s) => s.outcome === 'miss').length;
  const blocks = shots.filter((s) => s.outcome === 'block').length;
  const shotsOnGoal = goals + saves;

  const zoneMap = new Map();
  for (const s of shots) {
    const zone = s.zone ?? deriveZone(s.x, s.y);
    const key = zone ?? 'unbekannt';
    if (!zoneMap.has(key)) zoneMap.set(key, { zone, shots: 0, goals: 0 });
    const bucket = zoneMap.get(key);
    bucket.shots += 1;
    if (s.outcome === 'goal') bucket.goals += 1;
  }
  const byZone = Array.from(zoneMap.values()).map((b) => ({
    ...b,
    shotPercentage: b.shots > 0 ? Math.round((b.goals / b.shots) * 1000) / 10 : null,
  }));

  return {
    shots: shots.length,
    shotsOnGoal,
    goals,
    saves,
    misses,
    blocks,
    shotPercentage: shotsOnGoal > 0 ? Math.round((goals / shotsOnGoal) * 1000) / 10 : null,
    byZone,
  };
}

// calculateGoalkeeperStats – Gegner-Schüsse (event_type='shot' AND
// is_opponent=true), gruppiert nach secondary_roster_player_id (NICHT
// roster_player_id – addEvent verbietet rosterPlayerId+isOpponent
// gleichzeitig, siehe ADR-0003 in DECISIONS.md). Ein Schuss ohne
// zugeordneten Torhüter fließt in calculateShotStats/den Live-
// Spielstand ein, aber in KEINE Einzel-Torhüter-Zeile hier – analog
// getRosterStats' WHERE roster_player_id IS NOT NULL.
export function calculateGoalkeeperStats(eventRows) {
  const opponentShots = eventRows.filter(
    (e) => e.event_type === 'shot' && e.is_opponent && e.secondary_roster_player_id
  );
  const groups = new Map();
  for (const s of opponentShots) {
    const id = s.secondary_roster_player_id;
    if (!groups.has(id)) {
      groups.set(id, { rosterPlayerId: id, shotsAgainst: 0, shotsOnGoalAgainst: 0, saves: 0, goalsAgainst: 0 });
    }
    const g = groups.get(id);
    g.shotsAgainst += 1;
    if (s.outcome === 'save') { g.shotsOnGoalAgainst += 1; g.saves += 1; }
    if (s.outcome === 'goal') { g.shotsOnGoalAgainst += 1; g.goalsAgainst += 1; }
  }
  return Array.from(groups.values()).map((g) => ({
    ...g,
    savePercentage: g.shotsOnGoalAgainst > 0 ? Math.round((g.saves / g.shotsOnGoalAgainst) * 1000) / 10 : null,
  }));
}

// PENALTY_DURATIONS_SECONDS – einzige Quelle für die Strafdauer, statt in
// SQL (gameEventsController.computeStrengthState) und hier getrennt
// hartcodiert. match_penalty bewusst NICHT enthalten – siehe ADR-0004
// in DECISIONS.md: keine feste Dauer/Bank-Minor-Regel modellierbar, ohne
// Präzision vorzutäuschen, die die Datenlage nicht hergibt.
export const PENALTY_DURATIONS_SECONDS = { penalty_2: 120, penalty_5: 300 };

function penaltyWindow(event, periodEndSeconds) {
  const start = event.clock_seconds_at_event;
  const end = Math.min(start + PENALTY_DURATIONS_SECONDS[event.event_type], periodEndSeconds);
  return { period: event.period, start, end, isOpponent: event.is_opponent };
}

// calculateSpecialTeamsStats – Powerplay/Penalty-Kill, direkt aus rohen
// penalty_2/penalty_5-Zeilen neu berechnet (NICHT aus der gespeicherten
// strength_state-Spalte) – wichtig für Rückwärtskompatibilität mit vor
// Phase 4 erfassten Spielen (dort ist strength_state NULL) und
// konsistent mit dem etablierten Fallback-Muster (calculateShotStats'
// `zone ?? deriveZone(...)`).
//
// Bewusste Vereinfachungen (ADR-0004, siehe auch docs/statistics.md):
// - Strafenfenster werden am Periodenende gekappt, nicht über Perioden
//   hinweg fortgesetzt.
// - match_penalty erzeugt kein Fenster (keine verlässliche Dauer/Regel
//   modellierbar).
// - Gelegenheiten werden PRO STRAFE gezählt, nicht durch Verschmelzen
//   überlappender/angrenzender Strafintervalle – eine Gegner-Strafe
//   zählt als unsere PP-Gelegenheit, außer wir hatten in genau diesem
//   Moment bereits selbst eine aktive Strafe (dann bleibt der Zustand
//   "even", keine echte Gelegenheit). Spiegelbildlich für PK.
// "unbekannt ≠ 0": percentage bleibt null bei 0 Gelegenheiten.
export function calculateSpecialTeamsStats(eventRows, { periodMinutes = 20 } = {}) {
  const periodEndSeconds = periodMinutes * 60;
  const penaltyEvents = eventRows.filter((e) =>
    (e.event_type === 'penalty_2' || e.event_type === 'penalty_5')
    && e.period != null && e.clock_seconds_at_event != null);
  const windows = penaltyEvents.map((e) => penaltyWindow(e, periodEndSeconds));

  const goalEvents = eventRows.filter((e) =>
    e.event_type === 'goal' && e.period != null && e.clock_seconds_at_event != null);

  // Halb-offenes Fenster [start, end) – gleiche Konvention wie
  // calculateLineStats. excludeIndex blendet die eigene Strafe aus, wenn
  // geprüft wird, ob VOR ihr bereits eine andere Strafe aktiv war (per
  // Index, nicht Werte-Gleichheit – vermeidet Fehlzuordnung bei zwei
  // Strafen mit exakt demselben Zeitpunkt).
  const activeCountsAt = (period, atSeconds, excludeIndex = -1) => {
    let own = 0;
    let opponent = 0;
    windows.forEach((w, idx) => {
      if (idx === excludeIndex) return;
      if (w.period === period && w.start <= atSeconds && atSeconds < w.end) {
        if (w.isOpponent) opponent += 1; else own += 1;
      }
    });
    return { own, opponent };
  };

  let ppOpportunities = 0;
  let pkOpportunities = 0;
  penaltyEvents.forEach((pen, idx) => {
    const { own, opponent } = activeCountsAt(pen.period, pen.clock_seconds_at_event, idx);
    if (pen.is_opponent && own === 0) ppOpportunities += 1;
    if (!pen.is_opponent && opponent === 0) pkOpportunities += 1;
  });

  let ppGoals = 0;
  let pkGoalsAgainst = 0;
  for (const goal of goalEvents) {
    const { own, opponent } = activeCountsAt(goal.period, goal.clock_seconds_at_event);
    if (!goal.is_opponent && own < opponent) ppGoals += 1;
    if (goal.is_opponent && own > opponent) pkGoalsAgainst += 1;
  }

  return {
    powerPlay: {
      opportunities: ppOpportunities,
      goals: ppGoals,
      percentage: ppOpportunities > 0 ? Math.round((ppGoals / ppOpportunities) * 1000) / 10 : null,
    },
    penaltyKill: {
      opportunities: pkOpportunities,
      goalsAgainst: pkGoalsAgainst,
      percentage: pkOpportunities > 0 ? Math.round(((pkOpportunities - pkGoalsAgainst) / pkOpportunities) * 1000) / 10 : null,
    },
  };
}

// calculateSituationalStats – Aufschlüsselung nach Periode und nach
// Spielstand (Führung/Rückstand/Unentschieden). Chronologische
// Sortierung nach created_at (nicht period+clock_seconds_at_event, die
// bei nie gestarteter Uhr null sind). Jedes Ereignis wird nach dem
// Spielstand VOR ihm klassifiziert, Tor-Tallies werden erst danach
// aktualisiert.
//
// ownGoals/opponentGoals zählen ALLE goal-Events (auch vom klassischen
// "Tor"-Preset ohne shot-Unterbau) – nur shots/shotsOnGoal/shotGoals
// kommen ausschließlich aus shot-Events. Ein rein shot-basierter
// Goal-Count würde Tore ohne Schuss-Tracking-Nutzung stillschweigend
// unterzählen.
export function calculateSituationalStats(eventRows) {
  const sorted = [...eventRows].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const newBucket = () => ({ ownGoals: 0, opponentGoals: 0, shots: 0, shotsOnGoal: 0, shotGoals: 0 });
  const finalize = (b) => ({
    ...b,
    shotPercentage: b.shotsOnGoal > 0 ? Math.round((b.shotGoals / b.shotsOnGoal) * 1000) / 10 : null,
  });

  const byScoreStateMap = { leading: newBucket(), trailing: newBucket(), tied: newBucket() };
  const byPeriodMap = new Map();
  const periodBucket = (period) => {
    const key = period ?? '__unbekannt__';
    if (!byPeriodMap.has(key)) byPeriodMap.set(key, { period, ...newBucket() });
    return byPeriodMap.get(key);
  };

  let ownGoals = 0;
  let opponentGoals = 0;
  for (const evt of sorted) {
    const scoreState = ownGoals === opponentGoals ? 'tied' : ownGoals > opponentGoals ? 'leading' : 'trailing';
    const stateBucket = byScoreStateMap[scoreState];
    const pBucket = periodBucket(evt.period);

    if (evt.event_type === 'goal') {
      const key = evt.is_opponent ? 'opponentGoals' : 'ownGoals';
      stateBucket[key] += 1;
      pBucket[key] += 1;
      if (evt.is_opponent) opponentGoals += 1; else ownGoals += 1;
    }
    if (evt.event_type === 'shot') {
      const onGoal = evt.outcome === 'goal' || evt.outcome === 'save';
      const isGoal = evt.outcome === 'goal';
      for (const b of [stateBucket, pBucket]) {
        b.shots += 1;
        if (onGoal) b.shotsOnGoal += 1;
        if (isGoal) b.shotGoals += 1;
      }
    }
  }

  return {
    byScoreState: ['leading', 'trailing', 'tied'].map((s) => ({ scoreState: s, ...finalize(byScoreStateMap[s]) })),
    byPeriod: Array.from(byPeriodMap.values())
      .sort((a, b) => (a.period ?? Infinity) - (b.period ?? Infinity))
      .map(finalize),
  };
}
