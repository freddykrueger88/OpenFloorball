/**
 * LineStatsSection – Line-Statistiken für ein konkretes Spiel
 * (Statistik-Architektur Phase 2). Struktur analog
 * MatchSquadSection.jsx. Berechnung läuft zentral im Backend
 * (statisticsEngine.calculateLineStats) – bewusst kein eigenes
 * Frontend-Duplikat der Gruppierungs-/Zeitfenster-Logik.
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { useMatchLines } from '../../hooks/useMatchLines.js';
import styles from './LineStatsSection.module.css';

function formatDuration(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(Math.floor(seconds % 60)).padStart(2, '0');
  return `${m}:${s}`;
}

export default function LineStatsSection({ gameId, events, activeLineId }) {
  const { t } = useTranslation();
  const { lineStats, loading, error, fetchLineStats } = useMatchLines(gameId);

  // Neu berechnen, sobald sich Tor-relevante Ereignisse ODER die aktive
  // Line ändern – kein Ticker, kein Polling.
  useEffect(() => { fetchLineStats().catch(() => {}); }, [fetchLineStats, events.length, activeLineId]);

  if (!loading && lineStats.length === 0) return null;

  return (
    <section className={styles.panel} aria-label={t('lineStats.ariaLabel')}>
      <h3 className={styles.heading}>{t('lineStats.title')}</h3>

      {error && <p className={styles.msgError}><AlertTriangle size={16} aria-hidden="true" /> {error}</p>}

      <ul className={styles.list} role="list">
        {lineStats.map((line) => (
          <li key={line.lineId ?? line.lineName} className={styles.item}>
            <span className={styles.name}>{line.lineName}</span>
            <span className={styles.time}>
              {line.totalSeconds === null
                ? t('lineStats.timeUnknown')
                : `${formatDuration(line.totalSeconds)}${line.hasOpenShift ? '+' : ''}`}
            </span>
            <span className={styles.goals}>{line.goalsFor} : {line.goalsAgainst}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
