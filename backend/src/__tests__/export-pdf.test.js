import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'export-pdf-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

// Winzige 4x4 orange PNG (fest kodiert) – reicht als gültiges Bild für pdfkit
const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGP4n8IARwzEcQBRIhYxrrU5LQAAAABJRU5ErkJggg==';
const frame = (note) => ({ image: TINY_PNG, note });

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

// Zählt die tatsächlichen Seiten über den /Count-Eintrag des Pages-Baums –
// belegt echte Seitenzahl, nicht nur "irgendein PDF kam zurück" (siehe
// Bug: Fußzeile lag ursprünglich außerhalb der Marge und löste bei jeder
// Seite zwei zusätzliche pdfkit-Auto-Seitenumbrüche aus)
function pageCount(buf) {
  const match = /\/Count (\d+)/.exec(buf.toString('latin1'));
  return match ? Number(match[1]) : null;
}

async function requestPdf(cookie, body) {
  return request(app)
    .post('/api/export/pdf')
    .set('Cookie', cookie)
    .buffer(true)
    .parse((response, callback) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => callback(null, Buffer.concat(chunks)));
    })
    .send(body);
}

describe('POST /api/export/pdf', () => {
  it('erstellt ein valides PDF mit 1 Frame (framesPerPage=1)', async () => {
    const res = await requestPdf(owner.cookie, {
      boardName: 'Test Board',
      frames: [frame('Startaufstellung')],
      framesPerPage: 1,
      paperSize: 'a4',
      language: 'de',
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toMatch(/openfloorball-taktikblatt\.pdf/);
    expect(res.body.slice(0, 5).toString()).toBe('%PDF-');
    expect(pageCount(res.body)).toBe(1);
  });

  it('erstellt ein valides PDF mit 3 Frames (framesPerPage=2, mehrseitig)', async () => {
    const res = await requestPdf(owner.cookie, {
      frames: [frame('Frame 1'), frame(''), frame('Frame 3')],
      framesPerPage: 2,
    });
    expect(res.status).toBe(200);
    expect(res.body.slice(0, 5).toString()).toBe('%PDF-');
    expect(pageCount(res.body)).toBe(2);
  });

  it('erstellt ein valides PDF mit 4 Frames (framesPerPage=4)', async () => {
    const res = await requestPdf(owner.cookie, {
      frames: [frame(), frame(), frame(), frame()],
      framesPerPage: 4,
      paperSize: 'letter',
      language: 'en',
    });
    expect(res.status).toBe(200);
    expect(res.body.slice(0, 5).toString()).toBe('%PDF-');
    expect(pageCount(res.body)).toBe(1);
  });

  it('lehnt 0 Frames mit 400 ab', async () => {
    const res = await request(app)
      .post('/api/export/pdf')
      .set('Cookie', owner.cookie)
      .send({ frames: [] });
    expect(res.status).toBe(400);
  });

  it('lehnt mehr als 60 Frames mit 400 ab', async () => {
    const res = await request(app)
      .post('/api/export/pdf')
      .set('Cookie', owner.cookie)
      .send({ frames: Array.from({ length: 61 }, () => frame()) });
    expect(res.status).toBe(400);
  });

  it('lehnt nicht authentifizierte Anfragen mit 401 ab', async () => {
    const res = await request(app).post('/api/export/pdf').send({ frames: [frame()] });
    expect(res.status).toBe(401);
  });
});
