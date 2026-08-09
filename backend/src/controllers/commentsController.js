/**
 * commentsController – Kommentare auf Boards und Trainingseinheiten
 * (ROADMAP Phase 2 – Team und Organisation).
 *
 * Eine gemeinsame `comments`-Tabelle mit resource_type als
 * Diskriminator statt zweier getrennter Tabellen. makeCommentHandlers()
 * ist eine Factory, die von den beiden Routen-Mountpunkten
 * (routes/comments.js, einmal für Boards, einmal für Trainingseinheiten)
 * mit der jeweils passenden Zugriffsprüfung aufgerufen wird –
 * assertBoardAccess für Boards, assertSessionRead/-Write für
 * Trainingseinheiten. Lesen und Schreiben eines Kommentars braucht nur
 * Lesezugriff auf die Ressource selbst.
 */
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { success, created, error } from '../utils/apiResponse.js';

const MAX_COMMENTS_PER_RESOURCE = 500;

function toApiComment(row) {
  return {
    _id:       row.id,
    userId:    row.user_id,
    email:     row.email,
    text:      row.text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function makeCommentHandlers(resourceType, { assertRead, assertWrite }) {
  async function getComments(req, res) {
    try {
      const resourceId = req.params.id;
      if (!(await assertRead(resourceId, req.user.id))) {
        return res.status(404).json(error('Nicht gefunden'));
      }
      const result = await pool.query(
        `SELECT c.*, u.email FROM comments c
         JOIN users u ON u.id = c.user_id
         WHERE c.resource_type = $1 AND c.resource_id = $2
         ORDER BY c.created_at ASC`,
        [resourceType, resourceId]
      );
      res.json(success(result.rows.map(toApiComment)));
    } catch (err) {
      logger.error('[getComments]', err);
      res.status(500).json(error('Interner Serverfehler'));
    }
  }

  async function addComment(req, res) {
    try {
      const resourceId = req.params.id;
      if (!(await assertRead(resourceId, req.user.id))) {
        return res.status(404).json(error('Nicht gefunden'));
      }

      const countResult = await pool.query(
        'SELECT COUNT(*)::int AS count FROM comments WHERE resource_type = $1 AND resource_id = $2',
        [resourceType, resourceId]
      );
      if (countResult.rows[0].count >= MAX_COMMENTS_PER_RESOURCE) {
        return res.status(400).json(error(`Maximal ${MAX_COMMENTS_PER_RESOURCE} Kommentare`));
      }

      const { text } = req.body;
      const result = await pool.query(
        'INSERT INTO comments (resource_type, resource_id, user_id, text) VALUES ($1, $2, $3, $4) RETURNING *',
        [resourceType, resourceId, req.user.id, text]
      );
      const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [req.user.id]);
      res.status(201).json(created(toApiComment({ ...result.rows[0], email: userResult.rows[0]?.email })));
    } catch (err) {
      logger.error('[addComment]', err);
      res.status(500).json(error('Interner Serverfehler'));
    }
  }

  async function updateComment(req, res) {
    try {
      const resourceId = req.params.id;
      const existing = await pool.query(
        'SELECT * FROM comments WHERE id = $1 AND resource_type = $2 AND resource_id = $3',
        [req.params.commentId, resourceType, resourceId]
      );
      if (existing.rows.length === 0) {
        return res.status(404).json(error('Kommentar nicht gefunden'));
      }
      if (existing.rows[0].user_id !== req.user.id) {
        return res.status(403).json(error('Nur der Autor kann diesen Kommentar bearbeiten'));
      }

      const { text } = req.body;
      const result = await pool.query('UPDATE comments SET text = $1 WHERE id = $2 RETURNING *', [text, req.params.commentId]);
      const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [req.user.id]);
      res.json(success(toApiComment({ ...result.rows[0], email: userResult.rows[0]?.email })));
    } catch (err) {
      logger.error('[updateComment]', err);
      res.status(500).json(error('Interner Serverfehler'));
    }
  }

  async function deleteComment(req, res) {
    try {
      const resourceId = req.params.id;
      const existing = await pool.query(
        'SELECT * FROM comments WHERE id = $1 AND resource_type = $2 AND resource_id = $3',
        [req.params.commentId, resourceType, resourceId]
      );
      if (existing.rows.length === 0) {
        return res.status(404).json(error('Kommentar nicht gefunden'));
      }

      // Löschen darf: der Autor selbst ODER wer Schreibzugriff auf die
      // Ressource hat (Moderation) – deckt sich mit der bestehenden Regel,
      // dass "write"-Zugriff die Ressource voll verwalten darf.
      const isAuthor = existing.rows[0].user_id === req.user.id;
      const hasWriteAccess = await assertWrite(resourceId, req.user.id);
      if (!isAuthor && !hasWriteAccess) {
        return res.status(403).json(error('Keine Berechtigung, diesen Kommentar zu löschen'));
      }

      await pool.query('DELETE FROM comments WHERE id = $1', [req.params.commentId]);
      res.json(success({ message: 'Kommentar gelöscht' }));
    } catch (err) {
      logger.error('[deleteComment]', err);
      res.status(500).json(error('Interner Serverfehler'));
    }
  }

  return { getComments, addComment, updateComment, deleteComment };
}

// Aufräumen beim Löschen der Ursprungsressource (kein DB-seitiges FK
// über zwei Zieltabellen hinweg möglich) – aufgerufen aus
// boardsController.deleteBoard und trainingSessionsController.deleteSession.
export async function deleteCommentsForResource(resourceType, resourceId) {
  await pool.query('DELETE FROM comments WHERE resource_type = $1 AND resource_id = $2', [resourceType, resourceId]);
}

// Aufräumen VOR dem Löschen eines Nutzer-Accounts (userController.deleteAccount,
// adminController.deleteUser): boards.user_id/training_sessions.user_id haben
// ON DELETE CASCADE auf users, löschen also beim Account-Löschen alle Boards/
// Trainingseinheiten dieses Nutzers hart – ohne über deleteBoard/deleteSession
// zu laufen, wo die Kommentar-Aufräumung normalerweise sitzt. Ohne diesen
// Aufruf blieben Kommentare ANDERER Nutzer auf den gelöschten Ressourcen als
// verwaiste Zeilen zurück (comments hat bewusst kein DB-FK, siehe oben).
export async function deleteCommentsForUser(userId) {
  await pool.query(
    `DELETE FROM comments WHERE resource_type = 'board'
     AND resource_id IN (SELECT id FROM boards WHERE user_id = $1)`,
    [userId]
  );
  await pool.query(
    `DELETE FROM comments WHERE resource_type = 'training_session'
     AND resource_id IN (SELECT id FROM training_sessions WHERE user_id = $1)`,
    [userId]
  );
  await pool.query(
    `DELETE FROM comments WHERE resource_type = 'game'
     AND resource_id IN (SELECT id FROM games WHERE user_id = $1)`,
    [userId]
  );
}
