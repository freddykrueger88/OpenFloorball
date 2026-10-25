/**
 * libraryController – Community-Übungsbibliothek (EPIC 010 MVP)
 *
 * Veröffentlichen erzeugt eine SNAPSHOT-Kopie eines Boards in
 * library_entries statt eines Live-Verweises – siehe Begründung im
 * Migrations-Kommentar (db/migrate.js). notes/opponent/collaborators
 * werden bewusst NICHT übernommen.
 */
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { success, created, error } from '../utils/apiResponse.js';
import { getBoardAccessLevel } from '../utils/boardAccess.js';

// snake_case (DB) → camelCase (API/Frontend)
function toApiLibraryEntry(row) {
  return {
    _id:              row.id,
    name:             row.name,
    fieldType:        row.field_type,
    category:         row.category,
    ageGroup:         row.age_group,
    goal:             row.goal,
    material:         row.material,
    theme:            row.theme,
    homeColor:        row.home_color,
    awayColor:        row.away_color,
    ballColor:        row.ball_color,
    players:          row.players_json,
    elements:         row.elements_json,
    ownerId:          row.owner_id,
    // owner_id ist SET NULL beim Löschen des Accounts – Frontend zeigt dann
    // einen Platzhalter statt display_name (siehe library.authorFallback).
    ownerDisplayName: row.display_name ?? null,
    createdAt:        row.created_at,
    updatedAt:        row.updated_at,
  };
}

