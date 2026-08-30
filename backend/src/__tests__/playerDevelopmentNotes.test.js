/**
 * playerDevelopmentNotes.test.js – freie Beobachtungsnotizen zu einem
 * Kader-Spieler (Statistik-Architektur Phase 5, EPIC 012). Restriktiverer
 * Zugriff als die übrige Kader-Sichtbarkeit: nur coach/owner, nie
 * 'member' (personenbezogene Daten ÜBER einen Spieler).
 */
import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'dev-notes-test-';
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
let playerId;
let soloPlayerId;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  owner = await registerAndLogin('owner');
  coach = await registerAndLogin('coach');
  member = await registerAndLogin('member');
  stranger = await registerAndLogin('stranger');

  const teamRes = await request(app).post('/api/teams').set('Cookie', owner.cookie).send({ name: 'DevNotes-Test-Team' });
  teamId = teamRes.body.data._id;
  await request(app).post(`/api/teams/${teamId}/members`).set('Cookie', owner.cookie).send({ email: coach.email, role: 'coach' });
  await request(app).post(`/api/teams/${teamId}/members`).set('Cookie', owner.cookie).send({ email: member.email, role: 'member' });

  const playerRes = await request(app).post('/api/roster').set('Cookie', owner.cookie).send({ name: 'Lena', teamId });
  playerId = playerRes.body.data._id;

  const soloRes = await request(app).post('/api/roster').set('Cookie', owner.cookie).send({ name: 'Solo-Spieler' });
  soloPlayerId = soloRes.body.data._id;
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('POST/GET /api/roster/:id/notes', () => {
  it('coach kann eine Notiz anlegen', async () => {
    const res = await request(app)
      .post(`/api/roster/${playerId}/notes`)
      .set('Cookie', coach.cookie)
      .send({ note: 'Starke Entwicklung im Passspiel diese Woche.' });
    expect(res.status).toBe(201);
    expect(res.body.data.note).toBe('Starke Entwicklung im Passspiel diese Woche.');
    expect(res.body.data.authorName).toBeTruthy();
  });

  it('owner sieht die Notiz, neueste zuerst', async () => {
    await request(app).post(`/api/roster/${playerId}/notes`).set('Cookie', owner.cookie).send({ note: 'Zweite Notiz.' });
    const res = await request(app).get(`/api/roster/${playerId}/notes`).set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].note).toBe('Zweite Notiz.');
  });

  it('member bekommt 404 (nur coach/owner dürfen Entwicklungsnotizen sehen)', async () => {
    const res = await request(app).get(`/api/roster/${playerId}/notes`).set('Cookie', member.cookie);
    expect(res.status).toBe(404);
  });

  it('Fremder bekommt 404', async () => {
    const res = await request(app).get(`/api/roster/${playerId}/notes`).set('Cookie', stranger.cookie);
    expect(res.status).toBe(404);
  });

  it('lehnt eine leere Notiz mit 422 ab', async () => {
    const res = await request(app).post(`/api/roster/${playerId}/notes`).set('Cookie', owner.cookie).send({ note: '' });
    expect(res.status).toBe(422);
  });

  it('personalisierter Kader: der Besitzer selbst darf Notizen anlegen und lesen', async () => {
    const createRes = await request(app).post(`/api/roster/${soloPlayerId}/notes`).set('Cookie', owner.cookie).send({ note: 'Solo-Notiz.' });
    expect(createRes.status).toBe(201);
    const listRes = await request(app).get(`/api/roster/${soloPlayerId}/notes`).set('Cookie', owner.cookie);
    expect(listRes.body.data).toHaveLength(1);
  });
});

describe('PUT/DELETE /api/roster/:id/notes/:noteId', () => {
  it('nur der Autor darf seine eigene Notiz bearbeiten', async () => {
    const createRes = await request(app).post(`/api/roster/${playerId}/notes`).set('Cookie', coach.cookie).send({ note: 'Original.' });
    const noteId = createRes.body.data._id;

    const ownerEditRes = await request(app)
      .put(`/api/roster/${playerId}/notes/${noteId}`)
      .set('Cookie', owner.cookie)
      .send({ note: 'Von Owner überschrieben.' });
    expect(ownerEditRes.status).toBe(403);

    const coachEditRes = await request(app)
      .put(`/api/roster/${playerId}/notes/${noteId}`)
      .set('Cookie', coach.cookie)
      .send({ note: 'Vom Autor bearbeitet.' });
    expect(coachEditRes.status).toBe(200);
    expect(coachEditRes.body.data.note).toBe('Vom Autor bearbeitet.');
  });

  it('der Team-Owner darf eine fremde Notiz löschen (Moderation), ein Coach nicht', async () => {
    const createRes = await request(app).post(`/api/roster/${playerId}/notes`).set('Cookie', coach.cookie).send({ note: 'Zu löschen.' });
    const noteId = createRes.body.data._id;

    const ownerDeleteRes = await request(app).delete(`/api/roster/${playerId}/notes/${noteId}`).set('Cookie', owner.cookie);
    expect(ownerDeleteRes.status).toBe(200);

    const otherCreateRes = await request(app).post(`/api/roster/${playerId}/notes`).set('Cookie', owner.cookie).send({ note: 'Von Owner, Coach darf nicht löschen.' });
    const otherNoteId = otherCreateRes.body.data._id;
    const coachDeleteRes = await request(app).delete(`/api/roster/${playerId}/notes/${otherNoteId}`).set('Cookie', coach.cookie);
    expect(coachDeleteRes.status).toBe(403);
  });

  it('gibt 404 für eine nicht existierende Notiz', async () => {
    const res = await request(app)
      .put(`/api/roster/${playerId}/notes/00000000-0000-0000-0000-000000000000`)
      .set('Cookie', owner.cookie)
      .send({ note: 'x' });
    expect(res.status).toBe(404);
  });
});

describe('Cascade-Aufräumen', () => {
  it('löscht Notizen, wenn der Kader-Spieler gelöscht wird', async () => {
    const tempPlayerRes = await request(app).post('/api/roster').set('Cookie', owner.cookie).send({ name: 'Wird-gelöscht', teamId });
    const tempPlayerId = tempPlayerRes.body.data._id;
    await request(app).post(`/api/roster/${tempPlayerId}/notes`).set('Cookie', owner.cookie).send({ note: 'Notiz.' });

    await request(app).delete(`/api/roster/${tempPlayerId}`).set('Cookie', owner.cookie);

    const dbCheck = await pool.query('SELECT id FROM player_development_notes WHERE roster_player_id = $1', [tempPlayerId]);
    expect(dbCheck.rows).toHaveLength(0);
  });

  it('setzt training_session_id auf NULL, wenn das referenzierte Training gelöscht wird (Notiz bleibt erhalten)', async () => {
    const sessionRes = await request(app).post('/api/trainings').set('Cookie', owner.cookie).send({ name: 'Notiz-Kontext-Training', teamId });
    const sessionId = sessionRes.body.data._id;

    const noteRes = await request(app)
      .post(`/api/roster/${playerId}/notes`)
      .set('Cookie', owner.cookie)
      .send({ note: 'Beobachtung während des Trainings.', trainingSessionId: sessionId });
    expect(noteRes.status).toBe(201);
    expect(noteRes.body.data.trainingSessionId).toBe(sessionId);

    await request(app).delete(`/api/trainings/${sessionId}`).set('Cookie', owner.cookie);

    const dbCheck = await pool.query('SELECT training_session_id FROM player_development_notes WHERE id = $1', [noteRes.body.data._id]);
    expect(dbCheck.rows[0].training_session_id).toBeNull();
  });
});
