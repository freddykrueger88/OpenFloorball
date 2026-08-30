/**
 * gameVideos.test.js – Video-Integration Phase 6 (Statistik-Architektur,
 * ADR-0005): Videos direkt an ein Spiel gehängt, analog videos.test.js
 * für board_videos, aber mit team-basiertem statt Kollaborator-basiertem
 * Zugriffsmodell (wie games.test.js/gameEvents.test.js).
 */
import './setup.js';
import request from 'supertest';
import fs from 'fs';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'gamevideos-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;
const TINY_VIDEO = Buffer.from('nicht wirklich ein mp4, reicht aber für den Speicher-Layer-Test');

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123', birthday: '1990-01-01'});
  return { email, cookie: res.headers['set-cookie'][0] };
}

let owner;
let coach;
let member;
let stranger;
let teamId;
let gameId;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  owner    = await registerAndLogin('owner');
  coach    = await registerAndLogin('coach');
  member   = await registerAndLogin('member');
  stranger = await registerAndLogin('stranger');

  const teamRes = await request(app).post('/api/teams').set('Cookie', owner.cookie).send({ name: 'GameVideos-Test-Team' });
  teamId = teamRes.body.data._id;
  await request(app).post(`/api/teams/${teamId}/members`).set('Cookie', owner.cookie).send({ email: coach.email, role: 'coach' });
  await request(app).post(`/api/teams/${teamId}/members`).set('Cookie', owner.cookie).send({ email: member.email, role: 'member' });

  const gameRes = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Video-Test-Gegner', teamId });
  gameId = gameRes.body.data._id;
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('POST /api/games/:id/videos', () => {
  it('lehnt einen Upload durch einen Fremden mit 404 ab', async () => {
    const res = await request(app)
      .post(`/api/games/${gameId}/videos`)
      .set('Cookie', stranger.cookie)
      .attach('video', TINY_VIDEO, { filename: 'clip.mp4', contentType: 'video/mp4' });
    expect(res.status).toBe(404);
  });

  it('lehnt einen Upload durch ein einfaches Team-Mitglied (kein Coach) mit 404 ab', async () => {
    const res = await request(app)
      .post(`/api/games/${gameId}/videos`)
      .set('Cookie', member.cookie)
      .attach('video', TINY_VIDEO, { filename: 'clip.mp4', contentType: 'video/mp4' });
    expect(res.status).toBe(404);
  });

  it('lehnt einen falschen Dateityp mit 400 ab', async () => {
    const res = await request(app)
      .post(`/api/games/${gameId}/videos`)
      .set('Cookie', owner.cookie)
      .attach('video', TINY_VIDEO, { filename: 'clip.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
  });

  it('erlaubt dem Owner den Upload und legt die Datei auf Disk ab', async () => {
    const res = await request(app)
      .post(`/api/games/${gameId}/videos`)
      .set('Cookie', owner.cookie)
      .field('title', 'Erste Halbzeit')
      .attach('video', TINY_VIDEO, { filename: 'clip.mp4', contentType: 'video/mp4' });
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Erste Halbzeit');
    expect(res.body.data.gameId).toBe(gameId);

    const row = await pool.query('SELECT storage_key FROM game_videos WHERE id = $1', [res.body.data._id]);
    const storageKey = row.rows[0].storage_key;
    expect(fs.existsSync(`${process.env.VIDEOS_DIR || '/app/videos'}/${storageKey}`)).toBe(true);
  });

  it('erlaubt auch einem Coach-Team-Mitglied den Upload', async () => {
    const res = await request(app)
      .post(`/api/games/${gameId}/videos`)
      .set('Cookie', coach.cookie)
      .attach('video', TINY_VIDEO, { filename: 'clip2.webm', contentType: 'video/webm' });
    expect(res.status).toBe(201);
  });

  it('begrenzt auf maximal 5 Videos pro Spiel', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post(`/api/games/${gameId}/videos`)
        .set('Cookie', owner.cookie)
        .attach('video', TINY_VIDEO, { filename: `extra-${i}.mp4`, contentType: 'video/mp4' });
      expect(res.status).toBe(201);
    }

    const overflow = await request(app)
      .post(`/api/games/${gameId}/videos`)
      .set('Cookie', owner.cookie)
      .attach('video', TINY_VIDEO, { filename: 'overflow.mp4', contentType: 'video/mp4' });
    expect(overflow.status).toBe(400);
  });
});

