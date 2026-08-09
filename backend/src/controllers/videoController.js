/**
 * videoController – Video-Integration (ROADMAP-Backlog:
 * Video-/Spielfilm-Integration)
 *
 * Ein Board kann sich mehrere kurze Videoclips anhängen lassen (z.B.
 * eine konkrete Spielsituation des Gegners), abspielbar über den
 * nativen Browser-Player (Range-Requests für Scrubbing, siehe
 * streamVideo). `updateVideo` deckt darüber hinaus bereits Zeichnungen
 * über dem Video (`elements`), Schnitt/Trimmen (`trimStart`/`trimEnd`)
 * und eine Szenen-Timeline (`markers`) ab – siehe
 * VideoAnnotationOverlay.jsx im Frontend. Die Video-Zeichnung selbst
 * lässt sich zusätzlich als neues, eigenständiges Taktik-Board
 * übernehmen (rein clientseitig, siehe
 * videoElementsToBoardElements.js – keine Backend-Beteiligung nötig).
 *
 * Ablage: Disk (VIDEOS_DIR), nicht als DB-Blob – analog EXPORTS_DIR.
 * Zugriff: wie Frames/Lines/etc. über assertBoardAccess ('write' zum
 * Hochladen/Löschen, 'read' zum Ansehen) – NICHT Owner-only, ein
 * Write-Kollaborator arbeitet aktiv am Board mit wie bei jeder anderen
 * Board-Ressource auch.
 */
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import multer from 'multer';
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { success, created, error } from '../utils/apiResponse.js';
import { assertBoardAccess } from '../utils/boardAccess.js';

const VIDEOS_DIR = process.env.VIDEOS_DIR || '/app/videos';
const MAX_VIDEO_SIZE_MB = parseInt(process.env.MAX_VIDEO_SIZE_MB || '200', 10);
const MAX_VIDEOS_PER_BOARD = 5;
const ALLOWED_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const EXT_BY_MIME = { 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov' };

fs.mkdirSync(VIDEOS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, VIDEOS_DIR),
  filename: (req, file, cb) => {
    const ext = EXT_BY_MIME[file.mimetype] ?? path.extname(file.originalname) ?? '';
    cb(null, `${randomUUID()}${ext}`);
  },
});

export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: MAX_VIDEO_SIZE_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ALLOWED_MIME_TYPES.includes(file.mimetype);
    cb(ok ? null : new Error('Nur MP4/WebM/MOV-Videos erlaubt'), ok);
  },
}).single('video');

function toApiVideo(row) {
  return {
    _id:        row.id,
    filename:   row.filename,
    mimeType:   row.mime_type,
    sizeBytes:  Number(row.size_bytes),
    title:      row.title,
    elements:   row.elements_json,
    trimStart:  row.trim_start_seconds,
    trimEnd:    row.trim_end_seconds,
    markers:    row.markers_json,
    createdAt:  row.created_at,
  };
}

function videoPath(storageKey) {
  return path.join(VIDEOS_DIR, storageKey);
}

