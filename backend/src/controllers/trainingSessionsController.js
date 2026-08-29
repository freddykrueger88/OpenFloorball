/**
 * trainingSessionsController – Trainingsplaner: Sessions (geordnete
 * Sequenz von Board-Referenzen mit Dauer/Notiz je Übung), Issue #45.
 *
 * Nutzer-gebunden (nicht board-gebunden), analog playbooksController.js.
 * Items referenzieren Boards per FK (kein Snapshot) – Änderungen am
 * Board spiegeln sich live im Plan. Reihenfolge/CRUD auf Item-Ebene
 * folgt exakt dem Muster von framesController.js.
 *
 * ROADMAP Phase 2: eine Session kann zusätzlich einem Team zugeordnet
 * sein (team_id) – lesen dürfen alle Team-Mitglieder, ändern nur
 * owner/coach (siehe assertSessionRead/-Write unten).
 */
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { success, created, error } from '../utils/apiResponse.js';
import { getUserTeamIds, assertTeamAccess } from '../utils/teamAccess.js';
import { assertBoardAccess } from '../utils/boardAccess.js';
import { addDays } from '../utils/dateMath.js';
import { deleteCommentsForResource } from './commentsController.js';
import { deleteRsvpsForResource } from './rsvpsController.js';

// Roadmap-Audit "Serientermine": eine Serie über eine Saison (z.B.
// 2×/Woche, mehrere Teams) sprengt den ursprünglichen Anti-Abuse-Cap
// von 20 sofort – daher auf 200 angehoben (weiterhin begrenzt, aber
// realistisch für Serien-Nutzung). Gespiegelt in
// frontend/src/hooks/useTrainingSessions.js (nur UX-Vorabprüfung,
// dieser Wert hier bleibt die Autorität).
const MAX_SESSIONS = 200;
const MAX_ITEMS_PER_SESSION = 30;
// Serientermine: pro Serien-Request maximal neu erzeugte Termine
// (unabhängig vom MAX_SESSIONS-Gesamtkontingent), damit ein einzelner
// Request nicht unbegrenzt viele Zeilen einfügt.
const MAX_SERIES_OCCURRENCES = 52;
const SERIES_STEP_DAYS = { daily: 1, weekly: 7, biweekly: 14 };

