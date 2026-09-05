import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';

const TEST_EMAIL_PREFIX = 'audit-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerAndLogin(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'Testpass123', birthday: '1990-01-01' });
  return { id: res.body.data.user.id, email, cookie: res.headers['set-cookie'][0] };
}

async function forceRole(userId, role) {
  await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, userId]);
}

// Audits werden teils NACH res.send geschrieben (CSV/PDF-Streaming) – der
// Client sieht die Antwort also ggf. vor dem Audit-INSERT. Deshalb kurz
// pollen statt auf eine feste Rechenreihenfolge zu vertrauen.
async function latestAudit(action, timeoutMs = 3000) {
  const start = Date.now();
  for (;;) {
    const result = await pool.query(
      'SELECT * FROM audit_log WHERE action = $1 ORDER BY created_at DESC LIMIT 1',
      [action]
    );
    if (result.rows.length > 0) return result.rows[0];
    if (Date.now() - start > timeoutMs) return null;
    await new Promise((r) => setTimeout(r, 50));
  }
}

// Minimales 1×1-PNG (data-URL) für den PDF-Export-Test.
const PNG_1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let admin;
let coachUser;
let victim;
let owner;
let teamId;
let coachMemberId;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  // audit_log persistiert über Testläufe hinweg (append-only) – Reste alter
  // Läufe (deren User längst gelöscht sind → actor_id NULL) würden sonst
  // latestAudit verwirren. Nur die hier geprüften Actions aufräumen.
  await pool.query(
    `DELETE FROM audit_log WHERE action IN (
       'team.member.role.update', 'team.member.remove', 'user.role.update',
       'export.games.csv', 'export.pdf', 'user.account.delete'
     )`
  );
  admin      = await registerAndLogin('admin');
  coachUser  = await registerAndLogin('coach');
  victim     = await registerAndLogin('victim');
  owner      = await registerAndLogin('owner');
  await forceRole(admin.id, 'admin');
  // Rolle neu ausstellen: Das register()-Cookie trägt die Rolle zum
  // Ausstellungszeitpunkt (siehe middleware/auth.js) – erst nach dem
  // Re-Login ist admin.cookie wirklich ein Admin-Cookie.
  const reloginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: admin.email, password: 'Testpass123' });
  admin.cookie = reloginRes.headers['set-cookie'][0];
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('Audit-Log (CLAUDE.md §19.5 Auditierbarkeit)', () => {
  it('protokolliert die Rollenänderung eines Team-Mitglieds mit Vorher/Nachher', async () => {
    const teamRes = await request(app)
      .post('/api/teams')
      .set('Cookie', owner.cookie)
      .send({ name: 'Audit HC' });
    expect(teamRes.status).toBe(201);
    teamId = teamRes.body.data._id;

    const inviteRes = await request(app)
      .post(`/api/teams/${teamId}/members`)
      .set('Cookie', owner.cookie)
      .send({ email: coachUser.email, role: 'member' });
    expect(inviteRes.status).toBe(201);
    coachMemberId = inviteRes.body.data._id;

    const putRes = await request(app)
      .put(`/api/teams/${teamId}/members/${coachMemberId}`)
      .set('Cookie', owner.cookie)
      .send({ role: 'coach' });
    expect(putRes.status).toBe(200);

    const row = await latestAudit('team.member.role.update');
    expect(row).not.toBeNull();
    expect(row.actor_id).toBe(owner.id);
    expect(row.resource_type).toBe('team');
    expect(row.resource_id).toBe(teamId);
    expect(row.before_json.role).toBe('member');
    expect(row.after_json.role).toBe('coach');
  });

  it('protokolliert das Entfernen eines Team-Mitglieds', async () => {
    const delRes = await request(app)
      .delete(`/api/teams/${teamId}/members/${coachMemberId}`)
      .set('Cookie', owner.cookie);
    expect(delRes.status).toBe(200);

    const row = await latestAudit('team.member.remove');
    expect(row).not.toBeNull();
    expect(row.actor_id).toBe(owner.id);
    expect(row.resource_id).toBe(teamId);
    expect(row.metadata.removedRole).toBe('coach');
    expect(row.metadata.memberUserId).toBe(coachUser.id);
  });

  it('protokolliert die Rollenänderung eines Users durch einen Admin', async () => {
    const putRes = await request(app)
      .put(`/api/admin/users/${victim.id}/role`)
      .set('Cookie', admin.cookie)
      .send({ role: 'user' });
    expect(putRes.status).toBe(200);

    const row = await latestAudit('user.role.update');
    expect(row).not.toBeNull();
    expect(row.actor_id).toBe(admin.id);
    expect(row.resource_id).toBe(victim.id);
    expect(row.after_json.role).toBe('user');
  });

  it('protokolliert einen CSV-Datenexport (Spiele-CSV)', async () => {
    const res = await request(app)
      .get('/api/export/games.csv')
      .set('Cookie', victim.cookie);
    expect(res.status).toBe(200);

    const row = await latestAudit('export.games.csv');
    expect(row).not.toBeNull();
    expect(row.actor_id).toBe(victim.id);
    expect(row.resource_type).toBe('export');
  });

  it('protokolliert einen PDF-Taktikblatt-Export', async () => {
    const res = await request(app)
      .post('/api/export/pdf')
      .set('Cookie', victim.cookie)
      .send({ boardName: 'Audit Board', frames: [{ image: PNG_1x1 }] });
    expect(res.status).toBe(200);

    const row = await latestAudit('export.pdf');
    expect(row).not.toBeNull();
    expect(row.actor_id).toBe(victim.id);
    expect(row.metadata.boardName).toBe('Audit Board');
    expect(row.metadata.frameCount).toBe(1);
  });

  it('legt Account-Löschung VOR dem eigentlichen Löschen an (FK auf Actor)', async () => {
    const user = await registerAndLogin('selfdel');
    const res = await request(app)
      .delete('/api/user/account')
      .set('Cookie', user.cookie)
      .send({ email: user.email });
    expect(res.status).toBe(200);

    const row = await latestAudit('user.account.delete');
    expect(row).not.toBeNull();
    // Der Actor wurde gelöscht → FK ON DELETE SET NULL hat die Referenz
    // genullt, der Beleg selbst bleibt aber erhalten (Archiv-Eigenschaft).
    expect(row.actor_id).toBeNull();
    expect(row.resource_id).toBe(user.id);
  });
});