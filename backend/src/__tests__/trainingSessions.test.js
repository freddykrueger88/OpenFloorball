import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'trainings-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123' });
  return { email, cookie: res.headers['set-cookie'][0] };
}

async function createBoard(cookie, name = 'Testboard') {
  const res = await request(app)
    .post('/api/boards')
    .set('Cookie', cookie)
    .send({ name, fieldType: 'large' });
  return res.body.data._id;
}

let owner;
let other;
let otherBoardId;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  owner = await registerAndLogin('owner');
  other = await registerAndLogin('other');
  otherBoardId = await createBoard(other.cookie, 'Fremdes Board');
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('GET/POST /api/trainings', () => {
  it('liefert eine leere Liste für einen frischen Nutzer', async () => {
    const res = await request(app).get('/api/trainings').set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('lehnt nicht authentifizierte Anfragen mit 401 ab', async () => {
    const res = await request(app).get('/api/trainings');
    expect(res.status).toBe(401);
  });

  it('legt eine neue Trainingseinheit an', async () => {
    const res = await request(app)
      .post('/api/trainings')
      .set('Cookie', owner.cookie)
      .send({ name: 'Aufwärmen Block A' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Aufwärmen Block A');
    expect(res.body.data.itemCount).toBe(0);
    expect(res.body.data.totalMinutes).toBe(0);
  });

  it('lehnt eine Trainingseinheit ohne Namen mit 422 ab', async () => {
    const res = await request(app).post('/api/trainings').set('Cookie', owner.cookie).send({});
    expect(res.status).toBe(422);
  });

  it('lehnt eine zusätzliche Trainingseinheit ab, wenn das Kontingent (200) ausgeschöpft ist', async () => {
    // Roadmap-Audit "Serientermine" hat MAX_SESSIONS von 20 auf 200
    // angehoben (Serien über eine Saison brauchen mehr Spielraum) –
    // 199 weitere Sessions per HTTP anzulegen wäre unnötig langsam,
    // daher direkter Bulk-Insert bis kurz vor das Kontingent, nur der
    // eigentliche Grenzfall läuft über den echten Endpunkt.
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [owner.email]);
    const ownerId = userResult.rows[0].id;
    const countResult = await pool.query('SELECT COUNT(*)::int AS count FROM training_sessions WHERE user_id = $1', [ownerId]);
    const remaining = 200 - countResult.rows[0].count;
    for (let i = 0; i < remaining; i++) {
      await pool.query('INSERT INTO training_sessions (user_id, name) VALUES ($1, $2)', [ownerId, `Filler ${i}`]);
    }
    const overLimit = await request(app)
      .post('/api/trainings')
      .set('Cookie', owner.cookie)
      .send({ name: 'Zu viel' });
    expect(overLimit.status).toBe(400);
  });
});

describe('Session CRUD + Ownership', () => {
  let sessionId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/trainings')
      .set('Cookie', other.cookie)
      .send({ name: 'Fremde Session' });
    sessionId = res.body.data._id;
  });

  it('erlaubt dem Eigentümer, die Session zu ändern', async () => {
    const res = await request(app)
      .put(`/api/trainings/${sessionId}`)
      .set('Cookie', other.cookie)
      .send({ name: 'Umbenannt', notes: 'Fokus: Passspiel' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Umbenannt');
    expect(res.body.data.notes).toBe('Fokus: Passspiel');
  });

  it('verweigert einem fremden User den Zugriff (GET) mit 404', async () => {
    const res = await request(app).get(`/api/trainings/${sessionId}`).set('Cookie', owner.cookie);
    expect(res.status).toBe(404);
  });

  it('verweigert einem fremden User das Ändern (PUT) mit 404', async () => {
    const res = await request(app)
      .put(`/api/trainings/${sessionId}`)
      .set('Cookie', owner.cookie)
      .send({ name: 'Übernommen' });
    expect(res.status).toBe(404);
  });

  it('verweigert einem fremden User das Löschen (DELETE) mit 404', async () => {
    const res = await request(app).delete(`/api/trainings/${sessionId}`).set('Cookie', owner.cookie);
    expect(res.status).toBe(404);
  });
});

describe('Datum und Ziel (ROADMAP Phase 3)', () => {
  // Eigener Nutzer statt `owner`, da `owner` in den Tests oben bereits
  // sein MAX_SESSIONS=20-Kontingent ausgeschöpft hat.
  let dateUser;

  beforeAll(async () => {
    dateUser = await registerAndLogin('date');
  });

  it('legt eine Trainingseinheit mit Datum und Ziel an', async () => {
    const res = await request(app)
      .post('/api/trainings')
      .set('Cookie', dateUser.cookie)
      .send({ name: 'Geplante Einheit', scheduledDate: '2026-09-15', goal: 'Passgenauigkeit verbessern' });
    expect(res.status).toBe(201);
    expect(res.body.data.scheduledDate).toBe('2026-09-15');
    expect(res.body.data.goal).toBe('Passgenauigkeit verbessern');
  });

  it('legt eine Trainingseinheit ohne Datum/Ziel mit sinnvollen Defaults an', async () => {
    const res = await request(app)
      .post('/api/trainings')
      .set('Cookie', dateUser.cookie)
      .send({ name: 'Spontane Einheit' });
    expect(res.status).toBe(201);
    expect(res.body.data.scheduledDate).toBeNull();
    expect(res.body.data.goal).toBe('');
  });

  it('lehnt ein ungültiges Datum mit 422 ab', async () => {
    const res = await request(app)
      .post('/api/trainings')
      .set('Cookie', dateUser.cookie)
      .send({ name: 'Ungültig', scheduledDate: 'nicht-ein-datum' });
    expect(res.status).toBe(422);
  });

  it('aktualisiert Datum und Ziel einer bestehenden Session', async () => {
    const createRes = await request(app)
      .post('/api/trainings')
      .set('Cookie', dateUser.cookie)
      .send({ name: 'Wird aktualisiert' });
    const id = createRes.body.data._id;

    const updateRes = await request(app)
      .put(`/api/trainings/${id}`)
      .set('Cookie', dateUser.cookie)
      .send({ scheduledDate: '2026-10-01', goal: 'Zonenverteidigung' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.scheduledDate).toBe('2026-10-01');
    expect(updateRes.body.data.goal).toBe('Zonenverteidigung');
  });
});

describe('Items: CRUD, Ownership, Limit, Reorder, Cascade', () => {
  // Eigener Nutzer statt `owner`, da `owner` in den Tests oben bereits
  // sein MAX_SESSIONS=20-Kontingent ausgeschöpft hat.
  let itemsUser;
  let itemsUserBoardId;
  let sessionId;
  let itemAId;
  let itemBId;

  beforeAll(async () => {
    itemsUser = await registerAndLogin('items');
    itemsUserBoardId = await createBoard(itemsUser.cookie, 'Passübung');

    const res = await request(app)
      .post('/api/trainings')
      .set('Cookie', itemsUser.cookie)
      .send({ name: 'Items-Session' });
    sessionId = res.body.data._id;
  });

  it('fügt ein eigenes Board als Übung hinzu', async () => {
    const res = await request(app)
      .post(`/api/trainings/${sessionId}/items`)
      .set('Cookie', itemsUser.cookie)
      .send({ boardId: itemsUserBoardId, durationMinutes: 20, note: 'Aufwärmen' });
    expect(res.status).toBe(201);
    expect(res.body.data.boardId).toBe(itemsUserBoardId);
    expect(res.body.data.boardName).toBe('Passübung');
    expect(res.body.data.durationMinutes).toBe(20);
    expect(res.body.data.order).toBe(0);
    itemAId = res.body.data._id;
  });

  it('lehnt das Hinzufügen eines fremden Boards mit 404 ab', async () => {
    const res = await request(app)
      .post(`/api/trainings/${sessionId}/items`)
      .set('Cookie', itemsUser.cookie)
      .send({ boardId: otherBoardId, durationMinutes: 10 });
    expect(res.status).toBe(404);
  });

  it('lehnt das Hinzufügen zu einer fremden Session mit 404 ab', async () => {
    const res = await request(app)
      .post(`/api/trainings/${sessionId}/items`)
      .set('Cookie', other.cookie)
      .send({ boardId: otherBoardId, durationMinutes: 10 });
    expect(res.status).toBe(404);
  });

  it('fügt eine zweite Übung hinzu (order=1)', async () => {
    const res = await request(app)
      .post(`/api/trainings/${sessionId}/items`)
      .set('Cookie', itemsUser.cookie)
      .send({ boardId: itemsUserBoardId, durationMinutes: 15, note: 'Hauptteil' });
    expect(res.status).toBe(201);
    expect(res.body.data.order).toBe(1);
    itemBId = res.body.data._id;
  });

  it('zeigt die Session mit beiden Items inkl. Summen', async () => {
    const res = await request(app).get(`/api/trainings/${sessionId}`).set('Cookie', itemsUser.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.itemCount).toBe(2);
    expect(res.body.data.totalMinutes).toBe(35);
  });

  it('ändert Dauer/Notiz einer Übung', async () => {
    const res = await request(app)
      .put(`/api/trainings/${sessionId}/items/${itemAId}`)
      .set('Cookie', itemsUser.cookie)
      .send({ durationMinutes: 25 });
    expect(res.status).toBe(200);
    expect(res.body.data.durationMinutes).toBe(25);
  });

  it('vertauscht die Reihenfolge der beiden Items', async () => {
    const res = await request(app)
      .put(`/api/trainings/${sessionId}/items/reorder`)
      .set('Cookie', itemsUser.cookie)
      .send({ order: [itemBId, itemAId] });
    expect(res.status).toBe(200);
    expect(res.body.data[0]._id).toBe(itemBId);
    expect(res.body.data[0].order).toBe(0);
    expect(res.body.data[1]._id).toBe(itemAId);
    expect(res.body.data[1].order).toBe(1);
  });

  it('löscht eine Übung und normalisiert die Reihenfolge', async () => {
    const res = await request(app)
      .delete(`/api/trainings/${sessionId}/items/${itemBId}`)
      .set('Cookie', itemsUser.cookie);
    expect(res.status).toBe(200);

    const session = await request(app).get(`/api/trainings/${sessionId}`).set('Cookie', itemsUser.cookie);
    expect(session.body.data.items).toHaveLength(1);
    expect(session.body.data.items[0]._id).toBe(itemAId);
    expect(session.body.data.items[0].order).toBe(0);
  });

  it('lehnt eine 31. Übung mit 400 ab (Maximal 30 pro Session)', async () => {
    for (let i = 0; i < 29; i++) {
      const res = await request(app)
        .post(`/api/trainings/${sessionId}/items`)
        .set('Cookie', itemsUser.cookie)
        .send({ boardId: itemsUserBoardId, durationMinutes: 5 });
      expect(res.status).toBe(201);
    }
    const overLimit = await request(app)
      .post(`/api/trainings/${sessionId}/items`)
      .set('Cookie', itemsUser.cookie)
      .send({ boardId: itemsUserBoardId, durationMinutes: 5 });
    expect(overLimit.status).toBe(400);
  });

  it('löscht beim Löschen der Session auch alle Items (Cascade)', async () => {
    const del = await request(app).delete(`/api/trainings/${sessionId}`).set('Cookie', itemsUser.cookie);
    expect(del.status).toBe(200);

    const remaining = await pool.query(
      'SELECT COUNT(*)::int AS count FROM training_session_items WHERE session_id = $1',
      [sessionId]
    );
    expect(remaining.rows[0].count).toBe(0);
  });
});
