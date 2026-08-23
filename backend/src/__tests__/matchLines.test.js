/**
 * matchLines.test.js – Match-Line/Shift-Tracking (Statistik-Architektur
 * Phase 2): zeitgestempelte Historie, welche Line während eines Spiels
 * wann "auf dem Feld" war – zusätzlich zur weiterhin unveränderten
 * lines.is_active-Vorlage und der weiterhin unveränderten Freitext-Notiz.
 */
import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'matchlines-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123' });
  return { email, cookie: res.headers['set-cookie'][0] };
}

async function createLine(cookie, name, teamId = null) {
  const res = await request(app).post('/api/lines').set('Cookie', cookie).send({ name, teamId });
  return res.body.data._id;
}

let owner;
let member;
let stranger;
let teamId;
let gameId;
let lineA;
let lineB;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  owner = await registerAndLogin('owner');
  member = await registerAndLogin('member');
  stranger = await registerAndLogin('stranger');

  const teamRes = await request(app).post('/api/teams').set('Cookie', owner.cookie).send({ name: 'MatchLines-Test-Team' });
  teamId = teamRes.body.data._id;
  await request(app).post(`/api/teams/${teamId}/members`).set('Cookie', owner.cookie).send({ email: member.email, role: 'member' });

  lineA = await createLine(owner.cookie, 'Line A', teamId);
  lineB = await createLine(owner.cookie, 'Line B', teamId);

  const gameRes = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'MatchLines-Test-Gegner', teamId });
  gameId = gameRes.body.data._id;
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('POST /api/games/:id/match-lines', () => {
  it('aktiviert eine Line, endedAt ist null', async () => {
    const res = await request(app)
      .post(`/api/games/${gameId}/match-lines`)
      .set('Cookie', owner.cookie)
      .send({ lineId: lineA });
    expect(res.status).toBe(201);
    expect(res.body.data.lineId).toBe(lineA);
    expect(res.body.data.lineName).toBe('Line A');
    expect(res.body.data.endedAt).toBeNull();
  });

  it('schließt beim Aktivieren einer zweiten Line automatisch die vorherige offene Zeile', async () => {
    await request(app)
      .post(`/api/games/${gameId}/match-lines`)
      .set('Cookie', owner.cookie)
      .send({ lineId: lineB });

    const historyRes = await request(app).get(`/api/games/${gameId}/match-lines`).set('Cookie', owner.cookie);
    const rows = historyRes.body.data;
    const lineARow = rows.find((r) => r.lineId === lineA);
    const lineBRow = rows.find((r) => r.lineId === lineB);
    expect(lineARow.endedAt).not.toBeNull();
    expect(lineBRow.endedAt).toBeNull();
  });

  it('lehnt eine Line aus falscher Sichtbarkeits-Gruppe mit 400 ab', async () => {
    const foreignLine = await createLine(owner.cookie, 'Persönliche Line ohne Team');
    const res = await request(app)
      .post(`/api/games/${gameId}/match-lines`)
      .set('Cookie', owner.cookie)
      .send({ lineId: foreignLine });
    expect(res.status).toBe(400);
  });

  it('lehnt eine nicht existierende Line mit 404 ab', async () => {
    const res = await request(app)
      .post(`/api/games/${gameId}/match-lines`)
      .set('Cookie', owner.cookie)
      .send({ lineId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(404);
  });

  it('member darf keine Line aktivieren (nur Lesezugriff, 404)', async () => {
    const res = await request(app)
      .post(`/api/games/${gameId}/match-lines`)
      .set('Cookie', member.cookie)
      .send({ lineId: lineA });
    expect(res.status).toBe(404);
  });

  it('stranger bekommt 404', async () => {
    const res = await request(app)
      .post(`/api/games/${gameId}/match-lines`)
      .set('Cookie', stranger.cookie)
      .send({ lineId: lineA });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/games/:id/match-lines', () => {
  it('liefert die Historie chronologisch aufsteigend, member darf lesen, stranger bekommt 404', async () => {
    const res = await request(app).get(`/api/games/${gameId}/match-lines`).set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    const timestamps = res.body.data.map((r) => new Date(r.startedAt).getTime());
    expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));

    const memberRes = await request(app).get(`/api/games/${gameId}/match-lines`).set('Cookie', member.cookie);
    expect(memberRes.status).toBe(200);

    const strangerRes = await request(app).get(`/api/games/${gameId}/match-lines`).set('Cookie', stranger.cookie);
    expect(strangerRes.status).toBe(404);
  });
});

describe('GET /api/games/:id/match-lines/stats', () => {
  it('liefert plausible Line-Statistiken (Tor während aktiver Line zählt für diese Line)', async () => {
    const freshGameRes = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Stats-Test-Gegner', teamId });
    const freshGameId = freshGameRes.body.data._id;

    await request(app).post(`/api/games/${freshGameId}/match-lines`).set('Cookie', owner.cookie).send({ lineId: lineA });
    await request(app).post(`/api/games/${freshGameId}/events`).set('Cookie', owner.cookie).send({ eventType: 'goal' });

    const res = await request(app).get(`/api/games/${freshGameId}/match-lines/stats`).set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    const lineAStats = res.body.data.find((l) => l.lineId === lineA);
    expect(lineAStats).toBeDefined();
    expect(lineAStats.goalsFor).toBe(1);
    expect(lineAStats.goalsAgainst).toBe(0);
    expect(lineAStats.hasOpenShift).toBe(true);
    expect(lineAStats.totalSeconds).toBeGreaterThanOrEqual(0);

    const strangerRes = await request(app).get(`/api/games/${freshGameId}/match-lines/stats`).set('Cookie', stranger.cookie);
    expect(strangerRes.status).toBe(404);
  });
});

describe('GET /api/lines/season-stats (Statistik-Architektur Phase 8: Line-Chemie)', () => {
  it('aggregiert Line-Statistiken über mehrere Spiele hinweg', async () => {
    const game1Res = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Season-Test-1', teamId });
    const game1Id = game1Res.body.data._id;
    const game2Res = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Season-Test-2', teamId });
    const game2Id = game2Res.body.data._id;

    // Spiel 1: Line A aktiv, ein eigenes Tor, danach Line B (schließt A).
    await request(app).post(`/api/games/${game1Id}/match-lines`).set('Cookie', owner.cookie).send({ lineId: lineA });
    await request(app).post(`/api/games/${game1Id}/events`).set('Cookie', owner.cookie).send({ eventType: 'goal' });
    await request(app).post(`/api/games/${game1Id}/match-lines`).set('Cookie', owner.cookie).send({ lineId: lineB });

    // Spiel 2: erneut Line A, ein Gegentor, danach Line B (schließt A).
    await request(app).post(`/api/games/${game2Id}/match-lines`).set('Cookie', owner.cookie).send({ lineId: lineA });
    await request(app).post(`/api/games/${game2Id}/events`).set('Cookie', owner.cookie).send({ eventType: 'goal', isOpponent: true });
    await request(app).post(`/api/games/${game2Id}/match-lines`).set('Cookie', owner.cookie).send({ lineId: lineB });

    const res = await request(app).get('/api/lines/season-stats').set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    const lineAStats = res.body.data.find((l) => l.lineId === lineA);
    expect(lineAStats.goalsFor).toBe(1);
    expect(lineAStats.goalsAgainst).toBe(1);
    // totalSeconds ist bekannt, weil beide neuen Zeilen hier durch Line B
    // abgelöst (geschlossen) wurden – hasOpenShift wird NICHT auf false
    // geprüft, da lineA aus einem früheren Test in dieser Datei
    // (GET .../match-lines/stats) noch eine separate, absichtlich offen
    // gelassene Zeile in einem anderen Spiel hat; calculateLineStats
    // gruppiert über ALLE Spiele hinweg, das ist hier korrektes Verhalten.
    expect(lineAStats.totalSeconds).not.toBeNull();
  });

  it('lässt eine noch offene Zeile aus einem laufenden Spiel bewusst unberücksichtigt ("unbekannt ≠ 0")', async () => {
    const openGameRes = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Season-Open-Test', teamId });
    const openGameId = openGameRes.body.data._id;
    const openLine = await createLine(owner.cookie, 'Offene-Season-Line', teamId);

    await request(app).post(`/api/games/${openGameId}/match-lines`).set('Cookie', owner.cookie).send({ lineId: openLine });
    await request(app).post(`/api/games/${openGameId}/events`).set('Cookie', owner.cookie).send({ eventType: 'goal' });
    // Bewusst NICHT geschlossen (keine zweite Line aktiviert).

    const res = await request(app).get('/api/lines/season-stats').set('Cookie', owner.cookie);
    const stats = res.body.data.find((l) => l.lineId === openLine);
    expect(stats.totalSeconds).toBeNull();
    expect(stats.goalsFor).toBe(0); // Tor während der offenen Zeile zählt hier bewusst nicht
    expect(stats.hasOpenShift).toBe(true);
  });

  it('lehnt einen Fremden mit leerer Liste statt fremden Daten ab', async () => {
    const res = await request(app).get('/api/lines/season-stats').set('Cookie', stranger.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe('Cascade-Aufräumen', () => {
  it('löscht match_lines-Zeilen, wenn das Spiel gelöscht wird', async () => {
    const tempGameRes = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Cascade-Test', teamId });
    const tempGameId = tempGameRes.body.data._id;
    await request(app).post(`/api/games/${tempGameId}/match-lines`).set('Cookie', owner.cookie).send({ lineId: lineA });

    await request(app).delete(`/api/games/${tempGameId}`).set('Cookie', owner.cookie);

    const dbCheck = await pool.query('SELECT id FROM match_lines WHERE game_id = $1', [tempGameId]);
    expect(dbCheck.rows).toHaveLength(0);
  });

  it('setzt line_id auf NULL statt die Zeile zu löschen, wenn die Line-Vorlage gelöscht wird', async () => {
    const tempLine = await createLine(owner.cookie, 'Wird-gelöscht', teamId);
    const tempGameRes = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Line-Delete-Test', teamId });
    const tempGameId = tempGameRes.body.data._id;
    const activateRes = await request(app).post(`/api/games/${tempGameId}/match-lines`).set('Cookie', owner.cookie).send({ lineId: tempLine });
    const matchLineId = activateRes.body.data._id;

    await request(app).delete(`/api/lines/${tempLine}`).set('Cookie', owner.cookie);

    const dbCheck = await pool.query('SELECT line_id, line_name FROM match_lines WHERE id = $1', [matchLineId]);
    expect(dbCheck.rows[0].line_id).toBeNull();
    expect(dbCheck.rows[0].line_name).toBe('Wird-gelöscht');
  });
});
