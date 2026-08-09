/**
 * rsvps.test.js – RSVP/Anwesenheit für Spiele und Trainingseinheiten
 * (Roadmap-Audit). Beide Mountpunkte (/api/games/:id/rsvps,
 * /api/trainings/:id/rsvps) teilen denselben Handler-Code
 * (makeRsvpHandlers), daher parametrisierter Test über beide Typen.
 */
import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'rsvp-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123' });
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

  const teamRes = await request(app).post('/api/teams').set('Cookie', owner.cookie).send({ name: 'RSVP-Test-Team' });
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
    createPersonal: (cookie) => request(app).post('/api/games').set('Cookie', cookie).send({ opponent: 'Solo-Gegner' }),
  },
  {
    label: 'Trainingseinheiten',
    basePath: '/api/trainings',
    createTeamShared: (cookie) => request(app).post('/api/trainings').set('Cookie', cookie).send({ name: 'Team-Training', teamId }),
    createPersonal: (cookie) => request(app).post('/api/trainings').set('Cookie', cookie).send({ name: 'Solo-Training' }),
  },
];

describe('RSVP – Aufräumen beim Löschen eines Accounts', () => {
  it('räumt RSVPs anderer Nutzer auf eigenen (gelöschten) Spielen/Trainings auf', async () => {
    const deletingOwner = await registerAndLogin('deleting-owner');
    const responder = await registerAndLogin('responder');

    const teamRes = await request(app).post('/api/teams').set('Cookie', deletingOwner.cookie).send({ name: 'Delete-Cleanup-Team' });
    const cleanupTeamId = teamRes.body.data._id;
    await request(app).post(`/api/teams/${cleanupTeamId}/members`).set('Cookie', deletingOwner.cookie).send({ email: responder.email, role: 'member' });

    const gameRes = await request(app).post('/api/games').set('Cookie', deletingOwner.cookie).send({ opponent: 'Cleanup-Gegner', teamId: cleanupTeamId });
    const gameId = gameRes.body.data._id;
    await request(app).put(`/api/games/${gameId}/rsvps/me`).set('Cookie', responder.cookie).send({ status: 'yes' });

    await request(app).delete('/api/user/account').set('Cookie', deletingOwner.cookie).send({ email: deletingOwner.email });

    const orphaned = await pool.query('SELECT id FROM rsvps WHERE resource_id = $1', [gameId]);
    expect(orphaned.rows).toHaveLength(0);
  });
});

for (const resource of RESOURCES) {
  describe(`RSVP – ${resource.label}`, () => {
    let resourceId;
    let personalResourceId;

    beforeAll(async () => {
      const res = await resource.createTeamShared(owner.cookie);
      resourceId = res.body.data._id;
      const personalRes = await resource.createPersonal(owner.cookie);
      personalResourceId = personalRes.body.data._id;
    });

    it('liefert [] für eine rein persönliche Ressource ohne team_id', async () => {
      const res = await request(app).get(`${resource.basePath}/${personalResourceId}/rsvps`).set('Cookie', owner.cookie);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('liefert die volle Team-Roster-Liste, initial mit status: null, inkl. Team-Rolle', async () => {
      const res = await request(app).get(`${resource.basePath}/${resourceId}/rsvps`).set('Cookie', owner.cookie);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data.every((r) => r.status === null)).toBe(true);
      expect(res.body.data.map((r) => r.email).sort()).toEqual([member.email, owner.email].sort());

      const ownerEntry = res.body.data.find((r) => r.email === owner.email);
      const memberEntry = res.body.data.find((r) => r.email === member.email);
      expect(ownerEntry.teamRole).toBe('owner');
      expect(memberEntry.teamRole).toBe('member');
    });

    it('ein member-Rang-Nutzer darf per PUT /me für sich selbst antworten (Antwort enthält die eigene Team-Rolle)', async () => {
      const res = await request(app)
        .put(`${resource.basePath}/${resourceId}/rsvps/me`)
        .set('Cookie', member.cookie)
        .send({ status: 'yes' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('yes');
      expect(res.body.data.email).toBe(member.email);
      expect(res.body.data.teamRole).toBe('member');
    });

    it('erneutes PUT /me überschreibt den Status (Upsert, kein Duplikat)', async () => {
      await request(app).put(`${resource.basePath}/${resourceId}/rsvps/me`).set('Cookie', member.cookie).send({ status: 'no', reason: 'Krank' });

      const res = await request(app).get(`${resource.basePath}/${resourceId}/rsvps`).set('Cookie', owner.cookie);
      const memberEntry = res.body.data.find((r) => r.email === member.email);
      expect(memberEntry.status).toBe('no');
      expect(memberEntry.reason).toBe('Krank');
      expect(res.body.data).toHaveLength(2);
    });

    it('lehnt einen ungültigen Status mit 422 ab', async () => {
      const res = await request(app)
        .put(`${resource.basePath}/${resourceId}/rsvps/me`)
        .set('Cookie', member.cookie)
        .send({ status: 'vielleicht-morgen' });
      expect(res.status).toBe(422);
    });

    it('verweigert einem Fremden (kein Team-Mitglied) GET und PUT /me mit 404', async () => {
      const getRes = await request(app).get(`${resource.basePath}/${resourceId}/rsvps`).set('Cookie', stranger.cookie);
      expect(getRes.status).toBe(404);

      const putRes = await request(app)
        .put(`${resource.basePath}/${resourceId}/rsvps/me`)
        .set('Cookie', stranger.cookie)
        .send({ status: 'yes' });
      expect(putRes.status).toBe(404);
    });

    it('löscht RSVPs mit, wenn die Ressource gelöscht wird', async () => {
      const delRes = await resource.createTeamShared(owner.cookie);
      const tempId = delRes.body.data._id;
      await request(app).put(`${resource.basePath}/${tempId}/rsvps/me`).set('Cookie', owner.cookie).send({ status: 'yes' });

      await request(app).delete(`${resource.basePath}/${tempId}`).set('Cookie', owner.cookie);

      const dbCheck = await pool.query('SELECT id FROM rsvps WHERE resource_id = $1', [tempId]);
      expect(dbCheck.rows).toHaveLength(0);
    });
  });
}
