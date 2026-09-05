import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'formations-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'Testpass123', birthday: '1990-01-01'});
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

describe('GET /api/formations', () => {
  it('liefert eine leere Liste für einen frischen Nutzer', async () => {
    const res = await request(app).get('/api/formations').set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('lehnt nicht authentifizierte Anfragen mit 401 ab', async () => {
    const res = await request(app).get('/api/formations');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/formations', () => {
  it('legt eine neue Formations-Vorlage an', async () => {
    const res = await request(app)
      .post('/api/formations')
      .set('Cookie', owner.cookie)
      .send({
        name: 'Pressing 4-2',
        fieldType: 'large',
        players: [{ id: 'h1', role: 'TW', team: 'home', x: 2, y: 10 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Pressing 4-2');
    expect(res.body.data.fieldType).toBe('large');
    expect(res.body.data.players).toHaveLength(1);
  });

  it('nutzt "large" als Default-Feldtyp, wenn nicht angegeben', async () => {
    const res = await request(app)
      .post('/api/formations')
      .set('Cookie', owner.cookie)
      .send({ name: 'Ohne Feldtyp' });
    expect(res.status).toBe(201);
    expect(res.body.data.fieldType).toBe('large');
    expect(res.body.data.players).toEqual([]);
  });

  it('lehnt eine Vorlage ohne Namen mit 422 ab', async () => {
    const res = await request(app)
      .post('/api/formations')
      .set('Cookie', owner.cookie)
      .send({ fieldType: 'large' });
    expect(res.status).toBe(422);
  });

  it('lehnt einen ungültigen Feldtyp mit 422 ab', async () => {
    const res = await request(app)
      .post('/api/formations')
      .set('Cookie', owner.cookie)
      .send({ name: 'Bad Field', fieldType: 'riesenfeld' });
    expect(res.status).toBe(422);
  });

  it('lehnt eine 21. Vorlage mit 400 ab (Maximal 20 Vorlagen)', async () => {
    // 2 Vorlagen existieren bereits aus den Tests oben – 18 weitere bis
    // zum Limit auffüllen, dann die 21. testen.
    for (let i = 0; i < 18; i++) {
      const res = await request(app)
        .post('/api/formations')
        .set('Cookie', owner.cookie)
        .send({ name: `Vorlage ${i}` });
      expect(res.status).toBe(201);
    }
    const overLimit = await request(app)
      .post('/api/formations')
      .set('Cookie', owner.cookie)
      .send({ name: 'Zu viel' });
    expect(overLimit.status).toBe(400);
  }, 30000);
});

describe('Formationen Kategorien (CLAUDE.md 9.4-9.6 – Systeme)', () => {
  let catUser;
  let categorized;

  beforeAll(async () => {
    catUser = await registerAndLogin('cat');
    const res = await request(app)
      .post('/api/formations')
      .set('Cookie', catUser.cookie)
      .send({ name: 'Forechecking 2-1-2', category: 'forechecking', fieldType: 'large' });
    categorized = res.body.data;
  });

  it('speichert und liefert die Kategorie einer Vorlage', async () => {
    expect(categorized.category).toBe('forechecking');
    const list = await request(app).get('/api/formations').set('Cookie', catUser.cookie);
    const found = list.body.data.find((f) => f._id === categorized._id);
    expect(found.category).toBe('forechecking');
  });

  it('lässt eine Vorlage ohne Kategorie zu (Allgemein)', async () => {
    const res = await request(app)
      .post('/api/formations')
      .set('Cookie', catUser.cookie)
      .send({ name: 'Ohne Kategorie' });
    expect(res.status).toBe(201);
    expect(res.body.data.category).toBeNull();
  });

  it('lehnt eine unbekannte Kategorie mit 422 ab', async () => {
    const res = await request(app)
      .post('/api/formations')
      .set('Cookie', catUser.cookie)
      .send({ name: 'Falsche Kategorie', category: 'gegenpressing' });
    expect(res.status).toBe(422);
  });
});

describe('Formations ownership + DELETE', () => {
  let formationId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/formations')
      .set('Cookie', other.cookie)
      .send({ name: 'Fremde Vorlage', fieldType: 'small' });
    formationId = res.body.data._id;
  });

  it('listet nur eigene Vorlagen auf (keine fremden)', async () => {
    const res = await request(app).get('/api/formations').set('Cookie', owner.cookie);
    expect(res.body.data.some((f) => f._id === formationId)).toBe(false);
  });

  it('verweigert einem fremden User das Löschen mit 404', async () => {
    const res = await request(app)
      .delete(`/api/formations/${formationId}`)
      .set('Cookie', owner.cookie);
    expect(res.status).toBe(404);
  });

  it('erlaubt dem Eigentümer, die eigene Vorlage zu löschen', async () => {
    const res = await request(app)
      .delete(`/api/formations/${formationId}`)
      .set('Cookie', other.cookie);
    expect(res.status).toBe(200);

    const list = await request(app).get('/api/formations').set('Cookie', other.cookie);
    expect(list.body.data.some((f) => f._id === formationId)).toBe(false);
  });

  it('liefert 404 beim Löschen einer nicht existierenden Vorlage', async () => {
    const res = await request(app)
      .delete('/api/formations/00000000-0000-0000-0000-000000000000')
      .set('Cookie', owner.cookie);
    expect(res.status).toBe(404);
  });

  it('lehnt eine ungültige Vorlagen-ID mit 422 ab', async () => {
    const res = await request(app)
      .delete('/api/formations/not-a-uuid')
      .set('Cookie', owner.cookie);
    expect(res.status).toBe(422);
  });
});

describe('PUT /api/formations/:id', () => {
  let formationId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/formations')
      .set('Cookie', other.cookie)
      .send({ name: 'Alter Name', fieldType: 'small' });
    formationId = res.body.data._id;
  });

  it('benennt die eigene Vorlage um', async () => {
    const res = await request(app)
      .put(`/api/formations/${formationId}`)
      .set('Cookie', other.cookie)
      .send({ name: 'Neuer Name' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Neuer Name');
    expect(res.body.data.updatedAt).toBeDefined();
  });

  it('lehnt einen leeren Namen mit 422 ab', async () => {
    const res = await request(app)
      .put(`/api/formations/${formationId}`)
      .set('Cookie', other.cookie)
      .send({ name: '' });
    expect(res.status).toBe(422);
  });

  it('verweigert einem fremden User das Umbenennen mit 404', async () => {
    const res = await request(app)
      .put(`/api/formations/${formationId}`)
      .set('Cookie', owner.cookie)
      .send({ name: 'Sollte fehlschlagen' });
    expect(res.status).toBe(404);
  });

  it('liefert 404 beim Umbenennen einer nicht existierenden Vorlage', async () => {
    const res = await request(app)
      .put('/api/formations/00000000-0000-0000-0000-000000000000')
      .set('Cookie', other.cookie)
      .send({ name: 'Egal' });
    expect(res.status).toBe(404);
  });
});
