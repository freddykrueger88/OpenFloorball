import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'playbooks-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123' });
  return { email, cookie: res.headers['set-cookie'][0] };
}

let owner;
let other;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  owner = await registerAndLogin('owner');
  other = await registerAndLogin('other');
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('GET /api/playbooks', () => {
  it('liefert eine leere Liste für einen frischen Nutzer', async () => {
    const res = await request(app).get('/api/playbooks').set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('lehnt nicht authentifizierte Anfragen mit 401 ab', async () => {
    const res = await request(app).get('/api/playbooks');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/playbooks', () => {
  it('legt ein neues Playbook an', async () => {
    const res = await request(app)
      .post('/api/playbooks')
      .set('Cookie', owner.cookie)
      .send({ name: 'Standardsituationen 25/26' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Standardsituationen 25/26');
  });

  it('lehnt ein Playbook ohne Namen mit 422 ab', async () => {
    const res = await request(app).post('/api/playbooks').set('Cookie', owner.cookie).send({});
    expect(res.status).toBe(422);
  });

  it('lehnt ein 16. Playbook mit 400 ab (Maximal 15 Playbooks)', async () => {
    // 1 Playbook existiert bereits aus dem Test oben – 14 weitere bis
    // zum Limit auffüllen, dann das 16. testen.
    for (let i = 0; i < 14; i++) {
      const res = await request(app)
        .post('/api/playbooks')
        .set('Cookie', owner.cookie)
        .send({ name: `Playbook ${i}` });
      expect(res.status).toBe(201);
    }
    const overLimit = await request(app)
      .post('/api/playbooks')
      .set('Cookie', owner.cookie)
      .send({ name: 'Zu viel' });
    expect(overLimit.status).toBe(400);
  });
});

describe('DELETE /api/playbooks/:id', () => {
  let playbookId;
  let boardId;

  beforeAll(async () => {
    const pbRes = await request(app)
      .post('/api/playbooks')
      .set('Cookie', other.cookie)
      .send({ name: 'Wird gelöscht' });
    playbookId = pbRes.body.data._id;

    const boardRes = await request(app)
      .post('/api/boards')
      .set('Cookie', other.cookie)
      .send({ name: 'Zugeordnetes Board', fieldType: 'large', playbookId });
    boardId = boardRes.body.data._id;
  });

  it('verweigert einem fremden User das Löschen mit 404', async () => {
    const res = await request(app)
      .delete(`/api/playbooks/${playbookId}`)
      .set('Cookie', owner.cookie);
    expect(res.status).toBe(404);
  });

  it('löscht das eigene Playbook, zugeordnete Boards bleiben erhalten (playbookId → null)', async () => {
    const res = await request(app)
      .delete(`/api/playbooks/${playbookId}`)
      .set('Cookie', other.cookie);
    expect(res.status).toBe(200);

    const board = await request(app).get(`/api/boards/${boardId}`).set('Cookie', other.cookie);
    expect(board.status).toBe(200);
    expect(board.body.data.playbookId).toBeNull();
  });

  it('liefert 404 beim Löschen eines nicht existierenden Playbooks', async () => {
    const res = await request(app)
      .delete('/api/playbooks/00000000-0000-0000-0000-000000000000')
      .set('Cookie', owner.cookie);
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/playbooks/:id', () => {
  let playbookId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/playbooks')
      .set('Cookie', other.cookie)
      .send({ name: 'Alter Name' });
    playbookId = res.body.data._id;
  });

  it('benennt das eigene Playbook um', async () => {
    const res = await request(app)
      .put(`/api/playbooks/${playbookId}`)
      .set('Cookie', other.cookie)
      .send({ name: 'Neuer Name' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Neuer Name');
    expect(res.body.data.updatedAt).toBeDefined();
  });

  it('lehnt einen leeren Namen mit 422 ab', async () => {
    const res = await request(app)
      .put(`/api/playbooks/${playbookId}`)
      .set('Cookie', other.cookie)
      .send({ name: '' });
    expect(res.status).toBe(422);
  });

  it('verweigert einem fremden User das Umbenennen mit 404', async () => {
    const res = await request(app)
      .put(`/api/playbooks/${playbookId}`)
      .set('Cookie', owner.cookie)
      .send({ name: 'Sollte fehlschlagen' });
    expect(res.status).toBe(404);
  });

  it('liefert 404 beim Umbenennen eines nicht existierenden Playbooks', async () => {
    const res = await request(app)
      .put('/api/playbooks/00000000-0000-0000-0000-000000000000')
      .set('Cookie', other.cookie)
      .send({ name: 'Egal' });
    expect(res.status).toBe(404);
  });
});

describe('Vereinsweit geteilte Playbooks (EPIC 011)', () => {
  let orgAdmin;
  let orgMember; // organization_members-Mitglied, aber KEIN Team des Vereins
  let teamMemberNoOrg; // team_members-Mitglied eines Vereins-Teams, aber KEIN organization_members-Eintrag
  let stranger;
  let orgId;
  let teamId;
  let playbookId;

  beforeAll(async () => {
    orgAdmin = await registerAndLogin('org-admin');
    orgMember = await registerAndLogin('org-member');
    teamMemberNoOrg = await registerAndLogin('team-member-no-org');
    stranger = await registerAndLogin('stranger');

    const orgRes = await request(app).post('/api/organizations').set('Cookie', orgAdmin.cookie).send({ name: 'EPIC011-Playbooks-Verein' });
    orgId = orgRes.body.data._id;
    await request(app).post(`/api/organizations/${orgId}/members`).set('Cookie', orgAdmin.cookie)
      .send({ email: orgMember.email, role: 'member' });

    const teamRes = await request(app).post('/api/teams').set('Cookie', orgAdmin.cookie).send({ name: 'EPIC011-Playbooks-Team', organizationId: orgId });
    teamId = teamRes.body.data._id;
    await request(app).post(`/api/teams/${teamId}/members`).set('Cookie', orgAdmin.cookie)
      .send({ email: teamMemberNoOrg.email, role: 'member' });
  });

  it('erlaubt einem Vereins-Admin, ein vereinsweites Playbook anzulegen', async () => {
    const res = await request(app)
      .post('/api/playbooks')
      .set('Cookie', orgAdmin.cookie)
      .send({ name: 'Vereinsweite Übungssammlung', organizationId: orgId });
    expect(res.status).toBe(201);
    expect(res.body.data.organizationId).toBe(orgId);
    expect(res.body.data.teamId).toBeNull();
    playbookId = res.body.data._id;
  });

  it('lehnt teamId UND organizationId gleichzeitig mit 400 ab', async () => {
    const res = await request(app)
      .post('/api/playbooks')
      .set('Cookie', orgAdmin.cookie)
      .send({ name: 'Ungültig', teamId, organizationId: orgId });
    expect(res.status).toBe(400);
  });

  it('lehnt ein einfaches Vereinsmitglied (kein Admin) beim Anlegen mit 404 ab', async () => {
    const res = await request(app)
      .post('/api/playbooks')
      .set('Cookie', orgMember.cookie)
      .send({ name: 'Sollte nicht klappen', organizationId: orgId });
    expect(res.status).toBe(404);
  });

  it('macht das vereinsweite Playbook für ein Team-Mitglied eines Vereins-Teams sichtbar, auch ohne eigene organization_members-Zeile', async () => {
    const listRes = await request(app).get('/api/playbooks').set('Cookie', teamMemberNoOrg.cookie);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((p) => p._id === playbookId)).toBe(true);

    const getRes = await request(app).get(`/api/playbooks/${playbookId}`).set('Cookie', teamMemberNoOrg.cookie);
    expect(getRes.status).toBe(200);
  });

  it('macht das vereinsweite Playbook für ein einfaches organization_members-Mitglied ohne Team sichtbar', async () => {
    const res = await request(app).get(`/api/playbooks/${playbookId}`).set('Cookie', orgMember.cookie);
    expect(res.status).toBe(200);
  });

  it('bleibt für einen Fremden ohne jede Beziehung zum Verein unsichtbar (404)', async () => {
    const res = await request(app).get(`/api/playbooks/${playbookId}`).set('Cookie', stranger.cookie);
    expect(res.status).toBe(404);
  });

  it('lehnt das Umbenennen durch ein Team-Mitglied (kein Vereins-Admin) mit 404 ab – Team-Coach-Recht reicht hier nicht', async () => {
    const res = await request(app)
      .put(`/api/playbooks/${playbookId}`)
      .set('Cookie', teamMemberNoOrg.cookie)
      .send({ name: 'Sollte nicht klappen' });
    expect(res.status).toBe(404);
  });

  it('erlaubt dem Vereins-Admin das Umbenennen', async () => {
    const res = await request(app)
      .put(`/api/playbooks/${playbookId}`)
      .set('Cookie', orgAdmin.cookie)
      .send({ name: 'Umbenannt' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Umbenannt');
  });
});
