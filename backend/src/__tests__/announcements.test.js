/**
 * announcements.test.js – News/Ankündigungen (Roadmap-Audit, Phase D
 * "Kommunikation – minimal"): Coach/Owner postet, Team-Mitglieder
 * lesen, kein Kommentieren.
 */
import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'announcements-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123', birthday: '1990-01-01'});
  return { email, cookie: res.headers['set-cookie'][0] };
}

let owner;
let coach;
let member;
let stranger;
let teamId;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  owner = await registerAndLogin('owner');
  coach = await registerAndLogin('coach');
  member = await registerAndLogin('member');
  stranger = await registerAndLogin('stranger');

  const teamRes = await request(app).post('/api/teams').set('Cookie', owner.cookie).send({ name: 'Announcements-Test-Team' });
  teamId = teamRes.body.data._id;
  await request(app).post(`/api/teams/${teamId}/members`).set('Cookie', owner.cookie).send({ email: coach.email, role: 'coach' });
  await request(app).post(`/api/teams/${teamId}/members`).set('Cookie', owner.cookie).send({ email: member.email, role: 'member' });
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('POST /api/announcements', () => {
  it('coach legt eine Ankündigung an', async () => {
    const res = await request(app)
      .post('/api/announcements')
      .set('Cookie', coach.cookie)
      .send({ teamId, text: 'Training am Dienstag fällt aus' });
    expect(res.status).toBe(201);
    expect(res.body.data.text).toBe('Training am Dienstag fällt aus');
    expect(res.body.data.teamId).toBe(teamId);
    expect(res.body.data.email).toBe(coach.email);
  });

  it('member darf NICHT anlegen (404, nur Lesezugriff)', async () => {
    const res = await request(app)
      .post('/api/announcements')
      .set('Cookie', member.cookie)
      .send({ teamId, text: 'Sollte fehlschlagen' });
    expect(res.status).toBe(404);
  });

  it('lehnt fehlendes teamId/text mit 422 ab', async () => {
    const noTeam = await request(app).post('/api/announcements').set('Cookie', coach.cookie).send({ text: 'Ohne Team' });
    expect(noTeam.status).toBe(422);

    const noText = await request(app).post('/api/announcements').set('Cookie', coach.cookie).send({ teamId });
    expect(noText.status).toBe(422);

    const blankText = await request(app).post('/api/announcements').set('Cookie', coach.cookie).send({ teamId, text: '   ' });
    expect(blankText.status).toBe(422);
  });
});

describe('GET /api/announcements', () => {
  it('member sieht die Ankündigung in seiner Liste, ein Fremder (kein Team-Mitglied) NICHT', async () => {
    const memberRes = await request(app).get('/api/announcements').set('Cookie', member.cookie);
    expect(memberRes.status).toBe(200);
    expect(memberRes.body.data.some((a) => a.teamId === teamId)).toBe(true);

    const strangerRes = await request(app).get('/api/announcements').set('Cookie', stranger.cookie);
    expect(strangerRes.status).toBe(200);
    expect(strangerRes.body.data.some((a) => a.teamId === teamId)).toBe(false);
  });

  it('liefert neueste zuerst', async () => {
    await request(app).post('/api/announcements').set('Cookie', owner.cookie).send({ teamId, text: 'Zweite Ankündigung' });
    const res = await request(app).get('/api/announcements').set('Cookie', owner.cookie);
    const timestamps = res.body.data.map((a) => new Date(a.createdAt).getTime());
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
  });
});

describe('DELETE /api/announcements/:id', () => {
  it('member darf NICHT löschen (404)', async () => {
    const createRes = await request(app).post('/api/announcements').set('Cookie', coach.cookie).send({ teamId, text: 'Wird nicht gelöscht' });
    const id = createRes.body.data._id;

    const res = await request(app).delete(`/api/announcements/${id}`).set('Cookie', member.cookie);
    expect(res.status).toBe(404);
  });

  it('ein zweiter Coach desselben Teams darf löschen (nicht nur der Ersteller)', async () => {
    const createRes = await request(app).post('/api/announcements').set('Cookie', coach.cookie).send({ teamId, text: 'Wird von owner gelöscht' });
    const id = createRes.body.data._id;

    const res = await request(app).delete(`/api/announcements/${id}`).set('Cookie', owner.cookie);
    expect(res.status).toBe(200);

    const listRes = await request(app).get('/api/announcements').set('Cookie', owner.cookie);
    expect(listRes.body.data.some((a) => a._id === id)).toBe(false);
  });

  it('fremder Nutzer bekommt 404', async () => {
    const createRes = await request(app).post('/api/announcements').set('Cookie', coach.cookie).send({ teamId, text: 'Fremdzugriff-Test' });
    const id = createRes.body.data._id;

    const res = await request(app).delete(`/api/announcements/${id}`).set('Cookie', stranger.cookie);
    expect(res.status).toBe(404);
  });
});

describe('Cascade-Aufräumen', () => {
  it('löscht announcements-Zeilen, wenn das Team gelöscht wird', async () => {
    const tempTeamRes = await request(app).post('/api/teams').set('Cookie', owner.cookie).send({ name: 'Cascade-Test-Team' });
    const tempTeamId = tempTeamRes.body.data._id;
    await request(app).post('/api/announcements').set('Cookie', owner.cookie).send({ teamId: tempTeamId, text: 'Verwaiste Ankündigung' });

    await request(app).delete(`/api/teams/${tempTeamId}`).set('Cookie', owner.cookie);

    const dbCheck = await pool.query('SELECT id FROM announcements WHERE team_id = $1', [tempTeamId]);
    expect(dbCheck.rows).toHaveLength(0);
  });
});
