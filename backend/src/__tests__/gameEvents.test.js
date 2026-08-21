/**
 * gameEvents.test.js – Live-Match-Ereignisse (Roadmap-Audit, Start
 * Phase C): strukturierte Speicherung der 10 festen IFF-Presets
 * statt Freitext in comments.
 */
import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'gameevents-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123' });
  return { email, cookie: res.headers['set-cookie'][0] };
}

async function createRosterPlayer(cookie, name, teamId = null) {
  const res = await request(app).post('/api/roster').set('Cookie', cookie).send({ name, teamId });
  return res.body.data._id;
}

let owner;
let member;
let stranger;
let teamId;
let gameId;
let p1;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  owner = await registerAndLogin('owner');
  member = await registerAndLogin('member');
  stranger = await registerAndLogin('stranger');

  const teamRes = await request(app).post('/api/teams').set('Cookie', owner.cookie).send({ name: 'GameEvents-Test-Team' });
  teamId = teamRes.body.data._id;
  await request(app).post(`/api/teams/${teamId}/members`).set('Cookie', owner.cookie).send({ email: member.email, role: 'member' });

  p1 = await createRosterPlayer(owner.cookie, 'Max', teamId);

  const gameRes = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Events-Test-Gegner', teamId });
  gameId = gameRes.body.data._id;
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('POST /api/games/:id/events', () => {
  it('legt ein Ereignis ohne Zuordnung an', async () => {
    const res = await request(app)
      .post(`/api/games/${gameId}/events`)
      .set('Cookie', owner.cookie)
      .send({ eventType: 'period_end' });
    expect(res.status).toBe(201);
    expect(res.body.data.eventType).toBe('period_end');
    expect(res.body.data.rosterPlayerId).toBeNull();
    expect(res.body.data.isOpponent).toBe(false);
    expect(res.body.data.email).toBe(owner.email);
  });

  it('legt ein Ereignis mit Kader-Spieler-Zuordnung an', async () => {
    const res = await request(app)
      .post(`/api/games/${gameId}/events`)
      .set('Cookie', owner.cookie)
      .send({ eventType: 'goal', rosterPlayerId: p1 });
    expect(res.status).toBe(201);
    expect(res.body.data.rosterPlayerId).toBe(p1);
    expect(res.body.data.isOpponent).toBe(false);
  });

  it('legt ein Ereignis mit Gegner-Zuordnung an', async () => {
    const res = await request(app)
      .post(`/api/games/${gameId}/events`)
      .set('Cookie', owner.cookie)
      .send({ eventType: 'penalty_2', isOpponent: true });
    expect(res.status).toBe(201);
    expect(res.body.data.isOpponent).toBe(true);
    expect(res.body.data.rosterPlayerId).toBeNull();
  });

  it('lehnt gleichzeitig rosterPlayerId UND isOpponent mit 400 ab', async () => {
    const res = await request(app)
      .post(`/api/games/${gameId}/events`)
      .set('Cookie', owner.cookie)
      .send({ eventType: 'goal', rosterPlayerId: p1, isOpponent: true });
    expect(res.status).toBe(400);
  });

  it('lehnt einen Kader-Spieler aus falscher Sichtbarkeits-Gruppe mit 400 ab', async () => {
    const foreignPlayer = await createRosterPlayer(owner.cookie, 'Nicht-Team-Spieler');
    const res = await request(app)
      .post(`/api/games/${gameId}/events`)
      .set('Cookie', owner.cookie)
      .send({ eventType: 'goal', rosterPlayerId: foreignPlayer });
    expect(res.status).toBe(400);
  });

  it('lehnt einen nicht existierenden Kader-Spieler mit 404 ab', async () => {
    const res = await request(app)
      .post(`/api/games/${gameId}/events`)
      .set('Cookie', owner.cookie)
      .send({ eventType: 'goal', rosterPlayerId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(404);
  });

  it('lehnt einen unbekannten eventType mit 400 ab (Prüfung gegen event_type_definitions, ADR-0001)', async () => {
    const res = await request(app)
      .post(`/api/games/${gameId}/events`)
      .set('Cookie', owner.cookie)
      .send({ eventType: 'red_card' });
    expect(res.status).toBe(400);
  });

  it('lehnt einen komplett leeren eventType weiterhin mit 422 ab (Route-Validator)', async () => {
    const res = await request(app)
      .post(`/api/games/${gameId}/events`)
      .set('Cookie', owner.cookie)
      .send({ eventType: '' });
    expect(res.status).toBe(422);
  });

  it('member darf kein Ereignis anlegen (nur Lesezugriff, 404)', async () => {
    const res = await request(app)
      .post(`/api/games/${gameId}/events`)
      .set('Cookie', member.cookie)
      .send({ eventType: 'timeout' });
    expect(res.status).toBe(404);
  });
});

describe('Statistik-Architektur Phase 1: erweiterte Event-Felder', () => {
  it('speichert und liefert die neuen optionalen Felder (Zweitspieler, Outcome, Position, Video-Zeitstempel, Metadata)', async () => {
    const scorer = await createRosterPlayer(owner.cookie, 'Torschütze', teamId);
    const assister = await createRosterPlayer(owner.cookie, 'Assistgeber', teamId);

    const res = await request(app)
      .post(`/api/games/${gameId}/events`)
      .set('Cookie', owner.cookie)
      .send({
        eventType: 'goal',
        rosterPlayerId: scorer,
        secondaryRosterPlayerId: assister,
        outcome: 'goal',
        shotType: 'wrist',
        x: 0.8,
        y: 0.5,
        zone: 'slot',
        videoTimestampSeconds: 1234.5,
        metadata: { note: 'schöner Spielzug' },
      });
    expect(res.status).toBe(201);
    expect(res.body.data.secondaryRosterPlayerId).toBe(assister);
    expect(res.body.data.outcome).toBe('goal');
    expect(res.body.data.shotType).toBe('wrist');
    // strengthState wird seit Phase 4 serverseitig berechnet, nicht mehr
    // vom Client entgegengenommen – hier null, da die Spieluhr dieses
    // Spiels nie gestartet wurde (siehe eigener describe-Block unten).
    expect(res.body.data.strengthState).toBeNull();
    expect(res.body.data.x).toBeCloseTo(0.8);
    expect(res.body.data.y).toBeCloseTo(0.5);
    expect(res.body.data.zone).toBe('slot');
    expect(res.body.data.videoTimestampSeconds).toBeCloseTo(1234.5);
    expect(res.body.data.metadata).toEqual({ note: 'schöner Spielzug' });
  });

  it('lehnt einen Zweitspieler aus falscher Sichtbarkeits-Gruppe mit 400 ab', async () => {
    const foreignPlayer = await createRosterPlayer(owner.cookie, 'Fremder-Assist-Spieler');
    const res = await request(app)
      .post(`/api/games/${gameId}/events`)
      .set('Cookie', owner.cookie)
      .send({ eventType: 'goal', rosterPlayerId: p1, secondaryRosterPlayerId: foreignPlayer });
    expect(res.status).toBe(400);
  });

  it('setzt period/clockSecondsAtEvent auf null, solange die Spieluhr nie gestartet wurde ("unbekannt ≠ 0")', async () => {
    const freshGameRes = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Uhr-nie-gestartet', teamId });
    const freshGameId = freshGameRes.body.data._id;

    const res = await request(app)
      .post(`/api/games/${freshGameId}/events`)
      .set('Cookie', owner.cookie)
      .send({ eventType: 'timeout' });
    expect(res.status).toBe(201);
    expect(res.body.data.period).toBeNull();
    expect(res.body.data.clockSecondsAtEvent).toBeNull();
  });

  it('befüllt period/clockSecondsAtEvent automatisch, sobald die Spieluhr läuft', async () => {
    const clockGameRes = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Uhr-laeuft', teamId });
    const clockGameId = clockGameRes.body.data._id;

    await request(app).post(`/api/games/${clockGameId}/clock/start`).set('Cookie', owner.cookie);

    const res = await request(app)
      .post(`/api/games/${clockGameId}/events`)
      .set('Cookie', owner.cookie)
      .send({ eventType: 'goal', rosterPlayerId: p1 });
    expect(res.status).toBe(201);
    expect(res.body.data.period).toBe(1);
    expect(res.body.data.clockSecondsAtEvent).toBeGreaterThanOrEqual(0);
  });
});

describe('Statistik-Architektur Phase 6: Video-Verknüpfung', () => {
  let videoId;

  beforeAll(async () => {
    const uploadRes = await request(app)
      .post(`/api/games/${gameId}/videos`)
      .set('Cookie', owner.cookie)
      .attach('video', Buffer.from('kein echtes mp4, reicht aber'), { filename: 'clip.mp4', contentType: 'video/mp4' });
    videoId = uploadRes.body.data._id;
  });

  it('speichert videoId/videoTimestampSeconds direkt beim Anlegen', async () => {
    const res = await request(app)
      .post(`/api/games/${gameId}/events`)
      .set('Cookie', owner.cookie)
      .send({ eventType: 'timeout', videoId, videoTimestampSeconds: 42.5 });
    expect(res.status).toBe(201);
    expect(res.body.data.videoId).toBe(videoId);
    expect(res.body.data.videoTimestampSeconds).toBeCloseTo(42.5);
  });

  it('lehnt ein Video ab, das zu einem anderen Spiel gehört, mit 400', async () => {
    const otherGameRes = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Anderes Spiel', teamId });
    const otherVideoRes = await request(app)
      .post(`/api/games/${otherGameRes.body.data._id}/videos`)
      .set('Cookie', owner.cookie)
      .attach('video', Buffer.from('anderes video'), { filename: 'clip.mp4', contentType: 'video/mp4' });

    const res = await request(app)
      .post(`/api/games/${gameId}/events`)
      .set('Cookie', owner.cookie)
      .send({ eventType: 'timeout', videoId: otherVideoRes.body.data._id });
    expect(res.status).toBe(400);
  });

  it('verknüpft ein bereits bestehendes Ereignis nachträglich mit einem Video (PUT .../video-link)', async () => {
    const eventRes = await request(app)
      .post(`/api/games/${gameId}/events`)
      .set('Cookie', owner.cookie)
      .send({ eventType: 'timeout' });
    const eventId = eventRes.body.data._id;
    expect(eventRes.body.data.videoId).toBeNull();

    const linkRes = await request(app)
      .put(`/api/games/${gameId}/events/${eventId}/video-link`)
      .set('Cookie', owner.cookie)
      .send({ videoId, videoTimestampSeconds: 99 });
    expect(linkRes.status).toBe(200);
    expect(linkRes.body.data.videoId).toBe(videoId);
    expect(linkRes.body.data.videoTimestampSeconds).toBeCloseTo(99);

    const unlinkRes = await request(app)
      .put(`/api/games/${gameId}/events/${eventId}/video-link`)
      .set('Cookie', owner.cookie)
      .send({ videoId: null, videoTimestampSeconds: null });
    expect(unlinkRes.status).toBe(200);
    expect(unlinkRes.body.data.videoId).toBeNull();
    expect(unlinkRes.body.data.videoTimestampSeconds).toBeNull();
  });

  it('lehnt die Video-Verknüpfung durch einen Fremden mit 404 ab', async () => {
    const eventRes = await request(app)
      .post(`/api/games/${gameId}/events`)
      .set('Cookie', owner.cookie)
      .send({ eventType: 'timeout' });

    const res = await request(app)
      .put(`/api/games/${gameId}/events/${eventRes.body.data._id}/video-link`)
      .set('Cookie', stranger.cookie)
      .send({ videoId });
    expect(res.status).toBe(404);
  });
});

describe('Statistik-Architektur Phase 4: strengthState automatisch befüllt', () => {
  it('ist "even" ohne aktive Strafen', async () => {
    const gameRes = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Strength-Even-Test', teamId });
    const stGameId = gameRes.body.data._id;
    await request(app).post(`/api/games/${stGameId}/clock/start`).set('Cookie', owner.cookie);

    const res = await request(app).post(`/api/games/${stGameId}/events`).set('Cookie', owner.cookie).send({ eventType: 'timeout' });
    expect(res.body.data.strengthState).toBe('even');
  });

  it('wird "powerplay", solange eine Gegner-Strafe aktiv ist, und "shorthanded" bei einer eigenen', async () => {
    const gameRes = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Strength-PP-Test', teamId });
    const stGameId = gameRes.body.data._id;
    await request(app).post(`/api/games/${stGameId}/clock/start`).set('Cookie', owner.cookie);

    const penRes = await request(app).post(`/api/games/${stGameId}/events`).set('Cookie', owner.cookie).send({ eventType: 'penalty_2', isOpponent: true });
    expect(penRes.status).toBe(201);

    const ppRes = await request(app).post(`/api/games/${stGameId}/events`).set('Cookie', owner.cookie).send({ eventType: 'timeout' });
    expect(ppRes.body.data.strengthState).toBe('powerplay');

    const ownPenRes = await request(app).post(`/api/games/${stGameId}/events`).set('Cookie', owner.cookie).send({ eventType: 'penalty_2' });
    expect(ownPenRes.status).toBe(201);
    // Jetzt sind beide Strafen aktiv (Gegner + eigene) → wieder "even".
    const evenRes = await request(app).post(`/api/games/${stGameId}/events`).set('Cookie', owner.cookie).send({ eventType: 'timeout' });
    expect(evenRes.body.data.strengthState).toBe('even');
  });

  it('bleibt null, solange die Spieluhr nie gestartet wurde', async () => {
    const gameRes = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Strength-NoClock-Test', teamId });
    const stGameId = gameRes.body.data._id;
    const res = await request(app).post(`/api/games/${stGameId}/events`).set('Cookie', owner.cookie).send({ eventType: 'timeout' });
    expect(res.body.data.strengthState).toBeNull();
  });

  it('ignoriert einen vom Client mitgeschickten strengthState-Wert', async () => {
    const gameRes = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Strength-ClientIgnored-Test', teamId });
    const stGameId = gameRes.body.data._id;
    await request(app).post(`/api/games/${stGameId}/clock/start`).set('Cookie', owner.cookie);

    const res = await request(app).post(`/api/games/${stGameId}/events`).set('Cookie', owner.cookie).send({ eventType: 'timeout', strengthState: 'powerplay' });
    expect(res.body.data.strengthState).toBe('even');
  });

  it('kopiert denselben strengthState auf das Companion-Goal-Event eines Schusses', async () => {
    const gameRes = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Strength-Companion-Test', teamId });
    const stGameId = gameRes.body.data._id;
    await request(app).post(`/api/games/${stGameId}/clock/start`).set('Cookie', owner.cookie);
    await request(app).post(`/api/games/${stGameId}/events`).set('Cookie', owner.cookie).send({ eventType: 'penalty_2', isOpponent: true });

    const shotRes = await request(app)
      .post(`/api/games/${stGameId}/events`)
      .set('Cookie', owner.cookie)
      .send({ eventType: 'shot', rosterPlayerId: p1, x: 0.9, y: 0.5, outcome: 'goal' });
    expect(shotRes.body.data.strengthState).toBe('powerplay');

    const eventsRes = await request(app).get(`/api/games/${stGameId}/events`).set('Cookie', owner.cookie);
    const companion = eventsRes.body.data.find((e) => e._id === shotRes.body.data.metadata.companionGoalEventId);
    expect(companion.strengthState).toBe('powerplay');
  });
});

describe('GET /api/games/:id/events/special-teams-stats und /situational-stats', () => {
  it('liefert plausible Werte, member darf lesen, stranger bekommt 404', async () => {
    const gameRes = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'SpecialTeams-Endpoint-Test', teamId });
    const stGameId = gameRes.body.data._id;
    await request(app).post(`/api/games/${stGameId}/clock/start`).set('Cookie', owner.cookie);
    await request(app).post(`/api/games/${stGameId}/events`).set('Cookie', owner.cookie).send({ eventType: 'penalty_2', isOpponent: true });
    await request(app).post(`/api/games/${stGameId}/events`).set('Cookie', owner.cookie).send({ eventType: 'goal', rosterPlayerId: p1 });

    const specialRes = await request(app).get(`/api/games/${stGameId}/events/special-teams-stats`).set('Cookie', member.cookie);
    expect(specialRes.status).toBe(200);
    expect(specialRes.body.data.powerPlay).toMatchObject({ opportunities: 1, goals: 1, percentage: 100 });

    const situationalRes = await request(app).get(`/api/games/${stGameId}/events/situational-stats`).set('Cookie', member.cookie);
    expect(situationalRes.status).toBe(200);
    expect(situationalRes.body.data.byScoreState).toHaveLength(3);

    const strangerSpecialRes = await request(app).get(`/api/games/${stGameId}/events/special-teams-stats`).set('Cookie', stranger.cookie);
    expect(strangerSpecialRes.status).toBe(404);
    const strangerSituationalRes = await request(app).get(`/api/games/${stGameId}/events/situational-stats`).set('Cookie', stranger.cookie);
    expect(strangerSituationalRes.status).toBe(404);
  });
});

