import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';
import { BACKUP_FORMAT } from '../services/exportUserData.js';
import { anonymizeIp } from '../utils/anonymizeIp.js';

const TEST_EMAIL_PREFIX = 'privacy-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

let owner;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  const email = uniqueEmail('owner');
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123', birthday: '1990-01-01'});
  owner = { id: res.body.data.user.id, email, cookie: res.headers['set-cookie'][0] };
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('GET /api/user/data (Auskunft, Art. 15 DSGVO)', () => {
  it('liefert die eigenen Daten als JSON', async () => {
    const res = await request(app).get('/api/user/data').set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.format).toBe(BACKUP_FORMAT);
    expect(res.body.data.account.email).toBe(owner.email);
    expect(Array.isArray(res.body.data.boards)).toBe(true);
    expect(res.body.data.settings).toBeDefined();
  });

  it('lehnt nicht authentifizierte Anfragen mit 401 ab', async () => {
    const res = await request(app).get('/api/user/data');
    expect(res.status).toBe(401);
  });
});

describe('anonymizeIp()', () => {
  it('kappt das letzte Oktett einer IPv4-Adresse', () => {
    expect(anonymizeIp('203.0.113.45')).toBe('203.0.113.0');
  });

  it('kappt das letzte Oktett einer IPv4-mapped-IPv6-Adresse', () => {
    expect(anonymizeIp('::ffff:203.0.113.45')).toBe('203.0.113.0');
  });

  it('behält nur die ersten 3 Gruppen einer IPv6-Adresse', () => {
    expect(anonymizeIp('2001:db8:85a3:8a2e:0:8a2e:370:7334')).toBe('2001:db8:85a3::');
  });

  it('lässt Loopback-Adressen unverändert', () => {
    expect(anonymizeIp('::1')).toBe('::1');
    expect(anonymizeIp('127.0.0.1')).toBe('127.0.0.1');
  });

  it('gibt leere/undefined Eingaben unverändert zurück', () => {
    expect(anonymizeIp(undefined)).toBeUndefined();
    expect(anonymizeIp('')).toBe('');
  });
});
