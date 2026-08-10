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

function toApiRosterStats(row) {
  return {
    ...toApiRosterPlayer(row),
    goals:          Number(row.goals ?? 0),
    penaltyMinutes: Number(row.penalty_minutes ?? 0),
    matchPenalties: Number(row.match_penalties ?? 0),
    appearances:    Number(row.appearances ?? 0),
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
export async function getRosterStats(req, res) {
  try {
    const teamIds = await getUserTeamIds(req.user.id);
    const result = await pool.query(
      `SELECT rp.*,
              COALESCE(g.goals, 0)::int           AS goals,
              COALESCE(g.penalty_minutes, 0)::int AS penalty_minutes,
              COALESCE(g.match_penalties, 0)::int AS match_penalties,
              COALESCE(s.appearances, 0)::int      AS appearances
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
         SELECT roster_player_id, COUNT(*) AS appearances
         FROM game_squad
         WHERE status = 'playing'
         GROUP BY roster_player_id
       ) s ON s.roster_player_id = rp.id
       WHERE rp.user_id = $1 OR rp.team_id = ANY($2::uuid[])
       ORDER BY goals DESC, rp.jersey_number ASC NULLS LAST, rp.name ASC`,
      [req.user.id, teamIds]
    );
    res.json(success(result.rows.map(toApiRosterStats)));
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
