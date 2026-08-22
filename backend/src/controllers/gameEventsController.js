/**
 * gameEventsController – Live-Match-Ereignisse (Roadmap-Audit, Start
 * Phase C "Match-Erlebnis"). Strukturierte Speicherung der 10 festen
 * IFF-Presets aus GamePage.jsx (Anstoß Q1-3, Drittelende, Auszeit,
 * Tor, Strafe 2/5 Min., Matchstrafe, Spielende) statt fertig
 * zusammengesetztem Freitext in comments – macht spätere Auswertung
 * (Tore/Spieler, Strafminuten) möglich, ohne Text zu parsen.
 *
 * Freitext-Notizen und die Line-Wechsel-Notiz gehören NICHT zum festen
 * Ereignis-Vokabular und laufen weiterhin über comments/useComments.js
 * (siehe GamePage.jsx) – dieser Controller deckt nur die 10 Presets ab.
 */
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { success, created, error } from '../utils/apiResponse.js';
import { assertGameRead, assertGameWrite } from './gamesController.js';
import {
  calculateShotStats, calculateGoalkeeperStats, deriveZone,
  calculateSpecialTeamsStats, calculateSituationalStats, PENALTY_DURATIONS_SECONDS,
} from '../services/statisticsEngine.js';

function toApiEvent(row) {
  return {
    _id:                     row.id,
    gameId:                  row.game_id,
    eventType:               row.event_type,
    rosterPlayerId:          row.roster_player_id,
    secondaryRosterPlayerId: row.secondary_roster_player_id,
    isOpponent:              row.is_opponent,
    period:                  row.period,
    clockSecondsAtEvent:     row.clock_seconds_at_event,
    outcome:                 row.outcome,
    shotType:                row.shot_type,
    strengthState:           row.strength_state,
    x:                       row.x,
    y:                       row.y,
    zone:                    row.zone,
    videoId:                 row.video_id,
    videoTimestampSeconds:   row.video_timestamp_seconds,
    metadata:                row.metadata,
    email:                   row.email,
    createdAt:               row.created_at,
  };
}

