import './setup.js';
import request from 'supertest';
import { createHash, randomBytes } from 'crypto';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'auth-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('POST /api/auth/register', () => {
  it('legt einen neuen User an und setzt ein Cookie', async () => {
    const email = uniqueEmail('register');
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'Testpass123' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(email);
    expect(res.body.data.user.password_hash).toBeUndefined();
    expect(res.headers['set-cookie']?.[0]).toMatch(/^token=/);
  });

  it('lehnt eine bereits registrierte E-Mail mit 409 ab', async () => {
    const email = uniqueEmail('dup');
    await request(app).post('/api/auth/register').send({ email, password: 'Testpass123' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'AnderesPass123' });

    expect(res.status).toBe(409);
  });

  it('lehnt ungültige E-Mail-Adressen mit 422 ab', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'keine-email', password: 'Testpass123' });

    expect(res.status).toBe(422);
  });

  it('lehnt zu schwache Passwörter mit 422 ab', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: uniqueEmail('weak'), password: 'nurklein' });

    expect(res.status).toBe(422);
  });

  it('registriert erfolgreich, auch wenn bereits ein Admin existiert (Admin-Benachrichtigungsmail)', async () => {
    // Stellt sicher, dass notifyAdminsOfNewUser() (Betreiber-Wunsch:
    // Mail an alle Admins bei jeder Neuregistrierung) die Registrierung
    // selbst nicht beeinträchtigt, unabhängig von der Testreihenfolge.
    const adminEmail = uniqueEmail('existing-admin');
    const adminRes = await request(app).post('/api/auth/register').send({ email: adminEmail, password: 'Testpass123' });
    await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [adminRes.body.data.user.id]);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: uniqueEmail('second'), name: 'Zweiter Nutzer', password: 'Testpass123' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});

describe('POST /api/auth/login', () => {
  const email = uniqueEmail('login');
  const password = 'Testpass123';

  beforeAll(async () => {
    await request(app).post('/api/auth/register').send({ email, password });
  });

  it('meldet mit korrekten Zugangsdaten an und setzt ein Cookie', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(email);
    expect(res.headers['set-cookie']?.[0]).toMatch(/^token=/);
  });

  it('lehnt falsches Passwort mit 401 ab', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password: 'FalschesPass123' });
    expect(res.status).toBe(401);
  });

  it('lehnt unbekannte E-Mail mit 401 ab (kein User-Enumeration-Hinweis)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: uniqueEmail('unknown'), password: 'Testpass123' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Ungültige Anmeldedaten');
  });
});

describe('GET /api/auth/me + POST /api/auth/logout', () => {
  const email = uniqueEmail('me');
  const password = 'Testpass123';
  let cookie;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/register').send({ email, password });
    cookie = res.headers['set-cookie'][0];
  });

  it('lehnt /me ohne Cookie mit 401 ab', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('liefert die eigenen Userdaten mit gültigem Cookie', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(email);
  });

  it('invalidiert das Cookie nach Logout (Redis-Blacklist)', async () => {
    const logoutRes = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(logoutRes.status).toBe(200);

    const meRes = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(meRes.status).toBe(401);
  });
});

