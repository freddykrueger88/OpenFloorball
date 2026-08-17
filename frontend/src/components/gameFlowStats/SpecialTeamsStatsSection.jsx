/**
 * SpecialTeamsStatsSection – Powerplay/Penalty-Kill-Statistiken für ein
 * Spiel (Statistik-Architektur Phase 4). Struktur analog
 * GoalkeeperStatsSection.jsx.
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { useSpecialTeamsStats } from '../../hooks/useSpecialTeamsStats.js';
import styles from './SpecialTeamsStatsSection.module.css';

export default function SpecialTeamsStatsSection({ gameId, events }) {
  const { t } = useTranslation();
  const { specialTeamsStats, error, fetchSpecialTeamsStats } = useSpecialTeamsStats(gameId);

  useEffect(() => { fetchSpecialTeamsStats().catch(() => {}); }, [fetchSpecialTeamsStats, events.length]);

  if (!specialTeamsStats) return null;
  const { powerPlay, penaltyKill } = specialTeamsStats;
  if (powerPlay.opportunities === 0 && penaltyKill.opportunities === 0) return null;

  const percentageOrUnknown = (value) => value ?? t('shotStats.percentageUnknown');

  return (
    <section className={styles.panel} aria-label={t('specialTeamsStats.ariaLabel')}>
      <h3 className={styles.heading}>{t('specialTeamsStats.title')}</h3>

      {error && <p className={styles.msgError}><AlertTriangle size={16} aria-hidden="true" /> {error}</p>}

      <div>
        <p className={styles.subheading}>{t('specialTeamsStats.powerPlay')}</p>
        <ul className={styles.list} role="list">
          <li><span>{t('specialTeamsStats.opportunities')}</span><span>{powerPlay.opportunities}</span></li>
          <li><span>{t('specialTeamsStats.goals')}</span><span>{powerPlay.goals}</span></li>
          <li><span>{t('specialTeamsStats.percentage')}</span><span>{percentageOrUnknown(powerPlay.percentage)}</span></li>
        </ul>
      </div>

      <div>
        <p className={styles.subheading}>{t('specialTeamsStats.penaltyKill')}</p>
        <ul className={styles.list} role="list">
          <li><span>{t('specialTeamsStats.opportunities')}</span><span>{penaltyKill.opportunities}</span></li>
          <li><span>{t('specialTeamsStats.goalsAgainst')}</span><span>{penaltyKill.goalsAgainst}</span></li>
          <li><span>{t('specialTeamsStats.percentage')}</span><span>{percentageOrUnknown(penaltyKill.percentage)}</span></li>
        </ul>
      </div>
    </section>
  );
}
