/**
 * rosterStats.test.js – Spieler-Statistiken (Roadmap-Audit, Fortsetzung
 * Phase C): Tore/Strafminuten/Matchstrafen aus game_events, Einsätze
 * aus game_squad, rein lesend, keine neue Tabelle.
 */
import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'rosterstats-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123' });
  return { email, cookie: res.headers['set-cookie'][0] };
}

async function createGame(cookie, teamId = null) {
  const res = await request(app).post('/api/games').set('Cookie', cookie).send({ opponent: 'Stats-Test-Gegner', teamId });
  return res.body.data._id;
}

async function addEvent(cookie, gameId, body) {
  return request(app).post(`/api/games/${gameId}/events`).set('Cookie', cookie).send(body);
}

let owner;
let member;
let stranger;
let teamId;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  owner = await registerAndLogin('owner');
  member = await registerAndLogin('member');
  stranger = await registerAndLogin('stranger');

  const teamRes = await request(app).post('/api/teams').set('Cookie', owner.cookie).send({ name: 'RosterStats-Test-Team' });
  teamId = teamRes.body.data._id;
  await request(app).post(`/api/teams/${teamId}/members`).set('Cookie', owner.cookie).send({ email: member.email, role: 'member' });
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('GET /api/roster/stats', () => {
  it('berechnet Tore/Strafminuten/Matchstrafen/Einsätze korrekt', async () => {
    const playerRes = await request(app).post('/api/roster').set('Cookie', owner.cookie).send({ name: 'Torschütze', teamId });
    const playerId = playerRes.body.data._id;

    const game1 = await createGame(owner.cookie, teamId);
    const game2 = await createGame(owner.cookie, teamId);

    // 2 dem Spieler zugeordnete Tore + 1 Tor ohne Zuordnung (kann keinem
    // Spieler persönlich angerechnet werden, zählt nur fürs Team-Live-
    // Ergebnis) + 1 Gegentor (zählt für niemanden im eigenen Kader)
    await addEvent(owner.cookie, game1, { eventType: 'goal', rosterPlayerId: playerId });
    await addEvent(owner.cookie, game1, { eventType: 'goal', rosterPlayerId: playerId });
    await addEvent(owner.cookie, game1, { eventType: 'goal' });
    await addEvent(owner.cookie, game1, { eventType: 'goal', isOpponent: true });
    // 2+5 = 7 Strafminuten, 1 Matchstrafe
    await addEvent(owner.cookie, game1, { eventType: 'penalty_2', rosterPlayerId: playerId });
    await addEvent(owner.cookie, game1, { eventType: 'penalty_5', rosterPlayerId: playerId });
    await addEvent(owner.cookie, game1, { eventType: 'match_penalty', rosterPlayerId: playerId });
    // 2 Einsätze (playing) über beide Spiele
    await request(app).put(`/api/games/${game1}/squad/${playerId}`).set('Cookie', owner.cookie).send({ status: 'playing' });
    await request(app).put(`/api/games/${game2}/squad/${playerId}`).set('Cookie', owner.cookie).send({ status: 'playing' });
    // Reserve zählt nicht als Einsatz
    const game3 = await createGame(owner.cookie, teamId);
    await request(app).put(`/api/games/${game3}/squad/${playerId}`).set('Cookie', owner.cookie).send({ status: 'reserve' });

    const res = await request(app).get('/api/roster/stats').set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    const entry = res.body.data.find((p) => p._id === playerId);
    expect(entry.goals).toBe(2);
    expect(entry.assists).toBe(0);
    expect(entry.points).toBe(2);
    expect(entry.penaltyMinutes).toBe(7);
    expect(entry.matchPenalties).toBe(1);
    expect(entry.appearances).toBe(2);
  });

  it('liefert 0 statt null für einen Spieler ganz ohne Ereignisse', async () => {
    const playerRes = await request(app).post('/api/roster').set('Cookie', owner.cookie).send({ name: 'Unbenutzt', teamId });
    const playerId = playerRes.body.data._id;

    const res = await request(app).get('/api/roster/stats').set('Cookie', owner.cookie);
    const entry = res.body.data.find((p) => p._id === playerId);
    expect(entry.goals).toBe(0);
    expect(entry.assists).toBe(0);
    expect(entry.points).toBe(0);
    expect(entry.penaltyMinutes).toBe(0);
    expect(entry.matchPenalties).toBe(0);
    expect(entry.appearances).toBe(0);
  });

  // Phasenplanungs-Review 2026-08-21: Assists waren seit Phase 1 als
  // Datenfeld vorbereitet (secondary_roster_player_id), aber nie
  // ausgewertet.
  it('zählt Assists (secondary_roster_player_id auf eigenem Tor) und berechnet Punkte = Tore + Assists', async () => {
    const scorerRes = await request(app).post('/api/roster').set('Cookie', owner.cookie).send({ name: 'Assist-Torschütze', teamId });
    const assisterRes = await request(app).post('/api/roster').set('Cookie', owner.cookie).send({ name: 'Assist-Geber', teamId });
    const scorerId = scorerRes.body.data._id;
    const assisterId = assisterRes.body.data._id;
    const game = await createGame(owner.cookie, teamId);

    // Direkter API-Pfad (einfaches "Tor"-Preset mit secondaryRosterPlayerId).
    await addEvent(owner.cookie, game, { eventType: 'goal', rosterPlayerId: scorerId, secondaryRosterPlayerId: assisterId });
    // Schuss-Tracking-Pfad: Companion-Goal-Event kopiert secondaryRosterPlayerId mit.
    await addEvent(owner.cookie, game, {
      eventType: 'shot', outcome: 'goal', rosterPlayerId: scorerId, secondaryRosterPlayerId: assisterId,
    });
    // Gegentor mit "unser Torhüter" – secondary_roster_player_id hat hier
    // eine andere Bedeutung (ADR-0003) und darf NICHT als Assist zählen.
    const gkRes = await request(app).post('/api/roster').set('Cookie', owner.cookie).send({ name: 'Assist-Test-TW', role: 'TW', teamId });
    await addEvent(owner.cookie, game, {
      eventType: 'shot', outcome: 'goal', isOpponent: true, secondaryRosterPlayerId: gkRes.body.data._id,
    });

    const res = await request(app).get('/api/roster/stats').set('Cookie', owner.cookie);
    const scorerEntry = res.body.data.find((p) => p._id === scorerId);
    const assisterEntry = res.body.data.find((p) => p._id === assisterId);
    const gkEntry = res.body.data.find((p) => p._id === gkRes.body.data._id);
    expect(scorerEntry.goals).toBe(2);
    expect(scorerEntry.assists).toBe(0);
    expect(scorerEntry.points).toBe(2);
    expect(assisterEntry.goals).toBe(0);
    expect(assisterEntry.assists).toBe(2);
    expect(assisterEntry.points).toBe(2);
    expect(gkEntry.assists).toBe(0);
  });

  it('berechnet die Trainings-Beteiligungsquote (Statistik-Architektur Phase 5)', async () => {
    const playerRes = await request(app).post('/api/roster').set('Cookie', owner.cookie).send({ name: 'Trainingsfleißig', teamId });
    const playerId = playerRes.body.data._id;

    const s1 = await request(app).post('/api/trainings').set('Cookie', owner.cookie).send({ name: 'Stats-Training-1', teamId });
    const s2 = await request(app).post('/api/trainings').set('Cookie', owner.cookie).send({ name: 'Stats-Training-2', teamId });
    const s3 = await request(app).post('/api/trainings').set('Cookie', owner.cookie).send({ name: 'Stats-Training-3', teamId });
    await request(app).put(`/api/trainings/${s1.body.data._id}/attendance/${playerId}`).set('Cookie', owner.cookie).send({ status: 'present' });
    await request(app).put(`/api/trainings/${s2.body.data._id}/attendance/${playerId}`).set('Cookie', owner.cookie).send({ status: 'present' });
    await request(app).put(`/api/trainings/${s3.body.data._id}/attendance/${playerId}`).set('Cookie', owner.cookie).send({ status: 'excused' });

    const res = await request(app).get('/api/roster/stats').set('Cookie', owner.cookie);
    const entry = res.body.data.find((p) => p._id === playerId);
    expect(entry.trainingsRecorded).toBe(3);
    expect(entry.trainingsPresent).toBe(2);
    expect(entry.attendanceRate).toBeCloseTo(66.7, 1);
  });

  it('liefert null statt 0 für die Beteiligungsquote ohne erfasstes Training ("unbekannt ≠ 0")', async () => {
    const playerRes = await request(app).post('/api/roster').set('Cookie', owner.cookie).send({ name: 'Ohne-Training', teamId });
    const playerId = playerRes.body.data._id;

    const res = await request(app).get('/api/roster/stats').set('Cookie', owner.cookie);
    const entry = res.body.data.find((p) => p._id === playerId);
    expect(entry.trainingsRecorded).toBe(0);
    expect(entry.attendanceRate).toBeNull();
  });

  it('member sieht die Team-Kader-Stats, ein Fremder sieht sie nicht', async () => {
    const memberRes = await request(app).get('/api/roster/stats').set('Cookie', member.cookie);
    expect(memberRes.status).toBe(200);
    expect(memberRes.body.data.some((p) => p.teamId === teamId)).toBe(true);

    const strangerRes = await request(app).get('/api/roster/stats').set('Cookie', stranger.cookie);
    expect(strangerRes.status).toBe(200);
    expect(strangerRes.body.data.some((p) => p.teamId === teamId)).toBe(false);
  });

  it('GET /api/roster/:id funktioniert weiterhin für eine echte UUID (kein Routing-Konflikt mit /stats)', async () => {
    const playerRes = await request(app).post('/api/roster').set('Cookie', owner.cookie).send({ name: 'Routing-Test' });
    const playerId = playerRes.body.data._id;

    const res = await request(app).get(`/api/roster/${playerId}`).set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Routing-Test');
  });
});
