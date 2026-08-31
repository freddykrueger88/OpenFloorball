/**
 * carpools.test.js – Fahrgemeinschaften für Spiele und Trainingseinheiten
 * (ISSUE 028). Beide Mountpunkte (/api/games/:id/carpools,
 * /api/trainings/:id/carpools) teilen denselben Handler-Code
 * (makeCarpoolHandlers), daher parametrisierter Test über beide Typen,
 * analog rsvps.test.js.
 */
import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'carpool-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123', birthday: '1990-01-01' });
  return { email, cookie: res.headers['set-cookie'][0] };
}

let owner;
let member;
let stranger;
let teamId;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  owner = await registerAndLogin('owner');
  member = await registerAndLogin('member');
  stranger = await registerAndLogin('stranger');

  const teamRes = await request(app).post('/api/teams').set('Cookie', owner.cookie).send({ name: 'Carpool-Test-Team' });
  teamId = teamRes.body.data._id;
  await request(app).post(`/api/teams/${teamId}/members`).set('Cookie', owner.cookie).send({ email: member.email, role: 'member' });
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

const RESOURCES = [
  {
    label: 'Spiele',
    basePath: '/api/games',
    createTeamShared: (cookie) => request(app).post('/api/games').set('Cookie', cookie).send({ opponent: 'Gegner', teamId }),
  },
  {
    label: 'Trainingseinheiten',
    basePath: '/api/trainings',
    createTeamShared: (cookie) => request(app).post('/api/trainings').set('Cookie', cookie).send({ name: 'Team-Training', teamId }),
  },
];

describe('Fahrgemeinschaften – Aufräumen beim Löschen eines Accounts', () => {
  it('räumt Angebote anderer Nutzer auf eigenen (gelöschten) Spielen/Trainings auf', async () => {
    const deletingOwner = await registerAndLogin('deleting-owner');
    const offerer = await registerAndLogin('offerer');

    const teamRes = await request(app).post('/api/teams').set('Cookie', deletingOwner.cookie).send({ name: 'Delete-Cleanup-Team' });
    const cleanupTeamId = teamRes.body.data._id;
    await request(app).post(`/api/teams/${cleanupTeamId}/members`).set('Cookie', deletingOwner.cookie).send({ email: offerer.email, role: 'member' });

    const gameRes = await request(app).post('/api/games').set('Cookie', deletingOwner.cookie).send({ opponent: 'Cleanup-Gegner', teamId: cleanupTeamId });
    const gameId = gameRes.body.data._id;
    await request(app).post(`/api/games/${gameId}/carpools`).set('Cookie', offerer.cookie).send({ meetingPoint: 'Vereinsheim', totalSeats: 3 });

    await request(app).delete('/api/user/account').set('Cookie', deletingOwner.cookie).send({ email: deletingOwner.email });

    const orphaned = await pool.query('SELECT id FROM carpool_offers WHERE resource_id = $1', [gameId]);
    expect(orphaned.rows).toHaveLength(0);
  });
});

