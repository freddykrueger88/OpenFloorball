/**
 * gamesController – Live-Spielnotizen: das "Spiel" selbst (Gegner,
 * Datum, optional Team), Backlog "Erweiterung: Live-Unterstützung".
 *
 * Nutzer-gebunden (nicht board-gebunden), analog
 * trainingSessionsController.js. Die eigentlichen Notizen sind KEINE
 * eigene Tabelle/Route hier – sie laufen über die bestehende
 * `comments`-Tabelle mit resource_type='game' (siehe routes/index.js,
 * `createCommentRoutes('game', ...)`), da das exakt dasselbe Muster
 * ist (freier Text, zeitgestempelt, an eine Ressource gehängt).
 *
 * Team-Zuordnung optional: lesen dürfen alle Team-Mitglieder, ändern
 * nur owner/coach (siehe assertGameRead/-Write unten) – identische
 * Logik zu assertSessionRead/-Write.
 */
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { success, created, error } from '../utils/apiResponse.js';
import { getUserTeamIds, assertTeamAccess } from '../utils/teamAccess.js';
import { deleteCommentsForResource } from './commentsController.js';

const MAX_GAMES = 30;

// node-postgres liefert DATE-Spalten als Date-Objekt in der lokalen
// Zeitzone des Prozesses – über die lokalen Getter statt toISOString()
// zurück in "YYYY-MM-DD" wandeln (gleiches Problem/Lösung wie in
// trainingSessionsController.js).
function toDateString(date) {
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toApiGame(row) {
  return {
    _id:       row.id,
    opponent:  row.opponent,
    teamId:    row.team_id,
    playedAt:  toDateString(row.played_at),
    notes:     row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getGameRow(gameId) {
  const result = await pool.query('SELECT user_id, team_id FROM games WHERE id = $1', [gameId]);
  return result.rows[0] ?? null;
}

// exportiert, da auch von routes/index.js für die Notizen-Kommentarroute genutzt
export async function assertGameRead(gameId, userId) {
  const game = await getGameRow(gameId);
  if (!game) return false;
  if (game.user_id === userId) return true;
  if (!game.team_id) return false;
  return assertTeamAccess(game.team_id, userId, 'member');
}

export async function assertGameWrite(gameId, userId) {
  const game = await getGameRow(gameId);
  if (!game) return false;
  if (game.user_id === userId) return true;
  if (!game.team_id) return false;
  return assertTeamAccess(game.team_id, userId, 'coach');
}

// GET /api/games
export async function getGames(req, res) {
  try {
    const teamIds = await getUserTeamIds(req.user.id);
    const result = await pool.query(
      `SELECT * FROM games WHERE user_id = $1 OR team_id = ANY($2::uuid[])
       ORDER BY played_at DESC NULLS FIRST, updated_at DESC`,
      [req.user.id, teamIds]
    );
    res.json(success(result.rows.map(toApiGame)));
  } catch (err) {
    logger.error('[getGames]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// POST /api/games
export async function createGame(req, res) {
  try {
    const { opponent = '', playedAt = null, teamId = null } = req.body;

    if (teamId && !(await assertTeamAccess(teamId, req.user.id, 'coach'))) {
      return res.status(404).json(error('Team nicht gefunden'));
    }

    const countResult = await pool.query(
      'SELECT COUNT(*)::int AS count FROM games WHERE user_id = $1',
      [req.user.id]
    );
    if (countResult.rows[0].count >= MAX_GAMES) {
      return res.status(400).json(error(`Maximal ${MAX_GAMES} Spiele`));
    }

    const result = await pool.query(
      `INSERT INTO games (user_id, opponent, played_at, team_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, opponent, playedAt, teamId]
    );
    res.status(201).json(created(toApiGame(result.rows[0])));
  } catch (err) {
    logger.error('[createGame]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// GET /api/games/:id
export async function getGame(req, res) {
  try {
    if (!(await assertGameRead(req.params.id, req.user.id))) {
      return res.status(404).json(error('Spiel nicht gefunden'));
    }
    const result = await pool.query('SELECT * FROM games WHERE id = $1', [req.params.id]);
    res.json(success(toApiGame(result.rows[0])));
  } catch (err) {
    logger.error('[getGame]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// PUT /api/games/:id
export async function updateGame(req, res) {
  try {
    if (!(await assertGameWrite(req.params.id, req.user.id))) {
      return res.status(404).json(error('Spiel nicht gefunden'));
    }

    const sets = [];
    const values = [];
    let i = 1;

    if (req.body.opponent !== undefined) { sets.push(`opponent = $${i}`); values.push(req.body.opponent); i += 1; }
    if (req.body.playedAt !== undefined) { sets.push(`played_at = $${i}`); values.push(req.body.playedAt); i += 1; }
    if (req.body.notes !== undefined)    { sets.push(`notes = $${i}`);     values.push(req.body.notes);    i += 1; }

    if (sets.length === 0) {
      return res.status(400).json(error('Keine gültigen Felder zum Aktualisieren'));
    }

    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE games SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    res.json(success(toApiGame(result.rows[0])));
  } catch (err) {
    logger.error('[updateGame]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// DELETE /api/games/:id
export async function deleteGame(req, res) {
  try {
    if (!(await assertGameWrite(req.params.id, req.user.id))) {
      return res.status(404).json(error('Spiel nicht gefunden'));
    }
    await pool.query('DELETE FROM games WHERE id = $1', [req.params.id]);
    // games werden hart gelöscht (kein Soft-Delete wie bei Boards) – Notizen
    // (comments mit resource_type='game') hier explizit aufräumen, sonst
    // blieben verwaiste Zeilen zurück (comments hat kein DB-FK auf games).
    await deleteCommentsForResource('game', req.params.id);
    res.json(success({ message: 'Spiel gelöscht' }));
  } catch (err) {
    logger.error('[deleteGame]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}
