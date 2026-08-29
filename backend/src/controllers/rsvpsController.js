/**
 * rsvpsController – Zusage/Absage/Unsicher für Spiele und
 * Trainingseinheiten (Roadmap-Audit: RSVP/Anwesenheit, größter
 * Alltagsnutzen der noch fehlenden Features).
 *
 * Polymorphe `rsvps`-Tabelle mit resource_type als Diskriminator, exakt
 * nach dem Muster von commentsController.makeCommentHandlers – nur mit
 * EINEM Status pro User+Ressource (Upsert) statt beliebig vieler
 * Einträge. makeRsvpHandlers() wird von routes/rsvps.js einmal für
 * Spiele und einmal für Trainingseinheiten mit der jeweils passenden
 * assertRead-Funktion instanziiert (assertGameRead/assertSessionRead).
 */
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { success, error } from '../utils/apiResponse.js';

const RESOURCE_TABLE = {
  game: 'games',
  training_session: 'training_sessions',
};

// Spieler-Dashboard-Ausbau: Datums-/Uhrzeit-Spalten unterscheiden sich
// zwischen games (kickoff_time/played_at) und training_sessions
// (start_time/scheduled_date) – siehe migrate.js.
const RESOURCE_DATE_COLUMNS = {
  game: { date: 'played_at', time: 'kickoff_time' },
  training_session: { date: 'scheduled_date', time: 'start_time' },
};

function toApiRsvpEntry(row) {
  return {
    userId:      row.user_id,
    email:       row.email,
    teamRole:    row.team_role ?? null,
    status:      row.status ?? null,
    reason:      row.reason ?? '',
    respondedAt: row.updated_at ?? null,
  };
}

export function makeRsvpHandlers(resourceType, { assertRead }) {
  const table = RESOURCE_TABLE[resourceType];
  const { date: dateCol, time: timeCol } = RESOURCE_DATE_COLUMNS[resourceType];

  // Spieler-Dashboard-Ausbau ("Fristen und Sonderfälle"): serverseitiger
  // Schutz, der bisher nur clientseitig (Dashboard-Buttons deaktiviert)
  // bestand. Ohne Uhrzeit gilt der Termin erst nach Ende des Kalendertags
  // als vorbei (COALESCE auf 23:59:59), damit ein Termin ohne erfasste
  // Uhrzeit nicht schon tagsüber fälschlich gesperrt wird. Gibt bei
  // Verstoß einen Fehlertext zurück, sonst null.
  async function guardEditable(resourceId) {
    const result = await pool.query(
      `SELECT status,
              (${dateCol} IS NOT NULL
               AND (${dateCol} + COALESCE(${timeCol}, TIME '23:59:59'))::timestamptz < NOW()) AS is_past
       FROM ${table} WHERE id = $1`,
      [resourceId]
    );
    const row = result.rows[0];
    if (!row) return null; // Ressource existiert nicht – assertRead hat das bereits geprüft/abgelehnt
    if (row.status === 'cancelled') return 'Dieser Termin wurde abgesagt – eine Rückmeldung ist nicht mehr möglich.';
    if (row.is_past) return 'Für vergangene Termine ist keine Rückmeldung mehr möglich.';
    return null;
  }

  // GET /api/games/:id/rsvps bzw. /api/trainings/:id/rsvps – liefert
  // IMMER die volle Team-Roster-Liste (LEFT JOIN), auch für Mitglieder
  // ohne Antwort (status: null), nicht nur die, die schon geantwortet
  // haben. Ohne team_id (rein persönliche Ressource) gibt es keinen
  // Empfängerkreis, daher [] statt eines Fehlers.
  async function getRsvps(req, res) {
    try {
      const resourceId = req.params.id;
      if (!(await assertRead(resourceId, req.user.id))) {
        return res.status(404).json(error('Nicht gefunden'));
      }

      const resourceResult = await pool.query(`SELECT team_id FROM ${table} WHERE id = $1`, [resourceId]);
      const teamId = resourceResult.rows[0]?.team_id ?? null;
      if (!teamId) {
        return res.json(success([]));
      }

      const result = await pool.query(
        `SELECT u.id AS user_id, u.email, tm.role AS team_role, r.status, r.reason, r.updated_at
         FROM team_members tm
         JOIN users u ON u.id = tm.user_id
         LEFT JOIN rsvps r ON r.resource_type = $1 AND r.resource_id = $2 AND r.user_id = tm.user_id
         WHERE tm.team_id = $3
         ORDER BY u.email ASC`,
        [resourceType, resourceId, teamId]
      );
      res.json(success(result.rows.map(toApiRsvpEntry)));
    } catch (err) {
      logger.error('[getRsvps]', err);
      res.status(500).json(error('Interner Serverfehler'));
    }
  }

  // PUT /api/games/:id/rsvps/me bzw. .../trainings/:id/rsvps/me – bewusst
  // assertRead statt assertWrite: eine Selbstauskunft "ich komme/komme
  // nicht" braucht kein Bearbeitungsrecht an der Ressource selbst, jedes
  // Team-Mitglied (auch Rang "member") darf für sich antworten.
  async function setMyRsvp(req, res) {
    try {
      const resourceId = req.params.id;
      if (!(await assertRead(resourceId, req.user.id))) {
        return res.status(404).json(error('Nicht gefunden'));
      }

      const guardMessage = await guardEditable(resourceId);
      if (guardMessage) {
        return res.status(400).json(error(guardMessage));
      }

      const { status, reason = '' } = req.body;
      const result = await pool.query(
        `INSERT INTO rsvps (resource_type, resource_id, user_id, status, reason)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (resource_type, resource_id, user_id)
         DO UPDATE SET status = excluded.status, reason = excluded.reason
         RETURNING *`,
        [resourceType, resourceId, req.user.id, status, reason]
      );
      const userResult = await pool.query(
        `SELECT u.email, tm.role AS team_role
         FROM users u
         JOIN ${table} t ON t.id = $2
         JOIN team_members tm ON tm.team_id = t.team_id AND tm.user_id = u.id
         WHERE u.id = $1`,
        [req.user.id, resourceId]
      );
      res.json(success(toApiRsvpEntry({ ...result.rows[0], ...userResult.rows[0] })));
    } catch (err) {
      logger.error('[setMyRsvp]', err);
      res.status(500).json(error('Interner Serverfehler'));
    }
  }

  return { getRsvps, setMyRsvp };
}

