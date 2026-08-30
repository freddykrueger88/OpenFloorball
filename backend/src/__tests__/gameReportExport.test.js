/**
 * gameReportExport.test.js – Spielbericht-PDF-Export (Roadmap-Audit,
 * Fortsetzung Phase C). Muster analog export-pdf.test.js: Buffer-
 * Parsing + %PDF-Magic-Byte-Check statt Inhaltsprüfung.
 */
import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'gamereport-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123', birthday: '1990-01-01'});
  return { email, cookie: res.headers['set-cookie'][0] };
}

async function requestReport(cookie, body) {
  return request(app)
    .post('/api/export/game-report')
    .set('Cookie', cookie)
    .buffer(true)
    .parse((response, callback) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => callback(null, Buffer.concat(chunks)));
    })
    .send(body);
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

  const teamRes = await request(app).post('/api/teams').set('Cookie', owner.cookie).send({ name: 'GameReport-Test-Team' });
  teamId = teamRes.body.data._id;
  await request(app).post(`/api/teams/${teamId}/members`).set('Cookie', owner.cookie).send({ email: member.email, role: 'member' });
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('POST /api/export/game-report', () => {
  it('erstellt ein valides PDF mit Ereignissen und Kader', async () => {
    const playerRes = await request(app).post('/api/roster').set('Cookie', owner.cookie).send({ name: 'Berichts-Spieler', jerseyNumber: 7, teamId });
    const playerId = playerRes.body.data._id;

    const gameRes = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Berichts-Gegner', playedAt: '2026-08-11', teamId });
    const gameId = gameRes.body.data._id;

    await request(app).post(`/api/games/${gameId}/events`).set('Cookie', owner.cookie).send({ eventType: 'goal', rosterPlayerId: playerId });
    await request(app).post(`/api/games/${gameId}/events`).set('Cookie', owner.cookie).send({ eventType: 'penalty_2', isOpponent: true });
    await request(app).put(`/api/games/${gameId}/squad/${playerId}`).set('Cookie', owner.cookie).send({ status: 'playing' });

    const res = await requestReport(owner.cookie, { gameId, language: 'de' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toMatch(/openfloorball-spielbericht\.pdf/);
    expect(res.body.slice(0, 5).toString()).toBe('%PDF-');
  });

  it('erstellt ein valides PDF auch für ein Spiel ganz ohne Ereignisse/Kader', async () => {
    const gameRes = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Leeres Spiel' });
    const gameId = gameRes.body.data._id;

    const res = await requestReport(owner.cookie, { gameId, language: 'en' });
    expect(res.status).toBe(200);
    expect(res.body.slice(0, 5).toString()).toBe('%PDF-');
  });

  it('member (Lesezugriff reicht) darf exportieren', async () => {
    const gameRes = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Team-Spiel', teamId });
    const gameId = gameRes.body.data._id;

    const res = await requestReport(member.cookie, { gameId });
    expect(res.status).toBe(200);
    expect(res.body.slice(0, 5).toString()).toBe('%PDF-');
  });

  it('fremder Nutzer (kein Team-Mitglied) bekommt 404', async () => {
    const gameRes = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Team-Spiel-2', teamId });
    const gameId = gameRes.body.data._id;

    const res = await request(app).post('/api/export/game-report').set('Cookie', stranger.cookie).send({ gameId });
    expect(res.status).toBe(404);
  });

  it('nicht existierende gameId bekommt 404', async () => {
    const res = await request(app)
      .post('/api/export/game-report')
      .set('Cookie', owner.cookie)
      .send({ gameId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(404);
  });
});
