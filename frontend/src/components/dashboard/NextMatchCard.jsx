/**
 * NextMatchCard – Hero-Karte des Spieler-Dashboards: nächstes Spiel mit
 * Countdown, Begegnung, Ort und direkter Zu-/Absage. `match` kommt aus
 * useDashboardData.js und ist entweder ein lokales `games`-Objekt oder das
 * von saisonmanagerClient.js gemappte externe Format – normalizeNextMatch
 * vereinheitlicht beides.
 */
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { MapPin, Calendar, ExternalLink } from 'lucide-react';
import { toLocalDate, isWithinLiveOrFutureWindow } from '../../utils/countdown.js';
import { normalizeNextMatch } from '../../utils/dashboardSelectors.js';
import { formatDateOnly } from '../../utils/formatDate.js';
import { buildRouteLink } from '../../utils/osmLink.js';
import MatchCountdown from './MatchCountdown.jsx';
import AvailabilityToggle from './AvailabilityToggle.jsx';
import styles from './NextMatchCard.module.css';

export default function NextMatchCard({ match }) {
  const { t } = useTranslation();
  const next = normalizeNextMatch(match);

  if (!next) {
    return (
      <section className={styles.card} aria-labelledby="next-match-title">
        <h2 id="next-match-title" className={styles.title}>{t('dashboard.nextMatch.title')}</h2>
        <p className={styles.emptyHint}>{t('dashboard.nextMatch.empty')}</p>
        <Link to="/games" className={styles.emptyLink}>{t('dashboard.nextMatch.emptyLink')}</Link>
      </section>
    );
  }

  const targetDate = toLocalDate(next.date, next.time);
  const routeLink = buildRouteLink(next);
  const isCancelled = next.status === 'cancelled';
  const isPostponed = next.status === 'postponed';
  const availabilityDisabled = isCancelled || (targetDate && !isWithinLiveOrFutureWindow(targetDate));

  return (
    <section className={styles.card} aria-labelledby="next-match-title">
      <div className={styles.header}>
        <h2 id="next-match-title" className={styles.title}>{t('dashboard.nextMatch.title')}</h2>
        {isCancelled && <span className={`${styles.badge} ${styles.badgeCancelled}`}>{t('dashboard.status.cancelled')}</span>}
        {isPostponed && <span className={`${styles.badge} ${styles.badgePostponed}`}>{t('dashboard.status.postponed')}</span>}
        {next.source === 'saisonmanager' && (
          <span className={styles.sourceBadge} title={t('dashboard.sourceSaisonmanagerTooltip')}>
            {t('dashboard.sourceSaisonmanager')}
          </span>
        )}
      </div>

      <MatchCountdown targetDate={targetDate} />

      <div className={styles.matchup}>
        <span className={styles.team}>{next.isHome === false ? next.opponent : t('dashboard.nextMatch.ownTeam')}</span>
        <span className={styles.vs}>{t('dashboard.nextMatch.vs')}</span>
        <span className={styles.team}>{next.isHome === false ? t('dashboard.nextMatch.ownTeam') : next.opponent}</span>
      </div>
      {next.isHome !== null && (
        <p className={styles.homeAwayHint}>
          {next.isHome ? t('dashboard.nextMatch.homeGame') : t('dashboard.nextMatch.awayGame')}
        </p>
      )}

      <dl className={styles.infoList}>
        <div className={styles.infoRow}>
          <dt><Calendar size={14} aria-hidden="true" /> {t('dashboard.nextMatch.dateLabel')}</dt>
          <dd>{formatDateOnly(next.date)}{next.time ? ` · ${next.time}` : ''}</dd>
        </div>
        {(next.venueName || next.venueAddress) && (
          <div className={styles.infoRow}>
            <dt><MapPin size={14} aria-hidden="true" /> {t('dashboard.nextMatch.venueLabel')}</dt>
            <dd className={styles.venueText}>
              {next.venueName}
              {next.venueAddress && <span className={styles.venueAddress}>{next.venueAddress}</span>}
            </dd>
          </div>
        )}
      </dl>

      <AvailabilityToggle
        resourceKind="games"
        resourceId={next.id}
        disabled={!next.id || availabilityDisabled}
        disabledReason={isCancelled ? t('dashboard.availability.cancelledHint') : (!next.id ? t('dashboard.availability.externalHint') : null)}
      />

      <div className={styles.actions}>
        {next.id && (
          <Link to={`/games/${next.id}`} className={styles.actionLinkPrimary}>
            {t('dashboard.nextMatch.openDetails')}
          </Link>
        )}
        <Link to="/calendar" className={styles.actionLink}>{t('dashboard.viewInCalendar')}</Link>
        {routeLink && (
          <a href={routeLink} target="_blank" rel="noopener noreferrer" className={styles.actionLink}>
            {t('dashboard.planRoute')} <ExternalLink size={12} aria-hidden="true" />
          </a>
        )}
      </div>
    </section>
  );
}