for (const resource of RESOURCES) {
  describe(`Fahrgemeinschaften – ${resource.label}`, () => {
    let resourceId;

    beforeEach(async () => {
      const res = await resource.createTeamShared(owner.cookie);
      resourceId = res.body.data._id;
    });

    it('verweigert einem Fremden (kein Team-Mitglied) GET/POST mit 404', async () => {
      const getRes = await request(app).get(`${resource.basePath}/${resourceId}/carpools`).set('Cookie', stranger.cookie);
      expect(getRes.status).toBe(404);

      const postRes = await request(app)
        .post(`${resource.basePath}/${resourceId}/carpools`)
        .set('Cookie', stranger.cookie)
        .send({ meetingPoint: 'Irgendwo', totalSeats: 2 });
      expect(postRes.status).toBe(404);
    });

    it('ein member-Rang-Nutzer darf ein Angebot anlegen (assertRead-only-Gate, wie RSVP)', async () => {
      const res = await request(app)
        .post(`${resource.basePath}/${resourceId}/carpools`)
        .set('Cookie', member.cookie)
        .send({ meetingPoint: 'Vereinsheim, 14 Uhr', totalSeats: 3, note: 'Kombi, viel Platz' });
      expect(res.status).toBe(201);
      expect(res.body.data.meetingPoint).toBe('Vereinsheim, 14 Uhr');
      expect(res.body.data.totalSeats).toBe(3);
      expect(res.body.data.claims).toEqual([]);
      expect(res.body.data.shareToken).toBeTruthy();
      // ISSUE 030: Anbieter-Name (E-Mail, wie bei Claims) muss bereits in
      // der POST-Antwort mitgeliefert werden, kein zweiter Roundtrip nötig.
      expect(res.body.data.offererName).toBe(member.email);
    });

    it('lehnt ein Angebot mit ungültiger Platzzahl mit 422 ab', async () => {
      const res = await request(app)
        .post(`${resource.basePath}/${resourceId}/carpools`)
        .set('Cookie', owner.cookie)
        .send({ meetingPoint: 'Vereinsheim', totalSeats: 0 });
      expect(res.status).toBe(422);
    });

    it('Claim reduziert freie Plätze im folgenden GET, voller claim wird abgelehnt', async () => {
      const offerRes = await request(app)
        .post(`${resource.basePath}/${resourceId}/carpools`)
        .set('Cookie', owner.cookie)
        .send({ meetingPoint: 'Vereinsheim', totalSeats: 1 });
      const offerId = offerRes.body.data._id;

      const claimRes = await request(app)
        .post(`${resource.basePath}/${resourceId}/carpools/${offerId}/claims`)
        .set('Cookie', member.cookie);
      expect(claimRes.status).toBe(201);

      const getRes = await request(app).get(`${resource.basePath}/${resourceId}/carpools`).set('Cookie', owner.cookie);
      const offer = getRes.body.data.find((o) => o._id === offerId);
      // ISSUE 030: der Anbieter-Name muss auch im GET (nicht nur direkt nach
      // dem POST) mitkommen – hier über den JOIN in fetchOffersForResource.
      expect(offer.offererName).toBe(owner.email);
      expect(offer.claims).toHaveLength(1);
      expect(offer.claims[0].userId).toBeTruthy();
      // Für authentifizierte Claims dient die E-Mail als Anzeigename (wie
      // beim RSVP-Roster) – nur anonyme Token-Claims haben claimant_name.
      expect(offer.claims[0].claimantName).toBe(member.email);

      const secondClaimant = await registerAndLogin('second-claimant');
      await request(app).post(`/api/teams/${teamId}/members`).set('Cookie', owner.cookie).send({ email: secondClaimant.email, role: 'member' });
      const fullRes = await request(app)
        .post(`${resource.basePath}/${resourceId}/carpools/${offerId}/claims`)
        .set('Cookie', secondClaimant.cookie);
      expect(fullRes.status).toBe(400);
    });

    it('derselbe Nutzer kann nicht zweimal für dasselbe Angebot claimen (400, kein 500)', async () => {
      const offerRes = await request(app)
        .post(`${resource.basePath}/${resourceId}/carpools`)
        .set('Cookie', owner.cookie)
        .send({ meetingPoint: 'Vereinsheim', totalSeats: 5 });
      const offerId = offerRes.body.data._id;

      await request(app).post(`${resource.basePath}/${resourceId}/carpools/${offerId}/claims`).set('Cookie', member.cookie);
      const secondAttempt = await request(app).post(`${resource.basePath}/${resourceId}/carpools/${offerId}/claims`).set('Cookie', member.cookie);
      expect(secondAttempt.status).toBe(400);
    });

    it('Angebots-Owner (auch als member-Rang) kann eigenes Angebot löschen', async () => {
      const offerRes = await request(app)
        .post(`${resource.basePath}/${resourceId}/carpools`)
        .set('Cookie', member.cookie)
        .send({ meetingPoint: 'Vereinsheim', totalSeats: 2 });
      const offerId = offerRes.body.data._id;

      const delRes = await request(app).delete(`${resource.basePath}/${resourceId}/carpools/${offerId}`).set('Cookie', member.cookie);
      expect(delRes.status).toBe(200);
    });

    it('ein anderes member-Rang-Mitglied ohne Schreibrecht kann ein fremdes Angebot NICHT löschen', async () => {
      const offerRes = await request(app)
        .post(`${resource.basePath}/${resourceId}/carpools`)
        .set('Cookie', owner.cookie)
        .send({ meetingPoint: 'Vereinsheim', totalSeats: 2 });
      const offerId = offerRes.body.data._id;

      const delRes = await request(app).delete(`${resource.basePath}/${resourceId}/carpools/${offerId}`).set('Cookie', member.cookie);
      expect(delRes.status).toBe(403);
    });

    it('der Team-Owner (Schreibrecht) kann ein fremdes Angebot löschen (Moderation)', async () => {
      const offerRes = await request(app)
        .post(`${resource.basePath}/${resourceId}/carpools`)
        .set('Cookie', member.cookie)
        .send({ meetingPoint: 'Vereinsheim', totalSeats: 2 });
      const offerId = offerRes.body.data._id;

      const delRes = await request(app).delete(`${resource.basePath}/${resourceId}/carpools/${offerId}`).set('Cookie', owner.cookie);
      expect(delRes.status).toBe(200);
    });

    it('ein eigener Claim kann wieder zurückgezogen werden', async () => {
      const offerRes = await request(app)
        .post(`${resource.basePath}/${resourceId}/carpools`)
        .set('Cookie', owner.cookie)
        .send({ meetingPoint: 'Vereinsheim', totalSeats: 2 });
      const offerId = offerRes.body.data._id;
      const claimRes = await request(app).post(`${resource.basePath}/${resourceId}/carpools/${offerId}/claims`).set('Cookie', member.cookie);
      const claimId = claimRes.body.data._id;

      const delRes = await request(app).delete(`${resource.basePath}/${resourceId}/carpools/${offerId}/claims/${claimId}`).set('Cookie', member.cookie);
      expect(delRes.status).toBe(200);

      const getRes = await request(app).get(`${resource.basePath}/${resourceId}/carpools`).set('Cookie', owner.cookie);
      const offer = getRes.body.data.find((o) => o._id === offerId);
      expect(offer.claims).toHaveLength(0);
    });

    it('löscht Angebote (und per CASCADE Claims) mit, wenn die Ressource gelöscht wird', async () => {
      const offerRes = await request(app)
        .post(`${resource.basePath}/${resourceId}/carpools`)
        .set('Cookie', owner.cookie)
        .send({ meetingPoint: 'Vereinsheim', totalSeats: 2 });
      const offerId = offerRes.body.data._id;
      await request(app).post(`${resource.basePath}/${resourceId}/carpools/${offerId}/claims`).set('Cookie', member.cookie);

      await request(app).delete(`${resource.basePath}/${resourceId}`).set('Cookie', owner.cookie);

      const offerCheck = await pool.query('SELECT id FROM carpool_offers WHERE id = $1', [offerId]);
      expect(offerCheck.rows).toHaveLength(0);
      const claimCheck = await pool.query('SELECT id FROM carpool_claims WHERE offer_id = $1', [offerId]);
      expect(claimCheck.rows).toHaveLength(0);
    });
  });
}
