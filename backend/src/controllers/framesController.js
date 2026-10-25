/**
 * framesController – CRUD + Reorder für Frames eines Boards
 *
 * Persistenz: eigene `frames`-Tabelle (Postgres), 1 Zeile pro Frame,
 * referenziert über board_id. data_json hält { players, elements }.
 * Jeder Zugriff wird über assertBoardAccess() abgesichert (Owner oder
 * Kollaborator mit ausreichender Berechtigung, Issue #51).
 */
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { success, created, error } from '../utils/apiResponse.js';
import { assertBoardAccess } from '../utils/boardAccess.js';
import { snapshotBoardVersion } from './boardVersionsController.js';

const MAX_FRAMES = 50;

export function toApiFrame(row) {
  const data = row.data_json || {};
  return {
    _id:       row.id,
    order:     row.order_index,
    label:     data.label ?? '',
    players:   data.players ?? [],
    elements:  data.elements ?? [],
    duration:  row.duration_ms,
    updatedAt: row.updated_at,
  };
}

// GET /api/boards/:id/frames
export async function getFrames(req, res) {
  try {
    if (!(await assertBoardAccess(req.params.id, req.user.id, 'read'))) {
      return res.status(404).json(error('Board nicht gefunden'));
    }
    const result = await pool.query(
      'SELECT * FROM frames WHERE board_id = $1 ORDER BY order_index ASC',
      [req.params.id]
    );
    res.json(success(result.rows.map(toApiFrame)));
  } catch (err) {
    logger.error('[getFrames]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// POST /api/boards/:id/frames
export async function addFrame(req, res) {
  const client = await pool.connect();
  try {
    if (!(await assertBoardAccess(req.params.id, req.user.id, 'write'))) {
      return res.status(404).json(error('Board nicht gefunden'));
    }

    await client.query('BEGIN');

    const countResult = await client.query(
      'SELECT COUNT(*)::int AS count FROM frames WHERE board_id = $1',
      [req.params.id]
    );
    const order = countResult.rows[0].count;
    if (order >= MAX_FRAMES) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(`Maximal ${MAX_FRAMES} Frames pro Board`));
    }

    const dataJson = {
      label:    req.body?.label ?? '',
      players:  req.body?.players ?? [],
      elements: req.body?.elements ?? [],
    };

    const insertResult = await client.query(
      `INSERT INTO frames (board_id, order_index, data_json, duration_ms)
       VALUES ($1, $2, $3::jsonb, $4)
       RETURNING *`,
      [req.params.id, order, JSON.stringify(dataJson), req.body?.duration ?? 1000]
    );

    await client.query('COMMIT');
    res.status(201).json(created(toApiFrame(insertResult.rows[0])));
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('[addFrame]', err);
    res.status(500).json(error('Interner Serverfehler'));
  } finally {
    client.release();
  }
}

// PUT /api/boards/:id/frames/:frameId
export async function updateFrame(req, res) {
  try {
    if (!(await assertBoardAccess(req.params.id, req.user.id, 'write'))) {
      return res.status(404).json(error('Board nicht gefunden'));
    }

    const existing = await pool.query(
      'SELECT * FROM frames WHERE id = $1 AND board_id = $2',
      [req.params.frameId, req.params.id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json(error('Frame nicht gefunden'));
    }

    const currentData = existing.rows[0].data_json || {};
    const body = req.body ?? {};
    const nextData = {
      label:    body.label    !== undefined ? body.label    : currentData.label,
      players:  body.players  !== undefined ? body.players  : currentData.players,
      elements: body.elements !== undefined ? body.elements : currentData.elements,
    };
    const duration = body.duration !== undefined ? body.duration : existing.rows[0].duration_ms;

    const result = await pool.query(
      `UPDATE frames SET data_json = $1::jsonb, duration_ms = $2
       WHERE id = $3 RETURNING *`,
      [JSON.stringify(nextData), duration, req.params.frameId]
    );

    // ROADMAP Phase 2: automatische Versionierung bei jedem Speichern
    // (mit Aufbewahrungsgrenze, siehe boardVersionsController.js)
    await snapshotBoardVersion(req.params.id, req.user.id);

    res.json(success(toApiFrame(result.rows[0])));
  } catch (err) {
    logger.error('[updateFrame]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// DELETE /api/boards/:id/frames/:frameId
export async function deleteFrame(req, res) {
  const client = await pool.connect();
  try {
    if (!(await assertBoardAccess(req.params.id, req.user.id, 'write'))) {
      return res.status(404).json(error('Board nicht gefunden'));
    }

    await client.query('BEGIN');

    const countResult = await client.query(
      'SELECT COUNT(*)::int AS count FROM frames WHERE board_id = $1',
      [req.params.id]
    );
    if (countResult.rows[0].count <= 1) {
      await client.query('ROLLBACK');
      return res.status(400).json(error('Mindestens 1 Frame muss erhalten bleiben'));
    }

    const del = await client.query(
      'DELETE FROM frames WHERE id = $1 AND board_id = $2 RETURNING id',
      [req.params.frameId, req.params.id]
    );
    if (del.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error('Frame nicht gefunden'));
    }

    // Reihenfolge normalisieren (0..n-1)
    const remaining = await client.query(
      'SELECT id FROM frames WHERE board_id = $1 ORDER BY order_index ASC',
      [req.params.id]
    );
    await Promise.all(
      remaining.rows.map((row, idx) =>
        client.query('UPDATE frames SET order_index = $1 WHERE id = $2', [idx, row.id]))
    );

    await client.query('COMMIT');
    res.json(success({ message: 'Frame gelöscht' }));
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('[deleteFrame]', err);
    res.status(500).json(error('Interner Serverfehler'));
  } finally {
    client.release();
  }
}

// PUT /api/boards/:id/frames/reorder   Body: { order: [frameId1, frameId2, ...] }
export async function reorderFrames(req, res) {
  const client = await pool.connect();
  try {
    if (!(await assertBoardAccess(req.params.id, req.user.id, 'write'))) {
      return res.status(404).json(error('Board nicht gefunden'));
    }

    const { order } = req.body ?? {};
    if (!Array.isArray(order)) {
      return res.status(400).json(error('"order" muss ein Array von Frame-IDs sein'));
    }

    await client.query('BEGIN');
    await Promise.all(
      order.map((frameId, idx) =>
        client.query(
          'UPDATE frames SET order_index = $1 WHERE id = $2 AND board_id = $3',
          [idx, frameId, req.params.id]
        ))
    );
    await client.query('COMMIT');

    const result = await pool.query(
      'SELECT * FROM frames WHERE board_id = $1 ORDER BY order_index ASC',
      [req.params.id]
    );
    res.json(success(result.rows.map(toApiFrame)));
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('[reorderFrames]', err);
    res.status(500).json(error('Interner Serverfehler'));
  } finally {
    client.release();
  }
}