// Aufräumen beim Löschen der Ursprungsressource (kein DB-seitiges FK über
// zwei Zieltabellen hinweg möglich) – aufgerufen aus
// gamesController.deleteGame/trainingSessionsController.deleteSession.
export async function deleteRsvpsForResource(resourceType, resourceId) {
  await pool.query('DELETE FROM rsvps WHERE resource_type = $1 AND resource_id = $2', [resourceType, resourceId]);
}

// Aufräumen VOR dem Löschen eines Nutzer-Accounts (userController.deleteAccount):
// games.user_id/training_sessions.user_id haben ON DELETE CASCADE auf users,
// löschen also beim Account-Löschen alle eigenen Spiele/Trainingseinheiten
// hart – ohne über deleteGame/deleteSession zu laufen, wo die RSVP-
// Aufräumung normalerweise sitzt. Ohne diesen Aufruf blieben RSVP-Antworten
// ANDERER Nutzer auf den gelöschten Ressourcen als verwaiste Zeilen zurück
// (rsvps hat bewusst kein DB-FK auf resource_id, siehe oben). Die eigenen
// RSVP-Antworten des gelöschten Users selbst räumt ON DELETE CASCADE auf
// rsvps.user_id automatisch ab.
export async function deleteRsvpsForUser(userId) {
  await pool.query(
    `DELETE FROM rsvps WHERE resource_type = 'game'
     AND resource_id IN (SELECT id FROM games WHERE user_id = $1)`,
    [userId]
  );
  await pool.query(
    `DELETE FROM rsvps WHERE resource_type = 'training_session'
     AND resource_id IN (SELECT id FROM training_sessions WHERE user_id = $1)`,
    [userId]
  );
}
