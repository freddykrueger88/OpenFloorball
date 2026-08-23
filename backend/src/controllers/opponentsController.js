/**
 * opponentsController – strukturierte Gegner-Entität (ADR-0007 in
 * DECISIONS.md). Ersetzt NICHT games.opponent (bleibt Freitext-Snapshot,
 * gleiches Prinzip wie match_lines.line_name), sondern verknüpft Spiele
 * mit demselben Gegnernamen automatisch über resolveOpponentId beim
 * Anlegen/Ändern eines Spiels (siehe gamesController.js).
 *
 * Nur ein Lese-Endpunkt (GET /api/opponents) – kein manuelles
 * Anlegen/Umbenennen/Zusammenführen in diesem Schritt, siehe
 * Architektur-Dokument Abschnitt 8.4.
 */
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { success, error } from '../utils/apiResponse.js';
import { getUserTeamIds } from '../utils/teamAccess.js';
import { calculateMatchScore } from '../services/statisticsEngine.js';

// node-postgres liefert DATE-Spalten als Date-Objekt in der lokalen
// Zeitzone des Prozesses – über die lokalen Getter statt toISOString()
// zurück in "YYYY-MM-DD" wandeln (gleiches Problem/Lösung wie in
// gamesController.js/trainingSessionsController.js).
function toDateString(date) {
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// resolveOpponentId – find-or-create, team-scoped (ein Gegnername ist
// eindeutig pro Team, damit zwei Co-Trainer desselben Teams auf denselben
// Datensatz treffen) oder user-scoped für team-lose, persönliche Spiele.
// SELECT-dann-INSERT statt Transaktion/ON CONFLICT im App-Code: gleiche
// Einfachheit wie der Rest von gamesController.js (z.B. deleteGame räumt
// auch mehrere Tabellen sequenziell ohne Transaktion auf) – das minimale
// Race-Fenster bei zwei zeitgleich neu getippten, identischen Namen ist
// bei diesem Nutzungsmuster (ein Coach erfasst ein Spiel) vernachlässigbar,
// die partiellen Unique-Indizes in migrate.js verhindern zumindest
// dauerhaft doppelte Datensätze.
export async function resolveOpponentId(name, userId, teamId) {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return null;

  if (teamId) {
    const existing = await pool.query(
      `SELECT id FROM opponents WHERE team_id = $1 AND lower(trim(name)) = lower(trim($2))`,
      [teamId, trimmed]
    );
    if (existing.rows[0]) return existing.rows[0].id;
    const inserted = await pool.query(
      `INSERT INTO opponents (user_id, team_id, name) VALUES ($1, $2, $3) RETURNING id`,
      [userId, teamId, trimmed]
    );
    return inserted.rows[0].id;
  }

  const existing = await pool.query(
    `SELECT id FROM opponents WHERE user_id = $1 AND team_id IS NULL AND lower(trim(name)) = lower(trim($2))`,
    [userId, trimmed]
  );
  if (existing.rows[0]) return existing.rows[0].id;
  const inserted = await pool.query(
    `INSERT INTO opponents (user_id, team_id, name) VALUES ($1, NULL, $2) RETURNING id`,
    [userId, trimmed]
  );
  return inserted.rows[0].id;
}

function classifyResult(ownGoals, opponentGoals) {
  if (ownGoals > opponentGoals) return 'win';
  if (ownGoals < opponentGoals) return 'loss';
  return 'draw';
}

// GET /api/opponents – Bilanz (Siege/Unentschieden/Niederlagen,
// Tordifferenz) je Gegner, je eine Query für opponents/games/game_events
// (Muster aus csvExportController.exportGamesCsv – kein N+1), in JS
// gruppiert und mit der bereits vorhandenen calculateMatchScore
// ausgewertet. Nur Spiele mit played_at IS NOT NULL zählen in die Bilanz
// (ungespielte/zukünftige Spiele wären sonst fälschlich ein 0:0-Unentschieden,
// gleiche Konvention wie getRosterPlayerGameLog).
export async function getOpponents(req, res) {
  try {
    const teamIds = await getUserTeamIds(req.user.id);
    const opponentsResult = await pool.query(
      `SELECT * FROM opponents
       WHERE (user_id = $1 AND team_id IS NULL) OR team_id = ANY($2::uuid[])
       ORDER BY name ASC`,
      [req.user.id, teamIds]
    );
    const opponentIds = opponentsResult.rows.map((o) => o.id);

    const gamesResult = opponentIds.length > 0
      ? await pool.query(
          `SELECT id, opponent_id, played_at FROM games
           WHERE opponent_id = ANY($1::uuid[]) AND played_at IS NOT NULL
           ORDER BY played_at DESC`,
          [opponentIds]
        )
      : { rows: [] };
    const gameIds = gamesResult.rows.map((g) => g.id);

    const eventsResult = gameIds.length > 0
      ? await pool.query(
          `SELECT game_id, event_type, is_opponent FROM game_events WHERE game_id = ANY($1::uuid[])`,
          [gameIds]
        )
      : { rows: [] };
    const eventsByGame = new Map();
    for (const row of eventsResult.rows) {
      if (!eventsByGame.has(row.game_id)) eventsByGame.set(row.game_id, []);
      eventsByGame.get(row.game_id).push(row);
    }

    const gamesByOpponent = new Map();
    for (const game of gamesResult.rows) {
      if (!gamesByOpponent.has(game.opponent_id)) gamesByOpponent.set(game.opponent_id, []);
      gamesByOpponent.get(game.opponent_id).push(game);
    }

    const response = opponentsResult.rows.map((opponent) => {
      const games = (gamesByOpponent.get(opponent.id) ?? []).map((game) => {
        const { ownGoals, opponentGoals } = calculateMatchScore(eventsByGame.get(game.id) ?? []);
        return {
          id: game.id,
          playedAt: toDateString(game.played_at),
          ownGoals,
          opponentGoals,
          result: classifyResult(ownGoals, opponentGoals),
        };
      });

      const wins   = games.filter((g) => g.result === 'win').length;
      const draws  = games.filter((g) => g.result === 'draw').length;
      const losses = games.filter((g) => g.result === 'loss').length;
      const goalsFor     = games.reduce((sum, g) => sum + g.ownGoals, 0);
      const goalsAgainst = games.reduce((sum, g) => sum + g.opponentGoals, 0);

      return {
        id: opponent.id,
        name: opponent.name,
        teamId: opponent.team_id,
        gamesPlayed: games.length,
        wins, draws, losses,
        goalsFor, goalsAgainst,
        games,
      };
    });

    res.json(success(response));
  } catch (err) {
    logger.error('[getOpponents]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}
