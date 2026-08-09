/**
 * OpenFloorball – Development Seed
 * Legt Demo-Daten für Entwicklung an.
 * Nur im development-Modus ausführen!
 */
import 'dotenv/config';
import pool from './pool.js';
import { connectRedis } from './redis.js';
import { runMigrations } from './migrate.js';
import logger from '../utils/logger.js';
import bcrypt from 'bcrypt';

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    logger.error('Seed darf nicht in production ausgeführt werden!');
    process.exit(1);
  }

  logger.info('Starting seed...');

  // Migrationen sicherstellen
  await runMigrations();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Demo-Admin anlegen (falls noch nicht vorhanden)
    const existing = await client.query(`SELECT id FROM users WHERE email = $1`, ['admin@openfloorball.local']);
    let adminId;

    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash('Admin1234!', 12);
      const result = await client.query(`
        INSERT INTO users (email, password_hash, role, display_name)
        VALUES ($1, $2, 'admin', 'Demo Admin')
        RETURNING id
      `, ['admin@openfloorball.local', hash]);
      adminId = result.rows[0].id;
      logger.info(`Admin angelegt: admin@openfloorball.local / Admin1234!`);
    } else {
      adminId = existing.rows[0].id;
      logger.info('Admin existiert bereits, überspringe.');
    }

    // Demo-Settings
    await client.query(`
      INSERT INTO settings (user_id, preferences_json)
      VALUES ($1, $2)
      ON CONFLICT (user_id) DO NOTHING
    `, [adminId, JSON.stringify({
      theme: 'dark',
      language: 'de',
      fieldType: 'large',
      homeColor: '#003DA5',
      awayColor: '#E63946',
      ballColor: '#FFFFFF',
    })]);

    // Demo-Board
    const boardResult = await client.query(`
      INSERT INTO boards (user_id, name, field_type, description)
      VALUES ($1, 'Beispiel Spielfeld', 'large', 'Automatisch erstelltes Demo-Spielfeld')
      RETURNING id
    `, [adminId]);
    const boardId = boardResult.rows[0].id;

    // Demo-Frame (leeres Spielfeld)
    await client.query(`
      INSERT INTO frames (board_id, order_index, data_json, duration_ms)
      VALUES ($1, 0, $2, 1500)
    `, [boardId, JSON.stringify({
      players: [
        { id: 'home-1', team: 'home', position: 'GK', x: 60, y: 200, label: 'TW' },
        { id: 'home-2', team: 'home', position: 'DEF', x: 150, y: 100, label: 'RV' },
        { id: 'home-3', team: 'home', position: 'DEF', x: 150, y: 300, label: 'LV' },
        { id: 'home-4', team: 'home', position: 'MID', x: 280, y: 200, label: 'MI' },
        { id: 'home-5', team: 'home', position: 'FWD', x: 380, y: 130, label: 'RA' },
        { id: 'home-6', team: 'home', position: 'FWD', x: 380, y: 270, label: 'LA' },
      ],
      arrows: [],
      drawLines: [],
    })]);

    await client.query('COMMIT');
    logger.info('Seed abgeschlossen.');
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Seed fehlgeschlagen:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

connectRedis().catch(() => {}).finally(() => seed());
