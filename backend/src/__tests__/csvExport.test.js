/**
 * csvExport.test.js – Statistik-Architektur Phase 7 (CSV-Export,
 * Phasenplanungs-Review 2026-08-21: ersetzt das ursprünglich vage
 * "Report Builder"-Ziel).
 */
import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'csvexport-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123', birthday: '1990-01-01'});
  return { email, cookie: res.headers['set-cookie'][0] };
}

let owner;
let teamId;
let playerId;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  owner = await registerAndLogin('owner');

  const teamRes = await request(app).post('/api/teams').set('Cookie', owner.cookie).send({ name: 'CSV-Export-Test-Team' });
  teamId = teamRes.body.data._id;

  const playerRes = await request(app).post('/api/roster').set('Cookie', owner.cookie).send({ name: 'Müller', jerseyNumber: 9, teamId });
  playerId = playerRes.body.data._id;

  const gameRes = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'CSV-Gegner', teamId, playedAt: '2026-05-01' });
  const gameId = gameRes.body.data._id;
  await request(app).post(`/api/games/${gameId}/events`).set('Cookie', owner.cookie).send({ eventType: 'goal', rosterPlayerId: playerId });
  await request(app).post(`/api/games/${gameId}/events`).set('Cookie', owner.cookie).send({ eventType: 'goal', isOpponent: true });
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('GET /api/export/roster-stats.csv', () => {
  it('liefert eine CSV mit Kopfzeile, Team-Name statt UUID und UTF-8-BOM', async () => {
    const res = await request(app).get('/api/export/roster-stats.csv').set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/csv/);
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.text.charCodeAt(0)).toBe(0xFEFF);

    const body = res.text.slice(1); // BOM abschneiden
    const lines = body.trim().split('\r\n');
    expect(lines[0]).toBe('Name,Nummer,Team,Tore,Vorlagen,Punkte,Strafminuten,Matchstrafen,Einsätze,Schüsse,Schuss-%,Gegentore,Fangquote-%,Trainings-%');
    const playerLine = lines.find((l) => l.startsWith('Müller,'));
    expect(playerLine).toBeDefined();
    expect(playerLine).toContain('CSV-Export-Test-Team');
    expect(playerLine.split(',')[3]).toBe('1'); // Tore
  });

  it('lehnt nicht authentifizierte Anfragen mit 401 ab', async () => {
    const res = await request(app).get('/api/export/roster-stats.csv');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/export/games.csv', () => {
  it('liefert eine CSV-Zeile pro Spiel mit korrektem Endstand', async () => {
    const res = await request(app).get('/api/export/games.csv').set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/csv/);

    const body = res.text.slice(1);
    const lines = body.trim().split('\r\n');
    expect(lines[0]).toBe('Datum,Gegner,Team,Tore eigen,Tore Gegner');
    const gameLine = lines.find((l) => l.includes('CSV-Gegner'));
    expect(gameLine).toBe('2026-05-01,CSV-Gegner,CSV-Export-Test-Team,1,1');
  });

  it('escaped ein Komma im Gegnernamen korrekt (RFC 4180)', async () => {
    await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'SC Musterstadt, 2. Mannschaft', teamId });
    const res = await request(app).get('/api/export/games.csv').set('Cookie', owner.cookie);
    expect(res.text).toContain('"SC Musterstadt, 2. Mannschaft"');
  });
});
