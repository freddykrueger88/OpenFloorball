/**
 * presenceServer – Echtzeit-Präsenz + Live-Co-Editing (ROADMAP-Backlog:
 * Echtzeit-Co-Editing)
 *
 * Zeigt an, wer gerade dasselbe Board geöffnet hat ("Anna, Max sind auch
 * hier"), relayt Live-Cursor-Positionen sowie Spieler-/Zeichen-Operationen
 * zwischen den Verbindungen desselben Boards. Bewusst KEIN inhaltliches
 * Verständnis der Operationen hier – reines Durchreichen an alle anderen
 * im selben Room, die eigentliche Zustands-Anwendung passiert clientseitig
 * (siehe useDrawing.js REMOTE_OP). KEINE Konflikt-Auflösung/Merge auf
 * Server-Seite, KEIN persistenter Zustand – rein transient, die
 * eigentliche Persistenz läuft weiterhin über den normalen Autosave-Pfad.
 *
 * WebSocket statt Server-Sent-Events, weil Cursor/Operationen ohnehin
 * bidirektional sein müssen (Client → Server → andere Clients).
 *
 * Auth: WebSocket-Upgrade-Requests laufen NICHT durch die normale Express-
 * Middleware-Kette (kein cookie-parser) – das Auth-Cookie wird hier daher
 * manuell aus dem rohen Cookie-Header gelesen, sonst identische Prüfung
 * wie middleware/auth.js (JWT verifizieren, Redis-Blacklist prüfen).
 */
import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import pool from '../db/pool.js';
import redisClient from '../db/redis.js';
import logger from '../utils/logger.js';
import { assertBoardAccess } from '../utils/boardAccess.js';
import { assertGameRead, assertGameWrite } from '../controllers/gamesController.js';

const HEARTBEAT_INTERVAL_MS = 30_000;
// Grobe Obergrenze gegen Missbrauch (z.B. riesige Freihand-Elemente) –
// eine einzelne Op-Nachricht sollte dafür nie annähernd in die Nähe kommen.
const MAX_MESSAGE_BYTES = 64 * 1024;

// Roadmap-Audit "Spieluhr": zweiter Ressourcentyp neben Boards (Echtzeit-
// Sync des Spieluhr-Zustands über mehrere Geräte/Tabs). Die Room-Mechanik
// selbst war schon immer ressourcen-generisch (reine string-keyed Map) –
// der Schlüssel wird auf "board:<id>" / "game:<id>" umgestellt, um jede
// theoretische Kollision zwischen Board- und Spiel-UUIDs auszuschließen
// und Räume in Logs eindeutig unterscheidbar zu machen.
// roomKey ("board:<id>" | "game:<id>") -> Map<ws, { userId, displayName, canWrite, resourceType, resourceId }>
const rooms = new Map();

function parseCookieHeader(header = '') {
  const out = {};
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    if (!key) return;
    out[key] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  return out;
}

async function authenticateUpgrade(req) {
  const cookies = parseCookieHeader(req.headers.cookie);
  const token = cookies.token;
  if (!token) return null;

  try {
    const blacklisted = await redisClient.get(`blacklist:${token}`);
    if (blacklisted) return null;

    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const userRes = await pool.query('SELECT email, display_name FROM users WHERE id = $1', [decoded.sub]);
    if (userRes.rows.length === 0) return null;

    const { email, display_name: displayName } = userRes.rows[0];
    return { id: decoded.sub, displayName: displayName || email.split('@')[0] };
  } catch {
    return null;
  }
}

function broadcastPresence(roomKey) {
  const room = rooms.get(roomKey);
  if (!room) return;
  // Ein User kann (Tab-Duplikat, mehrere Geräte) mehrfach im selben Room
  // sein – für die Anzeige nach userId deduplizieren.
  const seen = new Map();
  for (const { userId, displayName } of room.values()) {
    seen.set(userId, displayName);
  }
  const users = [...seen.entries()].map(([userId, displayName]) => ({ userId, displayName }));
  const msg = JSON.stringify({ type: 'presence', users });
  for (const ws of room.keys()) {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  }
}

// Relayt eine Nachricht an alle ANDEREN Nutzer (nach userId, nicht nach
// Verbindung – ein Tab-Duplikat desselben Nutzers bekommt seine eigene
// Cursor-/Op-Nachricht also auch nicht noch einmal zurück) im selben Room.
function relayToOthers(roomKey, excludeUserId, payload) {
  const room = rooms.get(roomKey);
  if (!room) return;
  const msg = JSON.stringify(payload);
  for (const [ws, info] of room) {
    if (info.userId === excludeUserId) continue;
    if (ws.readyState === ws.OPEN) ws.send(msg);
  }
}

