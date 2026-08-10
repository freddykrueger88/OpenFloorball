/**
 * organizations.test.js – Verein-Ebene als reine Verwaltungsebene über
 * mehreren Teams (ROADMAP Phase 2)
 */
import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'orgs-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123' });
  return { email, cookie: res.headers['set-cookie'][0] };
}

let admin;
let member;
let stranger;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  admin = await registerAndLogin('admin');
  member = await registerAndLogin('member');
  stranger = await registerAndLogin('stranger');
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('Verein anlegen und verwalten', () => {
  let orgId;

  it('Ersteller wird atomar als admin angelegt', async () => {
    const res = await request(app).post('/api/organizations').set('Cookie', admin.cookie).send({ name: 'Verein Musterstadt' });
    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('admin');
    orgId = res.body.data._id;
  });

  it('Fremder sieht den Verein nicht', async () => {
    const res = await request(app).get(`/api/organizations/${orgId}`).set('Cookie', stranger.cookie);
    expect(res.status).toBe(404);
  });

  it('admin lädt ein bestehendes Mitglied per E-Mail ein', async () => {
    const res = await request(app).post(`/api/organizations/${orgId}/members`).set('Cookie', admin.cookie).send({ email: member.email });
    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('member');
  });

  it('lehnt Einladung eines unbekannten Nutzers ab', async () => {
    const res = await request(app).post(`/api/organizations/${orgId}/members`).set('Cookie', admin.cookie).send({ email: 'unbekannt@example.com' });
    expect(res.status).toBe(404);
  });

  it('lehnt Doppel-Einladung ab', async () => {
    const res = await request(app).post(`/api/organizations/${orgId}/members`).set('Cookie', admin.cookie).send({ email: member.email });
    expect(res.status).toBe(400);
  });

  it('member (kein admin) darf niemanden einladen', async () => {
    const res = await request(app).post(`/api/organizations/${orgId}/members`).set('Cookie', member.cookie).send({ email: stranger.email });
    expect(res.status).toBe(404);
  });

  it('letzter Admin kann nicht degradiert werden', async () => {
    const membersRes = await request(app).get(`/api/organizations/${orgId}/members`).set('Cookie', admin.cookie);
    const adminMember = membersRes.body.data.find((m) => m.email === admin.email);
    const res = await request(app).put(`/api/organizations/${orgId}/members/${adminMember._id}`).set('Cookie', admin.cookie).send({ role: 'member' });
    expect(res.status).toBe(400);
  });

  it('member kann den Verein selbst verlassen', async () => {
    const membersRes = await request(app).get(`/api/organizations/${orgId}/members`).set('Cookie', admin.cookie);
    const memberRow = membersRes.body.data.find((m) => m.email === member.email);
    const res = await request(app).delete(`/api/organizations/${orgId}/members/${memberRow._id}`).set('Cookie', member.cookie);
    expect(res.status).toBe(200);
  });

  it('Team einem Verein zuordnen erfordert Org-Admin-Rolle', async () => {
    const asMember = await request(app).post('/api/teams').set('Cookie', member.cookie).send({ name: 'Sollte fehlschlagen', organizationId: orgId });
    expect(asMember.status).toBe(404);

    const asAdmin = await request(app).post('/api/teams').set('Cookie', admin.cookie).send({ name: 'Verwaltetes Team', organizationId: orgId });
    expect(asAdmin.status).toBe(201);
    expect(asAdmin.body.data.organizationId).toBe(orgId);
  });

  it('Org-Admin sieht das Team auch ohne eigene Team-Mitgliedschaft', async () => {
    const teamRes = await request(app).post('/api/teams').set('Cookie', member.cookie).send({ name: 'Team von Member' });
    const teamId = teamRes.body.data._id;
    await pool.query('UPDATE teams SET organization_id = $1 WHERE id = $2', [orgId, teamId]);

    const listRes = await request(app).get('/api/teams').set('Cookie', admin.cookie);
    const seen = listRes.body.data.find((t) => t._id === teamId);
    expect(seen).toBeDefined();
    expect(seen.role).toBe('org_admin');
  });

  it('Verein löschen setzt organization_id der Teams auf NULL, Teams bleiben erhalten', async () => {
    const teamRes = await request(app).get('/api/teams').set('Cookie', admin.cookie);
    const managedTeam = teamRes.body.data.find((t) => t.organizationId === orgId && t.role !== 'org_admin');

    const delRes = await request(app).delete(`/api/organizations/${orgId}`).set('Cookie', admin.cookie);
    expect(delRes.status).toBe(200);

    const check = await pool.query('SELECT organization_id FROM teams WHERE id = $1', [managedTeam._id]);
    expect(check.rows[0].organization_id).toBeNull();
  });
});

