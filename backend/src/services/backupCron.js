/**
 * backupCron – Automatische, periodische Backups aller Nutzer (Issue #21)
 *
 * Liest die Konfiguration aus `app_config` (Singleton-Tabelle) und plant
 * einen node-cron-Job entsprechend neu. Bei Trigger wird für jeden User
 * ein ZIP (gleiche Struktur wie der manuelle Export) unter
 * /app/backups/<ISO-Timestamp>/<userId>.zip abgelegt; danach werden
 * Zeitstempel-Verzeichnisse über die konfigurierte Aufbewahrung hinaus
 * gelöscht (älteste zuerst).
 *
 * `runBackupNow()` läuft unabhängig davon, ob `backup_enabled` gesetzt ist
 * (nur `rescheduleBackupCron()` prüft das) – so kann sie auch für den
 * manuellen "Jetzt ausführen"-Button im Admin-Bereich direkt
 * wiederverwendet werden, ohne dass automatische Backups aktiv sein müssen.
 */
import fs from 'fs/promises';
import path from 'path';
import { ZipArchive } from 'archiver';
import { createWriteStream } from 'fs';
import cron from 'node-cron';
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { buildUserExport } from './exportUserData.js';

const BACKUPS_DIR = process.env.BACKUPS_DIR || '/app/backups';

let currentTask = null;

async function getConfig() {
  const result = await pool.query('SELECT * FROM app_config LIMIT 1');
  return result.rows[0];
}

async function writeZip(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  return new Promise((resolve, reject) => {
    const output = createWriteStream(filePath);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.append(JSON.stringify(data, null, 2), { name: 'backup.json' });
    archive.finalize();
  });
}

async function enforceRetention(retention) {
  const entries = await fs.readdir(BACKUPS_DIR, { withFileTypes: true }).catch(() => []);
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort(); // ISO-Namen sortieren lexikografisch = chronologisch
  const toDelete = dirs.slice(0, Math.max(0, dirs.length - retention));
  for (const name of toDelete) {
    await fs.rm(path.join(BACKUPS_DIR, name), { recursive: true, force: true });
    logger.info(`Backup cleanup: removed ${name}`);
  }
}

export async function runBackupNow() {
  const config = await getConfig();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(BACKUPS_DIR, timestamp);

  const usersResult = await pool.query('SELECT id FROM users');
  let count = 0;
  for (const { id } of usersResult.rows) {
    try {
      const data = await buildUserExport(id);
      await writeZip(path.join(runDir, `${id}.zip`), data);
      count++;
    } catch (err) {
      logger.error(`Backup failed for user ${id}:`, err);
    }
  }

  await enforceRetention(config?.backup_retention ?? 7);
  logger.info(`Automatic backup run complete: ${count} user(s) backed up`);
  return { count, timestamp: new Date().toISOString() };
}

function cronExpressionFor(schedule) {
  // 03:00 Uhr täglich bzw. jeden Sonntag
  return schedule === 'weekly' ? '0 3 * * 0' : '0 3 * * *';
}

export async function rescheduleBackupCron() {
  if (currentTask) {
    currentTask.stop();
    currentTask = null;
  }

  const config = await getConfig();
  if (!config?.backup_enabled) {
    logger.info('Automatic backups disabled.');
    return;
  }

  const expr = cronExpressionFor(config.backup_schedule);
  currentTask = cron.schedule(expr, () => {
    runBackupNow().catch((err) => logger.error('Backup run error:', err));
  });
  logger.info(`Automatic backups scheduled: ${config.backup_schedule} (${expr})`);
}