describe('POST /api/auth/forgot-password', () => {
  it('lehnt eine ungültige E-Mail-Adresse mit 422 ab', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'keine-email' });
    expect(res.status).toBe(422);
  });

  it('liefert dieselbe generische Erfolgsmeldung für eine existierende Adresse', async () => {
    const email = uniqueEmail('forgot-existing');
    await request(app).post('/api/auth/register').send({ email, password: 'Testpass123' });

    const res = await request(app).post('/api/auth/forgot-password').send({ email });
    expect(res.status).toBe(200);
    expect(res.body.data.message).toMatch(/falls ein konto/i);
  });

  it('liefert dieselbe generische Erfolgsmeldung für eine nicht existierende Adresse (keine Enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: uniqueEmail('nichtvorhanden') });
    expect(res.status).toBe(200);
    expect(res.body.data.message).toMatch(/falls ein konto/i);
  });

  it('legt für eine existierende Adresse einen Reset-Token an', async () => {
    const email = uniqueEmail('forgot-token');
    const registerRes = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123' });
    const userId = registerRes.body.data.user.id;

    await request(app).post('/api/auth/forgot-password').send({ email });

    const tokenRows = await pool.query('SELECT id FROM password_reset_tokens WHERE user_id = $1', [userId]);
    expect(tokenRows.rows.length).toBe(1);
  });

  it('macht bei einem erneuten Request den vorherigen Token dieses Nutzers ungültig (nur ein aktiver Token)', async () => {
    const email = uniqueEmail('forgot-superseded');
    const registerRes = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123' });
    const userId = registerRes.body.data.user.id;

    await request(app).post('/api/auth/forgot-password').send({ email });
    const firstTokenRows = await pool.query('SELECT id FROM password_reset_tokens WHERE user_id = $1', [userId]);
    const firstTokenId = firstTokenRows.rows[0].id;

    await request(app).post('/api/auth/forgot-password').send({ email });
    const secondTokenRows = await pool.query('SELECT id FROM password_reset_tokens WHERE user_id = $1', [userId]);

    expect(secondTokenRows.rows.length).toBe(1);
    expect(secondTokenRows.rows[0].id).not.toBe(firstTokenId);
  });
});

describe('POST /api/auth/reset-password', () => {
  // hashResetToken() in routes/auth.js ist nicht exportiert (bewusst kein
  // Test-Only-Export in Produktionscode) – dieselbe sha256-Logik hier
  // nachgebildet, um einen bekannten Rohtoken direkt in die Tabelle zu
  // legen, statt den unzustellbaren Mail-Versand abfangen zu müssen.
  function hashToken(rawToken) {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  async function insertResetToken(userId, { expiresInMs = 60 * 60 * 1000 } = {}) {
    const rawToken = randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [userId, hashToken(rawToken), new Date(Date.now() + expiresInMs)]
    );
    return rawToken;
  }

  it('lehnt ein fehlendes Token mit 422 ab', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({ newPassword: 'Testpass123' });
    expect(res.status).toBe(422);
  });

  it('lehnt ein zu schwaches neues Passwort mit 422 ab', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({ token: 'irgendein-token', newPassword: 'zuschwach' });
    expect(res.status).toBe(422);
  });

  it('lehnt ein unbekanntes Token mit 400 ab', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'nicht-existierendes-token', newPassword: 'NeuesTestpass123' });
    expect(res.status).toBe(400);
  });

  it('lehnt ein abgelaufenes Token mit 400 ab', async () => {
    const email = uniqueEmail('reset-expired');
    const registerRes = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123' });
    const userId = registerRes.body.data.user.id;
    const rawToken = await insertResetToken(userId, { expiresInMs: -1000 }); // bereits abgelaufen

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, newPassword: 'NeuesTestpass123' });
    expect(res.status).toBe(400);
  });

  it('setzt mit einem gültigen Token das Passwort erfolgreich zurück und erlaubt Login mit dem neuen Passwort', async () => {
    const email = uniqueEmail('reset-valid');
    const registerRes = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123' });
    const userId = registerRes.body.data.user.id;
    const rawToken = await insertResetToken(userId);

    const resetRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, newPassword: 'NeuesTestpass123' });
    expect(resetRes.status).toBe(200);

    const oldLoginRes = await request(app).post('/api/auth/login').send({ email, password: 'Testpass123' });
    expect(oldLoginRes.status).toBe(401);

    const newLoginRes = await request(app).post('/api/auth/login').send({ email, password: 'NeuesTestpass123' });
    expect(newLoginRes.status).toBe(200);
  });

  it('lehnt eine zweite Verwendung desselben Tokens ab (einmal verwendbar)', async () => {
    const email = uniqueEmail('reset-single-use');
    const registerRes = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123' });
    const userId = registerRes.body.data.user.id;
    const rawToken = await insertResetToken(userId);

    const firstRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, newPassword: 'ErstesNeuesPass123' });
    expect(firstRes.status).toBe(200);

    const secondRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, newPassword: 'ZweitesNeuesPass123' });
    expect(secondRes.status).toBe(400);
  });
});
