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

    await request(app)
      .post(`/api/boards/${boardId}/lines`)
      .set('Cookie', owner.cookie)
      .send({ name: 'Sturm 1', color: '#3B82F6', type: 'offense', playerIds: [] });
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
    expect(board.lines).toHaveLength(1);
    expect(board.lines[0].name).toBe('Sturm 1');
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
        lines: [{ name: 'Import Linie', color: '#3B82F6', type: 'defense', playerIds: [] }],
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
    const linesRes = await pool.query('SELECT * FROM lines WHERE board_id = $1', [boardId]);
    expect(linesRes.rows).toHaveLength(1);
    expect(linesRes.rows[0].name).toBe('Import Linie');
  });

  it('überspringt beim erneuten Import ein bereits importiertes Board (Duplikat-Erkennung)', async () => {
    const boardName = `Dup Board ${Math.floor(Math.random() * 1e9)}`;
    const createdAt = new Date().toISOString();
    const zipBuffer = buildBackupZip({
      boards: [{
        name: boardName, fieldType: 'large', createdAt, frames: [], lines: [],
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
