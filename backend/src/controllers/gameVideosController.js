/**
 * gameVideosController – Video-Integration Phase 6 (Statistik-Architektur,
 * ADR-0005 in docs/planning/DECISIONS.md): Videos direkt an ein Spiel
 * gehängt (statt an ein Board), damit game_events.videoId/
 * videoTimestampSeconds auf ein konkretes Video zeigen können ("Event →
 * Video springen").
 *
 * Bewusst eine EIGENE Tabelle/Controller statt board_videos
 * wiederzuverwenden – spiegelt videoController.js praktisch 1:1
 * (gleiche Disk-Ablage, gleiches Update-/Trim-/Marken-Modell), nutzt aber
 * assertGameRead/-Write statt assertBoardAccess (siehe Migrationskommentar
 * in db/migrate.js für die Begründung). Die Zeichnungs-Überlagerung
 * (elements) und Szenen-Marken (markers) sind hier genauso nutzbar wie bei
 * Board-Videos – ein Coach kann eine Spielszene im Nachhinein genauso
 * markieren wie ein Gegner-Clip am Board.
 *
 * Ablage: Disk (VIDEOS_DIR), gemeinsam mit board_videos genutzt (kein
 * getrennter Ordner nötig – storage_key ist über beide Tabellen hinweg
 * eindeutig, da randomUUID()-basiert).
 */
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import multer from 'multer';
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { success, created, error } from '../utils/apiResponse.js';
import { assertGameRead, assertGameWrite } from './gamesController.js';

const VIDEOS_DIR = process.env.VIDEOS_DIR || '/app/videos';
const MAX_VIDEO_SIZE_MB = parseInt(process.env.MAX_VIDEO_SIZE_MB || '200', 10);
const MAX_VIDEOS_PER_GAME = 5;
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
    gameId:     row.game_id,
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

// GET /api/games/:id/videos
export async function getVideos(req, res) {
  try {
    if (!(await assertGameRead(req.params.id, req.user.id))) {
      return res.status(404).json(error('Spiel nicht gefunden'));
    }
    const result = await pool.query(
      'SELECT * FROM game_videos WHERE game_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json(success(result.rows.map(toApiVideo)));
  } catch (err) {
    logger.error('[getGameVideos]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// POST /api/games/:id/videos (multipart/form-data, Feld "video")
export async function uploadVideo(req, res) {
  try {
    if (!(await assertGameWrite(req.params.id, req.user.id))) {
      if (req.file) await fsp.rm(req.file.path, { force: true });
      return res.status(404).json(error('Spiel nicht gefunden'));
    }
    if (!req.file) {
      return res.status(400).json(error('Keine Video-Datei erhalten'));
    }

    const countResult = await pool.query(
      'SELECT COUNT(*)::int AS count FROM game_videos WHERE game_id = $1',
      [req.params.id]
    );
    if (countResult.rows[0].count >= MAX_VIDEOS_PER_GAME) {
      await fsp.rm(req.file.path, { force: true });
      return res.status(400).json(error(`Maximal ${MAX_VIDEOS_PER_GAME} Videos pro Spiel`));
    }

    const title = typeof req.body.title === 'string' && req.body.title.trim() ? req.body.title.trim() : null;
    const result = await pool.query(
      `INSERT INTO game_videos (game_id, user_id, filename, storage_key, mime_type, size_bytes, title)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.params.id, req.user.id, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size, title]
    );
    res.status(201).json(created(toApiVideo(result.rows[0])));
  } catch (err) {
    if (req.file) await fsp.rm(req.file.path, { force: true }).catch(() => {});
    logger.error('[uploadGameVideo]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// GET /api/games/:id/videos/:videoId/stream
export async function streamVideo(req, res) {
  try {
    if (!(await assertGameRead(req.params.id, req.user.id))) {
      return res.status(404).json(error('Spiel nicht gefunden'));
    }
    const result = await pool.query(
      'SELECT storage_key, mime_type FROM game_videos WHERE id = $1 AND game_id = $2',
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
    logger.error('[streamGameVideo]', err);
    if (!res.headersSent) res.status(500).json(error('Interner Serverfehler'));
  }
}

// PUT /api/games/:id/videos/:videoId – partielles Update, identisches
// Muster zu videoController.js/updateVideo ('key' in req.body statt
// !== undefined, damit { trimStart: null } bewusstes Zurücksetzen bleibt).
export async function updateVideo(req, res) {
  try {
    if (!(await assertGameWrite(req.params.id, req.user.id))) {
      return res.status(404).json(error('Spiel nicht gefunden'));
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
      `UPDATE game_videos SET ${fields.join(', ')} WHERE id = $${i++} AND game_id = $${i} RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      return res.status(404).json(error('Video nicht gefunden'));
    }
    res.json(success(toApiVideo(result.rows[0])));
  } catch (err) {
    logger.error('[updateGameVideo]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// DELETE /api/games/:id/videos/:videoId
export async function deleteVideo(req, res) {
  try {
    if (!(await assertGameWrite(req.params.id, req.user.id))) {
      return res.status(404).json(error('Spiel nicht gefunden'));
    }
    const result = await pool.query(
      'DELETE FROM game_videos WHERE id = $1 AND game_id = $2 RETURNING storage_key',
      [req.params.videoId, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json(error('Video nicht gefunden'));
    }
    await fsp.rm(videoPath(result.rows[0].storage_key), { force: true });
    res.json(success({ message: 'Video gelöscht' }));
  } catch (err) {
    logger.error('[deleteGameVideo]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// Von gamesController.js/deleteGame aufgerufen: games werden hart gelöscht
// (ON DELETE CASCADE räumt game_videos-Zeilen selbst auf), aber die
// zugehörigen Dateien auf Disk müssen VOR dem Löschen des Spiels explizit
// eingesammelt und danach entfernt werden – der CASCADE kennt keine Dateien.
export async function deleteVideosForGame(gameId) {
  const result = await pool.query('SELECT storage_key FROM game_videos WHERE game_id = $1', [gameId]);
  await Promise.all(
    result.rows.map((row) => fsp.rm(videoPath(row.storage_key), { force: true }).catch(() => {}))
  );
}
