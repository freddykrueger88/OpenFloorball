/**
 * UpcomingEventsCard – die nächsten Termine (Spiele + Trainings gemischt,
 * chronologisch), Spieler-Dashboard-Ausbau. Daten kommen bereits fertig
 * sortiert/gefiltert aus dashboardSelectors.js::selectUpcomingEvents.
 */
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Volleyball, Clipboard } from 'lucide-react';
import styles from './UpcomingEventsCard.module.css';

export default function UpcomingEventsCard({ events }) {
  const { t } = useTranslation();

  return (
    <section className={styles.card} aria-labelledby="upcoming-events-title">
      <h2 id="upcoming-events-title" className={styles.title}>{t('dashboard.upcomingEvents.title')}</h2>

      {events.length === 0 ? (
        <p className={styles.emptyHint}>{t('dashboard.upcomingEvents.empty')}</p>
      ) : (
        <ul className={styles.list} role="list">
          {events.map((event) => (
            <li key={`${event.type}-${event.id}`} className={styles.item}>
              <span className={styles.icon} aria-hidden="true">
                {event.type === 'game' ? <Volleyball size={16} /> : <Clipboard size={16} />}
              </span>
              <div className={styles.details}>
                <Link to={event.type === 'game' ? `/games/${event.id}` : `/trainings/${event.id}`} className={styles.eventLink}>
                  {event.title || (event.type === 'game' ? t('dashboard.upcomingEvents.game') : t('dashboard.upcomingEvents.training'))}
                </Link>
                <span className={styles.eventMeta}>
                  {event.date.toLocaleDateString()} · {event.date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  {event.status === 'postponed' && ` · ${t('dashboard.status.postponed')}`}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
