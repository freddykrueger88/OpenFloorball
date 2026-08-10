/**
 * announcementsController – News/Ankündigungen (Roadmap-Audit, Phase D
 * "Kommunikation – minimal"). Bewusst kein Vollchat: ein Coach/Owner
 * postet kurze Mitteilungen an sein Team, alle Mitglieder lesen sie in
 * einer chronologischen Liste. Kein Kommentieren/Antworten.
 *
 * Anders als comments/rsvps keine polymorphe Tabelle (nur ein
 * Ressourcentyp: Teams) und anders als games/training_sessions kein
 * persönlicher Fall (eine Ankündigung ohne Team hat kein Publikum) –
 * team_id ist NOT NULL, siehe migrate.js.
 */
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { success, created, error } from '../utils/apiResponse.js';
import { getUserTeamIds, assertTeamAccess } from '../utils/teamAccess.js';

const MAX_ANNOUNCEMENTS_PER_TEAM = 500;

function toApiAnnouncement(row) {
  return {
    _id:       row.id,
    teamId:    row.team_id,
    userId:    row.user_id,
    email:     row.email,
    text:      row.text,
    createdAt: row.created_at,
  };
}

// GET /api/announcements – flache Liste über alle Teams des Nutzers,
// kein persönlicher Fall (kein `OR user_id = ...` nötig).
export async function getAnnouncements(req, res) {
  try {
    const teamIds = await getUserTeamIds(req.user.id);
    const result = await pool.query(
      `SELECT a.*, u.email FROM announcements a
       JOIN users u ON u.id = a.user_id
       WHERE a.team_id = ANY($1::uuid[])
       ORDER BY a.created_at DESC`,
      [teamIds]
    );
    res.json(success(result.rows.map(toApiAnnouncement)));
  } catch (err) {
    logger.error('[getAnnouncements]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// POST /api/announcements – Coach-Entscheidung, wer posten darf.
export async function createAnnouncement(req, res) {
  try {
    const { teamId, text } = req.body;
    if (!(await assertTeamAccess(teamId, req.user.id, 'coach'))) {
      return res.status(404).json(error('Team nicht gefunden'));
    }

    const countResult = await pool.query('SELECT COUNT(*)::int AS count FROM announcements WHERE team_id = $1', [teamId]);
    if (countResult.rows[0].count >= MAX_ANNOUNCEMENTS_PER_TEAM) {
      return res.status(400).json(error(`Maximal ${MAX_ANNOUNCEMENTS_PER_TEAM} Ankündigungen pro Team`));
    }

    const insertResult = await pool.query(
      'INSERT INTO announcements (team_id, user_id, text) VALUES ($1, $2, $3) RETURNING *',
      [teamId, req.user.id, text]
    );
    const announcementResult = await pool.query(
      'SELECT a.*, u.email FROM announcements a JOIN users u ON u.id = a.user_id WHERE a.id = $1',
      [insertResult.rows[0].id]
    );
    res.status(201).json(created(toApiAnnouncement(announcementResult.rows[0])));
  } catch (err) {
    logger.error('[createAnnouncement]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// DELETE /api/announcements/:id – jeder Coach/Owner DIESES Teams darf
// löschen, nicht nur der Ersteller (konsistent mit assertGameWrite etc.).
export async function deleteAnnouncement(req, res) {
  try {
    const existing = await pool.query('SELECT team_id FROM announcements WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json(error('Ankündigung nicht gefunden'));
    }
    if (!(await assertTeamAccess(existing.rows[0].team_id, req.user.id, 'coach'))) {
      return res.status(404).json(error('Ankündigung nicht gefunden'));
    }
    await pool.query('DELETE FROM announcements WHERE id = $1', [req.params.id]);
    res.json(success({ message: 'Ankündigung gelöscht' }));
  } catch (err) {
    logger.error('[deleteAnnouncement]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}