describe('GET /api/games/:id/videos', () => {
  it('listet Videos für Owner und Team-Mitglieder (auch einfache)', async () => {
    const res = await request(app).get(`/api/games/${gameId}/videos`).set('Cookie', member.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('lehnt einen Fremden mit 404 ab', async () => {
    const res = await request(app).get(`/api/games/${gameId}/videos`).set('Cookie', stranger.cookie);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/games/:id/videos/:videoId/stream', () => {
  let videoId;

  beforeAll(async () => {
    const listRes = await request(app).get(`/api/games/${gameId}/videos`).set('Cookie', owner.cookie);
    videoId = listRes.body.data[0]._id;
  });

  it('liefert die Datei mit korrektem Content-Type', async () => {
    const res = await request(app)
      .get(`/api/games/${gameId}/videos/${videoId}/stream`)
      .set('Cookie', member.cookie);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('video/mp4');
  });

  it('unterstützt Range-Requests (Scrubbing im Player)', async () => {
    const res = await request(app)
      .get(`/api/games/${gameId}/videos/${videoId}/stream`)
      .set('Cookie', member.cookie)
      .set('Range', 'bytes=0-9');
    expect(res.status).toBe(206);
    expect(res.headers['content-range']).toMatch(/^bytes 0-9\//);
  });

  it('lehnt einen Fremden mit 404 ab', async () => {
    const res = await request(app)
      .get(`/api/games/${gameId}/videos/${videoId}/stream`)
      .set('Cookie', stranger.cookie);
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/games/:id/videos/:videoId', () => {
  let videoId;

  beforeAll(async () => {
    const listRes = await request(app).get(`/api/games/${gameId}/videos`).set('Cookie', owner.cookie);
    videoId = listRes.body.data[0]._id;
  });

  it('lehnt ein Update durch ein einfaches Team-Mitglied mit 404 ab', async () => {
    const res = await request(app)
      .put(`/api/games/${gameId}/videos/${videoId}`)
      .set('Cookie', member.cookie)
      .send({ title: 'Sollte nicht klappen' });
    expect(res.status).toBe(404);
  });

  it('speichert Szenen-Marken', async () => {
    const markers = [{ timestamp: 12.3, label: 'Ecke' }];
    const res = await request(app)
      .put(`/api/games/${gameId}/videos/${videoId}`)
      .set('Cookie', owner.cookie)
      .send({ markers });
    expect(res.status).toBe(200);
    expect(res.body.data.markers).toEqual(markers);
  });
});

describe('DELETE /api/games/:id/videos/:videoId', () => {
  it('löscht die Datei von Disk beim Löschen', async () => {
    const listRes = await request(app).get(`/api/games/${gameId}/videos`).set('Cookie', owner.cookie);
    const videoId = listRes.body.data[0]._id;
    const row = await pool.query('SELECT storage_key FROM game_videos WHERE id = $1', [videoId]);
    const storageKey = row.rows[0].storage_key;
    const filePath = `${process.env.VIDEOS_DIR || '/app/videos'}/${storageKey}`;
    expect(fs.existsSync(filePath)).toBe(true);

    const res = await request(app)
      .delete(`/api/games/${gameId}/videos/${videoId}`)
      .set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(fs.existsSync(filePath)).toBe(false);
  });
});

describe('Spiel-Löschung räumt verbleibende Video-Dateien auf', () => {
  it('löscht alle Video-Dateien, wenn das Spiel gelöscht wird', async () => {
    const delGameRes = await request(app)
      .post('/api/games')
      .set('Cookie', owner.cookie)
      .send({ opponent: 'Cleanup-Test-Gegner' });
    const delGameId = delGameRes.body.data._id;

    const uploadRes = await request(app)
      .post(`/api/games/${delGameId}/videos`)
      .set('Cookie', owner.cookie)
      .attach('video', TINY_VIDEO, { filename: 'cleanup.mp4', contentType: 'video/mp4' });
    const row = await pool.query('SELECT storage_key FROM game_videos WHERE id = $1', [uploadRes.body.data._id]);
    const filePath = `${process.env.VIDEOS_DIR || '/app/videos'}/${row.rows[0].storage_key}`;
    expect(fs.existsSync(filePath)).toBe(true);

    const deleteRes = await request(app).delete(`/api/games/${delGameId}`).set('Cookie', owner.cookie);
    expect(deleteRes.status).toBe(200);
    expect(fs.existsSync(filePath)).toBe(false);

    const remaining = await pool.query('SELECT id FROM game_videos WHERE game_id = $1', [delGameId]);
    expect(remaining.rows).toHaveLength(0);
  });
});
