/**
 * playerDevelopmentNotesController – freie, zeitgestempelte
 * Beobachtungsnotizen zu einem Kader-Spieler (Statistik-Architektur
 * Phase 5, EPIC 012). CLAUDE.md-Vision "Wissen im Verein aufbauen" /
 * "Spielerentwicklung langfristig begleiten".
 *
 * Bewusst restriktiverer Zugriff als die übrige Kader-Sichtbarkeit
 * (rosterController.assertResourceRead lässt jedes Team-Mitglied lesen):
 * Notizen sind personenbezogene Daten ÜBER einen Spieler (oft
 * minderjährig), keine Diskussion ZU einer Ressource wie comments –
 * daher nur coach/owner, nie 'member' (Privacy by Design, CLAUDE.md §5.1).
 */
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { success, created, error } from '../utils/apiResponse.js';
import { assertTeamAccess, getTeamRole } from '../utils/teamAccess.js';

async function getRosterPlayerRow(rosterPlayerId) {
  const result = await pool.query('SELECT user_id, team_id FROM roster_players WHERE id = $1', [rosterPlayerId]);
  return result.rows[0] ?? null;
}

// Ein einziges Zugriffs-Gate für Lesen UND Schreiben (anders als sonst im
// Projekt üblich, z.B. assertResourceRead/-Write in rosterController.js)
// – bei personenbezogenen Beobachtungsnotizen ist "nur ansehen" für
// 'member' fachlich nicht vorgesehen, siehe Doc-Kommentar oben.
async function assertNotesAccess(rosterPlayerId, userId) {
  const row = await getRosterPlayerRow(rosterPlayerId);
  if (!row) return false;
  if (row.user_id === userId) return true;
  if (!row.team_id) return false;
  return assertTeamAccess(row.team_id, userId, 'coach');
}

function toApiNote(row) {
  return {
    _id:               row.id,
    rosterPlayerId:    row.roster_player_id,
    trainingSessionId: row.training_session_id,
    note:              row.note,
    authorUserId:      row.author_user_id,
    authorName:        row.author_name ?? null,
    createdAt:         row.created_at,
    updatedAt:         row.updated_at,
  };
}

// GET /api/roster/:id/notes – chronologisch absteigend (neueste zuerst,
// wie ein Verlauf/Journal gelesen wird).
export async function getNotes(req, res) {
  try {
    const rosterPlayerId = req.params.id;
    if (!(await assertNotesAccess(rosterPlayerId, req.user.id))) {
      return res.status(404).json(error('Kader-Spieler nicht gefunden'));
    }
    const result = await pool.query(
      `SELECT n.*, COALESCE(u.display_name, u.email) AS author_name
       FROM player_development_notes n
       JOIN users u ON u.id = n.author_user_id
       WHERE n.roster_player_id = $1
       ORDER BY n.created_at DESC`,
      [rosterPlayerId]
    );
    res.json(success(result.rows.map(toApiNote)));
  } catch (err) {
    logger.error('[getNotes]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// POST /api/roster/:id/notes
export async function createNote(req, res) {
  try {
    const rosterPlayerId = req.params.id;
    if (!(await assertNotesAccess(rosterPlayerId, req.user.id))) {
      return res.status(404).json(error('Kader-Spieler nicht gefunden'));
    }

    const { note, trainingSessionId = null } = req.body;

    // Optionaler Trainings-Kontext muss existieren – Zugriff wurde oben
    // bereits über den Kader-Spieler geprüft (assertNotesAccess).
    if (trainingSessionId) {
      const sessionResult = await pool.query('SELECT id FROM training_sessions WHERE id = $1', [trainingSessionId]);
      if (sessionResult.rows.length === 0) {
        return res.status(400).json(error('Trainingseinheit nicht gefunden'));
      }
    }

    const result = await pool.query(
      `INSERT INTO player_development_notes (roster_player_id, author_user_id, training_session_id, note)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [rosterPlayerId, req.user.id, trainingSessionId, note]
    );
    const authorResult = await pool.query('SELECT COALESCE(display_name, email) AS author_name FROM users WHERE id = $1', [req.user.id]);
    res.status(201).json(created(toApiNote({ ...result.rows[0], author_name: authorResult.rows[0]?.author_name })));
  } catch (err) {
    logger.error('[createNote]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// PUT /api/roster/:id/notes/:noteId – nur der Autor darf seine eigene
// Notiz bearbeiten (nicht "irgendein Coach des Teams", damit Beobachtungen
// erkennbar bei ihrem Urheber bleiben).
export async function updateNote(req, res) {
  try {
    const rosterPlayerId = req.params.id;
    if (!(await assertNotesAccess(rosterPlayerId, req.user.id))) {
      return res.status(404).json(error('Kader-Spieler nicht gefunden'));
    }
    const existing = await pool.query(
      'SELECT * FROM player_development_notes WHERE id = $1 AND roster_player_id = $2',
      [req.params.noteId, rosterPlayerId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json(error('Notiz nicht gefunden'));
    }
    if (existing.rows[0].author_user_id !== req.user.id) {
      return res.status(403).json(error('Nur der Autor darf diese Notiz bearbeiten'));
    }
    const result = await pool.query(
      'UPDATE player_development_notes SET note = $1 WHERE id = $2 RETURNING *',
      [req.body.note, req.params.noteId]
    );
    const authorResult = await pool.query('SELECT COALESCE(display_name, email) AS author_name FROM users WHERE id = $1', [req.user.id]);
    res.json(success(toApiNote({ ...result.rows[0], author_name: authorResult.rows[0]?.author_name })));
  } catch (err) {
    logger.error('[updateNote]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// DELETE /api/roster/:id/notes/:noteId – wie updateNote nur der Autor,
// zusätzlich der Team-owner (Moderationsfähigkeit für problematische
// Einträge, analog board_collaborators-Owner-Vorrang).
export async function deleteNote(req, res) {
  try {
    const rosterPlayerId = req.params.id;
    if (!(await assertNotesAccess(rosterPlayerId, req.user.id))) {
      return res.status(404).json(error('Kader-Spieler nicht gefunden'));
    }
    const existing = await pool.query(
      'SELECT * FROM player_development_notes WHERE id = $1 AND roster_player_id = $2',
      [req.params.noteId, rosterPlayerId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json(error('Notiz nicht gefunden'));
    }
    const rosterRow = await getRosterPlayerRow(rosterPlayerId);
    const isOwner = rosterRow.team_id
      ? (await getTeamRole(rosterRow.team_id, req.user.id)) === 'owner'
      : rosterRow.user_id === req.user.id;
    if (existing.rows[0].author_user_id !== req.user.id && !isOwner) {
      return res.status(403).json(error('Keine Berechtigung, diese Notiz zu löschen'));
    }
    await pool.query('DELETE FROM player_development_notes WHERE id = $1', [req.params.noteId]);
    res.json(success({ message: 'Notiz gelöscht' }));
  } catch (err) {
    logger.error('[deleteNote]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}