describe('event_type_definitions', () => {
  it('enthält die 11 bestehenden Event-Typen (10 aus Phase 1 + shot aus Phase 3) als unlöschbare Built-ins', async () => {
    const result = await pool.query('SELECT key FROM event_type_definitions WHERE is_builtin = true ORDER BY key');
    const keys = result.rows.map((r) => r.key);
    expect(keys).toEqual([
      'game_end', 'goal', 'kickoff_q1', 'kickoff_q2', 'kickoff_q3',
      'match_penalty', 'penalty_2', 'penalty_5', 'period_end', 'shot', 'timeout',
    ]);
  });
});

describe('GET /api/games/:id/events', () => {
  it('liefert die Ereignisse chronologisch aufsteigend, member darf lesen, Fremder bekommt 404', async () => {
    const res = await request(app).get(`/api/games/${gameId}/events`).set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    const timestamps = res.body.data.map((e) => new Date(e.createdAt).getTime());
    expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));

    const memberRes = await request(app).get(`/api/games/${gameId}/events`).set('Cookie', member.cookie);
    expect(memberRes.status).toBe(200);

    const strangerRes = await request(app).get(`/api/games/${gameId}/events`).set('Cookie', stranger.cookie);
    expect(strangerRes.status).toBe(404);
  });
});

