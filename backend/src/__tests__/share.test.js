import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'share-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'Testpass123', birthday: '1990-01-01'});
  return { email, cookie: res.headers['set-cookie'][0] };
}

let owner;
let other;
let boardId;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  owner = await registerAndLogin('owner');
  other = await registerAndLogin('other');

  const boardRes = await request(app)
    .post('/api/boards')
    .set('Cookie', owner.cookie)
    .send({ name: 'Share Test Board', fieldType: 'large' });
  boardId = boardRes.body.data._id;

  await request(app)
    .post(`/api/boards/${boardId}/frames`)
    .set('Cookie', owner.cookie)
    .send({ players: [{ id: 'h1', role: 'TW', team: 'home', x: 2, y: 10 }], elements: [] });
  await request(app)
    .post(`/api/boards/${boardId}/frames`)
    .set('Cookie', owner.cookie)
    .send({ players: [{ id: 'h1', role: 'TW', team: 'home', x: 5, y: 10 }], elements: [] });
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('POST /api/boards/:id/share', () => {
  it('lehnt die Erstellung für ein fremdes Board mit 404 ab', async () => {
    const res = await request(app)
      .post(`/api/boards/${boardId}/share`)
      .set('Cookie', other.cookie);
    expect(res.status).toBe(404);
  });

  it('erzeugt einen Share-Link für den Eigentümer', async () => {
    const res = await request(app)
      .post(`/api/boards/${boardId}/share`)
      .set('Cookie', owner.cookie);
    expect(res.status).toBe(201);
    expect(res.body.data.token).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(res.body.data.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});

describe('GET /api/share/:token (öffentlich)', () => {
  let token;

  beforeAll(async () => {
    const res = await request(app)
      .post(`/api/boards/${boardId}/share`)
      .set('Cookie', owner.cookie);
    token = res.body.data.token;
  });

  it('liefert Board + Frames ohne Cookie/Login', async () => {
    const res = await request(app).get(`/api/share/${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Share Test Board');
    expect(res.body.data.fieldType).toBe('large');
    // Boards bekommen seit der Standard-Aufstellungs-Änderung automatisch
    // einen ersten Frame – hier zusätzlich zu den 2 manuell angelegten.
    expect(res.body.data.frames).toHaveLength(3);
    expect(res.body.data.notes).toBeUndefined();
  });

  it('lehnt einen erfundenen Token mit 404 ab', async () => {
    const res = await request(app).get('/api/share/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('lehnt einen ungültig formatierten Token mit 422 ab', async () => {
    const res = await request(app).get('/api/share/nicht-uuid');
    expect(res.status).toBe(422);
  });
});

// Minimales valides 1×1-PNG (transparent), base64-kodiert
const TINY_PNG_DATA_URL = 'data:image/png;base64,'
  + 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

describe('POST /api/export/frame-share', () => {
  it('lehnt ein fremdes Board mit 404 ab', async () => {
    const res = await request(app)
      .post('/api/export/frame-share')
      .set('Cookie', other.cookie)
      .send({ boardId, image: TINY_PNG_DATA_URL });
    expect(res.status).toBe(404);
  });

  it('lehnt eine Anfrage ohne boardId/image mit 400 ab', async () => {
    const res = await request(app)
      .post('/api/export/frame-share')
      .set('Cookie', owner.cookie)
      .send({ boardId });
    expect(res.status).toBe(400);
  });

  it('erzeugt einen Frame-Share für den Eigentümer', async () => {
    const res = await request(app)
      .post('/api/export/frame-share')
      .set('Cookie', owner.cookie)
      .send({ boardId, image: TINY_PNG_DATA_URL });
    expect(res.status).toBe(201);
    expect(res.body.data.token).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('lehnt nicht authentifizierte Anfragen mit 401 ab', async () => {
    const res = await request(app)
      .post('/api/export/frame-share')
      .send({ boardId, image: TINY_PNG_DATA_URL });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/share/frame/:token (öffentlich)', () => {
  let frameToken;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/export/frame-share')
      .set('Cookie', owner.cookie)
      .send({ boardId, image: TINY_PNG_DATA_URL });
    frameToken = res.body.data.token;
  });

  it('liefert das Bild ohne Cookie/Login', async () => {
    const res = await request(app).get(`/api/share/frame/${frameToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
  });

  it('lehnt einen erfundenen Token mit 404 ab', async () => {
    const res = await request(app).get('/api/share/frame/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('wird nach dem Löschen des zugehörigen Boards ungültig (kein weiterhin öffentlich abrufbares Bild)', async () => {
    const boardRes = await request(app)
      .post('/api/boards')
      .set('Cookie', owner.cookie)
      .send({ name: 'Zu löschendes Board', fieldType: 'large' });
    const deletableBoardId = boardRes.body.data._id;

    const shareRes = await request(app)
      .post('/api/export/frame-share')
      .set('Cookie', owner.cookie)
      .send({ boardId: deletableBoardId, image: TINY_PNG_DATA_URL });
    const deletableToken = shareRes.body.data.token;

    const beforeRes = await request(app).get(`/api/share/frame/${deletableToken}`);
    expect(beforeRes.status).toBe(200);

    const deleteRes = await request(app)
      .delete(`/api/boards/${deletableBoardId}`)
      .set('Cookie', owner.cookie);
    expect(deleteRes.status).toBe(200);

    const afterRes = await request(app).get(`/api/share/frame/${deletableToken}`);
    expect(afterRes.status).toBe(404);
  });
});
