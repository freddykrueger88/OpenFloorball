/**
 * polls.test.js – Umfragen/Polls (Roadmap-Audit, Phase D): Coach/Owner
 * legt eine Umfrage mit Optionen an, Team-Mitglieder stimmen ab.
 */
import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'polls-test-';
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

  const teamRes = await request(app).post('/api/teams').set('Cookie', owner.cookie).send({ name: 'Polls-Test-Team' });
  teamId = teamRes.body.data._id;
  await request(app).post(`/api/teams/${teamId}/members`).set('Cookie', owner.cookie).send({ email: coach.email, role: 'coach' });
  await request(app).post(`/api/teams/${teamId}/members`).set('Cookie', owner.cookie).send({ email: member.email, role: 'member' });
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

async function createSingleChoicePoll(cookie, question = 'Welcher Tag passt am besten?') {
  const res = await request(app)
    .post('/api/polls')
    .set('Cookie', cookie)
    .send({ teamId, question, options: ['Dienstag', 'Donnerstag', 'Samstag'] });
  return res;
}

describe('POST /api/polls', () => {
  it('coach legt eine Umfrage mit 3 Optionen an, member sieht sie', async () => {
    const createRes = await createSingleChoicePoll(coach.cookie);
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.options).toHaveLength(3);
    expect(createRes.body.data.options.every((o) => o.voteCount === 0)).toBe(true);
    expect(createRes.body.data.multipleChoice).toBe(false);

    const listRes = await request(app).get('/api/polls').set('Cookie', member.cookie);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((p) => p._id === createRes.body.data._id)).toBe(true);
  });

  it('member darf keine Umfrage anlegen (404)', async () => {
    const res = await request(app).post('/api/polls').set('Cookie', member.cookie).send({ teamId, question: 'X?', options: ['A', 'B'] });
    expect(res.status).toBe(404);
  });

  it('lehnt zu wenige (1) oder zu viele (11) Optionen mit 422 ab', async () => {
    const tooFew = await request(app).post('/api/polls').set('Cookie', coach.cookie).send({ teamId, question: 'X?', options: ['A'] });
    expect(tooFew.status).toBe(422);

    const tooMany = await request(app).post('/api/polls').set('Cookie', coach.cookie).send({
      teamId, question: 'X?', options: Array.from({ length: 11 }, (_, i) => `Option ${i}`),
    });
    expect(tooMany.status).toBe(422);
  });
});

describe('POST /api/polls/:id/vote – Einzelauswahl', () => {
  let pollId;
  let optionA;
  let optionB;

  beforeAll(async () => {
    const res = await createSingleChoicePoll(coach.cookie, 'Einzelauswahl-Test');
    pollId = res.body.data._id;
    optionA = res.body.data.options[0]._id;
    optionB = res.body.data.options[1]._id;
  });

  it('member stimmt für Option A ab', async () => {
    const res = await request(app).post(`/api/polls/${pollId}/vote`).set('Cookie', member.cookie).send({ optionId: optionA });
    expect(res.status).toBe(200);
    const a = res.body.data.options.find((o) => o._id === optionA);
    expect(a.voteCount).toBe(1);
    expect(a.votedByMe).toBe(true);
  });

  it('Stimme auf Option B ersetzt die Stimme auf Option A', async () => {
    const res = await request(app).post(`/api/polls/${pollId}/vote`).set('Cookie', member.cookie).send({ optionId: optionB });
    expect(res.status).toBe(200);
    const a = res.body.data.options.find((o) => o._id === optionA);
    const b = res.body.data.options.find((o) => o._id === optionB);
    expect(a.voteCount).toBe(0);
    expect(b.voteCount).toBe(1);
    expect(b.votedByMe).toBe(true);
  });

  it('erneuter Klick auf die eigene Option entfernt die Stimme', async () => {
    const res = await request(app).post(`/api/polls/${pollId}/vote`).set('Cookie', member.cookie).send({ optionId: optionB });
    expect(res.status).toBe(200);
    const b = res.body.data.options.find((o) => o._id === optionB);
    expect(b.voteCount).toBe(0);
    expect(b.votedByMe).toBe(false);
  });

  it('ein optionId, das nicht zu dieser Umfrage gehört, bekommt 404', async () => {
    const otherRes = await createSingleChoicePoll(coach.cookie, 'Andere Umfrage');
    const otherOptionId = otherRes.body.data.options[0]._id;
    const res = await request(app).post(`/api/polls/${pollId}/vote`).set('Cookie', member.cookie).send({ optionId: otherOptionId });
    expect(res.status).toBe(404);
  });

  it('fremder Nutzer (kein Team-Mitglied) sieht die Umfrage nicht und bekommt 404 beim Abstimmen', async () => {
    const listRes = await request(app).get('/api/polls').set('Cookie', stranger.cookie);
    expect(listRes.body.data.some((p) => p._id === pollId)).toBe(false);

    const voteRes = await request(app).post(`/api/polls/${pollId}/vote`).set('Cookie', stranger.cookie).send({ optionId: optionA });
    expect(voteRes.status).toBe(404);
  });
});

