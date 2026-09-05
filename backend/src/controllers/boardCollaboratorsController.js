/**
 * boardCollaboratorsController – Board-Sharing (Issue #51 MVP) + E-Mail-
 * Einladungsflow für noch nicht registrierte Adressen (ROADMAP-Backlog)
 *
 * Alle Routen sind strikt Owner-only (nicht über assertBoardAccess, das
 * würde auch write-Kollaboratoren durchlassen – Kollaborator-Verwaltung
 * ist bewusst strenger als normales "write"). Ein Kollaborator mit
 * bereits existierendem Account wird direkt hinzugefügt; eine noch nicht
 * registrierte E-Mail-Adresse bekommt stattdessen eine board_invites-
 * Zeile + Einladungsmail mit Link (siehe inviteController.js) – wird
 * automatisch zu einem echten Kollaborator, sobald sich diese Adresse
 * registriert (siehe routes/auth.js). GET/PUT/DELETE geben/ändern/
 * entfernen daher transparent sowohl echte Kollaboratoren als auch
 * offene Einladungen (unterschieden über `status` in der API-Antwort).
 * Ist SMTP konfiguriert (siehe utils/mailer.js), bekommt der
 * hinzugefügte Nutzer bzw. die eingeladene Adresse eine Mail; ohne
 * SMTP-Konfiguration passiert einfach nichts, die Verwaltung selbst
 * funktioniert unabhängig davon immer.
 */
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { logAudit } from '../services/auditLogger.js';
import { sendMail } from '../utils/mailer.js';
import { resolveEmailLanguage } from '../utils/emailLanguage.js';
import { success, created, error } from '../utils/apiResponse.js';

const MAX_COLLABORATORS_PER_BOARD = 10;
const INVITE_EXPIRES_HOURS = parseInt(process.env.INVITE_EXPIRES_HOURS || '168', 10); // 7 Tage
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1h

function toApiCollaborator(row) {
  return {
    _id:        row.id,
    userId:     row.user_id,
    email:      row.email,
    permission: row.permission,
    status:     'active',
    createdAt:  row.created_at,
  };
}

function toApiInvite(row) {
  return {
    _id:        row.id,
    userId:     null,
    email:      row.email,
    permission: row.permission,
    status:     'invited',
    expiresAt:  row.expires_at,
    createdAt:  row.created_at,
  };
}

// Abgelaufene/bereits akzeptierte Einladungen regelmäßig aufräumen –
// reine Tabellenhygiene, alle Queries filtern ohnehin schon auf
// accepted_at IS NULL AND expires_at > NOW() (analog cleanupExpiredShareLinks
// in shareController.js).
async function cleanupExpiredInvites() {
  try {
    const result = await pool.query(
      `DELETE FROM board_invites WHERE accepted_at IS NOT NULL OR expires_at < NOW()`
    );
    if (result.rowCount > 0) {
      logger.info(`Invite cleanup: ${result.rowCount} abgelaufene/akzeptierte Einladungen gelöscht`);
    }
  } catch (err) {
    logger.warn('Invite cleanup error:', err.message);
  }
}
setInterval(cleanupExpiredInvites, CLEANUP_INTERVAL_MS);

// Gibt das Board (mit Name, für die Einladungs-Mail) statt nur eines
// Booleans zurück – bleibt an allen bisherigen `if (!(await
// assertBoardOwner(...)))`-Aufrufstellen kompatibel (null ist falsy).
async function assertBoardOwner(boardId, userId) {
  const result = await pool.query(
    'SELECT id, name FROM boards WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
    [boardId, userId]
  );
  return result.rows[0] ?? null;
}

