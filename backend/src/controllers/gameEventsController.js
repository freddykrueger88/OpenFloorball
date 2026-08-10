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

// POST /api/games/:id/events – Coach-Entscheidung wie beim Anlegen
// einer Notiz, daher assertGameWrite.
export async function addEvent(req, res) {
  try {
    const gameId = req.params.id;
    if (!(await assertGameWrite(gameId, req.user.id))) {
      return res.status(404).json(error('Spiel nicht gefunden'));
    }

    const {
      eventType, rosterPlayerId = null, isOpponent = false,
      secondaryRosterPlayerId = null, outcome = null, shotType = null,
      strengthState = null, x = null, y = null, zone = null,
      videoTimestampSeconds = null, metadata = {},
    } = req.body;

    if (rosterPlayerId && isOpponent) {
      return res.status(400).json(error('Ein Ereignis kann nicht gleichzeitig einem Kader-Spieler und dem Gegner zugeordnet werden'));
    }

    // eventType wird gegen event_type_definitions geprüft statt gegen ein
    // festes Array (ADR-0001) – neue Typen brauchen dadurch nur einen
    // INSERT dort, keine Code-Änderung hier.
    const typeResult = await pool.query(
      'SELECT 1 FROM event_type_definitions WHERE key = $1 AND active = true',
      [eventType]
    );
    if (typeResult.rows.length === 0) {
      return res.status(400).json(error('Ungültiger oder inaktiver Ereignistyp'));
    }

    const gameResult = await pool.query(
      'SELECT user_id, team_id, clock_period, clock_elapsed_seconds, clock_status, clock_started_at FROM games WHERE id = $1',
      [gameId]
    );
    const game = gameResult.rows[0];

    // Derselbe Scope-Check wie matchSquadController.setSquadStatus /
    // linesController.addPlayerToLine, jetzt auch für den optionalen
    // Zweitspieler (Assist). Unterscheidet weiterhin "existiert gar
    // nicht" (404, wie schon vor Phase 1) von "existiert, aber falsche
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
      if (scope === 'not_found') return res.status(404).json(error('Kader-Spieler nicht gefunden'));
      if (scope === 'wrong_scope') return res.status(400).json(error('Kader-Spieler gehört nicht zum Kader dieses Spiels'));
    }
    if (secondaryRosterPlayerId) {
      const scope = await checkRosterScope(secondaryRosterPlayerId);
      if (scope === 'not_found') return res.status(404).json(error('Kader-Spieler nicht gefunden'));
      if (scope === 'wrong_scope') return res.status(400).json(error('Kader-Spieler gehört nicht zum Kader dieses Spiels'));
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

    const insertResult = await pool.query(
      `INSERT INTO game_events (
         game_id, event_type, roster_player_id, is_opponent,
         secondary_roster_player_id, period, clock_seconds_at_event,
         outcome, shot_type, strength_state, x, y, zone,
         video_timestamp_seconds, metadata, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [
        gameId, eventType, rosterPlayerId, isOpponent,
        secondaryRosterPlayerId, period, clockSecondsAtEvent,
        outcome, shotType, strengthState, x, y, zone,
        videoTimestampSeconds, JSON.stringify(metadata), req.user.id,
      ]
    );
    const eventResult = await pool.query(
      `SELECT ge.*, u.email FROM game_events ge JOIN users u ON u.id = ge.created_by WHERE ge.id = $1`,
      [insertResult.rows[0].id]
    );
    res.status(201).json(created(toApiEvent(eventResult.rows[0])));
  } catch (err) {
    logger.error('[addEvent]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// DELETE /api/games/:id/events/:eventId – kein Edit-Endpunkt (bewusst,
// siehe Datei-Kommentar oben): Löschung wird stattdessen protokolliert
// (game_event_deletions, Anforderung §19.5/71 Auditierbarkeit).
export async function deleteEvent(req, res) {
  try {
    const gameId = req.params.id;
    if (!(await assertGameWrite(gameId, req.user.id))) {
      return res.status(404).json(error('Spiel nicht gefunden'));
    }
    const result = await pool.query(
      'DELETE FROM game_events WHERE id = $1 AND game_id = $2 RETURNING *',
      [req.params.eventId, gameId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json(error('Ereignis nicht gefunden'));
    }
    const deleted = result.rows[0];
    await pool.query(
      `INSERT INTO game_event_deletions (game_id, event_type, roster_player_id, is_opponent, original_created_at, deleted_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [gameId, deleted.event_type, deleted.roster_player_id, deleted.is_opponent, deleted.created_at, req.user.id]
    );
    res.json(success({ message: 'Ereignis gelöscht' }));
  } catch (err) {
    logger.error('[deleteEvent]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}
