import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'library-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123' });
  return { id: res.body.data.user.id, email, cookie: res.headers['set-cookie'][0] };
}

async function forceRole(userId, role) {
  await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, userId]);
}

async function relogin(user, password = 'Testpass123') {
  const res = await request(app).post('/api/auth/login').send({ email: user.email, password });
  return { ...user, cookie: res.headers['set-cookie'][0] };
}

let owner;
let other;
let admin;

async function createBoard(cookie, name) {
  const res = await request(app)
    .post('/api/boards')
    .set('Cookie', cookie)
    .send({ name });
  return res.body.data._id;
}

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  owner = await registerAndLogin('owner');
  other = await registerAndLogin('other');

  const adminReg = await registerAndLogin('admin');
  await forceRole(adminReg.id, 'admin');
  admin = await relogin(adminReg);

  // owner/other könnten je nach Testreihenfolge in einer leeren DB
  // versehentlich Admin geworden sein (erster registrierter Account) –
  // explizit auf 'user' zurücksetzen, analog admin.test.js-Kommentar.
  await forceRole(owner.id, 'user');
  owner = await relogin(owner);
  await forceRole(other.id, 'user');
  other = await relogin(other);
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('POST /api/boards/:id/publish', () => {
  it('lehnt nicht authentifizierte Anfragen mit 401 ab', async () => {
    const boardId = await createBoard(owner.cookie, 'Zu veröffentlichen');
    const res = await request(app).post(`/api/boards/${boardId}/publish`).send({});
    expect(res.status).toBe(401);
  });

  it('veröffentlicht ein eigenes Board als Snapshot in der Bibliothek', async () => {
    const boardId = await createBoard(owner.cookie, 'Powerplay 5v4');
    const res = await request(app)
      .post(`/api/boards/${boardId}/publish`)
      .set('Cookie', owner.cookie)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Powerplay 5v4');
    expect(res.body.data.ownerId).toBe(owner.id);
  });

  it('lehnt Veröffentlichen durch einen fremden Nutzer mit 404 ab (kein Zugriff)', async () => {
    const boardId = await createBoard(owner.cookie, 'Fremdes Board');
    const res = await request(app)
      .post(`/api/boards/${boardId}/publish`)
      .set('Cookie', other.cookie)
      .send({});
    expect(res.status).toBe(404);
  });

  it('übernimmt einen optionalen abweichenden Namen', async () => {
    const boardId = await createBoard(owner.cookie, 'Originalname');
    const res = await request(app)
      .post(`/api/boards/${boardId}/publish`)
      .set('Cookie', owner.cookie)
      .send({ name: 'Anderer Bibliotheksname' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Anderer Bibliotheksname');
  });
});

describe('GET /api/library', () => {
  let entryId;

  beforeAll(async () => {
    const boardId = await createBoard(owner.cookie, 'Forechecking 2-1-2');
    const res = await request(app)
      .post(`/api/boards/${boardId}/publish`)
      .set('Cookie', owner.cookie)
      .send({});
    entryId = res.body.data._id;
  });

  it('lehnt nicht authentifizierte Anfragen mit 401 ab', async () => {
    const res = await request(app).get('/api/library');
    expect(res.status).toBe(401);
  });

  it('listet veröffentlichte Einträge instanzweit auch für fremde Nutzer', async () => {
    const res = await request(app).get('/api/library').set('Cookie', other.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.some((e) => e._id === entryId)).toBe(true);
  });

  it('filtert per Namenssuche', async () => {
    const res = await request(app)
      .get('/api/library')
      .query({ search: 'Forechecking' })
      .set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.every((e) => e.name.includes('Forechecking'))).toBe(true);
  });

  it('filtert per Kategorie ohne Treffer, wenn keine Einträge dieser Kategorie existieren', async () => {
    const res = await request(app)
      .get('/api/library')
      .query({ category: 'nachwuchs' })
      .set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.some((e) => e._id === entryId)).toBe(false);
  });
});

