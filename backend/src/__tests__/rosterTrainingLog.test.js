/**
 * rosterTrainingLog.test.js – Statistik-Architektur Phase 5 (Trends):
 * GET /api/roster/:id/training-log liefert eine Zeile PRO TRAINING (nicht
 * saison-aggregiert wie GET /api/roster/stats), analog game-log.
 */
import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'rostertraininglog-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123' });
  return { email, cookie: res.headers['set-cookie'][0] };
}

let owner;
let stranger;
let teamId;
let playerId;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  owner = await registerAndLogin('owner');
  stranger = await registerAndLogin('stranger');

  const teamRes = await request(app).post('/api/teams').set('Cookie', owner.cookie).send({ name: 'TrainingLog-Test-Team' });
  teamId = teamRes.body.data._id;

  const playerRes = await request(app).post('/api/roster').set('Cookie', owner.cookie).send({ name: 'Verlaufs-Spieler', teamId });
  playerId = playerRes.body.data._id;
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('GET /api/roster/:id/training-log', () => {
  it('liefert nur datierte Trainings mit erfasster Anwesenheit, chronologisch aufsteigend', async () => {
    const s1Res = await request(app).post('/api/trainings').set('Cookie', owner.cookie).send({ name: 'Verlauf-Training-1', teamId, scheduledDate: '2026-01-05' });
    const s1Id = s1Res.body.data._id;
    const s2Res = await request(app).post('/api/trainings').set('Cookie', owner.cookie).send({ name: 'Verlauf-Training-2', teamId, scheduledDate: '2026-01-12' });
    const s2Id = s2Res.body.data._id;
    const undatedRes = await request(app).post('/api/trainings').set('Cookie', owner.cookie).send({ name: 'Verlauf-Training-undatiert', teamId });
    const undatedId = undatedRes.body.data._id;

    await request(app).put(`/api/trainings/${s1Id}/attendance/${playerId}`).set('Cookie', owner.cookie).send({ status: 'present' });
    await request(app).put(`/api/trainings/${s2Id}/attendance/${playerId}`).set('Cookie', owner.cookie).send({ status: 'excused' });
    await request(app).put(`/api/trainings/${undatedId}/attendance/${playerId}`).set('Cookie', owner.cookie).send({ status: 'present' });

    const res = await request(app).get(`/api/roster/${playerId}/training-log`).set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2); // undatiertes Training ausgeschlossen
    expect(res.body.data.map((s) => s.sessionId)).toEqual([s1Id, s2Id]); // chronologisch aufsteigend
    expect(res.body.data[0]).toMatchObject({ sessionName: 'Verlauf-Training-1', status: 'present' });
    expect(res.body.data[1]).toMatchObject({ sessionName: 'Verlauf-Training-2', status: 'excused' });
  });

  it('schließt Trainings ohne erfasste Anwesenheit für diesen Spieler aus', async () => {
    const sessionRes = await request(app).post('/api/trainings').set('Cookie', owner.cookie).send({ name: 'Verlauf-Unerfasst', teamId, scheduledDate: '2026-02-01' });
    const res = await request(app).get(`/api/roster/${playerId}/training-log`).set('Cookie', owner.cookie);
    expect(res.body.data.some((s) => s.sessionId === sessionRes.body.data._id)).toBe(false);
  });

  it('member darf lesen, Fremder bekommt 404', async () => {
    const memberRes = await registerAndLogin('member');
    await request(app).post(`/api/teams/${teamId}/members`).set('Cookie', owner.cookie).send({ email: memberRes.email, role: 'member' });

    const okRes = await request(app).get(`/api/roster/${playerId}/training-log`).set('Cookie', memberRes.cookie);
    expect(okRes.status).toBe(200);

    const strangerRes = await request(app).get(`/api/roster/${playerId}/training-log`).set('Cookie', stranger.cookie);
    expect(strangerRes.status).toBe(404);
  });
});
