import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'boardshare-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123' });
  return { email, cookie: res.headers['set-cookie'][0] };
}

let owner;
let collaborator;
let stranger;
let boardId;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  owner = await registerAndLogin('owner');
  collaborator = await registerAndLogin('collaborator');
  stranger = await registerAndLogin('stranger');

  const boardRes = await request(app)
    .post('/api/boards')
    .set('Cookie', owner.cookie)
    .send({ name: 'Geteiltes Board', fieldType: 'large' });
  boardId = boardRes.body.data._id;
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('Board-Sharing – Zugriffsschutz vor Freigabe', () => {
  it('verweigert einem fremden User den Zugriff auf das Board (GET) mit 404', async () => {
    const res = await request(app).get(`/api/boards/${boardId}`).set('Cookie', collaborator.cookie);
    expect(res.status).toBe(404);
  });
});

describe('Kollaboratoren-Verwaltung (Owner-only)', () => {
  let collaboratorEntryId;

  it('lehnt Kollaborator-Verwaltung durch einen fremden User mit 404 ab', async () => {
    const res = await request(app)
      .post(`/api/boards/${boardId}/collaborators`)
      .set('Cookie', stranger.cookie)
      .send({ email: collaborator.email, permission: 'read' });
    expect(res.status).toBe(404);
  });

  it('legt bei unbekannter E-Mail-Adresse eine Einladung an (201, status "invited")', async () => {
    const res = await request(app)
      .post(`/api/boards/${boardId}/collaborators`)
      .set('Cookie', owner.cookie)
      .send({ email: 'nichtexistent-xyz@example.com', permission: 'read' });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('invited');
    expect(res.body.data.email).toBe('nichtexistent-xyz@example.com');
  });

  it('aktualisiert bei erneutem Einladen derselben unbekannten Adresse Token/Berechtigung statt Fehler', async () => {
    const res = await request(app)
      .post(`/api/boards/${boardId}/collaborators`)
      .set('Cookie', owner.cookie)
      .send({ email: 'nichtexistent-xyz@example.com', permission: 'write' });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('invited');
    expect(res.body.data.permission).toBe('write');
  });

  it('lehnt das Hinzufügen sich selbst als Kollaborator mit 400 ab', async () => {
    const res = await request(app)
      .post(`/api/boards/${boardId}/collaborators`)
      .set('Cookie', owner.cookie)
      .send({ email: owner.email, permission: 'write' });
    expect(res.status).toBe(400);
  });

  it('erlaubt dem Owner, einen Kollaborator mit write-Berechtigung hinzuzufügen', async () => {
    const res = await request(app)
      .post(`/api/boards/${boardId}/collaborators`)
      .set('Cookie', owner.cookie)
      .send({ email: collaborator.email, permission: 'write' });
    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe(collaborator.email);
    expect(res.body.data.permission).toBe('write');
    collaboratorEntryId = res.body.data._id;
  });

  it('lehnt das doppelte Hinzufügen desselben Kollaborators mit 400 ab', async () => {
    const res = await request(app)
      .post(`/api/boards/${boardId}/collaborators`)
      .set('Cookie', owner.cookie)
      .send({ email: collaborator.email, permission: 'read' });
    expect(res.status).toBe(400);
  });

  it('listet Kollaboratoren und offene Einladungen zusammen (Owner-only)', async () => {
    const res = await request(app).get(`/api/boards/${boardId}/collaborators`).set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    const active = res.body.data.find((c) => c.status === 'active');
    const invited = res.body.data.find((c) => c.status === 'invited');
    expect(active.email).toBe(collaborator.email);
    expect(active.permission).toBe('write');
    expect(invited.email).toBe('nichtexistent-xyz@example.com');
    expect(invited.permission).toBe('write');
  });

  it('lehnt das Auflisten durch einen Kollaboraten (kein Owner) mit 404 ab', async () => {
    const res = await request(app).get(`/api/boards/${boardId}/collaborators`).set('Cookie', collaborator.cookie);
    expect(res.status).toBe(404);
  });

  it('write-Kollaborator kann das Board lesen', async () => {
    const res = await request(app).get(`/api/boards/${boardId}`).set('Cookie', collaborator.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.accessLevel).toBe('write');
  });

  it('write-Kollaborator kann Board-Notizen ändern (PUT)', async () => {
    const res = await request(app)
      .put(`/api/boards/${boardId}`)
      .set('Cookie', collaborator.cookie)
      .send({ notes: 'Notiz vom Kollaborator' });
    expect(res.status).toBe(200);
    expect(res.body.data.notes).toBe('Notiz vom Kollaborator');
  });

  it('write-Kollaborator kann einen Frame ändern (PUT)', async () => {
    const framesRes = await request(app)
      .get(`/api/boards/${boardId}/frames`)
      .set('Cookie', collaborator.cookie);
    expect(framesRes.status).toBe(200);
    const frameId = framesRes.body.data[0]._id;

    const res = await request(app)
      .put(`/api/boards/${boardId}/frames/${frameId}`)
      .set('Cookie', collaborator.cookie)
      .send({ label: 'Vom Kollaborator geändert' });
    expect(res.status).toBe(200);
    expect(res.body.data.label).toBe('Vom Kollaborator geändert');
  });

  it('write-Kollaborator kann das Board NICHT löschen (404)', async () => {
    const res = await request(app).delete(`/api/boards/${boardId}`).set('Cookie', collaborator.cookie);
    expect(res.status).toBe(404);
  });

  it('erlaubt dem Owner, die Berechtigung auf read herabzustufen', async () => {
    const res = await request(app)
      .put(`/api/boards/${boardId}/collaborators/${collaboratorEntryId}`)
      .set('Cookie', owner.cookie)
      .send({ permission: 'read' });
    expect(res.status).toBe(200);
    expect(res.body.data.permission).toBe('read');
  });

  it('read-Kollaborator kann das Board weiterhin lesen', async () => {
    const res = await request(app).get(`/api/boards/${boardId}`).set('Cookie', collaborator.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.accessLevel).toBe('read');
  });

  it('read-Kollaborator kann das Board NICHT mehr ändern (404)', async () => {
    const res = await request(app)
      .put(`/api/boards/${boardId}`)
      .set('Cookie', collaborator.cookie)
      .send({ notes: 'Sollte fehlschlagen' });
    expect(res.status).toBe(404);
  });

  it('geteiltes Board erscheint in der Board-Liste des Kollaborators', async () => {
    const res = await request(app).get('/api/boards').set('Cookie', collaborator.cookie);
    expect(res.status).toBe(200);
    const shared = res.body.data.find((b) => b._id === boardId);
    expect(shared).toBeDefined();
    expect(shared.accessLevel).toBe('read');
  });

  it('entfernt den Kollaborator (Owner-only)', async () => {
    const res = await request(app)
      .delete(`/api/boards/${boardId}/collaborators/${collaboratorEntryId}`)
      .set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
  });

  it('entfernter Kollaborator hat wieder keinen Zugriff (404)', async () => {
    const res = await request(app).get(`/api/boards/${boardId}`).set('Cookie', collaborator.cookie);
    expect(res.status).toBe(404);
  });

  it('geteiltes Board erscheint nicht mehr in der Liste des ehemaligen Kollaborators', async () => {
    const res = await request(app).get('/api/boards').set('Cookie', collaborator.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.some((b) => b._id === boardId)).toBe(false);
  });

  it('zieht eine offene Einladung über die bestehende DELETE-Route zurück', async () => {
    const listRes = await request(app).get(`/api/boards/${boardId}/collaborators`).set('Cookie', owner.cookie);
    const invited = listRes.body.data.find((c) => c.status === 'invited');
    expect(invited).toBeDefined();

    const res = await request(app)
      .delete(`/api/boards/${boardId}/collaborators/${invited._id}`)
      .set('Cookie', owner.cookie);
    expect(res.status).toBe(200);

    const afterRes = await request(app).get(`/api/boards/${boardId}/collaborators`).set('Cookie', owner.cookie);
    expect(afterRes.body.data.some((c) => c._id === invited._id)).toBe(false);
  });
});

describe('Kollaboratoren-Limit zählt offene Einladungen mit', () => {
  it('lehnt eine weitere Einladung ab, wenn Kollaboratoren + offene Einladungen das Limit erreichen', async () => {
    const capBoardRes = await request(app)
      .post('/api/boards')
      .set('Cookie', owner.cookie)
      .send({ name: 'Limit-Test-Board', fieldType: 'large' });
    const capBoardId = capBoardRes.body.data._id;

    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post(`/api/boards/${capBoardId}/collaborators`)
        .set('Cookie', owner.cookie)
        .send({ email: `limit-invite-${i}-${Math.floor(Math.random() * 1e9)}@example.com`, permission: 'read' });
      expect(res.status).toBe(201);
    }

    const res = await request(app)
      .post(`/api/boards/${capBoardId}/collaborators`)
      .set('Cookie', owner.cookie)
      .send({ email: `limit-invite-overflow-${Math.floor(Math.random() * 1e9)}@example.com`, permission: 'read' });
    expect(res.status).toBe(400);
  });
});
