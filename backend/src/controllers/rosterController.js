/**
 * rosterController – CRUD für den zentralen Team-Kader (Issue #53)
 *
 * Nutzer-gebunden statt board-gebunden (analog playbooksController.js).
 * Rein additiv: Board-Spielerdaten bleiben frei editierbar, ein
 * Kader-Eintrag dient nur als optionale Zuweisungsvorlage.
 *
 * ROADMAP Phase 2 (Team und Organisation): ein Kader-Eintrag kann
 * zusätzlich einem Team zugeordnet sein (team_id, additiv neben
 * user_id) – dann sehen alle Team-Mitglieder ihn, aber nur owner/coach
 * dürfen ihn anlegen/bearbeiten/löschen (siehe assertResourceWrite unten).
 */
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { success, created, error } from '../utils/apiResponse.js';
import { getUserTeamIds, assertTeamAccess } from '../utils/teamAccess.js';

const MAX_ROSTER_PLAYERS = 40;

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

function toApiRosterPlayer(row) {
  return {
    _id:           row.id,
    name:          row.name,
    jerseyNumber:  row.jersey_number,
    role:          row.role,
    teamId:        row.team_id,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,
  };
}

// Torhüter-Felder (Phase 3 Schuss-Tracking) sind auf role==='TW' gegated
// – nicht in der SQL, sondern hier an der API-Grenze, damit eine
// versehentliche Torhüter-Zuordnung bei einem Nicht-TW-Spieler nie eine
// irreführende Fangquote anzeigt.
function toApiRosterStats(row) {
  const isGoalkeeper = row.role === 'TW';
  const shotsOnGoal = Number(row.shots_on_goal ?? 0);
  const gkShotsOnGoalAgainst = Number(row.gk_shots_on_goal_against ?? 0);
  return {
    ...toApiRosterPlayer(row),
    goals:          Number(row.goals ?? 0),
    assists:        Number(row.assists ?? 0),
    points:         Number(row.goals ?? 0) + Number(row.assists ?? 0),
    penaltyMinutes: Number(row.penalty_minutes ?? 0),
    matchPenalties: Number(row.match_penalties ?? 0),
    appearances:    Number(row.appearances ?? 0),
    shots:          Number(row.shots ?? 0),
    shotPercentage: shotsOnGoal > 0 ? Math.round((Number(row.shot_goals ?? 0) / shotsOnGoal) * 1000) / 10 : null,
    goalsAgainst:   isGoalkeeper ? Number(row.gk_goals_against ?? 0) : null,
    savePercentage: isGoalkeeper && gkShotsOnGoalAgainst > 0
      ? Math.round((Number(row.gk_saves ?? 0) / gkShotsOnGoalAgainst) * 1000) / 10
      : null,
    // Statistik-Architektur Phase 5: Beteiligungsquote über ERFASSTE
    // Trainings (jede Anwesenheits-Entscheidung, nicht nur "präsent"),
    // analog appearances oben nur bei tatsächlich gesetztem Status
    // gezählt. null statt 0, solange kein einziges Training erfasst
    // wurde ("unbekannt ≠ 0", Architektur-Dokument Abschnitt 10).
    trainingsRecorded: Number(row.trainings_recorded ?? 0),
    trainingsPresent:  Number(row.trainings_present ?? 0),
    attendanceRate: Number(row.trainings_recorded ?? 0) > 0
      ? Math.round((Number(row.trainings_present ?? 0) / Number(row.trainings_recorded)) * 1000) / 10
      : null,
  };
}

// Darf der Nutzer diesen Datensatz anlegen/bearbeiten/löschen? Eigene
// (team_id NULL) Datensätze: immer. Team-geteilte: nur owner/coach.
async function assertResourceWrite(row, userId) {
  if (!row) return false;
  if (row.user_id === userId) return true;
  if (!row.team_id) return false;
  return assertTeamAccess(row.team_id, userId, 'coach');
}

