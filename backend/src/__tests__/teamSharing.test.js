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

  it('member darf es NICHT umbenennen (404)', async () => {
    const res = await request(app).put(`/api/playbooks/${playbookId}`).set('Cookie', member.cookie).send({ name: 'Sollte fehlschlagen' });
    expect(res.status).toBe(404);
  });

  it('owner darf ein von coach angelegtes Team-Playbook umbenennen', async () => {
    const res = await request(app).put(`/api/playbooks/${playbookId}`).set('Cookie', owner.cookie).send({ name: 'Umbenannt' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Umbenannt');
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

  it('member darf per RSVP für sich selbst zusagen (Lesezugriff reicht)', async () => {
    const res = await request(app).put(`/api/games/${gameId}/rsvps/me`).set('Cookie', member.cookie).send({ status: 'yes' });
    expect(res.status).toBe(200);
  });

  it('ein Fremder darf keine RSVP-Antwort zum Team-Spiel abgeben (404)', async () => {
    const res = await request(app).put(`/api/games/${gameId}/rsvps/me`).set('Cookie', stranger.cookie).send({ status: 'yes' });
    expect(res.status).toBe(404);
  });

  it('coach darf einen Match-Kader-Status für das Team-Spiel setzen', async () => {
    const playerRes = await request(app).post('/api/roster').set('Cookie', coach.cookie).send({ name: 'Match-Kader-Spieler', teamId });
    const playerId = playerRes.body.data._id;
    const res = await request(app).put(`/api/games/${gameId}/squad/${playerId}`).set('Cookie', coach.cookie).send({ status: 'playing' });
    expect(res.status).toBe(200);
  });

  it('member darf den Match-Kader NICHT bearbeiten (404), aber lesen', async () => {
    const squadRes = await request(app).get(`/api/games/${gameId}/squad`).set('Cookie', member.cookie);
    expect(squadRes.status).toBe(200);
    const playerId = squadRes.body.data[0].rosterPlayerId;

    const res = await request(app).put(`/api/games/${gameId}/squad/${playerId}`).set('Cookie', member.cookie).send({ status: 'absent' });
    expect(res.status).toBe(404);
  });

  it('coach darf ein Live-Match-Ereignis für das Team-Spiel anlegen', async () => {
    const res = await request(app).post(`/api/games/${gameId}/events`).set('Cookie', coach.cookie).send({ eventType: 'timeout' });
    expect(res.status).toBe(201);
  });

  it('member darf Live-Match-Ereignisse NICHT anlegen (404), aber lesen', async () => {
    const eventsRes = await request(app).get(`/api/games/${gameId}/events`).set('Cookie', member.cookie);
    expect(eventsRes.status).toBe(200);

    const res = await request(app).post(`/api/games/${gameId}/events`).set('Cookie', member.cookie).send({ eventType: 'timeout' });
    expect(res.status).toBe(404);
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

describe('Lines (fachlicher Umbau: Kader-basiert) – Team-Sharing', () => {
  let lineId;
  let teamPlayerId;

  it('member darf keine team-geteilte Line anlegen (404)', async () => {
    const res = await request(app).post('/api/lines').set('Cookie', member.cookie).send({ name: 'Sollte fehlschlagen', teamId });
    expect(res.status).toBe(404);
  });

  it('coach legt eine team-geteilte Line an', async () => {
    const res = await request(app).post('/api/lines').set('Cookie', coach.cookie).send({ name: 'Team-Line', teamId });
    expect(res.status).toBe(201);
    lineId = res.body.data._id;
  });

  it('member sieht die Line in der Liste (nur lesend)', async () => {
    const res = await request(app).get('/api/lines').set('Cookie', member.cookie);
    expect(res.body.data.some((l) => l._id === lineId)).toBe(true);
  });

  it('ein Fremder sieht die Line nicht', async () => {
    const res = await request(app).get('/api/lines').set('Cookie', stranger.cookie);
    expect(res.body.data.some((l) => l._id === lineId)).toBe(false);
  });

  it('coach legt einen team-geteilten Kader-Spieler an, den die Line nutzen kann', async () => {
    const res = await request(app).post('/api/roster').set('Cookie', coach.cookie).send({ name: 'Team-Kader-Spieler', teamId });
    expect(res.status).toBe(201);
    teamPlayerId = res.body.data._id;
  });

  it('member darf KEINEN Spieler zur Team-Line hinzufügen (404)', async () => {
    const res = await request(app)
      .post(`/api/lines/${lineId}/players`)
      .set('Cookie', member.cookie)
      .send({ rosterPlayerId: teamPlayerId });
    expect(res.status).toBe(404);
  });

  it('owner darf einen Spieler zur Team-Line hinzufügen, die coach angelegt hat', async () => {
    const res = await request(app)
      .post(`/api/lines/${lineId}/players`)
      .set('Cookie', owner.cookie)
      .send({ rosterPlayerId: teamPlayerId });
    expect(res.status).toBe(201);
  });

  it('member darf die Line NICHT löschen (404)', async () => {
    const res = await request(app).delete(`/api/lines/${lineId}`).set('Cookie', member.cookie);
    expect(res.status).toBe(404);
  });

  it('coach darf die Line löschen', async () => {
    const res = await request(app).delete(`/api/lines/${lineId}`).set('Cookie', coach.cookie);
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

  it('member darf sie NICHT umbenennen (404)', async () => {
    const res = await request(app).put(`/api/formations/${formationId}`).set('Cookie', member.cookie).send({ name: 'Sollte fehlschlagen' });
    expect(res.status).toBe(404);
  });

  it('owner darf sie umbenennen', async () => {
    const res = await request(app).put(`/api/formations/${formationId}`).set('Cookie', owner.cookie).send({ name: 'Umbenannt' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Umbenannt');
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

describe('Ankündigungen (announcements) – Team-Sharing', () => {
  it('coach darf eine Ankündigung anlegen, member sieht sie nur lesend', async () => {
    const createRes = await request(app).post('/api/announcements').set('Cookie', coach.cookie).send({ teamId, text: 'Team-Ankündigung' });
    expect(createRes.status).toBe(201);

    const listRes = await request(app).get('/api/announcements').set('Cookie', member.cookie);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((a) => a._id === createRes.body.data._id)).toBe(true);
  });

  it('member darf keine Ankündigung anlegen (404)', async () => {
    const res = await request(app).post('/api/announcements').set('Cookie', member.cookie).send({ teamId, text: 'Sollte fehlschlagen' });
    expect(res.status).toBe(404);
  });
});

describe('Umfragen (polls) – Team-Sharing', () => {
  let pollId;
  let optionId;

  it('coach darf eine Umfrage anlegen, member darf abstimmen', async () => {
    const createRes = await request(app).post('/api/polls').set('Cookie', coach.cookie).send({ teamId, question: 'Team-Umfrage?', options: ['Ja', 'Nein'] });
    expect(createRes.status).toBe(201);
    pollId = createRes.body.data._id;
    optionId = createRes.body.data.options[0]._id;

    const voteRes = await request(app).post(`/api/polls/${pollId}/vote`).set('Cookie', member.cookie).send({ optionId });
    expect(voteRes.status).toBe(200);
  });

  it('member darf die Umfrage NICHT schließen (404)', async () => {
    const res = await request(app).put(`/api/polls/${pollId}/close`).set('Cookie', member.cookie);
    expect(res.status).toBe(404);
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
