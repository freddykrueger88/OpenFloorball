import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'delete-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
});

describe('DELETE /api/user/account', () => {
  it('lehnt eine falsche E-Mail-Bestätigung mit 400 ab', async () => {
    const email = uniqueEmail('wrongconfirm');
    const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123', birthday: '1990-01-01'});
    const cookie = res.headers['set-cookie'][0];

    const delRes = await request(app)
      .delete('/api/user/account')
      .set('Cookie', cookie)
      .send({ email: 'falsche@example.com' });
    expect(delRes.status).toBe(400);
  });

  it('löscht Account + Boards und invalidiert das Cookie', async () => {
    const email = uniqueEmail('success');
    const registerRes = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123', birthday: '1990-01-01'});
    const cookie = registerRes.headers['set-cookie'][0];
    const userId = registerRes.body.data.user.id;

    const boardRes = await request(app)
      .post('/api/boards')
      .set('Cookie', cookie)
      .send({ name: 'Board vor Löschung', fieldType: 'large' });
    const boardId = boardRes.body.data._id;

    // Bug-Regression: boards.user_id hat ON DELETE CASCADE auf users, löscht
    // das Board beim Account-Löschen also hart, ohne über
    // boardsController.deleteBoard zu laufen – dort sitzt die Kommentar-
    // Aufräumung sonst. Ein Kommentar eines DRITTEN Nutzers (Kollaborator)
    // blieb ohne den Fix als verwaiste Zeile zurück.
    const collaboratorEmail = uniqueEmail('collaborator');
    const collaboratorRes = await request(app).post('/api/auth/register').send({ email: collaboratorEmail, password: 'Testpass123', birthday: '1990-01-01'});
    const collaboratorCookie = collaboratorRes.headers['set-cookie'][0];
    await request(app)
      .post(`/api/boards/${boardId}/collaborators`)
      .set('Cookie', cookie)
      .send({ email: collaboratorEmail, permission: 'read' });
    const commentRes = await request(app)
      .post(`/api/boards/${boardId}/comments`)
      .set('Cookie', collaboratorCookie)
      .send({ text: 'Kommentar von einem Dritten' });
    expect(commentRes.status).toBe(201);

    const delRes = await request(app)
      .delete('/api/user/account')
      .set('Cookie', cookie)
      .send({ email });
    expect(delRes.status).toBe(200);

    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    expect(userCheck.rows).toHaveLength(0);
    const boardCheck = await pool.query('SELECT id FROM boards WHERE id = $1', [boardId]);
    expect(boardCheck.rows).toHaveLength(0);
    const orphanedComments = await pool.query(
      "SELECT id FROM comments WHERE resource_type = 'board' AND resource_id = $1",
      [boardId]
    );
    expect(orphanedComments.rows).toHaveLength(0);

    const meRes = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(meRes.status).toBe(401);
  });

  it('lehnt Löschung des letzten Admins mit 403 ab', async () => {
    const email = uniqueEmail('lastadmin');
    const registerRes = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123', birthday: '1990-01-01'});
    const cookie = registerRes.headers['set-cookie'][0];
    const userId = registerRes.body.data.user.id;
    // Frühere Tests in dieser Datei können durch "erster User = Admin" bereits
    // einen (nicht gelöschten) Admin hinterlassen haben – für einen
    // deterministischen "letzter Admin"-Test alle anderen zurückstufen.
    await pool.query("UPDATE users SET role = 'user' WHERE role = 'admin' AND id != $1", [userId]);
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', ['admin', userId]);

    const delRes = await request(app)
      .delete('/api/user/account')
      .set('Cookie', cookie)
      .send({ email });
    expect(delRes.status).toBe(403);
  });
});
