import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'export-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

// Winzige 4x4 orange PNG (fest kodiert) – reicht als gültiges Eingabebild für FFmpeg
const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGP4n8IARwzEcQBRIhYxrrU5LQAAAABJRU5ErkJggg==';
const FRAMES = [TINY_PNG, TINY_PNG, TINY_PNG];

async function pollUntilDone(cookie, jobId, { timeoutMs = 20000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await request(app).get(`/api/export/status/${jobId}`).set('Cookie', cookie);
    if (res.body.status === 'done' || res.body.status === 'error') return res.body;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Export ${jobId} did not finish within ${timeoutMs}ms`);
}

let owner;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  const email = uniqueEmail('owner');
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123', birthday: '1990-01-01'});
  owner = { id: res.body.data.user.id, email, cookie: res.headers['set-cookie'][0] };
}, 30000);

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('POST /api/export/mp4', () => {
  it('erstellt ein MP4 mit Wasserzeichen und liefert es zum Download', async () => {
    const startRes = await request(app)
      .post('/api/export/mp4')
      .set('Cookie', owner.cookie)
      .send({ frames: FRAMES, fps: 4, width: 480, watermark: true });
    expect(startRes.status).toBe(202);
    const { jobId } = startRes.body;
    expect(jobId).toBeTruthy();

    const final = await pollUntilDone(owner.cookie, jobId);
    expect(final.status).toBe('done');

    const downloadRes = await request(app)
      .get(`/api/export/download/${jobId}`)
      .set('Cookie', owner.cookie)
      .buffer(true)
      .parse((response, callback) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers['content-disposition']).toMatch(/openfloorball-export\.mp4/);
    // Ein echtes FFmpeg-H.264-MP4 enthält den 'ftyp'-Box-Marker nahe dem
    // Dateianfang (üblicherweise ab Byte 4) – belegt, dass tatsächlich ein
    // valides MP4 erzeugt wurde, kein leerer/kaputter Output
    expect(downloadRes.body.length).toBeGreaterThan(0);
    expect(downloadRes.body.slice(0, 16).includes(Buffer.from('ftyp'))).toBe(true);
  }, 30000);

  it('erstellt ein MP4 ohne Wasserzeichen', async () => {
    const startRes = await request(app)
      .post('/api/export/mp4')
      .set('Cookie', owner.cookie)
      .send({ frames: FRAMES, fps: 4, width: 480, watermark: false });
    expect(startRes.status).toBe(202);
    const final = await pollUntilDone(owner.cookie, startRes.body.jobId);
    expect(final.status).toBe('done');
  }, 30000);

  it('lehnt weniger als 2 Frames mit 400 ab', async () => {
    const res = await request(app)
      .post('/api/export/mp4')
      .set('Cookie', owner.cookie)
      .send({ frames: [TINY_PNG] });
    expect(res.status).toBe(400);
  });

  it('lehnt nicht authentifizierte Anfragen mit 401 ab', async () => {
    const res = await request(app).post('/api/export/mp4').send({ frames: FRAMES });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/export/gif – Body-Größen-Limit (Regression)', () => {
  it('lehnt einen Body über 10kb nicht mit 413 ab (globaler JSON-Parser darf /api/export nicht mehr treffen)', async () => {
    // Realistische Frame-PNGs liegen deutlich über dem allgemeinen 10kb-
    // Limit (server.js, express.json) – nur der /export-Sub-Router erlaubt
    // bis zu 50mb. Muss NICHT gültiges PNG sein, hier geht es rein um den
    // Body-Parser vor dem eigentlichen Handler.
    const bigFrame = `data:image/png;base64,${'A'.repeat(60_000)}`;
    const res = await request(app)
      .post('/api/export/gif')
      .set('Cookie', owner.cookie)
      .send({ frames: [bigFrame, bigFrame], fps: 4, width: 480, loop: true });
    expect(res.status).not.toBe(413);
    expect(res.status).toBe(202);
  }, 15000);
});

describe('POST /api/export/gif (Regression nach outputPath-Refactor)', () => {
  it('erstellt weiterhin ein gültiges GIF', async () => {
    const startRes = await request(app)
      .post('/api/export/gif')
      .set('Cookie', owner.cookie)
      .send({ frames: FRAMES, fps: 4, width: 480, loop: true });
    expect(startRes.status).toBe(202);
    const final = await pollUntilDone(owner.cookie, startRes.body.jobId);
    expect(final.status).toBe('done');

    const downloadRes = await request(app)
      .get(`/api/export/download/${startRes.body.jobId}`)
      .set('Cookie', owner.cookie)
      .buffer(true)
      .parse((response, callback) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers['content-disposition']).toMatch(/openfloorball-export\.gif/);
    expect(downloadRes.body.slice(0, 3).toString()).toBe('GIF');
  }, 30000);
});
