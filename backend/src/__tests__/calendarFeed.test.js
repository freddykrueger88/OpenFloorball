/**
 * calendarFeed.test.js – ICS-Kalender-Abo (Roadmap-Audit). Deckt
 * Token-Verwaltung (authentifiziert, /api/user/calendar-feed) und den
 * öffentlichen Feed (/api/calendar-feed/:token.ics, kein Auth) ab.
 */
import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'calfeed-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123' });
  return { email, cookie: res.headers['set-cookie'][0] };
}

function tokenFromFeedUrl(feedUrl) {
  return feedUrl.match(/\/calendar-feed\/([0-9a-f-]+)\.ics$/i)[1];
}

let owner;
let member;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  owner = await registerAndLogin('owner');
  member = await registerAndLogin('member');
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('Kalender-Feed-Verwaltung (authentifiziert)', () => {
  it('liefert feedUrl: null, solange kein Token erzeugt wurde', async () => {
    const res = await request(app).get('/api/user/calendar-feed').set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.feedUrl).toBeNull();
  });

  it('erzeugt einen Token und liefert eine feedUrl mit .ics-Endung', async () => {
    const res = await request(app).post('/api/user/calendar-feed').set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.feedUrl).toMatch(/\/api\/calendar-feed\/[0-9a-f-]+\.ics$/i);
  });

  it('regenerieren ersetzt den alten Token vollständig (alte URL wird 404)', async () => {
    const first = await request(app).post('/api/user/calendar-feed').set('Cookie', owner.cookie);
    const oldToken = tokenFromFeedUrl(first.body.data.feedUrl);

    const second = await request(app).post('/api/user/calendar-feed').set('Cookie', owner.cookie);
    const newToken = tokenFromFeedUrl(second.body.data.feedUrl);
    expect(newToken).not.toBe(oldToken);

    const oldFeedRes = await request(app).get(`/api/calendar-feed/${oldToken}.ics`);
    expect(oldFeedRes.status).toBe(404);

    const newFeedRes = await request(app).get(`/api/calendar-feed/${newToken}.ics`);
    expect(newFeedRes.status).toBe(200);
  });

  it('widerrufen entfernt den Feed vollständig (404 auf die zuvor gültige URL)', async () => {
    const genRes = await request(app).post('/api/user/calendar-feed').set('Cookie', owner.cookie);
    const token = tokenFromFeedUrl(genRes.body.data.feedUrl);

    const revokeRes = await request(app).delete('/api/user/calendar-feed').set('Cookie', owner.cookie);
    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.data.feedUrl).toBeNull();

    const feedRes = await request(app).get(`/api/calendar-feed/${token}.ics`);
    expect(feedRes.status).toBe(404);

    const statusRes = await request(app).get('/api/user/calendar-feed').set('Cookie', owner.cookie);
    expect(statusRes.body.data.feedUrl).toBeNull();
  });
});

describe('Kalender-Feed (öffentlich)', () => {
  let feedOwner;
  let teamId;
  let token;

  beforeAll(async () => {
    feedOwner = await registerAndLogin('feedowner');

    const teamRes = await request(app).post('/api/teams').set('Cookie', feedOwner.cookie).send({ name: 'Feed-Test-Team' });
    teamId = teamRes.body.data._id;
    await request(app).post(`/api/teams/${teamId}/members`).set('Cookie', feedOwner.cookie).send({ email: member.email, role: 'member' });

    await request(app).post('/api/games').set('Cookie', feedOwner.cookie).send({ opponent: 'Feed-Gegner-Datiert', playedAt: '2026-08-15', teamId });
    await request(app).post('/api/games').set('Cookie', feedOwner.cookie).send({ opponent: 'Feed-Gegner-Undatiert', teamId });
    await request(app).post('/api/trainings').set('Cookie', feedOwner.cookie).send({ name: 'Feed-Training-Datiert', scheduledDate: '2026-08-20', teamId });

    const genRes = await request(app).post('/api/user/calendar-feed').set('Cookie', feedOwner.cookie);
    token = tokenFromFeedUrl(genRes.body.data.feedUrl);
  });

  it('liefert text/calendar mit VEVENTs für datierte Spiele/Trainings, aber nicht für undatierte', async () => {
    const res = await request(app).get(`/api/calendar-feed/${token}.ics`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/calendar/);
    expect(res.text).toContain('BEGIN:VCALENDAR');
    expect(res.text).toContain('SUMMARY:Feed-Gegner-Datiert');
    expect(res.text).toContain('DTSTART;VALUE=DATE:20260815');
    expect(res.text).toContain('SUMMARY:Feed-Training-Datiert');
    expect(res.text).toContain('DTSTART;VALUE=DATE:20260820');
    expect(res.text).not.toContain('Feed-Gegner-Undatiert');
  });

  it('enthält auch team-geteilte Termine im Feed eines anderen Team-Mitglieds', async () => {
    const memberGenRes = await request(app).post('/api/user/calendar-feed').set('Cookie', member.cookie);
    const memberToken = tokenFromFeedUrl(memberGenRes.body.data.feedUrl);

    const res = await request(app).get(`/api/calendar-feed/${memberToken}.ics`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('SUMMARY:Feed-Gegner-Datiert');

    await request(app).delete('/api/user/calendar-feed').set('Cookie', member.cookie);
  });

  it('liefert 404 für einen unbekannten/ungültigen Token', async () => {
    const res = await request(app).get('/api/calendar-feed/00000000-0000-0000-0000-000000000000.ics');
    expect(res.status).toBe(404);
  });

  it('lehnt ein nicht-UUID-Token mit 422 ab', async () => {
    const res = await request(app).get('/api/calendar-feed/not-a-uuid.ics');
    expect(res.status).toBe(422);
  });
});