// Darf der Nutzer diesen Datensatz überhaupt sehen? Wie die Sichtbarkeit
// von getRosterPlayers (jedes Team-Mitglied, nicht nur coach/owner) – für
// den Offline-Konfliktcheck (GET /:id als conflictCheckUrl) reicht Lesen.
async function assertResourceRead(row, userId) {
  if (!row) return false;
  if (row.user_id === userId) return true;
  if (!row.team_id) return false;
  return assertTeamAccess(row.team_id, userId, 'member');
}

// GET /api/roster
export async function getRosterPlayers(req, res) {
  try {
    const teamIds = await getUserTeamIds(req.user.id);
    const result = await pool.query(
      `SELECT * FROM roster_players
       WHERE user_id = $1 OR team_id = ANY($2::uuid[])
       ORDER BY jersey_number ASC NULLS LAST, name ASC`,
      [req.user.id, teamIds]
    );
    res.json(success(result.rows.map(toApiRosterPlayer)));
  } catch (err) {
    logger.error('[getRosterPlayers]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// GET /api/roster/stats – Spieler-Statistiken (Roadmap-Audit,
// Fortsetzung von Phase C), rein abgeleitet aus bestehenden Tabellen,
// keine neue Migration. Tore/Strafen (game_events) und Einsätze
// (game_squad) sind zwei unabhängige 1:n-Beziehungen zu roster_players
// – als vorab aggregierte Subqueries angehängt statt in einem
// gemeinsamen LEFT JOIN + GROUP BY, sonst würde das Kreuzprodukt
// beider Tabellen die Summen verfälschen (beide sind nur über
// roster_player_id verknüpft, nicht über dieselbe Zeile).
// Ein Tor ohne Spieler-Zuordnung (roster_player_id NULL) zählt zwar
// fürs Team-Live-Ergebnis (siehe GamePage.jsx ownGoals), kann aber per
// Definition keinem einzelnen Spieler persönlich angerechnet werden –
// WHERE roster_player_id IS NOT NULL blendet solche Zeilen hier bewusst aus.
// Reine Datenbeschaffung ohne req/res – wiederverwendet von getRosterStats
// (JSON-API) UND vom CSV-Export (csvExportController.js, Statistik-
// Architektur Phase 7), damit die Kennzahlen-Formel an genau einer Stelle
// gepflegt wird statt zweimal dieselbe SQL zu duplizieren.
export async function fetchRosterStats(userId, teamIds) {
  const result = await pool.query(
      `SELECT rp.*,
              COALESCE(g.goals, 0)::int           AS goals,
              COALESCE(a.assists, 0)::int         AS assists,
              COALESCE(g.penalty_minutes, 0)::int AS penalty_minutes,
              COALESCE(g.match_penalties, 0)::int AS match_penalties,
              COALESCE(s.appearances, 0)::int      AS appearances,
              COALESCE(sh.shots, 0)::int           AS shots,
              COALESCE(sh.shots_on_goal, 0)::int   AS shots_on_goal,
              COALESCE(sh.shot_goals, 0)::int      AS shot_goals,
              COALESCE(gk.shots_on_goal_against, 0)::int AS gk_shots_on_goal_against,
              COALESCE(gk.saves, 0)::int                 AS gk_saves,
              COALESCE(gk.goals_against, 0)::int         AS gk_goals_against,
              COALESCE(ta.trainings_recorded, 0)::int    AS trainings_recorded,
              COALESCE(ta.trainings_present, 0)::int     AS trainings_present
       FROM roster_players rp
       LEFT JOIN (
         SELECT roster_player_id,
                SUM(CASE WHEN event_type = 'goal' AND NOT is_opponent THEN 1 ELSE 0 END) AS goals,
                SUM(CASE WHEN event_type = 'penalty_2' THEN 2 WHEN event_type = 'penalty_5' THEN 5 ELSE 0 END) AS penalty_minutes,
                SUM(CASE WHEN event_type = 'match_penalty' THEN 1 ELSE 0 END) AS match_penalties
         FROM game_events
         WHERE roster_player_id IS NOT NULL
         GROUP BY roster_player_id
       ) g ON g.roster_player_id = rp.id
       LEFT JOIN (
         -- Assists (Phasenplanungs-Review 2026-08-21): secondary_roster_player_id
         -- auf einem eigenen Tor-Ereignis, siehe gameEventsController.addEvent
         -- (Companion-Goal kopiert es seither mit) und docs/statistics.md.
         SELECT secondary_roster_player_id AS roster_player_id, COUNT(*) AS assists
         FROM game_events
         WHERE event_type = 'goal' AND NOT is_opponent AND secondary_roster_player_id IS NOT NULL
         GROUP BY secondary_roster_player_id
       ) a ON a.roster_player_id = rp.id
       LEFT JOIN (
         SELECT roster_player_id, COUNT(*) AS appearances
         FROM game_squad
         WHERE status = 'playing'
         GROUP BY roster_player_id
       ) s ON s.roster_player_id = rp.id
       LEFT JOIN (
         SELECT roster_player_id,
                COUNT(*) AS shots,
                SUM(CASE WHEN outcome IN ('goal', 'save') THEN 1 ELSE 0 END) AS shots_on_goal,
                SUM(CASE WHEN outcome = 'goal' THEN 1 ELSE 0 END) AS shot_goals
         FROM game_events
         WHERE event_type = 'shot' AND NOT is_opponent AND roster_player_id IS NOT NULL
         GROUP BY roster_player_id
       ) sh ON sh.roster_player_id = rp.id
       LEFT JOIN (
         SELECT secondary_roster_player_id AS roster_player_id,
                SUM(CASE WHEN outcome IN ('goal', 'save') THEN 1 ELSE 0 END) AS shots_on_goal_against,
                SUM(CASE WHEN outcome = 'save' THEN 1 ELSE 0 END) AS saves,
                SUM(CASE WHEN outcome = 'goal' THEN 1 ELSE 0 END) AS goals_against
         FROM game_events
         WHERE event_type = 'shot' AND is_opponent AND secondary_roster_player_id IS NOT NULL
         GROUP BY secondary_roster_player_id
       ) gk ON gk.roster_player_id = rp.id
       LEFT JOIN (
         SELECT roster_player_id,
                COUNT(*) AS trainings_recorded,
                SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS trainings_present
         FROM training_attendance
         GROUP BY roster_player_id
       ) ta ON ta.roster_player_id = rp.id
       WHERE rp.user_id = $1 OR rp.team_id = ANY($2::uuid[])
       ORDER BY goals DESC, rp.jersey_number ASC NULLS LAST, rp.name ASC`,
    [userId, teamIds]
  );
  return result.rows.map(toApiRosterStats);
}

export async function getRosterStats(req, res) {
  try {
    const teamIds = await getUserTeamIds(req.user.id);
    res.json(success(await fetchRosterStats(req.user.id, teamIds)));
  } catch (err) {
    logger.error('[getRosterStats]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// GET /api/roster/:id – dient dem Frontend als conflictCheckUrl für die
// Offline-Konfliktlösung (offlineSync.js vergleicht updatedAt).
export async function getRosterPlayer(req, res) {
  try {
    const existing = await pool.query('SELECT * FROM roster_players WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0 || !(await assertResourceRead(existing.rows[0], req.user.id))) {
      return res.status(404).json(error('Kader-Spieler nicht gefunden'));
    }
    res.json(success(toApiRosterPlayer(existing.rows[0])));
  } catch (err) {
    logger.error('[getRosterPlayer]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

function toApiGameLogEntry(row) {
  return {
    gameId:         row.game_id,
    opponent:       row.opponent,
    playedAt:       toDateString(row.played_at),
    goals:          Number(row.goals ?? 0),
    assists:        Number(row.assists ?? 0),
    shots:          Number(row.shots ?? 0),
    shotsOnGoal:    Number(row.shots_on_goal ?? 0),
    shotGoals:      Number(row.shot_goals ?? 0),
    penaltyMinutes: Number(row.penalty_minutes ?? 0),
  };
}

// GET /api/roster/:id/game-log – Trends (Statistik-Architektur Phase 4):
// eine Zeile PRO SPIEL (nicht saison-aggregiert wie getRosterStats), in
// dem der Spieler im Match-Kader als 'playing' stand, chronologisch
// aufsteigend nach played_at – Grundlage für Last-5/Last-10/Season im
// Frontend (useGameLog.js). Rohzahlen (shots/shotsOnGoal/shotGoals),
// NICHT eine pro Spiel fertig berechnete shotPercentage – ein
// Fenster-Durchschnitt aus einzelnen Prozentwerten wäre mathematisch
// falsch (Summe der Zähler/Nenner muss VOR der Division über das
// Fenster gebildet werden, im Frontend).
// Spiele ohne played_at (NULL) werden ausgeschlossen: ohne Datum ist
// keine verlässliche Chronologie möglich – bewusst NICHT die
// `ORDER BY played_at DESC NULLS FIRST`-Sortierung aus
// gamesController.getGames übernehmen, die für "letzte N Spiele" falsch
// wäre (würde undatierte Spiele zuerst zeigen).
export async function getRosterPlayerGameLog(req, res) {
  try {
    const existing = await pool.query('SELECT * FROM roster_players WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0 || !(await assertResourceRead(existing.rows[0], req.user.id))) {
      return res.status(404).json(error('Kader-Spieler nicht gefunden'));
    }

    const result = await pool.query(
      `SELECT g.id AS game_id, g.opponent, g.played_at,
              COALESCE(go.goals, 0)::int         AS goals,
              COALESCE(a.assists, 0)::int        AS assists,
              COALESCE(sh.shots, 0)::int         AS shots,
              COALESCE(sh.shots_on_goal, 0)::int AS shots_on_goal,
              COALESCE(sh.shot_goals, 0)::int    AS shot_goals,
              COALESCE(pen.penalty_minutes, 0)::int AS penalty_minutes
       FROM games g
       JOIN game_squad gs ON gs.game_id = g.id AND gs.roster_player_id = $1 AND gs.status = 'playing'
       LEFT JOIN (
         SELECT game_id, COUNT(*) AS goals
         FROM game_events
         WHERE event_type = 'goal' AND NOT is_opponent AND roster_player_id = $1
         GROUP BY game_id
       ) go ON go.game_id = g.id
       LEFT JOIN (
         SELECT game_id, COUNT(*) AS assists
         FROM game_events
         WHERE event_type = 'goal' AND NOT is_opponent AND secondary_roster_player_id = $1
         GROUP BY game_id
       ) a ON a.game_id = g.id
       LEFT JOIN (
         SELECT game_id,
                COUNT(*) AS shots,
                SUM(CASE WHEN outcome IN ('goal', 'save') THEN 1 ELSE 0 END) AS shots_on_goal,
                SUM(CASE WHEN outcome = 'goal' THEN 1 ELSE 0 END) AS shot_goals
         FROM game_events
         WHERE event_type = 'shot' AND NOT is_opponent AND roster_player_id = $1
         GROUP BY game_id
       ) sh ON sh.game_id = g.id
       LEFT JOIN (
         SELECT game_id,
                SUM(CASE WHEN event_type = 'penalty_2' THEN 2 WHEN event_type = 'penalty_5' THEN 5 ELSE 0 END) AS penalty_minutes
         FROM game_events
         WHERE roster_player_id = $1
         GROUP BY game_id
       ) pen ON pen.game_id = g.id
       WHERE g.played_at IS NOT NULL
       ORDER BY g.played_at ASC, g.created_at ASC`,
      [req.params.id]
    );
    res.json(success(result.rows.map(toApiGameLogEntry)));
  } catch (err) {
    logger.error('[getRosterPlayerGameLog]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

function toApiTrainingLogEntry(row) {
  return {
    sessionId:     row.session_id,
    sessionName:   row.session_name,
    scheduledDate: toDateString(row.scheduled_date),
    status:        row.status,
  };
}

// GET /api/roster/:id/training-log – Trainings-für-Training-Verlauf
// (Statistik-Architektur Phase 5), analog getRosterPlayerGameLog: eine
// Zeile pro Training, in dem für den Spieler eine Anwesenheit ERFASST
// wurde (jeder Status, nicht nur "präsent") – Grundlage für Last-5/
// Last-10/Season-Beteiligungsquote im Frontend. Trainings ohne
// scheduled_date (NULL) werden ausgeschlossen: ohne Datum ist keine
// verlässliche Chronologie möglich, exakt wie played_at bei Spielen.
export async function getRosterPlayerTrainingLog(req, res) {
  try {
    const existing = await pool.query('SELECT * FROM roster_players WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0 || !(await assertResourceRead(existing.rows[0], req.user.id))) {
      return res.status(404).json(error('Kader-Spieler nicht gefunden'));
    }

    const result = await pool.query(
      `SELECT s.id AS session_id, s.name AS session_name, s.scheduled_date, ta.status
       FROM training_sessions s
       JOIN training_attendance ta ON ta.session_id = s.id AND ta.roster_player_id = $1
       WHERE s.scheduled_date IS NOT NULL
       ORDER BY s.scheduled_date ASC, s.created_at ASC`,
      [req.params.id]
    );
    res.json(success(result.rows.map(toApiTrainingLogEntry)));
  } catch (err) {
    logger.error('[getRosterPlayerTrainingLog]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// POST /api/roster
export async function createRosterPlayer(req, res) {
  try {
    const { name, jerseyNumber = null, role = null, teamId = null } = req.body;

    if (teamId && !(await assertTeamAccess(teamId, req.user.id, 'coach'))) {
      return res.status(404).json(error('Team nicht gefunden'));
    }

    const countResult = await pool.query(
      'SELECT COUNT(*)::int AS count FROM roster_players WHERE user_id = $1',
      [req.user.id]
    );
    if (countResult.rows[0].count >= MAX_ROSTER_PLAYERS) {
      return res.status(400).json(error(`Maximal ${MAX_ROSTER_PLAYERS} Kader-Spieler`));
    }

    const result = await pool.query(
      'INSERT INTO roster_players (user_id, name, jersey_number, role, team_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.user.id, name, jerseyNumber, role, teamId]
    );
    res.status(201).json(created(toApiRosterPlayer(result.rows[0])));
  } catch (err) {
    logger.error('[createRosterPlayer]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// PUT /api/roster/:id
export async function updateRosterPlayer(req, res) {
  try {
    const existing = await pool.query('SELECT * FROM roster_players WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0 || !(await assertResourceWrite(existing.rows[0], req.user.id))) {
      return res.status(404).json(error('Kader-Spieler nicht gefunden'));
    }

    const sets = [];
    const values = [];
    let i = 1;

    if (req.body.name !== undefined)         { sets.push(`name = $${i}`); values.push(req.body.name); i += 1; }
    if (req.body.jerseyNumber !== undefined)  { sets.push(`jersey_number = $${i}`); values.push(req.body.jerseyNumber); i += 1; }
    if (req.body.role !== undefined)          { sets.push(`role = $${i}`); values.push(req.body.role); i += 1; }

    if (sets.length === 0) {
      return res.status(400).json(error('Keine gültigen Felder zum Aktualisieren'));
    }

    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE roster_players SET ${sets.join(', ')}
       WHERE id = $${i}
       RETURNING *`,
      values
    );
    res.json(success(toApiRosterPlayer(result.rows[0])));
  } catch (err) {
    logger.error('[updateRosterPlayer]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// DELETE /api/roster/:id
export async function deleteRosterPlayer(req, res) {
  try {
    const existing = await pool.query('SELECT * FROM roster_players WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0 || !(await assertResourceWrite(existing.rows[0], req.user.id))) {
      return res.status(404).json(error('Kader-Spieler nicht gefunden'));
    }

    await pool.query('DELETE FROM roster_players WHERE id = $1', [req.params.id]);
    res.json(success({ message: 'Kader-Spieler gelöscht' }));
  } catch (err) {
    logger.error('[deleteRosterPlayer]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}
