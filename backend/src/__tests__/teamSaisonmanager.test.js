/**
 * teamSaisonmanager.test.js – Verwaltung der optionalen Saisonmanager-
 * Anbindung eines Teams (Spieler-Dashboard-Ausbau): nur Owner darf
 * setzen/lesen/trennen, `apiKey` taucht nie in einer Response auf, und ein
 * nicht erreichbarer Saisonmanager fällt sauber auf `null` zurück statt
 * den Request scheitern zu lassen.
 */
import './setup.js';
import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'sm-link-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123', birthday: '1990-01-01'});
  return { id: res.body.data.user.id, email, cookie: res.headers['set-cookie'][0] };
}

let owner;
let coach;
let member;
let teamId;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  owner = await registerAndLogin('owner');
  coach = await registerAndLogin('coach');
  member = await registerAndLogin('member');

  const teamResult = await pool.query(
    'INSERT INTO teams (name, created_by) VALUES ($1, $2) RETURNING id',
    ['SM-Link-Team', owner.id]
  );
  teamId = teamResult.rows[0].id;
  await pool.query(
    'INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3), ($1, $4, $5), ($1, $6, $7)',
    [teamId, owner.id, 'owner', coach.id, 'coach', member.id, 'member']
  );
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('GET/PUT/DELETE /api/teams/:id/saisonmanager', () => {
  it('zeigt "nicht verbunden", solange keine Verknüpfung existiert', async () => {
    const res = await request(app).get(`/api/teams/${teamId}/saisonmanager`).set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ connected: false });
  });

  it('verweigert Coach/Member den Zugriff auf die Verbindungsverwaltung (404)', async () => {
    const coachRes = await request(app).get(`/api/teams/${teamId}/saisonmanager`).set('Cookie', coach.cookie);
    expect(coachRes.status).toBe(404);
    const memberRes = await request(app).put(`/api/teams/${teamId}/saisonmanager`).set('Cookie', member.cookie)
      .send({ apiKey: 'x', leagueId: 1, smTeamId: 1 });
    expect(memberRes.status).toBe(404);
  });

  it('Owner setzt eine Verbindung, api_key taucht in keiner Response auf', async () => {
    const res = await request(app)
      .put(`/api/teams/${teamId}/saisonmanager`)
      .set('Cookie', owner.cookie)
      .send({ apiKey: 'super-secret-key', leagueId: 42, smTeamId: 111 });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ connected: true, leagueId: 42, smTeamId: 111 });
    expect(JSON.stringify(res.body)).not.toContain('super-secret-key');

    const statusRes = await request(app).get(`/api/teams/${teamId}/saisonmanager`).set('Cookie', owner.cookie);
    expect(statusRes.body.data).toEqual({ connected: true, leagueId: 42, smTeamId: 111 });
    expect(JSON.stringify(statusRes.body)).not.toContain('super-secret-key');

    const dbRow = await pool.query('SELECT api_key FROM team_saisonmanager_links WHERE team_id = $1', [teamId]);
    expect(dbRow.rows[0].api_key).toBe('super-secret-key');
  });

  it('lehnt eine zu kurze/leere API-Key-Angabe mit 422 ab', async () => {
    const res = await request(app)
      .put(`/api/teams/${teamId}/saisonmanager`)
      .set('Cookie', owner.cookie)
      .send({ apiKey: '', leagueId: 1, smTeamId: 1 });
    expect(res.status).toBe(422);
  });

  it('Owner trennt die Verbindung wieder', async () => {
    const res = await request(app).delete(`/api/teams/${teamId}/saisonmanager`).set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    const statusRes = await request(app).get(`/api/teams/${teamId}/saisonmanager`).set('Cookie', owner.cookie);
    expect(statusRes.body.data).toEqual({ connected: false });
  });
});

