/**
 * lines.test.js – Lines: taktische Zusammenstellungen echter Kader-Spieler
 * (fachlicher Umbau). Kern-Szenarien aus dem Auftrag: ein Spieler darf in
 * beliebig vielen Lines stehen, Entfernen aus einer Line lässt andere
 * unberührt, Line/Spieler löschen räumt nur die jeweils eigene Seite auf.
 * Team-Zugriffskontrolle wird in teamSharing.test.js mitgetestet.
 */
import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'lines-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123' });
  return { email, cookie: res.headers['set-cookie'][0] };
}

async function createRosterPlayer(cookie, name, jerseyNumber = null, role = null) {
  const res = await request(app).post('/api/roster').set('Cookie', cookie).send({ name, jerseyNumber, role });
  return res.body.data._id;
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

describe('GET/POST /api/lines', () => {
  it('liefert eine leere Liste für einen frischen Nutzer', async () => {
    const res = await request(app).get('/api/lines').set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('lehnt nicht authentifizierte Anfragen mit 401 ab', async () => {
    const res = await request(app).get('/api/lines');
    expect(res.status).toBe(401);
  });

  it('legt eine neue Line ohne Spieler an', async () => {
    const res = await request(app)
      .post('/api/lines')
      .set('Cookie', owner.cookie)
      .send({ name: 'Sturm 1', color: '#3b82f6', type: 'offense' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Sturm 1');
    expect(res.body.data.color).toBe('#3b82f6');
    expect(res.body.data.type).toBe('offense');
    expect(res.body.data.isActive).toBe(false);
    expect(res.body.data.players).toEqual([]);
  });

  it('nutzt Standardwerte für Farbe/Typ, wenn nicht angegeben', async () => {
    const res = await request(app).post('/api/lines').set('Cookie', owner.cookie).send({ name: 'Ohne Farbe' });
    expect(res.status).toBe(201);
    expect(res.body.data.color).toBe('#3B82F6');
    expect(res.body.data.type).toBe('offense');
  });

  it('lehnt eine Line ohne Namen mit 422 ab', async () => {
    const res = await request(app).post('/api/lines').set('Cookie', owner.cookie).send({});
    expect(res.status).toBe(422);
  });

  it('lehnt eine 21. Line mit 400 ab (Maximal 20)', async () => {
    for (let i = 0; i < 18; i++) {
      const res = await request(app).post('/api/lines').set('Cookie', owner.cookie).send({ name: `Line ${i}` });
      expect(res.status).toBe(201);
    }
    const overLimit = await request(app).post('/api/lines').set('Cookie', owner.cookie).send({ name: 'Zu viel' });
    expect(overLimit.status).toBe(400);
  });
});

describe('Line CRUD + Ownership', () => {
  let lineId;

  beforeAll(async () => {
    const res = await request(app).post('/api/lines').set('Cookie', other.cookie).send({ name: 'Fremde Line' });
    lineId = res.body.data._id;
  });

  it('erlaubt dem Eigentümer, die Line zu ändern', async () => {
    const res = await request(app).put(`/api/lines/${lineId}`).set('Cookie', other.cookie).send({ name: 'Umbenannt' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Umbenannt');
  });

  it('verweigert einem fremden User den Zugriff (GET-Liste enthält sie nicht)', async () => {
    const res = await request(app).get('/api/lines').set('Cookie', owner.cookie);
    expect(res.body.data.find((l) => l._id === lineId)).toBeUndefined();
  });

  it('verweigert einem fremden User das Ändern (PUT) mit 404', async () => {
    const res = await request(app).put(`/api/lines/${lineId}`).set('Cookie', owner.cookie).send({ name: 'x' });
    expect(res.status).toBe(404);
  });

  it('verweigert einem fremden User das Löschen (DELETE) mit 404', async () => {
    const res = await request(app).delete(`/api/lines/${lineId}`).set('Cookie', owner.cookie);
    expect(res.status).toBe(404);
  });
});

describe('Spieler-Zuordnung (many-to-many, Kern-Szenario aus dem Auftrag)', () => {
  let squadUser;
  let playerA, playerB, playerC;
  let line1, line2, line3;

  beforeAll(async () => {
    squadUser = await registerAndLogin('squad');
    playerA = await createRosterPlayer(squadUser.cookie, 'Max', 10, 'C');
    playerB = await createRosterPlayer(squadUser.cookie, 'Peter', 23, 'V');
    playerC = await createRosterPlayer(squadUser.cookie, 'Tom', 14, 'S');

    line1 = (await request(app).post('/api/lines').set('Cookie', squadUser.cookie).send({ name: 'Line 1' })).body.data._id;
    line2 = (await request(app).post('/api/lines').set('Cookie', squadUser.cookie).send({ name: 'Line 2' })).body.data._id;
    line3 = (await request(app).post('/api/lines').set('Cookie', squadUser.cookie).send({ name: 'Line 3' })).body.data._id;
  });

  it('fügt Spieler A zu Line 1 hinzu', async () => {
    const res = await request(app)
      .post(`/api/lines/${line1}/players`)
      .set('Cookie', squadUser.cookie)
      .send({ rosterPlayerId: playerA });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Max');
  });

  it('derselbe Spieler A kann ZUSÄTZLICH zu Line 2 hinzugefügt werden (Kern-Anforderung)', async () => {
    const res = await request(app)
      .post(`/api/lines/${line2}/players`)
      .set('Cookie', squadUser.cookie)
      .send({ rosterPlayerId: playerA });
    expect(res.status).toBe(201);

    const line1Res = await request(app).get('/api/lines').set('Cookie', squadUser.cookie);
    const l1 = line1Res.body.data.find((l) => l._id === line1);
    const l2 = line1Res.body.data.find((l) => l._id === line2);
    expect(l1.players.map((p) => p.name)).toContain('Max');
    expect(l2.players.map((p) => p.name)).toContain('Max');
  });

  it('lehnt einen doppelten Eintrag desselben Spielers in derselben Line mit 400 ab', async () => {
    const res = await request(app)
      .post(`/api/lines/${line1}/players`)
      .set('Cookie', squadUser.cookie)
      .send({ rosterPlayerId: playerA });
    expect(res.status).toBe(400);
  });

  it('baut die im Auftrag beschriebene Beispiel-Konstellation korrekt auf (Tom in 3 Lines, Peter in Line1+3)', async () => {
    await request(app).post(`/api/lines/${line1}/players`).set('Cookie', squadUser.cookie).send({ rosterPlayerId: playerB });
    await request(app).post(`/api/lines/${line1}/players`).set('Cookie', squadUser.cookie).send({ rosterPlayerId: playerC });
    await request(app).post(`/api/lines/${line2}/players`).set('Cookie', squadUser.cookie).send({ rosterPlayerId: playerC });
    await request(app).post(`/api/lines/${line3}/players`).set('Cookie', squadUser.cookie).send({ rosterPlayerId: playerB });
    await request(app).post(`/api/lines/${line3}/players`).set('Cookie', squadUser.cookie).send({ rosterPlayerId: playerC });

    const res = await request(app).get('/api/lines').set('Cookie', squadUser.cookie);
    const byName = (id) => res.body.data.find((l) => l._id === id).players.map((p) => p.name).sort();
    expect(byName(line1)).toEqual(['Max', 'Peter', 'Tom']);
    expect(byName(line2)).toEqual(['Max', 'Tom']);
    expect(byName(line3)).toEqual(['Peter', 'Tom']);
  });

  it('entfernt Spieler A nur aus Line 1 – Line 2 bleibt unberührt', async () => {
    const res = await request(app)
      .delete(`/api/lines/${line1}/players/${playerA}`)
      .set('Cookie', squadUser.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.map((p) => p.name)).not.toContain('Max');

    const line2Res = await request(app).get('/api/lines').set('Cookie', squadUser.cookie);
    const l2 = line2Res.body.data.find((l) => l._id === line2);
    expect(l2.players.map((p) => p.name)).toContain('Max');
  });

  it('löscht Line 2 – Spieler (Max, Tom) bleiben im Kader erhalten', async () => {
    const res = await request(app).delete(`/api/lines/${line2}`).set('Cookie', squadUser.cookie);
    expect(res.status).toBe(200);

    const rosterRes = await request(app).get('/api/roster').set('Cookie', squadUser.cookie);
    expect(rosterRes.body.data.find((p) => p._id === playerA)).toBeTruthy();
    expect(rosterRes.body.data.find((p) => p._id === playerC)).toBeTruthy();

    // Line 2 selbst ist weg, Line 1/3 unberührt
    const linesRes = await request(app).get('/api/lines').set('Cookie', squadUser.cookie);
    expect(linesRes.body.data.find((l) => l._id === line2)).toBeUndefined();
    expect(linesRes.body.data.find((l) => l._id === line3).players).toHaveLength(2);
  });

  it('löscht Spieler C (Tom) – räumt seine Zuordnung in Line 1 UND Line 3 auf, ohne die Lines selbst zu löschen', async () => {
    const res = await request(app).delete(`/api/roster/${playerC}`).set('Cookie', squadUser.cookie);
    expect(res.status).toBe(200);

    const linesRes = await request(app).get('/api/lines').set('Cookie', squadUser.cookie);
    const l1 = linesRes.body.data.find((l) => l._id === line1);
    const l3 = linesRes.body.data.find((l) => l._id === line3);
    expect(l1).toBeTruthy();
    expect(l3).toBeTruthy();
    expect(l1.players.map((p) => p.name)).not.toContain('Tom');
    expect(l3.players.map((p) => p.name)).not.toContain('Tom');
    expect(l1.players.map((p) => p.name)).toContain('Peter');
  });

  it('lehnt das Hinzufügen eines fremden Kader-Spielers mit 400 ab', async () => {
    const strangerPlayer = await createRosterPlayer(other.cookie, 'Fremder Spieler');
    const res = await request(app)
      .post(`/api/lines/${line1}/players`)
      .set('Cookie', squadUser.cookie)
      .send({ rosterPlayerId: strangerPlayer });
    expect(res.status).toBe(400);
  });
});

describe('Aktive Line (Exklusivität)', () => {
  let activeUser;
  let lineA, lineB;

  beforeAll(async () => {
    activeUser = await registerAndLogin('active');
    lineA = (await request(app).post('/api/lines').set('Cookie', activeUser.cookie).send({ name: 'A' })).body.data._id;
    lineB = (await request(app).post('/api/lines').set('Cookie', activeUser.cookie).send({ name: 'B' })).body.data._id;
  });

  it('aktiviert Line A', async () => {
    const res = await request(app).put(`/api/lines/${lineA}/active`).set('Cookie', activeUser.cookie).send({ active: true });
    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(true);
  });

  it('aktiviert Line B – deaktiviert dabei automatisch Line A (nur eine aktive Line gleichzeitig)', async () => {
    const res = await request(app).put(`/api/lines/${lineB}/active`).set('Cookie', activeUser.cookie).send({ active: true });
    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(true);

    const listRes = await request(app).get('/api/lines').set('Cookie', activeUser.cookie);
    const a = listRes.body.data.find((l) => l._id === lineA);
    expect(a.isActive).toBe(false);
  });

  it('deaktiviert Line B explizit', async () => {
    const res = await request(app).put(`/api/lines/${lineB}/active`).set('Cookie', activeUser.cookie).send({ active: false });
    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
  });

  it('liefert 404 beim Aktivieren einer nicht existierenden Line', async () => {
    const res = await request(app)
      .put('/api/lines/00000000-0000-0000-0000-000000000000/active')
      .set('Cookie', activeUser.cookie)
      .send({ active: true });
    expect(res.status).toBe(404);
  });
});
