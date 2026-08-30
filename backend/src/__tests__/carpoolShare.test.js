/**
 * carpoolShare.test.js – öffentliche, tokenbasierte Fahrgemeinschafts-
 * Ansicht/Teilnahme (ISSUE 028). Vorbild share.test.js; zusätzlich der
 * Race-Condition-Test für den Überbuchungs-Schutz (SELECT ... FOR UPDATE
 * in carpoolShareController.claimSharedCarpoolSeat) – das ist der erste
 * anonyme SCHREIB-Pfad der App, entsprechend kritisch ist dieser Test.
 */
import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'carpool-share-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123', birthday: '1990-01-01' });
  return { email, cookie: res.headers['set-cookie'][0] };
}

let owner;
let teamId;
let gameId;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  owner = await registerAndLogin('owner');

  const teamRes = await request(app).post('/api/teams').set('Cookie', owner.cookie).send({ name: 'Carpool-Share-Test-Team' });
  teamId = teamRes.body.data._id;

  const gameRes = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Auswärtsgegner', teamId });
  gameId = gameRes.body.data._id;
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

async function createOffer(totalSeats = 3) {
  const res = await request(app)
    .post(`/api/games/${gameId}/carpools`)
    .set('Cookie', owner.cookie)
    .send({ meetingPoint: 'Vereinsheim, 14 Uhr', totalSeats });
  return res.body.data;
}

describe('GET /api/carpools/:token (öffentlich)', () => {
  it('lehnt einen ungültig formatierten Token mit 422 ab', async () => {
    const res = await request(app).get('/api/carpools/nicht-uuid');
    expect(res.status).toBe(422);
  });

  it('lehnt einen erfundenen (aber wohlgeformten) Token mit 404 ab', async () => {
    const res = await request(app).get('/api/carpools/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('liefert das Angebot ohne Cookie/Login und enthält NIE eine E-Mail-Adresse', async () => {
    const offer = await createOffer();
    const res = await request(app).get(`/api/carpools/${offer.shareToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.meetingPoint).toBe('Vereinsheim, 14 Uhr');
    expect(res.body.data.freeSeats).toBe(3);
    expect(JSON.stringify(res.body.data)).not.toMatch(/@/); // keine E-Mail-Adresse irgendwo in der Response
  });
});

describe('POST /api/carpools/:token/claims (öffentlich)', () => {
  it('lehnt einen fehlenden Namen mit 422 ab', async () => {
    const offer = await createOffer();
    const res = await request(app).post(`/api/carpools/${offer.shareToken}/claims`).send({});
    expect(res.status).toBe(422);
  });

  it('erlaubt einen anonymen Claim und liefert einen cancelToken', async () => {
    const offer = await createOffer();
    const res = await request(app).post(`/api/carpools/${offer.shareToken}/claims`).send({ claimantName: 'Frau Müller (Mutter von Lena)' });
    expect(res.status).toBe(201);
    expect(res.body.data.claimId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.data.cancelToken).toMatch(/^[0-9a-f-]{36}$/);

    const viewRes = await request(app).get(`/api/carpools/${offer.shareToken}`);
    expect(viewRes.body.data.freeSeats).toBe(2);
    expect(viewRes.body.data.riders).toEqual([{ name: 'Frau Müller (Mutter von Lena)' }]);
  });

  it('lehnt einen Claim bei vollem Angebot mit 400 ab', async () => {
    const offer = await createOffer(1);
    const first = await request(app).post(`/api/carpools/${offer.shareToken}/claims`).send({ claimantName: 'Erster' });
    expect(first.status).toBe(201);

    const second = await request(app).post(`/api/carpools/${offer.shareToken}/claims`).send({ claimantName: 'Zweiter' });
    expect(second.status).toBe(400);
  });

  it('verhindert Überbuchung unter Nebenläufigkeit (SELECT ... FOR UPDATE)', async () => {
    const offer = await createOffer(1);
    const attempts = Array.from({ length: 10 }, (_, i) =>
      request(app).post(`/api/carpools/${offer.shareToken}/claims`).send({ claimantName: `Person ${i}` }));
    const results = await Promise.all(attempts);

    const successes = results.filter((r) => r.status === 201);
    const rejections = results.filter((r) => r.status === 400);
    expect(successes).toHaveLength(1);
    expect(rejections).toHaveLength(9);

    const dbCheck = await pool.query(
      'SELECT COUNT(*)::int AS count FROM carpool_claims WHERE offer_id = (SELECT id FROM carpool_offers WHERE share_token = $1)',
      [offer.shareToken]
    );
    expect(dbCheck.rows[0].count).toBe(1);
  });
});

describe('DELETE /api/carpools/:token/claims/:claimId (öffentlich)', () => {
  it('lehnt einen falschen/fehlenden cancelToken mit 403 ab, Claim bleibt bestehen', async () => {
    const offer = await createOffer();
    const claimRes = await request(app).post(`/api/carpools/${offer.shareToken}/claims`).send({ claimantName: 'Herr Schmidt' });
    const { claimId } = claimRes.body.data;

    const wrongRes = await request(app)
      .delete(`/api/carpools/${offer.shareToken}/claims/${claimId}`)
      .send({ cancelToken: '00000000-0000-0000-0000-000000000000' });
    expect(wrongRes.status).toBe(403);

    const viewRes = await request(app).get(`/api/carpools/${offer.shareToken}`);
    expect(viewRes.body.data.freeSeats).toBe(2);
  });

  it('erfolgreiches Zurückziehen mit korrektem cancelToken gibt den Platz wieder frei', async () => {
    const offer = await createOffer();
    const claimRes = await request(app).post(`/api/carpools/${offer.shareToken}/claims`).send({ claimantName: 'Herr Schmidt' });
    const { claimId, cancelToken } = claimRes.body.data;

    const delRes = await request(app).delete(`/api/carpools/${offer.shareToken}/claims/${claimId}`).send({ cancelToken });
    expect(delRes.status).toBe(200);

    const viewRes = await request(app).get(`/api/carpools/${offer.shareToken}`);
    expect(viewRes.body.data.freeSeats).toBe(3);
  });

  it('lehnt einen claimId ab, der zu einem ANDEREN Angebot gehört, auch mit dessen korrektem cancelToken', async () => {
    const offerA = await createOffer();
    const offerB = await createOffer();
    const claimOnB = await request(app).post(`/api/carpools/${offerB.shareToken}/claims`).send({ claimantName: 'Cross-Offer-Test' });

    const crossRes = await request(app)
      .delete(`/api/carpools/${offerA.shareToken}/claims/${claimOnB.body.data.claimId}`)
      .send({ cancelToken: claimOnB.body.data.cancelToken });
    expect([403, 404]).toContain(crossRes.status);
  });
});
