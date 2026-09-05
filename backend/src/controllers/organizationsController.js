/**
 * organizationsController – Vereins-Ebene (ROADMAP Phase 2 – Team und
 * Organisation), reine Verwaltungsebene über mehreren Teams. Bündelt
 * Teams organisatorisch, teilt aber selbst KEINE Inhalte – Kader/
 * Playbooks/Trainingspläne/Formationen bleiben team_id-gebunden wie
 * bereits gebaut.
 *
 * Struktur bewusst identisch zu teamsController.js (dort ausführlicher
 * kommentiert), nur mit 2 statt 3 Rollen.
 */
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { sendMail } from '../utils/mailer.js';
import { resolveEmailLanguage } from '../utils/emailLanguage.js';
import { getOrgRole } from '../utils/organizationAccess.js';
import { logAudit } from '../services/auditLogger.js';
import { success, created, error } from '../utils/apiResponse.js';

function toApiOrg(row) {
  return {
    _id:       row.id,
    name:      row.name,
    role:      row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toApiMember(row) {
  return {
    _id:       row.id,
    userId:    row.user_id,
    email:     row.email,
    role:      row.role,
    createdAt: row.created_at,
  };
}

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

function toApiCoachEntry(row) {
  return {
    teamId:   row.team_id,
    teamName: row.team_name,
    userId:   row.user_id,
    email:    row.email,
    role:     row.role,
  };
}

function toApiScheduleItem(row) {
  return {
    _id:      row.id,
    type:     row.type,
    title:    row.title,
    date:     toDateString(row.date),
    teamId:   row.team_id,
    teamName: row.team_name,
  };
}

async function adminCount(organizationId) {
  const result = await pool.query(
    "SELECT COUNT(*)::int AS count FROM organization_members WHERE organization_id = $1 AND role = 'admin'",
    [organizationId]
  );
  return result.rows[0].count;
}

// GET /api/organizations
export async function getOrganizations(req, res) {
  try {
    const result = await pool.query(
      `SELECT o.*, om.role FROM organizations o
       JOIN organization_members om ON om.organization_id = o.id
       WHERE om.user_id = $1
       ORDER BY o.created_at ASC`,
      [req.user.id]
    );
    res.json(success(result.rows.map(toApiOrg)));
  } catch (err) {
    logger.error('[getOrganizations]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// GET /api/organizations/:id
export async function getOrganization(req, res) {
  try {
    const role = await getOrgRole(req.params.id, req.user.id);
    if (!role) {
      return res.status(404).json(error('Verein nicht gefunden'));
    }
    const result = await pool.query('SELECT * FROM organizations WHERE id = $1', [req.params.id]);
    res.json(success(toApiOrg({ ...result.rows[0], role })));
  } catch (err) {
    logger.error('[getOrganization]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// POST /api/organizations – Ersteller wird atomar als 'admin' Mitglied angelegt
export async function createOrganization(req, res) {
  const { name } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orgResult = await client.query(
      'INSERT INTO organizations (name, created_by) VALUES ($1, $2) RETURNING *',
      [name, req.user.id]
    );
    const org = orgResult.rows[0];
    await client.query(
      "INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, 'admin')",
      [org.id, req.user.id]
    );
    await client.query('COMMIT');
    res.status(201).json(created(toApiOrg({ ...org, role: 'admin' })));
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('[createOrganization]', err);
    res.status(500).json(error('Interner Serverfehler'));
  } finally {
    client.release();
  }
}

// PUT /api/organizations/:id – umbenennen, admin-only
export async function updateOrganization(req, res) {
  try {
    const role = await getOrgRole(req.params.id, req.user.id);
    if (role !== 'admin') {
      return res.status(404).json(error('Verein nicht gefunden'));
    }
    const result = await pool.query('UPDATE organizations SET name = $1 WHERE id = $2 RETURNING *', [req.body.name, req.params.id]);
    res.json(success(toApiOrg({ ...result.rows[0], role })));
  } catch (err) {
    logger.error('[updateOrganization]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// DELETE /api/organizations/:id – admin-only. teams.organization_id
// fällt per ON DELETE SET NULL zurück – Teams bleiben erhalten, nur die
// Vereinszuordnung entfällt.
export async function deleteOrganization(req, res) {
  try {
    const role = await getOrgRole(req.params.id, req.user.id);
    if (role !== 'admin') {
      return res.status(404).json(error('Verein nicht gefunden'));
    }
    await pool.query('DELETE FROM organizations WHERE id = $1', [req.params.id]);
    res.json(success({ message: 'Verein gelöscht' }));
  } catch (err) {
    logger.error('[deleteOrganization]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// GET /api/organizations/:id/members
export async function getMembers(req, res) {
  try {
    const role = await getOrgRole(req.params.id, req.user.id);
    if (!role) {
      return res.status(404).json(error('Verein nicht gefunden'));
    }
    const result = await pool.query(
      `SELECT om.*, u.email FROM organization_members om
       JOIN users u ON u.id = om.user_id
       WHERE om.organization_id = $1
       ORDER BY om.created_at ASC`,
      [req.params.id]
    );
    res.json(success(result.rows.map(toApiMember)));
  } catch (err) {
    logger.error('[getMembers]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// POST /api/organizations/:id/members – admin-only, Einladung per
// bereits existierender E-Mail (analog teamsController.inviteMember)
export async function inviteMember(req, res) {
  try {
    const requesterRole = await getOrgRole(req.params.id, req.user.id);
    if (requesterRole !== 'admin') {
      return res.status(404).json(error('Verein nicht gefunden'));
    }

    const orgResult = await pool.query('SELECT name FROM organizations WHERE id = $1', [req.params.id]);
    const org = orgResult.rows[0];

    const { email, role = 'member' } = req.body;
    const userResult = await pool.query(
      `SELECT u.id, u.email, s.preferences_json->>'language' AS language
       FROM users u
       LEFT JOIN settings s ON s.user_id = u.id
       WHERE u.email = $1`,
      [email.trim().toLowerCase()]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json(error('Kein Nutzer mit dieser E-Mail-Adresse gefunden'));
    }
    const targetUser = userResult.rows[0];

    if (targetUser.id === req.user.id) {
      return res.status(400).json(error('Du bist bereits Mitglied dieses Vereins'));
    }

    const existing = await pool.query(
      'SELECT id FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [req.params.id, targetUser.id]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json(error('Dieser Nutzer ist bereits Vereinsmitglied'));
    }

    const result = await pool.query(
      'INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, $3) RETURNING *',
      [req.params.id, targetUser.id, role]
    );

    const appUrl = (process.env.CORS_ORIGIN || '').replace(/\/$/, '');
    const INVITE_EMAIL_TEXT = {
      de: {
        subject: `OpenFloorball: Einladung zum Verein "${org.name}"`,
        text: `Du wurdest zum Verein "${org.name}" hinzugefügt.\n\n${appUrl ? `${appUrl}/settings` : 'Öffne die OpenFloorball-App'}, um es zu sehen.`,
      },
      en: {
        subject: `OpenFloorball: Invitation to organization "${org.name}"`,
        text: `You've been added to the organization "${org.name}".\n\n${appUrl ? `${appUrl}/settings` : 'Open the OpenFloorball app'} to see it.`,
      },
    };
    sendMail({
      to: targetUser.email,
      ...INVITE_EMAIL_TEXT[resolveEmailLanguage(targetUser.language)],
    });

    res.status(201).json(created(toApiMember({ ...result.rows[0], email: targetUser.email })));
  } catch (err) {
    logger.error('[inviteMember]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// PUT /api/organizations/:id/members/:memberId – Rolle ändern, admin-only.
// Letzter Admin kann nicht degradiert werden.
export async function updateMemberRole(req, res) {
  try {
    const requesterRole = await getOrgRole(req.params.id, req.user.id);
    if (requesterRole !== 'admin') {
      return res.status(404).json(error('Verein nicht gefunden'));
    }

    const target = await pool.query(
      'SELECT role FROM organization_members WHERE id = $1 AND organization_id = $2',
      [req.params.memberId, req.params.id]
    );
    if (target.rows.length === 0) {
      return res.status(404).json(error('Mitglied nicht gefunden'));
    }
    if (target.rows[0].role === 'admin' && req.body.role !== 'admin' && (await adminCount(req.params.id)) <= 1) {
      return res.status(400).json(error('Letzter Admin kann nicht degradiert werden'));
    }

    const result = await pool.query(
      'UPDATE organization_members SET role = $1 WHERE id = $2 AND organization_id = $3 RETURNING *',
      [req.body.role, req.params.memberId, req.params.id]
    );
    const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [result.rows[0].user_id]);
    await logAudit({
      actorId: req.user.id,
      action: 'organization.member.role.update',
      resourceType: 'organization',
      resourceId: req.params.id,
      metadata: { memberId: req.params.memberId, memberUserId: result.rows[0].user_id },
      before: { role: target.rows[0].role },
      after: { role: result.rows[0].role },
    });
    res.json(success(toApiMember({ ...result.rows[0], email: userResult.rows[0]?.email })));
  } catch (err) {
    logger.error('[updateMemberRole]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// DELETE /api/organizations/:id/members/:memberId – admin-only ODER
// Selbst-Entfernung (Verein verlassen). Letzter Admin kann sich nicht
// selbst entfernen.
export async function removeMember(req, res) {
  try {
    const requesterRole = await getOrgRole(req.params.id, req.user.id);
    if (!requesterRole) {
      return res.status(404).json(error('Verein nicht gefunden'));
    }

    const target = await pool.query(
      'SELECT user_id, role FROM organization_members WHERE id = $1 AND organization_id = $2',
      [req.params.memberId, req.params.id]
    );
    if (target.rows.length === 0) {
      return res.status(404).json(error('Mitglied nicht gefunden'));
    }
    const isSelf = target.rows[0].user_id === req.user.id;
    if (requesterRole !== 'admin' && !isSelf) {
      return res.status(404).json(error('Verein nicht gefunden'));
    }
    if (target.rows[0].role === 'admin' && (await adminCount(req.params.id)) <= 1) {
      return res.status(400).json(error('Letzter Admin kann den Verein nicht verlassen – Verein stattdessen löschen'));
    }

    await pool.query('DELETE FROM organization_members WHERE id = $1 AND organization_id = $2', [req.params.memberId, req.params.id]);
    await logAudit({
      actorId: req.user.id,
      action: 'organization.member.remove',
      resourceType: 'organization',
      resourceId: req.params.id,
      metadata: { memberId: req.params.memberId, memberUserId: target.rows[0].user_id, removedRole: target.rows[0].role },
    });
    res.json(success({ message: 'Mitglied entfernt' }));
  } catch (err) {
    logger.error('[removeMember]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// GET /api/organizations/:id/schedule – Vereinsweite Übersicht aller
// anstehenden Spiele+Trainings über alle Teams des Vereins hinweg,
// nur Lesen (EPIC 011 "Vereinsebene als Koordinationsschicht").
// Admin-only: reine Koordinationsschicht, kein neuer Bearbeitungsweg
// an fremden Teams.
export async function getSchedule(req, res) {
  try {
    const role = await getOrgRole(req.params.id, req.user.id);
    if (role !== 'admin') {
      return res.status(404).json(error('Verein nicht gefunden'));
    }
    const result = await pool.query(
      `WITH org_teams AS (
         SELECT id, name FROM teams WHERE organization_id = $1
       )
       SELECT 'game' AS type, g.id, g.opponent AS title, g.played_at AS date, g.team_id, ot.name AS team_name
       FROM games g JOIN org_teams ot ON ot.id = g.team_id
       WHERE g.played_at >= CURRENT_DATE
       UNION ALL
       SELECT 'training' AS type, s.id, s.name AS title, s.scheduled_date AS date, s.team_id, ot.name AS team_name
       FROM training_sessions s JOIN org_teams ot ON ot.id = s.team_id
       WHERE s.scheduled_date >= CURRENT_DATE
       ORDER BY date ASC`,
      [req.params.id]
    );
    res.json(success(result.rows.map(toApiScheduleItem)));
  } catch (err) {
    logger.error('[getSchedule]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// GET /api/organizations/:id/coaches – "Wer ist wo Trainer" (EPIC 011
// "Vereinsebene als Koordinationsschicht", offener Punkt aus der
// Ausgangslage). Admin-only, rein lesend, wie getSchedule – zeigt für
// jedes Team des Vereins dessen owner/coach-Mitglieder (nicht 'member',
// das wäre reine Spieler-/Zuschauerrolle und für die Koordinationsfrage
// "wer trainiert wo" nicht relevant). Kein neuer Bearbeitungsweg an
// fremden Teams – identisch zum bereits akzeptierten Muster von
// getSchedule.
export async function getCoaches(req, res) {
  try {
    const role = await getOrgRole(req.params.id, req.user.id);
    if (role !== 'admin') {
      return res.status(404).json(error('Verein nicht gefunden'));
    }
    const result = await pool.query(
      `SELECT t.id AS team_id, t.name AS team_name, tm.user_id, tm.role, u.email
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
       JOIN users u ON u.id = tm.user_id
       WHERE t.organization_id = $1 AND tm.role IN ('owner', 'coach')
       ORDER BY t.name ASC, tm.role ASC, u.email ASC`,
      [req.params.id]
    );
    res.json(success(result.rows.map(toApiCoachEntry)));
  } catch (err) {
    logger.error('[getCoaches]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}