describe('GET /api/library/:id', () => {
  it('liefert einen einzelnen Eintrag für jeden eingeloggten Nutzer', async () => {
    const boardId = await createBoard(owner.cookie, 'Einzelabruf-Test');
    const publishRes = await request(app)
      .post(`/api/boards/${boardId}/publish`)
      .set('Cookie', owner.cookie)
      .send({});
    const entryId = publishRes.body.data._id;

    const res = await request(app).get(`/api/library/${entryId}`).set('Cookie', other.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(entryId);
  });

  it('liefert 404 für eine nicht existierende ID', async () => {
    const res = await request(app)
      .get('/api/library/00000000-0000-0000-0000-000000000000')
      .set('Cookie', owner.cookie);
    expect(res.status).toBe(404);
  });

  it('liefert 422 für eine ungültige ID', async () => {
    const res = await request(app).get('/api/library/not-a-uuid').set('Cookie', owner.cookie);
    expect(res.status).toBe(422);
  });
});

describe('POST /api/library/:id/clone', () => {
  it('erzeugt aus dem Snapshot ein neues, privates Board für den klonenden Nutzer', async () => {
    const boardId = await createBoard(owner.cookie, 'Zu klonende Übung');
    const publishRes = await request(app)
      .post(`/api/boards/${boardId}/publish`)
      .set('Cookie', owner.cookie)
      .send({});
    const entryId = publishRes.body.data._id;

    const cloneRes = await request(app)
      .post(`/api/library/${entryId}/clone`)
      .set('Cookie', other.cookie)
      .send({});
    expect(cloneRes.status).toBe(201);
    const newBoardId = cloneRes.body.data._id;
    expect(newBoardId).toBeTruthy();

    const boardRes = await request(app).get(`/api/boards/${newBoardId}`).set('Cookie', other.cookie);
    expect(boardRes.status).toBe(200);
    expect(boardRes.body.data.name).toBe('Zu klonende Übung');

    const ownerBoardCheck = await request(app).get(`/api/boards/${newBoardId}`).set('Cookie', owner.cookie);
    expect(ownerBoardCheck.status).toBe(404); // gehört jetzt other, nicht mehr owner
  });

  it('liefert 404 beim Klonen einer nicht existierenden ID', async () => {
    const res = await request(app)
      .post('/api/library/00000000-0000-0000-0000-000000000000/clone')
      .set('Cookie', owner.cookie)
      .send({});
    expect(res.status).toBe(404);
  });
});

describe('POST /api/library/:id/report', () => {
  let entryId;

  beforeAll(async () => {
    const boardId = await createBoard(owner.cookie, 'Zu meldende Übung');
    const publishRes = await request(app)
      .post(`/api/boards/${boardId}/publish`)
      .set('Cookie', owner.cookie)
      .send({});
    entryId = publishRes.body.data._id;
  });

  it('erlaubt einem Nutzer, einen Eintrag mit Begründung zu melden', async () => {
    const res = await request(app)
      .post(`/api/library/${entryId}/report`)
      .set('Cookie', other.cookie)
      .send({ reason: 'Unpassender Inhalt' });
    expect(res.status).toBe(200);
  });

  it('liefert weiterhin Erfolg bei einer zweiten Meldung durch denselben Nutzer (kein Fehlerfall)', async () => {
    const res = await request(app)
      .post(`/api/library/${entryId}/report`)
      .set('Cookie', other.cookie)
      .send({ reason: 'Nochmal gemeldet' });
    expect(res.status).toBe(200);
  });

  it('lehnt eine zu lange Begründung mit 422 ab', async () => {
    const res = await request(app)
      .post(`/api/library/${entryId}/report`)
      .set('Cookie', other.cookie)
      .send({ reason: 'x'.repeat(301) });
    expect(res.status).toBe(422);
  });

  it('liefert 404 beim Melden einer nicht existierenden ID', async () => {
    const res = await request(app)
      .post('/api/library/00000000-0000-0000-0000-000000000000/report')
      .set('Cookie', other.cookie)
      .send({ reason: 'x' });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/admin/library-reports', () => {
  let reportedEntryId;

  beforeAll(async () => {
    const boardId = await createBoard(owner.cookie, 'Admin-Meldeliste-Test');
    const publishRes = await request(app)
      .post(`/api/boards/${boardId}/publish`)
      .set('Cookie', owner.cookie)
      .send({});
    reportedEntryId = publishRes.body.data._id;
    await request(app)
      .post(`/api/library/${reportedEntryId}/report`)
      .set('Cookie', other.cookie)
      .send({ reason: 'Für Admin-Test gemeldet' });
  });

  it('lehnt Nicht-Admins mit 403 ab', async () => {
    const res = await request(app).get('/api/admin/library-reports').set('Cookie', owner.cookie);
    expect(res.status).toBe(403);
  });

  it('listet gemeldete Einträge für Admins inkl. Meldeanzahl', async () => {
    const res = await request(app).get('/api/admin/library-reports').set('Cookie', admin.cookie);
    expect(res.status).toBe(200);
    const entry = res.body.data.find((e) => e._id === reportedEntryId);
    expect(entry).toBeTruthy();
    expect(entry.reportCount).toBeGreaterThanOrEqual(1);
  });
});

describe('DELETE /api/library/:id', () => {
  it('erlaubt dem Ersteller, den eigenen Eintrag zu löschen', async () => {
    const boardId = await createBoard(owner.cookie, 'Selbst zu löschen');
    const publishRes = await request(app)
      .post(`/api/boards/${boardId}/publish`)
      .set('Cookie', owner.cookie)
      .send({});
    const entryId = publishRes.body.data._id;

    const res = await request(app).delete(`/api/library/${entryId}`).set('Cookie', owner.cookie);
    expect(res.status).toBe(200);

    const getRes = await request(app).get(`/api/library/${entryId}`).set('Cookie', owner.cookie);
    expect(getRes.status).toBe(404);
  });

  it('lehnt Löschen durch einen fremden, nicht-privilegierten Nutzer mit 403 ab', async () => {
    const boardId = await createBoard(owner.cookie, 'Fremdlöschversuch');
    const publishRes = await request(app)
      .post(`/api/boards/${boardId}/publish`)
      .set('Cookie', owner.cookie)
      .send({});
    const entryId = publishRes.body.data._id;

    const res = await request(app).delete(`/api/library/${entryId}`).set('Cookie', other.cookie);
    expect(res.status).toBe(403);
  });

  it('erlaubt einem Admin, einen fremden Eintrag zu löschen (Moderation)', async () => {
    const boardId = await createBoard(owner.cookie, 'Admin-Löschung');
    const publishRes = await request(app)
      .post(`/api/boards/${boardId}/publish`)
      .set('Cookie', owner.cookie)
      .send({});
    const entryId = publishRes.body.data._id;

    const res = await request(app).delete(`/api/library/${entryId}`).set('Cookie', admin.cookie);
    expect(res.status).toBe(200);
  });

  it('liefert 404 beim Löschen einer nicht existierenden ID', async () => {
    const res = await request(app)
      .delete('/api/library/00000000-0000-0000-0000-000000000000')
      .set('Cookie', owner.cookie);
    expect(res.status).toBe(404);
  });
});
