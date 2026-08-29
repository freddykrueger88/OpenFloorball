/**
 * DashboardHeader – persönliche Begrüßung + Kontext (Spieler-Dashboard-
 * Ausbau). Nutzt den Namen des eingeloggten Nutzers, wenn verfügbar
 * (authStore.user.name, siehe auth.js GET /me).
 */
import { useTranslation } from 'react-i18next';
import useAuthStore from '../../store/authStore.js';
import { getCountdown } from '../../utils/countdown.js';
import styles from './DashboardHeader.module.css';

// ISO-8601-Kalenderwoche (Montag als Wochenstart, Woche 1 enthält den
// ersten Donnerstag des Jahres) – Standard-Algorithmus, keine externe
// Bibliothek nötig für einen einzelnen Kontext-Wert.
function getIsoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

export default function DashboardHeader({ teamName, nextMatchDate }) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const week = getIsoWeek(new Date());
  const countdown = nextMatchDate ? getCountdown(nextMatchDate) : null;

  return (
    <header className={styles.header}>
      <h1 className={styles.greeting}>
        {user?.name ? t('dashboard.greeting.withName', { name: user.name }) : t('dashboard.greeting.default')}
      </h1>
      <p className={styles.subtitle}>{t('dashboard.greeting.subtitle')}</p>
      <div className={styles.context}>
        {teamName && <span className={styles.contextItem}>{teamName}</span>}
        <span className={styles.contextItem}>{t('dashboard.greeting.week', { week })}</span>
        {countdown && !countdown.isPast && !countdown.isLive && (
          <span className={styles.contextItem}>
            {countdown.isToday
              ? t('dashboard.greeting.matchToday')
              : t('dashboard.greeting.matchInDays', { count: countdown.days })}
          </span>
        )}
        {countdown?.isLive && <span className={`${styles.contextItem} ${styles.live}`}>{t('dashboard.countdown.live')}</span>}
      </div>
    </header>
  );
}
