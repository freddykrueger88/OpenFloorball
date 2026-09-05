/**
 * formationsController – CRUD für wiederverwendbare Formations-Vorlagen
 * (Issue #46)
 *
 * Anders als frames/lines nutzer-gebunden statt board-gebunden – eine
 * Vorlage ist über alle eigenen Boards hinweg wiederverwendbar.
 *
 * ROADMAP Phase 2: eine Vorlage kann zusätzlich einem Team zugeordnet
 * sein (team_id) und ist dann für alle Team-Mitglieder wiederverwendbar.
 */
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { success, created, error } from '../utils/apiResponse.js';
import { getUserTeamIds, assertTeamAccess } from '../utils/teamAccess.js';

const MAX_FORMATIONS = 20;

function toApiFormation(row) {
  return {
    _id:       row.id,
    name:      row.name,
    fieldType: row.field_type,
    category:  row.category ?? null,
    players:   row.players_json ?? [],
    teamId:    row.team_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function assertResourceWrite(row, userId) {
  if (!row) return false;
  if (row.user_id === userId) return true;
  if (!row.team_id) return false;
  return assertTeamAccess(row.team_id, userId, 'coach');
}

// Darf der Nutzer diese Vorlage überhaupt sehen? Wie die Sichtbarkeit von
// getFormations (jedes Team-Mitglied, nicht nur coach/owner) – für den
// Offline-Konfliktcheck (GET /:id als conflictCheckUrl) reicht Lesen.
async function assertResourceRead(row, userId) {
  if (!row) return false;
  if (row.user_id === userId) return true;
  if (!row.team_id) return false;
  return assertTeamAccess(row.team_id, userId, 'member');
}

// GET /api/formations
export async function getFormations(req, res) {
  try {
    const teamIds = await getUserTeamIds(req.user.id);
    const result = await pool.query(
      `SELECT * FROM formation_templates
       WHERE user_id = $1 OR team_id = ANY($2::uuid[])
       ORDER BY created_at DESC`,
      [req.user.id, teamIds]
    );
    res.json(success(result.rows.map(toApiFormation)));
  } catch (err) {
    logger.error('[getFormations]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// POST /api/formations
export async function createFormation(req, res) {
  try {
    const { name, fieldType = 'large', players = [], teamId = null, category = null } = req.body;

    if (teamId && !(await assertTeamAccess(teamId, req.user.id, 'coach'))) {
      return res.status(404).json(error('Team nicht gefunden'));
    }

    const countResult = await pool.query(
      'SELECT COUNT(*)::int AS count FROM formation_templates WHERE user_id = $1',
      [req.user.id]
    );
    if (countResult.rows[0].count >= MAX_FORMATIONS) {
      return res.status(400).json(error(`Maximal ${MAX_FORMATIONS} Formations-Vorlagen`));
    }

    const result = await pool.query(
      `INSERT INTO formation_templates (user_id, name, field_type, players_json, team_id, category)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)
       RETURNING *`,
      [req.user.id, name, fieldType, JSON.stringify(players), teamId, category]
    );
    res.status(201).json(created(toApiFormation(result.rows[0])));
  } catch (err) {
    logger.error('[createFormation]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// GET /api/formations/:id – dient dem Frontend als conflictCheckUrl für die
// Offline-Konfliktlösung (offlineSync.js vergleicht updatedAt).
export async function getFormation(req, res) {
  try {
    const existing = await pool.query('SELECT * FROM formation_templates WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0 || !(await assertResourceRead(existing.rows[0], req.user.id))) {
      return res.status(404).json(error('Vorlage nicht gefunden'));
    }
    res.json(success(toApiFormation(existing.rows[0])));
  } catch (err) {
    logger.error('[getFormation]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// PUT /api/formations/:id – bewusst nur Umbenennen (siehe Modul-Kommentar);
// Feldtyp/Spieler ändert man durch Anlegen einer neuen Vorlage.
export async function updateFormation(req, res) {
  try {
    const existing = await pool.query('SELECT * FROM formation_templates WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0 || !(await assertResourceWrite(existing.rows[0], req.user.id))) {
      return res.status(404).json(error('Vorlage nicht gefunden'));
    }

    if (req.body.name === undefined) {
      return res.status(400).json(error('Keine gültigen Felder zum Aktualisieren'));
    }

    const result = await pool.query(
      'UPDATE formation_templates SET name = $1 WHERE id = $2 RETURNING *',
      [req.body.name, req.params.id]
    );
    res.json(success(toApiFormation(result.rows[0])));
  } catch (err) {
    logger.error('[updateFormation]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// DELETE /api/formations/:id
export async function deleteFormation(req, res) {
  try {
    const existing = await pool.query('SELECT * FROM formation_templates WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0 || !(await assertResourceWrite(existing.rows[0], req.user.id))) {
      return res.status(404).json(error('Vorlage nicht gefunden'));
    }

    await pool.query('DELETE FROM formation_templates WHERE id = $1', [req.params.id]);
    res.json(success({ message: 'Vorlage gelöscht' }));
  } catch (err) {
    logger.error('[deleteFormation]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}
