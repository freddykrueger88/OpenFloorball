/**
 * shots.test.js – Statistik-Architektur Phase 3: Schuss-Tracking
 * (event_type='shot', outcome-differenziert statt 4 Event-Typen,
 * ADR-0002/0003 in docs/planning/DECISIONS.md).
 */
import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'shots-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123' });
  return { email, cookie: res.headers['set-cookie'][0] };
}

async function createRosterPlayer(cookie, name, teamId = null, role = null) {
  const res = await request(app).post('/api/roster').set('Cookie', cookie).send({ name, teamId, role });
  return res.body.data._id;
}

let owner;
let member;
let stranger;
let teamId;
let gameId;
let scorer;
let keeper;
let assister;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  owner = await registerAndLogin('owner');
  member = await registerAndLogin('member');
  stranger = await registerAndLogin('stranger');

  const teamRes = await request(app).post('/api/teams').set('Cookie', owner.cookie).send({ name: 'Shots-Test-Team' });
  teamId = teamRes.body.data._id;
  await request(app).post(`/api/teams/${teamId}/members`).set('Cookie', owner.cookie).send({ email: member.email, role: 'member' });

  scorer = await createRosterPlayer(owner.cookie, 'Torschütze', teamId);
  keeper = await createRosterPlayer(owner.cookie, 'Torhüter', teamId, 'TW');
  assister = await createRosterPlayer(owner.cookie, 'Assistgeber', teamId);

  const gameRes = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Shots-Test-Gegner', teamId });
  gameId = gameRes.body.data._id;
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('POST /api/games/:id/events – shot mit allen Feldern', () => {
  it('legt einen Schuss mit x/y/shotType/outcome/zone an', async () => {
    const res = await request(app)
      .post(`/api/games/${gameId}/events`)
      .set('Cookie', owner.cookie)
      .send({ eventType: 'shot', rosterPlayerId: scorer, x: 0.5, y: 0.5, shotType: 'wrist', outcome: 'save', zone: 'halbdistanz' });
    expect(res.status).toBe(201);
    expect(res.body.data.eventType).toBe('shot');
    expect(res.body.data.x).toBeCloseTo(0.5);
    expect(res.body.data.y).toBeCloseTo(0.5);
    expect(res.body.data.shotType).toBe('wrist');
    expect(res.body.data.outcome).toBe('save');
    expect(res.body.data.zone).toBe('halbdistanz');
  });

  it('leitet die Zone aus x/y ab, wenn keine zone mitgeschickt wird', async () => {
    const res = await request(app)
      .post(`/api/games/${gameId}/events`)
      .set('Cookie', owner.cookie)
      .send({ eventType: 'shot', rosterPlayerId: scorer, x: 0.9, y: 0.5, outcome: 'miss' });
    expect(res.status).toBe(201);
    expect(res.body.data.zone).toBe('nahzone_zentrum');
  });

  it('respektiert eine vom Client explizit gesetzte zone, überschreibt sie nicht', async () => {
    const res = await request(app)
      .post(`/api/games/${gameId}/events`)
      .set('Cookie', owner.cookie)
      .send({ eventType: 'shot', rosterPlayerId: scorer, x: 0.9, y: 0.5, zone: 'distanz', outcome: 'block' });
    expect(res.status).toBe(201);
    expect(res.body.data.zone).toBe('distanz');
  });
});

