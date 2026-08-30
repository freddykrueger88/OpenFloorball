import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'teams-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123', birthday: '1990-01-01'});
  return { email, cookie: res.headers['set-cookie'][0] };
}

let owner;
let coach;
let member;
let stranger;
let teamId;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  owner = await registerAndLogin('owner');
  coach = await registerAndLogin('coach');
  member = await registerAndLogin('member');
  stranger = await registerAndLogin('stranger');
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('Team anlegen', () => {
  it('legt ein Team an, Ersteller wird automatisch owner', async () => {
    const res = await request(app)
      .post('/api/teams')
      .set('Cookie', owner.cookie)
      .send({ name: 'HC Test' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('HC Test');
    expect(res.body.data.role).toBe('owner');
    teamId = res.body.data._id;
  });

  it('erscheint in der eigenen Team-Liste', async () => {
    const res = await request(app).get('/api/teams').set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.some((t) => t._id === teamId)).toBe(true);
  });

  it('ein fremder Nutzer sieht das Team nicht (404 bei Detail-Abruf)', async () => {
    const res = await request(app).get(`/api/teams/${teamId}`).set('Cookie', stranger.cookie);
    expect(res.status).toBe(404);
  });
});

describe('Mitgliederverwaltung (Owner-only)', () => {
  let coachMemberId;

  it('lehnt Einladung durch einen Nicht-Owner mit 404 ab', async () => {
    const res = await request(app)
      .post(`/api/teams/${teamId}/members`)
      .set('Cookie', stranger.cookie)
      .send({ email: coach.email, role: 'coach' });
    expect(res.status).toBe(404);
  });

  it('lehnt Einladung eines nicht existierenden Nutzers mit 404 ab', async () => {
    const res = await request(app)
      .post(`/api/teams/${teamId}/members`)
      .set('Cookie', owner.cookie)
      .send({ email: 'nichtexistent-xyz@example.com', role: 'coach' });
    expect(res.status).toBe(404);
  });

  it('lehnt Selbst-Einladung mit 400 ab', async () => {
    const res = await request(app)
      .post(`/api/teams/${teamId}/members`)
      .set('Cookie', owner.cookie)
      .send({ email: owner.email, role: 'coach' });
    expect(res.status).toBe(400);
  });

  it('owner lädt einen Co-Trainer ein', async () => {
    const res = await request(app)
      .post(`/api/teams/${teamId}/members`)
      .set('Cookie', owner.cookie)
      .send({ email: coach.email, role: 'coach' });
    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('coach');
    coachMemberId = res.body.data._id;
  });

  it('lehnt doppelte Einladung mit 400 ab', async () => {
    const res = await request(app)
      .post(`/api/teams/${teamId}/members`)
      .set('Cookie', owner.cookie)
      .send({ email: coach.email, role: 'member' });
    expect(res.status).toBe(400);
  });

  it('owner lädt ein Spieler-Mitglied (member) ein', async () => {
    const res = await request(app)
      .post(`/api/teams/${teamId}/members`)
      .set('Cookie', owner.cookie)
      .send({ email: member.email, role: 'member' });
    expect(res.status).toBe(201);
  });

  it('eingeladenes Mitglied sieht das Team jetzt', async () => {
    const res = await request(app).get(`/api/teams/${teamId}`).set('Cookie', coach.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('coach');
  });

  it('listet alle Mitglieder (für jedes Mitglied sichtbar)', async () => {
    const res = await request(app).get(`/api/teams/${teamId}/members`).set('Cookie', coach.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3); // owner + coach + member
  });

  it('lehnt Rollenänderung durch einen Nicht-Owner (coach) mit 404 ab', async () => {
    const res = await request(app)
      .put(`/api/teams/${teamId}/members/${coachMemberId}`)
      .set('Cookie', coach.cookie)
      .send({ role: 'owner' });
    expect(res.status).toBe(404);
  });

  it('owner stuft den Co-Trainer auf member herab', async () => {
    const res = await request(app)
      .put(`/api/teams/${teamId}/members/${coachMemberId}`)
      .set('Cookie', owner.cookie)
      .send({ role: 'member' });
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('member');
  });

  it('owner kann sich nicht selbst degradieren, wenn er der letzte owner ist', async () => {
    const membersRes = await request(app).get(`/api/teams/${teamId}/members`).set('Cookie', owner.cookie);
    const ownerMemberId = membersRes.body.data.find((m) => m.email === owner.email)._id;
    const res = await request(app)
      .put(`/api/teams/${teamId}/members/${ownerMemberId}`)
      .set('Cookie', owner.cookie)
      .send({ role: 'coach' });
    expect(res.status).toBe(400);
  });

  it('owner kann das Team nicht verlassen, solange er der letzte owner ist', async () => {
    const membersRes = await request(app).get(`/api/teams/${teamId}/members`).set('Cookie', owner.cookie);
    const ownerMemberId = membersRes.body.data.find((m) => m.email === owner.email)._id;
    const res = await request(app)
      .delete(`/api/teams/${teamId}/members/${ownerMemberId}`)
      .set('Cookie', owner.cookie);
    expect(res.status).toBe(400);
  });

  it('ein Mitglied kann sich selbst entfernen (Team verlassen)', async () => {
    const res = await request(app)
      .delete(`/api/teams/${teamId}/members/${coachMemberId}`)
      .set('Cookie', coach.cookie);
    expect(res.status).toBe(200);
  });

  it('verlassenes Mitglied sieht das Team nicht mehr', async () => {
    const res = await request(app).get(`/api/teams/${teamId}`).set('Cookie', coach.cookie);
    expect(res.status).toBe(404);
  });
});

describe('Team umbenennen und löschen', () => {
  it('lehnt Umbenennen durch einen Nicht-Owner mit 404 ab', async () => {
    const res = await request(app)
      .put(`/api/teams/${teamId}`)
      .set('Cookie', member.cookie)
      .send({ name: 'Sollte fehlschlagen' });
    expect(res.status).toBe(404);
  });

  it('owner benennt das Team um', async () => {
    const res = await request(app)
      .put(`/api/teams/${teamId}`)
      .set('Cookie', owner.cookie)
      .send({ name: 'HC Test Umbenannt' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('HC Test Umbenannt');
  });

  it('lehnt Löschen durch ein Nicht-Owner-Mitglied mit 404 ab', async () => {
    const res = await request(app).delete(`/api/teams/${teamId}`).set('Cookie', member.cookie);
    expect(res.status).toBe(404);
  });

  it('owner löscht das Team', async () => {
    const res = await request(app).delete(`/api/teams/${teamId}`).set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
  });

  it('gelöschtes Team ist für niemanden mehr sichtbar', async () => {
    const res = await request(app).get(`/api/teams/${teamId}`).set('Cookie', owner.cookie);
    expect(res.status).toBe(404);
  });
});

describe('Bugfix: Ersteller-Account-Löschung darf das Team nicht mitreißen', () => {
  // teams.created_by ist reine Provenienz, nicht die eigentliche
  // Berechtigung (die läuft über team_members.role='owner'). Wenn der
  // ursprüngliche Ersteller das Team längst verlassen hat und danach
  // seinen Account löscht, muss das Team für die verbleibenden
  // Mitglieder erhalten bleiben statt per CASCADE über created_by mit
  // gelöscht zu werden.
  it('Team bleibt erhalten, wenn der ursprüngliche Ersteller die Gruppe verlässt und danach seinen Account löscht', async () => {
    const creatorEmail = uniqueEmail('creator');
    const creatorRes = await request(app).post('/api/auth/register').send({ email: creatorEmail, password: 'Testpass123', birthday: '1990-01-01'});
    const creatorCookie = creatorRes.headers['set-cookie'][0];

    const successorEmail = uniqueEmail('successor');
    const successorRes = await request(app).post('/api/auth/register').send({ email: successorEmail, password: 'Testpass123', birthday: '1990-01-01'});
    const successorCookie = successorRes.headers['set-cookie'][0];

    const teamRes = await request(app)
      .post('/api/teams')
      .set('Cookie', creatorCookie)
      .send({ name: 'Team mit Nachfolger' });
    const bugTeamId = teamRes.body.data._id;

    await request(app)
      .post(`/api/teams/${bugTeamId}/members`)
      .set('Cookie', creatorCookie)
      .send({ email: successorEmail, role: 'owner' });

    // Ersteller verlässt das Team (jetzt gibt es noch einen zweiten
    // Owner, das ist also erlaubt) – ab hier ist er kein Mitglied mehr.
    const membersRes = await request(app).get(`/api/teams/${bugTeamId}/members`).set('Cookie', creatorCookie);
    const creatorMember = membersRes.body.data.find((m) => m.email === creatorEmail);
    const leaveRes = await request(app)
      .delete(`/api/teams/${bugTeamId}/members/${creatorMember._id}`)
      .set('Cookie', creatorCookie);
    expect(leaveRes.status).toBe(200);

    // Ersteller löscht seinen Account – teams.created_by zeigt noch
    // immer auf ihn, obwohl er kein Mitglied mehr ist.
    const deleteRes = await request(app)
      .delete('/api/user/account')
      .set('Cookie', creatorCookie)
      .send({ email: creatorEmail });
    expect(deleteRes.status).toBe(200);

    // Das Team muss für den Nachfolger unverändert erreichbar bleiben.
    const teamCheck = await request(app).get(`/api/teams/${bugTeamId}`).set('Cookie', successorCookie);
    expect(teamCheck.status).toBe(200);
    expect(teamCheck.body.data.name).toBe('Team mit Nachfolger');

    const dbCheck = await pool.query('SELECT created_by FROM teams WHERE id = $1', [bugTeamId]);
    expect(dbCheck.rows[0].created_by).toBeNull();
  });
});

describe('GET /api/teams/birthdays', () => {
  it('zeigt Geburtstage von Teamkolleg:innen, dedupliziert über mehrere gemeinsame Teams, ohne fremde Nutzer', async () => {
    const alice = await registerAndLogin('bday-alice');
    const bob = await registerAndLogin('bday-bob');
    const outsider = await registerAndLogin('bday-outsider');
    await pool.query("UPDATE users SET birthday = '1985-05-05' WHERE email = $1", [alice.email]);
    await pool.query("UPDATE users SET birthday = '1992-11-30' WHERE email = $1", [bob.email]);
    // Nutzer ohne Geburtsdatum dürfen nicht auftauchen
    await pool.query("UPDATE users SET birthday = NULL WHERE email = $1", [outsider.email]);

    const teamARes = await request(app).post('/api/teams').set('Cookie', alice.cookie).send({ name: 'Bday Team A' });
    const teamAId = teamARes.body.data._id;
    const teamBRes = await request(app).post('/api/teams').set('Cookie', alice.cookie).send({ name: 'Bday Team B' });
    const teamBId = teamBRes.body.data._id;

    // Bob teilt mit Alice gleich zwei Teams – muss trotzdem nur einmal
    // in der Liste erscheinen.
    await request(app).post(`/api/teams/${teamAId}/members`).set('Cookie', alice.cookie).send({ email: bob.email, role: 'member' });
    await request(app).post(`/api/teams/${teamBId}/members`).set('Cookie', alice.cookie).send({ email: bob.email, role: 'member' });
    await request(app).post(`/api/teams/${teamAId}/members`).set('Cookie', alice.cookie).send({ email: outsider.email, role: 'member' });

    const res = await request(app).get('/api/teams/birthdays').set('Cookie', alice.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2); // alice + bob (dedupliziert), nicht outsider (kein Geburtstag)
    expect(res.body.data.some((b) => String(b.birthday).startsWith('1985-05-05'))).toBe(true);
    expect(res.body.data.some((b) => String(b.birthday).startsWith('1992-11-30'))).toBe(true);
  });

  it('ein Nutzer ohne gemeinsames Team sieht keine fremden Geburtstage', async () => {
    const loner = await registerAndLogin('bday-loner');
    const res = await request(app).get('/api/teams/birthdays').set('Cookie', loner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});
