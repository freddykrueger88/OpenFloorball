/**
 * DashboardSkeleton – Ladezustand des Spieler-Dashboards (Spieler-
 * Dashboard-Ausbau), Shimmer-Muster wie BoardsPage.module.css/
 * LibraryPage.module.css.
 */
import { useTranslation } from 'react-i18next';
import styles from './DashboardSkeleton.module.css';

export default function DashboardSkeleton() {
  const { t } = useTranslation();
  return (
    <div className={styles.grid} aria-busy="true" aria-label={t('dashboard.loading')}>
      <div className={`${styles.skeleton} ${styles.hero}`} />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={styles.skeleton} />
      ))}
    </div>
  );
}