describe('Companion-Goal-Event (ADR-0002)', () => {
  it('legt bei outcome=goal genau ein zusätzliches goal-Event mit korrekter Attribution an', async () => {
    const beforeRes = await request(app).get(`/api/games/${gameId}/events`).set('Cookie', owner.cookie);
    const goalsBefore = beforeRes.body.data.filter((e) => e.eventType === 'goal').length;

    const shotRes = await request(app)
      .post(`/api/games/${gameId}/events`)
      .set('Cookie', owner.cookie)
      .send({ eventType: 'shot', rosterPlayerId: scorer, x: 0.95, y: 0.5, shotType: 'direct', outcome: 'goal' });
    expect(shotRes.status).toBe(201);
    expect(shotRes.body.data.metadata.companionGoalEventId).toBeDefined();

    const afterRes = await request(app).get(`/api/games/${gameId}/events`).set('Cookie', owner.cookie);
    const goalsAfter = afterRes.body.data.filter((e) => e.eventType === 'goal').length;
    expect(goalsAfter).toBe(goalsBefore + 1);

    const companion = afterRes.body.data.find((e) => e._id === shotRes.body.data.metadata.companionGoalEventId);
    expect(companion).toBeDefined();
    expect(companion.eventType).toBe('goal');
    expect(companion.rosterPlayerId).toBe(scorer);
    expect(companion.isOpponent).toBe(false);
    // Companion bleibt schlank – keine Schuss-Details übernommen.
    expect(companion.zone).toBeNull();
    expect(companion.shotType).toBeNull();
  });

  // Phasenplanungs-Review 2026-08-21: secondaryRosterPlayerId auf einem
  // eigenen Tor bedeutet Assist (ADR-0003) – muss auf das Companion-Goal-
  // Event mitkopiert werden, da getRosterStats Assists aus event_type='goal'
  // zählt, nicht aus 'shot'.
  it('kopiert secondaryRosterPlayerId (Assist) bei eigenem Tor auf das Companion-Goal-Event mit', async () => {
    const shotRes = await request(app)
      .post(`/api/games/${gameId}/events`)
      .set('Cookie', owner.cookie)
      .send({ eventType: 'shot', rosterPlayerId: scorer, secondaryRosterPlayerId: assister, x: 0.95, y: 0.5, outcome: 'goal' });
    expect(shotRes.status).toBe(201);
    expect(shotRes.body.data.secondaryRosterPlayerId).toBe(assister);

    const afterRes = await request(app).get(`/api/games/${gameId}/events`).set('Cookie', owner.cookie);
    const companion = afterRes.body.data.find((e) => e._id === shotRes.body.data.metadata.companionGoalEventId);
    expect(companion.secondaryRosterPlayerId).toBe(assister);
  });

  it('kopiert secondaryRosterPlayerId NICHT auf das Companion-Goal-Event bei einem Gegner-Tor (dort bedeutet es "unser Torhüter", kein Assist)', async () => {
    const shotRes = await request(app)
      .post(`/api/games/${gameId}/events`)
      .set('Cookie', owner.cookie)
      .send({ eventType: 'shot', isOpponent: true, secondaryRosterPlayerId: keeper, x: 0.95, y: 0.5, outcome: 'goal' });
    expect(shotRes.status).toBe(201);

    const afterRes = await request(app).get(`/api/games/${gameId}/events`).set('Cookie', owner.cookie);
    const companion = afterRes.body.data.find((e) => e._id === shotRes.body.data.metadata.companionGoalEventId);
    expect(companion.secondaryRosterPlayerId).toBeNull();
  });

  it('legt bei outcome=save/miss/block KEIN zusätzliches goal-Event an', async () => {
    for (const outcome of ['save', 'miss', 'block']) {
      const beforeRes = await request(app).get(`/api/games/${gameId}/events`).set('Cookie', owner.cookie);
      const goalsBefore = beforeRes.body.data.filter((e) => e.eventType === 'goal').length;

      const shotRes = await request(app)
        .post(`/api/games/${gameId}/events`)
        .set('Cookie', owner.cookie)
        .send({ eventType: 'shot', rosterPlayerId: scorer, x: 0.5, y: 0.5, outcome });
      expect(shotRes.status).toBe(201);
      expect(shotRes.body.data.metadata.companionGoalEventId).toBeUndefined();

      const afterRes = await request(app).get(`/api/games/${gameId}/events`).set('Cookie', owner.cookie);
      const goalsAfter = afterRes.body.data.filter((e) => e.eventType === 'goal').length;
      expect(goalsAfter).toBe(goalsBefore);
    }
  });

  it('Gegner-Schuss mit Torhüter-Zuordnung: goalkeeper-stats spiegelt goalsAgainst/saves korrekt', async () => {
    const freshGameRes = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'GK-Test-Gegner', teamId });
    const freshGameId = freshGameRes.body.data._id;

    await request(app).post(`/api/games/${freshGameId}/events`).set('Cookie', owner.cookie)
      .send({ eventType: 'shot', isOpponent: true, secondaryRosterPlayerId: keeper, x: 0.9, y: 0.5, outcome: 'goal' });
    await request(app).post(`/api/games/${freshGameId}/events`).set('Cookie', owner.cookie)
      .send({ eventType: 'shot', isOpponent: true, secondaryRosterPlayerId: keeper, x: 0.9, y: 0.5, outcome: 'save' });

    const gkStatsRes = await request(app).get(`/api/games/${freshGameId}/events/goalkeeper-stats`).set('Cookie', owner.cookie);
    expect(gkStatsRes.status).toBe(200);
    const keeperStats = gkStatsRes.body.data.find((g) => g.rosterPlayerId === keeper);
    expect(keeperStats).toMatchObject({ shotsAgainst: 2, shotsOnGoalAgainst: 2, saves: 1, goalsAgainst: 1 });
    expect(keeperStats.savePercentage).toBeCloseTo(50);

    // Der Gegner-Treffer erhöht auch den Spielstand (Companion-Event).
    const eventsRes = await request(app).get(`/api/games/${freshGameId}/events`).set('Cookie', owner.cookie);
    const opponentGoals = eventsRes.body.data.filter((e) => e.eventType === 'goal' && e.isOpponent).length;
    expect(opponentGoals).toBe(1);
  });

  it('lehnt gleichzeitig rosterPlayerId UND isOpponent weiterhin ab (Torhüter-Zuordnung läuft über secondaryRosterPlayerId, nicht rosterPlayerId)', async () => {
    const res = await request(app)
      .post(`/api/games/${gameId}/events`)
      .set('Cookie', owner.cookie)
      .send({ eventType: 'shot', rosterPlayerId: keeper, isOpponent: true, outcome: 'save' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/games/:id/events/shot-stats', () => {
  it('liefert plausible Werte und ist read-only zugänglich für member', async () => {
    const freshGameRes = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'ShotStats-Test', teamId });
    const freshGameId = freshGameRes.body.data._id;

    await request(app).post(`/api/games/${freshGameId}/events`).set('Cookie', owner.cookie).send({ eventType: 'shot', rosterPlayerId: scorer, x: 0.95, y: 0.5, outcome: 'goal' });
    await request(app).post(`/api/games/${freshGameId}/events`).set('Cookie', owner.cookie).send({ eventType: 'shot', rosterPlayerId: scorer, x: 0.95, y: 0.5, outcome: 'save' });
    await request(app).post(`/api/games/${freshGameId}/events`).set('Cookie', owner.cookie).send({ eventType: 'shot', rosterPlayerId: scorer, x: 0.2, y: 0.5, outcome: 'miss' });

    const res = await request(app).get(`/api/games/${freshGameId}/events/shot-stats`).set('Cookie', member.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ shots: 3, shotsOnGoal: 2, goals: 1, saves: 1, misses: 1, blocks: 0 });
    expect(res.body.data.shotPercentage).toBeCloseTo(50);

    const strangerRes = await request(app).get(`/api/games/${freshGameId}/events/shot-stats`).set('Cookie', stranger.cookie);
    expect(strangerRes.status).toBe(404);
  });
});

