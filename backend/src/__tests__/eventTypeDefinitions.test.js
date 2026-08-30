/**
 * eventTypeDefinitions.test.js – Custom Events/Tags (Statistik-Architektur
 * Phase 7, Phasenplanungs-Review 2026-08-21).
 */
import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'eventtypes-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

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

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  owner    = await registerAndLogin('owner');
  coach    = await registerAndLogin('coach');
  member   = await registerAndLogin('member');
  stranger = await registerAndLogin('stranger');

  const teamRes = await request(app).post('/api/teams').set('Cookie', owner.cookie).send({ name: 'EventTypes-Test-Team' });
  teamId = teamRes.body.data._id;
  await request(app).post(`/api/teams/${teamId}/members`).set('Cookie', owner.cookie).send({ email: coach.email, role: 'coach' });
  await request(app).post(`/api/teams/${teamId}/members`).set('Cookie', owner.cookie).send({ email: member.email, role: 'member' });
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('GET /api/event-types', () => {
  it('liefert die 11 eingebauten Typen auch ohne eigene Custom-Typen', async () => {
    const res = await request(app).get('/api/event-types').set('Cookie', stranger.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.filter((t) => t.isBuiltin)).toHaveLength(11);
  });
});

describe('POST /api/event-types', () => {
  it('legt einen persönlichen Custom-Typ an (kein teamId)', async () => {
    const res = await request(app)
      .post('/api/event-types')
      .set('Cookie', stranger.cookie)
      .send({ label: 'Konter', requiresPlayer: true });
    expect(res.status).toBe(201);
    expect(res.body.data.labelDe).toBe('Konter');
    expect(res.body.data.labelEn).toBe('Konter');
    expect(res.body.data.isBuiltin).toBe(false);
    expect(res.body.data.userId).not.toBeNull();
    expect(res.body.data.teamId).toBeNull();
    expect(res.body.data.key).toMatch(/^custom_/);
  });

  it('legt einen team-eigenen Custom-Typ an (nur coach/owner)', async () => {
    const res = await request(app)
      .post('/api/event-types')
      .set('Cookie', coach.cookie)
      .send({ label: 'Umschaltmoment', teamId });
    expect(res.status).toBe(201);
    expect(res.body.data.teamId).toBe(teamId);
    expect(res.body.data.userId).toBeNull();
  });

  it('lehnt ein einfaches Team-Mitglied (kein Coach) mit 404 ab', async () => {
    const res = await request(app)
      .post('/api/event-types')
      .set('Cookie', member.cookie)
      .send({ label: 'Sollte nicht klappen', teamId });
    expect(res.status).toBe(404);
  });

  it('lehnt eine leere Bezeichnung mit 422 ab (express-validator)', async () => {
    const res = await request(app).post('/api/event-types').set('Cookie', stranger.cookie).send({ label: '  ' });
    expect(res.status).toBe(422);
  });

  it('begrenzt auf maximal 20 Custom-Typen pro Nutzer', async () => {
    const capUser = await registerAndLogin('cap');
    for (let i = 0; i < 20; i++) {
      const res = await request(app).post('/api/event-types').set('Cookie', capUser.cookie).send({ label: `Typ ${i}` });
      expect(res.status).toBe(201);
    }
    const overflow = await request(app).post('/api/event-types').set('Cookie', capUser.cookie).send({ label: 'Zu viel' });
    expect(overflow.status).toBe(400);
  });
});

describe('PUT /api/event-types/:key', () => {
  let key;

  beforeAll(async () => {
    const res = await request(app).post('/api/event-types').set('Cookie', stranger.cookie).send({ label: 'Update-Test' });
    key = res.body.data.key;
  });

  it('ändert Bezeichnung und Deaktivierung', async () => {
    const res = await request(app)
      .put(`/api/event-types/${key}`)
      .set('Cookie', stranger.cookie)
      .send({ label: 'Umbenannt', active: false });
    expect(res.status).toBe(200);
    expect(res.body.data.labelDe).toBe('Umbenannt');
    expect(res.body.data.active).toBe(false);
  });

  it('lehnt eine fremde Person mit 404 ab', async () => {
    const res = await request(app).put(`/api/event-types/${key}`).set('Cookie', owner.cookie).send({ label: 'Geklaut' });
    expect(res.status).toBe(404);
  });

  it('lehnt ein Ändern eines eingebauten Typs mit 404 ab (kein Zugriff auf is_builtin-Zeilen)', async () => {
    const res = await request(app).put('/api/event-types/goal').set('Cookie', owner.cookie).send({ label: 'Umbenanntes Tor' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/event-types/:key', () => {
  it('löscht einen ungenutzten Custom-Typ', async () => {
    const createRes = await request(app).post('/api/event-types').set('Cookie', stranger.cookie).send({ label: 'Lösch-Test' });
    const key = createRes.body.data.key;

    const delRes = await request(app).delete(`/api/event-types/${key}`).set('Cookie', stranger.cookie);
    expect(delRes.status).toBe(200);

    const listRes = await request(app).get('/api/event-types').set('Cookie', stranger.cookie);
    expect(listRes.body.data.some((t) => t.key === key)).toBe(false);
  });

  it('lehnt das Löschen eines bereits in einem Spiel genutzten Custom-Typs mit 400 ab', async () => {
    const createRes = await request(app).post('/api/event-types').set('Cookie', owner.cookie).send({ label: 'In-Nutzung' });
    const key = createRes.body.data.key;

    const gameRes = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'EventTypes-Use-Test' });
    const gameId = gameRes.body.data._id;
    await request(app).post(`/api/games/${gameId}/events`).set('Cookie', owner.cookie).send({ eventType: key });

    const delRes = await request(app).delete(`/api/event-types/${key}`).set('Cookie', owner.cookie);
    expect(delRes.status).toBe(400);
  });
});

describe('Scope-Isolation zwischen Custom-Typen (Phasenplanungs-Review 2026-08-21)', () => {
  it('lehnt einen persönlichen Custom-Typ eines anderen Nutzers auf dem eigenen Spiel mit 400 ab', async () => {
    const foreignTypeRes = await request(app).post('/api/event-types').set('Cookie', owner.cookie).send({ label: 'Fremder-Typ' });
    const foreignKey = foreignTypeRes.body.data.key;

    const gameRes = await request(app).post('/api/games').set('Cookie', stranger.cookie).send({ opponent: 'Scope-Test' });
    const gameId = gameRes.body.data._id;

    const res = await request(app).post(`/api/games/${gameId}/events`).set('Cookie', stranger.cookie).send({ eventType: foreignKey });
    expect(res.status).toBe(400);
  });

  it('erlaubt einen team-eigenen Custom-Typ auf einem Spiel desselben Teams', async () => {
    const typeRes = await request(app).post('/api/event-types').set('Cookie', owner.cookie).send({ label: 'Team-Tag', teamId });
    const key = typeRes.body.data.key;

    const gameRes = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Scope-Test-Team', teamId });
    const gameId = gameRes.body.data._id;

    const res = await request(app).post(`/api/games/${gameId}/events`).set('Cookie', owner.cookie).send({ eventType: key });
    expect(res.status).toBe(201);
  });
});
