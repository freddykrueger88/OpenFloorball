/**
 * trainingAttendance.test.js – tatsächliche Anwesenheit bei einem
 * Training (Statistik-Architektur Phase 5, EPIC 012): pro Kader-Spieler
 * ein Status (präsent/entschuldigt/unentschuldigt/verletzt) für EIN
 * Training, unabhängig von RSVP. Struktur analog matchSquad.test.js.
 */
import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'training-attendance-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123', birthday: '1990-01-01'});
  return { email, cookie: res.headers['set-cookie'][0] };
}

async function createRosterPlayer(cookie, name, teamId = null) {
  const res = await request(app).post('/api/roster').set('Cookie', cookie).send({ name, teamId });
  return res.body.data._id;
}

let owner;
let member;
let stranger;
let teamId;
let sessionId;
let personalSessionId;
let p1;
let p2;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  owner = await registerAndLogin('owner');
  member = await registerAndLogin('member');
  stranger = await registerAndLogin('stranger');

  const teamRes = await request(app).post('/api/teams').set('Cookie', owner.cookie).send({ name: 'Attendance-Test-Team' });
  teamId = teamRes.body.data._id;
  await request(app).post(`/api/teams/${teamId}/members`).set('Cookie', owner.cookie).send({ email: member.email, role: 'member' });

  p1 = await createRosterPlayer(owner.cookie, 'Max', teamId);
  p2 = await createRosterPlayer(owner.cookie, 'Peter', teamId);

  const sessionRes = await request(app).post('/api/trainings').set('Cookie', owner.cookie).send({ name: 'Attendance-Test-Training', teamId });
  sessionId = sessionRes.body.data._id;

  const personalSessionRes = await request(app).post('/api/trainings').set('Cookie', owner.cookie).send({ name: 'Solo-Training' });
  personalSessionId = personalSessionRes.body.data._id;
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('GET /api/trainings/:id/attendance', () => {
  it('liefert den vollen Team-Kader, initial mit status: null', async () => {
    const res = await request(app).get(`/api/trainings/${sessionId}/attendance`).set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((p) => p.status === null)).toBe(true);
    expect(res.body.data.map((p) => p.name).sort()).toEqual(['Max', 'Peter']);
  });

  it('liefert den persönlichen Kader für ein Training ohne Team', async () => {
    const soloPlayer = await createRosterPlayer(owner.cookie, 'Solo-Spieler');
    const res = await request(app).get(`/api/trainings/${personalSessionId}/attendance`).set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.some((p) => p.rosterPlayerId === soloPlayer)).toBe(true);
    expect(res.body.data.some((p) => p.rosterPlayerId === p1)).toBe(false);
  });

  it('member darf lesen, Fremder bekommt 404', async () => {
    const memberRes = await request(app).get(`/api/trainings/${sessionId}/attendance`).set('Cookie', member.cookie);
    expect(memberRes.status).toBe(200);

    const strangerRes = await request(app).get(`/api/trainings/${sessionId}/attendance`).set('Cookie', stranger.cookie);
    expect(strangerRes.status).toBe(404);
  });
});

describe('PUT/DELETE /api/trainings/:id/attendance/:rosterPlayerId', () => {
  it('setzt einen Status', async () => {
    const res = await request(app)
      .put(`/api/trainings/${sessionId}/attendance/${p1}`)
      .set('Cookie', owner.cookie)
      .send({ status: 'present' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('present');
    expect(res.body.data.name).toBe('Max');
  });

  it('überschreibt den Status bei erneutem PUT (Upsert, kein Duplikat)', async () => {
    await request(app).put(`/api/trainings/${sessionId}/attendance/${p1}`).set('Cookie', owner.cookie).send({ status: 'injured', note: 'Knie' });

    const res = await request(app).get(`/api/trainings/${sessionId}/attendance`).set('Cookie', owner.cookie);
    const entry = res.body.data.find((p) => p.rosterPlayerId === p1);
    expect(entry.status).toBe('injured');
    expect(entry.note).toBe('Knie');
    expect(res.body.data).toHaveLength(2);
  });

  it('lehnt einen ungültigen Status mit 422 ab', async () => {
    const res = await request(app)
      .put(`/api/trainings/${sessionId}/attendance/${p1}`)
      .set('Cookie', owner.cookie)
      .send({ status: 'vielleicht' });
    expect(res.status).toBe(422);
  });

  it('lehnt einen Kader-Spieler aus falscher Sichtbarkeits-Gruppe mit 400 ab', async () => {
    const foreignPlayer = await createRosterPlayer(owner.cookie, 'Nicht-Team-Spieler');
    const res = await request(app)
      .put(`/api/trainings/${sessionId}/attendance/${foreignPlayer}`)
      .set('Cookie', owner.cookie)
      .send({ status: 'present' });
    expect(res.status).toBe(400);
  });

  it('member bekommt 404 beim Versuch, einen Status zu setzen (nur Lesezugriff)', async () => {
    const res = await request(app)
      .put(`/api/trainings/${sessionId}/attendance/${p2}`)
      .set('Cookie', member.cookie)
      .send({ status: 'present' });
    expect(res.status).toBe(404);
  });

  it('setzt einen Status per DELETE zurück auf "nicht erfasst"', async () => {
    await request(app).put(`/api/trainings/${sessionId}/attendance/${p2}`).set('Cookie', owner.cookie).send({ status: 'excused' });
    const delRes = await request(app).delete(`/api/trainings/${sessionId}/attendance/${p2}`).set('Cookie', owner.cookie);
    expect(delRes.status).toBe(200);

    const res = await request(app).get(`/api/trainings/${sessionId}/attendance`).set('Cookie', owner.cookie);
    const entry = res.body.data.find((p) => p.rosterPlayerId === p2);
    expect(entry.status).toBeNull();
  });
});

describe('Cascade-Aufräumen', () => {
  it('löscht training_attendance-Zeilen, wenn das Training gelöscht wird', async () => {
    const tempSessionRes = await request(app).post('/api/trainings').set('Cookie', owner.cookie).send({ name: 'Cascade-Test', teamId });
    const tempSessionId = tempSessionRes.body.data._id;
    await request(app).put(`/api/trainings/${tempSessionId}/attendance/${p1}`).set('Cookie', owner.cookie).send({ status: 'present' });

    await request(app).delete(`/api/trainings/${tempSessionId}`).set('Cookie', owner.cookie);

    const dbCheck = await pool.query('SELECT id FROM training_attendance WHERE session_id = $1', [tempSessionId]);
    expect(dbCheck.rows).toHaveLength(0);
  });

  it('löscht training_attendance-Zeilen über mehrere Trainings hinweg, wenn der Kader-Spieler gelöscht wird', async () => {
    const tempPlayer = await createRosterPlayer(owner.cookie, 'Wird-gelöscht', teamId);
    await request(app).put(`/api/trainings/${sessionId}/attendance/${tempPlayer}`).set('Cookie', owner.cookie).send({ status: 'present' });

    await request(app).delete(`/api/roster/${tempPlayer}`).set('Cookie', owner.cookie);

    const dbCheck = await pool.query('SELECT id FROM training_attendance WHERE roster_player_id = $1', [tempPlayer]);
    expect(dbCheck.rows).toHaveLength(0);
  });
});
