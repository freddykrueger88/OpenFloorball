import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'playbooks-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123' });
  return { email, cookie: res.headers['set-cookie'][0] };
}

let owner;
let other;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  owner = await registerAndLogin('owner');
  other = await registerAndLogin('other');
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('GET /api/playbooks', () => {
  it('liefert eine leere Liste für einen frischen Nutzer', async () => {
    const res = await request(app).get('/api/playbooks').set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('lehnt nicht authentifizierte Anfragen mit 401 ab', async () => {
    const res = await request(app).get('/api/playbooks');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/playbooks', () => {
  it('legt ein neues Playbook an', async () => {
    const res = await request(app)
      .post('/api/playbooks')
      .set('Cookie', owner.cookie)
      .send({ name: 'Standardsituationen 25/26' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Standardsituationen 25/26');
  });

  it('lehnt ein Playbook ohne Namen mit 422 ab', async () => {
    const res = await request(app).post('/api/playbooks').set('Cookie', owner.cookie).send({});
    expect(res.status).toBe(422);
  });

  it('lehnt ein 16. Playbook mit 400 ab (Maximal 15 Playbooks)', async () => {
    // 1 Playbook existiert bereits aus dem Test oben – 14 weitere bis
    // zum Limit auffüllen, dann das 16. testen.
    for (let i = 0; i < 14; i++) {
      const res = await request(app)
        .post('/api/playbooks')
        .set('Cookie', owner.cookie)
        .send({ name: `Playbook ${i}` });
      expect(res.status).toBe(201);
    }
    const overLimit = await request(app)
      .post('/api/playbooks')
      .set('Cookie', owner.cookie)
      .send({ name: 'Zu viel' });
    expect(overLimit.status).toBe(400);
  });
});

describe('DELETE /api/playbooks/:id', () => {
  let playbookId;
  let boardId;

  beforeAll(async () => {
    const pbRes = await request(app)
      .post('/api/playbooks')
      .set('Cookie', other.cookie)
      .send({ name: 'Wird gelöscht' });
    playbookId = pbRes.body.data._id;

    const boardRes = await request(app)
      .post('/api/boards')
      .set('Cookie', other.cookie)
      .send({ name: 'Zugeordnetes Board', fieldType: 'large', playbookId });
    boardId = boardRes.body.data._id;
  });

  it('verweigert einem fremden User das Löschen mit 404', async () => {
    const res = await request(app)
      .delete(`/api/playbooks/${playbookId}`)
      .set('Cookie', owner.cookie);
    expect(res.status).toBe(404);
  });

  it('löscht das eigene Playbook, zugeordnete Boards bleiben erhalten (playbookId → null)', async () => {
    const res = await request(app)
      .delete(`/api/playbooks/${playbookId}`)
      .set('Cookie', other.cookie);
    expect(res.status).toBe(200);

    const board = await request(app).get(`/api/boards/${boardId}`).set('Cookie', other.cookie);
    expect(board.status).toBe(200);
    expect(board.body.data.playbookId).toBeNull();
  });

  it('liefert 404 beim Löschen eines nicht existierenden Playbooks', async () => {
    const res = await request(app)
      .delete('/api/playbooks/00000000-0000-0000-0000-000000000000')
      .set('Cookie', owner.cookie);
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/playbooks/:id', () => {
  let playbookId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/playbooks')
      .set('Cookie', other.cookie)
      .send({ name: 'Alter Name' });
    playbookId = res.body.data._id;
  });

  it('benennt das eigene Playbook um', async () => {
    const res = await request(app)
      .put(`/api/playbooks/${playbookId}`)
      .set('Cookie', other.cookie)
      .send({ name: 'Neuer Name' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Neuer Name');
    expect(res.body.data.updatedAt).toBeDefined();
  });

  it('lehnt einen leeren Namen mit 422 ab', async () => {
    const res = await request(app)
      .put(`/api/playbooks/${playbookId}`)
      .set('Cookie', other.cookie)
      .send({ name: '' });
    expect(res.status).toBe(422);
  });

  it('verweigert einem fremden User das Umbenennen mit 404', async () => {
    const res = await request(app)
      .put(`/api/playbooks/${playbookId}`)
      .set('Cookie', owner.cookie)
      .send({ name: 'Sollte fehlschlagen' });
    expect(res.status).toBe(404);
  });

  it('liefert 404 beim Umbenennen eines nicht existierenden Playbooks', async () => {
    const res = await request(app)
      .put('/api/playbooks/00000000-0000-0000-0000-000000000000')
      .set('Cookie', other.cookie)
      .send({ name: 'Egal' });
    expect(res.status).toBe(404);
  });
});
