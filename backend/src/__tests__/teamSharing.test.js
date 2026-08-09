/**
 * teamSharing.test.js – ROADMAP Phase 2 (Team und Organisation): prüft
 * das gemeinsame team_id-Verhalten über Kader/Playbooks/Trainingspläne/
 * Formationen hinweg (additiv neben user_id, siehe teamAccess.js).
 */
import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'teamshare-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123' });
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

  const teamRes = await request(app).post('/api/teams').set('Cookie', owner.cookie).send({ name: 'Sharing-Test-Team' });
  teamId = teamRes.body.data._id;
  await request(app).post(`/api/teams/${teamId}/members`).set('Cookie', owner.cookie).send({ email: coach.email, role: 'coach' });
  await request(app).post(`/api/teams/${teamId}/members`).set('Cookie', owner.cookie).send({ email: member.email, role: 'member' });
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('Kader (roster_players) – Team-Sharing', () => {
  let playerId;

  it('lehnt Anlage eines team-geteilten Eintrags durch ein reines member-Mitglied mit 404 ab', async () => {
    const res = await request(app).post('/api/roster').set('Cookie', member.cookie).send({ name: 'Sollte fehlschlagen', teamId });
    expect(res.status).toBe(404);
  });

  it('coach legt einen team-geteilten Kader-Eintrag an', async () => {
    const res = await request(app).post('/api/roster').set('Cookie', coach.cookie).send({ name: 'Team-Spieler', teamId });
    expect(res.status).toBe(201);
    expect(res.body.data.teamId).toBe(teamId);
    playerId = res.body.data._id;
  });

  it('erscheint in der Kader-Liste des member (nur lesend)', async () => {
    const res = await request(app).get('/api/roster').set('Cookie', member.cookie);
    expect(res.body.data.some((p) => p._id === playerId)).toBe(true);
  });

  it('ein Fremder (kein Team-Mitglied) sieht den Eintrag nicht', async () => {
    const res = await request(app).get('/api/roster').set('Cookie', stranger.cookie);
    expect(res.body.data.some((p) => p._id === playerId)).toBe(false);
  });

  it('member darf den team-geteilten Eintrag NICHT bearbeiten (404)', async () => {
    const res = await request(app).put(`/api/roster/${playerId}`).set('Cookie', member.cookie).send({ name: 'Sollte fehlschlagen' });
    expect(res.status).toBe(404);
  });

  it('owner darf den team-geteilten Eintrag bearbeiten', async () => {
    const res = await request(app).put(`/api/roster/${playerId}`).set('Cookie', owner.cookie).send({ name: 'Umbenannt' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Umbenannt');
  });

  it('member darf den Eintrag NICHT löschen (404)', async () => {
    const res = await request(app).delete(`/api/roster/${playerId}`).set('Cookie', member.cookie);
    expect(res.status).toBe(404);
  });

  it('coach darf den Eintrag löschen', async () => {
    const res = await request(app).delete(`/api/roster/${playerId}`).set('Cookie', coach.cookie);
    expect(res.status).toBe(200);
  });
});

describe('Playbooks – Team-Sharing', () => {
  let playbookId;

  it('coach legt ein team-geteiltes Playbook an', async () => {
    const res = await request(app).post('/api/playbooks').set('Cookie', coach.cookie).send({ name: 'Team-Playbook', teamId });
    expect(res.status).toBe(201);
    playbookId = res.body.data._id;
  });

  it('erscheint in der Playbook-Liste des member', async () => {
    const res = await request(app).get('/api/playbooks').set('Cookie', member.cookie);
    expect(res.body.data.some((p) => p._id === playbookId)).toBe(true);
  });

  it('ein Fremder sieht es nicht', async () => {
    const res = await request(app).get('/api/playbooks').set('Cookie', stranger.cookie);
    expect(res.body.data.some((p) => p._id === playbookId)).toBe(false);
  });

  it('member darf es NICHT löschen (404)', async () => {
    const res = await request(app).delete(`/api/playbooks/${playbookId}`).set('Cookie', member.cookie);
    expect(res.status).toBe(404);
  });

  it('owner darf ein von coach angelegtes Team-Playbook löschen', async () => {
    const res = await request(app).delete(`/api/playbooks/${playbookId}`).set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
  });
});

describe('Trainingspläne (training_sessions) – Team-Sharing', () => {
  let sessionId;
  let boardId;

  beforeAll(async () => {
    const boardRes = await request(app).post('/api/boards').set('Cookie', owner.cookie).send({ name: 'Team-Session-Board', fieldType: 'large' });
    boardId = boardRes.body.data._id;
  });

  it('member darf keine team-geteilte Session anlegen (404)', async () => {
    const res = await request(app).post('/api/trainings').set('Cookie', member.cookie).send({ name: 'Sollte fehlschlagen', teamId });
    expect(res.status).toBe(404);
  });

  it('coach legt eine team-geteilte Trainingseinheit an', async () => {
    const res = await request(app).post('/api/trainings').set('Cookie', coach.cookie).send({ name: 'Team-Training', teamId });
    expect(res.status).toBe(201);
    sessionId = res.body.data._id;
  });

  it('member kann die Session lesen (GET /:id)', async () => {
    const res = await request(app).get(`/api/trainings/${sessionId}`).set('Cookie', member.cookie);
    expect(res.status).toBe(200);
  });

  it('ein Fremder kann die Session nicht lesen (404)', async () => {
    const res = await request(app).get(`/api/trainings/${sessionId}`).set('Cookie', stranger.cookie);
    expect(res.status).toBe(404);
  });

  it('member darf KEINE Übung zur Team-Session hinzufügen (404)', async () => {
    const res = await request(app).post(`/api/trainings/${sessionId}/items`).set('Cookie', member.cookie).send({ boardId });
    expect(res.status).toBe(404);
  });

  it('owner (Board-Eigentümer) darf eine Übung zur Team-Session hinzufügen, die coach angelegt hat', async () => {
    const res = await request(app).post(`/api/trainings/${sessionId}/items`).set('Cookie', owner.cookie).send({ boardId });
    expect(res.status).toBe(201);
  });

  it('member darf die Session NICHT löschen (404)', async () => {
    const res = await request(app).delete(`/api/trainings/${sessionId}`).set('Cookie', member.cookie);
    expect(res.status).toBe(404);
  });

  it('coach darf die Session löschen', async () => {
    const res = await request(app).delete(`/api/trainings/${sessionId}`).set('Cookie', coach.cookie);
    expect(res.status).toBe(200);
  });
});

describe('Spiele/Live-Notizen (games + comments) – Team-Sharing', () => {
  let gameId;

  it('member darf kein team-geteiltes Spiel anlegen (404)', async () => {
    const res = await request(app).post('/api/games').set('Cookie', member.cookie).send({ opponent: 'Sollte fehlschlagen', teamId });
    expect(res.status).toBe(404);
  });

  it('coach legt ein team-geteiltes Spiel an', async () => {
    const res = await request(app).post('/api/games').set('Cookie', coach.cookie).send({ opponent: 'Team-Spiel', teamId });
    expect(res.status).toBe(201);
    gameId = res.body.data._id;
  });

  it('member kann das Spiel lesen (GET /:id)', async () => {
    const res = await request(app).get(`/api/games/${gameId}`).set('Cookie', member.cookie);
    expect(res.status).toBe(200);
  });

  it('ein Fremder kann das Spiel nicht lesen (404)', async () => {
    const res = await request(app).get(`/api/games/${gameId}`).set('Cookie', stranger.cookie);
    expect(res.status).toBe(404);
  });

  it('member darf eine Live-Notiz zum Team-Spiel hinzufügen (Lesezugriff reicht für Notizen)', async () => {
    const res = await request(app).post(`/api/games/${gameId}/comments`).set('Cookie', member.cookie).send({ text: 'Beobachtung von der Bank' });
    expect(res.status).toBe(201);
  });

  it('ein Fremder darf keine Notiz zum Team-Spiel hinzufügen (404)', async () => {
    const res = await request(app).post(`/api/games/${gameId}/comments`).set('Cookie', stranger.cookie).send({ text: 'Sollte nicht gehen' });
    expect(res.status).toBe(404);
  });

  it('owner (Team-Owner) darf die Notiz von member löschen (Moderation über Schreibzugriff)', async () => {
    const listRes = await request(app).get(`/api/games/${gameId}/comments`).set('Cookie', owner.cookie);
    const noteId = listRes.body.data[0]._id;
    const res = await request(app).delete(`/api/games/${gameId}/comments/${noteId}`).set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
  });

  it('member darf das Spiel NICHT löschen (404)', async () => {
    const res = await request(app).delete(`/api/games/${gameId}`).set('Cookie', member.cookie);
    expect(res.status).toBe(404);
  });

  it('coach darf das Spiel löschen', async () => {
    const res = await request(app).delete(`/api/games/${gameId}`).set('Cookie', coach.cookie);
    expect(res.status).toBe(200);
  });
});

describe('Formationsvorlagen (formation_templates) – Team-Sharing', () => {
  let formationId;

  it('member darf keine team-geteilte Vorlage anlegen (404)', async () => {
    const res = await request(app).post('/api/formations').set('Cookie', member.cookie).send({ name: 'Sollte fehlschlagen', teamId });
    expect(res.status).toBe(404);
  });

  it('coach legt eine team-geteilte Formations-Vorlage an', async () => {
    const res = await request(app).post('/api/formations').set('Cookie', coach.cookie).send({ name: 'Team-Formation', teamId });
    expect(res.status).toBe(201);
    formationId = res.body.data._id;
  });

  it('erscheint in der Liste des member', async () => {
    const res = await request(app).get('/api/formations').set('Cookie', member.cookie);
    expect(res.body.data.some((f) => f._id === formationId)).toBe(true);
  });

  it('ein Fremder sieht sie nicht', async () => {
    const res = await request(app).get('/api/formations').set('Cookie', stranger.cookie);
    expect(res.body.data.some((f) => f._id === formationId)).toBe(false);
  });

  it('member darf sie NICHT löschen (404)', async () => {
    const res = await request(app).delete(`/api/formations/${formationId}`).set('Cookie', member.cookie);
    expect(res.status).toBe(404);
  });

  it('owner darf sie löschen', async () => {
    const res = await request(app).delete(`/api/formations/${formationId}`).set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
  });
});

describe('Team löschen – geteilte Ressourcen werden wieder persönlich', () => {
  let cleanupTeamId;
  let playerId;

  beforeAll(async () => {
    const teamRes = await request(app).post('/api/teams').set('Cookie', owner.cookie).send({ name: 'Lösch-Test-Team' });
    cleanupTeamId = teamRes.body.data._id;
    const playerRes = await request(app).post('/api/roster').set('Cookie', owner.cookie).send({ name: 'Verwaister Spieler', teamId: cleanupTeamId });
    playerId = playerRes.body.data._id;
  });

  it('setzt team_id auf NULL statt den Kader-Eintrag zu löschen', async () => {
    const deleteRes = await request(app).delete(`/api/teams/${cleanupTeamId}`).set('Cookie', owner.cookie);
    expect(deleteRes.status).toBe(200);

    const listRes = await request(app).get('/api/roster').set('Cookie', owner.cookie);
    const player = listRes.body.data.find((p) => p._id === playerId);
    expect(player).toBeDefined();
    expect(player.teamId).toBeNull();
  });
});
