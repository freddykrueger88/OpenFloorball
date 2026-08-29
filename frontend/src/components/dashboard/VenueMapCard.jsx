/**
 * VenueMapCard – OpenStreetMap-Einbindung für den nächsten Spielort
 * (Spieler-Dashboard-Ausbau). Bewusst ein `<iframe>`-Embed statt Leaflet/
 * react-leaflet (siehe Plan-ADR: keine neue Karten-Abhängigkeit, keine
 * Koordinaten von Saisonmanager verfügbar) – ein iframe kann nicht mit
 * einem JS-Fehler abstürzen, das Dashboard bleibt so in jedem Fall robust.
 * Ohne Koordinaten UND ohne Adresse wird die Karte komplett ausgeblendet
 * (kein leerer/kaputter Rahmen).
 */
import { useTranslation } from 'react-i18next';
import { MapPin, ExternalLink } from 'lucide-react';
import { normalizeNextMatch } from '../../utils/dashboardSelectors.js';
import { buildOsmEmbedUrl, buildRouteLink } from '../../utils/osmLink.js';
import styles from './VenueMapCard.module.css';

export default function VenueMapCard({ match }) {
  const { t } = useTranslation();
  const next = normalizeNextMatch(match);

  if (!next || (!next.venueLat && !next.venueAddress && !next.venueName)) return null;

  const routeLink = buildRouteLink(next);

  return (
    <section className={styles.card} aria-labelledby="venue-map-title">
      <h2 id="venue-map-title" className={styles.title}>{t('dashboard.venueMap.title')}</h2>

      {next.venueLat != null && next.venueLng != null ? (
        <>
          <div className={styles.mapWrap}>
            <iframe
              className={styles.map}
              title={t('dashboard.venueMap.iframeTitle', { venue: next.venueName ?? '' })}
              src={buildOsmEmbedUrl(next.venueLat, next.venueLng)}
              loading="lazy"
            />
          </div>
          <p className={styles.attribution}>
            © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap-Mitwirkende</a>
          </p>
        </>
      ) : (
        <div className={styles.addressFallback}>
          <MapPin size={20} aria-hidden="true" />
          <div>
            <p className={styles.venueName}>{next.venueName}</p>
            <p className={styles.venueAddress}>{next.venueAddress}</p>
          </div>
        </div>
      )}

      <dl className={styles.infoRow}>
        {next.venueName && <div><dt>{t('dashboard.venueMap.venueLabel')}</dt><dd>{next.venueName}</dd></div>}
        <div><dt>{t('dashboard.nextMatch.dateLabel')}</dt><dd>{next.date}{next.time ? ` · ${next.time}` : ''}</dd></div>
      </dl>

      {routeLink && (
        <a href={routeLink} target="_blank" rel="noopener noreferrer" className={styles.routeLink}>
          {t('dashboard.venueMap.openInOsm')} <ExternalLink size={12} aria-hidden="true" />
        </a>
      )}
    </section>
  );
}
