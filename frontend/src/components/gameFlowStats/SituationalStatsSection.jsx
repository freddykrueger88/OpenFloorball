/**
 * SituationalStatsSection – Aufschlüsselung nach Periode und Spielstand
 * für ein Spiel (Statistik-Architektur Phase 4). Struktur analog
 * ShotStatsSection.jsx (zwei Unterlisten statt einer).
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { useSituationalStats } from '../../hooks/useSituationalStats.js';
import styles from './SituationalStatsSection.module.css';

export default function SituationalStatsSection({ gameId, events }) {
  const { t } = useTranslation();
  const { situationalStats, error, fetchSituationalStats } = useSituationalStats(gameId);

  useEffect(() => { fetchSituationalStats().catch(() => {}); }, [fetchSituationalStats, events.length]);

  if (!situationalStats) return null;
  const { byPeriod, byScoreState } = situationalStats;
  const hasAnyGoals = byScoreState.some((b) => b.ownGoals > 0 || b.opponentGoals > 0);
  if (!hasAnyGoals) return null;

  const periodLabel = (period) => (period === null ? t('situationalStats.periodUnknown') : period);

  return (
    <section className={styles.panel} aria-label={t('situationalStats.ariaLabel')}>
      <h3 className={styles.heading}>{t('situationalStats.title')}</h3>

      {error && <p className={styles.msgError}><AlertTriangle size={16} aria-hidden="true" /> {error}</p>}

      <div>
        <p className={styles.subheading}>{t('situationalStats.byScoreStateTitle')}</p>
        <ul className={styles.list} role="list">
          {byScoreState.map((b) => (
            <li key={b.scoreState}>
              <span>{t(`situationalStats.${b.scoreState}`)}</span>
              <span>{b.ownGoals} : {b.opponentGoals}</span>
            </li>
          ))}
        </ul>
      </div>

      {byPeriod.length > 0 && (
        <div>
          <p className={styles.subheading}>{t('situationalStats.byPeriodTitle')}</p>
          <ul className={styles.list} role="list">
            {byPeriod.map((b) => (
              <li key={b.period ?? 'unbekannt'}>
                <span>{t('situationalStats.period')} {periodLabel(b.period)}</span>
                <span>{b.ownGoals} : {b.opponentGoals}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