// node-postgres liefert DATE-Spalten als Date-Objekt in der lokalen
// Zeitzone des Prozesses – über die lokalen Getter statt toISOString()
// zurück in "YYYY-MM-DD" wandeln, damit ein Datum ohne Uhrzeit nicht
// durch eine UTC-Konvertierung um einen Tag verschieben kann.
function toDateString(date) {
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// TIME-Spalten liefert node-postgres als String "HH:MM:SS" – Sekunden für
// die API abschneiden (Spieler-Dashboard-Ausbau, analog gamesController.js).
function toTimeString(time) {
  return time ? time.slice(0, 5) : null;
}

function toApiSession(row) {
  return {
    _id:           row.id,
    name:          row.name,
    notes:         row.notes,
    teamId:        row.team_id,
    scheduledDate: toDateString(row.scheduled_date),
    goal:          row.goal,
    itemCount:     Number(row.item_count ?? 0),
    totalMinutes:  Number(row.total_minutes ?? 0),
    // Spieler-Dashboard-Ausbau: Trainings-Logistik (alle nullable/additiv)
    startTime:        toTimeString(row.start_time),
    durationMinutes:  row.duration_minutes,
    venueName:        row.venue_name,
    venueAddress:     row.venue_address,
    venueLat:         row.venue_lat,
    venueLng:         row.venue_lng,
    status:           row.status,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,
  };
}

function toApiItem(row) {
  return {
    _id:              row.id,
    boardId:          row.board_id,
    boardName:        row.board_name,
    boardFieldType:   row.field_type,
    boardTheme:       row.theme,
    boardHomeColor:   row.home_color,
    boardAwayColor:   row.away_color,
    boardBallColor:   row.ball_color,
    order:            row.order_index,
    durationMinutes:  row.duration_minutes,
    note:             row.note,
    createdAt:        row.created_at,
  };
}

async function getSessionRow(sessionId) {
  const result = await pool.query('SELECT user_id, team_id FROM training_sessions WHERE id = $1', [sessionId]);
  return result.rows[0] ?? null;
}

// exportiert, da auch von commentsController.js genutzt (Kommentare
// auf Trainingseinheiten, ROADMAP Phase 2)
export async function assertSessionRead(sessionId, userId) {
  const session = await getSessionRow(sessionId);
  if (!session) return false;
  if (session.user_id === userId) return true;
  if (!session.team_id) return false;
  return assertTeamAccess(session.team_id, userId, 'member');
}

export async function assertSessionWrite(sessionId, userId) {
  const session = await getSessionRow(sessionId);
  if (!session) return false;
  if (session.user_id === userId) return true;
  if (!session.team_id) return false;
  return assertTeamAccess(session.team_id, userId, 'coach');
}

async function fetchItems(sessionId) {
  const result = await pool.query(
    `SELECT i.*, b.name AS board_name, b.field_type, b.theme,
            b.home_color, b.away_color, b.ball_color
     FROM training_session_items i
     LEFT JOIN boards b ON b.id = i.board_id AND b.deleted_at IS NULL
     WHERE i.session_id = $1
     ORDER BY i.order_index ASC`,
    [sessionId]
  );
  return result.rows.map(toApiItem);
}

// GET /api/trainings
export async function getSessions(req, res) {
  try {
    const teamIds = await getUserTeamIds(req.user.id);
    const result = await pool.query(
      `SELECT s.*,
              COUNT(i.id)::int AS item_count,
              COALESCE(SUM(i.duration_minutes), 0)::int AS total_minutes
       FROM training_sessions s
       LEFT JOIN training_session_items i ON i.session_id = s.id
       WHERE s.user_id = $1 OR s.team_id = ANY($2::uuid[])
       GROUP BY s.id
       ORDER BY s.updated_at DESC`,
      [req.user.id, teamIds]
    );
    res.json(success(result.rows.map(toApiSession)));
  } catch (err) {
    logger.error('[getSessions]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// POST /api/trainings
export async function createSession(req, res) {
  try {
    const {
      name, teamId = null, scheduledDate = null, goal = '', notes = '',
      startTime = null, durationMinutes = null, venueName = null,
      venueAddress = null, venueLat = null, venueLng = null,
    } = req.body;

    if (teamId && !(await assertTeamAccess(teamId, req.user.id, 'coach'))) {
      return res.status(404).json(error('Team nicht gefunden'));
    }

    const countResult = await pool.query(
      'SELECT COUNT(*)::int AS count FROM training_sessions WHERE user_id = $1',
      [req.user.id]
    );
    if (countResult.rows[0].count >= MAX_SESSIONS) {
      return res.status(400).json(error(`Maximal ${MAX_SESSIONS} Trainingseinheiten`));
    }

    // EPIC 010 – KI-Trainingsassistent: notes optional direkt beim Anlegen
    // setzbar, damit "Als Trainingseinheit übernehmen" ein einzelner
    // Request ist statt Create+Update.
    const result = await pool.query(
      `INSERT INTO training_sessions (user_id, name, team_id, scheduled_date, goal, notes,
                                       start_time, duration_minutes, venue_name, venue_address, venue_lat, venue_lng)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [req.user.id, name, teamId, scheduledDate, goal, notes,
        startTime, durationMinutes, venueName, venueAddress, venueLat, venueLng]
    );
    res.status(201).json(created(toApiSession({ ...result.rows[0], item_count: 0, total_minutes: 0 })));
  } catch (err) {
    logger.error('[createSession]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// GET /api/trainings/:id
export async function getSession(req, res) {
  try {
    if (!(await assertSessionRead(req.params.id, req.user.id))) {
      return res.status(404).json(error('Trainingseinheit nicht gefunden'));
    }
    const result = await pool.query('SELECT * FROM training_sessions WHERE id = $1', [req.params.id]);

    const items = await fetchItems(req.params.id);
    const session = toApiSession({
      ...result.rows[0],
      item_count: items.length,
      total_minutes: items.reduce((sum, i) => sum + i.durationMinutes, 0),
    });
    res.json(success({ ...session, items }));
  } catch (err) {
    logger.error('[getSession]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// PUT /api/trainings/:id
export async function updateSession(req, res) {
  try {
    if (!(await assertSessionWrite(req.params.id, req.user.id))) {
      return res.status(404).json(error('Trainingseinheit nicht gefunden'));
    }

    const sets = [];
    const values = [];
    let i = 1;

    if (req.body.name !== undefined) { sets.push(`name = $${i}`); values.push(req.body.name); i += 1; }
    if (req.body.notes !== undefined) { sets.push(`notes = $${i}`); values.push(req.body.notes); i += 1; }
    if (req.body.scheduledDate !== undefined) { sets.push(`scheduled_date = $${i}`); values.push(req.body.scheduledDate); i += 1; }
    if (req.body.goal !== undefined) { sets.push(`goal = $${i}`); values.push(req.body.goal); i += 1; }
    // Spieler-Dashboard-Ausbau: Trainings-Logistik
    if (req.body.startTime !== undefined)       { sets.push(`start_time = $${i}`);       values.push(req.body.startTime);       i += 1; }
    if (req.body.durationMinutes !== undefined) { sets.push(`duration_minutes = $${i}`); values.push(req.body.durationMinutes); i += 1; }
    if (req.body.venueName !== undefined)       { sets.push(`venue_name = $${i}`);       values.push(req.body.venueName);       i += 1; }
    if (req.body.venueAddress !== undefined)    { sets.push(`venue_address = $${i}`);    values.push(req.body.venueAddress);    i += 1; }
    if (req.body.venueLat !== undefined)        { sets.push(`venue_lat = $${i}`);        values.push(req.body.venueLat);        i += 1; }
    if (req.body.venueLng !== undefined)        { sets.push(`venue_lng = $${i}`);        values.push(req.body.venueLng);        i += 1; }
    if (req.body.status !== undefined)          { sets.push(`status = $${i}`);           values.push(req.body.status);          i += 1; }

    if (sets.length === 0) {
      return res.status(400).json(error('Keine gültigen Felder zum Aktualisieren'));
    }

    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE training_sessions SET ${sets.join(', ')}
       WHERE id = $${i}
       RETURNING *`,
      values
    );
    res.json(success(toApiSession(result.rows[0])));
  } catch (err) {
    logger.error('[updateSession]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// DELETE /api/trainings/:id
export async function deleteSession(req, res) {
  try {
    if (!(await assertSessionWrite(req.params.id, req.user.id))) {
      return res.status(404).json(error('Trainingseinheit nicht gefunden'));
    }
    await pool.query('DELETE FROM training_sessions WHERE id = $1', [req.params.id]);
    // Boards werden nur soft-deleted (deleted_at) – Kommentare dort werden
    // dadurch bereits automatisch unerreichbar (assertBoardAccess filtert
    // deleted_at). training_sessions werden hart gelöscht, daher hier
    // explizit aufräumen, sonst blieben verwaiste Kommentare zurück.
    await deleteCommentsForResource('training_session', req.params.id);
    await deleteRsvpsForResource('training_session', req.params.id);
    res.json(success({ message: 'Trainingseinheit gelöscht' }));
  } catch (err) {
    logger.error('[deleteSession]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// POST /api/trainings/:id/repeat   Body: { repeat: 'daily'|'weekly'|'biweekly', until: 'YYYY-MM-DD' }
// Roadmap-Audit "Serientermine" – erzeugt unabhängige Folge-Termine
// (kein Serien-Tracking, jeder ist danach normal editierbar/löschbar).
// Übernimmt name/team_id/goal/notes vom Ausgangstermin, NICHT die Items
// (Board-Übungen) – die Serie liefert nur das Datums-Grundgerüst.
export async function repeatSession(req, res) {
  try {
    if (!(await assertSessionWrite(req.params.id, req.user.id))) {
      return res.status(404).json(error('Trainingseinheit nicht gefunden'));
    }

    const sourceResult = await pool.query('SELECT * FROM training_sessions WHERE id = $1', [req.params.id]);
    const source = sourceResult.rows[0];
    if (!source.scheduled_date) {
      return res.status(400).json(error('Für eine Serie muss der Ausgangstermin ein Datum haben'));
    }

    const scheduledDate = toDateString(source.scheduled_date);
    const { repeat, until } = req.body;
    if (until <= scheduledDate) {
      return res.status(400).json(error('Enddatum muss nach dem Ausgangstermin liegen'));
    }

    const step = SERIES_STEP_DAYS[repeat];
    const occurrenceDates = [];
    let cursor = addDays(scheduledDate, step);
    while (cursor <= until) {
      occurrenceDates.push(cursor);
      if (occurrenceDates.length > MAX_SERIES_OCCURRENCES) {
        return res.status(400).json(error(`Serie erzeugt zu viele Termine (max. ${MAX_SERIES_OCCURRENCES}) – wähle ein früheres Enddatum`));
      }
      cursor = addDays(cursor, step);
    }

    const countResult = await pool.query(
      'SELECT COUNT(*)::int AS count FROM training_sessions WHERE user_id = $1',
      [req.user.id]
    );
    if (countResult.rows[0].count + occurrenceDates.length > MAX_SESSIONS) {
      return res.status(400).json(error(`Serie würde das Kontingent von ${MAX_SESSIONS} Trainingseinheiten überschreiten`));
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const rows = [];
      for (const date of occurrenceDates) {
        const insertResult = await client.query(
          `INSERT INTO training_sessions (user_id, name, team_id, scheduled_date, goal, notes)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [req.user.id, source.name, source.team_id, date, source.goal, source.notes]
        );
        rows.push(insertResult.rows[0]);
      }
      await client.query('COMMIT');
      res.status(201).json(success(rows.map((row) => toApiSession({ ...row, item_count: 0, total_minutes: 0 }))));
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error('[repeatSession]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// POST /api/trainings/:id/items
export async function addItem(req, res) {
  const { boardId, durationMinutes = 15, note = '' } = req.body;

  try {
    if (!(await assertSessionWrite(req.params.id, req.user.id))) {
      return res.status(404).json(error('Trainingseinheit nicht gefunden'));
    }
    // Bugfix: vorher eine strikte Eigentümer-Prüfung, die auch write-
    // Kollaboratoren eines geteilten Boards ausgeschlossen hat – jetzt
    // konsistent mit dem Rest der App über boardAccess.js geprüft.
    if (!(await assertBoardAccess(boardId, req.user.id, 'write'))) {
      return res.status(404).json(error('Board nicht gefunden'));
    }
  } catch (err) {
    logger.error('[addItem]', err);
    return res.status(500).json(error('Interner Serverfehler'));
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const countResult = await client.query(
      'SELECT COUNT(*)::int AS count FROM training_session_items WHERE session_id = $1',
      [req.params.id]
    );
    if (countResult.rows[0].count >= MAX_ITEMS_PER_SESSION) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(`Maximal ${MAX_ITEMS_PER_SESSION} Übungen pro Trainingseinheit`));
    }
    const orderIndex = countResult.rows[0].count;

    const insertResult = await client.query(
      `INSERT INTO training_session_items (session_id, board_id, order_index, duration_minutes, note)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [req.params.id, boardId, orderIndex, durationMinutes, note]
    );

    await client.query('COMMIT');

    const itemResult = await pool.query(
      `SELECT i.*, b.name AS board_name, b.field_type, b.theme,
              b.home_color, b.away_color, b.ball_color
       FROM training_session_items i
       LEFT JOIN boards b ON b.id = i.board_id AND b.deleted_at IS NULL
       WHERE i.id = $1`,
      [insertResult.rows[0].id]
    );
    res.status(201).json(created(toApiItem(itemResult.rows[0])));
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('[addItem]', err);
    res.status(500).json(error('Interner Serverfehler'));
  } finally {
    client.release();
  }
}

// PUT /api/trainings/:id/items/:itemId
export async function updateItem(req, res) {
  try {
    if (!(await assertSessionWrite(req.params.id, req.user.id))) {
      return res.status(404).json(error('Trainingseinheit nicht gefunden'));
    }

    const sets = [];
    const values = [];
    let i = 1;

    if (req.body.durationMinutes !== undefined) { sets.push(`duration_minutes = $${i}`); values.push(req.body.durationMinutes); i += 1; }
    if (req.body.note !== undefined) { sets.push(`note = $${i}`); values.push(req.body.note); i += 1; }

    if (sets.length === 0) {
      return res.status(400).json(error('Keine gültigen Felder zum Aktualisieren'));
    }

    values.push(req.params.itemId, req.params.id);
    const result = await pool.query(
      `UPDATE training_session_items SET ${sets.join(', ')}
       WHERE id = $${i} AND session_id = $${i + 1}
       RETURNING id`,
      values
    );
    if (result.rows.length === 0) {
      return res.status(404).json(error('Übung nicht gefunden'));
    }

    const itemResult = await pool.query(
      `SELECT i.*, b.name AS board_name, b.field_type, b.theme,
              b.home_color, b.away_color, b.ball_color
       FROM training_session_items i
       LEFT JOIN boards b ON b.id = i.board_id AND b.deleted_at IS NULL
       WHERE i.id = $1`,
      [result.rows[0].id]
    );
    res.json(success(toApiItem(itemResult.rows[0])));
  } catch (err) {
    logger.error('[updateItem]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// DELETE /api/trainings/:id/items/:itemId
export async function deleteItem(req, res) {
  try {
    if (!(await assertSessionWrite(req.params.id, req.user.id))) {
      return res.status(404).json(error('Trainingseinheit nicht gefunden'));
    }
  } catch (err) {
    logger.error('[deleteItem]', err);
    return res.status(500).json(error('Interner Serverfehler'));
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const del = await client.query(
      'DELETE FROM training_session_items WHERE id = $1 AND session_id = $2 RETURNING id',
      [req.params.itemId, req.params.id]
    );
    if (del.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error('Übung nicht gefunden'));
    }

    // Reihenfolge normalisieren (0..n-1)
    const remaining = await client.query(
      'SELECT id FROM training_session_items WHERE session_id = $1 ORDER BY order_index ASC',
      [req.params.id]
    );
    await Promise.all(
      remaining.rows.map((row, idx) =>
        client.query('UPDATE training_session_items SET order_index = $1 WHERE id = $2', [idx, row.id]))
    );

    await client.query('COMMIT');
    res.json(success({ message: 'Übung gelöscht' }));
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('[deleteItem]', err);
    res.status(500).json(error('Interner Serverfehler'));
  } finally {
    client.release();
  }
}

// PUT /api/trainings/:id/items/reorder   Body: { order: [itemId1, itemId2, ...] }
export async function reorderItems(req, res) {
  const { order } = req.body;
  if (!Array.isArray(order)) {
    return res.status(400).json(error('"order" muss ein Array von Übungs-IDs sein'));
  }

  try {
    if (!(await assertSessionWrite(req.params.id, req.user.id))) {
      return res.status(404).json(error('Trainingseinheit nicht gefunden'));
    }
  } catch (err) {
    logger.error('[reorderItems]', err);
    return res.status(500).json(error('Interner Serverfehler'));
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await Promise.all(
      order.map((itemId, idx) =>
        client.query(
          'UPDATE training_session_items SET order_index = $1 WHERE id = $2 AND session_id = $3',
          [idx, itemId, req.params.id]
        ))
    );
    await client.query('COMMIT');

    res.json(success(await fetchItems(req.params.id)));
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('[reorderItems]', err);
    res.status(500).json(error('Interner Serverfehler'));
  } finally {
    client.release();
  }
}
