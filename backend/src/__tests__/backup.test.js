import './setup.js';
import request from 'supertest';
import AdmZip from 'adm-zip';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';
import { BACKUP_FORMAT } from '../services/exportUserData.js';

const TEST_EMAIL_PREFIX = 'backup-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123' });
  return { id: res.body.data.user.id, email, cookie: res.headers['set-cookie'][0] };
}

async function forceRole(userId, role) {
  await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, userId]);
}

// Die Rolle steckt im JWT-Payload (Stand beim Login/Register), siehe
// middleware/auth.js – nach forceRole() muss neu eingeloggt werden, damit
// requireAdmin-geschützte Routen die aktualisierte Rolle sehen.
async function relogin(user, password = 'Testpass123') {
  const res = await request(app).post('/api/auth/login').send({ email: user.email, password });
  return { ...user, cookie: res.headers['set-cookie'][0] };
}

function buildBackupZip(overrides = {}) {
  const zip = new AdmZip();
  zip.addFile('backup.json', Buffer.from(JSON.stringify({
    format: BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    account: { email: 'irrelevant@example.com', name: null, role: 'user', createdAt: new Date().toISOString() },
    settings: {},
    boards: [],
    ...overrides,
  })));
  return zip.toBuffer();
}

let owner;
let admin;
let regular;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  owner = await registerAndLogin('owner');
  admin = await registerAndLogin('admin');
  regular = await registerAndLogin('regular');
  await forceRole(admin.id, 'admin');
  await forceRole(regular.id, 'user');
  admin = await relogin(admin);
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('GET /api/user/export', () => {
  let boardName;

  beforeAll(async () => {
    boardName = `Export Board ${Math.floor(Math.random() * 1e9)}`;
    const boardRes = await request(app)
      .post('/api/boards')
      .set('Cookie', owner.cookie)
      .send({ name: boardName, fieldType: 'large' });
    const boardId = boardRes.body.data._id;

    await request(app)
      .post(`/api/boards/${boardId}/frames`)
      .set('Cookie', owner.cookie)
      .send({ label: 'Frame 1', players: [], elements: [] });
  });

  it('liefert ein gültiges ZIP mit korrekten Daten', async () => {
    const res = await request(app)
      .get('/api/user/export')
      .set('Cookie', owner.cookie)
      .buffer(true)
      .parse((response, callback) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/zip');
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="openfloorball-backup-.*\.zip"/);

    const zip = new AdmZip(res.body);
    const entry = zip.getEntry('backup.json');
    expect(entry).toBeTruthy();
    const data = JSON.parse(entry.getData().toString('utf8'));

    expect(data.format).toBe(BACKUP_FORMAT);
    expect(data.account.email).toBe(owner.email);
    const board = data.boards.find((b) => b.name === boardName);
    expect(board).toBeTruthy();
    expect(board.fieldType).toBe('large');
    // Boards bekommen seit der Standard-Aufstellungs-Änderung automatisch
    // einen ersten Frame (Standard-Positionen) – hier zusätzlich zum
    // manuell angelegten "Frame 1" erwartet.
    expect(board.frames).toHaveLength(2);
    expect(board.frames.some((f) => f.label === 'Frame 1')).toBe(true);
  });

  it('lehnt nicht authentifizierte Anfragen mit 401 ab', async () => {
    const res = await request(app).get('/api/user/export');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/user/import', () => {
  it('stellt Boards, Frames und Lines wieder her', async () => {
    const boardName = `Import Board ${Math.floor(Math.random() * 1e9)}`;
    const createdAt = new Date().toISOString();
    const zipBuffer = buildBackupZip({
      boards: [{
        name: boardName,
        notes: 'Notiz',
        fieldType: '3v3',
        theme: 'dark',
        homeColor: '#1d4ed8',
        awayColor: '#dc2626',
        ballColor: '#ffffff',
        showGrid: true,
        showNames: true,
        namePosition: 'below',
        createdAt,
        frames: [{ label: 'F1', players: [], elements: [], duration: 1200 }],
      }],
    });

    const res = await request(app)
      .post('/api/user/import')
      .set('Cookie', regular.cookie)
      .attach('file', zipBuffer, 'backup.zip');

    expect(res.status).toBe(200);
    expect(res.body.data.imported).toBe(1);
    expect(res.body.data.skipped).toBe(0);

    const boardRes = await pool.query(
      'SELECT id FROM boards WHERE user_id = $1 AND name = $2',
      [regular.id, boardName]
    );
    expect(boardRes.rows).toHaveLength(1);
    const boardId = boardRes.rows[0].id;

    const framesRes = await pool.query('SELECT * FROM frames WHERE board_id = $1', [boardId]);
    expect(framesRes.rows).toHaveLength(1);
  });

  it('überspringt beim erneuten Import ein bereits importiertes Board (Duplikat-Erkennung)', async () => {
    const boardName = `Dup Board ${Math.floor(Math.random() * 1e9)}`;
    const createdAt = new Date().toISOString();
    const zipBuffer = buildBackupZip({
      boards: [{
        name: boardName, fieldType: 'large', createdAt, frames: [],
      }],
    });

    const first = await request(app)
      .post('/api/user/import')
      .set('Cookie', regular.cookie)
      .attach('file', zipBuffer, 'backup.zip');
    expect(first.body.data.imported).toBe(1);

    const second = await request(app)
      .post('/api/user/import')
      .set('Cookie', regular.cookie)
      .attach('file', zipBuffer, 'backup.zip');
    expect(second.status).toBe(200);
    expect(second.body.data.imported).toBe(0);
    expect(second.body.data.skipped).toBe(1);

    const boardRes = await pool.query(
      'SELECT id FROM boards WHERE user_id = $1 AND name = $2',
      [regular.id, boardName]
    );
    expect(boardRes.rows).toHaveLength(1);
  });

  it('lehnt ein Backup mit unbekanntem Format mit 400 ab', async () => {
    const zip = new AdmZip();
    zip.addFile('backup.json', Buffer.from(JSON.stringify({ format: 'irgendwas-anderes', boards: [] })));

    const res = await request(app)
      .post('/api/user/import')
      .set('Cookie', regular.cookie)
      .attach('file', zip.toBuffer(), 'backup.zip');
    expect(res.status).toBe(400);
  });

  it('lehnt eine ZIP ohne backup.json mit 400 ab', async () => {
    const zip = new AdmZip();
    zip.addFile('irgendwas.txt', Buffer.from('kein backup'));

    const res = await request(app)
      .post('/api/user/import')
      .set('Cookie', regular.cookie)
      .attach('file', zip.toBuffer(), 'backup.zip');
    expect(res.status).toBe(400);
  });

  it('lehnt eine Nicht-ZIP-Datei mit 400 ab', async () => {
    const res = await request(app)
      .post('/api/user/import')
      .set('Cookie', regular.cookie)
      .attach('file', Buffer.from('nur text'), { filename: 'backup.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
  });
});

describe('Kader + Lines im Export/Import-Roundtrip (fachlicher Umbau)', () => {
  let rosterUser;
  let lineId;

  beforeAll(async () => {
    rosterUser = await registerAndLogin('roster-lines');
    const p1 = await request(app).post('/api/roster').set('Cookie', rosterUser.cookie).send({ name: 'Max', jerseyNumber: 10, role: 'C' });
    const p2 = await request(app).post('/api/roster').set('Cookie', rosterUser.cookie).send({ name: 'Peter', jerseyNumber: 23, role: 'V' });

    const lineRes = await request(app).post('/api/lines').set('Cookie', rosterUser.cookie).send({ name: 'Export-Line', color: '#3B82F6', type: 'offense' });
    lineId = lineRes.body.data._id;
    await request(app).post(`/api/lines/${lineId}/players`).set('Cookie', rosterUser.cookie).send({ rosterPlayerId: p1.body.data._id });
    await request(app).post(`/api/lines/${lineId}/players`).set('Cookie', rosterUser.cookie).send({ rosterPlayerId: p2.body.data._id });
  });

  it('exportiert Kader und Lines als Top-Level-Felder (nicht mehr pro Board)', async () => {
    const res = await request(app)
      .get('/api/user/export')
      .set('Cookie', rosterUser.cookie)
      .buffer(true)
      .parse((response, callback) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    const zip = new AdmZip(res.body);
    const data = JSON.parse(zip.getEntry('backup.json').getData().toString('utf8'));

    expect(data.rosterPlayers).toHaveLength(2);
    expect(data.rosterPlayers.map((p) => p.name).sort()).toEqual(['Max', 'Peter']);
    expect(data.lines).toHaveLength(1);
    expect(data.lines[0].name).toBe('Export-Line');
    expect(data.lines[0].players.map((p) => p.name).sort()).toEqual(['Max', 'Peter']);
  });

  it('stellt Kader-Zuordnung beim Re-Import in einen frischen Account korrekt wieder her', async () => {
    const exportRes = await request(app)
      .get('/api/user/export')
      .set('Cookie', rosterUser.cookie)
      .buffer(true)
      .parse((response, callback) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    const zip = new AdmZip(exportRes.body);
    const backupBuffer = zip.getEntry('backup.json').getData();

    const freshUser = await registerAndLogin('fresh-import');
    const freshZip = new AdmZip();
    freshZip.addFile('backup.json', backupBuffer);

    const importRes = await request(app)
      .post('/api/user/import')
      .set('Cookie', freshUser.cookie)
      .attach('file', freshZip.toBuffer(), 'backup.zip');
    expect(importRes.status).toBe(200);

    const rosterRes = await request(app).get('/api/roster').set('Cookie', freshUser.cookie);
    expect(rosterRes.body.data).toHaveLength(2);

    const linesRes = await request(app).get('/api/lines').set('Cookie', freshUser.cookie);
    expect(linesRes.body.data).toHaveLength(1);
    expect(linesRes.body.data[0].players.map((p) => p.name).sort()).toEqual(['Max', 'Peter']);
    // Frisch importierte Lines/Kader-Einträge sind immer persönlich (kein
    // Team-Bezug wiederherstellbar, siehe exportUserData.js)
    expect(linesRes.body.data[0].teamId).toBeNull();
  });
});

describe('Formationen + Playbooks + Trainingspläne im Export/Import-Roundtrip', () => {
  let owner;
  let boardId;

  beforeAll(async () => {
    owner = await registerAndLogin('formations-playbooks-training');

    await request(app).post('/api/formations').set('Cookie', owner.cookie)
      .send({ name: 'Export-Formation', fieldType: 'small' });

    const pbRes = await request(app).post('/api/playbooks').set('Cookie', owner.cookie)
      .send({ name: 'Export-Playbook' });
    const playbookId = pbRes.body.data._id;

    const boardRes = await request(app).post('/api/boards').set('Cookie', owner.cookie)
      .send({ name: 'Export-Playbook-Board', fieldType: 'large', playbookId });
    boardId = boardRes.body.data._id;

    const sessionRes = await request(app).post('/api/trainings').set('Cookie', owner.cookie)
      .send({ name: 'Export-Trainingsplan', goal: 'Passspiel' });
    const sessionId = sessionRes.body.data._id;
    await request(app).post(`/api/trainings/${sessionId}/items`).set('Cookie', owner.cookie)
      .send({ boardId, durationMinutes: 20, note: 'Aufwärmen' });
  });

  async function exportBackupJson(cookie) {
    const res = await request(app)
      .get('/api/user/export')
      .set('Cookie', cookie)
      .buffer(true)
      .parse((response, callback) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    const zip = new AdmZip(res.body);
    return { data: JSON.parse(zip.getEntry('backup.json').getData().toString('utf8')), raw: zip.getEntry('backup.json').getData() };
  }

  it('exportiert Formationen, Playbooks und Trainingspläne als Top-Level-Felder', async () => {
    const { data } = await exportBackupJson(owner.cookie);

    expect(data.formations).toHaveLength(1);
    expect(data.formations[0]).toMatchObject({ name: 'Export-Formation', fieldType: 'small' });

    expect(data.playbooks).toHaveLength(1);
    expect(data.playbooks[0].name).toBe('Export-Playbook');

    const board = data.boards.find((b) => b.name === 'Export-Playbook-Board');
    expect(board.playbookName).toBe('Export-Playbook');

    expect(data.trainingSessions).toHaveLength(1);
    expect(data.trainingSessions[0].name).toBe('Export-Trainingsplan');
    expect(data.trainingSessions[0].items).toHaveLength(1);
    expect(data.trainingSessions[0].items[0]).toMatchObject({ boardName: 'Export-Playbook-Board', boardFieldType: 'large', note: 'Aufwärmen' });
  });

  it('stellt Playbook-/Trainingsplan-Zuordnung beim Re-Import in einen frischen Account korrekt wieder her', async () => {
    const { raw } = await exportBackupJson(owner.cookie);

    const freshUser = await registerAndLogin('fresh-import-fptr');
    const freshZip = new AdmZip();
    freshZip.addFile('backup.json', raw);

    const importRes = await request(app)
      .post('/api/user/import')
      .set('Cookie', freshUser.cookie)
      .attach('file', freshZip.toBuffer(), 'backup.zip');
    expect(importRes.status).toBe(200);

    const formationsRes = await request(app).get('/api/formations').set('Cookie', freshUser.cookie);
    expect(formationsRes.body.data).toHaveLength(1);
    expect(formationsRes.body.data[0].name).toBe('Export-Formation');

    const playbooksRes = await request(app).get('/api/playbooks').set('Cookie', freshUser.cookie);
    expect(playbooksRes.body.data).toHaveLength(1);
    const newPlaybookId = playbooksRes.body.data[0]._id;

    const boardsRes = await request(app).get('/api/boards').set('Cookie', freshUser.cookie);
    const importedBoard = boardsRes.body.data.find((b) => b.name === 'Export-Playbook-Board');
    expect(importedBoard.playbookId).toBe(newPlaybookId);

    const sessionsRes = await request(app).get('/api/trainings').set('Cookie', freshUser.cookie);
    expect(sessionsRes.body.data).toHaveLength(1);
    const newSessionId = sessionsRes.body.data[0]._id;

    const sessionDetailRes = await request(app).get(`/api/trainings/${newSessionId}`).set('Cookie', freshUser.cookie);
    expect(sessionDetailRes.body.data.items).toHaveLength(1);
    expect(sessionDetailRes.body.data.items[0].boardId).toBe(importedBoard._id);
  });

  it('überspringt ein Trainingsplan-Item, dessen Board nicht Teil des Imports war, ohne Fehler', async () => {
    const { raw } = await exportBackupJson(owner.cookie);
    const data = JSON.parse(raw.toString('utf8'));
    // Board absichtlich aus dem Import entfernen, Trainingsplan-Item bleibt
    // mit einer nun unauflösbaren Board-Referenz übrig.
    data.boards = data.boards.filter((b) => b.name !== 'Export-Playbook-Board');

    const freshUser = await registerAndLogin('fresh-import-orphan-item');
    const freshZip = new AdmZip();
    freshZip.addFile('backup.json', Buffer.from(JSON.stringify(data)));

    const importRes = await request(app)
      .post('/api/user/import')
      .set('Cookie', freshUser.cookie)
      .attach('file', freshZip.toBuffer(), 'backup.zip');
    expect(importRes.status).toBe(200);

    const sessionsRes = await request(app).get('/api/trainings').set('Cookie', freshUser.cookie);
    const newSessionId = sessionsRes.body.data[0]._id;
    const sessionDetailRes = await request(app).get(`/api/trainings/${newSessionId}`).set('Cookie', freshUser.cookie);
    expect(sessionDetailRes.body.data.items).toHaveLength(0);
  });
});

describe('Spiele + Trainings-Anwesenheit + Spielerentwicklungsnotizen im Export/Import-Roundtrip (Issue 026)', () => {
  let owner;
  let maxId;
  let gameId;
  let lineId;
  let sessionId;

  beforeAll(async () => {
    owner = await registerAndLogin('games-attendance-notes');

    const rosterRes = await request(app).post('/api/roster').set('Cookie', owner.cookie)
      .send({ name: 'Max', jerseyNumber: 10, role: 'C' });
    maxId = rosterRes.body.data._id;

    const gameRes = await request(app).post('/api/games').set('Cookie', owner.cookie)
      .send({ opponent: 'HC Rivals', playedAt: '2026-01-15' });
    gameId = gameRes.body.data._id;

    // Ein 'shot'-Ereignis mit outcome='goal' legt zusätzlich ein
    // Companion-'goal'-Ereignis an (ADR-0002) – ergibt 2 Events aus einem Call.
    await request(app).post(`/api/games/${gameId}/events`).set('Cookie', owner.cookie)
      .send({ eventType: 'shot', rosterPlayerId: maxId, outcome: 'goal', x: 0.5, y: 0.5 });

    await request(app).put(`/api/games/${gameId}/squad/${maxId}`).set('Cookie', owner.cookie)
      .send({ status: 'playing' });

    const lineRes = await request(app).post('/api/lines').set('Cookie', owner.cookie)
      .send({ name: 'Export-Match-Line', color: '#10b981', type: 'offense' });
    lineId = lineRes.body.data._id;
    await request(app).post(`/api/games/${gameId}/match-lines`).set('Cookie', owner.cookie)
      .send({ lineId });

    const sessionRes = await request(app).post('/api/trainings').set('Cookie', owner.cookie)
      .send({ name: 'Export-Anwesenheits-Training' });
    sessionId = sessionRes.body.data._id;
    await request(app).put(`/api/trainings/${sessionId}/attendance/${maxId}`).set('Cookie', owner.cookie)
      .send({ status: 'present' });

    await request(app).post(`/api/roster/${maxId}/notes`).set('Cookie', owner.cookie)
      .send({ note: 'Gute Trainingswoche, Abschluss verbessert.' });
  });

  async function exportBackupJson(cookie) {
    const res = await request(app)
      .get('/api/user/export')
      .set('Cookie', cookie)
      .buffer(true)
      .parse((response, callback) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    const zip = new AdmZip(res.body);
    return { data: JSON.parse(zip.getEntry('backup.json').getData().toString('utf8')), raw: zip.getEntry('backup.json').getData() };
  }

  it('exportiert Spiele (mit Events/Kader/Match-Lines), Trainings-Anwesenheit und Spielerentwicklungsnotizen', async () => {
    const { data } = await exportBackupJson(owner.cookie);

    expect(data.games).toHaveLength(1);
    const game = data.games[0];
    expect(game.opponent).toBe('HC Rivals');
    expect(game.playedAt).toBe('2026-01-15');
    // shot + companion goal
    expect(game.events).toHaveLength(2);
    expect(game.events.every((e) => e.player?.name === 'Max')).toBe(true);
    expect(game.squad).toEqual([{ name: 'Max', jerseyNumber: 10, role: 'C', status: 'playing', note: '' }]);
    expect(game.matchLines).toHaveLength(1);
    expect(game.matchLines[0].lineName).toBe('Export-Match-Line');

    const session = data.trainingSessions.find((s) => s.name === 'Export-Anwesenheits-Training');
    expect(session.attendance).toEqual([{ name: 'Max', jerseyNumber: 10, role: 'C', status: 'present', note: '' }]);

    const player = data.rosterPlayers.find((p) => p.name === 'Max');
    expect(player.developmentNotes).toHaveLength(1);
    expect(player.developmentNotes[0].note).toBe('Gute Trainingswoche, Abschluss verbessert.');
  });

  it('stellt Spiele/Anwesenheit/Entwicklungsnotizen beim Re-Import in einen frischen Account korrekt wieder her', async () => {
    const { raw } = await exportBackupJson(owner.cookie);

    const freshUser = await registerAndLogin('fresh-import-games');
    const freshZip = new AdmZip();
    freshZip.addFile('backup.json', raw);

    const importRes = await request(app)
      .post('/api/user/import')
      .set('Cookie', freshUser.cookie)
      .attach('file', freshZip.toBuffer(), 'backup.zip');
    expect(importRes.status).toBe(200);

    const gamesRes = await request(app).get('/api/games').set('Cookie', freshUser.cookie);
    expect(gamesRes.body.data).toHaveLength(1);
    const newGameId = gamesRes.body.data[0]._id;
    expect(gamesRes.body.data[0].opponent).toBe('HC Rivals');
    expect(gamesRes.body.data[0].playedAt).toBe('2026-01-15');

    const rosterRes = await request(app).get('/api/roster').set('Cookie', freshUser.cookie);
    const newMax = rosterRes.body.data.find((p) => p.name === 'Max');
    expect(newMax).toBeTruthy();

    const eventsRes = await request(app).get(`/api/games/${newGameId}/events`).set('Cookie', freshUser.cookie);
    expect(eventsRes.body.data).toHaveLength(2);
    expect(eventsRes.body.data.every((e) => e.rosterPlayerId === newMax._id)).toBe(true);

    const squadRes = await request(app).get(`/api/games/${newGameId}/squad`).set('Cookie', freshUser.cookie);
    const maxSquad = squadRes.body.data.find((s) => s.rosterPlayerId === newMax._id);
    expect(maxSquad.status).toBe('playing');

    const matchLinesRes = await request(app).get(`/api/games/${newGameId}/match-lines`).set('Cookie', freshUser.cookie);
    expect(matchLinesRes.body.data).toHaveLength(1);
    expect(matchLinesRes.body.data[0].lineName).toBe('Export-Match-Line');

    const sessionsRes = await request(app).get('/api/trainings').set('Cookie', freshUser.cookie);
    const newSessionId = sessionsRes.body.data.find((s) => s.name === 'Export-Anwesenheits-Training')._id;
    const attendanceRes = await request(app).get(`/api/trainings/${newSessionId}/attendance`).set('Cookie', freshUser.cookie);
    const maxAttendance = attendanceRes.body.data.find((a) => a.rosterPlayerId === newMax._id);
    expect(maxAttendance.status).toBe('present');

    const notesRes = await request(app).get(`/api/roster/${newMax._id}/notes`).set('Cookie', freshUser.cookie);
    expect(notesRes.body.data).toHaveLength(1);
    expect(notesRes.body.data[0].note).toBe('Gute Trainingswoche, Abschluss verbessert.');
  });

  it('überspringt ein bereits importiertes Spiel beim erneuten Import (Duplikat-Erkennung)', async () => {
    const { raw } = await exportBackupJson(owner.cookie);
    const data = JSON.parse(raw.toString('utf8'));

    const freshUser = await registerAndLogin('fresh-import-games-dup');
    const zip1 = new AdmZip();
    zip1.addFile('backup.json', Buffer.from(JSON.stringify(data)));
    const first = await request(app).post('/api/user/import').set('Cookie', freshUser.cookie).attach('file', zip1.toBuffer(), 'backup.zip');
    expect(first.body.data.imported).toBeGreaterThanOrEqual(1);

    const zip2 = new AdmZip();
    zip2.addFile('backup.json', Buffer.from(JSON.stringify(data)));
    const second = await request(app).post('/api/user/import').set('Cookie', freshUser.cookie).attach('file', zip2.toBuffer(), 'backup.zip');
    expect(second.status).toBe(200);

    const gamesRes = await request(app).get('/api/games').set('Cookie', freshUser.cookie);
    expect(gamesRes.body.data).toHaveLength(1);
  });
});

describe('Admin Backup-Config', () => {
  it('lehnt Nicht-Admins mit 403 ab', async () => {
    const res = await request(app).get('/api/admin/backup-config').set('Cookie', regular.cookie);
    expect(res.status).toBe(403);
  });

  it('liefert die aktuelle Konfiguration für Admins', async () => {
    const res = await request(app).get('/api/admin/backup-config').set('Cookie', admin.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('enabled');
    expect(res.body.data).toHaveProperty('schedule');
    expect(res.body.data).toHaveProperty('retention');
  });

  it('aktualisiert die Konfiguration und plant den Cron neu', async () => {
    const res = await request(app)
      .put('/api/admin/backup-config')
      .set('Cookie', admin.cookie)
      .send({ enabled: true, schedule: 'weekly', retention: 14 });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ enabled: true, schedule: 'weekly', retention: 14 });

    const getRes = await request(app).get('/api/admin/backup-config').set('Cookie', admin.cookie);
    expect(getRes.body.data).toEqual({ enabled: true, schedule: 'weekly', retention: 14 });

    // Für nachfolgende Testläufe / andere Suiten in den Standardzustand zurücksetzen
    await request(app)
      .put('/api/admin/backup-config')
      .set('Cookie', admin.cookie)
      .send({ enabled: false, schedule: 'daily', retention: 7 });
  });

  it('lehnt einen ungültigen Rhythmus mit 422 ab', async () => {
    const res = await request(app)
      .put('/api/admin/backup-config')
      .set('Cookie', admin.cookie)
      .send({ enabled: true, schedule: 'monatlich', retention: 7 });
    expect(res.status).toBe(422);
  });

  it('lehnt eine Aufbewahrung außerhalb 1-90 mit 422 ab', async () => {
    const res = await request(app)
      .put('/api/admin/backup-config')
      .set('Cookie', admin.cookie)
      .send({ enabled: true, schedule: 'daily', retention: 0 });
    expect(res.status).toBe(422);
  });
});

describe('POST /api/admin/backup-run', () => {
  it('lehnt Nicht-Admins mit 403 ab', async () => {
    const res = await request(app).post('/api/admin/backup-run').set('Cookie', regular.cookie);
    expect(res.status).toBe(403);
  });

  it('lehnt nicht authentifizierte Anfragen mit 401 ab', async () => {
    const res = await request(app).post('/api/admin/backup-run');
    expect(res.status).toBe(401);
  });

  it('führt für Admins sofort einen Backup-Lauf aus und liefert count+timestamp', async () => {
    const res = await request(app).post('/api/admin/backup-run').set('Cookie', admin.cookie);
    expect(res.status).toBe(200);
    expect(typeof res.body.data.count).toBe('number');
    expect(res.body.data.count).toBeGreaterThanOrEqual(3); // owner, admin, regular existieren mindestens
    expect(res.body.data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('funktioniert auch, wenn automatische Backups deaktiviert sind (unabhängig vom Zeitplan)', async () => {
    await request(app)
      .put('/api/admin/backup-config')
      .set('Cookie', admin.cookie)
      .send({ enabled: false, schedule: 'daily', retention: 7 });

    const res = await request(app).post('/api/admin/backup-run').set('Cookie', admin.cookie);
    expect(res.status).toBe(200);
  });
});
