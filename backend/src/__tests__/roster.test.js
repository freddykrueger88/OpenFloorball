import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'roster-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123' });
  return { id: res.body.data.user.id, email, cookie: res.headers['set-cookie'][0] };
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

describe('GET /api/roster', () => {
  it('liefert eine leere Liste für einen frischen Nutzer', async () => {
    const res = await request(app).get('/api/roster').set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('lehnt nicht authentifizierte Anfragen mit 401 ab', async () => {
    const res = await request(app).get('/api/roster');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/roster/:id', () => {
  // Eigener Test-User statt owner/other, damit diese GET-Tests nicht
  // heimlich das Kader-Limit des Owners für den späteren
  // "41. Kader-Spieler"-Test verändern (der zählt auf einen exakten
  // Ausgangsstand von owner).
  let getOwner;
  let ownPlayerId;
  let teamPlayerId;
  let teamMember;
  let unrelated;
  let teamId;

  beforeAll(async () => {
    getOwner = await registerAndLogin('getowner');
    teamMember = await registerAndLogin('teammember');
    unrelated = await registerAndLogin('unrelated');

    const ownRes = await request(app)
      .post('/api/roster').set('Cookie', getOwner.cookie).send({ name: 'Eigener Spieler für GET' });
    ownPlayerId = ownRes.body.data._id;

    const teamResult = await pool.query(
      'INSERT INTO teams (name, created_by) VALUES ($1, $2) RETURNING id',
      ['Roster-GET-Team', getOwner.id]
    );
    teamId = teamResult.rows[0].id;
    await pool.query(
      'INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3), ($1, $4, $5)',
      [teamId, getOwner.id, 'owner', teamMember.id, 'member']
    );

    const teamPlayerRes = await request(app)
      .post('/api/roster').set('Cookie', getOwner.cookie)
      .send({ name: 'Team-Spieler', teamId });
    teamPlayerId = teamPlayerRes.body.data._id;
  });

  it('lehnt nicht authentifizierte Anfragen mit 401 ab', async () => {
    const res = await request(app).get(`/api/roster/${ownPlayerId}`);
    expect(res.status).toBe(401);
  });

  it('liefert den eigenen Kader-Spieler inkl. updatedAt', async () => {
    const res = await request(app).get(`/api/roster/${ownPlayerId}`).set('Cookie', getOwner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(ownPlayerId);
    expect(res.body.data.updatedAt).toBeTruthy();
  });

  it('verweigert einem unbeteiligten User den Zugriff mit 404', async () => {
    const res = await request(app).get(`/api/roster/${ownPlayerId}`).set('Cookie', unrelated.cookie);
    expect(res.status).toBe(404);
  });

  it('erlaubt einem einfachen Team-Mitglied das Lesen eines team-geteilten Spielers', async () => {
    const res = await request(app).get(`/api/roster/${teamPlayerId}`).set('Cookie', teamMember.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(teamPlayerId);
  });

  it('liefert 404 für eine nicht existierende ID', async () => {
    const res = await request(app)
      .get('/api/roster/00000000-0000-0000-0000-000000000000')
      .set('Cookie', owner.cookie);
    expect(res.status).toBe(404);
  });

  it('liefert 422 für eine ungültige ID', async () => {
    const res = await request(app).get('/api/roster/not-a-uuid').set('Cookie', owner.cookie);
    expect(res.status).toBe(422);
  });
});

describe('POST /api/roster', () => {
  it('legt einen neuen Kader-Spieler an', async () => {
    const res = await request(app)
      .post('/api/roster')
      .set('Cookie', owner.cookie)
      .send({ name: 'Max Mustermann', jerseyNumber: 7, role: 'S' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Max Mustermann');
    expect(res.body.data.jerseyNumber).toBe(7);
    expect(res.body.data.role).toBe('S');
    expect(res.body.data.updatedAt).toBeTruthy();
  });

  it('legt einen Kader-Spieler ohne Nummer/Position an', async () => {
    const res = await request(app)
      .post('/api/roster')
      .set('Cookie', owner.cookie)
      .send({ name: 'Ohne Details' });
    expect(res.status).toBe(201);
    expect(res.body.data.jerseyNumber).toBeNull();
    expect(res.body.data.role).toBeNull();
  });

  it('lehnt einen Kader-Spieler ohne Namen mit 422 ab', async () => {
    const res = await request(app).post('/api/roster').set('Cookie', owner.cookie).send({});
    expect(res.status).toBe(422);
  });

  it('lehnt eine ungültige Rückennummer mit 422 ab', async () => {
    const res = await request(app)
      .post('/api/roster')
      .set('Cookie', owner.cookie)
      .send({ name: 'Zu hohe Nummer', jerseyNumber: 150 });
    expect(res.status).toBe(422);
  });

  it('lehnt eine ungültige Position mit 422 ab', async () => {
    const res = await request(app)
      .post('/api/roster')
      .set('Cookie', owner.cookie)
      .send({ name: 'Falsche Position', role: 'X' });
    expect(res.status).toBe(422);
  });

  it('lehnt einen 41. Kader-Spieler mit 400 ab (Maximal 40)', async () => {
    for (let i = 0; i < 38; i++) {
      const res = await request(app)
        .post('/api/roster')
        .set('Cookie', owner.cookie)
        .send({ name: `Spieler ${i}` });
      expect(res.status).toBe(201);
    }
    const overLimit = await request(app)
      .post('/api/roster')
      .set('Cookie', owner.cookie)
      .send({ name: 'Zu viel' });
    expect(overLimit.status).toBe(400);
  });
});

describe('PUT/DELETE /api/roster/:id + Ownership', () => {
  let playerId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/roster')
      .set('Cookie', other.cookie)
      .send({ name: 'Fremder Spieler', jerseyNumber: 9 });
    playerId = res.body.data._id;
  });

  it('erlaubt dem Eigentümer, den Kader-Spieler zu ändern (updatedAt wechselt)', async () => {
    const before = await request(app).get(`/api/roster/${playerId}`).set('Cookie', other.cookie);
    const res = await request(app)
      .put(`/api/roster/${playerId}`)
      .set('Cookie', other.cookie)
      .send({ jerseyNumber: 11, role: 'C' });
    expect(res.status).toBe(200);
    expect(res.body.data.jerseyNumber).toBe(11);
    expect(res.body.data.role).toBe('C');
    expect(res.body.data.updatedAt).not.toBe(before.body.data.updatedAt);
  });

  it('verweigert einem fremden User das Ändern mit 404', async () => {
    const res = await request(app)
      .put(`/api/roster/${playerId}`)
      .set('Cookie', owner.cookie)
      .send({ name: 'Übernommen' });
    expect(res.status).toBe(404);
  });

  it('verweigert einem fremden User das Löschen mit 404', async () => {
    const res = await request(app).delete(`/api/roster/${playerId}`).set('Cookie', owner.cookie);
    expect(res.status).toBe(404);
  });

  it('erlaubt dem Eigentümer, den Kader-Spieler zu löschen', async () => {
    const res = await request(app).delete(`/api/roster/${playerId}`).set('Cookie', other.cookie);
    expect(res.status).toBe(200);
  });

  it('liefert 404 beim Löschen eines nicht existierenden Kader-Spielers', async () => {
    const res = await request(app)
      .delete('/api/roster/00000000-0000-0000-0000-000000000000')
      .set('Cookie', other.cookie);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/roster/me + linkedUserId (Spieler-Dashboard-Ausbau)', () => {
  let linkOwner;
  let player1;
  let player2;
  let stranger;
  let teamId;
  let teamPlayerId;
  let personalPlayerId;

  beforeAll(async () => {
    linkOwner = await registerAndLogin('linkowner');
    player1 = await registerAndLogin('player1');
    player2 = await registerAndLogin('player2');
    stranger = await registerAndLogin('linkstranger');

    const teamResult = await pool.query(
      'INSERT INTO teams (name, created_by) VALUES ($1, $2) RETURNING id',
      ['Link-Team', linkOwner.id]
    );
    teamId = teamResult.rows[0].id;
    await pool.query(
      'INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3), ($1, $4, $5)',
      [teamId, linkOwner.id, 'owner', player1.id, 'member']
    );

    const teamPlayerRes = await request(app)
      .post('/api/roster').set('Cookie', linkOwner.cookie)
      .send({ name: 'Verknüpfbarer Spieler', teamId });
    teamPlayerId = teamPlayerRes.body.data._id;

    const personalRes = await request(app)
      .post('/api/roster').set('Cookie', linkOwner.cookie)
      .send({ name: 'Persönlicher Spieler' });
    personalPlayerId = personalRes.body.data._id;
  });

  it('liefert null, solange kein Kader-Eintrag verknüpft ist', async () => {
    const res = await request(app).get('/api/roster/me').set('Cookie', player1.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it('lehnt Verknüpfung mit einem Nicht-Team-Mitglied mit 400 ab', async () => {
    const res = await request(app)
      .put(`/api/roster/${teamPlayerId}`)
      .set('Cookie', linkOwner.cookie)
      .send({ linkedUserId: stranger.id });
    expect(res.status).toBe(400);
  });

  it('lehnt Verknüpfung eines rein persönlichen (team-losen) Eintrags mit 400 ab', async () => {
    const res = await request(app)
      .put(`/api/roster/${personalPlayerId}`)
      .set('Cookie', linkOwner.cookie)
      .send({ linkedUserId: player1.id });
    expect(res.status).toBe(400);
  });

  it('Owner verknüpft ein Team-Mitglied mit dem Kader-Eintrag', async () => {
    const res = await request(app)
      .put(`/api/roster/${teamPlayerId}`)
      .set('Cookie', linkOwner.cookie)
      .send({ linkedUserId: player1.id });
    expect(res.status).toBe(200);
    expect(res.body.data.linkedUserId).toBe(player1.id);

    const meRes = await request(app).get('/api/roster/me').set('Cookie', player1.cookie);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data._id).toBe(teamPlayerId);
  });

  it('lehnt Verknüpfung desselben Users mit einem zweiten Kader-Eintrag mit 400 ab', async () => {
    const secondPlayerRes = await request(app)
      .post('/api/roster').set('Cookie', linkOwner.cookie)
      .send({ name: 'Zweiter Team-Spieler', teamId });
    const res = await request(app)
      .put(`/api/roster/${secondPlayerRes.body.data._id}`)
      .set('Cookie', linkOwner.cookie)
      .send({ linkedUserId: player1.id });
    expect(res.status).toBe(400);
  });

  it('löst die Verknüpfung mit linkedUserId: null wieder', async () => {
    const res = await request(app)
      .put(`/api/roster/${teamPlayerId}`)
      .set('Cookie', linkOwner.cookie)
      .send({ linkedUserId: null });
    expect(res.status).toBe(200);
    expect(res.body.data.linkedUserId).toBeNull();

    const meRes = await request(app).get('/api/roster/me').set('Cookie', player1.cookie);
    expect(meRes.body.data).toBeNull();
  });

  it('verweigert einem einfachen Team-Mitglied das Setzen der Verknüpfung (404, keine Coach/Owner-Rechte)', async () => {
    const res = await request(app)
      .put(`/api/roster/${teamPlayerId}`)
      .set('Cookie', player1.cookie)
      .send({ linkedUserId: player2.id });
    expect(res.status).toBe(404);
  });
});
