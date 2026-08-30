import './setup.js';
import request from 'supertest';
import fs from 'fs';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'video-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;
const TINY_VIDEO = Buffer.from('nicht wirklich ein mp4, reicht aber für den Speicher-Layer-Test');

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123', birthday: '1990-01-01'});
  return { email, cookie: res.headers['set-cookie'][0] };
}

let owner;
let writeCollab;
let readCollab;
let stranger;
let boardId;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  owner       = await registerAndLogin('owner');
  writeCollab = await registerAndLogin('write');
  readCollab  = await registerAndLogin('read');
  stranger    = await registerAndLogin('stranger');

  const boardRes = await request(app)
    .post('/api/boards')
    .set('Cookie', owner.cookie)
    .send({ name: 'Video Test Board', fieldType: 'large' });
  boardId = boardRes.body.data._id;

  await request(app).post(`/api/boards/${boardId}/collaborators`).set('Cookie', owner.cookie)
    .send({ email: writeCollab.email, permission: 'write' });
  await request(app).post(`/api/boards/${boardId}/collaborators`).set('Cookie', owner.cookie)
    .send({ email: readCollab.email, permission: 'read' });
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('POST /api/boards/:id/videos', () => {
  it('lehnt einen Upload durch einen Fremden mit 404 ab', async () => {
    const res = await request(app)
      .post(`/api/boards/${boardId}/videos`)
      .set('Cookie', stranger.cookie)
      .attach('video', TINY_VIDEO, { filename: 'clip.mp4', contentType: 'video/mp4' });
    expect(res.status).toBe(404);
  });

  it('lehnt einen Upload durch einen Read-Kollaborator mit 404 ab', async () => {
    const res = await request(app)
      .post(`/api/boards/${boardId}/videos`)
      .set('Cookie', readCollab.cookie)
      .attach('video', TINY_VIDEO, { filename: 'clip.mp4', contentType: 'video/mp4' });
    expect(res.status).toBe(404);
  });

  it('lehnt einen falschen Dateityp mit 400 ab', async () => {
    const res = await request(app)
      .post(`/api/boards/${boardId}/videos`)
      .set('Cookie', owner.cookie)
      .attach('video', TINY_VIDEO, { filename: 'clip.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
  });

  it('erlaubt dem Owner den Upload und legt die Datei auf Disk ab', async () => {
    const res = await request(app)
      .post(`/api/boards/${boardId}/videos`)
      .set('Cookie', owner.cookie)
      .field('title', 'Gegner Ecke 3. Minute')
      .attach('video', TINY_VIDEO, { filename: 'clip.mp4', contentType: 'video/mp4' });
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Gegner Ecke 3. Minute');
    expect(res.body.data.mimeType).toBe('video/mp4');
    expect(res.body.data.sizeBytes).toBe(TINY_VIDEO.length);

    const row = await pool.query('SELECT storage_key FROM board_videos WHERE id = $1', [res.body.data._id]);
    const storageKey = row.rows[0].storage_key;
    expect(fs.existsSync(`${process.env.VIDEOS_DIR || '/app/videos'}/${storageKey}`)).toBe(true);
  });

  it('erlaubt auch einem Write-Kollaborator den Upload', async () => {
    const res = await request(app)
      .post(`/api/boards/${boardId}/videos`)
      .set('Cookie', writeCollab.cookie)
      .attach('video', TINY_VIDEO, { filename: 'clip2.webm', contentType: 'video/webm' });
    expect(res.status).toBe(201);
  });

  it('begrenzt auf maximal 5 Videos pro Board', async () => {
    // Es existieren bereits 2 aus den vorigen Tests, 3 weitere bis zum Limit
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post(`/api/boards/${boardId}/videos`)
        .set('Cookie', owner.cookie)
        .attach('video', TINY_VIDEO, { filename: `extra-${i}.mp4`, contentType: 'video/mp4' });
      expect(res.status).toBe(201);
    }

    const overflow = await request(app)
      .post(`/api/boards/${boardId}/videos`)
      .set('Cookie', owner.cookie)
      .attach('video', TINY_VIDEO, { filename: 'overflow.mp4', contentType: 'video/mp4' });
    expect(overflow.status).toBe(400);
  });
});

describe('GET /api/boards/:id/videos', () => {
  it('listet Videos für Owner und Kollaboratoren (auch read)', async () => {
    const res = await request(app).get(`/api/boards/${boardId}/videos`).set('Cookie', readCollab.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('lehnt einen Fremden mit 404 ab', async () => {
    const res = await request(app).get(`/api/boards/${boardId}/videos`).set('Cookie', stranger.cookie);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/boards/:id/videos/:videoId/stream', () => {
  let videoId;

  beforeAll(async () => {
    const listRes = await request(app).get(`/api/boards/${boardId}/videos`).set('Cookie', owner.cookie);
    videoId = listRes.body.data[0]._id;
  });

  it('liefert die Datei mit korrektem Content-Type', async () => {
    const res = await request(app)
      .get(`/api/boards/${boardId}/videos/${videoId}/stream`)
      .set('Cookie', readCollab.cookie);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('video/mp4');
  });

  it('unterstützt Range-Requests (Scrubbing im Player)', async () => {
    const res = await request(app)
      .get(`/api/boards/${boardId}/videos/${videoId}/stream`)
      .set('Cookie', readCollab.cookie)
      .set('Range', 'bytes=0-9');
    expect(res.status).toBe(206);
    expect(res.headers['content-range']).toMatch(/^bytes 0-9\//);
  });

  it('lehnt einen Fremden mit 404 ab', async () => {
    const res = await request(app)
      .get(`/api/boards/${boardId}/videos/${videoId}/stream`)
      .set('Cookie', stranger.cookie);
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/boards/:id/videos/:videoId', () => {
  let putBoardId;
  let putVideoId;

  beforeAll(async () => {
    const boardRes = await request(app)
      .post('/api/boards')
      .set('Cookie', owner.cookie)
      .send({ name: 'Video Update Test Board', fieldType: 'large' });
    putBoardId = boardRes.body.data._id;

    await request(app).post(`/api/boards/${putBoardId}/collaborators`).set('Cookie', owner.cookie)
      .send({ email: readCollab.email, permission: 'read' });

    const uploadRes = await request(app)
      .post(`/api/boards/${putBoardId}/videos`)
      .set('Cookie', owner.cookie)
      .attach('video', TINY_VIDEO, { filename: 'update-me.mp4', contentType: 'video/mp4' });
    putVideoId = uploadRes.body.data._id;
  });

  it('lehnt ein Update durch einen Read-Kollaborator mit 404 ab', async () => {
    const res = await request(app)
      .put(`/api/boards/${putBoardId}/videos/${putVideoId}`)
      .set('Cookie', readCollab.cookie)
      .send({ title: 'Sollte nicht klappen' });
    expect(res.status).toBe(404);
  });

  it('lehnt einen leeren Body mit 400 ab', async () => {
    const res = await request(app)
      .put(`/api/boards/${putBoardId}/videos/${putVideoId}`)
      .set('Cookie', owner.cookie)
      .send({});
    expect(res.status).toBe(400);
  });

  it('speichert eine feste Zeichnungs-Überlagerung (elements) unabhängig von Trim/Marken', async () => {
    const elements = [{ id: 'el1', type: 'pass', x1: 0, y1: 0, x2: 1, y2: 1, color: '#fff', strokeWidth: 3, dash: [], arrowHead: true }];
    const res = await request(app)
      .put(`/api/boards/${putBoardId}/videos/${putVideoId}`)
      .set('Cookie', owner.cookie)
      .send({ elements });
    expect(res.status).toBe(200);
    expect(res.body.data.elements).toEqual(elements);
    // Andere Felder bleiben von diesem partiellen Update unangetastet
    expect(res.body.data.trimStart).toBeNull();
    expect(res.body.data.markers).toEqual([]);
  });

  it('speichert Trim-Grenzen (Player-seitig, Originaldatei bleibt unangetastet)', async () => {
    const res = await request(app)
      .put(`/api/boards/${putBoardId}/videos/${putVideoId}`)
      .set('Cookie', owner.cookie)
      .send({ trimStart: 5.5, trimEnd: 42 });
    expect(res.status).toBe(200);
    expect(res.body.data.trimStart).toBe(5.5);
    expect(res.body.data.trimEnd).toBe(42);
    // Aus dem vorigen Test noch vorhandene elements bleiben unverändert
    expect(res.body.data.elements).toHaveLength(1);
  });

  it('kann eine Trim-Grenze explizit wieder auf null zurücksetzen', async () => {
    const res = await request(app)
      .put(`/api/boards/${putBoardId}/videos/${putVideoId}`)
      .set('Cookie', owner.cookie)
      .send({ trimStart: null });
    expect(res.status).toBe(200);
    expect(res.body.data.trimStart).toBeNull();
    expect(res.body.data.trimEnd).toBe(42); // unverändert, nicht Teil dieses Updates
  });

  it('speichert Szenen-Marken', async () => {
    const markers = [{ timestamp: 12.3, label: 'Ecke' }, { timestamp: 30, label: 'Freischlag' }];
    const res = await request(app)
      .put(`/api/boards/${putBoardId}/videos/${putVideoId}`)
      .set('Cookie', owner.cookie)
      .send({ markers });
    expect(res.status).toBe(200);
    expect(res.body.data.markers).toEqual(markers);
  });

  it('lehnt nicht-Array-Werte für elements/markers mit 400 ab', async () => {
    const res = await request(app)
      .put(`/api/boards/${putBoardId}/videos/${putVideoId}`)
      .set('Cookie', owner.cookie)
      .send({ elements: 'nicht ein array' });
    expect(res.status).toBe(400);
  });

  it('Änderungen überstehen einen erneuten GET (Persistenz-Roundtrip)', async () => {
    const listRes = await request(app).get(`/api/boards/${putBoardId}/videos`).set('Cookie', owner.cookie);
    const video = listRes.body.data.find((v) => v._id === putVideoId);
    expect(video.elements).toHaveLength(1);
    expect(video.trimEnd).toBe(42);
    expect(video.markers).toHaveLength(2);
  });
});

describe('DELETE /api/boards/:id/videos/:videoId', () => {
  it('lehnt einen Read-Kollaborator mit 404 ab', async () => {
    const listRes = await request(app).get(`/api/boards/${boardId}/videos`).set('Cookie', owner.cookie);
    const videoId = listRes.body.data[0]._id;
    const res = await request(app)
      .delete(`/api/boards/${boardId}/videos/${videoId}`)
      .set('Cookie', readCollab.cookie);
    expect(res.status).toBe(404);
  });

  it('löscht die Datei von Disk beim Löschen', async () => {
    const listRes = await request(app).get(`/api/boards/${boardId}/videos`).set('Cookie', owner.cookie);
    const videoId = listRes.body.data[0]._id;
    const row = await pool.query('SELECT storage_key FROM board_videos WHERE id = $1', [videoId]);
    const storageKey = row.rows[0].storage_key;
    const filePath = `${process.env.VIDEOS_DIR || '/app/videos'}/${storageKey}`;
    expect(fs.existsSync(filePath)).toBe(true);

    const res = await request(app)
      .delete(`/api/boards/${boardId}/videos/${videoId}`)
      .set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(fs.existsSync(filePath)).toBe(false);
  });
});

describe('Board-Löschung räumt verbleibende Video-Dateien auf', () => {
  it('löscht alle Video-Dateien, wenn das Board gelöscht wird', async () => {
    const delBoardRes = await request(app)
      .post('/api/boards')
      .set('Cookie', owner.cookie)
      .send({ name: 'Video-Cleanup-Board', fieldType: 'large' });
    const delBoardId = delBoardRes.body.data._id;

    const uploadRes = await request(app)
      .post(`/api/boards/${delBoardId}/videos`)
      .set('Cookie', owner.cookie)
      .attach('video', TINY_VIDEO, { filename: 'cleanup.mp4', contentType: 'video/mp4' });
    const row = await pool.query('SELECT storage_key FROM board_videos WHERE id = $1', [uploadRes.body.data._id]);
    const filePath = `${process.env.VIDEOS_DIR || '/app/videos'}/${row.rows[0].storage_key}`;
    expect(fs.existsSync(filePath)).toBe(true);

    const deleteRes = await request(app).delete(`/api/boards/${delBoardId}`).set('Cookie', owner.cookie);
    expect(deleteRes.status).toBe(200);
    expect(fs.existsSync(filePath)).toBe(false);

    const remaining = await pool.query('SELECT id FROM board_videos WHERE board_id = $1', [delBoardId]);
    expect(remaining.rows).toHaveLength(0);
  });
});
