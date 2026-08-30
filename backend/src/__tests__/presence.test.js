import './setup.js';
import request from 'supertest';
import WebSocket from 'ws';
import app, { httpServer } from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'presence-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123', birthday: '1990-01-01'});
  return { email, cookie: res.headers['set-cookie'][0] };
}

let owner;
let stranger;
let viewer;
let boardId;
let port;

// Der Server sendet die erste Präsenz-Nachricht ggf. so schnell, dass sie im
// selben synchronen Callstack wie das 'open'-Event beim Client ankommt –
// ein NACH await waitFor(ws,'open') erst registrierter .once('message', ...)
// Listener kann diese Nachricht dann bereits verpasst haben. Deshalb wird
// hier ab dem Verbindungsaufbau eine Warteschlange geführt statt Listener
// erst bei Bedarf anzuhängen.
function connect(cookie, qs) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/api/ws/presence${qs}`, { headers: { Cookie: cookie ?? '' } });
  ws.messageQueue = [];
  ws.messageWaiters = [];
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    const waiter = ws.messageWaiters.shift();
    if (waiter) waiter(msg);
    else ws.messageQueue.push(msg);
  });
  return ws;
}

function waitForOpen(ws) {
  return new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
}

function waitForError(ws) {
  return new Promise((resolve) => ws.once('error', resolve));
}

function nextPresenceMessage(ws) {
  if (ws.messageQueue.length > 0) return Promise.resolve(ws.messageQueue.shift());
  return new Promise((resolve) => ws.messageWaiters.push(resolve));
}
// Alias für Lesbarkeit in Tests, die keine reinen Präsenz-Nachrichten
// erwarten (Cursor/Op) – dieselbe generische Warteschlangen-Logik.
const nextMessage = nextPresenceMessage;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  owner = await registerAndLogin('owner');
  stranger = await registerAndLogin('stranger');
  viewer = await registerAndLogin('viewer');

  const boardRes = await request(app)
    .post('/api/boards')
    .set('Cookie', owner.cookie)
    .send({ name: 'Presence Test Board', fieldType: 'large' });
  boardId = boardRes.body.data._id;

  await new Promise((resolve) => { httpServer.listen(0, '127.0.0.1', resolve); });
  port = httpServer.address().port;
}, 30000);

afterAll(async () => {
  await new Promise((resolve) => httpServer.close(resolve));
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('WS /api/ws/presence', () => {
  it('lehnt eine Verbindung ohne gültiges Auth-Cookie ab', async () => {
    const ws = connect(null, `?boardId=${boardId}`);
    await expect(waitForError(ws)).resolves.toBeDefined();
  });

  it('lehnt eine Verbindung ohne Board-Zugriff ab', async () => {
    const ws = connect(stranger.cookie, `?boardId=${boardId}`);
    await expect(waitForError(ws)).resolves.toBeDefined();
  });

  it('sendet eine Präsenz-Liste nach dem Verbinden, die den Nutzer selbst enthält', async () => {
    const ws = connect(owner.cookie, `?boardId=${boardId}`);
    await waitForOpen(ws);
    const msg = await nextPresenceMessage(ws);
    expect(msg.type).toBe('presence');
    expect(msg.users.some((u) => u.userId && u.displayName)).toBe(true);
    ws.close();
  });

  it('broadcastet eine aktualisierte Liste an alle, wenn ein zweiter Nutzer beitritt', async () => {
    const wsA = connect(owner.cookie, `?boardId=${boardId}`);
    await waitForOpen(wsA);
    await nextPresenceMessage(wsA); // initiale Liste (nur A)

    const updatePromise = nextPresenceMessage(wsA); // zweite Nachricht: B ist beigetreten
    const wsB = connect(owner.cookie, `?boardId=${boardId}`);
    await waitForOpen(wsB);

    const updated = await updatePromise;
    expect(updated.type).toBe('presence');
    // Beide Verbindungen gehören demselben User (owner) – nach userId dedupliziert
    // bleibt die Liste bei 1 Eintrag, das bestätigt aber, dass ein Broadcast
    // überhaupt ausgelöst wurde (zweite Nachricht kam an).
    expect(updated.users).toHaveLength(1);

    wsA.close();
    wsB.close();
  });

  it('entfernt einen Nutzer aus der Liste, wenn die Verbindung schließt', async () => {
    const otherBoardRes = await request(app)
      .post('/api/boards')
      .set('Cookie', owner.cookie)
      .send({ name: 'Presence Test Board 2', fieldType: 'large' });
    const otherBoardId = otherBoardRes.body.data._id;

    await request(app).post(`/api/boards/${otherBoardId}/collaborators`).set('Cookie', owner.cookie)
      .send({ email: stranger.email, permission: 'read' });

    const wsA = connect(owner.cookie, `?boardId=${otherBoardId}`);
    await waitForOpen(wsA);
    await nextPresenceMessage(wsA);

    const bJoinedPromise = nextPresenceMessage(wsA);
    const wsB = connect(stranger.cookie, `?boardId=${otherBoardId}`);
    await waitForOpen(wsB);
    const afterJoin = await bJoinedPromise;
    expect(afterJoin.users).toHaveLength(2);

    const bLeftPromise = nextPresenceMessage(wsA);
    wsB.close();
    const afterLeave = await bLeftPromise;
    expect(afterLeave.users).toHaveLength(1);

    wsA.close();
  });
});

describe('WS /api/ws/presence – Cursor + Live-Merge Relay', () => {
  let sharedBoardId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/boards')
      .set('Cookie', owner.cookie)
      .send({ name: 'Presence Relay Test Board', fieldType: 'large' });
    sharedBoardId = res.body.data._id;
    await request(app).post(`/api/boards/${sharedBoardId}/collaborators`).set('Cookie', owner.cookie)
      .send({ email: stranger.email, permission: 'write' });
    await request(app).post(`/api/boards/${sharedBoardId}/collaborators`).set('Cookie', owner.cookie)
      .send({ email: viewer.email, permission: 'read' });
  });

  it('relayt eine Cursor-Position an einen anderen Nutzer, aber nicht an den Sender selbst', async () => {
    const wsOwner = connect(owner.cookie, `?boardId=${sharedBoardId}`);
    await waitForOpen(wsOwner);
    await nextMessage(wsOwner); // initiale presence

    const strangerJoined = nextMessage(wsOwner);
    const wsStranger = connect(stranger.cookie, `?boardId=${sharedBoardId}`);
    await waitForOpen(wsStranger);
    await nextMessage(wsStranger); // initiale presence
    await strangerJoined; // presence-Update bei owner wegen stranger

    const received = nextMessage(wsStranger);
    wsOwner.send(JSON.stringify({ type: 'cursor', x: 12.5, y: 3.2 }));
    const cursorMsg = await received;
    expect(cursorMsg).toMatchObject({ type: 'cursor', x: 12.5, y: 3.2 });
    expect(cursorMsg.displayName).toBeDefined();

    // Sender selbst bekommt die eigene Cursor-Nachricht nicht zurück
    wsOwner.send(JSON.stringify({ type: 'cursor', x: 1, y: 1 }));
    await sleep(100);
    expect(wsOwner.messageQueue).toHaveLength(0);

    wsOwner.close();
    wsStranger.close();
  });

  it('relayt cursorLeave an andere Nutzer', async () => {
    const wsOwner = connect(owner.cookie, `?boardId=${sharedBoardId}`);
    await waitForOpen(wsOwner);
    await nextMessage(wsOwner);

    const strangerJoined = nextMessage(wsOwner);
    const wsStranger = connect(stranger.cookie, `?boardId=${sharedBoardId}`);
    await waitForOpen(wsStranger);
    await nextMessage(wsStranger);
    await strangerJoined;

    const received = nextMessage(wsStranger);
    wsOwner.send(JSON.stringify({ type: 'cursorLeave' }));
    const msg = await received;
    expect(msg.type).toBe('cursorLeave');
    expect(msg.userId).toBeDefined();

    wsOwner.close();
    wsStranger.close();
  });

  it('relayt eine Op-Nachricht von einem write-Kollaborator an andere Nutzer', async () => {
    const wsStranger = connect(stranger.cookie, `?boardId=${sharedBoardId}`);
    await waitForOpen(wsStranger);
    await nextMessage(wsStranger);

    const viewerJoined = nextMessage(wsStranger);
    const wsViewer = connect(viewer.cookie, `?boardId=${sharedBoardId}`);
    await waitForOpen(wsViewer);
    await nextMessage(wsViewer);
    await viewerJoined;

    const received = nextMessage(wsViewer);
    wsStranger.send(JSON.stringify({ type: 'op', frameId: 'frame-1', op: { kind: 'movePlayer', id: 'p1', x: 5, y: 6 } }));
    const opMsg = await received;
    expect(opMsg).toMatchObject({ type: 'op', frameId: 'frame-1', op: { kind: 'movePlayer', id: 'p1', x: 5, y: 6 } });
    expect(opMsg.userId).toBeDefined();

    wsStranger.close();
    wsViewer.close();
  });

  it('verwirft eine Op-Nachricht von einem read-only-Kollaborator (kein Relay)', async () => {
    const wsOwner = connect(owner.cookie, `?boardId=${sharedBoardId}`);
    await waitForOpen(wsOwner);
    await nextMessage(wsOwner);

    const viewerJoined = nextMessage(wsOwner);
    const wsViewer = connect(viewer.cookie, `?boardId=${sharedBoardId}`);
    await waitForOpen(wsViewer);
    await nextMessage(wsViewer);
    await viewerJoined;

    wsViewer.send(JSON.stringify({ type: 'op', frameId: 'frame-1', op: { kind: 'movePlayer', id: 'p1', x: 9, y: 9 } }));
    await sleep(100);
    expect(wsOwner.messageQueue).toHaveLength(0);

    wsOwner.close();
    wsViewer.close();
  });
});

describe('WS /api/ws/presence – Spieluhr (gameId)', () => {
  let teamId;
  let gameId;

  beforeAll(async () => {
    const teamRes = await request(app).post('/api/teams').set('Cookie', owner.cookie).send({ name: 'Presence-Clock-Test-Team' });
    teamId = teamRes.body.data._id;
    await request(app).post(`/api/teams/${teamId}/members`).set('Cookie', owner.cookie).send({ email: viewer.email, role: 'member' });

    const gameRes = await request(app).post('/api/games').set('Cookie', owner.cookie).send({ opponent: 'Presence-Clock-Test-Gegner', teamId });
    gameId = gameRes.body.data._id;
  });

  it('lehnt eine Verbindung ohne Spiel-Zugriff ab', async () => {
    const ws = connect(stranger.cookie, `?gameId=${gameId}`);
    await expect(waitForError(ws)).resolves.toBeDefined();
  });

  it('relayt einen clock-Ping mit dem aktuellen DB-Stand an andere im selben Spiel-Room, nicht an den Sender selbst', async () => {
    const wsOwner = connect(owner.cookie, `?gameId=${gameId}`);
    await waitForOpen(wsOwner);
    await nextMessage(wsOwner); // initiale presence

    const viewerJoined = nextMessage(wsOwner);
    const wsViewer = connect(viewer.cookie, `?gameId=${gameId}`);
    await waitForOpen(wsViewer);
    await nextMessage(wsViewer); // initiale presence
    await viewerJoined;

    await request(app).post(`/api/games/${gameId}/clock/start`).set('Cookie', owner.cookie);

    const received = nextMessage(wsViewer);
    wsOwner.send(JSON.stringify({ type: 'clock' }));
    const clockMsg = await received;
    expect(clockMsg).toMatchObject({ type: 'clock', clockPeriod: 1, clockStatus: 'running' });

    // Sender selbst bekommt den eigenen Ping nicht zurück
    await sleep(100);
    expect(wsOwner.messageQueue).toHaveLength(0);

    wsOwner.close();
    wsViewer.close();
  });
});
