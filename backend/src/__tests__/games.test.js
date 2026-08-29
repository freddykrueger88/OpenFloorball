/**
 * games.test.js – Live-Spielnotizen: das Spiel selbst (CRUD,
 * Eigentümerschaft, Limit) sowie die Notizen, die über die bestehende
 * comments-Tabelle mit resource_type='game' laufen (siehe
 * routes/index.js, gamesController.js). Team-Zugriffskontrolle wird
 * in teamSharing.test.js mitgetestet (gemeinsame Team-Fixtures).
 */
import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'games-test-';
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

describe('GET/POST /api/games', () => {
  it('liefert eine leere Liste für einen frischen Nutzer', async () => {
    const res = await request(app).get('/api/games').set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('lehnt nicht authentifizierte Anfragen mit 401 ab', async () => {
    const res = await request(app).get('/api/games');
    expect(res.status).toBe(401);
  });

  it('legt ein neues Spiel an', async () => {
    const res = await request(app)
      .post('/api/games')
      .set('Cookie', owner.cookie)
      .send({ opponent: 'SV Musterstadt', playedAt: '2026-09-20' });
    expect(res.status).toBe(201);
    expect(res.body.data.opponent).toBe('SV Musterstadt');
    expect(res.body.data.playedAt).toBe('2026-09-20');
    expect(res.body.data.teamId).toBeNull();
    // Verdrahtung zur strukturierten Gegner-Entität (opponentsController.js)
    // – die eigentliche Find-or-Create-Matrix steckt in opponents.test.js.
    expect(res.body.data.opponentId).toBeTruthy();
  });

  it('legt ein Spiel ohne Angaben mit sinnvollen Defaults an', async () => {
    const res = await request(app).post('/api/games').set('Cookie', owner.cookie).send({});
    expect(res.status).toBe(201);
    expect(res.body.data.opponent).toBe('');
    expect(res.body.data.playedAt).toBeNull();
  });

  it('lehnt ein ungültiges Datum mit 422 ab', async () => {
    const res = await request(app)
      .post('/api/games')
      .set('Cookie', owner.cookie)
      .send({ opponent: 'X', playedAt: 'kein-datum' });
    expect(res.status).toBe(422);
  });

  it('lehnt ein 31. Spiel mit 400 ab (Maximal 30)', async () => {
    for (let i = 0; i < 28; i++) {
      const res = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: `Gegner ${i}` });
      expect(res.status).toBe(201);
    }
    const overLimit = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Zu viel' });
    expect(overLimit.status).toBe(400);
  });
});

describe('Spiel CRUD + Ownership', () => {
  let gameId;

  beforeAll(async () => {
    const res = await request(app).post('/api/games').set('Cookie', other.cookie).send({ opponent: 'Fremdes Spiel' });
    gameId = res.body.data._id;
  });

  it('erlaubt dem Eigentümer, das Spiel zu ändern', async () => {
    const res = await request(app)
      .put(`/api/games/${gameId}`)
      .set('Cookie', other.cookie)
      .send({ opponent: 'Umbenannt', notes: 'Rückblick: gutes Pressing' });
    expect(res.status).toBe(200);
    expect(res.body.data.opponent).toBe('Umbenannt');
    expect(res.body.data.notes).toBe('Rückblick: gutes Pressing');
  });

  it('verweigert einem fremden User den Zugriff (GET) mit 404', async () => {
    const res = await request(app).get(`/api/games/${gameId}`).set('Cookie', owner.cookie);
    expect(res.status).toBe(404);
  });

  it('verweigert einem fremden User das Ändern (PUT) mit 404', async () => {
    const res = await request(app).put(`/api/games/${gameId}`).set('Cookie', owner.cookie).send({ opponent: 'Übernommen' });
    expect(res.status).toBe(404);
  });

  it('verweigert einem fremden User das Löschen (DELETE) mit 404', async () => {
    const res = await request(app).delete(`/api/games/${gameId}`).set('Cookie', owner.cookie);
    expect(res.status).toBe(404);
  });
});

