import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'admin-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123', birthday: '1990-01-01'});
  return { id: res.body.data.user.id, email, cookie: res.headers['set-cookie'][0] };
}

async function forceRole(userId, role) {
  await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, userId]);
}

let admin;
let regular;
let victim;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  admin   = await registerAndLogin('admin');
  regular = await registerAndLogin('regular');
  victim  = await registerAndLogin('victim');
  await forceRole(admin.id, 'admin');
  await forceRole(regular.id, 'user');
  await forceRole(victim.id, 'user');
  // Die Rolle steckt im JWT-Payload (Stand beim Ausstellen, siehe
  // middleware/auth.js) – forceRole() ändert nur die DB, das beim
  // register() bereits ausgestellte Cookie trägt noch die alte Rolle.
  // Ohne Re-Login hängt dieser Test also davon ab, dass admin.test.js
  // zufällig als allererste Datei den allerersten User der gesamten
  // Test-DB registriert (der wird laut auth.js automatisch Admin) – das
  // ist von der Jest-Dateireihenfolge abhängig und bricht, sobald eine
  // andere Testdatei vorher irgendeinen User registriert.
  const reloginRes = await request(app).post('/api/auth/login').send({ email: admin.email, password: 'Testpass123' });
  admin.cookie = reloginRes.headers['set-cookie'][0];
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('GET /api/admin/users', () => {
  it('lehnt Nicht-Admins mit 403 ab', async () => {
    const res = await request(app).get('/api/admin/users').set('Cookie', regular.cookie);
    expect(res.status).toBe(403);
  });

  it('listet alle User für Admins', async () => {
    const res = await request(app).get('/api/admin/users').set('Cookie', admin.cookie);
    expect(res.status).toBe(200);
    const emails = res.body.data.map((u) => u.email);
    expect(emails).toEqual(expect.arrayContaining([admin.email, regular.email, victim.email]));
  });
});

describe('DELETE /api/admin/users/:id', () => {
  it('lehnt Selbstlöschung mit 400 ab', async () => {
    const res = await request(app).delete(`/api/admin/users/${admin.id}`).set('Cookie', admin.cookie);
    expect(res.status).toBe(400);
  });

  it('löscht einen anderen User und räumt Kommentare Dritter auf dessen Boards auf', async () => {
    // Bug-Regression: boards.user_id hat ON DELETE CASCADE auf users, löscht
    // beim Account-Löschen also victims Board hart – ohne über
    // boardsController.deleteBoard zu laufen, wo Kommentare sonst aufgeräumt
    // werden. Kommentare eines DRITTEN Nutzers (regular) blieben ohne den
    // Fix als verwaiste Zeilen zurück, obwohl das Board längst weg ist.
    const boardRes = await request(app)
      .post('/api/boards')
      .set('Cookie', victim.cookie)
      .send({ name: 'Victims Board', fieldType: 'large' });
    const boardId = boardRes.body.data._id;

    await request(app)
      .post(`/api/boards/${boardId}/collaborators`)
      .set('Cookie', victim.cookie)
      .send({ email: regular.email, permission: 'read' });

    const commentRes = await request(app)
      .post(`/api/boards/${boardId}/comments`)
      .set('Cookie', regular.cookie)
      .send({ text: 'Kommentar von einem Dritten' });
    expect(commentRes.status).toBe(201);

    const res = await request(app).delete(`/api/admin/users/${victim.id}`).set('Cookie', admin.cookie);
    expect(res.status).toBe(200);

    const check = await pool.query('SELECT id FROM users WHERE id = $1', [victim.id]);
    expect(check.rows).toHaveLength(0);

    const orphaned = await pool.query(
      "SELECT id FROM comments WHERE resource_type = 'board' AND resource_id = $1",
      [boardId]
    );
    expect(orphaned.rows).toHaveLength(0);
  });
});

describe('PUT /api/admin/users/:id/role', () => {
  it('lehnt Degradierung des letzten Admins mit 400 ab', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${admin.id}/role`)
      .set('Cookie', admin.cookie)
      .send({ role: 'user' });
    expect(res.status).toBe(400);
  });

  it('befördert einen normalen User zu Admin', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${regular.id}/role`)
      .set('Cookie', admin.cookie)
      .send({ role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('admin');
  });
});