// POST /api/boards/:id/publish – Owner-only (bewusst strenger als 'write':
// Veröffentlichen ist weitreichender als bloßes Mitbearbeiten).
export async function publishToLibrary(req, res) {
  try {
    const accessLevel = await getBoardAccessLevel(req.params.id, req.user.id);
    if (accessLevel !== 'owner') {
      return res.status(404).json(error('Spielfeld nicht gefunden'));
    }

    const boardResult = await pool.query(
      `SELECT * FROM boards WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    const board = boardResult.rows[0];
    if (!board) {
      return res.status(404).json(error('Spielfeld nicht gefunden'));
    }

    const body = req.body ?? {};
    const name = (body.name ?? board.name ?? '').trim() || board.name;

    // Publish ist ein Snapshot des AKTUELLEN Spielzugs, nicht der veralteten
    // boards.players_json/elements_json (die werden beim Frame-Save nicht mehr
    // gepflegt). Ohne explizite frameId wird der erste Frame genommen – das
    // entspricht dem sichtbaren Standardzustand beim Öffnen des Boards.
    let players = board.players_json;
    let elements = board.elements_json;
    const frameResult = body.frameId
      ? await pool.query(
        'SELECT data_json FROM frames WHERE id = $1 AND board_id = $2',
        [body.frameId, board.id]
      )
      : await pool.query(
        'SELECT data_json FROM frames WHERE board_id = $1 ORDER BY order_index ASC LIMIT 1',
        [board.id]
      );
    if (body.frameId && frameResult.rows.length === 0) {
      return res.status(404).json(error('Frame nicht gefunden'));
    }
    if (frameResult.rows.length > 0) {
      const data = frameResult.rows[0].data_json ?? {};
      players = Array.isArray(data.players) ? data.players : [];
      elements = Array.isArray(data.elements) ? data.elements : [];
    }

    const result = await pool.query(
      `INSERT INTO library_entries (
         source_board_id, owner_id, name, field_type, category, age_group, goal, material,
         theme, home_color, away_color, ball_color, players_json, elements_json
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb)
       RETURNING *`,
      [
        board.id, req.user.id, name, board.field_type, board.category, board.age_group,
        board.goal, board.material, board.theme, board.home_color, board.away_color,
        board.ball_color, JSON.stringify(players), JSON.stringify(elements),
      ]
    );
    res.status(201).json(created(toApiLibraryEntry(result.rows[0])));
  } catch (err) {
    logger.error('[publishToLibrary]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// GET /api/library – Query: category, search (Name, ILIKE), limit/offset
export async function listLibrary(req, res) {
  try {
    const { category = '', search = '' } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const conditions = [];
    const values = [];
    let i = 1;

    if (category) {
      conditions.push(`le.category = $${i}`);
      values.push(category);
      i += 1;
    }
    if (search) {
      conditions.push(`le.name ILIKE $${i}`);
      values.push(`%${search}%`);
      i += 1;
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    values.push(limit, offset);
    const result = await pool.query(
      `SELECT le.id, le.name, le.field_type, le.category, le.age_group, le.goal, le.material,
              le.theme, le.home_color, le.away_color, le.ball_color, le.players_json,
              le.owner_id, le.created_at, le.updated_at, u.display_name
       FROM library_entries le
       LEFT JOIN users u ON u.id = le.owner_id
       ${where}
       ORDER BY le.created_at DESC
       LIMIT $${i} OFFSET $${i + 1}`,
      values
    );
    res.json(success(result.rows.map(toApiLibraryEntry)));
  } catch (err) {
    logger.error('[listLibrary]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// GET /api/library/:id
export async function getLibraryEntry(req, res) {
  try {
    const result = await pool.query(
      `SELECT le.*, u.display_name
       FROM library_entries le
       LEFT JOIN users u ON u.id = le.owner_id
       WHERE le.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json(error('Übung nicht gefunden'));
    }
    res.json(success(toApiLibraryEntry(result.rows[0])));
  } catch (err) {
    logger.error('[getLibraryEntry]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// POST /api/library/:id/clone – erzeugt aus dem Snapshot ein neues,
// privates Board für req.user.id. Kein Rescaling nötig, das neue Board
// erhält denselben field_type wie der Eintrag; ein späterer Feldtyp-
// Wechsel läuft über die bereits vorhandene Logik im Board-Editor.
export async function cloneLibraryEntry(req, res) {
  const client = await pool.connect();
  try {
    const entryResult = await client.query(
      `SELECT * FROM library_entries WHERE id = $1`,
      [req.params.id]
    );
    const entry = entryResult.rows[0];
    if (!entry) {
      client.release();
      return res.status(404).json(error('Übung nicht gefunden'));
    }

    await client.query('BEGIN');
    const boardResult = await client.query(
      `INSERT INTO boards (user_id, name, field_type, theme, home_color, away_color, ball_color,
                            category, age_group, goal, material, players_json, elements_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb)
       RETURNING *`,
      [
        req.user.id, entry.name, entry.field_type, entry.theme, entry.home_color,
        entry.away_color, entry.ball_color, entry.category, entry.age_group, entry.goal,
        entry.material, JSON.stringify(entry.players_json), JSON.stringify(entry.elements_json),
      ]
    );
    const board = boardResult.rows[0];

    const dataJson = { label: '', players: entry.players_json, elements: entry.elements_json };
    await client.query(
      `INSERT INTO frames (board_id, order_index, data_json, duration_ms)
       VALUES ($1, 0, $2::jsonb, 1000)`,
      [board.id, JSON.stringify(dataJson)]
    );

    await client.query('COMMIT');
    res.status(201).json(created({ _id: board.id }));
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('[cloneLibraryEntry]', err);
    res.status(500).json(error('Interner Serverfehler'));
  } finally {
    client.release();
  }
}

// POST /api/library/:id/report – ein Report pro Nutzer/Eintrag (UNIQUE-
// Constraint in der DB). Bei Mehrfachmeldung durch denselben Nutzer trotzdem
// success() zurückgeben, das ist kein Fehlerfall aus Nutzersicht.
export async function reportLibraryEntry(req, res) {
  try {
    const entryResult = await pool.query(`SELECT id FROM library_entries WHERE id = $1`, [req.params.id]);
    if (entryResult.rows.length === 0) {
      return res.status(404).json(error('Übung nicht gefunden'));
    }
    const reason = (req.body.reason ?? '').trim();
    try {
      await pool.query(
        `INSERT INTO library_entry_reports (library_entry_id, reported_by, reason) VALUES ($1, $2, $3)`,
        [req.params.id, req.user.id, reason]
      );
    } catch (err) {
      if (err.code !== '23505') throw err; // schon gemeldet – kein Fehler
    }
    res.json(success({ message: 'Meldung übermittelt' }));
  } catch (err) {
    logger.error('[reportLibraryEntry]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// GET /api/admin/library-reports – nur gemeldete Einträge, absteigend nach
// Meldungsanzahl.
export async function listReportedLibraryEntries(req, res) {
  try {
    const result = await pool.query(
      `SELECT le.id, le.name, le.category, le.owner_id, u.display_name,
              COUNT(r.id)::int AS report_count, MAX(r.created_at) AS last_reported_at
       FROM library_entries le
       JOIN library_entry_reports r ON r.library_entry_id = le.id
       LEFT JOIN users u ON u.id = le.owner_id
       GROUP BY le.id, le.name, le.category, le.owner_id, u.display_name
       ORDER BY report_count DESC, last_reported_at DESC`
    );
    res.json(success(result.rows.map((row) => ({
      _id:             row.id,
      name:            row.name,
      category:        row.category,
      ownerDisplayName: row.display_name ?? null,
      reportCount:     row.report_count,
      lastReportedAt:  row.last_reported_at,
    }))));
  } catch (err) {
    logger.error('[listReportedLibraryEntries]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// DELETE /api/library/:id – Owner ODER Admin (Hard-Delete, DSGVO-Löschrecht,
// kein Soft-Removal-Sonderpfad).
export async function deleteLibraryEntry(req, res) {
  try {
    const entryResult = await pool.query(
      `SELECT owner_id FROM library_entries WHERE id = $1`,
      [req.params.id]
    );
    const entry = entryResult.rows[0];
    if (!entry) {
      return res.status(404).json(error('Übung nicht gefunden'));
    }
    if (entry.owner_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json(error('Keine Berechtigung'));
    }
    await pool.query(`DELETE FROM library_entries WHERE id = $1`, [req.params.id]);
    res.json(success({ message: 'Übung entfernt' }));
  } catch (err) {
    logger.error('[deleteLibraryEntry]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}
