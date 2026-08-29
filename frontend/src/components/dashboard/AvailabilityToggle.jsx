/**
 * AvailabilityToggle – "Dabei/Eventuell/Nicht dabei" direkt in einer
 * Dashboard-Karte (Spieler-Dashboard-Ausbau). Ein Klick speichert sofort
 * optimistisch über useMyAvailability.js (bestehende RSVP-API, siehe dort).
 * Eigenständig statt Wiederverwendung von RsvpSection.jsx, da diese die
 * ganze Team-Roster-Liste anzeigt (passend für die Spiel-/Trainings-
 * Detailseite) – hier reicht die eigene Zeile, kompakter für eine Karte.
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, HelpCircle, X } from 'lucide-react';
import { useMyAvailability } from '../../hooks/useMyAvailability.js';
import Button from '../common/Button.jsx';
import styles from './AvailabilityToggle.module.css';

// resourceKind: 'games' | 'trainings'
export default function AvailabilityToggle({ resourceKind, resourceId, disabled = false, disabledReason = null }) {
  const { t } = useTranslation();
  const { status, saving, error, justSaved, load, respond } = useMyAvailability(resourceKind, resourceId);

  useEffect(() => { load(); }, [load]);

  const statusText = () => {
    if (status === 'yes') return t('dashboard.availability.confirmedYes');
    if (status === 'maybe') return t('dashboard.availability.confirmedMaybe');
    if (status === 'no') return t('dashboard.availability.confirmedNo');
    return t('dashboard.availability.pending');
  };

  return (
    <div className={styles.wrap}>
      <p className={styles.status}>{statusText()}</p>
      {disabled ? (
        disabledReason && <p className={styles.hint}>{disabledReason}</p>
      ) : (
        <div className={styles.buttons} role="group" aria-label={t('dashboard.availability.groupLabel')}>
          <Button
            variant={status === 'yes' ? 'primary' : 'secondary'}
            size="sm"
            disabled={saving}
            aria-pressed={status === 'yes'}
            onClick={() => respond('yes')}
          >
            <Check size={14} aria-hidden="true" /> {t('rsvp.statusYes')}
          </Button>
          <Button
            variant={status === 'maybe' ? 'primary' : 'secondary'}
            size="sm"
            disabled={saving}
            aria-pressed={status === 'maybe'}
            onClick={() => respond('maybe')}
          >
            <HelpCircle size={14} aria-hidden="true" /> {t('rsvp.statusMaybe')}
          </Button>
          <Button
            variant={status === 'no' ? 'primary' : 'secondary'}
            size="sm"
            disabled={saving}
            aria-pressed={status === 'no'}
            onClick={() => respond('no')}
          >
            <X size={14} aria-hidden="true" /> {t('rsvp.statusNo')}
          </Button>
        </div>
      )}
      {error && <p className={styles.msgError} role="alert">{error}</p>}
      {justSaved && !error && <p className={styles.msgOk} aria-live="polite">{t('dashboard.availability.saved')}</p>}
    </div>
  );
}