// GET /api/games/:id/events – Lesezugriff reicht, wie bei Kommentaren.
export async function getEvents(req, res) {
  try {
    const gameId = req.params.id;
    if (!(await assertGameRead(gameId, req.user.id))) {
      return res.status(404).json(error('Spiel nicht gefunden'));
    }
    const result = await pool.query(
      `SELECT ge.*, u.email FROM game_events ge
       JOIN users u ON u.id = ge.created_by
       WHERE ge.game_id = $1
       ORDER BY ge.created_at ASC`,
      [gameId]
    );
    res.json(success(result.rows.map(toApiEvent)));
  } catch (err) {
    logger.error('[getEvents]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// computeStrengthState (Phase 4 Special Teams, ADR-0004) – vergleicht,
// wie viele eigene bzw. gegnerische penalty_2/penalty_5-Strafen zum
// Zeitpunkt des neuen Ereignisses (SELBE Periode, halb-offenes Fenster
// [start, end), Fenster am Periodenende gekappt statt über Perioden
// hinweg fortgesetzt) noch aktiv sind. Läuft bewusst mit `pool`, nicht
// `client`, VOR BEGIN – die Berechnung sieht ausschließlich bereits
// committete Ereignisse früherer Requests, keine transaktionale
// Konsistenz mit dem gerade entstehenden Insert nötig.
async function computeStrengthState(gameId, period, clockSecondsAtEvent, periodEndSeconds) {
  if (period === null || clockSecondsAtEvent === null) return null; // unbekannt ≠ 0
  const result = await pool.query(
    `SELECT is_opponent,
            LEAST(
              clock_seconds_at_event + CASE event_type
                WHEN 'penalty_2' THEN $4::int
                WHEN 'penalty_5' THEN $5::int
              END,
              $6::int
            ) AS window_end
     FROM game_events
     WHERE game_id = $1 AND period = $2
       AND event_type IN ('penalty_2', 'penalty_5')
       AND clock_seconds_at_event <= $3`,
    [gameId, period, clockSecondsAtEvent,
     PENALTY_DURATIONS_SECONDS.penalty_2, PENALTY_DURATIONS_SECONDS.penalty_5, periodEndSeconds]
  );
  let own = 0;
  let opponent = 0;
  for (const row of result.rows) {
    if (row.window_end > clockSecondsAtEvent) {
      if (row.is_opponent) opponent += 1; else own += 1;
    }
  }
  if (own < opponent) return 'powerplay';
  if (own > opponent) return 'shorthanded';
  return 'even';
}

// POST /api/games/:id/events – Coach-Entscheidung wie beim Anlegen
// einer Notiz, daher assertGameWrite. Transaktional (seit Phase 3
// Schuss-Tracking): ein `shot`-Ereignis mit outcome='goal' legt
// zusätzlich ein schlankes Companion-`goal`-Ereignis an, damit
// bestehende Konsumenten (calculateMatchScore, getRosterStats,
// PDF-Export, Live-Scoreboard) unverändert bleiben – siehe ADR-0002 in
// docs/planning/DECISIONS.md.
export async function addEvent(req, res) {
  const client = await pool.connect();
  try {
    const gameId = req.params.id;
    if (!(await assertGameWrite(gameId, req.user.id))) {
      client.release();
      return res.status(404).json(error('Spiel nicht gefunden'));
    }

    // strengthState wird NICHT mehr vom Client entgegengenommen (Phase 4,
    // ADR-0004) – wie period/clockSecondsAtEvent ist es rein serverseitig
    // berechnet (siehe computeStrengthState unten), ein evtl. mitgeschickter
    // Client-Wert wird stillschweigend ignoriert.
    const {
      eventType, rosterPlayerId = null, isOpponent = false,
      secondaryRosterPlayerId = null, outcome = null, shotType = null,
      x = null, y = null, zone = null,
      videoId = null, videoTimestampSeconds = null, metadata = {},
    } = req.body;

    if (rosterPlayerId && isOpponent) {
      client.release();
      return res.status(400).json(error('Ein Ereignis kann nicht gleichzeitig einem Kader-Spieler und dem Gegner zugeordnet werden'));
    }

    const gameResult = await pool.query(
      'SELECT user_id, team_id, clock_period, clock_elapsed_seconds, clock_status, clock_started_at, clock_period_minutes FROM games WHERE id = $1',
      [gameId]
    );
    const game = gameResult.rows[0];

    // eventType wird gegen event_type_definitions geprüft statt gegen ein
    // festes Array (ADR-0001) – neue Typen brauchen dadurch nur einen
    // INSERT dort, keine Code-Änderung hier. Seit Phase 7 (Custom Events)
    // zusätzlich ein Scope-Check: ein team-eigener oder persönlicher
    // Custom-Typ darf nur auf einem Spiel DESSELBEN Teams bzw. desselben
    // persönlichen Nutzers verwendet werden – sonst könnte ein Ereignis
    // mit einem für ein fremdes Team sinnvollen Label in einem völlig
    // anderen Spiel landen (kein Zugriffsverstoß, aber irreführende Daten).
    // Eingebaute Typen (is_builtin) sind immer erlaubt.
    const typeResult = await pool.query(
      'SELECT is_builtin, team_id, user_id FROM event_type_definitions WHERE key = $1 AND active = true',
      [eventType]
    );
    const typeRow = typeResult.rows[0];
    const typeInScope = typeRow && (
      typeRow.is_builtin
      || (typeRow.team_id && typeRow.team_id === game.team_id)
      || (typeRow.user_id && !game.team_id && typeRow.user_id === req.user.id)
    );
    if (!typeInScope) {
      client.release();
      return res.status(400).json(error('Ungültiger, inaktiver oder nicht zu diesem Spiel gehörender Ereignistyp'));
    }

    // Derselbe Scope-Check wie matchSquadController.setSquadStatus /
    // linesController.addPlayerToLine, jetzt auch für den optionalen
    // Zweitspieler (Assist bei is_opponent=false, unser Torhüter bei
    // is_opponent=true – siehe ADR-0003). Unterscheidet weiterhin
    // "existiert gar nicht" (404) von "existiert, aber falsche
    // Sichtbarkeits-Gruppe" (400).
    const checkRosterScope = async (playerId) => {
      const rosterResult = await pool.query('SELECT user_id, team_id FROM roster_players WHERE id = $1', [playerId]);
      const rosterRow = rosterResult.rows[0];
      if (!rosterRow) return 'not_found';
      const sameScope = game.team_id
        ? rosterRow.team_id === game.team_id
        : rosterRow.user_id === req.user.id && !rosterRow.team_id;
      return sameScope ? 'ok' : 'wrong_scope';
    };

    if (rosterPlayerId) {
      const scope = await checkRosterScope(rosterPlayerId);
      if (scope === 'not_found') { client.release(); return res.status(404).json(error('Kader-Spieler nicht gefunden')); }
      if (scope === 'wrong_scope') { client.release(); return res.status(400).json(error('Kader-Spieler gehört nicht zum Kader dieses Spiels')); }
    }
    if (secondaryRosterPlayerId) {
      const scope = await checkRosterScope(secondaryRosterPlayerId);
      if (scope === 'not_found') { client.release(); return res.status(404).json(error('Kader-Spieler nicht gefunden')); }
      if (scope === 'wrong_scope') { client.release(); return res.status(400).json(error('Kader-Spieler gehört nicht zum Kader dieses Spiels')); }
    }

    // videoId muss zu DIESEM Spiel gehören (Phase 6) – dieselbe
    // "existiert gar nicht 404 vs. falscher Scope 400"-Unterscheidung wie
    // bei den Kader-Spieler-Checks oben.
    if (videoId) {
      const videoResult = await pool.query('SELECT game_id FROM game_videos WHERE id = $1', [videoId]);
      if (videoResult.rows.length === 0) { client.release(); return res.status(404).json(error('Video nicht gefunden')); }
      if (videoResult.rows[0].game_id !== gameId) { client.release(); return res.status(400).json(error('Video gehört nicht zu diesem Spiel')); }
    }

    // period/clockSecondsAtEvent automatisch aus der Spieluhr befüllen –
    // "unbekannt ≠ 0" (Datenqualitätsprinzip): solange die Uhr nie
    // gestartet wurde (clock_period=0), bleibt beides NULL statt 0, damit
    // "0 Sekunden ins Spiel" nicht mit "Uhr nie gestartet" verwechselt wird.
    const period = game.clock_period || null;
    let clockSecondsAtEvent = null;
    if (period !== null) {
      clockSecondsAtEvent = game.clock_elapsed_seconds ?? 0;
      if (game.clock_status === 'running' && game.clock_started_at) {
        clockSecondsAtEvent += Math.floor((Date.now() - new Date(game.clock_started_at).getTime()) / 1000);
      }
    }

    // strengthState automatisch aus aktiven Strafen berechnen (Phase 4,
    // siehe computeStrengthState oben).
    const periodEndSeconds = (game.clock_period_minutes || 20) * 60;
    const strengthState = await computeStrengthState(gameId, period, clockSecondsAtEvent, periodEndSeconds);

    // Zone-Fallback (Phase 3): wenn der Client x/y, aber keine zone
    // mitschickt, serverseitig aus deriveZone ableiten. Eine vom Client
    // explizit gesetzte zone hat Vorrang, wird nicht überschrieben.
    const effectiveZone = zone ?? (x != null && y != null ? deriveZone(x, y) : null);

    await client.query('BEGIN');

    // Companion-Goal-Event (Phase 3, ADR-0002): NUR bei event_type='shot'
    // mit outcome='goal'. Bewusst schlank (kein x/y/zone/shotType), damit
    // eine spätere naive Zonen-Auswertung über ALLE event_type='goal'
    // nicht doppelt zählt – der `shot`-Datensatz bleibt der einzige
    // detaillierte Datenpunkt. strengthState wird seit Phase 4 zusätzlich
    // kopiert (derselbe reale Moment, für Special-Teams-Torzuordnung).
    // secondaryRosterPlayerId wird NUR bei eigenem Tor (!isOpponent)
    // mitkopiert (Assist, Phasenplanungs-Review 2026-08-21/ADR-0003) – bei
    // einem Gegner-Tor trägt secondaryRosterPlayerId auf dem shot-Event
    // stattdessen "unser Torhüter" und hat auf dem Companion-Goal-Event
    // keine sinnvolle Bedeutung. `getRosterStats`/`getRosterPlayerGameLog`
    // zählen Assists bewusst aus event_type='goal' (nicht 'shot'), damit
    // dieselbe einfache Query wie für Tore reicht.
    let companionGoalId = null;
    if (eventType === 'shot' && outcome === 'goal') {
      const companionResult = await client.query(
        `INSERT INTO game_events (game_id, event_type, roster_player_id, is_opponent, secondary_roster_player_id, period, clock_seconds_at_event, strength_state, created_by)
         VALUES ($1, 'goal', $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [gameId, rosterPlayerId, isOpponent, isOpponent ? null : secondaryRosterPlayerId, period, clockSecondsAtEvent, strengthState, req.user.id]
      );
      companionGoalId = companionResult.rows[0].id;
    }
    const effectiveMetadata = companionGoalId ? { ...metadata, companionGoalEventId: companionGoalId } : metadata;

    const insertResult = await client.query(
      `INSERT INTO game_events (
         game_id, event_type, roster_player_id, is_opponent,
         secondary_roster_player_id, period, clock_seconds_at_event,
         outcome, shot_type, strength_state, x, y, zone,
         video_id, video_timestamp_seconds, metadata, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
      [
        gameId, eventType, rosterPlayerId, isOpponent,
        secondaryRosterPlayerId, period, clockSecondsAtEvent,
        outcome, shotType, strengthState, x, y, effectiveZone,
        videoId, videoTimestampSeconds, JSON.stringify(effectiveMetadata), req.user.id,
      ]
    );
    await client.query('COMMIT');

    const eventResult = await pool.query(
      `SELECT ge.*, u.email FROM game_events ge JOIN users u ON u.id = ge.created_by WHERE ge.id = $1`,
      [insertResult.rows[0].id]
    );
    res.status(201).json(created(toApiEvent(eventResult.rows[0])));
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('[addEvent]', err);
    res.status(500).json(error('Interner Serverfehler'));
  } finally {
    client.release();
  }
}

// PUT /api/games/:id/events/:eventId/video-link – Phase 6, bewusst der
// EINZIGE nachträgliche Änderungspfad an einem bestehenden Ereignis
// (weiterhin "kein Edit-Endpunkt" für eventType/Zuordnung/Ergebnis, siehe
// Datei-Kommentar oben und deleteEvent unten). Grund für die Ausnahme:
// die Architektur-Doku fordert explizit, dass ein Video-Zeitstempel auch
// NACHTRÄGLICH (aus bereits erfassten Ereignissen heraus, beim
// Video-Review nach dem Spiel) gesetzt werden können muss – "bei
// Tippfehler löschen und neu erfassen" würde hier bedeuten, ein
// korrektes Tor-Ereignis zu löschen, nur um einen Video-Link zu ändern.
// videoId=null setzt den Link explizit zurück (z.B. wenn das Video
// gelöscht wurde) – 'videoId' in req.body statt !== undefined, analog
// gameVideosController.updateVideo.
export async function linkEventVideo(req, res) {
  try {
    const gameId = req.params.id;
    if (!(await assertGameWrite(gameId, req.user.id))) {
      return res.status(404).json(error('Spiel nicht gefunden'));
    }

    const { videoId = null, videoTimestampSeconds = null } = req.body;

    if (videoId) {
      const videoResult = await pool.query('SELECT game_id FROM game_videos WHERE id = $1', [videoId]);
      if (videoResult.rows.length === 0) return res.status(404).json(error('Video nicht gefunden'));
      if (videoResult.rows[0].game_id !== gameId) return res.status(400).json(error('Video gehört nicht zu diesem Spiel'));
    }

    const result = await pool.query(
      `UPDATE game_events SET video_id = $1, video_timestamp_seconds = $2
       WHERE id = $3 AND game_id = $4 RETURNING *`,
      [videoId, videoTimestampSeconds, req.params.eventId, gameId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json(error('Ereignis nicht gefunden'));
    }

    const eventResult = await pool.query(
      `SELECT ge.*, u.email FROM game_events ge JOIN users u ON u.id = ge.created_by WHERE ge.id = $1`,
      [result.rows[0].id]
    );
    res.json(success(toApiEvent(eventResult.rows[0])));
  } catch (err) {
    logger.error('[linkEventVideo]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// DELETE /api/games/:id/events/:eventId – kein Edit-Endpunkt (bewusst,
// siehe Datei-Kommentar oben): Löschung wird stattdessen protokolliert
// (game_event_deletions, Anforderung §19.5/71 Auditierbarkeit).
// Transaktional (seit Phase 3): löscht ein verknüpftes Companion-
// Goal-Event (metadata.companionGoalEventId) mit, sonst bliebe ein
// verwaister Score-Zähler zurück – beide Löschungen werden geloggt.
export async function deleteEvent(req, res) {
  const client = await pool.connect();
  try {
    const gameId = req.params.id;
    if (!(await assertGameWrite(gameId, req.user.id))) {
      client.release();
      return res.status(404).json(error('Spiel nicht gefunden'));
    }

    await client.query('BEGIN');
    const result = await client.query(
      'DELETE FROM game_events WHERE id = $1 AND game_id = $2 RETURNING *',
      [req.params.eventId, gameId]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json(error('Ereignis nicht gefunden'));
    }
    const deleted = result.rows[0];
    const toLog = [deleted];

    const companionId = deleted.metadata?.companionGoalEventId;
    if (companionId) {
      const companionResult = await client.query(
        'DELETE FROM game_events WHERE id = $1 AND game_id = $2 RETURNING *',
        [companionId, gameId]
      );
      if (companionResult.rows.length > 0) toLog.push(companionResult.rows[0]);
    }

    for (const entry of toLog) {
      await client.query(
        `INSERT INTO game_event_deletions (game_id, event_type, roster_player_id, is_opponent, original_created_at, deleted_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [gameId, entry.event_type, entry.roster_player_id, entry.is_opponent, entry.created_at, req.user.id]
      );
    }

    await client.query('COMMIT');
    res.json(success({ message: 'Ereignis gelöscht' }));
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('[deleteEvent]', err);
    res.status(500).json(error('Interner Serverfehler'));
  } finally {
    client.release();
  }
}

// GET /api/games/:id/events/shot-stats – Lesezugriff reicht.
export async function getShotStats(req, res) {
  try {
    const gameId = req.params.id;
    if (!(await assertGameRead(gameId, req.user.id))) {
      return res.status(404).json(error('Spiel nicht gefunden'));
    }
    const result = await pool.query('SELECT * FROM game_events WHERE game_id = $1', [gameId]);
    res.json(success(calculateShotStats(result.rows)));
  } catch (err) {
    logger.error('[getShotStats]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// GET /api/games/:id/events/goalkeeper-stats – Lesezugriff reicht.
export async function getGoalkeeperStats(req, res) {
  try {
    const gameId = req.params.id;
    if (!(await assertGameRead(gameId, req.user.id))) {
      return res.status(404).json(error('Spiel nicht gefunden'));
    }
    const result = await pool.query('SELECT * FROM game_events WHERE game_id = $1', [gameId]);
    res.json(success(calculateGoalkeeperStats(result.rows)));
  } catch (err) {
    logger.error('[getGoalkeeperStats]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// GET /api/games/:id/events/special-teams-stats – Lesezugriff reicht.
export async function getSpecialTeamsStats(req, res) {
  try {
    const gameId = req.params.id;
    if (!(await assertGameRead(gameId, req.user.id))) {
      return res.status(404).json(error('Spiel nicht gefunden'));
    }
    const gameResult = await pool.query('SELECT clock_period_minutes FROM games WHERE id = $1', [gameId]);
    const periodMinutes = gameResult.rows[0]?.clock_period_minutes ?? 20;
    const result = await pool.query('SELECT * FROM game_events WHERE game_id = $1', [gameId]);
    res.json(success(calculateSpecialTeamsStats(result.rows, { periodMinutes })));
  } catch (err) {
    logger.error('[getSpecialTeamsStats]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// GET /api/games/:id/events/situational-stats – Lesezugriff reicht.
export async function getSituationalStats(req, res) {
  try {
    const gameId = req.params.id;
    if (!(await assertGameRead(gameId, req.user.id))) {
      return res.status(404).json(error('Spiel nicht gefunden'));
    }
    const result = await pool.query('SELECT * FROM game_events WHERE game_id = $1', [gameId]);
    res.json(success(calculateSituationalStats(result.rows)));
  } catch (err) {
    logger.error('[getSituationalStats]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}
