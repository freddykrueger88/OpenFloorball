import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'invite-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123', birthday: '1990-01-01'});
  return { email, cookie: res.headers['set-cookie'][0] };
}

let owner;
let boardId;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  owner = await registerAndLogin('owner');

  const boardRes = await request(app)
    .post('/api/boards')
    .set('Cookie', owner.cookie)
    .send({ name: 'Einladungs-Test-Board', fieldType: 'large' });
  boardId = boardRes.body.data._id;
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('GET /api/invite/:token (öffentlich)', () => {
  it('liefert 404 für ein unbekanntes Token', async () => {
    const res = await request(app).get('/api/invite/00000000-0000-4000-8000-000000000000');
    expect(res.status).toBe(404);
  });

  it('liefert 422 für ein ungültiges (kein UUID) Token', async () => {
    const res = await request(app).get('/api/invite/not-a-uuid');
    expect(res.status).toBe(422);
  });

  it('liefert Board-/Berechtigungsdaten für eine gültige Einladung', async () => {
    const invitedEmail = uniqueEmail('invited');
    const addRes = await request(app)
      .post(`/api/boards/${boardId}/collaborators`)
      .set('Cookie', owner.cookie)
      .send({ email: invitedEmail, permission: 'write' });
    expect(addRes.status).toBe(201);

    const tokenRow = await pool.query('SELECT token FROM board_invites WHERE email = $1', [invitedEmail]);
    const token = tokenRow.rows[0].token;

    const res = await request(app).get(`/api/invite/${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(invitedEmail);
    expect(res.body.data.permission).toBe('write');
    expect(res.body.data.boardName).toBe('Einladungs-Test-Board');
  });
});

describe('Registrierung löst offene Einladungen automatisch ein', () => {
  it('gewährt bei Registrierung mit der eingeladenen Adresse sofort Board-Zugriff', async () => {
    const invitedEmail = uniqueEmail('autoaccept');
    const addRes = await request(app)
      .post(`/api/boards/${boardId}/collaborators`)
      .set('Cookie', owner.cookie)
      .send({ email: invitedEmail, permission: 'write' });
    expect(addRes.status).toBe(201);
    const inviteId = addRes.body.data._id;

    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: invitedEmail, password: 'Testpass123', birthday: '1990-01-01'});
    expect(registerRes.status).toBe(201);
    const newUserCookie = registerRes.headers['set-cookie'][0];

    const boardsRes = await request(app).get('/api/boards').set('Cookie', newUserCookie);
    const shared = boardsRes.body.data.find((b) => b._id === boardId);
    expect(shared).toBeDefined();
    expect(shared.accessLevel).toBe('write');

    // Einladung ist jetzt akzeptiert – taucht nicht mehr in der offenen Liste auf
    const listRes = await request(app).get(`/api/boards/${boardId}/collaborators`).set('Cookie', owner.cookie);
    expect(listRes.body.data.some((c) => c._id === inviteId)).toBe(false);
    expect(listRes.body.data.some((c) => c.email === invitedEmail && c.status === 'active')).toBe(true);
  });

  it('akzeptierte Einladung ist über /api/invite/:token nicht mehr abrufbar', async () => {
    const invitedEmail = uniqueEmail('reuse');
    const addRes = await request(app)
      .post(`/api/boards/${boardId}/collaborators`)
      .set('Cookie', owner.cookie)
      .send({ email: invitedEmail, permission: 'read' });
    const tokenRow = await pool.query('SELECT token FROM board_invites WHERE email = $1', [invitedEmail]);
    const token = tokenRow.rows[0].token;
    expect(addRes.status).toBe(201);

    await request(app).post('/api/auth/register').send({ email: invitedEmail, password: 'Testpass123', birthday: '1990-01-01'});

    const res = await request(app).get(`/api/invite/${token}`);
    expect(res.status).toBe(404);
  });
});