// GET /api/boards/:id/videos
export async function getVideos(req, res) {
  try {
    if (!(await assertBoardAccess(req.params.id, req.user.id, 'read'))) {
      return res.status(404).json(error('Board nicht gefunden'));
    }
    const result = await pool.query(
      'SELECT * FROM board_videos WHERE board_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json(success(result.rows.map(toApiVideo)));
  } catch (err) {
    logger.error('[getVideos]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// POST /api/boards/:id/videos (multipart/form-data, Feld "video")
// uploadMiddleware läuft als eigene Multer-Middleware VOR diesem Handler
// (siehe routes/videos.js) – req.file ist zu diesem Zeitpunkt bereits auf
// Disk geschrieben.
export async function uploadVideo(req, res) {
  try {
    if (!(await assertBoardAccess(req.params.id, req.user.id, 'write'))) {
      if (req.file) await fsp.rm(req.file.path, { force: true });
      return res.status(404).json(error('Board nicht gefunden'));
    }
    if (!req.file) {
      return res.status(400).json(error('Keine Video-Datei erhalten'));
    }

    const countResult = await pool.query(
      'SELECT COUNT(*)::int AS count FROM board_videos WHERE board_id = $1',
      [req.params.id]
    );
    if (countResult.rows[0].count >= MAX_VIDEOS_PER_BOARD) {
      await fsp.rm(req.file.path, { force: true });
      return res.status(400).json(error(`Maximal ${MAX_VIDEOS_PER_BOARD} Videos pro Board`));
    }

    const title = typeof req.body.title === 'string' && req.body.title.trim() ? req.body.title.trim() : null;
    const result = await pool.query(
      `INSERT INTO board_videos (board_id, user_id, filename, storage_key, mime_type, size_bytes, title)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.params.id, req.user.id, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size, title]
    );
    res.status(201).json(created(toApiVideo(result.rows[0])));
  } catch (err) {
    if (req.file) await fsp.rm(req.file.path, { force: true }).catch(() => {});
    logger.error('[uploadVideo]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// GET /api/boards/:id/videos/:videoId/stream
// res.sendFile (send-Paket unter der Haube) unterstützt Range-Requests
// automatisch – notwendig fürs Scrubbing im <video>-Player.
export async function streamVideo(req, res) {
  try {
    if (!(await assertBoardAccess(req.params.id, req.user.id, 'read'))) {
      return res.status(404).json(error('Board nicht gefunden'));
    }
    const result = await pool.query(
      'SELECT storage_key, mime_type FROM board_videos WHERE id = $1 AND board_id = $2',
      [req.params.videoId, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json(error('Video nicht gefunden'));
    }
    const { storage_key: storageKey, mime_type: mimeType } = result.rows[0];
    res.sendFile(videoPath(storageKey), { headers: { 'Content-Type': mimeType } }, (err) => {
      if (err && !res.headersSent) res.status(404).json(error('Datei nicht gefunden'));
    });
  } catch (err) {
    logger.error('[streamVideo]', err);
    if (!res.headersSent) res.status(500).json(error('Interner Serverfehler'));
  }
}

// PUT /api/boards/:id/videos/:videoId – partielles Update. Ausbau-Features:
// feste Zeichnungs-Überlagerung (elements), Player-seitige Trim-Grenzen
// (trimStart/trimEnd – nur Wiedergabe, Originaldatei bleibt unangetastet),
// Szenen-Marken (markers). Nur im Body vorhandene Felder werden geändert –
// 'key' in req.body statt !== undefined, damit ein bewusstes { trimStart:
// null } (Trim-Grenze zurücksetzen) nicht mit "nicht übergeben" verwechselt wird.
export async function updateVideo(req, res) {
  try {
    if (!(await assertBoardAccess(req.params.id, req.user.id, 'write'))) {
      return res.status(404).json(error('Board nicht gefunden'));
    }

    const fields = [];
    const values = [];
    let i = 1;

    if ('title' in req.body) {
      const title = typeof req.body.title === 'string' && req.body.title.trim() ? req.body.title.trim() : null;
      fields.push(`title = $${i++}`);
      values.push(title);
    }
    if ('elements' in req.body) {
      if (!Array.isArray(req.body.elements)) {
        return res.status(400).json(error('elements muss ein Array sein'));
      }
      fields.push(`elements_json = $${i++}`);
      values.push(JSON.stringify(req.body.elements));
    }
    if ('trimStart' in req.body) {
      fields.push(`trim_start_seconds = $${i++}`);
      values.push(req.body.trimStart);
    }
    if ('trimEnd' in req.body) {
      fields.push(`trim_end_seconds = $${i++}`);
      values.push(req.body.trimEnd);
    }
    if ('markers' in req.body) {
      if (!Array.isArray(req.body.markers)) {
        return res.status(400).json(error('markers muss ein Array sein'));
      }
      fields.push(`markers_json = $${i++}`);
      values.push(JSON.stringify(req.body.markers));
    }

    if (fields.length === 0) {
      return res.status(400).json(error('Keine Änderungen übergeben'));
    }

    values.push(req.params.videoId, req.params.id);
    const result = await pool.query(
      `UPDATE board_videos SET ${fields.join(', ')} WHERE id = $${i++} AND board_id = $${i} RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      return res.status(404).json(error('Video nicht gefunden'));
    }
    res.json(success(toApiVideo(result.rows[0])));
  } catch (err) {
    logger.error('[updateVideo]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// DELETE /api/boards/:id/videos/:videoId
export async function deleteVideo(req, res) {
  try {
    if (!(await assertBoardAccess(req.params.id, req.user.id, 'write'))) {
      return res.status(404).json(error('Board nicht gefunden'));
    }
    const result = await pool.query(
      'DELETE FROM board_videos WHERE id = $1 AND board_id = $2 RETURNING storage_key',
      [req.params.videoId, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json(error('Video nicht gefunden'));
    }
    await fsp.rm(videoPath(result.rows[0].storage_key), { force: true });
    res.json(success({ message: 'Video gelöscht' }));
  } catch (err) {
    logger.error('[deleteVideo]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// Von boardsController.js/deleteBoard aufgerufen: Boards werden nur soft-
// deleted (deleted_at), der ON DELETE CASCADE der Tabelle greift daher nie
// von selbst – Video-Dateien würden sonst für immer auf Platte liegen
// bleiben, obwohl das Board aus Nutzersicht gelöscht ist.
export async function deleteVideosForBoard(boardId) {
  const result = await pool.query(
    'DELETE FROM board_videos WHERE board_id = $1 RETURNING storage_key',
    [boardId]
  );
  await Promise.all(
    result.rows.map((row) => fsp.rm(videoPath(row.storage_key), { force: true }).catch(() => {}))
  );
}
