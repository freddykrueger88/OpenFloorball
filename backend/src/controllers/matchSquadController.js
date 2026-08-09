/**
 * matchSquadController – Match-Kader für EIN konkretes Spiel
 * (Roadmap-Audit: die im ursprünglichen Master-Auftrag am stärksten
 * betonte Lücke zwischen Line und Match). Pro Kader-Spieler
 * (roster_players) wird für dieses eine Spiel ein Status gesetzt:
 * spielt/Ersatz/verletzt/fehlt – unabhängig von Lines (taktische
 * Gruppierung, spielübergreifend) und unabhängig von RSVP
 * (Selbstauskunft der Account-Inhaber, siehe rsvpsController.js).
 *
 * Anders als rsvps/comments KEINE polymorphe Tabelle, sondern eine
 * echte Junction wie line_players – direkte FKs auf beide Seiten,
 * dadurch räumt ON DELETE CASCADE automatisch auf (kein
 * deleteXForResource/deleteXForUser wie bei rsvpsController.js nötig).
 */
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { success, error } from '../utils/apiResponse.js';
import { assertGameRead, assertGameWrite } from './gamesController.js';

function toApiSquadEntry(row) {
  return {
    rosterPlayerId: row.roster_player_id,
    name:           row.name,
    jerseyNumber:   row.jersey_number,
    role:           row.role,
    status:         row.status ?? null,
    note:           row.note ?? '',
    updatedAt:      row.updated_at ?? null,
  };
}

// GET /api/games/:id/squad – liefert IMMER den vollen Kader dieses
// Spiels (LEFT JOIN), auch für Kader-Spieler ohne gesetzten Status
// (status: null), exakt wie rsvpsController.getRsvps es für die
// Team-Liste macht. Kader-Scope identisch zum bestehenden
// Frontend-Filtering (GamePage.jsx squadForGame) und zu
// linesController.addPlayerToLine: team-geteiltes Spiel -> Kader
// dieses Teams, persönliches Spiel -> persönlicher Kader des Besitzers.
export async function getSquad(req, res) {
  try {
    const gameId = req.params.id;
    if (!(await assertGameRead(gameId, req.user.id))) {
      return res.status(404).json(error('Spiel nicht gefunden'));
    }

    const gameResult = await pool.query('SELECT user_id, team_id FROM games WHERE id = $1', [gameId]);
    const game = gameResult.rows[0];

    const result = await pool.query(
      `SELECT rp.id AS roster_player_id, rp.name, rp.jersey_number, rp.role, gs.status, gs.note, gs.updated_at
       FROM roster_players rp
       LEFT JOIN game_squad gs ON gs.game_id = $1 AND gs.roster_player_id = rp.id
       WHERE ${game.team_id ? 'rp.team_id = $2' : 'rp.user_id = $2 AND rp.team_id IS NULL'}
       ORDER BY rp.jersey_number ASC NULLS LAST, rp.name ASC`,
      [gameId, game.team_id ?? game.user_id]
    );
    res.json(success(result.rows.map(toApiSquadEntry)));
  } catch (err) {
    logger.error('[getSquad]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// PUT /api/games/:id/squad/:rosterPlayerId – Coach-Entscheidung, daher
// assertGameWrite (bewusst NICHT nur Lesezugriff wie bei RSVP).
export async function setSquadStatus(req, res) {
  try {
    const gameId = req.params.id;
    if (!(await assertGameWrite(gameId, req.user.id))) {
      return res.status(404).json(error('Spiel nicht gefunden'));
    }

    const gameResult = await pool.query('SELECT user_id, team_id FROM games WHERE id = $1', [gameId]);
    const game = gameResult.rows[0];

    const rosterResult = await pool.query(
      'SELECT user_id, team_id FROM roster_players WHERE id = $1',
      [req.params.rosterPlayerId]
    );
    const rosterRow = rosterResult.rows[0];
    if (!rosterRow) {
      return res.status(404).json(error('Kader-Spieler nicht gefunden'));
    }
    // Derselbe Sichtbarkeits-Gruppen-Check wie linesController.addPlayerToLine
    // – verhindert, dass ein fremder/unpassender Kader-Spieler einem Spiel
    // zugeordnet wird.
    const sameScope = game.team_id
      ? rosterRow.team_id === game.team_id
      : rosterRow.user_id === req.user.id && !rosterRow.team_id;
    if (!sameScope) {
      return res.status(400).json(error('Kader-Spieler gehört nicht zum Kader dieses Spiels'));
    }

    const { status, note = '' } = req.body;
    const result = await pool.query(
      `INSERT INTO game_squad (game_id, roster_player_id, status, note)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (game_id, roster_player_id)
       DO UPDATE SET status = excluded.status, note = excluded.note
       RETURNING *`,
      [gameId, req.params.rosterPlayerId, status, note]
    );
    const playerResult = await pool.query(
      'SELECT name, jersey_number, role FROM roster_players WHERE id = $1',
      [req.params.rosterPlayerId]
    );
    res.json(success(toApiSquadEntry({ ...result.rows[0], ...playerResult.rows[0] })));
  } catch (err) {
    logger.error('[setSquadStatus]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// DELETE /api/games/:id/squad/:rosterPlayerId – setzt zurück auf
// "nicht entschieden" (kein Datensatz, status: null bei GET).
export async function clearSquadStatus(req, res) {
  try {
    const gameId = req.params.id;
    if (!(await assertGameWrite(gameId, req.user.id))) {
      return res.status(404).json(error('Spiel nicht gefunden'));
    }
    await pool.query(
      'DELETE FROM game_squad WHERE game_id = $1 AND roster_player_id = $2',
      [gameId, req.params.rosterPlayerId]
    );
    res.json(success({ message: 'Status zurückgesetzt' }));
  } catch (err) {
    logger.error('[clearSquadStatus]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}