// GET /api/boards/:id/collaborators
export async function getCollaborators(req, res) {
  try {
    if (!(await assertBoardOwner(req.params.id, req.user.id))) {
      return res.status(404).json(error('Board nicht gefunden'));
    }
    const [collabResult, inviteResult] = await Promise.all([
      pool.query(
        `SELECT bc.*, u.email FROM board_collaborators bc
         JOIN users u ON u.id = bc.user_id
         WHERE bc.board_id = $1`,
        [req.params.id]
      ),
      pool.query(
        `SELECT * FROM board_invites
         WHERE board_id = $1 AND accepted_at IS NULL AND expires_at > NOW()`,
        [req.params.id]
      ),
    ]);
    const rows = [
      ...collabResult.rows.map(toApiCollaborator),
      ...inviteResult.rows.map(toApiInvite),
    ].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    res.json(success(rows));
  } catch (err) {
    logger.error('[getCollaborators]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// POST /api/boards/:id/collaborators
export async function addCollaborator(req, res) {
  try {
    const board = await assertBoardOwner(req.params.id, req.user.id);
    if (!board) {
      return res.status(404).json(error('Board nicht gefunden'));
    }

    const countResult = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM board_collaborators WHERE board_id = $1) +
         (SELECT COUNT(*)::int FROM board_invites WHERE board_id = $1 AND accepted_at IS NULL AND expires_at > NOW())
         AS count`,
      [req.params.id]
    );
    if (countResult.rows[0].count >= MAX_COLLABORATORS_PER_BOARD) {
      return res.status(400).json(error(`Maximal ${MAX_COLLABORATORS_PER_BOARD} Kollaboratoren pro Board`));
    }

    const email = req.body.email.trim().toLowerCase();
    const { permission = 'read' } = req.body;
    const userResult = await pool.query(
      `SELECT u.id, u.email, s.preferences_json->>'language' AS language
       FROM users u
       LEFT JOIN settings s ON s.user_id = u.id
       WHERE u.email = $1`,
      [email]
    );
    if (userResult.rows.length === 0) {
      const inviteResult = await pool.query(
        `INSERT INTO board_invites (board_id, email, permission, invited_by, expires_at)
         VALUES ($1, $2, $3, $4, NOW() + ($5 || ' hours')::interval)
         ON CONFLICT (board_id, email) DO UPDATE SET
           permission  = EXCLUDED.permission,
           token       = uuid_generate_v4(),
           expires_at  = EXCLUDED.expires_at,
           accepted_at = NULL,
           invited_by  = EXCLUDED.invited_by
         RETURNING *`,
        [req.params.id, email, permission, req.user.id, INVITE_EXPIRES_HOURS]
      );
      const invite = inviteResult.rows[0];

      const appUrl = (process.env.CORS_ORIGIN || '').replace(/\/$/, '');
      // Empfänger hat noch keinen Account -> keine gespeicherte
      // Sprachpräferenz bekannt, resolveEmailLanguage(undefined) fällt
      // auf 'de' zurück (Projekt-Default, siehe frontend/src/i18n/i18n.js).
      const INVITE_NO_ACCOUNT_TEXT = {
        de: {
          subject: `OpenFloorball: Einladung zum Board "${board.name}"`,
          text: `Du wurdest eingeladen, am Board "${board.name}" mitzuarbeiten (${permission === 'write' ? 'Bearbeiten' : 'Lesen'}).\n\nDu hast noch keinen OpenFloorball-Account. Registriere dich mit dieser E-Mail-Adresse (${email}), um automatisch Zugriff zu erhalten:\n\n${appUrl}/invite/${invite.token}`,
        },
        en: {
          subject: `OpenFloorball: Invitation to board "${board.name}"`,
          text: `You've been invited to collaborate on the board "${board.name}" (${permission === 'write' ? 'edit' : 'read'} access).\n\nYou don't have an OpenFloorball account yet. Register with this email address (${email}) to get access automatically:\n\n${appUrl}/invite/${invite.token}`,
        },
      };
      sendMail({
        to: email,
        ...INVITE_NO_ACCOUNT_TEXT[resolveEmailLanguage(undefined)],
      });

      return res.status(201).json(created(toApiInvite(invite)));
    }
    const targetUser = userResult.rows[0];

    if (targetUser.id === req.user.id) {
      return res.status(400).json(error('Du kannst dich nicht selbst als Kollaborator hinzufügen'));
    }

    const existing = await pool.query(
      'SELECT id FROM board_collaborators WHERE board_id = $1 AND user_id = $2',
      [req.params.id, targetUser.id]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json(error('Dieser Nutzer ist bereits Kollaborator'));
    }

    const result = await pool.query(
      'INSERT INTO board_collaborators (board_id, user_id, permission) VALUES ($1, $2, $3) RETURNING *',
      [req.params.id, targetUser.id, permission]
    );

    const appUrl = (process.env.CORS_ORIGIN || '').replace(/\/$/, '');
    const ACCESS_EMAIL_TEXT = {
      de: {
        subject: `OpenFloorball: Zugriff auf Board "${board.name}"`,
        text: `Du wurdest als Kollaborator (${permission === 'write' ? 'Bearbeiten' : 'Lesen'}) zum Board "${board.name}" hinzugefügt.\n\n${appUrl ? `${appUrl}/boards` : 'Öffne die OpenFloorball-App'}, um es zu sehen.`,
      },
      en: {
        subject: `OpenFloorball: Access to board "${board.name}"`,
        text: `You've been added as a collaborator (${permission === 'write' ? 'edit' : 'read'} access) to the board "${board.name}".\n\n${appUrl ? `${appUrl}/boards` : 'Open the OpenFloorball app'} to see it.`,
      },
    };
    sendMail({
      to: targetUser.email,
      ...ACCESS_EMAIL_TEXT[resolveEmailLanguage(targetUser.language)],
    });

    res.status(201).json(created(toApiCollaborator({ ...result.rows[0], email: targetUser.email })));
  } catch (err) {
    logger.error('[addCollaborator]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// PUT /api/boards/:id/collaborators/:collaboratorId
export async function updateCollaborator(req, res) {
  try {
    if (!(await assertBoardOwner(req.params.id, req.user.id))) {
      return res.status(404).json(error('Board nicht gefunden'));
    }

    const { permission } = req.body;
    const result = await pool.query(
      `UPDATE board_collaborators SET permission = $1
       WHERE id = $2 AND board_id = $3
       RETURNING *`,
      [permission, req.params.collaboratorId, req.params.id]
    );
    if (result.rows.length > 0) {
      const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [result.rows[0].user_id]);
      await logAudit({
        actorId: req.user.id,
        action: 'board.collaborator.permission.update',
        resourceType: 'board',
        resourceId: req.params.id,
        metadata: { collaboratorId: req.params.collaboratorId, permission },
        after: { permission },
      });
      return res.json(success(toApiCollaborator({ ...result.rows[0], email: userResult.rows[0]?.email })));
    }

    // Keine aktive Kollaboration mit dieser ID – evtl. eine offene Einladung
    const inviteResult = await pool.query(
      `UPDATE board_invites SET permission = $1
       WHERE id = $2 AND board_id = $3 AND accepted_at IS NULL
       RETURNING *`,
      [permission, req.params.collaboratorId, req.params.id]
    );
    if (inviteResult.rows.length === 0) {
      return res.status(404).json(error('Kollaborator nicht gefunden'));
    }
    await logAudit({
      actorId: req.user.id,
      action: 'board.collaborator.invite.update',
      resourceType: 'board',
      resourceId: req.params.id,
      metadata: { inviteId: req.params.collaboratorId, permission },
      after: { permission },
    });
    res.json(success(toApiInvite(inviteResult.rows[0])));
  } catch (err) {
    logger.error('[updateCollaborator]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// DELETE /api/boards/:id/collaborators/:collaboratorId
export async function removeCollaborator(req, res) {
  try {
    if (!(await assertBoardOwner(req.params.id, req.user.id))) {
      return res.status(404).json(error('Board nicht gefunden'));
    }

    const result = await pool.query(
      'DELETE FROM board_collaborators WHERE id = $1 AND board_id = $2 RETURNING id',
      [req.params.collaboratorId, req.params.id]
    );
    if (result.rows.length > 0) {
      await logAudit({
        actorId: req.user.id,
        action: 'board.collaborator.remove',
        resourceType: 'board',
        resourceId: req.params.id,
        metadata: { collaboratorId: req.params.collaboratorId },
      });
      return res.json(success({ message: 'Kollaborator entfernt' }));
    }

    const inviteResult = await pool.query(
      'DELETE FROM board_invites WHERE id = $1 AND board_id = $2 AND accepted_at IS NULL RETURNING id',
      [req.params.collaboratorId, req.params.id]
    );
    if (inviteResult.rows.length === 0) {
      return res.status(404).json(error('Kollaborator nicht gefunden'));
    }
    await logAudit({
      actorId: req.user.id,
      action: 'board.collaborator.invite.revoke',
      resourceType: 'board',
      resourceId: req.params.id,
      metadata: { inviteId: req.params.collaboratorId },
    });
    res.json(success({ message: 'Einladung zurückgezogen' }));
  } catch (err) {
    logger.error('[removeCollaborator]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}