describe('Vereinsweite Termin-Übersicht (EPIC 011)', () => {
  const addDays = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };

  it('Admin sieht zusammengeführte, nach Datum sortierte Spiele+Trainings über alle Teams des Vereins hinweg', async () => {
    const scheduleAdmin = await registerAndLogin('schedule-admin');
    const orgRes = await request(app).post('/api/organizations').set('Cookie', scheduleAdmin.cookie).send({ name: 'Verein mit Sparten' });
    const orgId = orgRes.body.data._id;

    const teamA = await request(app).post('/api/teams').set('Cookie', scheduleAdmin.cookie).send({ name: '1. Herren', organizationId: orgId });
    const teamB = await request(app).post('/api/teams').set('Cookie', scheduleAdmin.cookie).send({ name: 'U15', organizationId: orgId });

    // Absichtlich in umgekehrter Datumsreihenfolge angelegt, um die
    // Sortierung der Antwort zu belegen (nicht nur Einfüge-Reihenfolge).
    await request(app).post('/api/trainings').set('Cookie', scheduleAdmin.cookie)
      .send({ name: 'U15-Training', teamId: teamB.body.data._id, scheduledDate: addDays(10) });
    await request(app).post('/api/games').set('Cookie', scheduleAdmin.cookie)
      .send({ opponent: 'HC Musterhausen', teamId: teamA.body.data._id, playedAt: addDays(3) });

    const res = await request(app).get(`/api/organizations/${orgId}/schedule`).set('Cookie', scheduleAdmin.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toMatchObject({ type: 'game', title: 'HC Musterhausen', teamName: '1. Herren' });
    expect(res.body.data[1]).toMatchObject({ type: 'training', title: 'U15-Training', teamName: 'U15' });
  });

  it('Nicht-Admin-Mitglied und Fremder bekommen 404 (kein Leak der Vereinsexistenz)', async () => {
    const scheduleAdmin = await registerAndLogin('schedule-admin2');
    const scheduleMember = await registerAndLogin('schedule-member');
    const orgRes = await request(app).post('/api/organizations').set('Cookie', scheduleAdmin.cookie).send({ name: 'Verein für 404-Check' });
    const orgId = orgRes.body.data._id;
    await request(app).post(`/api/organizations/${orgId}/members`).set('Cookie', scheduleAdmin.cookie).send({ email: scheduleMember.email });

    const asMember = await request(app).get(`/api/organizations/${orgId}/schedule`).set('Cookie', scheduleMember.cookie);
    expect(asMember.status).toBe(404);

    const asStranger = await request(app).get(`/api/organizations/${orgId}/schedule`).set('Cookie', stranger.cookie);
    expect(asStranger.status).toBe(404);
  });

  it('Items aus einem fremden, unbeteiligten Team tauchen nicht auf; vergangene Termine werden ausgeblendet', async () => {
    const scheduleAdmin = await registerAndLogin('schedule-admin3');
    const orgRes = await request(app).post('/api/organizations').set('Cookie', scheduleAdmin.cookie).send({ name: 'Verein mit Vergangenem' });
    const orgId = orgRes.body.data._id;
    const team = await request(app).post('/api/teams').set('Cookie', scheduleAdmin.cookie).send({ name: 'Team X', organizationId: orgId });

    // Vergangenes Spiel + Training auf dem Vereins-Team – dürfen nicht erscheinen.
    await request(app).post('/api/games').set('Cookie', scheduleAdmin.cookie)
      .send({ opponent: 'Vergangener Gegner', teamId: team.body.data._id, playedAt: addDays(-5) });
    await request(app).post('/api/trainings').set('Cookie', scheduleAdmin.cookie)
      .send({ name: 'Vergangenes Training', teamId: team.body.data._id, scheduledDate: addDays(-2) });

    // Fremdes, unbeteiligtes Team (kein Vereinsbezug) mit einem zukünftigen Spiel.
    const strangerTeam = await request(app).post('/api/teams').set('Cookie', stranger.cookie).send({ name: 'Fremdes Team' });
    await request(app).post('/api/games').set('Cookie', stranger.cookie)
      .send({ opponent: 'Fremder Gegner', teamId: strangerTeam.body.data._id, playedAt: addDays(7) });

    // Ein zukünftiges Spiel auf dem eigenen Vereins-Team, damit die Liste nicht trivial leer ist.
    await request(app).post('/api/games').set('Cookie', scheduleAdmin.cookie)
      .send({ opponent: 'Zukünftiger Gegner', teamId: team.body.data._id, playedAt: addDays(4) });

    const res = await request(app).get(`/api/organizations/${orgId}/schedule`).set('Cookie', scheduleAdmin.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Zukünftiger Gegner');
  });
});

describe('Bugfix: Ersteller-Account-Löschung darf den Verein nicht mitreißen', () => {
  // organizations.created_by ist reine Provenienz, nicht die eigentliche
  // Berechtigung (die läuft über organization_members.role='admin').
  // Wenn der ursprüngliche Ersteller den Verein längst verlassen hat und
  // danach seinen Account löscht, muss der Verein für die verbleibenden
  // Mitglieder erhalten bleiben statt per CASCADE über created_by mit
  // gelöscht zu werden.
  it('Verein bleibt erhalten, wenn der ursprüngliche Ersteller die Gruppe verlässt und danach seinen Account löscht', async () => {
    const creatorEmail = uniqueEmail('creator');
    const creatorRes = await request(app).post('/api/auth/register').send({ email: creatorEmail, password: 'Testpass123' });
    const creatorCookie = creatorRes.headers['set-cookie'][0];

    const successorEmail = uniqueEmail('successor');
    const successorRes = await request(app).post('/api/auth/register').send({ email: successorEmail, password: 'Testpass123' });
    const successorCookie = successorRes.headers['set-cookie'][0];

    const orgRes = await request(app)
      .post('/api/organizations')
      .set('Cookie', creatorCookie)
      .send({ name: 'Verein mit Nachfolger' });
    const bugOrgId = orgRes.body.data._id;

    await request(app)
      .post(`/api/organizations/${bugOrgId}/members`)
      .set('Cookie', creatorCookie)
      .send({ email: successorEmail, role: 'admin' });

    // Ersteller verlässt den Verein (es gibt jetzt einen zweiten Admin,
    // das ist also erlaubt) – ab hier ist er kein Mitglied mehr.
    const membersRes = await request(app).get(`/api/organizations/${bugOrgId}/members`).set('Cookie', creatorCookie);
    const creatorMember = membersRes.body.data.find((m) => m.email === creatorEmail);
    const leaveRes = await request(app)
      .delete(`/api/organizations/${bugOrgId}/members/${creatorMember._id}`)
      .set('Cookie', creatorCookie);
    expect(leaveRes.status).toBe(200);

    // Ersteller löscht seinen Account – organizations.created_by zeigt
    // noch immer auf ihn, obwohl er kein Mitglied mehr ist.
    const deleteRes = await request(app)
      .delete('/api/user/account')
      .set('Cookie', creatorCookie)
      .send({ email: creatorEmail });
    expect(deleteRes.status).toBe(200);

    // Der Verein muss für den Nachfolger unverändert erreichbar bleiben.
    const orgCheck = await request(app).get(`/api/organizations/${bugOrgId}`).set('Cookie', successorCookie);
    expect(orgCheck.status).toBe(200);
    expect(orgCheck.body.data.name).toBe('Verein mit Nachfolger');

    const dbCheck = await pool.query('SELECT created_by FROM organizations WHERE id = $1', [bugOrgId]);
    expect(dbCheck.rows[0].created_by).toBeNull();
  });
});