describe('Live-Notizen (comments mit resource_type=game)', () => {
  let noteUser;
  let gameId;

  beforeAll(async () => {
    noteUser = await registerAndLogin('notes');
    const res = await request(app).post('/api/games').set('Cookie', noteUser.cookie).send({ opponent: 'Notiz-Testspiel' });
    gameId = res.body.data._id;
  });

  it('legt eine Notiz an und liefert sie zeitgestempelt zurück', async () => {
    const res = await request(app)
      .post(`/api/games/${gameId}/comments`)
      .set('Cookie', noteUser.cookie)
      .send({ text: 'Gegentor durch Konter' });
    expect(res.status).toBe(201);
    expect(res.body.data.text).toBe('Gegentor durch Konter');
    expect(res.body.data.createdAt).toBeTruthy();
  });

  it('listet alle Notizen eines Spiels', async () => {
    await request(app).post(`/api/games/${gameId}/comments`).set('Cookie', noteUser.cookie).send({ text: 'Auszeit genommen' });
    const res = await request(app).get(`/api/games/${gameId}/comments`).set('Cookie', noteUser.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('lehnt eine Notiz auf einem fremden Spiel mit 404 ab', async () => {
    const res = await request(app)
      .post(`/api/games/${gameId}/comments`)
      .set('Cookie', owner.cookie)
      .send({ text: 'Sollte nicht gehen' });
    expect(res.status).toBe(404);
  });

  it('löscht eine eigene Notiz', async () => {
    const createRes = await request(app).post(`/api/games/${gameId}/comments`).set('Cookie', noteUser.cookie).send({ text: 'Wird gelöscht' });
    const noteId = createRes.body.data._id;

    const delRes = await request(app).delete(`/api/games/${gameId}/comments/${noteId}`).set('Cookie', noteUser.cookie);
    expect(delRes.status).toBe(200);

    const listRes = await request(app).get(`/api/games/${gameId}/comments`).set('Cookie', noteUser.cookie);
    expect(listRes.body.data.find((n) => n._id === noteId)).toBeUndefined();
  });

  it('löscht beim Löschen des Spiels auch alle Notizen (kein DB-FK, manuelles Aufräumen)', async () => {
    const delRes = await request(app).delete(`/api/games/${gameId}`).set('Cookie', noteUser.cookie);
    expect(delRes.status).toBe(200);

    const remaining = await pool.query(
      `SELECT COUNT(*)::int AS count FROM comments WHERE resource_type = 'game' AND resource_id = $1`,
      [gameId]
    );
    expect(remaining.rows[0].count).toBe(0);
  });
});

describe('Spiel-Logistik + ownGoals/opponentGoals/result (Spieler-Dashboard-Ausbau)', () => {
  let logisticsUser;
  let gameId;

  beforeAll(async () => {
    logisticsUser = await registerAndLogin('logistics');
  });

  it('legt ein Spiel mit Anstoßzeit/Halle/Koordinaten/Heim-Kennzeichnung an', async () => {
    const res = await request(app)
      .post('/api/games')
      .set('Cookie', logisticsUser.cookie)
      .send({
        opponent: 'Floorball Lions', playedAt: '2026-09-20',
        kickoffTime: '18:30', venueName: 'Sporthalle Nord',
        venueAddress: 'Musterstraße 1, 12345 Musterstadt',
        venueLat: 52.52, venueLng: 13.405, isHome: true,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.kickoffTime).toBe('18:30');
    expect(res.body.data.venueName).toBe('Sporthalle Nord');
    expect(res.body.data.venueLat).toBe(52.52);
    expect(res.body.data.isHome).toBe(true);
    expect(res.body.data.status).toBe('scheduled');
    expect(res.body.data.ownGoals).toBe(0);
    expect(res.body.data.opponentGoals).toBe(0);
    expect(res.body.data.result).toBeNull();
    gameId = res.body.data._id;
  });

  it('lehnt eine ungültige Uhrzeit mit 422 ab', async () => {
    const res = await request(app)
      .post('/api/games')
      .set('Cookie', logisticsUser.cookie)
      .send({ opponent: 'X', kickoffTime: '18:30:00' });
    expect(res.status).toBe(422);
  });

  it('setzt den Status auf "postponed"', async () => {
    const res = await request(app)
      .put(`/api/games/${gameId}`)
      .set('Cookie', logisticsUser.cookie)
      .send({ status: 'postponed' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('postponed');
  });

  it('lehnt einen ungültigen Status mit 422 ab', async () => {
    const res = await request(app)
      .put(`/api/games/${gameId}`)
      .set('Cookie', logisticsUser.cookie)
      .send({ status: 'finished' });
    expect(res.status).toBe(422);
  });

  it('berechnet ownGoals/opponentGoals/result korrekt aus game_events', async () => {
    await request(app).post(`/api/games/${gameId}/events`).set('Cookie', logisticsUser.cookie)
      .send({ eventType: 'goal', isOpponent: false });
    await request(app).post(`/api/games/${gameId}/events`).set('Cookie', logisticsUser.cookie)
      .send({ eventType: 'goal', isOpponent: false });
    await request(app).post(`/api/games/${gameId}/events`).set('Cookie', logisticsUser.cookie)
      .send({ eventType: 'goal', isOpponent: true });

    const listRes = await request(app).get('/api/games').set('Cookie', logisticsUser.cookie);
    const game = listRes.body.data.find((g) => g._id === gameId);
    expect(game.ownGoals).toBe(2);
    expect(game.opponentGoals).toBe(1);
    expect(game.result).toBe('win');

    const singleRes = await request(app).get(`/api/games/${gameId}`).set('Cookie', logisticsUser.cookie);
    expect(singleRes.body.data.ownGoals).toBe(2);
    expect(singleRes.body.data.result).toBe('win');
  });
});
