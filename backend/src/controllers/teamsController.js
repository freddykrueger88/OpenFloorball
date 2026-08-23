/**
 * teamsController – Teams + Mitgliederverwaltung (ROADMAP Phase 2 –
 * Team und Organisation)
 *
 * Ein Team teilt Kader/Playbooks/Trainingspläne/Formationen zwischen
 * mehreren Trainern (siehe roster/playbooks/trainingSessions/formations-
 * Controller: team_id zusätzlich zu user_id). Boards bleiben bewusst
 * außen vor – die bestehende board_collaborators-Einzel-Freigabe ist
 * granularer und unverändert.
 *
 * Mitgliederverwaltung folgt exakt dem board_collaborators-Muster:
 * Einladung per E-Mail eines bereits registrierten Nutzers (kein
 * Einladungs-Token-Flow für neue Adressen), nur `owner` verwaltet
 * Mitglieder/Rollen. Anders als bei Boards gibt es keinen impliziten
 * Owner über eine Spalte – die Rolle 'owner' in team_members trägt das.
 */
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { sendMail } from '../utils/mailer.js';
import { resolveEmailLanguage } from '../utils/emailLanguage.js';
import { getTeamRole } from '../utils/teamAccess.js';
import { assertOrgAccess } from '../utils/organizationAccess.js';
import { success, created, error } from '../utils/apiResponse.js';