async function handleClientMessage(roomKey, ws, raw) {
  const text = raw.toString('utf8');
  if (text.length > MAX_MESSAGE_BYTES) return;

  const room = rooms.get(roomKey);
  const senderInfo = room?.get(ws);
  if (!senderInfo) return;

  let msg;
  try {
    msg = JSON.parse(text);
  } catch {
    return;
  }

  if (msg.type === 'cursor' && typeof msg.x === 'number' && typeof msg.y === 'number') {
    relayToOthers(roomKey, senderInfo.userId, {
      type: 'cursor', userId: senderInfo.userId, displayName: senderInfo.displayName, x: msg.x, y: msg.y,
    });
    return;
  }
  if (msg.type === 'cursorLeave') {
    relayToOthers(roomKey, senderInfo.userId, { type: 'cursorLeave', userId: senderInfo.userId });
    return;
  }
  // Live-Merge (ROADMAP-Backlog "Konflikt-Auflösung"): read-only-
  // Kollaboratoren dürfen laut UI ohnehin nicht zeichnen/verschieben –
  // canWrite wurde beim Verbindungsaufbau einmalig geprüft (kein Zugriff
  // pro Nachricht nötig) und wird hier serverseitig zusätzlich
  // durchgesetzt, falls jemand die WS-Nachricht direkt fälscht.
  if (msg.type === 'op' && senderInfo.canWrite && typeof msg.frameId === 'string' && msg.op && typeof msg.op === 'object') {
    relayToOthers(roomKey, senderInfo.userId, {
      type: 'op', userId: senderInfo.userId, frameId: msg.frameId, op: msg.op,
    });
    return;
  }
  // Spieluhr (Roadmap-Audit): leerer Ping ohne Payload – Client-Zustand
  // wird nie vertraut, der Server liest den aktuellen Stand frisch aus
  // der DB (Autorität bleibt Postgres) und relayt NUR das, an alle
  // anderen im selben Spiel-Room. Keine canWrite-Prüfung nötig, das ist
  // reines "aktuellen Stand nachfragen", keine Mutation.
  if (msg.type === 'clock' && senderInfo.resourceType === 'game') {
    const result = await pool.query(
      'SELECT clock_period, clock_status, clock_elapsed_seconds, clock_started_at FROM games WHERE id = $1',
      [senderInfo.resourceId]
    );
    const row = result.rows[0];
    if (!row) return;
    relayToOthers(roomKey, senderInfo.userId, {
      type: 'clock',
      clockPeriod: row.clock_period,
      clockStatus: row.clock_status,
      clockElapsedSeconds: row.clock_elapsed_seconds,
      clockStartedAt: row.clock_started_at,
    });
  }
}

export function attachPresenceServer(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch {
      socket.destroy();
      return;
    }
    if (url.pathname !== '/api/ws/presence') return; // fremder Upgrade-Pfad – nicht anfassen

    (async () => {
      const boardId = url.searchParams.get('boardId');
      const gameId = url.searchParams.get('gameId');
      const resourceType = boardId ? 'board' : gameId ? 'game' : null;
      const resourceId = boardId || gameId;

      const user = resourceType ? await authenticateUpgrade(req) : null;
      const canRead = user && (resourceType === 'board'
        ? await assertBoardAccess(resourceId, user.id, 'read')
        : await assertGameRead(resourceId, user.id));
      if (!resourceType || !user || !canRead) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      const canWrite = resourceType === 'board'
        ? await assertBoardAccess(resourceId, user.id, 'write')
        : await assertGameWrite(resourceId, user.id);
      const roomKey = `${resourceType}:${resourceId}`;
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, { user, roomKey, resourceType, resourceId, canWrite });
      });
    })().catch((err) => {
      logger.error('[presenceServer] upgrade error', err);
      socket.destroy();
    });
  });

  wss.on('connection', (ws, { user, roomKey, resourceType, resourceId, canWrite }) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    if (!rooms.has(roomKey)) rooms.set(roomKey, new Map());
    rooms.get(roomKey).set(ws, { userId: user.id, displayName: user.displayName, canWrite, resourceType, resourceId });
    broadcastPresence(roomKey);

    ws.on('message', (raw) => { handleClientMessage(roomKey, ws, raw).catch((err) => logger.error('[presenceServer] message error', err)); });

    ws.on('close', () => {
      const room = rooms.get(roomKey);
      if (!room) return;
      room.delete(ws);
      if (room.size === 0) rooms.delete(roomKey);
      else {
        broadcastPresence(roomKey);
        relayToOthers(roomKey, user.id, { type: 'cursorLeave', userId: user.id });
      }
    });
    ws.on('error', () => {});
  });

  // Tote Verbindungen (z.B. Laptop zugeklappt, kein sauberes close-Event)
  // regelmäßig aussortieren, sonst bleiben sie für immer als "anwesend" stehen.
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);
  wss.on('close', () => clearInterval(interval));

  return wss;
}