describe('DELETE /api/games/:id/events/:eventId – Companion-Kaskade', () => {
  it('löscht beim Löschen eines Schusses mit Companion-Goal auch das Companion-Goal, beide werden geloggt', async () => {
    const shotRes = await request(app)
      .post(`/api/games/${gameId}/events`)
      .set('Cookie', owner.cookie)
      .send({ eventType: 'shot', rosterPlayerId: scorer, x: 0.95, y: 0.5, outcome: 'goal' });
    const shotId = shotRes.body.data._id;
    const companionId = shotRes.body.data.metadata.companionGoalEventId;

    const delRes = await request(app).delete(`/api/games/${gameId}/events/${shotId}`).set('Cookie', owner.cookie);
    expect(delRes.status).toBe(200);

    const listRes = await request(app).get(`/api/games/${gameId}/events`).set('Cookie', owner.cookie);
    expect(listRes.body.data.some((e) => e._id === shotId)).toBe(false);
    expect(listRes.body.data.some((e) => e._id === companionId)).toBe(false);

    const deletionLog = await pool.query('SELECT event_type FROM game_event_deletions WHERE game_id = $1 ORDER BY deleted_at DESC LIMIT 2', [gameId]);
    expect(deletionLog.rows.map((r) => r.event_type).sort()).toEqual(['goal', 'shot']);
  });

  it('löscht nur eine Zeile, wenn der Schuss kein Companion-Goal hat', async () => {
    const shotRes = await request(app)
      .post(`/api/games/${gameId}/events`)
      .set('Cookie', owner.cookie)
      .send({ eventType: 'shot', rosterPlayerId: scorer, x: 0.5, y: 0.5, outcome: 'miss' });
    const shotId = shotRes.body.data._id;

    const beforeCount = (await request(app).get(`/api/games/${gameId}/events`).set('Cookie', owner.cookie)).body.data.length;
    await request(app).delete(`/api/games/${gameId}/events/${shotId}`).set('Cookie', owner.cookie);
    const afterCount = (await request(app).get(`/api/games/${gameId}/events`).set('Cookie', owner.cookie)).body.data.length;
    expect(afterCount).toBe(beforeCount - 1);
  });
});

describe('Transaktions-Sicherheit ohne Nebenwirkungen', () => {
  it('eine frühe Ablehnung (unbekannter eventType) erzeugt keine Zeile', async () => {
    const beforeCount = (await request(app).get(`/api/games/${gameId}/events`).set('Cookie', owner.cookie)).body.data.length;
    const res = await request(app)
      .post(`/api/games/${gameId}/events`)
      .set('Cookie', owner.cookie)
      .send({ eventType: 'unknown_type', outcome: 'goal' });
    expect(res.status).toBe(400);
    const afterCount = (await request(app).get(`/api/games/${gameId}/events`).set('Cookie', owner.cookie)).body.data.length;
    expect(afterCount).toBe(beforeCount);
  });
});
