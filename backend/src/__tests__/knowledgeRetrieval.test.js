import './setup.js';
import request from 'supertest';
import app from '../server.js';
import pool from '../db/pool.js';
import redisClient, { connectRedis } from '../db/redis.js';
import { runMigrations } from '../db/migrate.js';
import { extractKeywords, findRelevantItems } from '../services/ai/knowledgeRetrieval.js';

const TEST_EMAIL_PREFIX = 'knowledge-test-';
const uniqueEmail = (tag) => `${TEST_EMAIL_PREFIX}${tag}-${Math.floor(Math.random() * 1e9)}@example.com`;

async function registerUser(tag) {
  const email = uniqueEmail(tag);
  const res = await request(app).post('/api/auth/register').send({ email, password: 'Testpass123', birthday: '1990-01-01'});
  return res.body.data.user.id;
}

let userA;
let userB;
let teamId;

beforeAll(async () => {
  await connectRedis();
  await runMigrations();
  userA = await registerUser('a');
  userB = await registerUser('b');

  const teamResult = await pool.query(
    'INSERT INTO teams (name, created_by) VALUES ($1, $2) RETURNING id',
    ['Wissenstest-Team', userB]
  );
  teamId = teamResult.rows[0].id;
  await pool.query(
    'INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3)',
    [teamId, userA, 'member']
  );
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%`]);
  await pool.end();
  await redisClient.quit();
});

describe('extractKeywords', () => {
  it('entfernt Stoppwörter und zu kurze Tokens', () => {
    expect(extractKeywords('Welche Übungen nutzen wir für Ballbesitz?')).toEqual(['übungen', 'ballbesitz']);
  });

  it('dedupliziert und begrenzt auf maximal 8 Schlüsselwörter', () => {
    const question = Array.from({ length: 12 }, (_, i) => `begriff${i}`).join(' ') + ' begriff0';
    const keywords = extractKeywords(question);
    expect(keywords.length).toBeLessThanOrEqual(8);
    expect(new Set(keywords).size).toBe(keywords.length);
  });

  it('liefert eine leere Liste bei einer Frage nur aus Stoppwörtern', () => {
    expect(extractKeywords('Was ist und wie für die')).toEqual([]);
  });
});

describe('findRelevantItems', () => {
  it('liefert leere Listen ohne DB-Zugriff, wenn keine Schlüsselwörter übrig bleiben', async () => {
    const result = await findRelevantItems(userA, 'Was ist und wie für die');
    expect(result).toEqual({ boards: [], trainings: [], libraryEntries: [] });
  });

  it('findet ein eigenes Board über Namen/Notizen, aber kein fremdes ohne Freigabe', async () => {
    await pool.query(
      `INSERT INTO boards (user_id, name, notes) VALUES ($1, $2, $3)`,
      [userA, 'Powerplay Variante Zonensicherung', '']
    );
    await pool.query(
      `INSERT INTO boards (user_id, name, notes) VALUES ($1, $2, $3)`,
      [userB, 'Fremdes Zonensicherung Board', '']
    );

    const result = await findRelevantItems(userA, 'Welche Zonensicherung haben wir gespeichert?');
    expect(result.boards).toHaveLength(1);
    expect(result.boards[0].name).toBe('Powerplay Variante Zonensicherung');
  });

  it('findet ein über board_collaborators geteiltes fremdes Board', async () => {
    const boardResult = await pool.query(
      `INSERT INTO boards (user_id, name, notes) VALUES ($1, $2, $3) RETURNING id`,
      [userB, 'Geteiltes Forechecking Board', '']
    );
    await pool.query(
      `INSERT INTO board_collaborators (board_id, user_id, permission) VALUES ($1, $2, 'read')`,
      [boardResult.rows[0].id, userA]
    );

    const result = await findRelevantItems(userA, 'Forechecking Systeme?');
    expect(result.boards.some((b) => b.name === 'Geteiltes Forechecking Board')).toBe(true);
  });

  it('findet eine team-geteilte Trainingseinheit über die gemeinsame Teammitgliedschaft', async () => {
    await pool.query(
      `INSERT INTO training_sessions (user_id, team_id, name, goal) VALUES ($1, $2, $3, $4)`,
      [userB, teamId, 'Ballbesitz-Einheit', 'Ballbesitz verbessern']
    );

    const result = await findRelevantItems(userA, 'Welche Übungen nutzen wir für Ballbesitz?');
    expect(result.trainings.some((t) => t.name === 'Ballbesitz-Einheit')).toBe(true);
  });

  it('findet Bibliothekseinträge instanzweit, unabhängig vom Besitzer', async () => {
    await pool.query(
      `INSERT INTO library_entries (owner_id, name, goal) VALUES ($1, $2, $3)`,
      [userB, 'Passübung Dreieck', 'Ballbesitz unter Druck']
    );

    const result = await findRelevantItems(userA, 'Passübungen für Ballbesitz');
    expect(result.libraryEntries.some((l) => l.name === 'Passübung Dreieck')).toBe(true);
  });
});
