/**
 * demoData.test.js – Erzeugen/Löschen der Demo-Testumgebung
 * (Onboarding-Ausbau). Deckt die Kernanforderung ab: Idempotenz und dass
 * ausschließlich is_demo=true-Zeilen DES AUFRUFENDEN Accounts betroffen sind
 * – echte, selbst angelegte Daten und Demo-Daten anderer Accounts müssen
 * unangetastet bleiben.
 */
import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'demo-data-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123' });
  return { email, cookie: res.headers['set-cookie'][0] };
}

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('Demo-Daten erzeugen', () => {
  it('legt Team, Kader, Trainings, Spiele an und markiert den Account als seeded', async () => {
    const user = await registerAndLogin('create');

    const statusBefore = await request(app).get('/api/demo-data').set('Cookie', user.cookie);
    expect(statusBefore.body.data.hasDemoData).toBe(false);

    const res = await request(app).post('/api/demo-data').set('Cookie', user.cookie);
    expect(res.status).toBe(201);
    expect(res.body.data.hasDemoData).toBe(true);
    expect(res.body.data.seededAt).toBeTruthy();

    const teams = await request(app).get('/api/teams').set('Cookie', user.cookie);
    expect(teams.body.data.some((t) => t.name === 'Demo: Floorball Tigers')).toBe(true);

    const roster = await request(app).get('/api/roster').set('Cookie', user.cookie);
    expect(roster.body.data).toHaveLength(8);

    const trainings = await request(app).get('/api/trainings').set('Cookie', user.cookie);
    expect(trainings.body.data).toHaveLength(2);

    const games = await request(app).get('/api/games').set('Cookie', user.cookie);
    expect(games.body.data).toHaveLength(2);

    const stats = await request(app).get('/api/roster/stats').set('Cookie', user.cookie);
    const totalGoals = stats.body.data.reduce((sum, p) => sum + p.goals, 0);
    expect(totalGoals).toBe(3);
  });

  it('ist idempotent – ein zweiter Aufruf erzeugt keine Dubletten', async () => {
    const user = await registerAndLogin('idempotent');

    await request(app).post('/api/demo-data').set('Cookie', user.cookie);
    const second = await request(app).post('/api/demo-data').set('Cookie', user.cookie);
    expect(second.status).toBe(201);

    const roster = await request(app).get('/api/roster').set('Cookie', user.cookie);
    expect(roster.body.data).toHaveLength(8);

    const teams = await request(app).get('/api/teams').set('Cookie', user.cookie);
    expect(teams.body.data.filter((t) => t.name === 'Demo: Floorball Tigers')).toHaveLength(1);
  });
});

describe('Demo-Daten löschen', () => {
  it('entfernt ausschließlich Demo-Daten, echte eigene Daten bleiben erhalten', async () => {
    const user = await registerAndLogin('delete-safety');
    await request(app).post('/api/demo-data').set('Cookie', user.cookie);

    // Echter, selbst angelegter Kader-Spieler – muss die Löschung überstehen.
    const realPlayer = await request(app)
      .post('/api/roster')
      .set('Cookie', user.cookie)
      .send({ name: 'Echter Spieler', jerseyNumber: 99, role: 'C' });
    expect(realPlayer.status).toBe(201);

    const del = await request(app).delete('/api/demo-data').set('Cookie', user.cookie);
    expect(del.status).toBe(200);
    expect(del.body.data.hasDemoData).toBe(false);

    const roster = await request(app).get('/api/roster').set('Cookie', user.cookie);
    expect(roster.body.data).toHaveLength(1);
    expect(roster.body.data[0].name).toBe('Echter Spieler');

    const teams = await request(app).get('/api/teams').set('Cookie', user.cookie);
    expect(teams.body.data.some((t) => t.name === 'Demo: Floorball Tigers')).toBe(false);

    const games = await request(app).get('/api/games').set('Cookie', user.cookie);
    expect(games.body.data).toHaveLength(0);

    const trainings = await request(app).get('/api/trainings').set('Cookie', user.cookie);
    expect(trainings.body.data).toHaveLength(0);
  });

  it('lässt Demo-Daten anderer Accounts unangetastet', async () => {
    const userA = await registerAndLogin('isolation-a');
    const userB = await registerAndLogin('isolation-b');
    await request(app).post('/api/demo-data').set('Cookie', userA.cookie);
    await request(app).post('/api/demo-data').set('Cookie', userB.cookie);

    await request(app).delete('/api/demo-data').set('Cookie', userA.cookie);

    const statusB = await request(app).get('/api/demo-data').set('Cookie', userB.cookie);
    expect(statusB.body.data.hasDemoData).toBe(true);
    const rosterB = await request(app).get('/api/roster').set('Cookie', userB.cookie);
    expect(rosterB.body.data).toHaveLength(8);
  });

  it('erlaubt erneutes Erstellen nach dem Löschen', async () => {
    const user = await registerAndLogin('recreate');
    await request(app).post('/api/demo-data').set('Cookie', user.cookie);
    await request(app).delete('/api/demo-data').set('Cookie', user.cookie);

    const res = await request(app).post('/api/demo-data').set('Cookie', user.cookie);
    expect(res.status).toBe(201);
    expect(res.body.data.hasDemoData).toBe(true);

    const roster = await request(app).get('/api/roster').set('Cookie', user.cookie);
    expect(roster.body.data).toHaveLength(8);
  });
});
