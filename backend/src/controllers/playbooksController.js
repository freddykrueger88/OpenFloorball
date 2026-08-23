/**
 * playbooksController – CRUD für Playbooks (Board-Sammlungen, Issue #52)
 *
 * Nutzer-gebunden statt board-gebunden (analog formationsController.js).
 * Ein Board gehört zu maximal einem Playbook (boards.playbook_id,
 * ON DELETE SET NULL – Boards bleiben beim Löschen eines Playbooks
 * erhalten, nur die Zuordnung entfällt).
 *
 * ROADMAP Phase 2: ein Playbook kann zusätzlich einem Team zugeordnet
 * sein (team_id). Wichtig: das teilt nur den Playbook-NAMEN/die
 * Sammlung – die einzelnen Boards darin bleiben über board_collaborators
 * separat geschützt (Boards sind bewusst nicht Teil des Team-Konzepts).
 *
 * EPIC 011 (Vereinsebene): ein Playbook kann ALTERNATIV einem ganzen
 * Verein zugeordnet sein (organization_id) statt einem einzelnen Team –
 * für Vereine mit mehreren Sparten (z.B. 1. Herren + U15), die eine
 * gemeinsame Übungssammlung pflegen wollen. "Entweder/oder" mit team_id,
 * nie beides gleichzeitig (siehe createPlaybook). Anlegen/Ändern eines
 * vereinsweiten Playbooks bewusst auf Vereins-Admins beschränkt (analog
 * organizationsController.getSchedule) – ein team_id-Playbook bleibt
 * dagegen wie bisher jedem Team-Coach möglich.
 */
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { success, created, error } from '../utils/apiResponse.js';
import { getUserTeamIds, assertTeamAccess } from '../utils/teamAccess.js';
import { getUserReachableOrgIds, assertOrgAccess } from '../utils/organizationAccess.js';

const MAX_PLAYBOOKS = 15;

function toApiPlaybook(row) {
  return {
    _id:            row.id,
    name:           row.name,
    teamId:         row.team_id,
    organizationId: row.organization_id,
    createdAt:      row.created_at,
    updatedAt:      row.updated_at,
  };
}

async function assertResourceWrite(row, userId) {
  if (!row) return false;
  if (row.user_id === userId) return true;
  if (row.organization_id) return assertOrgAccess(row.organization_id, userId, 'admin');
  if (!row.team_id) return false;
  return assertTeamAccess(row.team_id, userId, 'coach');
}

// Darf der Nutzer dieses Playbook überhaupt sehen? Wie die Sichtbarkeit von
// getPlaybooks (jedes Team-Mitglied, nicht nur coach/owner) – für den
// Offline-Konfliktcheck (GET /:id als conflictCheckUrl) reicht Lesen.
async function assertResourceRead(row, userId) {
  if (!row) return false;
  if (row.user_id === userId) return true;
  if (row.organization_id) return (await getUserReachableOrgIds(userId)).includes(row.organization_id);
  if (!row.team_id) return false;
  return assertTeamAccess(row.team_id, userId, 'member');
}

// GET /api/playbooks
export async function getPlaybooks(req, res) {
  try {
    const [teamIds, orgIds] = await Promise.all([
      getUserTeamIds(req.user.id),
      getUserReachableOrgIds(req.user.id),
    ]);
    const result = await pool.query(
      `SELECT * FROM playbooks
       WHERE user_id = $1 OR team_id = ANY($2::uuid[]) OR organization_id = ANY($3::uuid[])
       ORDER BY created_at ASC`,
      [req.user.id, teamIds, orgIds]
    );
    res.json(success(result.rows.map(toApiPlaybook)));
  } catch (err) {
    logger.error('[getPlaybooks]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// POST /api/playbooks
export async function createPlaybook(req, res) {
  try {
    const { name, teamId = null, organizationId = null } = req.body;

    if (teamId && organizationId) {
      return res.status(400).json(error('Ein Playbook kann nicht gleichzeitig einem Team und einem Verein zugeordnet werden'));
    }
    if (teamId && !(await assertTeamAccess(teamId, req.user.id, 'coach'))) {
      return res.status(404).json(error('Team nicht gefunden'));
    }
    if (organizationId && !(await assertOrgAccess(organizationId, req.user.id, 'admin'))) {
      return res.status(404).json(error('Verein nicht gefunden'));
    }

    const countResult = await pool.query(
      'SELECT COUNT(*)::int AS count FROM playbooks WHERE user_id = $1',
      [req.user.id]
    );
    if (countResult.rows[0].count >= MAX_PLAYBOOKS) {
      return res.status(400).json(error(`Maximal ${MAX_PLAYBOOKS} Playbooks`));
    }

    const result = await pool.query(
      'INSERT INTO playbooks (user_id, name, team_id, organization_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.id, name, teamId, organizationId]
    );
    res.status(201).json(created(toApiPlaybook(result.rows[0])));
  } catch (err) {
    logger.error('[createPlaybook]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// GET /api/playbooks/:id – dient dem Frontend als conflictCheckUrl für die
// Offline-Konfliktlösung (offlineSync.js vergleicht updatedAt).
export async function getPlaybook(req, res) {
  try {
    const existing = await pool.query('SELECT * FROM playbooks WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0 || !(await assertResourceRead(existing.rows[0], req.user.id))) {
      return res.status(404).json(error('Playbook nicht gefunden'));
    }
    res.json(success(toApiPlaybook(existing.rows[0])));
  } catch (err) {
    logger.error('[getPlaybook]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// PUT /api/playbooks/:id – bewusst nur Umbenennen (siehe Modul-Kommentar).
export async function updatePlaybook(req, res) {
  try {
    const existing = await pool.query('SELECT * FROM playbooks WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0 || !(await assertResourceWrite(existing.rows[0], req.user.id))) {
      return res.status(404).json(error('Playbook nicht gefunden'));
    }

    if (req.body.name === undefined) {
      return res.status(400).json(error('Keine gültigen Felder zum Aktualisieren'));
    }

    const result = await pool.query(
      'UPDATE playbooks SET name = $1 WHERE id = $2 RETURNING *',
      [req.body.name, req.params.id]
    );
    res.json(success(toApiPlaybook(result.rows[0])));
  } catch (err) {
    logger.error('[updatePlaybook]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// DELETE /api/playbooks/:id
export async function deletePlaybook(req, res) {
  try {
    const existing = await pool.query('SELECT * FROM playbooks WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0 || !(await assertResourceWrite(existing.rows[0], req.user.id))) {
      return res.status(404).json(error('Playbook nicht gefunden'));
    }

    await pool.query('DELETE FROM playbooks WHERE id = $1', [req.params.id]);
    res.json(success({ message: 'Playbook gelöscht' }));
  } catch (err) {
    logger.error('[deletePlaybook]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}
