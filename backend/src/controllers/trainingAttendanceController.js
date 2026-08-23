/**
 * trainingAttendanceController – tatsächliche Anwesenheit bei einem
 * Training (Statistik-Architektur Phase 5, EPIC 012). Pro Kader-Spieler
 * (roster_players) wird für DIESES eine Training ein Status gesetzt:
 * präsent/entschuldigt/unentschuldigt/verletzt – unabhängig von RSVP
 * (Selbstauskunft VOR dem Termin, siehe rsvpsController.js) und
 * unabhängig von Lines (taktische Gruppierung, trainingsübergreifend).
 *
 * Struktur exakt analog matchSquadController.js (game_squad-Pendant für
 * training_sessions statt games) – echte Junction statt polymorpher
 * Tabelle, CASCADE räumt automatisch auf.
 */
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { success, error } from '../utils/apiResponse.js';
import { assertSessionRead, assertSessionWrite } from './trainingSessionsController.js';

function toApiAttendanceEntry(row) {
  return {
    rosterPlayerId: row.roster_player_id,
    name:           row.name,
    jerseyNumber:   row.jersey_number,
    role:           row.role,
    status:         row.status ?? null,
    note:           row.note ?? '',
    updatedAt:      row.updated_at ?? null,
  };
}

// GET /api/trainings/:id/attendance – liefert IMMER den vollen Kader
// dieses Trainings (LEFT JOIN), auch für Kader-Spieler ohne gesetzten
// Status (status: null), exakt wie matchSquadController.getSquad.
export async function getAttendance(req, res) {
  try {
    const sessionId = req.params.id;
    if (!(await assertSessionRead(sessionId, req.user.id))) {
      return res.status(404).json(error('Trainingseinheit nicht gefunden'));
    }

    const sessionResult = await pool.query('SELECT user_id, team_id FROM training_sessions WHERE id = $1', [sessionId]);
    const session = sessionResult.rows[0];

    const result = await pool.query(
      `SELECT rp.id AS roster_player_id, rp.name, rp.jersey_number, rp.role, ta.status, ta.note, ta.updated_at
       FROM roster_players rp
       LEFT JOIN training_attendance ta ON ta.session_id = $1 AND ta.roster_player_id = rp.id
       WHERE ${session.team_id ? 'rp.team_id = $2' : 'rp.user_id = $2 AND rp.team_id IS NULL'}
       ORDER BY rp.jersey_number ASC NULLS LAST, rp.name ASC`,
      [sessionId, session.team_id ?? session.user_id]
    );
    res.json(success(result.rows.map(toApiAttendanceEntry)));
  } catch (err) {
    logger.error('[getAttendance]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// PUT /api/trainings/:id/attendance/:rosterPlayerId – Coach-Entscheidung,
// daher assertSessionWrite (bewusst NICHT nur Lesezugriff wie bei RSVP).
export async function setAttendanceStatus(req, res) {
  try {
    const sessionId = req.params.id;
    if (!(await assertSessionWrite(sessionId, req.user.id))) {
      return res.status(404).json(error('Trainingseinheit nicht gefunden'));
    }

    const sessionResult = await pool.query('SELECT user_id, team_id FROM training_sessions WHERE id = $1', [sessionId]);
    const session = sessionResult.rows[0];

    const rosterResult = await pool.query(
      'SELECT user_id, team_id FROM roster_players WHERE id = $1',
      [req.params.rosterPlayerId]
    );
    const rosterRow = rosterResult.rows[0];
    if (!rosterRow) {
      return res.status(404).json(error('Kader-Spieler nicht gefunden'));
    }
    // Derselbe Sichtbarkeits-Gruppen-Check wie matchSquadController.setSquadStatus
    // – verhindert, dass ein fremder/unpassender Kader-Spieler diesem
    // Training zugeordnet wird.
    const sameScope = session.team_id
      ? rosterRow.team_id === session.team_id
      : rosterRow.user_id === req.user.id && !rosterRow.team_id;
    if (!sameScope) {
      return res.status(400).json(error('Kader-Spieler gehört nicht zum Kader dieses Trainings'));
    }

    const { status, note = '' } = req.body;
    const result = await pool.query(
      `INSERT INTO training_attendance (session_id, roster_player_id, status, note)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (session_id, roster_player_id)
       DO UPDATE SET status = excluded.status, note = excluded.note
       RETURNING *`,
      [sessionId, req.params.rosterPlayerId, status, note]
    );
    const playerResult = await pool.query(
      'SELECT name, jersey_number, role FROM roster_players WHERE id = $1',
      [req.params.rosterPlayerId]
    );
    res.json(success(toApiAttendanceEntry({ ...result.rows[0], ...playerResult.rows[0] })));
  } catch (err) {
    logger.error('[setAttendanceStatus]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// DELETE /api/trainings/:id/attendance/:rosterPlayerId – setzt zurück auf
// "nicht erfasst" (kein Datensatz, status: null bei GET).
export async function clearAttendanceStatus(req, res) {
  try {
    const sessionId = req.params.id;
    if (!(await assertSessionWrite(sessionId, req.user.id))) {
      return res.status(404).json(error('Trainingseinheit nicht gefunden'));
    }
    await pool.query(
      'DELETE FROM training_attendance WHERE session_id = $1 AND roster_player_id = $2',
      [sessionId, req.params.rosterPlayerId]
    );
    res.json(success({ message: 'Status zurückgesetzt' }));
  } catch (err) {
    logger.error('[clearAttendanceStatus]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}
