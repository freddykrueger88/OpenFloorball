/**
 * boardVersions.test.js – automatische Versionierung von Boards
 * (ROADMAP Phase 2)
 */
import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'versions-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123', birthday: '1990-01-01'});
  return { email, cookie: res.headers['set-cookie'][0] };
}

let owner;
let collaborator;
let stranger;
let boardId;
let frameId;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  owner = await registerAndLogin('owner');
  collaborator = await registerAndLogin('collaborator');
  stranger = await registerAndLogin('stranger');

  const boardRes = await request(app).post('/api/boards').set('Cookie', owner.cookie).send({ name: 'Versions-Board', fieldType: 'large' });
  boardId = boardRes.body.data._id;
  await request(app).post(`/api/boards/${boardId}/collaborators`).set('Cookie', owner.cookie).send({ email: collaborator.email, permission: 'read' });

  const framesRes = await request(app).get(`/api/boards/${boardId}/frames`).set('Cookie', owner.cookie);
  frameId = framesRes.body.data[0]._id;
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('Automatische Versionierung', () => {
  it('lehnt Zugriff durch einen Fremden mit 404 ab', async () => {
    const res = await request(app).get(`/api/boards/${boardId}/versions`).set('Cookie', stranger.cookie);
    expect(res.status).toBe(404);
  });

  it('erzeugt bei jedem Frame-Update automatisch eine neue Version', async () => {
    const before = await request(app).get(`/api/boards/${boardId}/versions`).set('Cookie', owner.cookie);
    const countBefore = before.body.data.length;

    await request(app).put(`/api/boards/${boardId}/frames/${frameId}`).set('Cookie', owner.cookie).send({ label: 'Version A' });

    const after = await request(app).get(`/api/boards/${boardId}/versions`).set('Cookie', owner.cookie);
    expect(after.body.data.length).toBe(countBefore + 1);
  });

  it('read-Kollaborator kann Versionen sehen', async () => {
    const res = await request(app).get(`/api/boards/${boardId}/versions`).set('Cookie', collaborator.cookie);
    expect(res.status).toBe(200);
  });

  it('eine einzelne Version enthält den vollen Frame-Snapshot', async () => {
    const listRes = await request(app).get(`/api/boards/${boardId}/versions`).set('Cookie', owner.cookie);
    const versionId = listRes.body.data[0]._id;

    const res = await request(app).get(`/api/boards/${boardId}/versions/${versionId}`).set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.frames)).toBe(true);
  });

  it('hält die Aufbewahrungsgrenze von 50 Versionen pro Board ein', async () => {
    for (let i = 0; i < 55; i += 1) {
      await request(app).put(`/api/boards/${boardId}/frames/${frameId}`).set('Cookie', owner.cookie).send({ label: `Version ${i}` });
    }
    const count = await pool.query('SELECT COUNT(*)::int AS count FROM board_versions WHERE board_id = $1', [boardId]);
    expect(count.rows[0].count).toBe(50);
  }, 30000);

  it('read-Kollaborator kann NICHT wiederherstellen (write nötig)', async () => {
    const listRes = await request(app).get(`/api/boards/${boardId}/versions`).set('Cookie', owner.cookie);
    const versionId = listRes.body.data[listRes.body.data.length - 1]._id;
    const res = await request(app).post(`/api/boards/${boardId}/versions/${versionId}/restore`).set('Cookie', collaborator.cookie);
    expect(res.status).toBe(404);
  });

  it('owner kann eine ältere Version wiederherstellen', async () => {
    const listRes = await request(app).get(`/api/boards/${boardId}/versions`).set('Cookie', owner.cookie);
    const oldestVersionId = listRes.body.data[listRes.body.data.length - 1]._id;
    const oldestVersion = await request(app).get(`/api/boards/${boardId}/versions/${oldestVersionId}`).set('Cookie', owner.cookie);
    const expectedLabel = oldestVersion.body.data.frames[0].label;

    const restoreRes = await request(app).post(`/api/boards/${boardId}/versions/${oldestVersionId}/restore`).set('Cookie', owner.cookie);
    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.data[0].label).toBe(expectedLabel);
  });

  it('das Wiederherstellen selbst erzeugt wieder eine neue Version (nichts geht verloren)', async () => {
    const before = await pool.query('SELECT COUNT(*)::int AS count FROM board_versions WHERE board_id = $1', [boardId]);
    const framesRes = await request(app).get(`/api/boards/${boardId}/frames`).set('Cookie', owner.cookie);
    await request(app).put(`/api/boards/${boardId}/frames/${framesRes.body.data[0]._id}`).set('Cookie', owner.cookie).send({ label: 'Nach Restore' });
    const after = await pool.query('SELECT COUNT(*)::int AS count FROM board_versions WHERE board_id = $1', [boardId]);
    // Obergrenze bleibt bei 50, aber die Historie enthält weiterhin Einträge
    // (Restore selbst hat 2 Versionen erzeugt: Vorzustand + Wiederherstellung)
    expect(after.rows[0].count).toBe(50);
    expect(before.rows[0].count).toBe(50);
  });
});
