/**
 * matchLinesController – Match-Line/Shift-Tracking (Statistik-
 * Architektur Phase 2, siehe STATISTICS_ANALYTICS_ARCHITECTURE.md
 * Abschnitt 8.3). Zeitgestempelte Historie, WELCHE Line während dieses
 * Spiels wann "auf dem Feld" war – zusätzlich zur (weiterhin
 * unveränderten) Freitext-Notiz und zum weiterhin unveränderten
 * lines.is_active-Vorbereitungs-Flag, nicht als Ersatz für beides.
 */
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { success, created, error } from '../utils/apiResponse.js';
import { assertGameRead, assertGameWrite } from './gamesController.js';
import { calculateLineStats } from '../services/statisticsEngine.js';

function toApiMatchLine(row) {
  return {
    _id:       row.id,
    gameId:    row.game_id,
    lineId:    row.line_id,
    lineName:  row.line_name,
    period:    row.period,
    startedAt: row.started_at,
    endedAt:   row.ended_at,
    createdBy: row.created_by,
  };
}

// GET /api/games/:id/match-lines – volle Historie, chronologisch
// aufsteigend (wie gameEventsController.getEvents), Lesezugriff reicht.
export async function getMatchLines(req, res) {
  try {
    const gameId = req.params.id;
    if (!(await assertGameRead(gameId, req.user.id))) {
      return res.status(404).json(error('Spiel nicht gefunden'));
    }
    const result = await pool.query(
      'SELECT * FROM match_lines WHERE game_id = $1 ORDER BY started_at ASC',
      [gameId]
    );
    res.json(success(result.rows.map(toApiMatchLine)));
  } catch (err) {
    logger.error('[getMatchLines]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// GET /api/games/:id/match-lines/stats – berechnete Line-Statistiken
// (Zeit zusammen, Goals For/Against) über statisticsEngine.
// calculateLineStats. Bewusst serverseitig, kein Frontend-Duplikat –
// anders als die triviale calculateMatchScore-Filterung ist die
// Gruppierungs-/Zeitfenster-Logik hier komplex genug, dass eine zweite,
// unabhängig gepflegte JS-Implementierung ein echtes Drift-Risiko wäre.
export async function getLineStats(req, res) {
  try {
    const gameId = req.params.id;
    if (!(await assertGameRead(gameId, req.user.id))) {
      return res.status(404).json(error('Spiel nicht gefunden'));
    }
    const [matchLinesResult, eventsResult] = await Promise.all([
      pool.query('SELECT * FROM match_lines WHERE game_id = $1 ORDER BY started_at ASC', [gameId]),
      pool.query('SELECT * FROM game_events WHERE game_id = $1', [gameId]),
    ]);
    const stats = calculateLineStats(matchLinesResult.rows, eventsResult.rows, { now: new Date() });
    res.json(success(stats));
  } catch (err) {
    logger.error('[getLineStats]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// POST /api/games/:id/match-lines   Body: { lineId }
// Schließt die aktuell offene Zeile dieses Spiels (falls vorhanden) und
// öffnet eine neue – Coach-Entscheidung wie das Aktivieren einer Line
// selbst, daher assertGameWrite.
export async function activateMatchLine(req, res) {
  const client = await pool.connect();
  try {
    const gameId = req.params.id;
    if (!(await assertGameWrite(gameId, req.user.id))) {
      client.release();
      return res.status(404).json(error('Spiel nicht gefunden'));
    }

    const gameResult = await pool.query(
      'SELECT user_id, team_id, clock_period FROM games WHERE id = $1',
      [gameId]
    );
    const game = gameResult.rows[0];

    const { lineId } = req.body;
    const lineResult = await pool.query('SELECT id, user_id, team_id, name FROM lines WHERE id = $1', [lineId]);
    const line = lineResult.rows[0];
    if (!line) {
      client.release();
      return res.status(404).json(error('Line nicht gefunden'));
    }
    // Derselbe Sichtbarkeits-Gruppen-Check wie linesController.
    // addPlayerToLine / matchSquadController.setSquadStatus /
    // gameEventsController.addEvent, jetzt für eine Line statt einen
    // Kader-Spieler.
    const sameScope = game.team_id
      ? line.team_id === game.team_id
      : line.user_id === req.user.id && !line.team_id;
    if (!sameScope) {
      client.release();
      return res.status(400).json(error('Line gehört nicht zur Sichtbarkeits-Gruppe dieses Spiels'));
    }

    // period wie bei game_events: "unbekannt ≠ 0" – NULL solange die Uhr
    // nie gestartet wurde, statt fälschlich 0/1 anzunehmen.
    const period = game.clock_period || null;

    await client.query('BEGIN');
    // Innerhalb derselben Transaktion liefert Postgres' NOW() für beide
    // Statements exakt denselben Zeitstempel – das macht den
    // Zeitfenster-Übergang zwischen zwei Lines lückenlos (siehe
    // calculateLineStats' halb-offene Intervall-Regel).
    await client.query(
      'UPDATE match_lines SET ended_at = NOW() WHERE game_id = $1 AND ended_at IS NULL',
      [gameId]
    );
    const insertResult = await client.query(
      `INSERT INTO match_lines (game_id, line_id, line_name, period, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [gameId, line.id, line.name, period, req.user.id]
    );
    await client.query('COMMIT');
    res.status(201).json(created(toApiMatchLine(insertResult.rows[0])));
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('[activateMatchLine]', err);
    res.status(500).json(error('Interner Serverfehler'));
  } finally {
    client.release();
  }
}
