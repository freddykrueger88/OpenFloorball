/**
 * NextTrainingCard – kompaktere Karte für das nächste Training
 * (Spieler-Dashboard-Ausbau), analog NextMatchCard aber schlanker.
 */
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { MapPin, Clock } from 'lucide-react';
import { toLocalDate, isWithinLiveOrFutureWindow } from '../../utils/countdown.js';
import { formatDateOnly } from '../../utils/formatDate.js';
import { buildRouteLink } from '../../utils/osmLink.js';
import MatchCountdown from './MatchCountdown.jsx';
import AvailabilityToggle from './AvailabilityToggle.jsx';
import styles from './NextTrainingCard.module.css';

export default function NextTrainingCard({ session }) {
  const { t } = useTranslation();

  if (!session) {
    return (
      <section className={styles.card} aria-labelledby="next-training-title">
        <h2 id="next-training-title" className={styles.title}>{t('dashboard.nextTraining.title')}</h2>
        <p className={styles.emptyHint}>{t('dashboard.nextTraining.empty')}</p>
        <Link to="/trainings" className={styles.emptyLink}>{t('dashboard.nextTraining.emptyLink')}</Link>
      </section>
    );
  }

  const targetDate = toLocalDate(session.scheduledDate, session.startTime);
  const routeLink = buildRouteLink(session);
  const isCancelled = session.status === 'cancelled';
  const isPostponed = session.status === 'postponed';
  const availabilityDisabled = isCancelled || (targetDate && !isWithinLiveOrFutureWindow(targetDate));

  return (
    <section className={styles.card} aria-labelledby="next-training-title">
      <div className={styles.header}>
        <h2 id="next-training-title" className={styles.title}>{t('dashboard.nextTraining.title')}</h2>
        {isCancelled && <span className={styles.badgeCancelled}>{t('dashboard.status.cancelled')}</span>}
        {isPostponed && <span className={styles.badgePostponed}>{t('dashboard.status.postponed')}</span>}
      </div>

      <p className={styles.name}>{session.name}</p>
      <MatchCountdown targetDate={targetDate} />

      <dl className={styles.infoList}>
        <div className={styles.infoRow}>
          <dt><Clock size={14} aria-hidden="true" /> {t('dashboard.nextMatch.dateLabel')}</dt>
          <dd>{formatDateOnly(session.scheduledDate)}{session.startTime ? ` · ${session.startTime}` : ''}{session.durationMinutes ? ` (${session.durationMinutes} min)` : ''}</dd>
        </div>
        {(session.venueName || session.venueAddress) && (
          <div className={styles.infoRow}>
            <dt><MapPin size={14} aria-hidden="true" /> {t('dashboard.nextMatch.venueLabel')}</dt>
            <dd>{session.venueName}</dd>
          </div>
        )}
      </dl>

      <AvailabilityToggle
        resourceKind="trainings"
        resourceId={session._id}
        disabled={availabilityDisabled}
        disabledReason={isCancelled ? t('dashboard.availability.cancelledHint') : null}
      />

      <div className={styles.actions}>
        <Link to={`/trainings/${session._id}`} className={styles.actionLink}>{t('dashboard.nextTraining.openDetails')}</Link>
        {routeLink && (
          <a href={routeLink} target="_blank" rel="noopener noreferrer" className={styles.actionLink}>
            {t('dashboard.planRoute')}
          </a>
        )}
      </div>
    </section>
  );
}