describe('POST /api/polls/:id/vote – Mehrfachauswahl', () => {
  let pollId;
  let optionA;
  let optionB;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/polls')
      .set('Cookie', coach.cookie)
      .send({ teamId, question: 'Mehrfachauswahl-Test', multipleChoice: true, options: ['A', 'B', 'C'] });
    pollId = res.body.data._id;
    optionA = res.body.data.options[0]._id;
    optionB = res.body.data.options[1]._id;
  });

  it('zwei verschiedene Optionen gleichzeitig stimmberechtigt', async () => {
    await request(app).post(`/api/polls/${pollId}/vote`).set('Cookie', member.cookie).send({ optionId: optionA });
    const res = await request(app).post(`/api/polls/${pollId}/vote`).set('Cookie', member.cookie).send({ optionId: optionB });
    expect(res.status).toBe(200);
    const a = res.body.data.options.find((o) => o._id === optionA);
    const b = res.body.data.options.find((o) => o._id === optionB);
    expect(a.voteCount).toBe(1);
    expect(b.voteCount).toBe(1);
  });

  it('erneuter Klick entfernt nur diese eine Option', async () => {
    const res = await request(app).post(`/api/polls/${pollId}/vote`).set('Cookie', member.cookie).send({ optionId: optionA });
    expect(res.status).toBe(200);
    const a = res.body.data.options.find((o) => o._id === optionA);
    const b = res.body.data.options.find((o) => o._id === optionB);
    expect(a.voteCount).toBe(0);
    expect(b.voteCount).toBe(1);
  });
});

describe('PUT /api/polls/:id/close', () => {
  it('coach darf schließen, danach lehnt Abstimmen mit 400 ab', async () => {
    const createRes = await createSingleChoicePoll(coach.cookie, 'Wird geschlossen');
    const pollId = createRes.body.data._id;
    const optionId = createRes.body.data.options[0]._id;

    const closeRes = await request(app).put(`/api/polls/${pollId}/close`).set('Cookie', coach.cookie);
    expect(closeRes.status).toBe(200);

    const voteRes = await request(app).post(`/api/polls/${pollId}/vote`).set('Cookie', member.cookie).send({ optionId });
    expect(voteRes.status).toBe(400);
  });

  it('member darf nicht schließen (404)', async () => {
    const createRes = await createSingleChoicePoll(coach.cookie, 'Sollte nicht geschlossen werden');
    const pollId = createRes.body.data._id;
    const res = await request(app).put(`/api/polls/${pollId}/close`).set('Cookie', member.cookie);
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/polls/:id', () => {
  it('member darf nicht löschen (404), ein zweiter Coach (owner) darf', async () => {
    const createRes = await createSingleChoicePoll(coach.cookie, 'Wird gelöscht');
    const pollId = createRes.body.data._id;

    const memberRes = await request(app).delete(`/api/polls/${pollId}`).set('Cookie', member.cookie);
    expect(memberRes.status).toBe(404);

    const ownerRes = await request(app).delete(`/api/polls/${pollId}`).set('Cookie', owner.cookie);
    expect(ownerRes.status).toBe(200);
  });
});

describe('Cascade-Aufräumen', () => {
  it('löscht polls/poll_options/poll_votes, wenn das Team gelöscht wird', async () => {
    const tempTeamRes = await request(app).post('/api/teams').set('Cookie', owner.cookie).send({ name: 'Polls-Cascade-Team' });
    const tempTeamId = tempTeamRes.body.data._id;
    const createRes = await request(app)
      .post('/api/polls')
      .set('Cookie', owner.cookie)
      .send({ teamId: tempTeamId, question: 'Verwaiste Umfrage', options: ['A', 'B'] });
    const pollId = createRes.body.data._id;
    const optionId = createRes.body.data.options[0]._id;
    await request(app).post(`/api/polls/${pollId}/vote`).set('Cookie', owner.cookie).send({ optionId });

    await request(app).delete(`/api/teams/${tempTeamId}`).set('Cookie', owner.cookie);

    const pollCheck = await pool.query('SELECT id FROM polls WHERE id = $1', [pollId]);
    expect(pollCheck.rows).toHaveLength(0);
    const optionCheck = await pool.query('SELECT id FROM poll_options WHERE poll_id = $1', [pollId]);
    expect(optionCheck.rows).toHaveLength(0);
    const voteCheck = await pool.query('SELECT id FROM poll_votes WHERE poll_option_id = $1', [optionId]);
    expect(voteCheck.rows).toHaveLength(0);
  });
});