function toApiTeam(row) {
  return {
    _id:            row.id,
    name:           row.name,
    // Rolle des anfragenden Nutzers in diesem Team – 'org_admin' bedeutet
    // "sieht das Team nur als Vereinsadmin, ist selbst kein Mitglied"
    // (ROADMAP Phase 2: Verein-Ebene, reine Verwaltungssicht ohne
    // Content-Zugriff auf Kader/Playbooks/etc.)
    role:           row.role,
    organizationId: row.organization_id,
    createdAt:      row.created_at,
    updatedAt:      row.updated_at,
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

async function ownerCount(teamId) {
  const result = await pool.query(
    "SELECT COUNT(*)::int AS count FROM team_members WHERE team_id = $1 AND role = 'owner'",
    [teamId]
  );
  return result.rows[0].count;
}

// GET /api/teams – eigene Mitgliedschaften PLUS Teams, bei denen der
// Nutzer Vereinsadmin ist (auch ohne eigene Team-Mitgliedschaft) – rein
// zur Verwaltungssicht, kein Content-Zugriff (siehe assertResourceWrite
// in roster/playbooks/etc., die weiterhin ausschließlich team_members
// prüfen, nicht organization_members).
export async function getTeams(req, res) {
  try {
    const result = await pool.query(
      `SELECT t.id, t.name, t.created_by, t.created_at, t.updated_at, t.organization_id, tm.role
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
       WHERE tm.user_id = $1

       UNION

       SELECT t.id, t.name, t.created_by, t.created_at, t.updated_at, t.organization_id, 'org_admin'::text AS role
       FROM teams t
       JOIN organization_members om ON om.organization_id = t.organization_id
       WHERE om.user_id = $1 AND om.role = 'admin'
         AND t.id NOT IN (SELECT team_id FROM team_members WHERE user_id = $1)

       ORDER BY created_at ASC`,
      [req.user.id]
    );
    res.json(success(result.rows.map(toApiTeam)));
  } catch (err) {
    logger.error('[getTeams]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// GET /api/teams/:id
export async function getTeam(req, res) {
  try {
    const role = await getTeamRole(req.params.id, req.user.id);
    if (!role) {
      return res.status(404).json(error('Team nicht gefunden'));
    }
    const result = await pool.query('SELECT * FROM teams WHERE id = $1', [req.params.id]);
    res.json(success(toApiTeam({ ...result.rows[0], role })));
  } catch (err) {
    logger.error('[getTeam]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// POST /api/teams – Ersteller wird atomar als 'owner' Mitglied angelegt.
// Optionales organizationId erfordert Admin-Rolle im jeweiligen Verein.
export async function createTeam(req, res) {
  const { name, organizationId = null } = req.body;
  if (organizationId && !(await assertOrgAccess(organizationId, req.user.id, 'admin'))) {
    return res.status(404).json(error('Verein nicht gefunden'));
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const teamResult = await client.query(
      'INSERT INTO teams (name, created_by, organization_id) VALUES ($1, $2, $3) RETURNING *',
      [name, req.user.id, organizationId]
    );
    const team = teamResult.rows[0];
    await client.query(
      "INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'owner')",
      [team.id, req.user.id]
    );
    await client.query('COMMIT');
    res.status(201).json(created(toApiTeam({ ...team, role: 'owner' })));
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('[createTeam]', err);
    res.status(500).json(error('Interner Serverfehler'));
  } finally {
    client.release();
  }
}

// PUT /api/teams/:id – umbenennen, owner-only
export async function updateTeam(req, res) {
  try {
    const role = await getTeamRole(req.params.id, req.user.id);
    if (role !== 'owner') {
      return res.status(404).json(error('Team nicht gefunden'));
    }
    const result = await pool.query(
      'UPDATE teams SET name = $1 WHERE id = $2 RETURNING *',
      [req.body.name, req.params.id]
    );
    res.json(success(toApiTeam({ ...result.rows[0], role })));
  } catch (err) {
    logger.error('[updateTeam]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// DELETE /api/teams/:id – owner-only. team_id-Referenzen auf Kader/
// Playbooks/Trainingspläne/Formationen fallen per ON DELETE SET NULL
// zurück auf rein persönlich – kein Datenverlust.
export async function deleteTeam(req, res) {
  try {
    const role = await getTeamRole(req.params.id, req.user.id);
    if (role !== 'owner') {
      return res.status(404).json(error('Team nicht gefunden'));
    }
    await pool.query('DELETE FROM teams WHERE id = $1', [req.params.id]);
    res.json(success({ message: 'Team gelöscht' }));
  } catch (err) {
    logger.error('[deleteTeam]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// GET /api/teams/:id/members – jedes Mitglied darf die Liste sehen
export async function getMembers(req, res) {
  try {
    const role = await getTeamRole(req.params.id, req.user.id);
    if (!role) {
      return res.status(404).json(error('Team nicht gefunden'));
    }
    const result = await pool.query(
      `SELECT tm.*, u.email FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1
       ORDER BY tm.created_at ASC`,
      [req.params.id]
    );
    res.json(success(result.rows.map(toApiMember)));
  } catch (err) {
    logger.error('[getMembers]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// POST /api/teams/:id/members – owner-only, Einladung per bereits
// existierender E-Mail (analog zu boardCollaboratorsController.addCollaborator)
export async function inviteMember(req, res) {
  try {
    const requesterRole = await getTeamRole(req.params.id, req.user.id);
    if (requesterRole !== 'owner') {
      return res.status(404).json(error('Team nicht gefunden'));
    }

    const teamResult = await pool.query('SELECT name FROM teams WHERE id = $1', [req.params.id]);
    const team = teamResult.rows[0];

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
      return res.status(400).json(error('Du bist bereits Mitglied dieses Teams'));
    }

    const existing = await pool.query(
      'SELECT id FROM team_members WHERE team_id = $1 AND user_id = $2',
      [req.params.id, targetUser.id]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json(error('Dieser Nutzer ist bereits Team-Mitglied'));
    }

    const result = await pool.query(
      'INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3) RETURNING *',
      [req.params.id, targetUser.id, role]
    );

    const appUrl = (process.env.CORS_ORIGIN || '').replace(/\/$/, '');
    const INVITE_EMAIL_TEXT = {
      de: {
        subject: `OpenFloorball: Einladung zum Team "${team.name}"`,
        text: `Du wurdest zum Team "${team.name}" hinzugefügt.\n\n${appUrl ? `${appUrl}/settings` : 'Öffne die OpenFloorball-App'}, um es zu sehen.`,
      },
      en: {
        subject: `OpenFloorball: Invitation to team "${team.name}"`,
        text: `You've been added to the team "${team.name}".\n\n${appUrl ? `${appUrl}/settings` : 'Open the OpenFloorball app'} to see it.`,
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

// PUT /api/teams/:id/members/:memberId – Rolle ändern, owner-only.
// Letzter owner kann nicht degradiert werden (Team bräuchte sonst
// niemanden mehr, der Mitglieder verwalten kann).
export async function updateMemberRole(req, res) {
  try {
    const requesterRole = await getTeamRole(req.params.id, req.user.id);
    if (requesterRole !== 'owner') {
      return res.status(404).json(error('Team nicht gefunden'));
    }

    const target = await pool.query(
      'SELECT role FROM team_members WHERE id = $1 AND team_id = $2',
      [req.params.memberId, req.params.id]
    );
    if (target.rows.length === 0) {
      return res.status(404).json(error('Mitglied nicht gefunden'));
    }
    if (target.rows[0].role === 'owner' && req.body.role !== 'owner' && (await ownerCount(req.params.id)) <= 1) {
      return res.status(400).json(error('Letzter Owner kann nicht degradiert werden'));
    }

    const result = await pool.query(
      'UPDATE team_members SET role = $1 WHERE id = $2 AND team_id = $3 RETURNING *',
      [req.body.role, req.params.memberId, req.params.id]
    );
    const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [result.rows[0].user_id]);
    res.json(success(toApiMember({ ...result.rows[0], email: userResult.rows[0]?.email })));
  } catch (err) {
    logger.error('[updateMemberRole]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// DELETE /api/teams/:id/members/:memberId – owner-only ODER
// Selbst-Entfernung (Team verlassen). Letzter owner kann sich nicht
// selbst entfernen (siehe updateMemberRole-Begründung).
export async function removeMember(req, res) {
  try {
    const requesterRole = await getTeamRole(req.params.id, req.user.id);
    if (!requesterRole) {
      return res.status(404).json(error('Team nicht gefunden'));
    }

    const target = await pool.query(
      'SELECT user_id, role FROM team_members WHERE id = $1 AND team_id = $2',
      [req.params.memberId, req.params.id]
    );
    if (target.rows.length === 0) {
      return res.status(404).json(error('Mitglied nicht gefunden'));
    }
    const isSelf = target.rows[0].user_id === req.user.id;
    if (requesterRole !== 'owner' && !isSelf) {
      return res.status(404).json(error('Team nicht gefunden'));
    }
    if (target.rows[0].role === 'owner' && (await ownerCount(req.params.id)) <= 1) {
      return res.status(400).json(error('Letzter Owner kann das Team nicht verlassen – Team stattdessen löschen'));
    }

    await pool.query('DELETE FROM team_members WHERE id = $1 AND team_id = $2', [req.params.memberId, req.params.id]);
    res.json(success({ message: 'Mitglied entfernt' }));
  } catch (err) {
    logger.error('[removeMember]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}
