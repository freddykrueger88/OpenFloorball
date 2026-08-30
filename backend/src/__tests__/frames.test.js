import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'frames-test-';
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
    .send({ name: 'Frames Test Board', fieldType: 'large' });
  boardId = boardRes.body.data._id;
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('GET /api/boards/:id/frames', () => {
  it('liefert den automatisch angelegten ersten Frame', async () => {
    const res = await request(app)
      .get(`/api/boards/${boardId}/frames`)
      .set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].order).toBe(0);
  });

  it('verweigert einem fremden User den Zugriff mit 404', async () => {
    const res = await request(app)
      .get(`/api/boards/${boardId}/frames`)
      .set('Cookie', other.cookie);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/boards/:id/frames', () => {
  it('legt einen neuen Frame mit Spielern/Elementen an', async () => {
    const res = await request(app)
      .post(`/api/boards/${boardId}/frames`)
      .set('Cookie', owner.cookie)
      .send({
        label: 'Frame 2',
        players: [{ id: 'h1', role: 'TW', team: 'home', x: 2, y: 10 }],
        elements: [{ type: 'move', x1: 1, y1: 1, x2: 2, y2: 2 }],
        duration: 1500,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.label).toBe('Frame 2');
    expect(res.body.data.order).toBe(1);
    expect(res.body.data.players).toHaveLength(1);
    expect(res.body.data.duration).toBe(1500);
  });

  it('lehnt ein zu langes Label mit 422 ab', async () => {
    const res = await request(app)
      .post(`/api/boards/${boardId}/frames`)
      .set('Cookie', owner.cookie)
      .send({ label: 'x'.repeat(61) });
    expect(res.status).toBe(422);
  });

  it('lehnt eine Duration außerhalb 100-10000 mit 422 ab', async () => {
    const res = await request(app)
      .post(`/api/boards/${boardId}/frames`)
      .set('Cookie', owner.cookie)
      .send({ duration: 50 });
    expect(res.status).toBe(422);
  });

  it('verweigert einem fremden User das Anlegen mit 404', async () => {
    const res = await request(app)
      .post(`/api/boards/${boardId}/frames`)
      .set('Cookie', other.cookie)
      .send({ label: 'Fremd' });
    expect(res.status).toBe(404);
  });

  it('lehnt einen 51. Frame mit 400 ab (Maximal 50 Frames pro Board)', async () => {
    // Board hat bereits 2 Frames (Auto-Seed + "Frame 2" oben) – 48 weitere
    // bis zum Limit auffüllen, dann den 51. testen.
    for (let i = 0; i < 48; i++) {
      const res = await request(app)
        .post(`/api/boards/${boardId}/frames`)
        .set('Cookie', owner.cookie)
        .send({});
      expect(res.status).toBe(201);
    }
    const overLimit = await request(app)
      .post(`/api/boards/${boardId}/frames`)
      .set('Cookie', owner.cookie)
      .send({});
    expect(overLimit.status).toBe(400);
  }, 30000);
});

describe('PUT /api/boards/:id/frames/:frameId', () => {
  let frameId;

  beforeAll(async () => {
    const res = await request(app)
      .post(`/api/boards/${boardId}/frames`)
      .set('Cookie', owner.cookie)
      .send({ label: 'Update Target' });
    // Kann am MAX_FRAMES-Limit aus der vorherigen describe-Suite scheitern –
    // dann stattdessen den zuletzt existierenden Frame verwenden.
    if (res.status === 201) {
      frameId = res.body.data._id;
    } else {
      const list = await request(app).get(`/api/boards/${boardId}/frames`).set('Cookie', owner.cookie);
      frameId = list.body.data[list.body.data.length - 1]._id;
    }
  });

  it('aktualisiert nur die übergebenen Felder (partial update)', async () => {
    const res = await request(app)
      .put(`/api/boards/${boardId}/frames/${frameId}`)
      .set('Cookie', owner.cookie)
      .send({ players: [{ id: 'a1', role: 'TW', team: 'away', x: 38, y: 10 }] });
    expect(res.status).toBe(200);
    expect(res.body.data.players).toHaveLength(1);
    expect(res.body.data.players[0].id).toBe('a1');
  });

  it('liefert updatedAt und aktualisiert es bei jedem Speichern (ROADMAP Phase 4 – Voraussetzung für Offline-Konflikterkennung)', async () => {
    const first = await request(app)
      .put(`/api/boards/${boardId}/frames/${frameId}`)
      .set('Cookie', owner.cookie)
      .send({ players: [] });
    expect(first.body.data.updatedAt).toBeDefined();

    await new Promise((resolve) => setTimeout(resolve, 50));

    const second = await request(app)
      .put(`/api/boards/${boardId}/frames/${frameId}`)
      .set('Cookie', owner.cookie)
      .send({ players: [] });
    expect(new Date(second.body.data.updatedAt).getTime())
      .toBeGreaterThan(new Date(first.body.data.updatedAt).getTime());

    const list = await request(app).get(`/api/boards/${boardId}/frames`).set('Cookie', owner.cookie);
    const listed = list.body.data.find((f) => f._id === frameId);
    expect(listed.updatedAt).toBe(second.body.data.updatedAt);
  });

  it('lehnt eine ungültige Frame-ID mit 422 ab', async () => {
    const res = await request(app)
      .put(`/api/boards/${boardId}/frames/not-a-uuid`)
      .set('Cookie', owner.cookie)
      .send({ label: 'x' });
    expect(res.status).toBe(422);
  });

  it('liefert 404 für einen nicht existierenden Frame', async () => {
    const res = await request(app)
      .put(`/api/boards/${boardId}/frames/00000000-0000-0000-0000-000000000000`)
      .set('Cookie', owner.cookie)
      .send({ label: 'x' });
    expect(res.status).toBe(404);
  });

  it('verweigert einem fremden User das Ändern mit 404', async () => {
    const res = await request(app)
      .put(`/api/boards/${boardId}/frames/${frameId}`)
      .set('Cookie', other.cookie)
      .send({ label: 'x' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/boards/:id/frames/:frameId', () => {
  it('löscht einen Frame und normalisiert die Reihenfolge', async () => {
    const list = await request(app).get(`/api/boards/${boardId}/frames`).set('Cookie', owner.cookie);
    const toDelete = list.body.data[list.body.data.length - 1];

    const res = await request(app)
      .delete(`/api/boards/${boardId}/frames/${toDelete._id}`)
      .set('Cookie', owner.cookie);
    expect(res.status).toBe(200);

    const after = await request(app).get(`/api/boards/${boardId}/frames`).set('Cookie', owner.cookie);
    expect(after.body.data.map((f) => f.order)).toEqual([...Array(after.body.data.length).keys()]);
  });

  it('verweigert das Löschen des letzten verbleibenden Frames mit 400', async () => {
    // Alle Frames bis auf einen löschen
    let list = await request(app).get(`/api/boards/${boardId}/frames`).set('Cookie', owner.cookie);
    while (list.body.data.length > 1) {
      const target = list.body.data[list.body.data.length - 1];
      await request(app).delete(`/api/boards/${boardId}/frames/${target._id}`).set('Cookie', owner.cookie);
      list = await request(app).get(`/api/boards/${boardId}/frames`).set('Cookie', owner.cookie);
    }
    const last = list.body.data[0];
    const res = await request(app)
      .delete(`/api/boards/${boardId}/frames/${last._id}`)
      .set('Cookie', owner.cookie);
    expect(res.status).toBe(400);
  }, 30000);

  it('verweigert einem fremden User das Löschen mit 404', async () => {
    const list = await request(app).get(`/api/boards/${boardId}/frames`).set('Cookie', owner.cookie);
    const res = await request(app)
      .delete(`/api/boards/${boardId}/frames/${list.body.data[0]._id}`)
      .set('Cookie', other.cookie);
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/boards/:id/frames/reorder', () => {
  let reorderBoardId;
  let frameIds;

  beforeAll(async () => {
    const boardRes = await request(app)
      .post('/api/boards')
      .set('Cookie', owner.cookie)
      .send({ name: 'Reorder Board', fieldType: 'large' });
    reorderBoardId = boardRes.body.data._id;

    await request(app).post(`/api/boards/${reorderBoardId}/frames`).set('Cookie', owner.cookie).send({ label: 'B' });
    await request(app).post(`/api/boards/${reorderBoardId}/frames`).set('Cookie', owner.cookie).send({ label: 'C' });

    const list = await request(app).get(`/api/boards/${reorderBoardId}/frames`).set('Cookie', owner.cookie);
    frameIds = list.body.data.map((f) => f._id); // [A(auto-seed), B, C]
  });

  it('ändert die Reihenfolge entsprechend dem übergebenen Array', async () => {
    const newOrder = [frameIds[2], frameIds[0], frameIds[1]]; // C, A, B
    const res = await request(app)
      .put(`/api/boards/${reorderBoardId}/frames/reorder`)
      .set('Cookie', owner.cookie)
      .send({ order: newOrder });

    expect(res.status).toBe(200);
    expect(res.body.data.map((f) => f._id)).toEqual(newOrder);
    expect(res.body.data.map((f) => f.order)).toEqual([0, 1, 2]);
  });

  it('lehnt ein nicht-Array "order" mit 400 ab', async () => {
    const res = await request(app)
      .put(`/api/boards/${reorderBoardId}/frames/reorder`)
      .set('Cookie', owner.cookie)
      .send({ order: 'not-an-array' });
    expect(res.status).toBe(400);
  });
});
