import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'account-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

let email;
let cookie;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  email = uniqueEmail('user');
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'Testpass123', birthday: '1990-01-01'});
  cookie = res.headers['set-cookie'][0];
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('PUT /api/auth/name', () => {
  it('ändert den Anzeigenamen', async () => {
    const res = await request(app).put('/api/auth/name').set('Cookie', cookie).send({ name: 'Neuer Name' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.name).toBe('Neuer Name');
  });

  it('lehnt leeren Namen mit 422 ab', async () => {
    const res = await request(app).put('/api/auth/name').set('Cookie', cookie).send({ name: '' });
    expect(res.status).toBe(422);
  });
});

describe('PUT /api/auth/email', () => {
  it('lehnt falsches aktuelles Passwort mit 401 ab', async () => {
    const res = await request(app)
      .put('/api/auth/email')
      .set('Cookie', cookie)
      .send({ newEmail: uniqueEmail('new'), currentPassword: 'FalschesPass123' });
    expect(res.status).toBe(401);
  });

  it('ändert die E-Mail mit korrektem Passwort', async () => {
    const newEmail = uniqueEmail('changed');
    const res = await request(app)
      .put('/api/auth/email')
      .set('Cookie', cookie)
      .send({ newEmail, currentPassword: 'Testpass123' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(newEmail);
    email = newEmail;
  });
});

describe('PUT /api/auth/password', () => {
  it('lehnt falsches aktuelles Passwort mit 401 ab', async () => {
    const res = await request(app)
      .put('/api/auth/password')
      .set('Cookie', cookie)
      .send({ currentPassword: 'FalschesPass123', newPassword: 'NeuesPass456' });
    expect(res.status).toBe(401);
  });

  it('lehnt ein zu schwaches neues Passwort mit 422 ab', async () => {
    const res = await request(app)
      .put('/api/auth/password')
      .set('Cookie', cookie)
      .send({ currentPassword: 'Testpass123', newPassword: 'nurklein' });
    expect(res.status).toBe(422);
  });

  it('ändert das Passwort und erlaubt Login mit dem neuen', async () => {
    const res = await request(app)
      .put('/api/auth/password')
      .set('Cookie', cookie)
      .send({ currentPassword: 'Testpass123', newPassword: 'NeuesPass456' });
    expect(res.status).toBe(200);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'NeuesPass456' });
    expect(loginRes.status).toBe(200);
  });
});
