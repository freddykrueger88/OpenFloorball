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
    _id:            row.id,
    gameId:         row.game_id,
    eventType:      row.event_type,
    rosterPlayerId: row.roster_player_id,
    isOpponent:     row.is_opponent,
    email:          row.email,
    createdAt:      row.created_at,
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

    const { eventType, rosterPlayerId = null, isOpponent = false } = req.body;
    if (rosterPlayerId && isOpponent) {
      return res.status(400).json(error('Ein Ereignis kann nicht gleichzeitig einem Kader-Spieler und dem Gegner zugeordnet werden'));
    }

    if (rosterPlayerId) {
      const gameResult = await pool.query('SELECT user_id, team_id FROM games WHERE id = $1', [gameId]);
      const game = gameResult.rows[0];
      const rosterResult = await pool.query('SELECT user_id, team_id FROM roster_players WHERE id = $1', [rosterPlayerId]);
      const rosterRow = rosterResult.rows[0];
      if (!rosterRow) {
        return res.status(404).json(error('Kader-Spieler nicht gefunden'));
      }
      // Derselbe Scope-Check wie matchSquadController.setSquadStatus /
      // linesController.addPlayerToLine.
      const sameScope = game.team_id
        ? rosterRow.team_id === game.team_id
        : rosterRow.user_id === req.user.id && !rosterRow.team_id;
      if (!sameScope) {
        return res.status(400).json(error('Kader-Spieler gehört nicht zum Kader dieses Spiels'));
      }
    }

    const insertResult = await pool.query(
      `INSERT INTO game_events (game_id, event_type, roster_player_id, is_opponent, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [gameId, eventType, rosterPlayerId, isOpponent, req.user.id]
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

// DELETE /api/games/:id/events/:eventId
export async function deleteEvent(req, res) {
  try {
    const gameId = req.params.id;
    if (!(await assertGameWrite(gameId, req.user.id))) {
      return res.status(404).json(error('Spiel nicht gefunden'));
    }
    const result = await pool.query(
      'DELETE FROM game_events WHERE id = $1 AND game_id = $2 RETURNING id',
      [req.params.eventId, gameId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json(error('Ereignis nicht gefunden'));
    }
    res.json(success({ message: 'Ereignis gelöscht' }));
  } catch (err) {
    logger.error('[deleteEvent]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}
