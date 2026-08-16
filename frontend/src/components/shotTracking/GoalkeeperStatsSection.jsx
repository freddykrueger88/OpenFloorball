/**
 * GoalkeeperStatsSection – Torhüter-Basis-Statistiken für ein Spiel
 * (Statistik-Architektur Phase 3). Struktur analog LineStatsSection.jsx.
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { useShotStats } from '../../hooks/useShotStats.js';
import styles from './GoalkeeperStatsSection.module.css';

export default function GoalkeeperStatsSection({ gameId, events, squadForGame }) {
  const { t } = useTranslation();
  const { goalkeeperStats, error, fetchShotStats } = useShotStats(gameId);

  useEffect(() => { fetchShotStats().catch(() => {}); }, [fetchShotStats, events.length]);

  if (goalkeeperStats.length === 0) return null;

  const keeperName = (id) => squadForGame.find((p) => p._id === id)?.name ?? t('goalkeeperStats.unknownPlayer');

  return (
    <section className={styles.panel} aria-label={t('goalkeeperStats.ariaLabel')}>
      <h3 className={styles.heading}>{t('goalkeeperStats.title')}</h3>

      {error && <p className={styles.msgError}><AlertTriangle size={16} aria-hidden="true" /> {error}</p>}

      <ul className={styles.list} role="list">
        {goalkeeperStats.map((gk) => (
          <li key={gk.rosterPlayerId} className={styles.item}>
            <span className={styles.name}>{keeperName(gk.rosterPlayerId)}</span>
            <span className={styles.stat}>{t('goalkeeperStats.shotsAgainst')}: {gk.shotsOnGoalAgainst}</span>
            <span className={styles.stat}>{t('goalkeeperStats.saves')}: {gk.saves}</span>
            <span className={styles.stat}>{t('goalkeeperStats.goalsAgainst')}: {gk.goalsAgainst}</span>
            <span className={styles.stat}>
              {t('goalkeeperStats.savePercentage')}: {gk.savePercentage ?? t('shotStats.percentageUnknown')}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
