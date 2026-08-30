import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'settings-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

let cookie;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: uniqueEmail('user'), password: 'Testpass123', birthday: '1990-01-01'});
  cookie = res.headers['set-cookie'][0];
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('GET/PUT /api/settings', () => {
  it('liefert ein leeres Objekt, wenn noch keine Settings existieren', async () => {
    const res = await request(app).get('/api/settings').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({});
  });

  it('speichert Settings und merged bei weiteren Updates', async () => {
    const res1 = await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .send({ theme: 'vikings', fontSize: 'gross' });
    expect(res1.status).toBe(200);
    expect(res1.body.data).toMatchObject({ theme: 'vikings', fontSize: 'gross' });

    const res2 = await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .send({ reducedMotion: true });
    expect(res2.status).toBe(200);
    // gemergt: alte Keys bleiben erhalten
    expect(res2.body.data).toMatchObject({ theme: 'vikings', fontSize: 'gross', reducedMotion: true });
  });

  it('lehnt Zugriff ohne Cookie mit 401 ab', async () => {
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(401);
  });
});
