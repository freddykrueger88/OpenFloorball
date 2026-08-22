/**
 * rosterGameLog.test.js – Statistik-Architektur Phase 4 (Trends):
 * GET /api/roster/:id/game-log liefert eine Zeile PRO SPIEL (nicht
 * saison-aggregiert wie GET /api/roster/stats), Grundlage für
 * Last-5/Last-10/Season im Frontend.
 */
import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'rostergamelog-test-';
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

  const teamRes = await request(app).post('/api/teams').set('Cookie', owner.cookie).send({ name: 'GameLog-Test-Team' });
  teamId = teamRes.body.data._id;

  const playerRes = await request(app).post('/api/roster').set('Cookie', owner.cookie).send({ name: 'Verlaufs-Spieler', teamId });
  playerId = playerRes.body.data._id;
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('GET /api/roster/:id/game-log', () => {
  it('liefert nur datierte Spiele mit status=playing, chronologisch aufsteigend, Werte pro Spiel getrennt', async () => {
    const game1Res = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Verlauf-Gegner-1', teamId, playedAt: '2026-01-05' });
    const game1Id = game1Res.body.data._id;
    const game2Res = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Verlauf-Gegner-2', teamId, playedAt: '2026-01-12' });
    const game2Id = game2Res.body.data._id;
    const undatedGameRes = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Verlauf-Gegner-undatiert', teamId });
    const undatedGameId = undatedGameRes.body.data._id;

    await request(app).put(`/api/games/${game1Id}/squad/${playerId}`).set('Cookie', owner.cookie).send({ status: 'playing' });
    await request(app).put(`/api/games/${game2Id}/squad/${playerId}`).set('Cookie', owner.cookie).send({ status: 'playing' });
    await request(app).put(`/api/games/${undatedGameId}/squad/${playerId}`).set('Cookie', owner.cookie).send({ status: 'playing' });

    await request(app).post(`/api/games/${game1Id}/events`).set('Cookie', owner.cookie).send({ eventType: 'goal', rosterPlayerId: playerId });
    await request(app).post(`/api/games/${game1Id}/events`).set('Cookie', owner.cookie).send({ eventType: 'penalty_2', rosterPlayerId: playerId });
    await request(app).post(`/api/games/${game2Id}/events`).set('Cookie', owner.cookie).send({ eventType: 'goal', rosterPlayerId: playerId });
    await request(app).post(`/api/games/${game2Id}/events`).set('Cookie', owner.cookie).send({ eventType: 'goal', rosterPlayerId: playerId });
    await request(app).post(`/api/games/${undatedGameId}/events`).set('Cookie', owner.cookie).send({ eventType: 'goal', rosterPlayerId: playerId });

    const res = await request(app).get(`/api/roster/${playerId}/game-log`).set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2); // undatiertes Spiel ausgeschlossen
    expect(res.body.data.map((g) => g.gameId)).toEqual([game1Id, game2Id]); // chronologisch aufsteigend

    const game1Entry = res.body.data.find((g) => g.gameId === game1Id);
    expect(game1Entry).toMatchObject({ opponent: 'Verlauf-Gegner-1', goals: 1, penaltyMinutes: 2 });
    const game2Entry = res.body.data.find((g) => g.gameId === game2Id);
    expect(game2Entry).toMatchObject({ opponent: 'Verlauf-Gegner-2', goals: 2, penaltyMinutes: 0 });
  });

  it('zählt Assists getrennt je Spiel (Phasenplanungs-Review 2026-08-21)', async () => {
    const scorerRes = await request(app).post('/api/roster').set('Cookie', owner.cookie).send({ name: 'GameLog-Torschütze', teamId });
    const scorerId = scorerRes.body.data._id;
    const gameRes = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Verlauf-Assist-Test', teamId, playedAt: '2026-04-01' });
    const gameId = gameRes.body.data._id;
    await request(app).put(`/api/games/${gameId}/squad/${playerId}`).set('Cookie', owner.cookie).send({ status: 'playing' });

    await request(app).post(`/api/games/${gameId}/events`).set('Cookie', owner.cookie)
      .send({ eventType: 'goal', rosterPlayerId: scorerId, secondaryRosterPlayerId: playerId });

    const res = await request(app).get(`/api/roster/${playerId}/game-log`).set('Cookie', owner.cookie);
    const entry = res.body.data.find((g) => g.gameId === gameId);
    expect(entry.assists).toBe(1);
    expect(entry.goals).toBe(0);
  });

  it('schließt Spiele aus, in denen der Spieler nicht status=playing hat', async () => {
    const gameRes = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Verlauf-Reserve-Test', teamId, playedAt: '2026-02-01' });
    const gameId = gameRes.body.data._id;
    await request(app).put(`/api/games/${gameId}/squad/${playerId}`).set('Cookie', owner.cookie).send({ status: 'reserve' });

    const res = await request(app).get(`/api/roster/${playerId}/game-log`).set('Cookie', owner.cookie);
    expect(res.body.data.some((g) => g.gameId === gameId)).toBe(false);
  });

  it('trennt Schuss-Statistiken korrekt je Spiel (kein Cross-Game-Bleed)', async () => {
    const gameARes = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Verlauf-Shot-A', teamId, playedAt: '2026-03-01' });
    const gameAId = gameARes.body.data._id;
    const gameBRes = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Verlauf-Shot-B', teamId, playedAt: '2026-03-08' });
    const gameBId = gameBRes.body.data._id;
    await request(app).put(`/api/games/${gameAId}/squad/${playerId}`).set('Cookie', owner.cookie).send({ status: 'playing' });
    await request(app).put(`/api/games/${gameBId}/squad/${playerId}`).set('Cookie', owner.cookie).send({ status: 'playing' });

    await request(app).post(`/api/games/${gameAId}/events`).set('Cookie', owner.cookie).send({ eventType: 'shot', rosterPlayerId: playerId, x: 0.9, y: 0.5, outcome: 'goal' });
    await request(app).post(`/api/games/${gameBId}/events`).set('Cookie', owner.cookie).send({ eventType: 'shot', rosterPlayerId: playerId, x: 0.9, y: 0.5, outcome: 'save' });
    await request(app).post(`/api/games/${gameBId}/events`).set('Cookie', owner.cookie).send({ eventType: 'shot', rosterPlayerId: playerId, x: 0.9, y: 0.5, outcome: 'miss' });

    const res = await request(app).get(`/api/roster/${playerId}/game-log`).set('Cookie', owner.cookie);
    const entryA = res.body.data.find((g) => g.gameId === gameAId);
    const entryB = res.body.data.find((g) => g.gameId === gameBId);
    expect(entryA).toMatchObject({ shots: 1, shotsOnGoal: 1, shotGoals: 1 });
    expect(entryB).toMatchObject({ shots: 2, shotsOnGoal: 1, shotGoals: 0 });
  });

  it('member darf lesen, Fremder bekommt 404', async () => {
    const memberRes = await registerAndLogin('member');
    await request(app).post(`/api/teams/${teamId}/members`).set('Cookie', owner.cookie).send({ email: memberRes.email, role: 'member' });

    const okRes = await request(app).get(`/api/roster/${playerId}/game-log`).set('Cookie', memberRes.cookie);
    expect(okRes.status).toBe(200);

    const strangerRes = await request(app).get(`/api/roster/${playerId}/game-log`).set('Cookie', stranger.cookie);
    expect(strangerRes.status).toBe(404);
  });
});
