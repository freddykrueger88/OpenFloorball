/**
 * trainingSessionSeries.test.js – Serientermine für Trainings
 * (Roadmap-Audit): POST /api/trainings/:id/repeat erzeugt unabhängige
 * Folge-Termine (kein Serien-Tracking), analog trainingSessions.test.js.
 */
import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'training-series-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123' });
  return { email, cookie: res.headers['set-cookie'][0] };
}

let owner;
let stranger;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  owner = await registerAndLogin('owner');
  stranger = await registerAndLogin('stranger');
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('POST /api/trainings/:id/repeat', () => {
  it('erzeugt bei wöchentlicher Wiederholung genau die erwarteten Folgetermine mit übernommenen Feldern', async () => {
    const teamRes = await request(app).post('/api/teams').set('Cookie', owner.cookie).send({ name: 'Serien-Test-Team' });
    const teamId = teamRes.body.data._id;

    const createRes = await request(app).post('/api/trainings').set('Cookie', owner.cookie).send({
      name: 'Dienstagstraining', teamId, scheduledDate: '2026-08-11', goal: 'Passspiel', notes: 'Fokus Ballkontrolle',
    });
    const sessionId = createRes.body.data._id;

    const res = await request(app)
      .post(`/api/trainings/${sessionId}/repeat`)
      .set('Cookie', owner.cookie)
      .send({ repeat: 'weekly', until: '2026-09-01' });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data.map((s) => s.scheduledDate)).toEqual(['2026-08-18', '2026-08-25', '2026-09-01']);
    for (const created of res.body.data) {
      expect(created.name).toBe('Dienstagstraining');
      expect(created.teamId).toBe(teamId);
      expect(created.goal).toBe('Passspiel');
      expect(created.notes).toBe('Fokus Ballkontrolle');
      expect(created._id).not.toBe(sessionId);
    }
  });

  it('funktioniert für tägliche und zweiwöchentliche Muster', async () => {
    const createRes = await request(app).post('/api/trainings').set('Cookie', owner.cookie).send({
      name: 'Ferienlager-Training', scheduledDate: '2026-08-11',
    });
    const sessionId = createRes.body.data._id;

    const daily = await request(app)
      .post(`/api/trainings/${sessionId}/repeat`)
      .set('Cookie', owner.cookie)
      .send({ repeat: 'daily', until: '2026-08-14' });
    expect(daily.status).toBe(201);
    expect(daily.body.data.map((s) => s.scheduledDate)).toEqual(['2026-08-12', '2026-08-13', '2026-08-14']);

    const biweekly = await request(app)
      .post(`/api/trainings/${sessionId}/repeat`)
      .set('Cookie', owner.cookie)
      .send({ repeat: 'biweekly', until: '2026-09-08' });
    expect(biweekly.status).toBe(201);
    expect(biweekly.body.data.map((s) => s.scheduledDate)).toEqual(['2026-08-25', '2026-09-08']);
  });

  it('lehnt ein Enddatum vor/gleich dem Ausgangstermin mit 400 ab', async () => {
    const createRes = await request(app).post('/api/trainings').set('Cookie', owner.cookie).send({
      name: 'Termin ohne Zukunft', scheduledDate: '2026-08-11',
    });
    const sessionId = createRes.body.data._id;

    const sameDate = await request(app)
      .post(`/api/trainings/${sessionId}/repeat`)
      .set('Cookie', owner.cookie)
      .send({ repeat: 'weekly', until: '2026-08-11' });
    expect(sameDate.status).toBe(400);

    const beforeDate = await request(app)
      .post(`/api/trainings/${sessionId}/repeat`)
      .set('Cookie', owner.cookie)
      .send({ repeat: 'weekly', until: '2026-08-01' });
    expect(beforeDate.status).toBe(400);
  });

  it('lehnt einen Ausgangstermin ohne gesetztes Datum mit 400 ab', async () => {
    const createRes = await request(app).post('/api/trainings').set('Cookie', owner.cookie).send({ name: 'Ohne Datum' });
    const sessionId = createRes.body.data._id;

    const res = await request(app)
      .post(`/api/trainings/${sessionId}/repeat`)
      .set('Cookie', owner.cookie)
      .send({ repeat: 'weekly', until: '2026-09-01' });
    expect(res.status).toBe(400);
  });

  it('lehnt ein ungültiges Wiederholungsmuster mit 422 ab', async () => {
    const createRes = await request(app).post('/api/trainings').set('Cookie', owner.cookie).send({
      name: 'Muster-Test', scheduledDate: '2026-08-11',
    });
    const sessionId = createRes.body.data._id;

    const res = await request(app)
      .post(`/api/trainings/${sessionId}/repeat`)
      .set('Cookie', owner.cookie)
      .send({ repeat: 'monthly', until: '2026-09-01' });
    expect(res.status).toBe(422);
  });

  it('lehnt eine Serie mit mehr als 52 Terminen mit 400 ab', async () => {
    const createRes = await request(app).post('/api/trainings').set('Cookie', owner.cookie).send({
      name: 'Zu lange Serie', scheduledDate: '2026-01-01',
    });
    const sessionId = createRes.body.data._id;

    const res = await request(app)
      .post(`/api/trainings/${sessionId}/repeat`)
      .set('Cookie', owner.cookie)
      .send({ repeat: 'daily', until: '2026-12-31' });
    expect(res.status).toBe(400);
  });

  it('lehnt eine Serie ab, die das Gesamt-Kontingent (200) überschreiten würde', async () => {
    const quotaUser = await registerAndLogin('quota');
    const createRes = await request(app).post('/api/trainings').set('Cookie', quotaUser.cookie).send({
      name: 'Quota-Test', scheduledDate: '2026-08-11',
    });
    const sessionId = createRes.body.data._id;

    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [quotaUser.email]);
    const userId = userResult.rows[0].id;
    // 198 Filler-Sessions direkt einfügen (per Bulk statt HTTP, siehe
    // trainingSessions.test.js) – zusammen mit der bereits erzeugten
    // Session macht das 199, eine Serie mit 2 neuen Terminen würde 201
    // ergeben und damit das Kontingent von 200 überschreiten.
    for (let i = 0; i < 198; i++) {
      await pool.query('INSERT INTO training_sessions (user_id, name) VALUES ($1, $2)', [userId, `Filler ${i}`]);
    }

    const res = await request(app)
      .post(`/api/trainings/${sessionId}/repeat`)
      .set('Cookie', quotaUser.cookie)
      .send({ repeat: 'weekly', until: '2026-08-25' });
    expect(res.status).toBe(400);
  });

  it('verweigert einem fremden Nutzer ohne Zugriff mit 404', async () => {
    const createRes = await request(app).post('/api/trainings').set('Cookie', owner.cookie).send({
      name: 'Privater Termin', scheduledDate: '2026-08-11',
    });
    const sessionId = createRes.body.data._id;

    const res = await request(app)
      .post(`/api/trainings/${sessionId}/repeat`)
      .set('Cookie', stranger.cookie)
      .send({ repeat: 'weekly', until: '2026-09-01' });
    expect(res.status).toBe(404);
  });
});