describe('GET /api/teams/:id/saisonmanager/next-match + /table', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it('liefert null, solange keine Verbindung besteht (kein Fehler)', async () => {
    const res = await request(app).get(`/api/teams/${teamId}/saisonmanager/next-match`).set('Cookie', member.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it('jedes Team-Mitglied darf next-match/table lesen, sobald verbunden ist', async () => {
    await request(app).put(`/api/teams/${teamId}/saisonmanager`).set('Cookie', owner.cookie)
      .send({ apiKey: 'k', leagueId: 1, smTeamId: 111 });

    global.fetch = jest.fn((url) => {
      if (url.includes('/schedule.json')) {
        return Promise.resolve({ ok: true, json: async () => [{ date: '2099-01-01', time: '18:00', home_team_name: 'SM-Link-Team', guest_team_name: 'Gegner', state: 'scheduled', arena_name: 'Halle' }] });
      }
      return Promise.resolve({ ok: true, json: async () => [{ team_id: 111, team_name: 'SM-Link-Team', position: 1, points: 10 }] });
    });

    const matchRes = await request(app).get(`/api/teams/${teamId}/saisonmanager/next-match`).set('Cookie', member.cookie);
    expect(matchRes.status).toBe(200);
    expect(matchRes.body.data.opponent).toBe('Gegner');

    const tableRes = await request(app).get(`/api/teams/${teamId}/saisonmanager/table`).set('Cookie', member.cookie);
    expect(tableRes.status).toBe(200);
    expect(tableRes.body.data.standings[0].isOwnTeam).toBe(true);
  });

  it('fällt bei nicht erreichbarem Saisonmanager sauber auf null zurück statt zu scheitern', async () => {
    // Eigener api_key, damit der modulweite Cache aus dem vorigen Test
    // (gleiche league_id/Pfad) hier keinen stillschweigend gecachten
    // Erfolgswert statt des simulierten Netzwerkfehlers liefert.
    await request(app).put(`/api/teams/${teamId}/saisonmanager`).set('Cookie', owner.cookie)
      .send({ apiKey: 'k-unreachable', leagueId: 1, smTeamId: 111 });
    global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed'));
    const res = await request(app).get(`/api/teams/${teamId}/saisonmanager/next-match`).set('Cookie', member.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it('verweigert einem Nicht-Team-Mitglied den Zugriff mit 404', async () => {
    const stranger = await registerAndLogin('stranger');
    const res = await request(app).get(`/api/teams/${teamId}/saisonmanager/next-match`).set('Cookie', stranger.cookie);
    expect(res.status).toBe(404);
  });
});

// Nutzer-Feedback (2026-08-31): Saisonmanager-Termine tauchten nirgends
// außerhalb der Dashboard-Karten auf (kein Kalender/keine Spiele-Seite),
// weil next-match/table nur live abriefen, nie in `games` speicherten.
// getNextMatch synct jetzt bei jedem Aufruf zusätzlich den vollständigen
// Spielplan in echte games-Zeilen (externalId=Saisonmanagers game_id).
describe('GET /api/teams/:id/saisonmanager/next-match – Spielplan-Sync in games', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  function mockSchedule(games) {
    global.fetch = jest.fn((url) => {
      if (url.includes('/schedule.json')) return Promise.resolve({ ok: true, json: async () => games });
      return Promise.resolve({ ok: true, json: async () => [] });
    });
  }

  it('legt eigene Spiele aus dem Spielplan als games-Zeilen an (externalSource=saisonmanager)', async () => {
    await request(app).put(`/api/teams/${teamId}/saisonmanager`).set('Cookie', owner.cookie)
      .send({ apiKey: 'sync-k-1', leagueId: 1, smTeamId: 111 });
    mockSchedule([
      { game_id: 9001, date: '2099-09-01', time: '18:00', home_team_id: 111, home_team_name: 'SM-Link-Team', guest_team_id: 222, guest_team_name: 'Sync-Gegner', arena_name: 'Sync-Halle', arena_address: 'Sync-Adresse' },
      { game_id: 9002, date: '2099-09-08', time: '19:00', home_team_id: 333, home_team_name: 'Anderer', guest_team_id: 111, guest_team_name: 'SM-Link-Team' },
    ]);

    const res = await request(app).get(`/api/teams/${teamId}/saisonmanager/next-match`).set('Cookie', member.cookie);
    expect(res.status).toBe(200);

    const rows = await pool.query(
      `SELECT opponent, played_at, venue_name, is_home, status, external_id FROM games
       WHERE team_id = $1 AND external_source = 'saisonmanager' ORDER BY external_id`,
      [teamId]
    );
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows[0]).toEqual(expect.objectContaining({
      opponent: 'Sync-Gegner', venue_name: 'Sync-Halle', is_home: true, status: 'scheduled', external_id: '9001',
    }));
    expect(rows.rows[1]).toEqual(expect.objectContaining({ opponent: 'Anderer', is_home: false, external_id: '9002' }));
  });

  it('überschreibt bei erneutem Sync (Saisonmanager hat immer Vorrang vor manuellen Änderungen)', async () => {
    await request(app).put(`/api/teams/${teamId}/saisonmanager`).set('Cookie', owner.cookie)
      .send({ apiKey: 'sync-k-2', leagueId: 1, smTeamId: 111 });
    mockSchedule([
      { game_id: 9101, date: '2099-10-01', home_team_id: 111, home_team_name: 'SM-Link-Team', guest_team_id: 222, guest_team_name: 'Erster Stand', arena_name: 'Halle 1' },
    ]);
    await request(app).get(`/api/teams/${teamId}/saisonmanager/next-match`).set('Cookie', member.cookie);

    // Manuelle Korrektur simulieren, wie ein Coach sie machen könnte
    const before = await pool.query(`SELECT id FROM games WHERE team_id = $1 AND external_id = '9101'`, [teamId]);
    await pool.query(`UPDATE games SET opponent = 'Manuell geändert' WHERE id = $1`, [before.rows[0].id]);

    // Erneuter Sync mit aktualisiertem Spielplan – muss die manuelle
    // Änderung überschreiben, nicht respektieren (Nutzer-Entscheidung).
    // Eigener api_key wie bei den bestehenden Tests oben: sonst liefert der
    // modulweite 5-Minuten-Cache in saisonmanagerClient.js für denselben
    // Pfad weiterhin die erste Mock-Antwort statt der hier neuen.
    await request(app).put(`/api/teams/${teamId}/saisonmanager`).set('Cookie', owner.cookie)
      .send({ apiKey: 'sync-k-2b', leagueId: 1, smTeamId: 111 });
    mockSchedule([
      { game_id: 9101, date: '2099-10-02', home_team_id: 111, home_team_name: 'SM-Link-Team', guest_team_id: 222, guest_team_name: 'Verlegt und korrigiert', arena_name: 'Halle 2' },
    ]);
    await request(app).get(`/api/teams/${teamId}/saisonmanager/next-match`).set('Cookie', member.cookie);

    const after = await pool.query(`SELECT opponent, venue_name FROM games WHERE id = $1`, [before.rows[0].id]);
    expect(after.rows[0].opponent).toBe('Verlegt und korrigiert');
    expect(after.rows[0].venue_name).toBe('Halle 2');
  });

  it('markiert ein per notice_type="Canceled" abgesagtes Spiel als status=cancelled', async () => {
    await request(app).put(`/api/teams/${teamId}/saisonmanager`).set('Cookie', owner.cookie)
      .send({ apiKey: 'sync-k-3', leagueId: 1, smTeamId: 111 });
    mockSchedule([
      { game_id: 9201, date: '2099-11-01', home_team_id: 111, home_team_name: 'SM-Link-Team', guest_team_id: 222, guest_team_name: 'Abgesagt', notice_type: 'Canceled' },
    ]);
    await request(app).get(`/api/teams/${teamId}/saisonmanager/next-match`).set('Cookie', member.cookie);

    const row = await pool.query(`SELECT status FROM games WHERE team_id = $1 AND external_id = '9201'`, [teamId]);
    expect(row.rows[0].status).toBe('cancelled');
  });

  it('lässt manuell angelegte Spiele (kein external_source) beim Sync unangetastet', async () => {
    const manual = await pool.query(
      `INSERT INTO games (user_id, team_id, opponent) VALUES ($1, $2, 'Manuelles Spiel') RETURNING id, opponent`,
      [owner.id, teamId]
    );
    await request(app).put(`/api/teams/${teamId}/saisonmanager`).set('Cookie', owner.cookie)
      .send({ apiKey: 'sync-k-4', leagueId: 1, smTeamId: 111 });
    mockSchedule([
      { game_id: 9301, date: '2099-12-01', home_team_id: 111, home_team_name: 'SM-Link-Team', guest_team_id: 222, guest_team_name: 'Sync-Spiel' },
    ]);
    await request(app).get(`/api/teams/${teamId}/saisonmanager/next-match`).set('Cookie', member.cookie);

    const stillThere = await pool.query(`SELECT opponent, external_source FROM games WHERE id = $1`, [manual.rows[0].id]);
    expect(stillThere.rows[0].opponent).toBe('Manuelles Spiel');
    expect(stillThere.rows[0].external_source).toBeNull();
  });

});
