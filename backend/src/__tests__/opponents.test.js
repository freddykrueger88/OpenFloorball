/**
 * opponents.test.js – strukturierte Gegner-Entität (ADR-0007 in
 * DECISIONS.md): Find-or-Create-Verknüpfung beim Anlegen/Ändern eines
 * Spiels (resolveOpponentId, gamesController.js) sowie die aggregierte
 * Bilanz über GET /api/opponents (opponentsController.js).
 */
import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'opponents-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123', birthday: '1990-01-01'});
  return { email, cookie: res.headers['set-cookie'][0] };
}

async function addGoalEvent(gameId, cookie, isOpponent) {
  const res = await request(app)
    .post(`/api/games/${gameId}/events`)
    .set('Cookie', cookie)
    .send({ eventType: 'goal', isOpponent });
  expect(res.status).toBe(201);
}

let owner;
let coach;
let stranger;
let teamId;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  owner = await registerAndLogin('owner');
  coach = await registerAndLogin('coach');
  stranger = await registerAndLogin('stranger');

  const teamRes = await request(app).post('/api/teams').set('Cookie', owner.cookie).send({ name: 'Opponents-Test-Team' });
  teamId = teamRes.body.data._id;
  await request(app).post(`/api/teams/${teamId}/members`).set('Cookie', owner.cookie).send({ email: coach.email, role: 'coach' });
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('Find-or-Create beim Anlegen eines Spiels (persönlich, kein Team)', () => {
  it('verknüpft zwei Spiele mit identischem Gegnernamen auf denselben Gegner', async () => {
    const first = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'SC Dünnbach' });
    const second = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'SC Dünnbach' });
    expect(first.body.data.opponentId).toBeTruthy();
    expect(second.body.data.opponentId).toBe(first.body.data.opponentId);
  });

  it('legt für unterschiedliche Gegnernamen getrennte Gegner an', async () => {
    const a = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Verein A' });
    const b = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Verein B' });
    expect(a.body.data.opponentId).not.toBe(b.body.data.opponentId);
  });

  it('ignoriert Groß-/Kleinschreibung und Leerzeichen beim Abgleich', async () => {
    const a = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'HC Talwil' });
    const b = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: '  hc talwil  ' });
    expect(a.body.data.opponentId).toBe(b.body.data.opponentId);
  });

  it('legt bei leerem Gegnernamen keinen Gegner an', async () => {
    const res = await request(app).post('/api/games').set('Cookie', owner.cookie).send({});
    expect(res.body.data.opponentId).toBeNull();
  });
});

describe('Team-Scope', () => {
  it('verknüpft zwei Coaches desselben Teams mit gleichem Gegnernamen auf denselben Gegner', async () => {
    const fromOwner = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Team-Gegner FC', teamId });
    const fromCoach = await request(app).post('/api/games').set('Cookie', coach.cookie).send({ opponent: 'Team-Gegner FC', teamId });
    expect(fromOwner.body.data.opponentId).toBeTruthy();
    expect(fromOwner.body.data.opponentId).toBe(fromCoach.body.data.opponentId);
  });

  it('hält team-gebundene und persönliche Gegner mit gleichem Namen getrennt', async () => {
    const personal = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Doppelgänger SC' });
    const teamBound = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Doppelgänger SC', teamId });
    expect(personal.body.data.opponentId).not.toBe(teamBound.body.data.opponentId);
  });
});

describe('Ändern des Gegnernamens verknüpft neu', () => {
  it('löst opponent_id beim Umbenennen auf einen anderen Gegner um', async () => {
    const created = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Alter Name SC' });
    const updated = await request(app)
      .put(`/api/games/${created.body.data._id}`)
      .set('Cookie', owner.cookie)
      .send({ opponent: 'Neuer Name SC' });
    expect(updated.body.data.opponentId).not.toBe(created.body.data.opponentId);
  });
});

describe('GET /api/opponents – Bilanz', () => {
  it('berechnet Siege/Unentschieden/Niederlagen und Tordifferenz aus game_events', async () => {
    const win = await request(app).post('/api/games').set('Cookie', owner.cookie)
      .send({ opponent: 'Bilanz-Test SC', playedAt: '2026-01-10' });
    await addGoalEvent(win.body.data._id, owner.cookie, false);
    await addGoalEvent(win.body.data._id, owner.cookie, false);
    await addGoalEvent(win.body.data._id, owner.cookie, true);

    const loss = await request(app).post('/api/games').set('Cookie', owner.cookie)
      .send({ opponent: 'Bilanz-Test SC', playedAt: '2026-01-17' });
    await addGoalEvent(loss.body.data._id, owner.cookie, false);
    await addGoalEvent(loss.body.data._id, owner.cookie, true);
    await addGoalEvent(loss.body.data._id, owner.cookie, true);

    const res = await request(app).get('/api/opponents').set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    const entry = res.body.data.find((o) => o.id === win.body.data.opponentId);
    expect(entry.gamesPlayed).toBe(2);
    expect(entry.wins).toBe(1);
    expect(entry.losses).toBe(1);
    expect(entry.draws).toBe(0);
    expect(entry.goalsFor).toBe(3);
    expect(entry.goalsAgainst).toBe(3);
  });

  it('zählt Spiele ohne playedAt nicht in die Bilanz', async () => {
    const unscheduled = await request(app).post('/api/games').set('Cookie', owner.cookie)
      .send({ opponent: 'Zukunftsgegner SC' });
    await addGoalEvent(unscheduled.body.data._id, owner.cookie, false);

    const res = await request(app).get('/api/opponents').set('Cookie', owner.cookie);
    const entry = res.body.data.find((o) => o.id === unscheduled.body.data.opponentId);
    expect(entry.gamesPlayed).toBe(0);
    expect(entry.games).toEqual([]);
  });

  it('zeigt einem fremden Nutzer keine persönlichen Gegner eines anderen Nutzers', async () => {
    await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Nur Owner SC' });
    const res = await request(app).get('/api/opponents').set('Cookie', stranger.cookie);
    expect(res.body.data.find((o) => o.name === 'Nur Owner SC')).toBeUndefined();
  });

  it('zeigt einem Team-Mitglied die team-geteilten Gegner', async () => {
    const res = await request(app).get('/api/opponents').set('Cookie', coach.cookie);
    expect(res.body.data.find((o) => o.name === 'Team-Gegner FC')).toBeTruthy();
  });

  it('lehnt nicht authentifizierte Anfragen mit 401 ab', async () => {
    const res = await request(app).get('/api/opponents');
    expect(res.status).toBe(401);
  });
});
