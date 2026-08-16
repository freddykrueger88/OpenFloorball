/**
 * ShotStatsSection – Schuss-Statistiken + Shot Map für ein Spiel
 * (Statistik-Architektur Phase 3). Kombiniert Kennzahlen-Zusammenfassung
 * und Shot Map in einem Panel, statt eine zweite Feld-Darstellung zu
 * bauen (ShotZoneDiagram im readonly+markers-Modus IST die Shot Map).
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { useShotStats } from '../../hooks/useShotStats.js';
import ShotZoneDiagram from './ShotZoneDiagram.jsx';
import styles from './ShotStatsSection.module.css';

export default function ShotStatsSection({ gameId, events }) {
  const { t } = useTranslation();
  const { shotStats, error, fetchShotStats } = useShotStats(gameId);

  useEffect(() => { fetchShotStats().catch(() => {}); }, [fetchShotStats, events.length]);

  if (!shotStats || shotStats.shots === 0) return null;

  const markers = events
    .filter((e) => e.eventType === 'shot')
    .map((e) => ({ id: e._id, x: e.x, y: e.y, outcome: e.outcome }));

  const zoneLabel = (key) => t(key ? `shotZones.${key}` : 'shotZones.unknown');

  return (
    <section className={styles.panel} aria-label={t('shotStats.ariaLabel')}>
      <h3 className={styles.heading}>{t('shotStats.title')}</h3>

      {error && <p className={styles.msgError}><AlertTriangle size={16} aria-hidden="true" /> {error}</p>}

      <ul className={styles.summaryList} role="list">
        <li><span>{t('shotStats.shots')}</span><span>{shotStats.shots}</span></li>
        <li><span>{t('shotStats.shotsOnGoal')}</span><span>{shotStats.shotsOnGoal}</span></li>
        <li><span>{t('shotStats.goals')}</span><span>{shotStats.goals}</span></li>
        <li>
          <span>{t('shotStats.shotPercentage')}</span>
          <span>{shotStats.shotPercentage ?? t('shotStats.percentageUnknown')}</span>
        </li>
      </ul>

      {shotStats.byZone.length > 0 && (
        <div>
          <p className={styles.subheading}>{t('shotStats.byZoneTitle')}</p>
          <ul className={styles.zoneList} role="list">
            {shotStats.byZone.map((z) => (
              <li key={z.zone ?? 'unbekannt'}>
                <span>{zoneLabel(z.zone)}</span>
                <span>{z.shots} ({z.shotPercentage ?? t('shotStats.percentageUnknown')})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ShotZoneDiagram markers={markers} showZoneOverlay={false} />
    </section>
  );
}
