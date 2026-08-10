/**
 * gameClock.test.js – Spieluhr (Roadmap-Audit, letzter größerer
 * Baustein Phase C): Start/Pause/Drittel-Wechsel/Reset, verknüpft mit
 * automatisch protokollierten Anstoß-/Drittelende-game_events.
 */
import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'gameclock-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123' });
  return { email, cookie: res.headers['set-cookie'][0] };
}

async function createGame(cookie, teamId = null) {
  const res = await request(app).post('/api/games').set('Cookie', cookie).send({ opponent: 'Uhr-Test-Gegner', teamId });
  return res.body.data._id;
}

async function eventTypes(gameId, cookie) {
  const res = await request(app).get(`/api/games/${gameId}/events`).set('Cookie', cookie);
  return res.body.data.map((e) => e.eventType);
}

let owner;
let member;
let teamId;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  owner = await registerAndLogin('owner');
  member = await registerAndLogin('member');

  const teamRes = await request(app).post('/api/teams').set('Cookie', owner.cookie).send({ name: 'GameClock-Test-Team' });
  teamId = teamRes.body.data._id;
  await request(app).post(`/api/teams/${teamId}/members`).set('Cookie', owner.cookie).send({ email: member.email, role: 'member' });
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('POST /api/games/:id/clock/start', () => {
  it('startet bei Periode 0 → Periode 1, running, protokolliert genau kickoff_q1', async () => {
    const gameId = await createGame(owner.cookie);
    const res = await request(app).post(`/api/games/${gameId}/clock/start`).set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.clockPeriod).toBe(1);
    expect(res.body.data.clockStatus).toBe('running');
    expect(res.body.data.createdEvent).toBe('kickoff_q1');

    const types = await eventTypes(gameId, owner.cookie);
    expect(types).toEqual(['kickoff_q1']);
  });

  it('Fortsetzen nach Pause erzeugt KEINEN zweiten kickoff-Event', async () => {
    const gameId = await createGame(owner.cookie);
    await request(app).post(`/api/games/${gameId}/clock/start`).set('Cookie', owner.cookie);
    await request(app).post(`/api/games/${gameId}/clock/pause`).set('Cookie', owner.cookie);

    const res = await request(app).post(`/api/games/${gameId}/clock/start`).set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.createdEvent).toBeNull();

    const types = await eventTypes(gameId, owner.cookie);
    expect(types).toEqual(['kickoff_q1']);
  });

  it('erneuter Start, während die Uhr schon läuft, ist ein No-op', async () => {
    const gameId = await createGame(owner.cookie);
    await request(app).post(`/api/games/${gameId}/clock/start`).set('Cookie', owner.cookie);
    const res = await request(app).post(`/api/games/${gameId}/clock/start`).set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.createdEvent).toBeNull();

    const types = await eventTypes(gameId, owner.cookie);
    expect(types).toEqual(['kickoff_q1']);
  });

  it('member (nur Lesezugriff) bekommt 404', async () => {
    const gameId = await createGame(owner.cookie, teamId);
    const res = await request(app).post(`/api/games/${gameId}/clock/start`).set('Cookie', member.cookie);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/games/:id/clock/pause', () => {
  it('akkumuliert clock_elapsed_seconds korrekt (deterministisch per SQL-Zeitsprung)', async () => {
    const gameId = await createGame(owner.cookie);
    await request(app).post(`/api/games/${gameId}/clock/start`).set('Cookie', owner.cookie);
    // Deterministisches Zeitfenster statt einer echten Wartezeit im Test.
    await pool.query("UPDATE games SET clock_started_at = NOW() - INTERVAL '10 seconds' WHERE id = $1", [gameId]);

    const res = await request(app).post(`/api/games/${gameId}/clock/pause`).set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.clockStatus).toBe('stopped');
    expect(res.body.data.clockStartedAt).toBeNull();
    expect(res.body.data.clockElapsedSeconds).toBeGreaterThanOrEqual(9);
    expect(res.body.data.clockElapsedSeconds).toBeLessThanOrEqual(12);
  });

  it('Pause, während die Uhr schon steht, ist ein No-op', async () => {
    const gameId = await createGame(owner.cookie);
    const res = await request(app).post(`/api/games/${gameId}/clock/pause`).set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.clockElapsedSeconds).toBe(0);
  });

  it('member bekommt 404', async () => {
    const gameId = await createGame(owner.cookie, teamId);
    const res = await request(app).post(`/api/games/${gameId}/clock/pause`).set('Cookie', member.cookie);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/games/:id/clock/next-period', () => {
  it('erhöht die Periode, protokolliert period_end nur für die auslaufende Periode, setzt Uhr zurück', async () => {
    const gameId = await createGame(owner.cookie);
    await request(app).post(`/api/games/${gameId}/clock/start`).set('Cookie', owner.cookie);

    const res = await request(app).post(`/api/games/${gameId}/clock/next-period`).set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.clockPeriod).toBe(2);
    expect(res.body.data.clockStatus).toBe('stopped');
    expect(res.body.data.clockElapsedSeconds).toBe(0);
    expect(res.body.data.createdEvent).toBe('period_end');

    const types = await eventTypes(gameId, owner.cookie);
    expect(types).toEqual(['kickoff_q1', 'period_end']);
  });

  it('kein period_end-Event, wenn noch nie gestartet wurde (Periode 0)', async () => {
    const gameId = await createGame(owner.cookie);
    const res = await request(app).post(`/api/games/${gameId}/clock/next-period`).set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.clockPeriod).toBe(1);
    expect(res.body.data.createdEvent).toBeNull();

    const types = await eventTypes(gameId, owner.cookie);
    expect(types).toEqual([]);
  });

  it('member bekommt 404', async () => {
    const gameId = await createGame(owner.cookie, teamId);
    const res = await request(app).post(`/api/games/${gameId}/clock/next-period`).set('Cookie', member.cookie);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/games/:id/clock/reset', () => {
  it('setzt Periode/Status/Zeit zurück, ohne game_events anzurühren', async () => {
    const gameId = await createGame(owner.cookie);
    await request(app).post(`/api/games/${gameId}/clock/start`).set('Cookie', owner.cookie);
    await request(app).post(`/api/games/${gameId}/clock/next-period`).set('Cookie', owner.cookie);
    const beforeTypes = await eventTypes(gameId, owner.cookie);

    const res = await request(app).post(`/api/games/${gameId}/clock/reset`).set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.clockPeriod).toBe(0);
    expect(res.body.data.clockStatus).toBe('stopped');
    expect(res.body.data.clockElapsedSeconds).toBe(0);
    expect(res.body.data.clockStartedAt).toBeNull();

    const afterTypes = await eventTypes(gameId, owner.cookie);
    expect(afterTypes).toEqual(beforeTypes);
  });

  it('member bekommt 404', async () => {
    const gameId = await createGame(owner.cookie, teamId);
    const res = await request(app).post(`/api/games/${gameId}/clock/reset`).set('Cookie', member.cookie);
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/games/:id – periodMinutes', () => {
  it('übernimmt einen gültigen Wert', async () => {
    const gameId = await createGame(owner.cookie);
    const res = await request(app).put(`/api/games/${gameId}`).set('Cookie', owner.cookie).send({ periodMinutes: 15 });
    expect(res.status).toBe(200);
    expect(res.body.data.clockPeriodMinutes).toBe(15);
  });

  it('lehnt einen Wert außerhalb 1–60 mit 422 ab', async () => {
    const gameId = await createGame(owner.cookie);
    const res = await request(app).put(`/api/games/${gameId}`).set('Cookie', owner.cookie).send({ periodMinutes: 61 });
    expect(res.status).toBe(422);
  });
});