describe('DELETE /api/games/:id/events/:eventId', () => {
  it('löscht ein Ereignis', async () => {
    const createRes = await request(app)
      .post(`/api/games/${gameId}/events`)
      .set('Cookie', owner.cookie)
      .send({ eventType: 'timeout' });
    const eventId = createRes.body.data._id;

    const delRes = await request(app).delete(`/api/games/${gameId}/events/${eventId}`).set('Cookie', owner.cookie);
    expect(delRes.status).toBe(200);

    const listRes = await request(app).get(`/api/games/${gameId}/events`).set('Cookie', owner.cookie);
    expect(listRes.body.data.some((e) => e._id === eventId)).toBe(false);
  });

  it('member darf nicht löschen (404)', async () => {
    const createRes = await request(app)
      .post(`/api/games/${gameId}/events`)
      .set('Cookie', owner.cookie)
      .send({ eventType: 'timeout' });
    const eventId = createRes.body.data._id;

    const res = await request(app).delete(`/api/games/${gameId}/events/${eventId}`).set('Cookie', member.cookie);
    expect(res.status).toBe(404);
  });
});

describe('Cascade-Aufräumen', () => {
  it('löscht game_events-Zeilen, wenn das Spiel gelöscht wird', async () => {
    const tempGameRes = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Cascade-Test', teamId });
    const tempGameId = tempGameRes.body.data._id;
    await request(app).post(`/api/games/${tempGameId}/events`).set('Cookie', owner.cookie).send({ eventType: 'kickoff_q1' });

    await request(app).delete(`/api/games/${tempGameId}`).set('Cookie', owner.cookie);

    const dbCheck = await pool.query('SELECT id FROM game_events WHERE game_id = $1', [tempGameId]);
    expect(dbCheck.rows).toHaveLength(0);
  });

  it('setzt roster_player_id auf NULL statt das Ereignis zu löschen, wenn der Kader-Spieler gelöscht wird', async () => {
    const tempPlayer = await createRosterPlayer(owner.cookie, 'Wird-gelöscht', teamId);
    const createRes = await request(app)
      .post(`/api/games/${gameId}/events`)
      .set('Cookie', owner.cookie)
      .send({ eventType: 'goal', rosterPlayerId: tempPlayer });
    const eventId = createRes.body.data._id;

    await request(app).delete(`/api/roster/${tempPlayer}`).set('Cookie', owner.cookie);

    const dbCheck = await pool.query('SELECT roster_player_id FROM game_events WHERE id = $1', [eventId]);
    expect(dbCheck.rows[0].roster_player_id).toBeNull();
  });
});
