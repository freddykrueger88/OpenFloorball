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
import { deleteRsvpsForResource } from './rsvpsController.js';
import { deleteCarpoolOffersForResource } from './carpoolsController.js';
import { deleteVideosForGame } from './gameVideosController.js';
import { resolveOpponentId } from './opponentsController.js';

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

// TIME-Spalten liefert node-postgres als String "HH:MM:SS" – Sekunden für
// die API abschneiden, das Frontend braucht nur "HH:MM".
function toTimeString(time) {
  return time ? time.slice(0, 5) : null;
}

// Ergebnis nur ableitbar, sobald mindestens ein Tor erfasst ist (Spieler-
// Dashboard-Ausbau) – kein "0:0 unentschieden" für ein noch nicht
// begonnenes Spiel ohne jedes Ereignis.
function computeResult(ownGoals, opponentGoals) {
  if (ownGoals === 0 && opponentGoals === 0) return null;
  if (ownGoals > opponentGoals) return 'win';
  if (ownGoals < opponentGoals) return 'loss';
  return 'draw';
}

function toApiGame(row) {
  const ownGoals = Number(row.own_goals ?? 0);
  const opponentGoals = Number(row.opponent_goals ?? 0);
  return {
    _id:       row.id,
    opponent:  row.opponent,
    opponentId: row.opponent_id,
    teamId:    row.team_id,
    playedAt:  toDateString(row.played_at),
    notes:     row.notes,
    clockPeriod:          row.clock_period,
    clockStatus:          row.clock_status,
    clockElapsedSeconds:  row.clock_elapsed_seconds,
    clockStartedAt:       row.clock_started_at,
    clockPeriodMinutes:   row.clock_period_minutes,
    // Spieler-Dashboard-Ausbau: Spiel-Logistik (alle nullable/additiv)
    kickoffTime:  toTimeString(row.kickoff_time),
    venueName:    row.venue_name,
    venueAddress: row.venue_address,
    venueLat:     row.venue_lat,
    venueLng:     row.venue_lng,
    isHome:       row.is_home,
    status:       row.status,
    ownGoals,
    opponentGoals,
    result: computeResult(ownGoals, opponentGoals),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Serverseitig berechnetes Endergebnis aus game_events (Spieler-Dashboard-
// Ausbau) – vermeidet N+1-Requests für Saisonüberblick/letztes Spiel, exakt
// dasselbe Aggregations-Muster wie rosterController.js::fetchRosterStats.
const GAME_GOALS_JOIN = `
  LEFT JOIN (
    SELECT game_id,
           SUM(CASE WHEN event_type = 'goal' AND NOT is_opponent THEN 1 ELSE 0 END) AS own_goals,
           SUM(CASE WHEN event_type = 'goal' AND is_opponent THEN 1 ELSE 0 END) AS opponent_goals
    FROM game_events
    GROUP BY game_id
  ) ge ON ge.game_id = g.id
`;

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
      `SELECT g.*, COALESCE(ge.own_goals, 0)::int AS own_goals, COALESCE(ge.opponent_goals, 0)::int AS opponent_goals
       FROM games g
       ${GAME_GOALS_JOIN}
       WHERE g.user_id = $1 OR g.team_id = ANY($2::uuid[])
       ORDER BY g.played_at DESC NULLS FIRST, g.updated_at DESC`,
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
    const {
      opponent = '', playedAt = null, teamId = null,
      kickoffTime = null, venueName = null, venueAddress = null,
      venueLat = null, venueLng = null, isHome = null,
    } = req.body;

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

    const opponentId = await resolveOpponentId(opponent, req.user.id, teamId);

    const result = await pool.query(
      `INSERT INTO games (user_id, opponent, opponent_id, played_at, team_id,
                           kickoff_time, venue_name, venue_address, venue_lat, venue_lng, is_home)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [req.user.id, opponent, opponentId, playedAt, teamId,
        kickoffTime, venueName, venueAddress, venueLat, venueLng, isHome]
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
    const result = await pool.query(
      `SELECT g.*, COALESCE(ge.own_goals, 0)::int AS own_goals, COALESCE(ge.opponent_goals, 0)::int AS opponent_goals
       FROM games g
       ${GAME_GOALS_JOIN}
       WHERE g.id = $1`,
      [req.params.id]
    );
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

    if (req.body.opponent !== undefined) {
      const game = await getGameRow(req.params.id);
      const opponentId = await resolveOpponentId(req.body.opponent, req.user.id, game.team_id);
      sets.push(`opponent = $${i}`); values.push(req.body.opponent); i += 1;
      sets.push(`opponent_id = $${i}`); values.push(opponentId); i += 1;
    }
    if (req.body.playedAt !== undefined) { sets.push(`played_at = $${i}`); values.push(req.body.playedAt); i += 1; }
    if (req.body.notes !== undefined)    { sets.push(`notes = $${i}`);     values.push(req.body.notes);    i += 1; }
    if (req.body.periodMinutes !== undefined) { sets.push(`clock_period_minutes = $${i}`); values.push(req.body.periodMinutes); i += 1; }
    // Spieler-Dashboard-Ausbau: Spiel-Logistik
    if (req.body.kickoffTime !== undefined)  { sets.push(`kickoff_time = $${i}`);  values.push(req.body.kickoffTime);  i += 1; }
    if (req.body.venueName !== undefined)    { sets.push(`venue_name = $${i}`);    values.push(req.body.venueName);    i += 1; }
    if (req.body.venueAddress !== undefined) { sets.push(`venue_address = $${i}`); values.push(req.body.venueAddress); i += 1; }
    if (req.body.venueLat !== undefined)     { sets.push(`venue_lat = $${i}`);     values.push(req.body.venueLat);     i += 1; }
    if (req.body.venueLng !== undefined)     { sets.push(`venue_lng = $${i}`);     values.push(req.body.venueLng);     i += 1; }
    if (req.body.isHome !== undefined)       { sets.push(`is_home = $${i}`);       values.push(req.body.isHome);       i += 1; }
    if (req.body.status !== undefined)       { sets.push(`status = $${i}`);        values.push(req.body.status);       i += 1; }

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
    // Video-Dateien VOR dem harten Löschen einsammeln (Statistik-Architektur
    // Phase 6) – game_videos-ZEILEN räumt der ON DELETE CASCADE unten von
    // selbst auf, die DATEIEN auf Disk kennt der CASCADE nicht.
    await deleteVideosForGame(req.params.id);
    await pool.query('DELETE FROM games WHERE id = $1', [req.params.id]);
    // games werden hart gelöscht (kein Soft-Delete wie bei Boards) – Notizen
    // (comments mit resource_type='game') hier explizit aufräumen, sonst
    // blieben verwaiste Zeilen zurück (comments hat kein DB-FK auf games).
    await deleteCommentsForResource('game', req.params.id);
    await deleteRsvpsForResource('game', req.params.id);
    await deleteCarpoolOffersForResource('game', req.params.id);
    res.json(success({ message: 'Spiel gelöscht' }));
  } catch (err) {
    logger.error('[deleteGame]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}
